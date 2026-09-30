"""Resumable OpenRouter generation matrix. No candidate filtering."""

import json
import re
import time
from decimal import Decimal

from openai import OpenAI

from app.services.ai.question_generator import QuestionGenerator
from app.services.ai.retry import RetryState, _call_with_retry
from .budget import Budget, BudgetStop, estimate
from .config import append, digest, rows

ADDITIONS = {
    'production': '',
    'exam_scenario': '\nADDITIONAL INSTRUCTIONS:\nAsk scenario-based questions in the style '
                     'of a professional certification exam. Use realistic decisions and constraints.',
    'code_tracing': '\nADDITIONAL INSTRUCTIONS:\nAsk what the supplied code prints or returns. '
                    'Preserve the code semantics and make each answer unambiguous.',
}


def prompt_for(passage, variant, count):
    generator = object.__new__(QuestionGenerator)
    base = generator._build_batch_prompt(passage['text'], count, 'mixed')
    return base + ADDITIONS[variant]


def matrix(config, passages):
    for model in config['models']:
        for variant in config['prompt_variants']:
            for passage in passages:
                if variant == 'code_tracing' and passage['kind'] != 'code':
                    continue
                prompt = prompt_for(passage, variant, config['questions_per_call'])
                cell = {'model_requested': model, 'prompt_variant': variant,
                        'prompt_hash': digest(prompt), 'passage_id': passage['id'],
                        'set': passage['set'], 'passage': passage, 'prompt': prompt}
                cell['id'] = digest(f"{model}:{variant}:{passage['id']}:{digest(prompt)}")
                yield cell


def dry_run(cells, prices):
    total = Decimal(0)
    unknown = set()
    for cell in cells:
        try:
            total += estimate(cell['prompt'], prices.get(cell['model_requested'], {}))
        except BudgetStop:
            unknown.add(cell['model_requested'])
    cost = str(total) if not unknown else 'unknown (calls refused)'
    print(f'Matrix size: {len(cells)} calls. Worst-case cost: ${cost}. Network calls: 0.')
    if unknown:
        print('Unknown prices: ' + ', '.join(sorted(unknown)))
    return len(cells), total, unknown


def response_record(response):
    choice = response.choices[0]
    usage = response.usage
    return {'model_actual': response.model,
            'upstream_provider': getattr(response, 'provider', None),
            'raw_response': choice.message.content or '',
            'prompt_tokens': getattr(usage, 'prompt_tokens', None),
            'completion_tokens': getattr(usage, 'completion_tokens', None),
            'usage_cost': getattr(usage, 'cost', None),
            'finish_reason': choice.finish_reason,
            'truncated': choice.finish_reason == 'length'}


def parse_response(raw):
    generator = object.__new__(QuestionGenerator)
    try:
        questions = generator._parse_batch_response(raw)
        error = None if questions else 'Production parser returned no questions'
        return questions, error
    except Exception as error:
        return [], str(error)


def raw_candidates(raw):
    match = re.search(r'\[.*\]', raw, re.DOTALL)
    try:
        data = json.loads(match.group(0)) if match else []
        return data if isinstance(data, list) else []
    except (ValueError, TypeError):
        return []


def generate_cell(cell, client, budget, model_price):
    record = {k: v for k, v in cell.items() if k != 'prompt'}
    state = RetryState()
    started = time.monotonic()
    attempt = 0
    reservations = []

    def call():
        nonlocal attempt
        attempt += 1
        identifier = f"generate:{cell['id']}:{attempt}"
        budget.reserve(identifier, estimate(cell['prompt'], model_price))
        reservations.append(identifier)
        response = client.chat.completions.create(
            model=cell['model_requested'], temperature=0.7, max_tokens=4096,
            messages=[{'role': 'user', 'content': cell['prompt']}],
        )
        budget.settle(identifier, getattr(response.usage, 'cost', None))
        return response

    try:
        response = _call_with_retry(call, 'OpenRouter', state=state)
        record.update(response_record(response))
        record['parsed_questions'], record['parse_error'] = parse_response(record['raw_response'])
        record['raw_candidates'] = raw_candidates(record['raw_response'])
        record['model_mismatch'] = record['model_actual'] != cell['model_requested']
    except BudgetStop:
        raise
    except Exception as error:
        record.update(raw_response='', parsed_questions=[], raw_candidates=[], parse_error=str(error),
                      call_error=type(error).__name__, usage_cost=None, model_actual=None,
                      upstream_provider=None, prompt_tokens=None, completion_tokens=None,
                      finish_reason=None, truncated=False, model_mismatch=False)
    record.update(latency=time.monotonic() - started, attempts=attempt,
                  total_cost=str(sum((budget.entries[r] for r in reservations), Decimal(0))))
    return record


def generate(config, passages, directory, prices, client=None, dry=False):
    cells = list(matrix(config, passages))
    if dry:
        return dry_run(cells, prices)
    budget = Budget(directory / 'ledger.jsonl', config['budget_cap'], recover=True)
    done = {record['id'] for record in rows(directory / 'candidates.jsonl')}
    for cell in cells:
        if cell['id'] in done:
            continue
        try:
            model_price = prices.get(cell['model_requested'], {})
            estimate(cell['prompt'], model_price)
            if client is None:
                from app.services.secrets import get_secret
                client = OpenAI(api_key=get_secret('openrouter'),
                                base_url='https://openrouter.ai/api/v1', max_retries=0)
            record = generate_cell(cell, client, budget, model_price)
            append(directory / 'candidates.jsonl', record)
        except BudgetStop as error:
            print(str(error))
            break
