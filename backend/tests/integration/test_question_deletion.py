"""Exercise deletion through the public endpoints with all question children."""

import pytest
from sqlalchemy import select

from app.models.deck import DeckQuestion
from app.models.document import Document
from app.models.question import Question, QuestionOption
from app.models.tag import Tag, question_tags
from app.models.user_progress import UserProgress


@pytest.mark.parametrize("resource", ["questions", "documents"])
def test_delete_question_children(
    client, db_session, sample_question, sample_test, sample_user_progress, resource
):
    tag = Tag(name="Deletion test")
    sample_question.tags.append(tag)
    db_session.commit()
    resource_id = sample_question.id if resource == "questions" else sample_question.document_id

    response = client.delete(f"/api/{resource}/{resource_id}")

    assert response.status_code == 200
    db_session.expire_all()
    assert db_session.query(Question).count() == 0
    assert db_session.query(QuestionOption).count() == 0
    assert db_session.query(DeckQuestion).count() == 0
    assert db_session.query(UserProgress).count() == 0
    assert db_session.execute(select(question_tags)).all() == []
    # Tags are shared vocabulary. Only the question's tag association is deleted.
    assert db_session.query(Tag).count() == 1
    assert db_session.query(Document).count() == (0 if resource == "documents" else 1)
