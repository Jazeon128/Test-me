# ADR-001: Use SM-2 Algorithm for Spaced Repetition

## Status

Accepted

## Date

2024-11-01

## Context

The Test Me learning platform needs a spaced repetition algorithm to optimize learning retention and schedule review sessions effectively. Several algorithms exist for spaced repetition:

1. **Leitner System**: Simple box-based system with fixed intervals
2. **SM-2 (SuperMemo 2)**: Calculates intervals based on easiness factor and performance
3. **SM-17+**: More complex modern SuperMemo algorithms
4. **Anki's Modified SM-2**: Variations with additional parameters
5. **FSRS (Free Spaced Repetition Scheduler)**: Modern ML-based approach

Key requirements:
- Must provide scientifically-backed spacing intervals
- Should adapt to individual learner performance
- Must be implementable without complex dependencies
- Should have predictable, testable behavior
- Must support mastery level calculations

Constraints:
- Limited development resources for complex algorithms
- Need for transparent, debuggable logic
- Requirement for property-based testing
- Must work with existing question/answer data model

## Decision

We will implement the **SM-2 (SuperMemo 2) algorithm** as our spaced repetition system.

The SM-2 algorithm calculates the next review interval based on:
- **Easiness Factor (EF)**: Represents how easy the material is (minimum 1.3)
- **Interval**: Days until next review
- **Repetitions**: Number of consecutive correct answers
- **Quality**: User's self-assessment of recall (0-5 scale)

Key algorithm properties:
```python
# Easiness factor update
EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
EF' = max(1.3, EF')

# Interval calculation
if q < 3:  # Incorrect answer
    repetitions = 0
    interval = 1
else:  # Correct answer
    if repetitions == 0:
        interval = 1
    elif repetitions == 1:
        interval = 6
    else:
        interval = previous_interval * EF
```

We will extend SM-2 with:
- **Time penalty**: Reduce quality score if answer takes too long
- **Mastery calculation**: Aggregate metric based on performance history
- **Difficulty levels**: Tag questions as easy/medium/hard for better scheduling

## Consequences

### Positive Consequences

- **Well-documented**: SM-2 has extensive research backing and documentation
- **Proven effectiveness**: Used successfully in SuperMemo and Anki for decades
- **Simple implementation**: Straightforward algorithm with clear mathematical properties
- **Testable**: Deterministic behavior enables comprehensive property-based testing
- **Predictable**: Users can understand why reviews are scheduled
- **No external dependencies**: Can be implemented with standard Python
- **Adaptable**: Easiness factor adjusts to individual learner performance

### Negative Consequences

- **Not state-of-the-art**: Newer algorithms (FSRS, SM-17+) may provide better results
- **Fixed formula**: Less flexible than ML-based approaches
- **Cold start problem**: Initial intervals may not be optimal for all learners
- **No collaborative filtering**: Doesn't leverage data from other users
- **Simplistic quality scale**: 0-5 scale may not capture nuanced performance

### Neutral Consequences

- **Compatibility with Anki**: Similar algorithm makes export/import easier
- **Algorithm transparency**: Users can see exactly how scheduling works
- **Migration path**: Can upgrade to more complex algorithms later if needed

## Implementation Notes

### Core Algorithm Implementation

Located in `backend/app/services/spaced_repetition.py`:

```python
class SM2Algorithm:
    @staticmethod
    def calculate_next_review(
        easiness_factor: float,
        interval: int,
        repetitions: int,
        quality: ReviewResult,
        time_taken: Optional[int] = None,
        time_limit: Optional[int] = None
    ) -> Tuple[float, int, int, datetime]:
        # Implementation details
        pass
```

### Property-Based Tests

Key properties to validate (see `backend/tests/property/test_sm2_properties.py`):

1. **Easiness factor bounds**: EF >= 1.3 for all inputs
2. **Interval monotonicity**: Correct answers increase intervals
3. **Incorrect answer reset**: Quality < 3 resets to interval=1, reps=0
4. **Time penalty**: Exceeding time limit reduces effective quality
5. **Determinism**: Same inputs always produce same outputs

### Extensions

- **Mastery Level**: Calculated from repetitions, EF, and success rate
- **Time Penalty**: Applied when `time_taken > time_limit`
- **Difficulty Adjustment**: Questions tagged with difficulty levels

### Migration Strategy

If we need to upgrade to a more sophisticated algorithm:
1. Keep SM-2 as fallback/baseline
2. Implement new algorithm alongside SM-2
3. A/B test with subset of users
4. Migrate gradually based on performance data
5. Maintain backward compatibility with existing progress data

## References

- [Original SM-2 Algorithm Description](https://www.supermemo.com/en/archives1990-2015/english/ol/sm2)
- [Anki's SM-2 Implementation](https://faqs.ankiweb.net/what-spaced-repetition-algorithm.html)
- [Research on Spaced Repetition](https://www.gwern.net/Spaced-repetition)
- Design Document: `docs/specs/codebase-quality-improvements/design.md`
- Requirements: Section 1 in `docs/specs/codebase-quality-improvements/requirements.md`
