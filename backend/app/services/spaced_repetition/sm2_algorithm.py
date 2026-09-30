from datetime import datetime, timezone, timedelta
from typing import Tuple, Optional
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
    timestamp: Optional[datetime] = None

    def __post_init__(self) -> None:
        if self.timestamp is None:
            self.timestamp = datetime.now(timezone.utc).replace(tzinfo=None)


class SM2Algorithm:
    """
    SuperMemo 2 (SM-2) Spaced Repetition Algorithm

    This is the algorithm used by Anki and other spaced repetition systems for scheduling
    card reviews. The algorithm optimizes learning by scheduling reviews at increasing
    intervals based on how well the learner recalls the information.

    Core Concepts:
    --------------
    - **Easiness Factor (EF)**: A multiplier (1.3 to 2.5+) that represents how "easy" a card is.
      Higher values mean longer intervals between reviews.
    - **Interval**: Number of days until the next review.
    - **Repetitions**: Count of consecutive correct answers.
    - **Quality**: Rating of recall quality (0-5 scale).

    Algorithm Flow:
    ---------------
    1. After each review, calculate a new EF based on the quality rating
    2. If quality < 3 (incorrect): Reset repetitions to 0, set interval to 1 day
    3. If quality >= 3 (correct): Increment repetitions, calculate new interval
       - First correct answer: 1 day
       - Second correct answer: 6 days
       - Subsequent: previous_interval * EF

    Example Usage:
    --------------
    ```python
    from datetime import datetime, timezone
    from app.services.spaced_repetition.sm2_algorithm import SM2Algorithm, ReviewResult

    # Initial state for a new card
    easiness_factor = 2.5
    interval = 0
    repetitions = 0

    # User answers correctly with good recall
    quality = ReviewResult.CORRECT_MEDIUM

    # Calculate next review parameters
    new_ef, new_interval, new_reps, next_date = SM2Algorithm.calculate_next_review(
        easiness_factor=easiness_factor,
        interval=interval,
        repetitions=repetitions,
        quality=quality,
        time_taken_seconds=15.0
    )

    print(f"Next review in {new_interval} days")
    print(f"New easiness factor: {new_ef}")
    ```

    Reference:
    ----------
    https://www.supermemo.com/en/archives1990-2015/english/ol/sm2

    Notes:
    ------
    - The algorithm includes a time penalty: if the user takes too long to answer,
      the quality score is reduced by 1.
    - The EF is bounded at a minimum of 1.3 to prevent cards from becoming too difficult.
    - Mastery is determined by a combination of repetitions, EF, and success rate.
    """

    @staticmethod
    def calculate_next_review(
        easiness_factor: float,
        interval: int,
        repetitions: int,
        quality: ReviewResult,
        time_taken_seconds: Optional[float] = None,
        time_limit_seconds: float = 30.0,
        apply_time_penalty: bool = True,
    ) -> Tuple[float, int, int, datetime]:
        """
        Calculate the next review parameters based on SM-2 algorithm.

        This is the core method of the SM-2 algorithm. It takes the current state of a card
        and the quality of the user's recall, then calculates when the card should be reviewed
        next and updates the card's difficulty parameters.

        The algorithm uses the following formula for updating the easiness factor:
        EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))

        Where:
        - EF' is the new easiness factor
        - EF is the current easiness factor
        - q is the quality rating (0-5)

        Args:
            easiness_factor: Current E-Factor (1.3 - 2.5+). Higher values indicate easier cards
                that can be reviewed less frequently.
            interval: Current interval in days. This is the number of days since the last review.
            repetitions: Number of consecutive correct answers. Reset to 0 on incorrect answers.
            quality: Quality of the answer (ReviewResult enum). Values:
                - 0 (COMPLETE_BLACKOUT): Complete failure to recall
                - 1 (INCORRECT_HARD): Incorrect, but remembered on seeing answer
                - 2 (INCORRECT_EASY): Incorrect, but seemed easy on seeing answer
                - 3 (CORRECT_HARD): Correct, but difficult recall
                - 4 (CORRECT_MEDIUM): Correct with hesitation
                - 5 (PERFECT): Perfect recall
            time_taken_seconds: Time taken to answer in seconds (optional). If provided and
                exceeds time_limit_seconds, the quality score is reduced by 1.
            time_limit_seconds: Maximum time considered acceptable (default 30s). Used to
                apply a time penalty if the user takes too long.
            apply_time_penalty: Whether to reduce quality for slow timed answers.

        Returns:
            Tuple of (new_easiness_factor, new_interval, new_repetitions, next_review_date):
            - new_easiness_factor: Updated EF value (minimum 1.3)
            - new_interval: Days until next review (1 for first correct, 6 for second, then EF * previous)
            - new_repetitions: Updated consecutive correct count (0 if incorrect, incremented if correct)
            - next_review_date: Calculated datetime for the next review

        Example:
            >>> from datetime import datetime, timezone
            >>> ef, interval, reps, next_date = SM2Algorithm.calculate_next_review(
            ...     easiness_factor=2.5,
            ...     interval=0,
            ...     repetitions=0,
            ...     quality=ReviewResult.CORRECT_MEDIUM,
            ...     time_taken_seconds=15.0
            ... )
            >>> print(f"Review again in {interval} days with EF={ef:.2f}")
            Review again in 1 days with EF=2.36
        """
        # Adjust quality based on time taken (if provided)
        adjusted_quality = quality.value
        if (
            apply_time_penalty
            and time_taken_seconds is not None
            and time_taken_seconds > time_limit_seconds
        ):
            # If took too long, reduce quality by 1 (but not below 0)
            adjusted_quality = max(0, adjusted_quality - 1)

        # Calculate new E-Factor
        # EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
        new_ef = easiness_factor + (
            0.1 - (5 - adjusted_quality) * (0.08 + (5 - adjusted_quality) * 0.02)
        )

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
        next_review_date = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=new_interval)

        return new_ef, new_interval, new_repetitions, next_review_date

    @staticmethod
    def determine_quality_from_attempt(
        correct: bool, time_taken_seconds: float, time_limit_seconds: float = 30.0
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
        return datetime.now(timezone.utc).replace(tzinfo=None) >= next_review_date

    @staticmethod
    def calculate_mastery_level(
        repetitions: int, easiness_factor: float, times_correct: int, times_incorrect: int
    ) -> Tuple[bool, int]:
        """
        Determine if a question is mastered and calculate mastery percentage.

        A question is considered "mastered" when the learner has demonstrated consistent
        and easy recall over multiple reviews. This method uses three criteria:

        Mastery Criteria:
        -----------------
        1. At least 5 consecutive correct answers (repetitions >= 5)
        2. High easiness factor (EF >= 2.5), indicating the card is easy
        3. High success rate (>= 80% correct overall)

        All three criteria must be met for a question to be considered mastered.

        Mastery Percentage Calculation:
        --------------------------------
        The mastery percentage (0-100) is a weighted combination of:
        - 30% weight on repetitions (normalized to 10 repetitions = 100%)
        - 35% weight on easiness factor (normalized: 1.3 = 0%, 2.5 = 100%)
        - 35% weight on success rate (correct / total attempts)

        Args:
            repetitions: Consecutive correct answers. Higher values indicate consistent recall.
            easiness_factor: Current E-Factor (1.3 - 2.5+). Higher values indicate easier recall.
            times_correct: Total number of correct answers across all attempts.
            times_incorrect: Total number of incorrect answers across all attempts.

        Returns:
            Tuple of (is_mastered, mastery_percentage):
            - is_mastered: Boolean indicating if all mastery criteria are met
            - mastery_percentage: Integer 0-100 representing overall mastery level

        Example:
            >>> is_mastered, percentage = SM2Algorithm.calculate_mastery_level(
            ...     repetitions=6,
            ...     easiness_factor=2.6,
            ...     times_correct=8,
            ...     times_incorrect=1
            ... )
            >>> print(f"Mastered: {is_mastered}, Level: {percentage}%")
            Mastered: True, Level: 87%

        Notes:
            - A question can have a high mastery percentage without being "mastered"
              if it doesn't meet all three criteria.
            - The mastery percentage is capped at 100%.
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
        mastery_percentage = min(
            100,
            int(
                (repetitions / 10 * 30)
                + ((easiness_factor - 1.3) / 1.2 * 35)  # 30% weight on repetitions
                + (success_rate * 35)  # 35% weight on E-Factor  # 35% weight on success rate
            ),
        )

        return is_mastered, mastery_percentage
