import csv

import pytest

from app.services.ai import sourcing
from evals import corpus, calibrate_preflight as calibration
from evals.budget import Budget


def record(not_study, teachable, study):
    score = sourcing.SourceAssessment(teachable, 0, has_study_content=study)
    return {"not_study": not_study, "score": {
        "checked": score.checked, "is_teachable": teachable,
        "has_study_content": study, "reason": score.reason}}


def test_matrix_wilson_sweep(monkeypatch):
    # The fixture is built around a 0.5 floor; it tests the arithmetic, not the
    # app's current (calibratable) floor.
    monkeypatch.setattr(sourcing, "STUDY_CONTENT_FLOOR", .5)
    records = [record(True, .9, .2), record(True, .1, .6),
               record(False, .9, .7), record(False, .9, .4)]
    report = calibration.report(records)
    assert report["old_rule"]["confusion_matrix"] == dict(tp=1, fp=0, tn=2, fn=1)
    new = report["new_rule"]
    assert new["confusion_matrix"] == dict(tp=2, fp=1, tn=1, fn=0)
    assert new["precision"] == pytest.approx(2 / 3)
    assert new["recall"] == 1
    assert new["study_source_rejections"] == 1
    assert calibration.wilson(2, 3) == pytest.approx([.2076596008, .9385080553])
    assert calibration.wilson(0, 0) is None
    assert calibration.wilson(0, 3)[0] == 0
    assert len(report["floor_sweep"]) == 11
    assert report["recommended_floor"] == .3
    assert report["floor_sweep"][-1]["study_source_rejections"] == 2


@pytest.mark.parametrize("field", ["version", "model", "title", "context", "parser", "chars"])
def test_cache_identity(monkeypatch, field):
    initial = corpus.assessment_key("sha", "Parser", "Title", "Notebook")
    args = ["sha", "Parser", "Title", "Notebook"]
    if field == "version":
        monkeypatch.setattr(corpus, "ASSESSMENT_VERSION", 999)
    elif field == "model":
        monkeypatch.setattr(sourcing, "PREFLIGHT_MODEL", "different")
    elif field == "chars":
        monkeypatch.setattr(corpus, "SCREEN_CHARS", 1)
    else:
        args[{"parser": 1, "title": 2, "context": 3}[field]] = "different"
    assert corpus.assessment_key(*args) != initial


def test_minimum_labels(tmp_path):
    path = tmp_path / "labels.csv"
    path.write_text("set,file,label_study_or_not,path\na,b,study,c\n", encoding="utf-8")
    with pytest.raises(ValueError, match="at least 20"):
        calibration.labelled_rows(path)


def test_fake_assessor_and_cache(tmp_path):
    source = tmp_path / "lesson.md"
    source.write_text("# Concepts\n\nA lesson with worked examples.", encoding="utf-8")
    labels = tmp_path / "labels.csv"
    with labels.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=["set", "file", "path", "label_study_or_not"])
        writer.writeheader()
        for index in range(20):
            writer.writerow(dict(set="Subject", file=source.name, path=str(source),
                                 label_study_or_not="study" if index < 10 else "not"))
    rows = calibration.labelled_rows(labels)
    calls = []

    def fake(path, key, budget, sha, notebook_name, preparation):
        calls.append(path)
        assert notebook_name == "Subject"
        return record(False, .9, .8)["score"]

    cache = tmp_path / "cache.json"
    budget = Budget(tmp_path / "ledger.jsonl", ".25")
    scores = calibration.score_rows(rows, "fake", budget, cache, assessor=fake)
    assert len(calls) == 1
    assert calibration.report(scores)["new_rule"]["confusion_matrix"] == dict(tp=0, fp=0, tn=10, fn=10)
    assert calibration.score_rows(rows, "fake", budget, cache, assessor=fake) == scores
    assert len(calls) == 1



def test_calibration_never_records_app_usage(tmp_path, monkeypatch):
    from unittest.mock import Mock
    from app.services import jev
    source = tmp_path / "lesson.md"
    source.write_text("# Subject\n\n" + "A worked example explains a concept. " * 10,
                      encoding="utf-8")
    response = Mock()
    response.json.return_value = {"answers": {
        name: {"noul": .9} for name in ["is_teachable", "is_transcript", "has_study_content"]
    }, "usage": {"input_tokens": 100}}
    monkeypatch.setattr(jev.requests, "post", Mock(return_value=response))
    def forbidden(*args, **kwargs):
        pytest.fail("Calibration must not write app usage")
    monkeypatch.setattr(jev, "record", forbidden)
    budget = Budget(tmp_path / "ledger.jsonl", ".25")
    rows = [dict(path=str(source), file=source.name, set="Subject", not_study=False)]
    scores = calibration.score_rows(rows, "fake", budget, tmp_path / "cache.json")
    assert scores[0]["score"]["reason"] == "ok"
    assert float(budget.total) == pytest.approx(.0000042)
