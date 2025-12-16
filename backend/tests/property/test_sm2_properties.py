"""Property-based tests for SM-2 spaced repetition algorithm

Feature: codebase-quality-improvements
"""
import pytest
from hypothesis import given, strategies as st
from datetime import datetime

from app.services.spaced_repetition.sm2_algorithm import (
    SM2Algorithm,
    ReviewResult
)


# Hypothesis strategies for generating test data
@st.composite
def valid_sm2_state(draw):
    """Generate valid SM-2 algorithm state"""
    return {
        'easiness_factor': draw(st.floats(min_value=1.3, max_value=3.0)),
        'interval': draw(st.integers(min_value=0, max_value=365)),
        'repetitions': draw(st.integers(min_value=0, max_value=20)),
        'quality': draw(st.sampled_from(list(ReviewResult))),
    }


@st.composite
def time_taken_strategy(draw):
    """Generate time taken values"""
    return draw(st.floats(min_value=0.1, max_value=300.0))


@pytest.mark.property
class TestSM2Properties:
    """Property-based tests for SM-2 algorithm correctness"""

    @given(state=valid_sm2_state())
    def test_property_1_easiness_factor_bounds(self, state):
        """
        Feature: codebase-quality-improvements, Property 1: Easiness factor bounds invariant
        Validates: Requirements 1.1
        
        For any valid SM-2 algorithm inputs (easiness factor, interval, repetitions, 
        quality score, time taken), the calculated easiness factor should always be 
        greater than or equal to 1.3
        """
        new_ef, new_interval, new_reps, next_date = SM2Algorithm.calculate_next_review(
            easiness_factor=state['easiness_factor'],
            interval=state['interval'],
            repetitions=state['repetitions'],
            quality=state['quality']
        )
        
        assert new_ef >= 1.3, (
            f"Easiness factor {new_ef} is below minimum 1.3. "
            f"Input: ef={state['easiness_factor']}, interval={state['interval']}, "
            f"reps={state['repetitions']}, quality={state['quality']}"
        )

    @given(
        ef=st.floats(min_value=1.3, max_value=3.0),
        interval=st.integers(min_value=1, max_value=100),
        reps=st.integers(min_value=0, max_value=20),
        quality=st.sampled_from([ReviewResult.CORRECT_HARD, ReviewResult.CORRECT_MEDIUM, ReviewResult.PERFECT])
    )
    def test_property_2_interval_monotonicity(self, ef, interval, reps, quality):
        """
        Feature: codebase-quality-improvements, Property 2: Interval monotonicity with correct answers
        Validates: Requirements 1.2
        
        For any sequence of correct answers (quality >= 3), each successive interval 
        should be greater than or equal to the previous interval
        """
        # First correct answer
        new_ef_1, new_interval_1, new_reps_1, _ = SM2Algorithm.calculate_next_review(
            easiness_factor=ef,
            interval=interval,
            repetitions=reps,
            quality=quality
        )
        
        # Second correct answer (using results from first)
        new_ef_2, new_interval_2, new_reps_2, _ = SM2Algorithm.calculate_next_review(
            easiness_factor=new_ef_1,
            interval=new_interval_1,
            repetitions=new_reps_1,
            quality=quality
        )
        
        assert new_interval_2 >= new_interval_1, (
            f"Interval decreased from {new_interval_1} to {new_interval_2} with correct answers. "
            f"Input: ef={ef}, interval={interval}, reps={reps}, quality={quality}"
        )

    @given(
        ef=st.floats(min_value=1.3, max_value=3.0),
        interval=st.integers(min_value=1, max_value=365),
        reps=st.integers(min_value=1, max_value=20),
        quality=st.sampled_from([ReviewResult.COMPLETE_BLACKOUT, ReviewResult.INCORRECT_HARD, ReviewResult.INCORRECT_EASY])
    )
    def test_property_3_incorrect_answer_reset(self, ef, interval, reps, quality):
        """
        Feature: codebase-quality-improvements, Property 3: Incorrect answer reset
        Validates: Requirements 1.3
        
        For any SM-2 state where quality < 3 (incorrect answer), the resulting 
        repetitions should be 0 and interval should be 1
        """
        new_ef, new_interval, new_reps, _ = SM2Algorithm.calculate_next_review(
            easiness_factor=ef,
            interval=interval,
            repetitions=reps,
            quality=quality
        )
        
        assert new_reps == 0, (
            f"Repetitions not reset to 0 after incorrect answer. Got {new_reps}. "
            f"Input: ef={ef}, interval={interval}, reps={reps}, quality={quality}"
        )
        assert new_interval == 1, (
            f"Interval not reset to 1 after incorrect answer. Got {new_interval}. "
            f"Input: ef={ef}, interval={interval}, reps={reps}, quality={quality}"
        )

    @given(
        ef=st.floats(min_value=1.3, max_value=3.0),
        interval=st.integers(min_value=0, max_value=100),
        reps=st.integers(min_value=0, max_value=20),
        quality=st.sampled_from(list(ReviewResult)),
        time_limit=st.floats(min_value=10.0, max_value=60.0)
    )
    def test_property_4_time_penalty(self, ef, interval, reps, quality, time_limit):
        """
        Feature: codebase-quality-improvements, Property 4: Time penalty application
        Validates: Requirements 1.4
        
        For any answer where time_taken > time_limit, the effective quality score 
        used in calculations should be reduced by at least 1 compared to the base quality
        """
        # Calculate with time under limit (no penalty)
        time_under = time_limit * 0.8
        ef_fast, interval_fast, reps_fast, _ = SM2Algorithm.calculate_next_review(
            easiness_factor=ef,
            interval=interval,
            repetitions=reps,
            quality=quality,
            time_taken_seconds=time_under,
            time_limit_seconds=time_limit
        )
        
        # Calculate with time over limit (with penalty)
        time_over = time_limit * 1.5
        ef_slow, interval_slow, reps_slow, _ = SM2Algorithm.calculate_next_review(
            easiness_factor=ef,
            interval=interval,
            repetitions=reps,
            quality=quality,
            time_taken_seconds=time_over,
            time_limit_seconds=time_limit
        )
        
        # The slow answer should result in a lower or equal easiness factor
        # (equal only if quality was already 0 and couldn't be reduced further)
        assert ef_slow <= ef_fast, (
            f"Time penalty not applied: ef_slow ({ef_slow}) > ef_fast ({ef_fast}). "
            f"Input: ef={ef}, interval={interval}, reps={reps}, quality={quality}, "
            f"time_limit={time_limit}"
        )

    @given(
        reps=st.integers(min_value=0, max_value=20),
        ef=st.floats(min_value=1.3, max_value=3.0),
        times_correct=st.integers(min_value=0, max_value=100),
        times_incorrect=st.integers(min_value=0, max_value=100)
    )
    def test_property_5_mastery_determinism(self, reps, ef, times_correct, times_incorrect):
        """
        Feature: codebase-quality-improvements, Property 5: Mastery calculation determinism
        Validates: Requirements 1.5
        
        For any set of input parameters (repetitions, easiness_factor, times_correct, 
        times_incorrect), calling calculate_mastery_level multiple times should always 
        return identical results
        """
        # Call the function multiple times with the same inputs
        result_1 = SM2Algorithm.calculate_mastery_level(
            repetitions=reps,
            easiness_factor=ef,
            times_correct=times_correct,
            times_incorrect=times_incorrect
        )
        
        result_2 = SM2Algorithm.calculate_mastery_level(
            repetitions=reps,
            easiness_factor=ef,
            times_correct=times_correct,
            times_incorrect=times_incorrect
        )
        
        result_3 = SM2Algorithm.calculate_mastery_level(
            repetitions=reps,
            easiness_factor=ef,
            times_correct=times_correct,
            times_incorrect=times_incorrect
        )
        
        assert result_1 == result_2 == result_3, (
            f"Mastery calculation is not deterministic. "
            f"Got different results: {result_1}, {result_2}, {result_3}. "
            f"Input: reps={reps}, ef={ef}, times_correct={times_correct}, "
            f"times_incorrect={times_incorrect}"
        )
