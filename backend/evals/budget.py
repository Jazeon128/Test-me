"""Durable Decimal reservations, including uncertain failed requests."""

import atexit
import os
from contextlib import contextmanager
from decimal import Decimal, ROUND_CEILING
from pathlib import Path

from .config import append, rows

MILLION = Decimal(1000000)
MAX_OUTPUT = 4096


class BudgetStop(RuntimeError):
    pass


def tokens(text):
    return int((Decimal(len(text)) / Decimal('3.5')).to_integral_value(rounding=ROUND_CEILING))


def price(value):
    if value is None:
        raise BudgetStop('Unknown model price. Call refused.')
    result = Decimal(str(value))
    if not result.is_finite() or result < 0:
        raise BudgetStop('Invalid model price. Call refused.')
    return result


def estimate(prompt, model):
    return (tokens(prompt) * price(model.get('prompt_per_million'))
            + MAX_OUTPUT * price(model.get('completion_per_million'))) / MILLION


class Budget:
    def __init__(self, path, cap, phase=None, recover=False):
        self.path = path
        self.phase = phase
        self.cap = price(cap)
        self.entries = {}
        if recover:
            _hold_lock(Path(path).parent)
        unresolved = set()
        for event in rows(path):
            if event['event'] == 'abandon':
                self.entries.pop(event['id'], None)
                self.entries[event['id'] + ':abandoned'] = Decimal(event['amount'])
                unresolved.discard(event['id'])
                continue
            self.entries[event['id']] = Decimal(event['amount'])
            if event['event'] == 'reserve':
                unresolved.add(event['id'])
            else:
                unresolved.discard(event['id'])
        # A reservation left open by a killed run may or may not have been
        # billed. Count it as spent, the safe side, and free its id for a retry.
        # Only a run holding the run lock may do this: a reader would otherwise
        # abandon the call a live run has in flight.
        for identifier in sorted(unresolved if recover else ()):
            amount = self.entries.pop(identifier)
            self._record(identifier, amount, 'abandon')
            self.entries.pop(identifier, None)
            self.entries[identifier + ':abandoned'] = amount

    @property
    def total(self):
        return sum(self.entries.values(), Decimal(0))

    def reserve(self, identifier, amount):
        amount = price(amount)
        if identifier in self.entries:
            raise BudgetStop('Unresolved reservation already exists: ' + identifier)
        if self.total + amount > self.cap:
            raise BudgetStop(f'Budget cap ${self.cap} reached. Spent/reserved ${self.total}.')
        self._record(identifier, amount, 'reserve')
        return amount

    def settle(self, identifier, reported=None):
        amount = self.entries[identifier] if reported is None else price(reported)
        self._record(identifier, amount, 'settle')

    def _record(self, identifier, amount, event):
        record = {'id': identifier, 'amount': str(amount), 'event': event}
        if self.phase:
            record['phase'] = self.phase
        append(self.path, record)
        self.entries[identifier] = amount


class RunLocked(RuntimeError):
    pass


@contextmanager
def run_lock(directory):
    """One writer per run directory. A stale lock from a dead process is replaced."""
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    lock = directory / 'run.lock'
    if lock.exists():
        pid = int(lock.read_text(encoding='utf-8').strip() or 0)
        if pid and pid != os.getpid() and _alive(pid):
            raise RunLocked(f'Run {directory.name} is already in progress (process {pid}).')
    lock.write_text(str(os.getpid()), encoding='utf-8')
    try:
        yield
    finally:
        if lock.exists() and lock.read_text(encoding='utf-8').strip() == str(os.getpid()):
            lock.unlink()


def _alive(pid):
    if os.name == 'nt':
        import ctypes
        handle = ctypes.windll.kernel32.OpenProcess(0x1000, False, pid)
        if not handle:
            return False
        code = ctypes.c_ulong()
        ctypes.windll.kernel32.GetExitCodeProcess(handle, ctypes.byref(code))
        ctypes.windll.kernel32.CloseHandle(handle)
        return code.value == 259  # STILL_ACTIVE
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True


_held = set()


def _hold_lock(directory):
    """Take the run lock for the rest of this process, released at exit."""
    if directory in _held:
        return
    lock = run_lock(directory)
    lock.__enter__()
    _held.add(directory)
    atexit.register(lock.__exit__, None, None, None)


def settle_refused(budget, identifier, error):
    """A request the server answered with an error status was not billed.

    Timeouts and dropped connections have no status: the provider may have run
    the request, so their reservation stays counted as spent.
    """
    status = getattr(error, 'status_code', None)
    if isinstance(status, int) and 400 <= status < 600:
        budget.settle(identifier, 0)
