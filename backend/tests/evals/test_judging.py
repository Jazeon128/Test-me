"""Offline judge and HTML integration checks."""
import csv
import json
from types import SimpleNamespace

import pytest

from evals.config import append, rows, write
from evals.judge import FIELDS, SOLVE_PROMPT, RUBRIC_PROMPT, blind, items, judge, sample, validate
from evals.report import report
from evals.review import review_agreement
from evals.stats import agreement, bootstrap, wilson


class Fake:
    def __init__(self):
        self.calls = []
        self.chat = SimpleNamespace(completions=self)

    def create(self, **kwargs):
        self.calls.append(kwargs)
        content = kwargs['messages'][0]['content']
        if content.startswith(SOLVE_PROMPT):
            payload = json.loads(content[len(SOLVE_PROMPT) + 1:])
            answer = next(k for k, v in payload['options'].items() if v == '0')
            raw = json.dumps({'solve': answer})
        else:
            payload = json.loads(content[len(RUBRIC_PROMPT) + 1:])
            rubric = dict.fromkeys(FIELDS, 'yes')
            if kwargs['model'].startswith('mistralai'):
                rubric['clear_stem'] = 'no'
            raw = json.dumps(rubric)
        return SimpleNamespace(model=kwargs['model'], usage=SimpleNamespace(cost=0), choices=[
            SimpleNamespace(message=SimpleNamespace(content=raw), finish_reason='stop')])


@pytest.fixture
def run(tmp_path):
    config = {'models': ['google/test'], 'judge': {'primary': 'anthropic/test',
              'second': 'mistralai/test'}, 'seed': 7, 'judge_per_cell': 20,
              'budget_cap': '3', 'judge_budget': '2'}
    write(tmp_path / 'config.json', config)
    for n in range(70):
        question = {'question': '**Which** result?', 'options': [
            {'option': letter, 'text': str(i)} for i, letter in enumerate('ABCD')],
            'correct_answer': 'A', 'explanation': 'Because zero', 'difficulty': 'hard'}
        append(tmp_path / 'candidates.jsonl', {'id': str(n), 'model_requested': 'google/test',
               'model_actual': 'google/test', 'prompt_variant': 'production', 'prompt_hash': 'hash',
               'passage_id': str(n % 7), 'set': str(n % 2), 'passage': {'text': 'Returns zero.'},
               'parsed_questions': [question], 'parse_error': None, 'total_cost': '0', 'latency': 1})
        append(tmp_path / 'checks.jsonl', {'id': f'check:{n}:0', 'call_id': str(n),
               'deterministic': {'passed': n >= 10}, 'jev': {'checked': True, 'flagged': False,
               'flags': {}}, 'cost': '0'})
    return tmp_path, config


def test_full_pipeline(run):
    directory, config = run
    client = Fake()
    prices = {m: {'prompt_per_million': 1, 'completion_per_million': 1}
              for m in config['judge'].values()}
    judge(config, directory, prices, client, dry=True)
    assert not client.calls and not (directory / 'ledger.jsonl').exists()
    judge(config, directory, prices, client)
    assert len(client.calls) == 80
    records = rows(directory / 'judges.jsonl')
    assert {r['item_id'] for r in records if r['judge'] == 'anthropic/test'} == {
        r['item_id'] for r in records if r['judge'] == 'mistralai/test'}
    judge(config, directory, prices, client)
    assert len(client.calls) == 80
    with (directory / 'human_review.csv').open(newline='', encoding='utf-8') as stream:
        sheet = list(csv.DictReader(stream))
    assert len(sheet) == 60
    assert 'model' not in sheet[0] and 'variant' not in sheet[0]
    assert sum(int(r['item_id'].split(':')[1]) < 10 for r in sheet) == 10
    assert len({r['item_id'] for r in sheet} & {r['item_id'] for r in records}) >= 10
    assert (directory / 'human_review_key.csv').exists()
    assert review_agreement(directory)['anthropic/test']['good']['n'] == 0
    page = report(directory).read_text(encoding='utf-8')
    for heading in ('Run facts', 'Ranking', 'Paired comparison', 'Per set', 'Failure examples', 'Limits'):
        assert '<h2>' + heading + '</h2>' in page
    assert 'https://' not in page


