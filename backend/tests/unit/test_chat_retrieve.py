from types import SimpleNamespace

import pytest

from app.models.document import Document, DocumentType
from app.models.notebook import Notebook
from app.models.passage import DocumentPassage
from app.services.chat import retrieve as retrieval
from app.services.jev import JevUnavailable


def passage(text):
    return SimpleNamespace(text=text)


def test_tokens_and_stop_words():
    assert retrieval.tokens("The TCP_2 limits, a X and 99!") == ["tcp_2", "limits", "99"]
    assert retrieval.tokens("CAF\u00c9 \u00fcber") == ["caf\u00e9", "\u00fcber"]


def test_rare_term_ranks_first():
    passages = [passage("common common"), passage("common rare"), passage("common")]
    scores = retrieval.bm25(passages, retrieval.query_terms("common rare"))
    assert scores[1] > max(scores[0], scores[2])


def test_followup_half_weight():
    terms = retrieval.query_terms("and what about its limits?", "TCP TCP")
    assert terms == {"limits": 1.0, "tcp": 0.5, "about": 1.0}
    score = retrieval.bm25([passage("tcp")], {"tcp": 1})[0]
    assert retrieval.bm25([passage("tcp")], {"tcp": terms["tcp"]})[0] == score / 2


def test_window_centres_dense_terms():
    text = "x " * 350 + "rare alpha rare" + " z" * 350
    window = retrieval.term_window(text, {"rare", "alpha"})
    assert len(window) == 400
    assert window.index("rare alpha rare") == pytest.approx(193, abs=2)
    assert retrieval.term_window(text, {"missing"}) == text[:400]


@pytest.fixture
def sources(db_session):
    notebooks = [Notebook(name="one"), Notebook(name="two")]
    db_session.add_all(notebooks)
    db_session.flush()
    documents = []
    for index, (notebook, status) in enumerate([(notebooks[0], "ready"),
                                             (notebooks[0], "processing"),
                                             (notebooks[1], "ready"),
                                             (notebooks[0], "ready")]):
        document = Document(notebook_id=notebook.id, filename=str(index), original_filename=str(index),
                            file_type=DocumentType.PDF, file_size=1, file_path="unused", status=status)
        db_session.add(document)
        db_session.flush()
        documents.append(document)
        for ordinal in range(8):
            db_session.add(DocumentPassage(document_id=document.id, ordinal=ordinal, section_index=0,
                                           locator="p1", text="rare alpha " * 10,
                                           char_start=0, char_end=110))
    db_session.commit()
    return notebooks, documents


def test_only_selected_ready_notebook_candidates_top_six(db_session, sources, monkeypatch):
    notebooks, documents = sources
    seen = []
    monkeypatch.setattr(retrieval, "MIN_SCORE", 0.01)
    monkeypatch.setattr(retrieval, "typesafe_key", lambda db: "fake")

    def rank(query, candidates, key, text_of):
        seen.extend(candidates)
        assert all("rare" in text_of(p) for p in candidates)
        return candidates

    monkeypatch.setattr(retrieval, "rerank", rank)
    result = retrieval.retrieve(db_session, notebooks[0].id, [d.id for d in documents[:3]], "rare")
    assert len(result) == 6
    assert len(seen) == 8
    assert {p.document_id for p in seen} == {documents[0].id}


@pytest.mark.parametrize("message,threshold", [("absent", 0), ("rare", 100)])
def test_refusal_before_rerank(db_session, sources, monkeypatch, message, threshold):
    notebooks, documents = sources
    monkeypatch.setattr(retrieval, "MIN_SCORE", threshold)
    monkeypatch.setattr(retrieval, "rerank", lambda *a, **k: pytest.fail("rerank on refusal"))
    assert retrieval.retrieve(db_session, notebooks[0].id, [documents[0].id], message) == []


def test_jev_unavailable_preserves_bm25(db_session, sources, monkeypatch):
    notebooks, documents = sources
    monkeypatch.setattr(retrieval, "MIN_SCORE", 0.01)
    monkeypatch.setattr(retrieval, "typesafe_key", lambda db: "fake")

    def unavailable(*args, **kwargs):
        raise JevUnavailable("offline")

    monkeypatch.setattr(retrieval, "rerank", unavailable)
    candidates = db_session.query(DocumentPassage).filter_by(document_id=documents[0].id).all()
    assert retrieval.retrieve(db_session, notebooks[0].id, [documents[0].id], "rare") == candidates[:6]


def test_rerank_caps_candidates_at_25(db_session, sources, monkeypatch):
    notebooks, documents = sources
    for ordinal in range(8, 35):
        db_session.add(DocumentPassage(document_id=documents[0].id, ordinal=ordinal, section_index=0,
                                       locator="p1", text="rare alpha " * 10,
                                       char_start=0, char_end=110))
    db_session.commit()
    monkeypatch.setattr(retrieval, "MIN_SCORE", 0.01)
    monkeypatch.setattr(retrieval, "typesafe_key", lambda db: "fake")

    def rank(query, candidates, key, text_of):
        assert len(candidates) == 25
        return list(reversed(candidates))

    monkeypatch.setattr(retrieval, "rerank", rank)
    result = retrieval.retrieve(db_session, notebooks[0].id, [documents[0].id], "rare")
    assert len(result) == 6
    assert [p.ordinal for p in result] == [24, 23, 22, 21, 20, 19]


def test_previous_user_terms_allow_followup(db_session, sources, monkeypatch):
    notebooks, documents = sources
    monkeypatch.setattr(retrieval, "MIN_SCORE", 0.01)
    monkeypatch.setattr(retrieval, "typesafe_key", lambda db: "fake")
    monkeypatch.setattr(retrieval, "rerank", lambda q, candidates, key, text_of: candidates)
    assert retrieval.retrieve(db_session, notebooks[0].id, [documents[0].id], "limits") == []
    assert len(retrieval.retrieve(db_session, notebooks[0].id, [documents[0].id],
                                 "limits", "rare")) == 6
    documents[0].status = "failed"
    db_session.commit()
    assert retrieval.retrieve(db_session, notebooks[0].id, [documents[0].id], "rare") == []
