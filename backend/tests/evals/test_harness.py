"""Offline harness behavior with local files and fake provider responses."""

import copy
import json
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace

import pytest

from evals import adapters, checks, corpus, generate
from evals.budget import Budget, BudgetStop, estimate
from evals.config import append, digest, load, rows, write
from app.services import jev
from app.services.ai import verify


@pytest.fixture
def question():
    return {'question': 'Which value is returned?',
            'options': [{'option': label, 'text': text}
                        for label, text in zip('ABCD', ['one', 'two', 'three', 'four'])],
            'correct_answer': 'A', 'explanation': 'The function returns one.'}


@pytest.fixture
def passage():
    return {'id': 'passage1', 'set': 'pcep', 'kind': 'code', 'text': 'print(1)'}


@pytest.fixture
def config():
    return {'models': ['test/model'], 'prompt_variants': ['production', 'exam_scenario', 'code_tracing'],
            'questions_per_call': 3, 'budget_cap': '3.00', 'seed': 20260930,
            'sources_per_set': 8, 'passages_per_source': 1, 'sets': {}}


@pytest.fixture
def prices():
    return {'test/model': {'prompt_per_million': '1', 'completion_per_million': '2'}}


def test_notebook(tmp_path):
    path = tmp_path / 'tiny.ipynb'
    write(path, {'metadata': {'kernelspec': {'language': 'python'},
                             'language_info': {'version': '3.12'}},
                 'cells': [{'cell_type': 'markdown', 'source': ['Hello ', 'world']},
                           {'cell_type': 'code', 'source': ['print(1)'],
                            'outputs': [{'text': ['x' * 1500]}]},
                           {'cell_type': 'raw', 'source': ['ignored']}]})
    source = adapters.parse(path)
    assert source.kinds == ['prose', 'code']
    assert source.sections[0].text == 'Hello world'
    assert source.sections[1].text == 'print(1)\n' + 'x' * 1000
    assert source.metadata == {'language': 'python', 'version': '3.12'}


@pytest.mark.parametrize('filename,content,reference', [
    ('anki.csv', 'front,back,extra\nfront text,back text,detail\n', False),
    ('test.csv', 'Question,ANSWER\nWhat?,This\n', True),
    ('practice-exam.csv', 'What?,This\n', True),
])
def test_csv(tmp_path, filename, content, reference):
    path = tmp_path / filename
    path.write_text(content, encoding='utf-8')
    source = adapters.parse(path)
    assert bool(source.reference_items) == reference
    assert bool(source.sections) != reference
    if not reference:
        assert source.sections[0].text == 'Q: front text\nA: back text\ndetail'


def test_grouping_and_stratification():
    files = [Path('Guide.md'), Path('Guide-final.pdf'), Path('Guide (1).docx'),
             Path('Other.pdf'), Path('Third.ipynb')]
    grouped = corpus.groups(files)
    assert len(grouped) == 3
    assert len(grouped['guide']) == 3
    sampled = corpus.sample(grouped, 3, 42)
    assert len(sampled) == 3
    assert len({corpus.normalized_stem(p) for p in sampled}) == 3
    assert sampled == corpus.sample(grouped, 3, 42)


def test_freeze_determinism_and_parse_failure(tmp_path, config):
    source = tmp_path / 'source'
    source.mkdir()
    (source / 'notes.md').write_text('# Study\n\n' + 'Useful study material. ' * 100,
                                    encoding='utf-8')
    (source / 'broken.ipynb').write_text('not json', encoding='utf-8')
    (source / 'practice.csv').write_text('question,answer\nWhat?,Answer\n', encoding='utf-8')
    hidden = source / 'node_modules'
    hidden.mkdir()
    (hidden / 'ignored.md').write_text('ignored', encoding='utf-8')
    config['sets'] = {'test': [str(source)]}
    output = tmp_path / 'frozen'
    reports = corpus.freeze(config, output, no_screen=True)
    path = output / 'test' / 'manifest.json'
    first = path.read_bytes()
    corpus.freeze(config, output, no_screen=True)
    assert first == path.read_bytes()
    assert reports['test'] == {'files_found': 3, 'groups': 3, 'sampled_sources': 3,
                               'parse_failures': 1, 'reference_items': 1}
    manifest = load(path)
    assert len(manifest['passages']) == 1
    p = manifest['passages'][0]
    assert p['passage_sha256'] == digest(p['text'])
    assert p['source_sha256'] == digest((source / 'notes.md').read_bytes())
    assert len(p['app_version']) == 40