def test_blind_and_derivation(run):
    directory, _ = run
    pool = items(directory)
    payload, mapping = blind(pool[0], 7)
    solve = json.dumps(payload['solve'])
    for hidden in ('google', 'production', 'Because zero', 'hard', 'explanation', 'difficulty'):
        assert hidden not in solve
    assert mapping[payload['rubric']['intended_key']] == 'A'
    assert blind(pool[0], 7) == (payload, mapping)
    assert len({i['passage_id'] for i in sample(pool, 20, 7)}) == 7
    data = {'solve': 'A', 'rubric': dict.fromkeys(FIELDS, 'yes')}
    assert validate(data, 'A', '')['excellent']
    assert data['rubric']['explanation_correct'] == 'unjudgeable'
    data['rubric']['grounded'] = 'unjudgeable'
    assert not validate(data, 'A', 'text')['good']
    data['rubric']['grounded'] = 'yes'
    data['rubric']['tests_understanding'] = 'no'
    assert validate(data, 'A', 'text')['good']
    assert not validate(data, 'A', 'text')['excellent']
    with pytest.raises(ValueError):
        validate({'solve': 'Z', 'rubric': {}}, 'A', '')


def test_cap(run):
    directory, config = run
    config['judge_budget'] = '0'
    client = Fake()
    judge(config, directory, {m: {'prompt_per_million': 1, 'completion_per_million': 1}
                             for m in config['judge'].values()}, client)
    assert not client.calls


def test_maths():
    assert wilson(5, 10) == pytest.approx((.2365930905, .7634069095))
    result = agreement([(True, True)] * 20 + [(True, False)] * 5 +
                       [(False, True)] * 5 + [(False, False)] * 20)
    assert result['kappa'] == pytest.approx(.6)
    assert result['percent'] == 80
    assert bootstrap({'a': [1], 'b': [1]}, {'a': [0], 'b': [0]}, 7) == (1, 1, 1)
    assert bootstrap({'a': [1], 'b': [0]}, {'a': [0], 'b': [1]}, 7) == (0, -1, 1)


def test_phase_budget_and_recovery(tmp_path):
    from evals.judge import JudgeBudget
    from evals.budget import BudgetStop
    from decimal import Decimal
    ledger = tmp_path / 'ledger.jsonl'
    append(ledger, {'id': 'generate:1', 'event': 'settle', 'amount': '50'})
    budget = JudgeBudget(ledger, '.5')
    assert budget.total == 0
    budget.reserve('judge:one', Decimal('.2'))
    budget.settle('judge:one', Decimal('.1'))
    budget.reserve('judge:two', Decimal('.2'))
    recovered = JudgeBudget(ledger, '.5')
    assert recovered.total == Decimal('.3')
    assert rows(ledger)[-1]['event'] == 'abandon'
    recovered.reserve('judge:two', Decimal('.1'))
    with pytest.raises(BudgetStop):
        recovered.reserve('judge:three', Decimal('.2'))
    assert all(r.get('phase') == 'judge' for r in rows(ledger)[1:])


def test_filled_agreement(run):
    from evals.review import write_csv
    directory, config = run
    client = Fake()
    judge(config, directory, {m: {'prompt_per_million': 0, 'completion_per_million': 0}
                             for m in config['judge'].values()}, client)
    path = directory / 'human_review.csv'
    with path.open(encoding='utf-8', newline='') as stream:
        sheet = list(csv.DictReader(stream))
    for row in sheet:
        row.update(key_correct='yes', good='yes')
    write_csv(path, sheet, list(sheet[0]))
    result = review_agreement(directory)
    assert result['anthropic/test']['good']['percent'] == 100
    assert result['mistralai/test']['good']['percent'] == 0
    original = path.read_bytes()
    judge(config, directory, {}, client)
    assert path.read_bytes() == original


def test_stratified_cells(run):
    directory, _ = run
    pool = items(directory)
    other = [dict(i, id='other:' + i['id'], cell=('qwen/test', 'scenario')) for i in pool]
    selected = sample(pool + other, 12, 9)
    assert len(selected) == 24
    assert {i['cell'] for i in selected} == {('google/test', 'production'), ('qwen/test', 'scenario')}
    for cell in {i['cell'] for i in selected}:
        assert {i['set'] for i in selected if i['cell'] == cell} == {'0', '1'}
    assert selected == sample(pool + other, 12, 9)


