from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from typing import Optional

from ..db import get_db
from ..services import activity
from ..models.user_progress import UserProgress
from ..models.question import Question
from ..models.notebook import Notebook
from ..models.document import Document
from ..models.deck import Deck, DeckQuestion
from ..services.spaced_repetition import SM2Algorithm, ReviewResult
from ..utils.cache import stats_cache, invalidate_stats_cache
from fastapi.concurrency import run_in_threadpool

from .questions import (
    expected_answer,
    explanation_to_response,
    grade_to_response,
    hint_candidates,
    hint_for,
    key_points,
    require_typesafe_key,
    source_passage,
)

router = APIRouter()


class SubmitAnswerRequest(BaseModel):
    question_id: int
    selected_option: str = ""  # Empty for a timeout or a written answer.
    written_answer: Optional[str] = Field(default=None, max_length=10000)
    time_taken_seconds: float = Field(ge=0)
    manual_quality: Optional[int] = Field(default=None, ge=0, le=5)
    # Written and explain modes only.
    # explain: judge written_answer as an explanation of the idea, not an answer.
    explain: bool = False
    # retry_allowed: a failed first attempt returns feedback and records nothing.
    retry_allowed: bool = False
    # after_feedback: this is the retry, so a pass is capped at quality 3.
    after_feedback: bool = False


class ReviewSessionRequest(BaseModel):
    num_questions: int = 10
    include_new: bool = True
    include_review: bool = True
    deck_id: Optional[int] = None


def validate_flashcard_rating(request):
    if request.manual_quality is None:
        raise HTTPException(status_code=422, detail="Rate this card.")
    if any((request.selected_option, request.written_answer, request.explain,
            request.retry_allowed, request.after_feedback)):
        raise HTTPException(status_code=422, detail="Only a rating is allowed for flashcards.")