def test_prompts_and_applicability(config, passage):
    cells = list(generate.matrix(config, [passage, dict(passage, id='prose', kind='prose')]))
    assert len(cells) == 5
    assert all(c['prompt_hash'] == digest(c['prompt']) for c in cells)
    assert len({c['prompt_hash'] for c in cells}) == 3
    generator = object.__new__(generate.QuestionGenerator)
    assert cells[0]['prompt'] == generator._build_batch_prompt(passage['text'], 3, 'mixed')
    assert generate.prompt_for(passage, 'exam_scenario', 3).startswith(cells[0]['prompt'])


def test_budget(tmp_path):
    path = tmp_path / 'ledger.jsonl'
    budget = Budget(path, '0.01')
    budget.reserve('first', Decimal('0.008'))
    with pytest.raises(BudgetStop, match='cap'):
        budget.reserve('second', Decimal('0.003'))
    budget.settle('first', '0.004')
    budget.reserve('second', Decimal('0.006'))
    budget.settle('second')
    resumed = Budget(path, '0.01')
    assert resumed.total == Decimal('0.010')
    with pytest.raises(BudgetStop):
        resumed.reserve('third', Decimal('0.00001'))
    with pytest.raises(BudgetStop, match='already exists'):
        resumed.reserve('first', 0)


def test_unknown_price_and_estimate():
    with pytest.raises(BudgetStop, match='Unknown'):
        estimate('text', {'prompt_per_million': None, 'completion_per_million': '1'})
    assert estimate('1234', {'prompt_per_million': '1', 'completion_per_million': '2'}) == Decimal('0.008194')


def fake_client(question):
    calls = []

    def create(**kwargs):
        calls.append(kwargs)
        return SimpleNamespace(model='different/model', provider='upstream',
                               usage=SimpleNamespace(prompt_tokens=10, completion_tokens=20, cost=0.001),
                               choices=[SimpleNamespace(finish_reason='length',
                                                        message=SimpleNamespace(content=json.dumps([question])))])
    client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    return client, calls


def test_generation_and_resume(tmp_path, config, passage, prices, question):
    client, calls = fake_client(question)
    generate.generate(config, [passage], tmp_path, prices, client=client)
    records = rows(tmp_path / 'candidates.jsonl')
    assert len(records) == 3
    assert records[0]['raw_response'] == json.dumps([question])
    assert records[0]['parsed_questions'] == [question]
    assert records[0]['raw_candidates'] == [question]
    assert records[0]['model_mismatch']
    assert records[0]['upstream_provider'] == 'upstream'
    assert records[0]['truncated']
    assert records[0]['attempts'] == 1
    assert records[0]['usage_cost'] == .001
    assert Budget(tmp_path / 'ledger.jsonl', 3).total == Decimal('.003')
    assert calls[0]['temperature'] == .7
    assert calls[0]['max_tokens'] == 4096
    generate.generate(config, [passage], tmp_path, prices, client=client)
    assert len(calls) == 3


def test_raw_malformed_candidates_retained():
    raw = '[{"question": "Incomplete"}]'
    parsed, error = generate.parse_response(raw)
    assert parsed == [] and error
    assert generate.raw_candidates(raw) == [{'question': 'Incomplete'}]


def test_dry_run_no_client(tmp_path, config, passage, prices, capsys):
    class Forbidden:
        def __getattr__(self, name):
            raise AssertionError('Network call attempted')
    result = generate.generate(config, [passage], tmp_path, prices, client=Forbidden(), dry=True)
    assert result[0] == 3
    assert result[1] > 0
    assert not list(tmp_path.iterdir())
    assert 'Network calls: 0' in capsys.readouterr().out


def test_generation_stops_at_cap(tmp_path, config, passage, prices, question):
    config['budget_cap'] = '0'
    client, calls = fake_client(question)
    generate.generate(config, [passage], tmp_path, prices, client=client)
    assert not calls
    assert not (tmp_path / 'candidates.jsonl').exists()