def test_invalid_judge_response(run):
    directory, config = run
    client = Fake()
    def invalid(**kwargs):
        return SimpleNamespace(model=kwargs['model'], usage=SimpleNamespace(cost=0), choices=[
            SimpleNamespace(message=SimpleNamespace(content='{"solve":"Z","rubric":{}}'),
                            finish_reason='stop')])
    client.create = invalid
    judge(config, directory, {m: {'prompt_per_million': 0, 'completion_per_million': 0}
                             for m in config['judge'].values()}, client)
    assert all('error' in r and 'good' not in r for r in rows(directory / 'judges.jsonl'))
    assert 'unchecked (n=0)' in report(directory).read_text(encoding='utf-8')


def test_two_call_payloads_cost_and_ids(run):
    from decimal import Decimal
    from evals.budget import estimate
    from evals.config import digest
    from evals.judge import stage_prompt
    directory, config = run
    config['judge_per_cell'] = 1
    prices = {m: {'prompt_per_million': 1, 'completion_per_million': 1}
              for m in config['judge'].values()}
    client = Fake()
    count, cost, unknown = judge(config, directory, prices, client, dry=True)
    assert count == 4 and not unknown and not client.calls
    item = sample(items(directory), 1, config['seed'])[0]
    payload, _ = blind(item, config['seed'])
    expected = sum((estimate(stage_prompt(payload, stage)[1], prices[model])
                    for model in config['judge'].values() for stage in ('solve', 'rubric')), Decimal(0))
    assert cost == expected
    judge(config, directory, prices, client)
    assert len(client.calls) == 4
    for index in (0, 2):
        solve_call, rubric_call = client.calls[index:index + 2]
        assert solve_call['messages'] == [{'role': 'user', 'content': stage_prompt(payload, 'solve')[1]}]
        exact_solve = json.loads(solve_call['messages'][0]['content'][len(SOLVE_PROMPT) + 1:])
        assert set(exact_solve) == {'passage', 'stem', 'options'}
        assert 'intended_key' not in json.dumps(solve_call['messages'])
        assert 'Because zero' not in json.dumps(solve_call['messages'])
        assert 'explanation' not in json.dumps(solve_call['messages'])
        assert rubric_call['messages'] == [{'role': 'user', 'content': stage_prompt(payload, 'rubric')[1]}]
        exact_rubric = json.loads(rubric_call['messages'][0]['content'][len(RUBRIC_PROMPT) + 1:])
        assert exact_rubric == dict(payload['solve'], **payload['rubric'])
        assert 'solve' not in exact_rubric
        assert solve_call['response_format']['json_schema']['schema']['required'] == ['solve']
        assert set(rubric_call['response_format']['json_schema']['schema']['required']) == set(FIELDS)
    events = rows(directory / 'ledger.jsonl')
    for model in config['judge'].values():
        for stage in ('solve', 'rubric'):
            identifier = f"judge:{item['id']}:{model}:{stage}:1"
            assert [e['event'] for e in events if e['id'] == identifier] == ['reserve', 'settle']
    stages = rows(directory / 'judge_calls.jsonl')
    assert [s['stage'] for s in stages] == ['solve', 'rubric', 'solve', 'rubric']
    assert [s['prompt_hash'] for s in stages] == [digest(SOLVE_PROMPT), digest(RUBRIC_PROMPT)] * 2


def test_resume_only_rubric(run):
    directory, config = run
    config['judge_per_cell'] = 1
    prices = {m: {'prompt_per_million': 0, 'completion_per_million': 0}
              for m in config['judge'].values()}
    client = Fake()
    judge(config, directory, prices, client)
    # Simulate the checkpoint after primary solve, with the second judge already completed.
    stages = [r for r in rows(directory / 'judge_calls.jsonl')
              if not (r['judge'] == config['judge']['primary'] and r['stage'] == 'rubric')]
    combined = [r for r in rows(directory / 'judges.jsonl') if r['judge'] != config['judge']['primary']]
    for name, records in [('judge_calls.jsonl', stages), ('judges.jsonl', combined)]:
        (directory / name).write_text(''.join(json.dumps(r) + '\n' for r in records), encoding='utf-8')
    client.calls.clear()
    judge(config, directory, prices, client)
    assert len(client.calls) == 1
    assert client.calls[0]['messages'][0]['content'].startswith(RUBRIC_PROMPT)
    primary = [r for r in rows(directory / 'judges.jsonl') if r['judge'] == config['judge']['primary']]
    assert len(primary) == 1 and primary[0]['good']
    assert primary[0]['calls']['solve'] == stages[0]
