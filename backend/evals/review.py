"""Blind owner review exports and offline judge agreement."""

import csv
from collections import defaultdict

from .config import rows
from .judge import blind, items, stratified
from .stats import agreement


def write_csv(path, records, fields):
    with path.open('w', encoding='utf-8', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        writer.writerows(records)


def create_sheet(directory, config):  # noqa: C901
    target = directory / 'human_review.csv'
    if target.exists():
        return
    pool = items(directory)
    judges = defaultdict(list)
    for row in rows(directory / 'judges.jsonl'):
        if 'good' in row:
            judges[row['item_id']].append(row)
    disagreements = [i for i in pool if len(judges[i['id']]) == 2 and any(
        judges[i['id']][0].get(f) != judges[i['id']][1].get(f)
        for f in ('solve', 'rubric', 'good', 'excellent'))]
    rejected = [i for i in pool if not i['check'].get('deterministic', {}).get('passed') or
                i['check'].get('jev', {}).get('flagged')]
    selected = {}
    for category in (disagreements, rejected):
        for item in stratified(category, 10, config['seed']):
            selected[item['id']] = item
    cells = defaultdict(list)
    for item in pool:
        cells[item['cell']].append(item)
    # Reserved categories count toward per-cell quotas. Fill the least represented cell.
    while len(selected) < min(60, len(pool)):
        available = {cell: [i for i in group if i['id'] not in selected]
                     for cell, group in cells.items()}
        remaining = [cell for cell in sorted(cells) if available[cell]]
        cell = min(remaining, key=lambda c: sum(i['cell'] == c for i in selected.values()))
        item = stratified(available[cell], 1, config['seed'])[0]
        selected[item['id']] = item
    records, keys = [], []
    for item in selected.values():
        payload, _ = blind(item, config['seed'])
        records.append({'item_id': item['id'], 'set': item['set'],
                        'passage_text': item['passage'], 'stem': payload['solve']['stem'],
                        'options': '\n'.join(f'{k}: {v}' for k, v in payload['solve']['options'].items()),
                        'intended_key': payload['rubric']['intended_key'],
                        'key_correct': '', 'good': '', 'excellent': '', 'notes': ''})
        keys.append({'item_id': item['id'], 'model': item['cell'][0], 'variant': item['cell'][1]})
    fields = ['item_id', 'set', 'passage_text', 'stem', 'options',
              'intended_key', 'key_correct', 'good', 'excellent', 'notes']
    write_csv(target, records, fields)
    write_csv(directory / 'human_review_key.csv', keys, ['item_id', 'model', 'variant'])
    if len(disagreements) < 10 or len(rejected) < 10 or len(pool) < 60:
        print(f'Review availability: {len(pool)} items, {len(disagreements)} disagreements, '
              f'{len(rejected)} rejected. Quotas use all available items when insufficient.')


def review_agreement(directory):
    with (directory / 'human_review.csv').open(encoding='utf-8', newline='') as stream:
        human = {r['item_id']: r for r in csv.DictReader(stream)}
    grouped = defaultdict(list)
    for row in rows(directory / 'judges.jsonl'):
        if 'good' in row and row['item_id'] in human:
            grouped[row['judge']].append(row)
    result = {}
    for model, records in grouped.items():
        result[model] = {}
        for field in ('key_correct', 'good'):
            pairs = []
            for row in records:
                value = human[row['item_id']][field].strip().lower()
                judged = row['rubric'][field] if field == 'key_correct' else ('yes' if row[field] else 'no')
                if value in ('yes', 'no'):
                    pairs.append((value, judged))
            result[model][field] = agreement(pairs)
    print(result)
    return result
