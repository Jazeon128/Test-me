"""Durable Decimal reservations, including uncertain failed requests."""

from decimal import Decimal, ROUND_CEILING

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
    def __init__(self, path, cap, phase=None):
        self.path = path
        self.phase = phase
        self.cap = price(cap)
        self.entries = {}
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
        for identifier in sorted(unresolved):
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
