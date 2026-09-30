"""Self-contained offline HTML study-question evaluation report."""

import html
import json
import subprocess
from collections import Counter, defaultdict
from datetime import datetime, timezone
from decimal import Decimal
from itertools import combinations
from pathlib import Path

from .checks import metrics
from .config import rows
from .judge import items
from .stats import agreement, bootstrap, wilson


def rate(records, field):
    n = len(records)
    wins = sum(r[field] for r in records)
    low, high = wilson(wins, n)
    return f'{wins}/{n} ({wins / n:.1%}, 95% {low:.1%} to {high:.1%})' if n else 'unchecked (n=0)'


def table(headers, records):
    return '<div class="scroll"><table><tr>' + ''.join(
        '<th>' + html.escape(str(h)) + '</th>' for h in headers) + '</tr>' + ''.join(
            '<tr>' + ''.join('<td>' + html.escape(str(v)) + '</td>' for v in row) + '</tr>'
            for row in records) + '</table></div>'


def current_commit():
    result = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=Path(__file__).parent,
                            capture_output=True, text=True, check=False)
    return result.stdout.strip() if result.returncode == 0 else 'unavailable'


def report(directory):  # noqa: C901
    config = json.loads((directory / 'config.json').read_text(encoding='utf-8'))
    snapshot = directory / 'judge_config.json'
    if snapshot.exists():
        config.update(json.loads(snapshot.read_text(encoding='utf-8')))
    calls = rows(directory / 'candidates.jsonl')
    checks = rows(directory / 'checks.jsonl')
    pool = {i['id']: i for i in items(directory)}
    judges = rows(directory / 'judges.jsonl')
    primary = config['judge']['primary']
    second = config['judge']['second']
    cells = defaultdict(list)
    for call in calls:
        cells[(call['model_requested'], call['prompt_variant'])].append(call)
    judged = defaultdict(list)
    for row in judges:
        if 'good' in row and row['item_id'] in pool:
            judged[(pool[row['item_id']]['cell'], row['judge'])].append(row)
    latest = {}
    for event in rows(directory / 'ledger.jsonl'):
        identifier = event['id'] + (':abandoned' if event['event'] == 'abandon' else '')
        if event['event'] == 'abandon':
            latest.pop(event['id'], None)
        phase = event.get('phase', 'generate' if event['id'].startswith('generate:') else 'check')
        latest[identifier] = (phase, Decimal(event['amount']))
    spend = defaultdict(Decimal)
    for phase, amount in latest.values():
        spend[phase] += amount
    facts = {'date': config.get('date', datetime.fromtimestamp(
        (directory / 'config.json').stat().st_mtime, timezone.utc).isoformat()),
        'git commit': config.get('git_commit', config.get('commit', current_commit() + ' (report HEAD, generation commit not recorded)')), 'seed': config['seed'],
        'models': sorted({c['model_requested'] for c in calls}),
        'actual models seen': sorted({c.get('model_actual') for c in calls if c.get('model_actual')}),
        'judge actual models': sorted({r.get('model_actual') for r in judges if r.get('model_actual')}),
        'prompt hashes': sorted({c['prompt_hash'] for c in calls} |
                                {r['prompt_hash'] for r in judges}),
        'sample sizes': dict(Counter(r['judge'] for r in judges if 'good' in r)),
        'spend by phase': {k: str(v) for k, v in spend.items()},
        'budget cap': config['budget_cap'], 'judge budget cap': config.get('judge_budget', '2.00')}
    parts = ['<h1>Question evaluation</h1><h2>Run facts</h2>', table(['Fact', 'Value'], facts.items())]
    ranking = []
    ordered = sorted(cells, key=lambda cell: -sum(r['good'] for r in judged[(cell, primary)]) /
                     max(1, len(judged[(cell, primary)])))
    for cell in ordered:
        group = cells[cell]
        ids = {c['id'] for c in group}
        m = metrics(group, [c for c in checks if c['call_id'] in ids])
        a, b = judged[(cell, primary)], judged[(cell, second)]
        other = {r['item_id']: r for r in b}
        agree = agreement((r['good'], other[r['item_id']]['good']) for r in a if r['item_id'] in other)
        ranking.append([*cell, m['candidates'], m['parse_failures'], m['deterministic_pass_rate'],
                        m['joint_pass_rate'], m['unchecked_rate'], rate(a, 'good'), rate(a, 'excellent'),
                        rate(b, 'good'), agree, m['cost_per_10_accepted'], m['latency_p50'], m['latency_p95']])
    headers = ['Model', 'Variant', 'Questions generated', 'Parse failures',
               'Deterministic pass rate', 'Jev joint pass rate', 'Jev unchecked rate', 'Primary good',
               'Primary excellent', 'Second good', 'Judge agreement percent and kappa',
               'Cost per 10 accepted questions', 'Latency p50', 'Latency p95']
    parts += ['<h2>Ranking</h2>', table(headers, ranking)]
    paired = []
    for left, right in combinations(sorted(cells), 2):
        if left[1] != right[1] or left[0] == right[0]:
            continue
        groups = []
        for cell in (left, right):
            by_passage = defaultdict(list)
            for row in judged[(cell, primary)]:
                by_passage[pool[row['item_id']]['passage_id']].append(row['good'])
            groups.append(by_passage)
        paired.append([left, right, bootstrap(*groups, config['seed']),
                       len(set(groups[0]) & set(groups[1]))])
    parts += ['<h2>Paired comparison</h2><p>Difference in good rate. 95% passage bootstrap, '
              '2,000 seeded resamples. Only shared passages contribute.</p>',
              table(['Left', 'Right', 'Difference and 95% interval', 'Shared passages'], paired)]
    per_set = defaultdict(lambda: defaultdict(list))
    for item in pool.values():
        per_set[item['set']]
    for cell in cells:
        for row in judged[(cell, primary)]:
            per_set[pool[row['item_id']]['set']][cell].append(row)
    winners = []
    for name, groups in sorted(per_set.items()):
        if not groups:
            winners.append([name, 'unchecked', 'unchecked (n=0)'])
            continue
        best = max(sorted(groups), key=lambda c: sum(r['good'] for r in groups[c]) / len(groups[c]))
        winners.append([name, best, rate(groups[best], 'good')])
    parts += ['<h2>Per set</h2>', table(['Set', 'Best cell', 'Good rate and interval'], winners),
              '<h2>Failure examples</h2>']
    for cell in ordered:
        failures = Counter(f for r in judged[(cell, primary)] for f, v in r['rubric'].items() if v != 'yes')
        if not failures:
            continue
        common = failures.most_common(1)[0][0]
        examples = []
        for row in judged[(cell, primary)]:
            if row['rubric'][common] == 'yes':
                continue
            item = pool[row['item_id']]
            examples.append([item['passage'][:700], item['question'],
                             [f for f, v in row['rubric'].items() if v != 'yes']])
            if len(examples) == 3:
                break
        parts += ['<h3>' + html.escape(str(cell)) + ': ' + common + '</h3>',
                  table(['Passage excerpt', 'Question', 'Failed items'], examples)]
    parts += ['<h2>Limits</h2><p>Rates use only judged samples. Sample sizes appear above. '
              'Missing or invalid judge responses remain unchecked. Judge bias is not eliminated '
              'by blindness. The human sheet is the ground truth. Small samples and passage '
              'correlation limit conclusions. Cost per accepted question uses rules and Jev acceptance.</p>']
    page = '''<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Evaluation report</title>
<style>:root{color-scheme:light dark}body{font:16px system-ui;margin:16px;line-height:1.5}
.scroll{overflow:auto}table{border-collapse:collapse}th,td{border:1px solid #888;padding:8px;
text-align:left;vertical-align:top}p{max-width:80ch}h3{overflow-wrap:anywhere}</style><body>'''
    target = directory / 'report.html'
    target.write_text(page + ''.join(parts) + '</body></html>', encoding='utf-8')
    return target