@router.post("/submit")
async def submit_answer(request: SubmitAnswerRequest, db: Session = Depends(get_db)):
    """
    Submit an answer and update progress with spaced repetition

    Returns:
        - Whether answer was correct
        - Correct answer
        - Explanation
        - Updated spaced repetition data
        - Gamification stats
    """
    # Get question with options eagerly loaded to avoid N+1
    question = (
        db.query(Question)
        .options(joinedload(Question.options))
        .filter(Question.id == request.question_id)
        .first()
    )

    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    flashcard = question.card_type == "flashcard"
    if flashcard:
        validate_flashcard_rating(request)

    # Check if answer is correct
    correct_option = None
    is_correct = request.manual_quality >= 3 if flashcard else False

    for opt in ([] if flashcard else question.options):
        if opt.is_correct:
            correct_option = chr(65 + opt.order)
            if correct_option == request.selected_option.upper():
                is_correct = True
            break

    # Grade before writing progress. Unavailable grading must not count as failure.
    written_grade = None
    if not flashcard and request.written_answer is not None:
        if not request.written_answer.strip():
            raise HTTPException(status_code=422, detail="Write an answer before submitting.")
        # Only the network call leaves the event loop. The read, update and
        # commit below stay on it, so concurrent submissions for one question
        # cannot interleave between reading progress and writing it back.
        api_key = require_typesafe_key(db)
        expected = expected_answer(question)
        if request.explain:
            written_grade = await run_in_threadpool(
                explanation_to_response,
                question.question_text,
                key_points(question),
                request.written_answer,
                api_key,
                source_passage(question),
            )
        else:
            written_grade = await run_in_threadpool(
                grade_to_response,
                question.question_text,
                expected,
                request.written_answer,
                api_key,
            )

        # First attempt failed and a retry is allowed: give feedback that makes
        # the learner do the work, reveal nothing, and record nothing yet.
        if request.retry_allowed and not written_grade["passed"]:
            if request.explain:
                return {
                    "retry": True,
                    "feedback": {
                        "sentences": written_grade["sentences"],
                        "points_covered": written_grade["points_covered"],
                        "points_total": written_grade["points_total"],
                    },
                }
            hint = await run_in_threadpool(
                hint_for,
                question.question_text,
                expected,
                hint_candidates(question),
                written_grade,
                api_key,
            )
            return {"retry": True, "feedback": {"hint": hint}}

        if request.after_feedback and written_grade["passed"]:
            # Recalled only with help: SM-2's "correct, with serious difficulty".
            written_grade["quality"] = min(written_grade["quality"], 3)
        written_grade["expected_answer"] = expected
        is_correct = written_grade["passed"]

    # Get or create user progress
    progress = (
        db.query(UserProgress).filter(UserProgress.question_id == request.question_id).first()
    )

    if not progress:
        progress = UserProgress(
            question_id=request.question_id,
            easiness_factor=2.5,
            interval=0,
            repetitions=0,
            times_seen=0,
            times_correct=0,
            times_incorrect=0,
            average_time_seconds=0.0,
            streak=0,
            best_streak=0,
            is_mastered=False,
        )
        db.add(progress)

    # Update basic stats
    progress.times_seen += 1
    if is_correct:
        progress.times_correct += 1
        progress.streak += 1
        if progress.streak > progress.best_streak:
            progress.best_streak = progress.streak
    else:
        progress.times_incorrect += 1
        progress.streak = 0

    # Update average time
    total_time = (
        progress.average_time_seconds * (progress.times_seen - 1) + request.time_taken_seconds
    )
    progress.average_time_seconds = total_time / progress.times_seen

    # Determine quality rating for SM-2
    if written_grade is not None:
        quality = ReviewResult(written_grade["quality"])
    elif request.manual_quality is not None:
        # Use manual quality if provided (0-5)
        try:
            quality = ReviewResult(request.manual_quality)
        except ValueError:
            # Fallback or error? Let's clamp or default
            quality = ReviewResult.CORRECT_MEDIUM
    else:
        # Auto-calculate based on time/correctness
        quality = SM2Algorithm.determine_quality_from_attempt(
            correct=is_correct,
            time_taken_seconds=request.time_taken_seconds,
            time_limit_seconds=30.0,
        )

    # Calculate next review using SM-2 algorithm
    new_ef, new_interval, new_repetitions, next_review = SM2Algorithm.calculate_next_review(
        easiness_factor=float(progress.easiness_factor),
        interval=int(progress.interval),
        repetitions=int(progress.repetitions),
        quality=quality,
        time_taken_seconds=request.time_taken_seconds,
        apply_time_penalty=not flashcard and request.written_answer is None and not request.explain,
    )

    # Update spaced repetition data
    progress.easiness_factor = new_ef
    progress.interval = new_interval
    progress.repetitions = new_repetitions
    progress.next_review_date = next_review

    # Update last attempt
    progress.last_attempt_date = datetime.now(timezone.utc).replace(tzinfo=None)
    progress.last_attempt_correct = is_correct
    progress.last_attempt_time_seconds = request.time_taken_seconds

    # Update attempt history
    if progress.attempt_history is None:
        progress.attempt_history = []

    progress.attempt_history.append(
        {
            "date": datetime.now(timezone.utc).replace(tzinfo=None).isoformat(),
            "correct": is_correct,
            "time_seconds": request.time_taken_seconds,
            "quality": quality.value,
        }
    )

    # Check if mastered
    is_mastered, mastery_percentage = SM2Algorithm.calculate_mastery_level(
        repetitions=int(progress.repetitions),
        easiness_factor=float(progress.easiness_factor),
        times_correct=int(progress.times_correct),
        times_incorrect=int(progress.times_incorrect),
    )
    progress.is_mastered = is_mastered

    db.commit()
    db.refresh(progress)

    # Invalidate stats cache when progress is updated
    invalidate_stats_cache()

    # Record the day, then see whether anything was earned by it.
    points_earned = activity.record_answer(db, is_correct, progress.streak)
    new_awards = activity.check_awards(db)

    return {
        "retry": False,
        "written_grade": written_grade,
        "correct": is_correct,
        "correct_answer": correct_option,
        "explanation": question.explanation,
        "source_reference": question.source_reference,
        "progress": {
            "times_seen": progress.times_seen,
            "times_correct": progress.times_correct,
            "times_incorrect": progress.times_incorrect,
            "success_rate": progress.times_correct / progress.times_seen,
            "average_time_seconds": progress.average_time_seconds,
            "streak": progress.streak,
            "best_streak": progress.best_streak,
            "is_mastered": progress.is_mastered,
            "mastery_percentage": mastery_percentage,
            "next_review_date": progress.next_review_date,
            "interval_days": progress.interval,
        },
        "gamification": {
            # These are now recorded rather than calculated and discarded.
            "points_earned": points_earned.base,
            "streak_bonus": points_earned.bonus,
            "points_total": points_earned.total,
            "daily_streak": activity.current_streak(db),
            "mastery_achieved": is_mastered and not progress.is_mastered,
            "awards": [
                {"code": a.code, "title": a.title, "description": a.description} for a in new_awards
            ],
        },
    }


