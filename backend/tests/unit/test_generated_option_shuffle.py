"""Generated options keep their correctness when their display order changes."""
from copy import deepcopy
import random

import pytest

from app.api.documents import _save_generated_question
from app.models.question import QuestionOption
from app.services.ai.question_generator import QuestionGenerator


@pytest.fixture
def generated_mcq():
    return {
        "question": "What is Python?",
        "options": [
            {"option": "A", "text": "A programming language"},
            {"option": "B", "text": "A snake"},
            {"option": "C", "text": "A framework"},
            {"option": "D", "text": "A database"},
        ],
        "correct_answer": "A",
        "explanation": "Python is a programming language.",
    }


def saved_options(db, question):
    db.flush()
    return db.query(QuestionOption).filter_by(question_id=question.id).order_by(
        QuestionOption.order
    ).all()


def test_seeded_shuffle_preserves_correct_text(db_session, sample_document, generated_mcq):
    original = deepcopy(generated_mcq)
    question = _save_generated_question(
        db_session, generated_mcq, sample_document.id, None, rng=random.Random(1)
    )
    options = saved_options(db_session, question)
    assert [option.order for option in options] == [0, 1, 2, 3]
    assert [option.option_text for option in options] == [
        "A database", "A programming language", "A framework", "A snake"
    ]
    correct = [option for option in options if option.is_correct]
    assert len(correct) == 1
    assert correct[0].order == 1
    assert correct[0].option_text == original["options"][0]["text"]
    assert generated_mcq == original


def test_default_shuffle_reaches_all_orders(db_session, sample_document, generated_mcq):
    orders = set()
    for _ in range(200):
        question = _save_generated_question(
            db_session, generated_mcq, sample_document.id, None
        )
        options = saved_options(db_session, question)
        correct = [option for option in options if option.is_correct]
        assert len(correct) == 1
        assert correct[0].option_text == "A programming language"
        orders.add(correct[0].order)
    assert orders == {0, 1, 2, 3}


def test_flashcard_has_no_options(db_session, sample_document):
    question = _save_generated_question(
        db_session,
        {"card_type": "flashcard", "question": "Define Python.",
         "explanation": "A programming language."},
        sample_document.id, None,
    )
    assert question.card_type == "flashcard"
    assert saved_options(db_session, question) == []


def test_generation_prompt_explains_content_without_letters():
    generator = QuestionGenerator.__new__(QuestionGenerator)
    prompt = generator._build_batch_prompt("Python is a programming language.", 1, "easy")
    assert (
        "Explanations must explain the correct answer by its content and never refer "
        "to options by letter (A, B, C or D), because the options are shuffled after generation."
    ) in prompt