@pytest.mark.parametrize('rule,mutate', [
    ('option_labels', lambda q: q['options'][0].update(option='E')),
    ('answer_key', lambda q: q.update(correct_answer='AB')),
    ('empty_stem', lambda q: q.update(question=' ')),
    ('empty_option', lambda q: q['options'][0].update(text=' ')),
    ('empty_explanation', lambda q: q.update(explanation=' ')),
    ('duplicate_options', lambda q: q['options'][1].update(text='  ONE  ')),
    ('stem_length', lambda q: q.update(question='x' * 601)),
    ('option_length', lambda q: q['options'][0].update(text='x' * 251)),
])
def test_each_rule(question, rule, mutate):
    assert checks.deterministic(question)['passed']
    mutate(question)
    assert rule in checks.deterministic(question)['errors']
    assert not checks.deterministic(question)['passed']


def test_leak_and_boundaries(question):
    question['question'] = 'Does it return one?'
    assert checks.deterministic(question) == {'passed': True, 'errors': [], 'answer_leak': True}
    question['question'] = 'x' * 600
    question['options'][0]['text'] = 'y' * 250
    assert checks.deterministic(question)['passed']
    question['options'].append(None)
    assert 'option_labels' in checks.deterministic(question)['errors']


def test_jev_unavailable_and_pin(tmp_path, monkeypatch, question):
    original = jev.MODEL

    def unavailable(*args, **kwargs):
        assert jev.MODEL == 'jev-1.13.0'
        assert args[0] == 'exact source'
        raise jev.JevUnavailable('offline')
    monkeypatch.setattr(verify, 'verify_question', unavailable)
    budget = Budget(tmp_path / 'ledger.jsonl', 3)
    result = checks.jev_check('exact source', question, '', budget, 'check')
    assert not result['checked']
    assert not result['flagged']
    assert result['reasons'] == ['offline']
    assert jev.MODEL == original
    assert budget.total > 0


def test_summary_arithmetic(tmp_path):
    calls = [{'id': '1', 'model_requested': 'm', 'prompt_variant': 'v', 'set': 's',
              'parsed_questions': [{}, {}], 'parse_error': None, 'total_cost': '.20', 'latency': 1},
             {'id': '2', 'model_requested': 'm', 'prompt_variant': 'v', 'set': 's',
              'parsed_questions': [], 'parse_error': 'bad JSON', 'total_cost': '.10', 'latency': 3}]
    records = [{'call_id': '1', 'cost': '.01', 'deterministic': {'passed': True},
                'jev': {'checked': True, 'flagged': False, 'flags': {}}},
               {'call_id': '1', 'cost': '.01', 'deterministic': {'passed': False},
                'jev': {'checked': False, 'flagged': False, 'flags': {}}}]
    result = checks.summary(tmp_path, calls, records)[0]
    assert result['candidates'] == 2
    assert result['parse_failures'] == 1
    assert result['deterministic_pass_rate'] == .5
    assert result['unchecked_rate'] == .5
    assert result['joint_pass_rate'] == .5
    assert result['total_cost'] == '0.32'
    assert Decimal(result['cost_per_10_generated']) == Decimal('1.60')
    assert Decimal(result['cost_per_10_accepted']) == Decimal('3.20')
    assert result['latency_p50'] == 2
    assert result['latency_p95'] == pytest.approx(2.9)
    flagged = copy.deepcopy(records)
    flagged[0]['jev'].update(flagged=True, flags={'answer_is_wrong': .7})
    assert checks.metrics(calls, flagged)['answer_is_wrong_rate'] == .5
    assert (tmp_path / 'summary.csv').exists()


def test_check_run_and_resume(tmp_path, config, question, monkeypatch):
    write(tmp_path / 'config.json', config)
    append(tmp_path / 'candidates.jsonl', {'id': 'call', 'model_requested': 'm',
                                         'prompt_variant': 'production', 'set': 's',
                                         'passage': {'text': 'exact source'},
                                         'parsed_questions': [question], 'parse_error': None,
                                         'total_cost': '0', 'latency': 1})
    seen = []

    def fake(source, q, key):
        seen.append(source)
        return verify.QuestionVerdict(0, jev.Verdict(flags=[]))
    monkeypatch.setattr(verify, 'verify_question', fake)
    checks.check(tmp_path, api_key='fake')
    checks.check(tmp_path, api_key='fake')
    assert seen == ['exact source']
    assert len(rows(tmp_path / 'checks.jsonl')) == 1


