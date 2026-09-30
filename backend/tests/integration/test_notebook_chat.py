from types import SimpleNamespace
from unittest.mock import Mock

import httpx
import pytest

from app.models.chat_message import ChatMessage
from app.models.document import Document, DocumentType
from app.models.llm_call import LLMCall
from app.models.notebook import Notebook
from app.models.passage import DocumentPassage
from app.models.settings import Settings
from app.services.ai import clients
from app.services.chat import retrieve as retrieval


@pytest.fixture
def chat(db_session, monkeypatch):
    notebook = Notebook(name="Certification")
    db_session.add(notebook)
    db_session.flush()
    source = Document(notebook_id=notebook.id, filename="book.pdf", original_filename="book.pdf",
                      title="Certification", file_type=DocumentType.PDF, file_size=1,
                      file_path="unused", status="ready")
    db_session.add(source)
    db_session.flush()
    # Rare-term IDF exceeds MIN_SCORE=1.0 against this candidate corpus.
    for ordinal, text in enumerate(["Quorum requires three nodes."] + ["unrelated content"] * 7):
        db_session.add(DocumentPassage(document_id=source.id, ordinal=ordinal, section_index=0,
                                       locator=f"page {ordinal + 1}", text=text,
                                       char_start=0, char_end=len(text)))
    db_session.add_all([Settings(key="chat_provider", value="openai"),
                        Settings(key="chat_model", value="gpt-4o")])
    db_session.commit()
    response = SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(
        content="Quorum requires three nodes [1]."))],
        usage=SimpleNamespace(prompt_tokens=100, completion_tokens=20), model="gpt-4o")
    create = Mock(return_value=response)
    sdk = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    monkeypatch.setattr(clients, "get_secret", lambda *args, **kwargs: "fake")
    monkeypatch.setattr(clients, "OpenAI", Mock(return_value=sdk))
    monkeypatch.setattr(retrieval, "typesafe_key", lambda db: "fake")
    monkeypatch.setattr(retrieval, "rerank", lambda query, candidates, key, text_of: candidates)
    return notebook, source, create


def post(client, chat, **changes):
    notebook, source, _ = chat
    return client.post(f"/api/notebooks/{notebook.id}/chat",
                       json={"message": "What does quorum require?", "source_ids": [source.id], **changes})


def test_happy_path_and_ledger(client, db_session, chat):
    response = post(client, chat)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["role"] == "assistant"
    assert not body["refused"] and not body["uncited"]
    assert body["invalid_citations"] == []
    assert body["model"] == "gpt-4o"
    assert body["citations"][0] == dict(n=1, passage_id=db_session.query(DocumentPassage).first().id,
                                         document_id=chat[1].id, display_name="Certification",
                                         locator="page 1", excerpt="Quorum requires three nodes.",
                                         removed=False)
    rows = db_session.query(ChatMessage).order_by(ChatMessage.id).all()
    assert [row.role for row in rows] == ["user", "assistant"]
    assert rows[0].source_ids == [chat[1].id]
    assert db_session.query(LLMCall).one().task == "chat"
    kwargs = chat[2].call_args.kwargs
    assert kwargs["max_tokens"] == 1500 and kwargs["temperature"] == 0.2


def test_refusal_no_model_call(client, db_session, chat):
    body = post(client, chat, message="Explain photosynthesis").json()
    assert body["refused"] is True
    assert body["content"] == "I could not find that in the selected sources."
    assert body["citations"] == [] and body["model"] is None
    chat[2].assert_not_called()
    assert db_session.query(LLMCall).count() == 0
    assert db_session.query(ChatMessage).count() == 2


@pytest.mark.parametrize("changes", [{"message": ""}, {"message": " "}, {"message": "x" * 2001},
                                     {"source_ids": []}])
def test_validation_422(client, db_session, chat, changes):
    assert post(client, chat, **changes).status_code == 422
    assert db_session.query(ChatMessage).count() == 0


@pytest.mark.parametrize("method", ["get", "post", "delete"])
def test_unknown_notebook(client, method):
    kwargs = {"json": {"message": "hello", "source_ids": [1]}} if method == "post" else {}
    response = getattr(client, method)("/api/notebooks/999999/chat", **kwargs)
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


def test_foreign_and_missing_source_400(client, db_session, chat):
    other = Notebook(name="Other")
    db_session.add(other)
    db_session.commit()
    assert post(client, chat, source_ids=[999999]).status_code == 400
    chat[1].notebook_id = other.id
    db_session.commit()
    assert post(client, chat).status_code == 400
    assert db_session.query(ChatMessage).count() == 0


