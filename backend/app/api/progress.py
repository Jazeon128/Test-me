from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

from ..db import get_db
from ..models.user_progress import UserProgress
from ..models.question import Question
from ..services.spaced_repetition import SM2Algorithm, ReviewResult

router = APIRouter()


class SubmitAnswerRequest(BaseModel):
    question_id: int
    selected_option: str  # A, B, C, or D
    time_taken_seconds: float
    manual_quality: Optional[int] = None  # 0-5 scale for manual grading


class ReviewSessionRequest(BaseModel):
    num_questions: int = 10
    include_new: bool = True
    include_review: bool = True
    deck_id: Optional[int] = None


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
    # Get question
    question = db.query(Question).filter(Question.id == request.question_id).first()

    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    # Check if answer is correct
    correct_option = None
    is_correct = False

    for opt in question.options:
        if opt.is_correct:
            correct_option = chr(65 + opt.order)
            if correct_option == request.selected_option.upper():
                is_correct = True
            break

    # Get or create user progress
    progress = db.query(UserProgress).filter(
        UserProgress.question_id == request.question_id
    ).first()

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
    total_time = progress.average_time_seconds * (progress.times_seen - 1) + request.time_taken_seconds
    progress.average_time_seconds = total_time / progress.times_seen

    # Determine quality rating for SM-2
    if request.manual_quality is not None:
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
            time_limit_seconds=30.0
        )

    # Calculate next review using SM-2 algorithm
    new_ef, new_interval, new_repetitions, next_review = SM2Algorithm.calculate_next_review(
        easiness_factor=progress.easiness_factor,
        interval=progress.interval,
        repetitions=progress.repetitions,
        quality=quality,
        time_taken_seconds=request.time_taken_seconds,
    )

    # Update spaced repetition data
    progress.easiness_factor = new_ef
    progress.interval = new_interval
    progress.repetitions = new_repetitions
    progress.next_review_date = next_review

    # Update last attempt
    progress.last_attempt_date = datetime.utcnow()
    progress.last_attempt_correct = is_correct
    progress.last_attempt_time_seconds = request.time_taken_seconds

    # Update attempt history
    if progress.attempt_history is None:
        progress.attempt_history = []

    progress.attempt_history.append({
        "date": datetime.utcnow().isoformat(),
        "correct": is_correct,
        "time_seconds": request.time_taken_seconds,
        "quality": quality.value,
    })

    # Check if mastered
    is_mastered, mastery_percentage = SM2Algorithm.calculate_mastery_level(
        repetitions=progress.repetitions,
        easiness_factor=progress.easiness_factor,
        times_correct=progress.times_correct,
        times_incorrect=progress.times_incorrect,
    )
    progress.is_mastered = is_mastered

    db.commit()
    db.refresh(progress)

    return {
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
            "points_earned": 10 if is_correct else 0,
            "streak_bonus": progress.streak * 5 if is_correct else 0,
            "mastery_achieved": is_mastered and not progress.is_mastered,
        }
    }


@router.get("/question/{question_id}")
async def get_question_progress(question_id: int, db: Session = Depends(get_db)):
    """Get progress for a specific question"""
    progress = db.query(UserProgress).filter(
        UserProgress.question_id == question_id
    ).first()

    if not progress:
        return {
            "question_id": question_id,
            "never_seen": True,
        }

    is_mastered, mastery_percentage = SM2Algorithm.calculate_mastery_level(
        repetitions=progress.repetitions,
        easiness_factor=progress.easiness_factor,
        times_correct=progress.times_correct,
        times_incorrect=progress.times_incorrect,
    )

    return {
        "question_id": question_id,
        "times_seen": progress.times_seen,
        "times_correct": progress.times_correct,
        "times_incorrect": progress.times_incorrect,
        "success_rate": progress.times_correct / progress.times_seen if progress.times_seen > 0 else 0,
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
    from ..models.test import Test
    
    questions_to_review = []

    if request.include_review:
        # Get questions due for review
        query = db.query(UserProgress).join(Question)

        if request.deck_id:
            from ..models.test import TestQuestion
            query = query.join(Question.test_questions).join(TestQuestion.test).filter(Test.id == request.deck_id)
            
        due_progress = query.filter(
            UserProgress.next_review_date <= datetime.utcnow()
        ).order_by(UserProgress.next_review_date.asc()).limit(request.num_questions).all()

        questions_to_review.extend([p.question_id for p in due_progress])

    if request.include_new and len(questions_to_review) < request.num_questions:
        # Get questions never seen before
        seen_question_ids = db.query(UserProgress.question_id).all()
        seen_ids = [qid[0] for qid in seen_question_ids]

        query = db.query(Question).filter(~Question.id.in_(seen_ids))

        if request.deck_id:
            from ..models.test import TestQuestion
            query = query.join(Question.test_questions).join(TestQuestion.test).filter(Test.id == request.deck_id)
            
        new_questions = query.limit(request.num_questions - len(questions_to_review)).all()

        questions_to_review.extend([q.id for q in new_questions])

    # Get full question details
    questions = db.query(Question).filter(Question.id.in_(questions_to_review)).all()

    response_data = {
        "num_questions": len(questions),
        "questions": [
            {
                "id": q.id,
                "question_text": q.question_text,
                "options": [
                    {
                        "option": chr(65 + opt.order),
                        "text": opt.option_text,
                    }
                    for opt in sorted(q.options, key=lambda x: x.order)
                ],
                "difficulty": q.difficulty,
                "explanation": q.explanation,
                "correct_option": next((chr(65 + opt.order) for opt in q.options if opt.is_correct), None)
            }
            for q in questions
        ]
    }
    
    return response_data


@router.get("/stats")
async def get_overall_stats(db: Session = Depends(get_db)):
    """Get overall learning statistics"""
    all_progress = db.query(UserProgress).all()

    if not all_progress:
        return {
            "total_questions_seen": 0,
            "total_attempts": 0,
            "overall_success_rate": 0,
            "questions_mastered": 0,
            "current_streak": 0,
            "best_streak": 0,
            "questions_due": 0,
        }

    total_correct = sum(p.times_correct for p in all_progress)
    total_attempts = sum(p.times_seen for p in all_progress)
    mastered_count = sum(1 for p in all_progress if p.is_mastered)
    questions_due = sum(
        1 for p in all_progress
        if SM2Algorithm.get_due_questions_count(p.next_review_date)
    )

    # Get current streak (most recent progress)
    recent_progress = max(all_progress, key=lambda p: p.last_attempt_date or datetime.min)
    current_streak = recent_progress.streak if recent_progress else 0

    # Get best streak
    best_streak = max((p.best_streak for p in all_progress), default=0)

    return {
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
