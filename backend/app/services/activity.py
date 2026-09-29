"""The activity record: what you did, on which day, and what that earned.

Everything gamified reads from here. Before this existed the dashboard showed a
"Current Streak" that was really the consecutive-correct count of whichever
single question you answered last, so one wrong answer read as zero however long
the real run. A streak is a property of days, so days are what this stores.
"""

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from ..models.activity import Award, StudyDay, today


@dataclass(frozen=True)
class AwardSpec:
    code: str
    title: str
    description: str


#: Milestones worth marking. Deliberately few: an award handed out constantly
#: stops meaning anything, and these are the points where a habit is actually
#: forming rather than arbitrary round numbers.
STREAK_AWARDS = {
    3: AwardSpec("streak-3", "Three days", "Studied three days in a row"),
    7: AwardSpec("streak-7", "A full week", "Studied seven days in a row"),
    30: AwardSpec("streak-30", "A month", "Studied thirty days in a row"),
    100: AwardSpec("streak-100", "A hundred days", "Studied a hundred days in a row"),
}

ANSWER_AWARDS = {
    1: AwardSpec("first-answer", "First answer", "Answered your first question"),
    100: AwardSpec("answers-100", "A hundred answers", "Answered a hundred questions"),
    1000: AwardSpec("answers-1000", "A thousand answers", "Answered a thousand questions"),
}

CANVAS_AWARDS = {
    1: AwardSpec("first-canvas", "First canvas", "Drew your first diagram"),
    25: AwardSpec("canvases-25", "Twenty-five canvases", "Drew twenty-five diagrams"),
}

#: Mastery is SM-2's judgment, not a count of attempts, so these mean more than
#: the answer milestones above.
MASTERY_AWARDS = {
    1: AwardSpec("mastered-1", "First mastered", "Mastered your first question"),
    10: AwardSpec("mastered-10", "Ten mastered", "Mastered ten questions"),
    50: AwardSpec("mastered-50", "Fifty mastered", "Mastered fifty questions"),
}

#: Accuracy needs a floor on the sample. One correct answer is not 100%.
ACCURACY_MINIMUM_ANSWERS = 20
ACCURACY_AWARD = AwardSpec(
    "accuracy-80",
    "Eight in ten",
    f"Answered {ACCURACY_MINIMUM_ANSWERS}+ questions at 80% or better",
)

#: What one answer is worth, matching what the submit endpoint already returned
#: before anything stored it.
POINTS_PER_CORRECT = 10
POINTS_PER_CANVAS = 5


def get_or_create_day(db: Session, day: Optional[date] = None) -> StudyDay:
    day = day or today()
    row = db.query(StudyDay).filter(StudyDay.day == day).first()
    if row is None:
        row = StudyDay(day=day)
        db.add(row)
        db.flush()
    return row


@dataclass(frozen=True)
class AnswerPoints:
    """Base and bonus stay separate because the API reports them separately."""

    base: int
    bonus: int

    @property
    def total(self) -> int:
        return self.base + self.bonus


def record_answer(db: Session, correct: bool, question_streak: int = 0) -> AnswerPoints:
    """Record one answered question and return what it earned."""
    row = get_or_create_day(db)
    row.questions_answered += 1

    earned = AnswerPoints(base=0, bonus=0)
    if correct:
        row.questions_correct += 1
        earned = AnswerPoints(base=POINTS_PER_CORRECT, bonus=question_streak * 5)

    row.points += earned.total
    db.commit()
    return earned


def record_canvas(db: Session) -> None:
    row = get_or_create_day(db)
    row.canvases_created += 1
    row.points += POINTS_PER_CANVAS
    db.commit()


def current_streak(db: Session, as_of: Optional[date] = None) -> int:
    """Consecutive days ending today, or yesterday if today is not done yet.

    Yesterday counts so that a streak is not reported as broken during the day
    before you have studied. It breaks only once a full day has been missed.
    """
    as_of = as_of or today()
    days = {row.day for row in db.query(StudyDay).filter(StudyDay.questions_answered > 0).all()}
    if not days:
        return 0

    if as_of in days:
        cursor = as_of
    elif (as_of - timedelta(days=1)) in days:
        cursor = as_of - timedelta(days=1)
    else:
        return 0

    streak = 0
    while cursor in days:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def longest_streak(db: Session) -> int:
    days = sorted(
        row.day for row in db.query(StudyDay).filter(StudyDay.questions_answered > 0).all()
    )
    if not days:
        return 0

    best = run = 1
    for previous, current in zip(days, days[1:]):
        run = run + 1 if current - previous == timedelta(days=1) else 1
        best = max(best, run)
    return best


