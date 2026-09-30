import asyncio
from unittest.mock import Mock

from app.api import canvas
from app.models.generation_status import GenerationStatus
from app.services.viz import router, templates


def test_unknown_template_opens_picker(db_session, sample_document, monkeypatch):
    answers = router.jev.Answers(raw={"template": {"choice": "unknown-template", "confidence": 0.99}})
    ask = Mock(return_value=answers)
    monkeypatch.setattr(router.jev, "ask", ask)
    log = Mock()
    monkeypatch.setattr(router, "logger", log)
    request = canvas.GenerateCanvasRequest(document_id=sample_document.id, request_text="Draw this")
    status = GenerationStatus(job_id="unknown-template", status="pending")
    db_session.add(status)
    db_session.commit()
    result = canvas._decide_template(
        db_session, request, sample_document, [{"id": "s0", "text": "Source"}], status,
        lambda *args: None,
    )
    assert result is None
    assert status.status == "needs_choice"
    ask.assert_called_once()
    log.info.assert_called_once_with("routing_unknown_template", choice="unknown-template")
    choices = asyncio.run(canvas.routing_candidates(status.job_id, db_session))
    assert len(choices["candidates"]) == 3
    assert all(item["id"] in templates.TEMPLATES for item in choices["candidates"])
