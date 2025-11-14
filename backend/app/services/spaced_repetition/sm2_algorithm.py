from datetime import datetime, timedelta
from typing import Tuple
from dataclasses import dataclass
from enum import Enum


class ReviewResult(Enum):
    """Quality of answer recall (0-5 scale)"""
    COMPLETE_BLACKOUT = 0  # Complete failure to recall
    INCORRECT_HARD = 1  # Incorrect, but remembered on seeing answer
    INCORRECT_EASY = 2  # Incorrect, but seemed easy on seeing answer
    CORRECT_HARD = 3  # Correct, but difficult recall
    CORRECT_MEDIUM = 4  # Correct with hesitation
    PERFECT = 5  # Perfect recall


@dataclass
class ReviewData:
    """Data for a single review session"""
    quality: ReviewResult
    time_taken_seconds: float
    timestamp: datetime = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow()


class SM2Algorithm:
    """
    SuperMemo 2 (SM-2) Spaced Repetition Algorithm
    This is the algorithm used by Anki for scheduling card reviews

    Reference: https://www.supermemo.com/en/archives1990-2015/english/ol/sm2
    """

    @staticmethod
    def calculate_next_review(
        easiness_factor: float,
        interval: int,
        repetitions: int,
        quality: ReviewResult,
        time_taken_seconds: float = None,
        time_limit_seconds: float = 30.0
    ) -> Tuple[float, int, int, datetime]:
        """
        Calculate the next review parameters based on SM-2 algorithm

        Args:
            easiness_factor: Current E-Factor (1.3 - 2.5+)
            interval: Current interval in days
            repetitions: Number of consecutive correct answers
            quality: Quality of the answer (ReviewResult enum)
            time_taken_seconds: Time taken to answer (optional)
            time_limit_seconds: Maximum time considered acceptable (default 30s)

        Returns:
            Tuple of (new_easiness_factor, new_interval, new_repetitions, next_review_date)
        """
        # Adjust quality based on time taken (if provided)
        adjusted_quality = quality.value
        if time_taken_seconds is not None and time_taken_seconds > time_limit_seconds:
            # If took too long, reduce quality by 1 (but not below 0)
            adjusted_quality = max(0, adjusted_quality - 1)

        # Calculate new E-Factor
        # EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
        new_ef = easiness_factor + (0.1 - (5 - adjusted_quality) * (0.08 + (5 - adjusted_quality) * 0.02))

        # E-Factor should not fall below 1.3
        new_ef = max(1.3, new_ef)

        # Calculate new interval and repetitions
        if adjusted_quality < 3:
            # Incorrect answer - reset repetitions
            new_repetitions = 0
            new_interval = 1  # Review again tomorrow
        else:
            # Correct answer - increase interval
            new_repetitions = repetitions + 1

            if new_repetitions == 1:
                new_interval = 1  # First correct: review in 1 day
            elif new_repetitions == 2:
                new_interval = 6  # Second correct: review in 6 days
            else:
                # Subsequent reviews: multiply previous interval by E-Factor
                new_interval = round(interval * new_ef)

        # Calculate next review date
        next_review_date = datetime.utcnow() + timedelta(days=new_interval)

        return new_ef, new_interval, new_repetitions, next_review_date

    @staticmethod
    def determine_quality_from_attempt(
        correct: bool,
        time_taken_seconds: float,
        time_limit_seconds: float = 30.0
    ) -> ReviewResult:
        """
        Determine the quality rating based on correctness and time taken

        Args:
            correct: Whether the answer was correct
            time_taken_seconds: Time taken to answer
            time_limit_seconds: Time limit for optimal answer

        Returns:
            ReviewResult enum value
        """
        if not correct:
            # Incorrect answers
            if time_taken_seconds < time_limit_seconds * 0.5:
                return ReviewResult.INCORRECT_EASY  # Quick but wrong
            else:
                return ReviewResult.INCORRECT_HARD  # Struggled and wrong

        # Correct answers - base on time taken
        time_ratio = time_taken_seconds / time_limit_seconds

        if time_ratio <= 0.5:
            return ReviewResult.PERFECT  # Very fast
        elif time_ratio <= 0.8:
            return ReviewResult.CORRECT_MEDIUM  # Good time
        else:
            return ReviewResult.CORRECT_HARD  # Correct but slow

    @staticmethod
    def get_due_questions_count(next_review_date: datetime) -> bool:
        """Check if a question is due for review"""
        return datetime.utcnow() >= next_review_date

    @staticmethod
    def calculate_mastery_level(
        repetitions: int,
        easiness_factor: float,
        times_correct: int,
        times_incorrect: int
    ) -> Tuple[bool, int]:
        """
        Determine if a question is mastered and calculate mastery percentage

        Args:
            repetitions: Consecutive correct answers
            easiness_factor: Current E-Factor
            times_correct: Total correct answers
            times_incorrect: Total incorrect answers

        Returns:
            Tuple of (is_mastered, mastery_percentage)
        """
        # Consider mastered if:
        # 1. At least 5 consecutive correct answers
        # 2. E-Factor >= 2.5 (easy)
        # 3. Success rate >= 80%

        is_mastered = False
        total_attempts = times_correct + times_incorrect
        success_rate = times_correct / total_attempts if total_attempts > 0 else 0

        if repetitions >= 5 and easiness_factor >= 2.5 and success_rate >= 0.8:
            is_mastered = True

        # Calculate mastery percentage (0-100)
        mastery_percentage = min(100, int(
            (repetitions / 10 * 30) +  # 30% weight on repetitions
            ((easiness_factor - 1.3) / 1.2 * 35) +  # 35% weight on E-Factor
            (success_rate * 35)  # 35% weight on success rate
        ))

        return is_mastered, mastery_percentage