@router.get("/question/{question_id}")
async def get_question_progress(question_id: int, db: Session = Depends(get_db)):
    """Get progress for a specific question"""
    progress = db.query(UserProgress).filter(UserProgress.question_id == question_id).first()

    if not progress:
        return {
            "question_id": question_id,
            "never_seen": True,
        }

    is_mastered, mastery_percentage = SM2Algorithm.calculate_mastery_level(
        repetitions=int(progress.repetitions),
        easiness_factor=float(progress.easiness_factor),
        times_correct=int(progress.times_correct),
        times_incorrect=int(progress.times_incorrect),
    )

    return {
        "question_id": question_id,
        "times_seen": progress.times_seen,
        "times_correct": progress.times_correct,
        "times_incorrect": progress.times_incorrect,
        "success_rate": progress.times_correct / progress.times_seen
        if progress.times_seen > 0
        else 0,
        "average_time_seconds": progress.average_time_seconds,
        "streak": progress.streak,
        "best_streak": progress.best_streak,
        "is_mastered": is_mastered,
        "mastery_percentage": mastery_percentage,
        "next_review_date": progress.next_review_date,
        "is_due": SM2Algorithm.get_due_questions_count(progress.next_review_date),
    }


@router.post("/review-session")
async def get_review_session(request: ReviewSessionRequest, db: Session = Depends(get_db)):
    """
    Get questions for a review session based on spaced repetition
    """

    questions_to_review = []

    if request.include_review:
        # Get questions due for review
        query = db.query(UserProgress).join(Question)

        if request.deck_id:
            from ..models.deck import DeckQuestion, Deck

            query = (
                query.join(Question.deck_questions)
                .join(DeckQuestion.deck)
                .filter(Deck.id == request.deck_id)
            )

        due_progress = (
            query.filter(UserProgress.next_review_date <= datetime.now(timezone.utc).replace(tzinfo=None))
            .order_by(UserProgress.next_review_date.asc())
            .limit(request.num_questions)
            .all()
        )

        questions_to_review.extend([p.question_id for p in due_progress])

    if request.include_new and len(questions_to_review) < request.num_questions:
        # Get questions never seen before
        seen_question_ids = db.query(UserProgress.question_id).all()
        seen_ids = [qid[0] for qid in seen_question_ids]

        query = db.query(Question).filter(~Question.id.in_(seen_ids))

        if request.deck_id:
            from ..models.deck import DeckQuestion, Deck

            query = (
                query.join(Question.deck_questions)
                .join(DeckQuestion.deck)
                .filter(Deck.id == request.deck_id)
            )

        new_questions = query.limit(request.num_questions - len(questions_to_review)).all()

        questions_to_review.extend([q.id for q in new_questions])

    # Get full question details with options eagerly loaded to avoid N+1
    questions = (
        db.query(Question)
        .options(joinedload(Question.options))
        .filter(Question.id.in_(questions_to_review))
        .all()
    )

    questions_by_id = {question.id: question for question in questions}
    questions = [questions_by_id[question_id] for question_id in questions_to_review]

    response_data = {
        "num_questions": len(questions),
        "questions": [
            {
                "id": q.id,
                "question_text": q.question_text,
                "card_type": q.card_type,
                "source_reference": q.source_reference,
                "options": [
                    {
                        "option": chr(65 + opt.order),
                        "text": opt.option_text,
                    }
                    for opt in sorted(q.options, key=lambda x: x.order)
                ],
                "difficulty": q.difficulty,
                "explanation": q.explanation,
                "correct_option": next(
                    (chr(65 + opt.order) for opt in q.options if opt.is_correct), None
                ),
            }
            for q in questions
        ],
    }

    return response_data


