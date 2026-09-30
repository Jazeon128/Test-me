"""Deterministic rules, pinned Jev verification, and grouped metrics."""

import csv
import json
import math
from collections import defaultdict
from decimal import Decimal
from unittest.mock import patch

from app.services import jev
from app.services.ai import verify
from .budget import Budget, BudgetStop, MILLION, tokens
from .config import append, rows

MAX_STEM_CHARS = 600
MAX_OPTION_CHARS = 250
JEV_MODEL = 'jev-1.13.0'


def deterministic(question):
    question = question if isinstance(question, dict) else {}
    errors = []
    options = question.get('options', [])
    options = options if isinstance(options, list) else []
    option_count = len(options)
    options = [o for o in options if isinstance(o, dict)]
    labels = [o.get('option') for o in options]
    texts = [o.get('text') if isinstance(o.get('text'), str) else '' for o in options]
    stem = question.get('question') if isinstance(question.get('question'), str) else ''
    explanation = question.get('explanation')
    if option_count != 4 or len(labels) != 4 or set(str(label) for label in labels) != set('ABCD'):
        errors.append('option_labels')
    key = question.get('correct_answer')
    if not isinstance(key, str) or key not in 'ABCD' or len(key) != 1 or labels.count(key) != 1:
        errors.append('answer_key')
    if not stem.strip():
        errors.append('empty_stem')
    if any(not text.strip() for text in texts) or len(texts) != 4:
        errors.append('empty_option')
    if not isinstance(explanation, str) or not explanation.strip():
        errors.append('empty_explanation')
    normalized = [' '.join(text.lower().split()) for text in texts]
    if len(set(normalized)) != len(normalized):
        errors.append('duplicate_options')
    errors.extend(length_errors(stem, texts))
    correct = next((o.get('text') for o in options if o.get('option') == key), '')
    leak = isinstance(correct, str) and bool(correct.strip()) and correct in stem
    return {'passed': not errors, 'errors': errors, 'answer_leak': leak}


def length_errors(stem, texts):
    result = []
    if len(stem) > MAX_STEM_CHARS:
        result.append('stem_length')
    if any(len(text) > MAX_OPTION_CHARS for text in texts):
        result.append('option_length')
    return result


def jev_check(passage, question, api_key, budget, identifier):
    payload = {'state': verify.build_state(passage, question),
               'questions': verify._questions(), 'model': JEV_MODEL}
    reservation = tokens(json.dumps(payload)) * Decimal('0.042') / MILLION
    budget.reserve(identifier, reservation)
    reported = None
    original = jev.ask

    def ask(**kwargs):
        nonlocal reported
        answers = original(**kwargs)
        if answers.input_tokens:
            reported = answers.input_tokens * Decimal('0.042') / MILLION
        return answers

    try:
        with patch.object(jev, 'MODEL', JEV_MODEL), patch.object(jev, 'ask', ask):
            verdict = verify.verify_question(passage, question, api_key)
        return {'checked': verdict.verdict.checked, 'flagged': verdict.flagged,
                'reasons': verdict.reasons,
                'flags': {f.name: f.probability for f in verdict.verdict.flags}, 'model': JEV_MODEL}
    except jev.JevUnavailable as error:
        return {'checked': False, 'flagged': False, 'flags': {}, 'reasons': [str(error)],
                'model': JEV_MODEL}
    finally:
        budget.settle(identifier, reported)


def unchecked(error):
    return {'checked': False, 'flagged': False, 'flags': {},
            'reasons': [str(error)], 'model': JEV_MODEL}


def safe_jev_check(call, question, key, budget, identifier):
    try:
        return jev_check(call['passage']['text'], question, key, budget, identifier)
    except (AttributeError, TypeError, ValueError) as error:
        return unchecked(error)


def check(directory, api_key=None):
    candidates = rows(directory / 'candidates.jsonl')
    config = json.loads((directory / 'config.json').read_text(encoding='utf-8'))
    budget = Budget(directory / 'ledger.jsonl', config['budget_cap'])
    done = {r['id'] for r in rows(directory / 'checks.jsonl')}
    stopped = False
    for call in candidates:
        for index, question in enumerate(call.get('raw_candidates', call['parsed_questions'])):
            identifier = f"check:{call['id']}:{index}"
            if identifier in done:
                continue
            if api_key is None:
                from app.services.secrets import get_secret
                api_key = get_secret('typesafe')
            try:
                rules = deterministic(question)
                if stopped:
                    raise BudgetStop('Budget cap reached. Jev unchecked.')
                verdict = safe_jev_check(call, question, api_key, budget, identifier)
            except BudgetStop as error:
                if not stopped:
                    print(str(error))
                stopped = True
                verdict = unchecked(error)
            record = {'id': identifier, 'call_id': call['id'], 'question_index': index,
                      'deterministic': rules, 'jev': verdict,
                      'cost': str(budget.entries.get(identifier, 0))}
            append(directory / 'checks.jsonl', record)
    summary(directory, candidates, rows(directory / 'checks.jsonl'))


def percentile(values, fraction):
    if not values:
        return 0
    values = sorted(values)
    position = (len(values) - 1) * fraction
    lower = math.floor(position)
    upper = math.ceil(position)
    return values[lower] + (values[upper] - values[lower]) * (position - lower)


def metrics(calls, checks):
    count = sum(len(c.get('raw_candidates', c['parsed_questions'])) for c in calls)
    checked = [r for r in checks if r['jev']['checked']]
    accepted = sum(r['deterministic']['passed'] and r['jev']['checked']
                   and not r['jev']['flagged'] for r in checks)
    cost = sum((Decimal(c['total_cost']) for c in calls), Decimal(0))
    cost += sum((Decimal(r['cost']) for r in checks), Decimal(0))
    result = {'candidates': count, 'parse_failures': sum(bool(c['parse_error']) for c in calls),
              'deterministic_pass_rate': sum(r['deterministic']['passed'] for r in checks) / count if count else 0,
              'unchecked_rate': (count - len(checked)) / count if count else 0,
              'joint_pass_rate': accepted / count if count else 0, 'total_cost': str(cost),
              'cost_per_10_generated': str(cost * 10 / count) if count else '',
              'cost_per_10_accepted': str(cost * 10 / accepted) if accepted else '',
              'latency_p50': percentile([c['latency'] for c in calls], .5),
              'latency_p95': percentile([c['latency'] for c in calls], .95)}
    for name, threshold in verify.THRESHOLDS.items():
        result[name + '_rate'] = sum(r['jev']['flags'].get(name, 0) >= threshold
                                     for r in checked) / count if count else 0
    return result


def summary(directory, candidates, checks):
    grouped = defaultdict(list)
    for call in candidates:
        grouped[(call['model_requested'], call['prompt_variant'], call['set'])].append(call)
    result = []
    for (model, variant, name), calls in sorted(grouped.items()):
        ids = {c['id'] for c in calls}
        selected = [r for r in checks if r['call_id'] in ids]
        result.append(dict(model=model, variant=variant, set=name, **metrics(calls, selected)))
    fields = list(result[0]) if result else ['model', 'variant', 'set'] + list(metrics([], []))
    with (directory / 'summary.csv').open('w', encoding='utf-8', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        writer.writerows(result)
    return result
