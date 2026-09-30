"""Source screening and private configuration remain offline and deterministic."""

from decimal import Decimal

import pytest

from app.services import jev, secrets
from app.services.ai import sourcing
from evals import corpus, run
from evals.budget import Budget
from evals.config import digest, load, rows, write


def setup_sources(tmp_path, count=4):
    source = tmp_path / 'sources'
    source.mkdir()
    for index in range(count):
        (source / f'lesson{index}.md').write_text('Study concepts and worked examples. ' * 600,
                                                encoding='utf-8')
    config = {'sets': {'study': [str(source)]}, 'sources_per_set': 2,
              'passages_per_source': 1, 'screen_limit': 40, 'seed': 20260930,
              'budget_cap': '3.00'}
    return config, tmp_path / 'corpus'


def test_screen_selection_rejections_cache_and_ledger(tmp_path, monkeypatch):
    config, output = setup_sources(tmp_path)
    calls = []
    original_model = jev.MODEL

    def fake(title, text, key):
        assert key == 'fake'
        assert jev.MODEL == 'jev-1.13.0'
        assert len(text) == 12000
        sha = digest((tmp_path / 'sources' / f'{title}.md').read_bytes())
        ledger = rows(output / 'study' / 'screen_ledger.jsonl')
        assert ledger[-1]['event'] == 'reserve'
        assert ledger[-1]['id'] == 'screen:' + sha
        assert ledger[-1]['phase'] == 'screen'
        calls.append(title)
        return sourcing.SourceAssessment(is_teachable=.9 if title in {'lesson0', 'lesson1'} else .1,
                                         is_transcript=.2, checked=title != 'lesson1')
    # Distinct bytes ensure the SHA cache does not merge these fixture sources.
    for path in (tmp_path / 'sources').iterdir():
        path.write_text(path.read_text(encoding='utf-8') + path.stem, encoding='utf-8')
    monkeypatch.setattr(sourcing, 'assess_source', fake)
    corpus.freeze(config, output, api_key='fake')
    manifest_path = output / 'study' / 'manifest.json'
    manifest = load(manifest_path)
    assert len(calls) == 4
    assert len(manifest['screened']) == 4
    assert manifest['report']['sampled_sources'] == 1
    assert all('lesson0.md' in p['source_path'] for p in manifest['passages'])
    rejected = [s for s in manifest['screened'] if not (s['checked'] and s['worth_generating'])]
    assert len(rejected) == 3
    assert all('is_transcript' in s and 'is_teachable' in s for s in rejected)
    assert Budget(output / 'study' / 'screen_ledger.jsonl', 3).total > 0
    first_manifest = manifest_path.read_bytes()
    first_ledger = (output / 'study' / 'screen_ledger.jsonl').read_bytes()
    corpus.freeze(config, output, api_key='fake')
    assert len(calls) == 4
    assert manifest_path.read_bytes() == first_manifest
    assert (output / 'study' / 'screen_ledger.jsonl').read_bytes() == first_ledger
    assert jev.MODEL == original_model


def test_screen_limit_and_seed(tmp_path, monkeypatch):
    config, output = setup_sources(tmp_path, 7)
    config['screen_limit'] = 3
    for path in (tmp_path / 'sources').iterdir():
        path.write_text(path.read_text(encoding='utf-8') + path.stem, encoding='utf-8')
    calls = []

    def fake(title, text, key):
        calls.append(title)
        return sourcing.SourceAssessment(.9, 0)
    monkeypatch.setattr(sourcing, 'assess_source', fake)
    corpus.freeze(config, output, api_key='fake')
    expected = corpus.sample(corpus.groups(corpus.candidates(config['sets']['study'])), 3, config['seed'])
    assert calls == [p.stem for p in expected]
    assert len(load(output / 'study' / 'manifest.json')['screened']) == 3


def test_no_key_fails_and_no_screen_skips_secrets(tmp_path, monkeypatch):
    config, output = setup_sources(tmp_path)
    seen = []

    def missing(name):
        seen.append(name)
        return ''
    monkeypatch.setattr(secrets, 'get_secret', missing)
    with pytest.raises(ValueError, match='TypeSafe key.*--no-screen'):
        corpus.freeze(config, output)
    assert seen == ['typesafe']
    assert not output.exists()
    corpus.freeze(config, output, no_screen=True)
    assert seen == ['typesafe']
    manifest = load(output / 'study' / 'manifest.json')
    assert manifest['report']['sampled_sources'] == 2
    assert manifest['screened'] == []
    assert not (output / 'screen_cache.json').exists()
    assert not (output / 'study' / 'screen_ledger.jsonl').exists()


def test_screen_actual_usage(tmp_path, monkeypatch):
    config, output = setup_sources(tmp_path, 1)

    def fake(title, text, key):
        answers = jev.ask(state={'text': text}, questions={}, api_key=key)
        assert answers.input_tokens == 100
        return sourcing.SourceAssessment(.9, 0)
    monkeypatch.setattr(sourcing, 'assess_source', fake)
    monkeypatch.setattr(jev, 'ask', lambda **kwargs: jev.Answers({}, input_tokens=100))
    corpus.freeze(config, output, api_key='fake')
    assert Budget(output / 'study' / 'screen_ledger.jsonl', 3).total == Decimal('0.0000042')


def test_screen_budget_refuses_calls(tmp_path, monkeypatch):
    config, output = setup_sources(tmp_path)
    config['budget_cap'] = '0'

    def forbidden(*args, **kwargs):
        raise AssertionError('Must reserve before assessing')
    monkeypatch.setattr(sourcing, 'assess_source', forbidden)
    corpus.freeze(config, output, api_key='fake')
    manifest = load(output / 'study' / 'manifest.json')
    assert manifest['report']['sampled_sources'] == 0
    assert len(manifest['screened']) == 4
    assert all(not s['checked'] for s in manifest['screened'])
    assert all('Budget cap' in s['error'] for s in manifest['screened'])


def test_local_config_relative_paths_missing_and_snapshot(tmp_path):
    public = tmp_path / 'pilot.json'
    write(public, {'sets': ['study'], 'local_config': 'pilot.local.json', 'seed': 1})
    with pytest.raises(ValueError, match='Local source configuration missing'):
        load(public)
    write(tmp_path / 'pilot.local.json', {'sets': {'study': ['C:\\path\\to\\study']}})
    config = load(public)
    assert config['sets'] == {'study': ['C:\\path\\to\\study']}
    assert config['seed'] == 1
    snapshot = tmp_path / 'runs' / 'config.json'
    write(snapshot, config)
    assert load(snapshot) == config


def test_cli_no_screen(tmp_path, monkeypatch):
    config, output = setup_sources(tmp_path)
    path = tmp_path / 'pilot.json'
    write(path, config)
    seen = []
    monkeypatch.setattr(corpus, 'freeze', lambda c, no_screen: seen.append((c, no_screen)))
    monkeypatch.setattr('sys.argv', ['evals.run', 'freeze', '--config', str(path), '--no-screen'])
    run.main()
    assert seen == [(config, True)]


def test_excluded_file_names_are_not_candidates(tmp_path):
    from evals import corpus
    (tmp_path / 'notes.md').write_text('# Real notes\n\nContent.', encoding='utf-8')
    (tmp_path / 'IMPORT_INSTRUCTIONS.md').write_text('# How to import\n\nSteps.', encoding='utf-8')
    names = [path.name for path in corpus.candidates([tmp_path], ['*instructions*'])]
    assert names == ['notes.md']
