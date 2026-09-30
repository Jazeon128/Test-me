"""Deterministic sampling and immutable passage manifests."""

import fnmatch
import os
import random
import re
import subprocess
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch

from app.services import jev
from app.services.ai import sourcing
from app.services.passages import split_passages
from . import adapters
from .budget import Budget, BudgetStop, MILLION, tokens
from .checks import JEV_MODEL
from .config import ROOT, digest, load, write

SKIP = {'node_modules', '.git', '.venv', '__pycache__'}
MAX_BYTES = 20 * 1024 * 1024
SCREEN_CHARS = 12000
SCREEN_INSTRUCTION_TOKENS = 1024


def assess(path, key, budget, sha):
    source = adapters.parse(path)
    text = '\n'.join(section.text for section in source.sections)[:SCREEN_CHARS]
    title = path.stem
    identifier = f'screen:{sha}'
    estimated = (tokens(title + text) + SCREEN_INSTRUCTION_TOKENS) * Decimal('0.042') / MILLION
    budget.reserve(identifier, estimated)
    reported = None
    original = jev.ask

    def ask(*args, **kwargs):
        nonlocal reported
        answers = original(*args, **kwargs)
        if answers.input_tokens:
            reported = answers.input_tokens * Decimal('0.042') / MILLION
        return answers

    try:
        with patch.object(jev, 'MODEL', JEV_MODEL), patch.object(jev, 'ask', ask):
            score = sourcing.assess_source(title, text, key)
        return {'checked': score.checked, 'is_teachable': score.is_teachable,
                'is_transcript': score.is_transcript, 'worth_generating': score.worth_generating,
                'model': JEV_MODEL}
    finally:
        budget.settle(identifier, reported)


def screen(grouped, config, output, name, key, cache, manifest):
    total_other = sum((Budget(output / other / 'screen_ledger.jsonl', config['budget_cap']).total
                       for other in config['sets'] if other != name), Decimal(0))
    remaining = Decimal(config['budget_cap']) - total_other
    budget = Budget(output / name / 'screen_ledger.jsonl', max(remaining, Decimal(0)), phase='screen')
    eligible = {}
    for path in sample(grouped, config.get('screen_limit', 40), config['seed']):
        sha = digest(path.read_bytes())
        try:
            if sha not in cache:
                cache[sha] = assess(path, key, budget, sha)
                write(output / 'screen_cache.json', cache)
            score = cache[sha]
        except Exception as error:
            score = {'checked': False, 'is_teachable': None, 'is_transcript': None,
                     'worth_generating': False, 'model': JEV_MODEL, 'error': str(error)}
            if not isinstance(error, BudgetStop):
                manifest['parse_failures'].append({'source_path': str(path), 'error': str(error)})
        group = normalized_stem(path)
        manifest['screened'].append(dict(score, group=group, source_path=str(path), source_sha256=sha))
        if score['checked'] and score['worth_generating']:
            eligible[group] = grouped[group]
    return eligible


def excluded(path, patterns):
    """Owner-listed files that are about the tooling, not the subject."""
    name = path.name.lower()
    return any(fnmatch.fnmatch(name, pattern.lower()) for pattern in patterns)


def candidates(paths, exclude=()):
    found = set()
    for root in paths:
        for directory, dirs, files in os.walk(root):
            dirs[:] = sorted(d for d in dirs if d.lower() not in SKIP)
            for name in sorted(files):
                path = Path(directory) / name
                if excluded(path, exclude):
                    continue
                if path.suffix.lower() in adapters.EXTENSIONS and path.stat().st_size <= MAX_BYTES:
                    found.add(path.resolve())
    return sorted(found, key=lambda p: str(p).lower())


def normalized_stem(path):
    stem = re.sub(r'[_-]+', ' ', path.stem.lower())
    stem = re.sub(r'\b(copy|final|draft|version|v\d+)\b|\(\d+\)', '', stem)
    return re.sub(r'[^a-z0-9]', '', stem)


def groups(files):
    result = {}
    for path in files:
        result.setdefault(normalized_stem(path), []).append(path)
    return result


def sample(grouped, count, seed):
    rng = random.Random(seed)
    buckets = {}
    for key in sorted(grouped):
        representative = sorted(grouped[key], key=str)[0]
        buckets.setdefault(representative.suffix.lower(), []).append(representative)
    for bucket in buckets.values():
        rng.shuffle(bucket)
    selected = []
    while buckets and len(selected) < count:
        for extension in sorted(list(buckets)):
            selected.append(buckets[extension].pop())
            if not buckets[extension]:
                del buckets[extension]
            if len(selected) == count:
                break
    return selected


def source_records(path, set_name, config, commit):
    source = adapters.parse(path)
    passages = split_passages(source.sections)
    if not passages and not source.reference_items:
        raise ValueError('Parser extracted no passages or reference items')
    chosen = sorted(passages[:20], key=lambda p: (-len(p['text']), p['ordinal']))
    records = []
    for passage in chosen[:config['passages_per_source']]:
        record = dict(passage, set=set_name, source_path=str(path),
                      source_sha256=digest(path.read_bytes()), parser=source.parser,
                      app_version=commit, metadata=source.metadata,
                      kind=source.kinds[passage['section_index']], seed=config['seed'],
                      passage_sha256=digest(passage['text']))
        record['id'] = digest(f"{set_name}:{path}:{passage['ordinal']}:{record['passage_sha256']}")
        records.append(record)
    references = [dict(item, source_path=str(path)) for item in source.reference_items]
    return records, references


def freeze(config, output=None, no_screen=False, api_key=None):
    output = Path(output or ROOT / 'corpus')
    if not no_screen:
        if api_key is None:
            from app.services.secrets import get_secret
            api_key = get_secret('typesafe')
        if not api_key:
            raise ValueError('Freeze screening requires a TypeSafe key. Configure it or use --no-screen.')
    cache_path = output / 'screen_cache.json'
    cache = load(cache_path) if cache_path.exists() and not no_screen else {}
    commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
    reports = {}
    for name, paths in config['sets'].items():
        files = candidates(paths, config.get('exclude', []))
        grouped = groups(files)
        manifest = {'passages': [], 'parse_failures': [], 'reference_items': [],
                    'seed': config['seed'], 'set': name, 'screened': []}
        eligible = grouped if no_screen else screen(grouped, config, output, name, api_key, cache, manifest)
        selected = sample(eligible, config['sources_per_set'], config['seed'])
        for path in selected:
            try:
                records, references = source_records(path, name, config, commit)
                manifest['passages'].extend(records)
                manifest['reference_items'].extend(references)
            except Exception as error:
                manifest['parse_failures'].append({'source_path': str(path), 'error': str(error)})
        report = {'files_found': len(files), 'groups': len(grouped),
                  'sampled_sources': len(selected), 'parse_failures': len(manifest['parse_failures']),
                  'reference_items': len(manifest['reference_items'])}
        manifest['report'] = report
        write(output / name / 'manifest.json', manifest)
        reports[name] = report
        print(name, report)
    return reports


def frozen(config, root=None):
    root = Path(root or ROOT / 'corpus')
    return [p for name in config['sets']
            for p in load(root / name / 'manifest.json')['passages']]
