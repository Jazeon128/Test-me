"""Unit tests for SM-2 spaced repetition algorithm"""
import pytest
from datetime import datetime, timedelta

from app.services.spaced_repetition.sm2_algorithm import (
    SM2Algorithm,
    ReviewResult,
    ReviewData
)


@pytest.mark.unit
class TestReviewResult:
    """Tests for ReviewResult enum"""

    def test_review_result_values(self):
        """Test that review result values are correctly defined"""
        assert ReviewResult.COMPLETE_BLACKOUT.value == 0
        assert ReviewResult.INCORRECT_HARD.value == 1
        assert ReviewResult.INCORRECT_EASY.value == 2
        assert ReviewResult.CORRECT_HARD.value == 3
        assert ReviewResult.CORRECT_MEDIUM.value == 4
        assert ReviewResult.PERFECT.value == 5


@pytest.mark.unit
class TestReviewData:
    """Tests for ReviewData dataclass"""

    def test_review_data_creation(self):
        """Test creating ReviewData with all fields"""
        timestamp = datetime.utcnow()
        data = ReviewData(
            quality=ReviewResult.PERFECT,
            time_taken_seconds=10.5,
            timestamp=timestamp
        )

        assert data.quality == ReviewResult.PERFECT
        assert data.time_taken_seconds == 10.5
        assert data.timestamp == timestamp

    def test_review_data_auto_timestamp(self):
        """Test that timestamp is auto-generated if not provided"""
        data = ReviewData(
            quality=ReviewResult.CORRECT_MEDIUM,
            time_taken_seconds=20.0
        )

        assert data.timestamp is not None
        assert isinstance(data.timestamp, datetime)