@router.get("/stats")
async def get_overall_stats(db: Session = Depends(get_db)):
    """Get overall learning statistics (cached for 5 minutes)"""
    # Check cache first
    cache_key = "overall_stats"
    cached_result = stats_cache.get(cache_key)
    if cached_result is not None:
        return cached_result

    # Query database if not cached
    all_progress = db.query(UserProgress).all()

    if not all_progress:
        result = {
            "total_questions_seen": 0,
            "total_attempts": 0,
            "overall_success_rate": 0,
            "questions_mastered": 0,
            "current_streak": 0,
            "best_streak": 0,
            "questions_due": 0,
        }
        stats_cache.set(cache_key, result)
        return result

    total_correct = sum(p.times_correct for p in all_progress)
    total_attempts = sum(p.times_seen for p in all_progress)
    mastered_count = sum(1 for p in all_progress if p.is_mastered)
    questions_due = sum(
        1 for p in all_progress if SM2Algorithm.get_due_questions_count(p.next_review_date)
    )

    # Count runs across questions in the order the attempts happened.
    attempts = sorted(
        (attempt for p in all_progress for attempt in (p.attempt_history or [])),
        key=lambda attempt: datetime.fromisoformat(attempt["date"]),
    )
    current_streak = best_streak = 0
    for attempt in attempts:
        current_streak = current_streak + 1 if attempt["correct"] else 0
        best_streak = max(best_streak, current_streak)

    result = {
        "total_questions_seen": len(all_progress),
        "total_attempts": total_attempts,
        "overall_success_rate": total_correct / total_attempts if total_attempts > 0 else 0,
        "questions_mastered": mastered_count,
        "mastery_rate": mastered_count / len(all_progress) if all_progress else 0,
        "current_streak": current_streak,
        "best_streak": best_streak,
        "questions_due": questions_due,
        "average_easiness_factor": sum(p.easiness_factor for p in all_progress) / len(all_progress),
    }

    # Cache the result
    stats_cache.set(cache_key, result)
    return result


@router.get("/stats/by-notebook")
async def get_stats_by_notebook(db: Session = Depends(get_db)):
    """Per-notebook progress, one row per notebook.

    A question belongs to a notebook by either of two routes: the document it
    was generated from, or a deck it sits in. Both are followed and the ids are
    merged, so a question in several decks of one notebook is still counted
    once. Questions attached to neither are left out of every notebook rather
    than landing in an arbitrary one.

    Cached for 5 minutes alongside the overall stats, and cleared by the same
    invalidation on answer submission.
    """
    cache_key = "stats_by_notebook"
    cached_result = stats_cache.get(cache_key)
    if cached_result is not None:
        return cached_result

    notebooks = db.query(Notebook).order_by(Notebook.name).all()

    # question_id -> UserProgress, so each notebook's ids resolve without
    # re-querying per notebook.
    progress_by_question = {p.question_id: p for p in db.query(UserProgress).all()}

    # Route 1: question -> document -> notebook
    via_document = (
        db.query(Question.id, Document.notebook_id)
        .join(Document, Question.document_id == Document.id)
        .filter(Document.notebook_id.isnot(None))
        .all()
    )

    # Route 2: question -> deck_question -> deck -> notebook
    via_deck = (
        db.query(DeckQuestion.question_id, Deck.notebook_id)
        .join(Deck, DeckQuestion.deck_id == Deck.id)
        .filter(Deck.notebook_id.isnot(None))
        .all()
    )

    questions_by_notebook: dict[int, set[int]] = {}
    for question_id, notebook_id in list(via_document) + list(via_deck):
        questions_by_notebook.setdefault(notebook_id, set()).add(question_id)

    results = []
    for notebook in notebooks:
        question_ids = questions_by_notebook.get(notebook.id, set())
        tracked = [
            progress_by_question[qid] for qid in question_ids if qid in progress_by_question
        ]

        total_attempts = sum(p.times_seen for p in tracked)
        total_correct = sum(p.times_correct for p in tracked)
        mastered_count = sum(1 for p in tracked if p.is_mastered)
        questions_due = sum(
            1 for p in tracked if SM2Algorithm.get_due_questions_count(p.next_review_date)
        )

        last_studied = max(
            (p.last_attempt_date for p in tracked if p.last_attempt_date), default=None
        )

        results.append(
            {
                "notebook_id": notebook.id,
                "name": notebook.name,
                "icon": notebook.icon,
                # Every question in the notebook, including ones never answered.
                "total_questions": len(question_ids),
                "questions_seen": len(tracked),
                "total_attempts": total_attempts,
                "success_rate": total_correct / total_attempts if total_attempts > 0 else 0,
                "questions_mastered": mastered_count,
                # Measured against the whole notebook, so adding new material
                # correctly lowers it rather than leaving it at 100%.
                "mastery_rate": mastered_count / len(question_ids) if question_ids else 0,
                "questions_due": questions_due,
                "last_studied": last_studied.isoformat() if last_studied else None,
            }
        )

    stats_cache.set(cache_key, results)
    return results