def totals(db: Session) -> Dict[str, int]:
    rows = db.query(StudyDay).all()
    return {
        "points": sum(r.points for r in rows),
        "questions_answered": sum(r.questions_answered for r in rows),
        "questions_correct": sum(r.questions_correct for r in rows),
        "canvases_created": sum(r.canvases_created for r in rows),
        "active_days": sum(1 for r in rows if r.questions_answered or r.canvases_created),
    }


def _grant(db: Session, spec: AwardSpec, detail: str) -> Optional[Award]:
    if db.query(Award).filter(Award.code == spec.code).first():
        return None
    award = Award(code=spec.code, title=spec.title, description=spec.description, detail=detail)
    db.add(award)
    db.commit()
    db.refresh(award)
    return award


def _grant_thresholds(db, specs, value, detail) -> List[Award]:
    """Grant every threshold award that `value` has now reached."""
    granted = []
    for threshold, spec in specs.items():
        if value >= threshold:
            award = _grant(db, spec, detail(value))
            if award:
                granted.append(award)
    return granted


def check_awards(db: Session) -> List[Award]:
    """Grant anything newly earned. Safe to call after every action."""
    from ..models.user_progress import UserProgress

    counts = totals(db)
    mastered = db.query(UserProgress).filter(UserProgress.is_mastered.is_(True)).count()

    earned: List[Award] = []
    earned += _grant_thresholds(db, STREAK_AWARDS, current_streak(db), lambda v: f"{v} day streak")
    earned += _grant_thresholds(
        db, ANSWER_AWARDS, counts["questions_answered"], lambda v: f"{v} answered"
    )
    earned += _grant_thresholds(
        db, CANVAS_AWARDS, counts["canvases_created"], lambda v: f"{v} drawn"
    )
    earned += _grant_thresholds(db, MASTERY_AWARDS, mastered, lambda v: f"{v} mastered")

    # Accuracy is not a threshold count, so it stands on its own.
    answered = counts["questions_answered"]
    if answered >= ACCURACY_MINIMUM_ANSWERS:
        accuracy = counts["questions_correct"] / answered
        if accuracy >= 0.8:
            award = _grant(db, ACCURACY_AWARD, f"{round(accuracy * 100)}% over {answered}")
            if award:
                earned.append(award)

    return earned


def heatmap(db: Session, days_back: int = 365, as_of: Optional[date] = None) -> List[Dict]:
    """One entry per day in the window, including the empty ones.

    Empty days are included so the frontend renders a calendar rather than
    having to invent the gaps.
    """
    as_of = as_of or today()
    start = as_of - timedelta(days=days_back - 1)

    rows = {row.day: row for row in db.query(StudyDay).filter(StudyDay.day >= start).all()}

    out = []
    for offset in range(days_back):
        day = start + timedelta(days=offset)
        row = rows.get(day)
        out.append(
            {
                "date": day.isoformat(),
                "questions_answered": row.questions_answered if row else 0,
                "questions_correct": row.questions_correct if row else 0,
                "canvases_created": row.canvases_created if row else 0,
                "points": row.points if row else 0,
            }
        )
    return out


#: How the mascot is feeling, derived from the streak alone.
#:
#: There is no state that blames the person for a missed day. A character that
#: sulks to make you open an app is a manipulation pattern, not a feature, so
#: the resting state is neutral and the rest are earned upward.
def mood(db: Session) -> Dict[str, object]:
    streak = current_streak(db)
    counts = totals(db)

    if counts["active_days"] == 0:
        state, line = "new", "Nothing studied yet. Upload something and ask it a question."
    elif streak == 0:
        state, line = "resting", "Resting. Answer one question to start a new run."
    elif streak < 3:
        state, line = "warm", f"{streak} day{'s' if streak > 1 else ''} in."
    elif streak < 7:
        state, line = "happy", f"{streak} days in a row."
    elif streak < 30:
        state, line = "thriving", f"{streak} days. This is a habit now."
    else:
        state, line = "radiant", f"{streak} days. Remarkable."

    return {"state": state, "line": line, "streak": streak}
