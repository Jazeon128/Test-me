from datetime import date as date_type

from sqlalchemy import Column, Date, Integer, String, Text, UniqueConstraint

from .base import Base, TimestampMixin


class StudyDay(Base, TimestampMixin):
    """One row per day you did something.

    The unit is a day, not an event, because every mechanic built on top asks
    day-shaped questions: how many days in a row, which days were busy, how many
    days since this topic was touched.
    """

    __tablename__ = "study_days"

    __table_args__ = (UniqueConstraint("day", name="uq_study_days_day"),)

    id = Column(Integer, primary_key=True, index=True)
    day = Column(Date, nullable=False, index=True)

    questions_answered = Column(Integer, default=0, nullable=False)
    questions_correct = Column(Integer, default=0, nullable=False)
    canvases_created = Column(Integer, default=0, nullable=False)

    # Points were previously calculated on every answer and thrown away. They
    # are kept here so a total exists at all.
    points = Column(Integer, default=0, nullable=False)

    def __repr__(self) -> str:
        return f"<StudyDay {self.day}: {self.questions_answered} answered>"


class Award(Base, TimestampMixin):
    """Something earned once, kept forever."""

    __tablename__ = "awards"

    __table_args__ = (UniqueConstraint("code", name="uq_awards_code"),)

    id = Column(Integer, primary_key=True, index=True)

    # Stable identifier, so an award is granted at most once.
    code = Column(String(60), nullable=False)
    title = Column(String(120), nullable=False)
    description = Column(Text, nullable=True)

    # What was true when it was earned, for the detail line.
    detail = Column(String(200), nullable=True)

    def __repr__(self) -> str:
        return f"<Award {self.code}>"


def today() -> date_type:
    """Local calendar day.

    Deliberately local rather than UTC: a streak is about the person's day, and
    studying at 11pm should not count as tomorrow.
    """
    from datetime import datetime

    return datetime.now().date()