def test_processing_409(client, db_session, chat):
    chat[1].status = "processing"
    db_session.commit()
    response = post(client, chat)
    assert response.status_code == 409
    assert response.json() == {"detail": "Selected sources are still processing",
                               "processing": [chat[1].id]}
    assert db_session.query(ChatMessage).count() == 0


def test_provider_failure_only_user_saved(client, db_session, chat):
    # Nonretryable error ensures the offline test never sleeps.
    class AuthError(Exception):
        status_code = 401

    chat[2].side_effect = AuthError("429 quota exhausted")
    response = post(client, chat)
    assert response.status_code == 502
    assert "quota is used up" in response.json()["error"]["message"]
    assert [row.role for row in db_session.query(ChatMessage).all()] == ["user"]
    assert db_session.query(LLMCall).one().task == "chat"


def test_history_paging_and_clearing(client, db_session, chat):
    for _ in range(3):
        assert post(client, chat).status_code == 200
    url = f"/api/notebooks/{chat[0].id}/chat"
    recent = client.get(url, params={"limit": 2}).json()
    assert [row["role"] for row in recent] == ["user", "assistant"]
    earlier = client.get(url, params={"limit": 2, "before": recent[0]["id"]}).json()
    assert len(earlier) == 2
    assert earlier[-1]["id"] < recent[0]["id"]
    assert len(client.get(url).json()) == 6
    assert client.delete(url).status_code == 200
    assert client.get(url).json() == []
    assert db_session.query(ChatMessage).count() == 0


def test_source_removal_and_notebook_cascade(client, db_session, chat):
    assert post(client, chat).status_code == 200
    assistant = db_session.query(ChatMessage).filter_by(role="assistant").one()
    original = [dict(c) for c in assistant.citations]
    source_id = chat[1].id
    assert client.delete(f"/api/documents/{source_id}").status_code == 200
    history = client.get(f"/api/notebooks/{chat[0].id}/chat").json()
    citation = history[-1]["citations"][0]
    assert citation["removed"] and citation["display_name"] == "Removed source"
    assert "excerpt" not in citation
    db_session.refresh(assistant)
    assert assistant.citations == original
    assert history[-1]["content"] == assistant.content
    assert client.delete(f"/api/notebooks/{chat[0].id}").status_code == 200
    assert db_session.query(ChatMessage).count() == 0


def test_invalid_citations_and_uncited_response(client, db_session, chat):
    response = chat[2].return_value
    response.choices[0].message.content = "Quorum [1, 99] and [0]."
    result = post(client, chat).json()
    assert result["content"] == "Quorum [1] and ."
    assert result["invalid_citations"] == [99, 0]
    assert not result["uncited"]
    response.choices[0].message.content = "Unsupported claim."
    result = post(client, chat).json()
    assert result["uncited"] and result["citations"] == []


def test_openrouter_error_uses_provider_label(client, db_session, chat, monkeypatch):
    db_session.query(Settings).filter_by(key="chat_provider").one().value = "openrouter"
    db_session.commit()

    class CreditsError(Exception):
        status_code = 402

    chat[2].side_effect = CreditsError("402 no credits")
    result = post(client, chat)
    assert result.status_code == 502
    assert result.json()["error"]["message"] == (
        "OpenRouter has insufficient credits (402). Add credits in OpenRouter.")


def test_chat_client_task_and_legacy_resolution(db_session, monkeypatch):
    monkeypatch.setattr(clients, "get_secret", lambda *a, **k: "fake")
    constructor = Mock(return_value=object())
    monkeypatch.setattr(clients, "OpenAI", constructor)
    db_session.add_all([Settings(key="ai_provider", value="openrouter"),
                        Settings(key="ai_model", value="legacy"),
                        Settings(key="chat_model", value="chat-specific")])
    db_session.commit()
    provider, model, sdk = clients.client_for("chat", db_session)
    assert (provider, model) == ("openrouter", "chat-specific")
    assert sdk is constructor.return_value
    assert constructor.call_args.kwargs == {
        "api_key": "fake", "base_url": "https://openrouter.ai/api/v1", "max_retries": 0,
        "timeout": httpx.Timeout(180.0, connect=10.0), "default_headers": {
            "HTTP-Referer": "https://github.com/Jazeon128/Test-me", "X-OpenRouter-Title": "Test Me"},
    }
    assert clients.client_for("generation", db_session)[:2] == ("openrouter", "legacy")
