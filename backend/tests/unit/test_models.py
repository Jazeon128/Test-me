import pytest
from sqlalchemy.exc import IntegrityError
from app.models.tag import Tag
from app.models.question import Question


def test_create_tag(db_session):
    tag = Tag(name="test-tag", color="blue")
    db_session.add(tag)
    db_session.commit()

    assert tag.id is not None
    assert tag.name == "test-tag"
    assert tag.color == "blue"


def test_tag_unique_name(db_session):
    tag1 = Tag(name="unique-tag", color="blue")
    db_session.add(tag1)
    db_session.commit()

    tag2 = Tag(name="unique-tag", color="red")
    db_session.add(tag2)

    with pytest.raises(IntegrityError):
        db_session.commit()

    db_session.rollback()


def test_question_tag_relationship(db_session, sample_question):
    tag = Tag(name="python", color="green")
    db_session.add(tag)
    db_session.commit()

    sample_question.tags.append(tag)
    db_session.commit()

    assert len(sample_question.tags) == 1
    assert sample_question.tags[0].name == "python"
    assert len(tag.questions) == 1
    assert tag.questions[0].id == sample_question.id
