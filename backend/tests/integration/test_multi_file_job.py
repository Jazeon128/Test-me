from types import SimpleNamespace

import pytest
from app.api import documents as api
from app.models.document import Document, DocumentType
from app.models.generation_status import GenerationStatus
from app.services.parsers.base_parser import ParsedDocument, ParsedSection


@pytest.mark.parametrize("failures", [[], [0], [1], [0, 1]])
def test_multi_file_counts(db_session, sample_test, monkeypatch, failures):
    monkeypatch.setattr("app.db.SessionLocal", lambda: db_session)
    monkeypatch.setattr(db_session, "close", lambda: None)
    docs = []
    for index in range(2):
        doc = Document(filename=f"file{index}.md", original_filename=f"file{index}.md", file_type=DocumentType.MARKDOWN, file_path=f"file{index}.md", file_size=1)
        db_session.add(doc)
        docs.append(doc)
    job = GenerationStatus(job_id="multi", deck_id=sample_test.id, total_documents=2)
    db_session.add(job)
    db_session.commit()
    parsed = ParsedDocument("Source", [ParsedSection("Source")])
    monkeypatch.setattr(api.MarkdownParser, "parse", lambda self, path: parsed)
    question = {"question": "New?", "options": [{"option": c, "text": c} for c in "ABCD"], "correct_answer": "A", "explanation": "Yes"}
    class Generator:
        flagged_questions = [dict(question, flags=["unsupported"])]
        failed_batches = [{"message": "503 UNAVAILABLE"}]
        def generate_questions(self, *args, **kwargs):
            if current in failures:
                raise ValueError("503 UNAVAILABLE")
            return [question] * (current + 1)
    monkeypatch.setattr(api, "QuestionGenerator", lambda **kwargs: Generator())
    for current, doc in enumerate(docs):
        api.process_document(doc.id, doc.file_path, doc.file_type, 3, "mixed", sample_test.id, job_id=job.job_id)
        db_session.refresh(job)
        if current == 0:
            assert job.status == "processing"
            assert job.current_step == "Finished document 1 of 2"
    assert job.status == ("failed" if len(failures) == 2 else "completed")
    assert job.documents_completed == 2 - len(failures)
    assert job.documents_failed == len(failures)
    assert job.total_questions_generated == sum(i + 1 for i in range(2) if i not in failures)
    assert job.total_questions_flagged == 2 - len(failures)
    for index in failures:
        assert f"file{index}.md" in job.error_message
    if not failures:
        assert any(log["level"] == "warning" and "Generated 1 of 3 question(s). Gemini failed on 1 section(s): 503 UNAVAILABLE" == log["message"] for log in job.logs)
    assert job.to_dict()["documents_completed"] == job.documents_completed