def test_checks_at_cap_keep_deterministic_results(tmp_path, config, question, monkeypatch):
    config['budget_cap'] = '0'
    write(tmp_path / 'config.json', config)
    append(tmp_path / 'candidates.jsonl', {'id': 'call', 'model_requested': 'm',
                                         'prompt_variant': 'production', 'set': 's',
                                         'passage': {'text': 'exact source'},
                                         'parsed_questions': [question, question],
                                         'parse_error': None, 'total_cost': '0', 'latency': 1})

    def forbidden(*args, **kwargs):
        raise AssertionError('Jev must not run at the cap')
    monkeypatch.setattr(verify, 'verify_question', forbidden)
    checks.check(tmp_path, api_key='fake')
    records = rows(tmp_path / 'checks.jsonl')
    assert len(records) == 2
    assert all(r['deterministic']['passed'] for r in records)
    assert all(not r['jev']['checked'] for r in records)
    assert not (tmp_path / 'ledger.jsonl').exists()


def test_jev_reported_tokens(tmp_path, question, monkeypatch):
    def ask(**kwargs):
        assert jev.MODEL == 'jev-1.13.0'
        return jev.Answers({name: {'noul': .9} for name in verify.THRESHOLDS}, input_tokens=2000)
    monkeypatch.setattr(jev, 'ask', ask)
    budget = Budget(tmp_path / 'ledger.jsonl', 3)
    result = checks.jev_check('source', question, 'fake', budget, 'jev')
    assert result['checked'] and result['flagged']
    assert len(result['flags']) == 4
    assert budget.total == Decimal('0.000084')


def test_retry_reserves_each_attempt(tmp_path, config, passage, prices, question, monkeypatch):
    client, calls = fake_client(question)
    create = client.chat.completions.create
    attempts = []

    def flaky(**kwargs):
        attempts.append(kwargs)
        if len(attempts) == 1:
            error = RuntimeError('upstream failure')
            error.status_code = 500
            raise error
        return create(**kwargs)
    monkeypatch.setattr(client.chat.completions, 'create', flaky)
    monkeypatch.setattr('app.services.ai.retry.time.sleep', lambda seconds: None)
    cell = next(generate.matrix(config, [passage]))
    budget = Budget(tmp_path / 'ledger.jsonl', 3)
    record = generate.generate_cell(cell, client, budget, prices['test/model'])
    assert record['attempts'] == 2
    assert len(calls) == 1
    assert budget.total == estimate(cell['prompt'], prices['test/model']) + Decimal('.001')
    assert Decimal(record['total_cost']) == budget.total


def test_open_reservation_from_a_killed_run_counts_as_spent_and_can_retry(tmp_path):
    from decimal import Decimal
    from evals.budget import Budget
    ledger = tmp_path / 'ledger.jsonl'
    first = Budget(ledger, '1.00')
    first.reserve('call:1', '0.30')
    # The process dies here: no settle. The resuming writer recovers it.
    second = Budget(ledger, '1.00', recover=True)
    assert second.total == Decimal('0.30')
    second.reserve('call:1', '0.30')
    second.settle('call:1', '0.10')
    assert second.total == Decimal('0.40')
    third = Budget(ledger, '1.00')
    assert third.total == Decimal('0.40')


def test_reading_a_ledger_never_abandons_a_live_reservation(tmp_path):
    from decimal import Decimal
    from evals.budget import Budget
    ledger = tmp_path / 'ledger.jsonl'
    Budget(ledger, '1.00').reserve('call:1', '0.30')
    reader = Budget(ledger, '1.00')
    assert reader.total == Decimal('0.30')
    assert '"abandon"' not in ledger.read_text(encoding='utf-8')


def test_a_second_writer_is_refused_while_the_first_is_alive(tmp_path):
    import os
    import pytest
    from evals.budget import RunLocked, run_lock
    (tmp_path / 'run.lock').write_text(str(os.getppid()), encoding='utf-8')
    with pytest.raises(RunLocked):
        with run_lock(tmp_path):
            pass


def test_a_stale_lock_from_a_dead_process_is_replaced(tmp_path):
    from evals.budget import run_lock
    (tmp_path / 'run.lock').write_text('999999', encoding='utf-8')
    with run_lock(tmp_path):
        assert (tmp_path / 'run.lock').read_text(encoding='utf-8').strip().isdigit()
    assert not (tmp_path / 'run.lock').exists()
