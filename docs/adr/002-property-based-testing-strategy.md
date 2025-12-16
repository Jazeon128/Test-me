# ADR-002: Adopt Property-Based Testing with Hypothesis

## Status

Accepted

## Date

2024-11-15

## Context

The Test Me platform has complex algorithmic components (SM-2 spaced repetition, question generation, parsing) that need thorough testing. Traditional example-based unit tests have limitations:

- **Limited coverage**: Only test specific examples, missing edge cases
- **Maintenance burden**: Many tests needed to cover input space
- **False confidence**: Passing tests don't guarantee correctness across all inputs
- **Regression detection**: May miss bugs in untested input combinations

Testing approaches considered:

1. **Example-based unit tests only**: Traditional approach with hand-written test cases
2. **Fuzzing**: Random input generation without property validation
3. **Property-based testing**: Generate inputs and validate universal properties
4. **Formal verification**: Mathematical proofs of correctness
5. **Mutation testing**: Verify test suite quality by introducing bugs

Key requirements:
- Validate algorithmic correctness across wide input ranges
- Catch edge cases automatically
- Maintain test suite efficiency
- Support deterministic test reproduction
- Integrate with existing pytest infrastructure

## Decision

We will adopt **property-based testing using Hypothesis** as a core testing strategy, complementing traditional unit and integration tests.

### Test Pyramid Distribution

- **Property-Based Tests**: 20% (critical algorithms and data validation)
- **Unit Tests**: 50% (individual functions and classes)
- **Integration Tests**: 25% (API endpoints and database interactions)
- **End-to-End Tests**: 5% (critical user flows)

### Property-Based Testing Scope

Apply property-based testing to:

1. **SM-2 Algorithm**: Validate mathematical properties and invariants
2. **Question Generator**: Ensure well-formed questions from any input
3. **Parsers**: Validate parsing correctness across document types
4. **Error Handling**: Ensure graceful degradation with invalid inputs
5. **Performance**: Validate time/memory bounds across input sizes

### Hypothesis Configuration

```python
from hypothesis import settings, HealthCheck

# Development profile: Fast feedback
settings.register_profile("dev", max_examples=100, deadline=None)

# CI profile: Thorough validation
settings.register_profile("ci", max_examples=1000, deadline=None)

# Load appropriate profile
settings.load_profile(os.getenv("HYPOTHESIS_PROFILE", "dev"))
```

### Property Annotation Standard

Each property-based test must include a comment linking to the design document:

```python
@given(ef=st.floats(min_value=1.3, max_value=3.0))
def test_easiness_factor_bounds(ef):
    """
    Property 1: Easiness factor bounds invariant
    Validates: Requirements 1.1
    
    For any valid SM-2 inputs, the calculated easiness factor
    should always be >= 1.3
    """
    # Test implementation
```

## Consequences

### Positive Consequences

- **Better coverage**: Automatically tests thousands of input combinations
- **Edge case discovery**: Finds bugs in corner cases we wouldn't think to test
- **Regression prevention**: Hypothesis database remembers failing examples
- **Shrinking**: Automatically minimizes failing examples for easier debugging
- **Documentation**: Properties serve as executable specifications
- **Confidence**: Mathematical properties provide stronger correctness guarantees
- **Efficiency**: One property test replaces dozens of example tests
- **Reproducibility**: Failing tests can be reproduced with saved examples

### Negative Consequences

- **Learning curve**: Team needs to learn property-based testing concepts
- **Slower tests**: Property tests run more examples than unit tests
- **Complex strategies**: Generating valid test data can be challenging
- **Flaky tests**: Randomness can cause intermittent failures if not managed
- **Debugging difficulty**: Generated inputs may be complex to understand
- **Not universal**: Some behaviors are better tested with examples

### Neutral Consequences

- **Test organization**: Need separate directory for property tests
- **CI configuration**: Different profiles for local vs CI execution
- **Hypothesis database**: Need to commit `.hypothesis/` directory
- **Strategy maintenance**: Custom strategies need updates with model changes