@pytest.mark.unit
class TestSM2Algorithm:
    """Tests for SM2Algorithm class"""

    def test_calculate_next_review_first_correct(self):
        """Test first correct answer"""
        ef, interval, reps, next_date = SM2Algorithm.calculate_next_review(
            easiness_factor=2.5,
            interval=0,
            repetitions=0,
            quality=ReviewResult.PERFECT
        )

        assert reps == 1
        assert interval == 1  # Review in 1 day
        assert ef >= 2.5  # EF should improve or stay same

    def test_calculate_next_review_second_correct(self):
        """Test second consecutive correct answer"""
        ef, interval, reps, next_date = SM2Algorithm.calculate_next_review(
            easiness_factor=2.5,
            interval=1,
            repetitions=1,
            quality=ReviewResult.PERFECT
        )

        assert reps == 2
        assert interval == 6  # Review in 6 days

    def test_calculate_next_review_third_correct(self):
        """Test third consecutive correct answer"""
        ef, interval, reps, next_date = SM2Algorithm.calculate_next_review(
            easiness_factor=2.5,
            interval=6,
            repetitions=2,
            quality=ReviewResult.PERFECT
        )

        assert reps == 3
        assert interval > 6  # Should be interval * EF

    def test_calculate_next_review_incorrect_resets(self):
        """Test that incorrect answer resets repetitions"""
        ef, interval, reps, next_date = SM2Algorithm.calculate_next_review(
            easiness_factor=2.5,
            interval=15,
            repetitions=5,
            quality=ReviewResult.INCORRECT_HARD
        )

        assert reps == 0  # Reset
        assert interval == 1  # Back to 1 day

    def test_easiness_factor_minimum(self):
        """Test that EF never goes below 1.3"""
        # Multiple incorrect answers should lower EF
        ef = 2.5
        for _ in range(10):
            ef, interval, reps, next_date = SM2Algorithm.calculate_next_review(
                easiness_factor=ef,
                interval=1,
                repetitions=0,
                quality=ReviewResult.COMPLETE_BLACKOUT
            )

        assert ef >= 1.3  # Should never go below minimum

    def test_easiness_factor_increases_with_perfect_recall(self):
        """Test that EF increases with perfect recall"""
        initial_ef = 2.0

        ef, interval, reps, next_date = SM2Algorithm.calculate_next_review(
            easiness_factor=initial_ef,
            interval=1,
            repetitions=1,
            quality=ReviewResult.PERFECT
        )

        assert ef > initial_ef

    def test_easiness_factor_decreases_with_poor_recall(self):
        """Test that EF decreases with poor recall"""
        initial_ef = 2.5

        ef, interval, reps, next_date = SM2Algorithm.calculate_next_review(
            easiness_factor=initial_ef,
            interval=1,
            repetitions=1,
            quality=ReviewResult.INCORRECT_HARD
        )

        assert ef < initial_ef

    def test_time_penalty_applies(self):
        """Test that slow answers get quality penalty"""
        # Fast answer (no penalty)
        ef_fast, _, _, _ = SM2Algorithm.calculate_next_review(
            easiness_factor=2.5,
            interval=1,
            repetitions=1,
            quality=ReviewResult.PERFECT,
            time_taken_seconds=10.0,
            time_limit_seconds=30.0
        )

        # Slow answer (with penalty)
        ef_slow, _, _, _ = SM2Algorithm.calculate_next_review(
            easiness_factor=2.5,
            interval=1,
            repetitions=1,
            quality=ReviewResult.PERFECT,
            time_taken_seconds=35.0,  # Over time limit
            time_limit_seconds=30.0
        )

        # Slow answer should have lower EF due to quality reduction
        assert ef_slow < ef_fast

    def test_next_review_date_calculation(self):
        """Test that next review date is correctly calculated"""
        before = datetime.utcnow()

        ef, interval, reps, next_date = SM2Algorithm.calculate_next_review(
            easiness_factor=2.5,
            interval=0,
            repetitions=0,
            quality=ReviewResult.PERFECT
        )

        after = datetime.utcnow()

        # Next review should be interval days from now
        expected_min = before + timedelta(days=interval)
        expected_max = after + timedelta(days=interval)

        assert expected_min <= next_date <= expected_max

    def test_determine_quality_correct_fast(self):
        """Test quality determination for fast correct answer"""
        quality = SM2Algorithm.determine_quality_from_attempt(
            correct=True,
            time_taken_seconds=10.0,
            time_limit_seconds=30.0
        )

        assert quality == ReviewResult.PERFECT

    def test_determine_quality_correct_medium(self):
        """Test quality determination for medium-speed correct answer"""
        quality = SM2Algorithm.determine_quality_from_attempt(
            correct=True,
            time_taken_seconds=20.0,
            time_limit_seconds=30.0
        )

        assert quality == ReviewResult.CORRECT_MEDIUM

    def test_determine_quality_correct_slow(self):
        """Test quality determination for slow correct answer"""
        quality = SM2Algorithm.determine_quality_from_attempt(
            correct=True,
            time_taken_seconds=28.0,
            time_limit_seconds=30.0
        )

        assert quality == ReviewResult.CORRECT_HARD

    def test_determine_quality_incorrect_fast(self):
        """Test quality determination for fast incorrect answer"""
        quality = SM2Algorithm.determine_quality_from_attempt(
            correct=False,
            time_taken_seconds=10.0,
            time_limit_seconds=30.0
        )

        assert quality == ReviewResult.INCORRECT_EASY

    def test_determine_quality_incorrect_slow(self):
        """Test quality determination for slow incorrect answer"""
        quality = SM2Algorithm.determine_quality_from_attempt(
            correct=False,
            time_taken_seconds=25.0,
            time_limit_seconds=30.0
        )

        assert quality == ReviewResult.INCORRECT_HARD

    def test_get_due_questions_count_overdue(self):
        """Test that overdue questions are marked as due"""
        past_date = datetime.utcnow() - timedelta(days=1)
        is_due = SM2Algorithm.get_due_questions_count(past_date)

        assert is_due is True

    def test_get_due_questions_count_future(self):
        """Test that future questions are not due"""
        future_date = datetime.utcnow() + timedelta(days=1)
        is_due = SM2Algorithm.get_due_questions_count(future_date)

        assert is_due is False

    def test_get_due_questions_count_now(self):
        """Test that questions due now are marked as due"""
        now = datetime.utcnow()
        is_due = SM2Algorithm.get_due_questions_count(now)

        assert is_due is True

    def test_calculate_mastery_level_mastered(self):
        """Test mastery calculation for mastered question"""
        is_mastered, percentage = SM2Algorithm.calculate_mastery_level(
            repetitions=5,
            easiness_factor=2.6,
            times_correct=10,
            times_incorrect=2
        )

        # 5+ reps, EF >= 2.5, success rate 10/12 = 83% (>= 80%)
        assert is_mastered is True
        assert percentage > 50

    def test_calculate_mastery_level_not_mastered_low_reps(self):
        """Test that low repetitions prevent mastery"""
        is_mastered, percentage = SM2Algorithm.calculate_mastery_level(
            repetitions=3,  # Less than 5
            easiness_factor=2.6,
            times_correct=10,
            times_incorrect=2
        )

        assert is_mastered is False

    def test_calculate_mastery_level_not_mastered_low_ef(self):
        """Test that low EF prevents mastery"""
        is_mastered, percentage = SM2Algorithm.calculate_mastery_level(
            repetitions=5,
            easiness_factor=2.0,  # Less than 2.5
            times_correct=10,
            times_incorrect=2
        )

        assert is_mastered is False

    def test_calculate_mastery_level_not_mastered_low_success_rate(self):
        """Test that low success rate prevents mastery"""
        is_mastered, percentage = SM2Algorithm.calculate_mastery_level(
            repetitions=5,
            easiness_factor=2.6,
            times_correct=5,
            times_incorrect=5  # Success rate 50% (< 80%)
        )

        assert is_mastered is False

    def test_calculate_mastery_level_zero_attempts(self):
        """Test mastery calculation with no attempts"""
        is_mastered, percentage = SM2Algorithm.calculate_mastery_level(
            repetitions=0,
            easiness_factor=2.5,
            times_correct=0,
            times_incorrect=0
        )

        assert is_mastered is False
        assert percentage >= 0

    def test_calculate_mastery_percentage_range(self):
        """Test that mastery percentage stays in 0-100 range"""
        # Test multiple scenarios
        scenarios = [
            (0, 1.3, 0, 10),  # Very poor
            (5, 2.5, 10, 2),  # Good
            (10, 3.0, 20, 0),  # Excellent
        ]

        for reps, ef, correct, incorrect in scenarios:
            is_mastered, percentage = SM2Algorithm.calculate_mastery_level(
                repetitions=reps,
                easiness_factor=ef,
                times_correct=correct,
                times_incorrect=incorrect
            )

            assert 0 <= percentage <= 100

    def test_interval_progression(self):
        """Test realistic interval progression over multiple reviews"""
        ef = 2.5
        interval = 0
        reps = 0

        # Simulate perfect learning
        intervals_progression = []

        for i in range(5):
            ef, interval, reps, next_date = SM2Algorithm.calculate_next_review(
                easiness_factor=ef,
                interval=interval,
                repetitions=reps,
                quality=ReviewResult.PERFECT
            )
            intervals_progression.append(interval)

        # Expected: 1, 6, then progressively longer
        assert intervals_progression[0] == 1
        assert intervals_progression[1] == 6
        assert intervals_progression[2] > intervals_progression[1]
        assert intervals_progression[3] > intervals_progression[2]
        assert intervals_progression[4] > intervals_progression[3]

    def test_quality_time_boundary_conditions(self):
        """Test boundary conditions for time-based quality"""
        time_limit = 30.0

        # Exactly at 50% (should be PERFECT)
        quality = SM2Algorithm.determine_quality_from_attempt(
            correct=True,
            time_taken_seconds=15.0,
            time_limit_seconds=time_limit
        )
        assert quality == ReviewResult.PERFECT

        # Exactly at 80% (should be CORRECT_MEDIUM)
        quality = SM2Algorithm.determine_quality_from_attempt(
            correct=True,
            time_taken_seconds=24.0,
            time_limit_seconds=time_limit
        )
        assert quality == ReviewResult.CORRECT_MEDIUM

        # Just over 80% (should be CORRECT_HARD)
        quality = SM2Algorithm.determine_quality_from_attempt(
            correct=True,
            time_taken_seconds=24.5,
            time_limit_seconds=time_limit
        )
        assert quality == ReviewResult.CORRECT_HARD

    def test_ef_calculation_formula(self):
        """Test EF calculation matches SM-2 formula"""
        # Test specific known values
        initial_ef = 2.5

        # Perfect recall (q=5) should increase EF
        ef, _, _, _ = SM2Algorithm.calculate_next_review(
            easiness_factor=initial_ef,
            interval=1,
            repetitions=1,
            quality=ReviewResult.PERFECT
        )

        # EF' = EF + (0.1 - (5 - 5) * (0.08 + (5 - 5) * 0.02))
        # EF' = 2.5 + 0.1 = 2.6
        assert ef == pytest.approx(2.6, abs=0.01)

    def test_repetition_reset_on_any_incorrect(self):
        """Test that any quality < 3 resets repetitions"""
        for quality in [ReviewResult.COMPLETE_BLACKOUT, ReviewResult.INCORRECT_HARD, ReviewResult.INCORRECT_EASY]:
            ef, interval, reps, next_date = SM2Algorithm.calculate_next_review(
                easiness_factor=2.5,
                interval=10,
                repetitions=5,
                quality=quality
            )

            assert reps == 0
            assert interval == 1
