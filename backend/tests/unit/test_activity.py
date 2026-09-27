"""Tests for the activity record.

The streak is the part worth testing hard. The number it replaces was wrong in a
way nobody noticed for months, because "streak" is easy to compute plausibly and
hard to eyeball.
"""

from datetime import date, timedelta

import pytest

from app.models.activity import Award, StudyDay
from app.services import activity


def add_days(db, *days, answered=1):
    for day in days:
        db.add(StudyDay(day=day, questions_answered=answered, questions_correct=answered))
    db.commit()


TODAY = date(2026, 9, 27)


class TestCurrentStreak:
    def test_no_activity_is_zero(self, db_session):
        assert activity.current_streak(db_session, as_of=TODAY) == 0

    def test_today_alone_is_one(self, db_session):
        add_days(db_session, TODAY)
        assert activity.current_streak(db_session, as_of=TODAY) == 1

    def test_consecutive_days_count(self, db_session):
        add_days(db_session, TODAY, TODAY - timedelta(days=1), TODAY - timedelta(days=2))
        assert activity.current_streak(db_session, as_of=TODAY) == 3

    def test_today_not_yet_studied_keeps_yesterdays_run(self, db_session):
        """A streak must not read as broken just because it is still morning."""
        add_days(db_session, TODAY - timedelta(days=1), TODAY - timedelta(days=2))
        assert activity.current_streak(db_session, as_of=TODAY) == 2

    def test_a_missed_day_breaks_it(self, db_session):
        add_days(db_session, TODAY - timedelta(days=2), TODAY - timedelta(days=3))
        assert activity.current_streak(db_session, as_of=TODAY) == 0

    def test_a_gap_stops_the_count_there(self, db_session):
        add_days(
            db_session,
            TODAY,
            TODAY - timedelta(days=1),
            # gap at 2
            TODAY - timedelta(days=3),
            TODAY - timedelta(days=4),
        )
        assert activity.current_streak(db_session, as_of=TODAY) == 2

    def test_a_day_with_no_questions_does_not_count(self, db_session):
        """Opening the app is not studying."""
        db_session.add(StudyDay(day=TODAY, questions_answered=0, canvases_created=3))
        db_session.commit()
        assert activity.current_streak(db_session, as_of=TODAY) == 0


class TestLongestStreak:
    def test_no_activity_is_zero(self, db_session):
        assert activity.longest_streak(db_session) == 0

    def test_finds_the_best_run_not_the_current_one(self, db_session):
        add_days(
            db_session,
            TODAY,
            # a current run of 1, and an older run of 4
            TODAY - timedelta(days=5),
            TODAY - timedelta(days=6),
            TODAY - timedelta(days=7),
            TODAY - timedelta(days=8),
        )
        assert activity.longest_streak(db_session) == 4


class TestRecording:
    def test_a_correct_answer_earns_points(self, db_session):
        points = activity.record_answer(db_session, correct=True)
        assert points.base == activity.POINTS_PER_CORRECT
        assert points.bonus == 0

    def test_a_wrong_answer_earns_nothing_but_still_counts_as_activity(self, db_session):
        points = activity.record_answer(db_session, correct=False)
        assert points.total == 0

        counts = activity.totals(db_session)
        assert counts["questions_answered"] == 1
        assert counts["questions_correct"] == 0

    def test_points_accumulate_rather_than_being_discarded(self, db_session):
        """The whole reason this exists: the old endpoint computed and dropped them."""
        activity.record_answer(db_session, correct=True)
        activity.record_answer(db_session, correct=True)
        assert activity.totals(db_session)["points"] == 2 * activity.POINTS_PER_CORRECT

    def test_a_question_streak_adds_a_bonus(self, db_session):
        points = activity.record_answer(db_session, correct=True, question_streak=3)
        assert points.base == activity.POINTS_PER_CORRECT
        assert points.bonus == 15
        assert points.total == activity.POINTS_PER_CORRECT + 15

    def test_several_answers_share_one_day_row(self, db_session):
        for _ in range(5):
            activity.record_answer(db_session, correct=True)
        assert db_session.query(StudyDay).count() == 1


class TestAwards:
    def test_first_answer_is_awarded_once(self, db_session):
        activity.record_answer(db_session, correct=True)
        first = activity.check_awards(db_session)
        assert "first-answer" in {a.code for a in first}

        activity.record_answer(db_session, correct=True)
        second = activity.check_awards(db_session)
        assert "first-answer" not in {a.code for a in second}
        assert db_session.query(Award).filter(Award.code == "first-answer").count() == 1

    def test_a_streak_award_needs_the_streak(self, db_session):
        activity.record_answer(db_session, correct=True)
        assert "streak-3" not in {a.code for a in activity.check_awards(db_session)}


class TestHeatmap:
    def test_includes_empty_days_so_the_calendar_has_no_gaps(self, db_session):
        cells = activity.heatmap(db_session, days_back=30, as_of=TODAY)
        assert len(cells) == 30
        assert cells[-1]["date"] == TODAY.isoformat()
        assert all(cell["questions_answered"] == 0 for cell in cells)

    def test_a_studied_day_shows_its_counts(self, db_session):
        add_days(db_session, TODAY, answered=7)
        cells = activity.heatmap(db_session, days_back=7, as_of=TODAY)
        assert cells[-1]["questions_answered"] == 7


class TestMood:
    def test_a_fresh_install_is_new_not_sad(self, db_session):
        assert activity.mood(db_session)["state"] == "new"

    def test_a_broken_streak_rests_rather_than_blaming(self, db_session):
        """No state exists that shames the person for a missed day."""
        add_days(db_session, TODAY - timedelta(days=9))
        assert activity.mood(db_session)["state"] == "resting"

    @pytest.mark.parametrize(
        "length,expected",
        [(1, "warm"), (4, "happy"), (10, "thriving"), (31, "radiant")],
    )
    def test_mood_rises_with_the_streak(self, db_session, length, expected):
        add_days(db_session, *[TODAY - timedelta(days=i) for i in range(length)])
        assert activity.mood(db_session)["state"] == expected