## Implementation Notes

### Directory Structure

```
backend/tests/
├── property/                          # Property-based tests
│   ├── test_sm2_properties.py        # SM-2 algorithm properties
│   ├── test_question_generator_properties.py
│   ├── test_error_handling_properties.py
│   ├── test_performance_properties.py
│   └── test_integration_properties.py
├── unit/                              # Traditional unit tests
├── integration/                       # Integration tests
└── conftest.py                        # Shared fixtures
```

### Custom Strategies

Define reusable strategies for domain objects:

```python
from hypothesis import strategies as st

@st.composite
def user_progress_strategy(draw):
    """Generate valid UserProgress states"""
    return {
        'easiness_factor': draw(st.floats(min_value=1.3, max_value=3.0)),
        'interval': draw(st.integers(min_value=0, max_value=365)),
        'repetitions': draw(st.integers(min_value=0, max_value=20)),
        'times_correct': draw(st.integers(min_value=0, max_value=100)),
        'times_incorrect': draw(st.integers(min_value=0, max_value=100))
    }

@st.composite
def question_strategy(draw):
    """Generate valid question structures"""
    return {
        'question_text': draw(st.text(min_size=10, max_size=500)),
        'options': draw(st.lists(
            st.builds(dict,
                option=st.sampled_from(['A', 'B', 'C', 'D']),
                text=st.text(min_size=5, max_size=200)
            ),
            min_size=4, max_size=4
        )),
        'correct_answer': draw(st.sampled_from(['A', 'B', 'C', 'D'])),
        'explanation': draw(st.text(min_size=20, max_size=1000)),
        'difficulty': draw(st.sampled_from(['easy', 'medium', 'hard']))
    }
```

### Running Property Tests

```bash
# Local development (100 examples)
pytest tests/property/

# CI environment (1000 examples)
HYPOTHESIS_PROFILE=ci pytest tests/property/

# Run specific property test
pytest tests/property/test_sm2_properties.py::test_easiness_factor_bounds

# Reproduce a specific failure
pytest tests/property/ --hypothesis-seed=12345
```

### Hypothesis Database

The `.hypothesis/` directory stores:
- **examples/**: Failing examples for regression testing
- **tmp/**: Temporary files during test execution
- **unicode_data/**: Unicode normalization data

This directory should be committed to version control to ensure failing examples are preserved.

### Integration with CI

```yaml
# .github/workflows/test.yml
test-property:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v3
    - name: Run property tests
      run: |
        pytest tests/property/ \
          --hypothesis-profile=ci \
          --hypothesis-show-statistics \
          -v
```

### Best Practices

1. **Start simple**: Begin with basic properties, add complexity gradually
2. **Constrain inputs**: Use appropriate strategies to generate valid data only
3. **Test one property**: Each test should validate a single property
4. **Use assume()**: Filter out invalid inputs rather than generating perfect data
5. **Shrink effectively**: Ensure strategies shrink to minimal failing examples
6. **Document properties**: Link each test to design document properties
7. **Balance coverage**: Don't replace all unit tests, use strategically

### When to Use Property-Based Testing

**Good candidates:**
- Algorithms with mathematical properties (SM-2, sorting, parsing)
- Data validation and transformation
- Serialization/deserialization (round-trip properties)
- Error handling with invalid inputs
- Performance bounds across input sizes

**Poor candidates:**
- UI interactions and rendering
- External API integrations (use mocks)
- Database schema migrations
- Configuration and setup code
- Business logic with complex rules

## References

- [Hypothesis Documentation](https://hypothesis.readthedocs.io/)
- [Property-Based Testing with Python](https://hypothesis.works/)
- [Design Document: Testing Strategy](../specs/codebase-quality-improvements/design.md#testing-strategy)
- [Requirements: Testing Coverage](../specs/codebase-quality-improvements/requirements.md#requirement-1)
- [Property-Based Testing: What, Why, and How](https://www.hillelwayne.com/post/pbt-101/)
