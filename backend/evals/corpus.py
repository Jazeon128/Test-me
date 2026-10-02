"""Deterministic sampling and immutable passage manifests."""

import fnmatch
import os
import random
import re
import subprocess
from pathlib import Path

from app.services.passages import split_passages
from . import adapters
from .config import ROOT, digest, load, write

SKIP = {'node_modules', '.git', '.venv', '__pycache__'}
MAX_BYTES = 20 * 1024 * 1024


def reference_sources(grouped, manifest):
    eligible = {}
    for group, paths in grouped.items():
        for path in paths:
            if path.suffix.lower() != '.csv':
                eligible.setdefault(group, []).append(path)
                continue
            try:
                source = adapters.parse(path)
            except Exception:
                eligible.setdefault(group, []).append(path)
                continue
            if source.sections or not source.reference_items:
                eligible.setdefault(group, []).append(path)
                continue
            manifest['reference_items'].extend(
                dict(item, source_path=str(path)) for item in source.reference_items)
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


def freeze(config, output=None):
    output = Path(output or ROOT / 'corpus')
    commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
    reports = {}
    for name, paths in config['sets'].items():
        files = candidates(paths, config.get('exclude', []))
        grouped = groups(files)
        manifest = {'passages': [], 'parse_failures': [], 'reference_items': [],
                    'seed': config['seed'], 'set': name}
        eligible = reference_sources(grouped, manifest)
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
