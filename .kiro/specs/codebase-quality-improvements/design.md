# Design Document

## Overview

This design document outlines a comprehensive approach to improving the Test Me learning platform's code quality, testing coverage, architecture consistency, and developer experience. The improvements are structured to be incremental and non-breaking, allowing the platform to continue operating while enhancements are implemented.

The design focuses on five key pillars:
1. **Testing Excellence**: Comprehensive unit, integration, and property-based testing
2. **Code Quality**: Automated linting, formatting, and type checking
3. **Architecture Consistency**: Resolving naming conflicts and establishing clear patterns
4. **Developer Experience**: Improved documentation, tooling, and environment setup
5. **Observability**: Monitoring, logging, and performance tracking

## Architecture

### Current Architecture

The Test Me platform follows a clean layered architecture:

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend                        │
│              (Vite, Tailwind, React Router)             │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP/REST
┌────────────────────▼────────────────────────────────────┐
│                  FastAPI Backend                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │           API Layer (Routers)                     │  │
│  │  documents | questions | progress | decks | ...   │  │
│  └──────────────────┬───────────────────────────────┘  │
│  ┌──────────────────▼───────────────────────────────┐  │
│  │         Services Layer                            │  │
│  │  AI | Parsers | Spaced Repetition | Export       │  │
│  └──────────────────┬───────────────────────────────┘  │
│  ┌──────────────────▼───────────────────────────────┐  │
│  │         Models Layer (SQLAlchemy ORM)            │  │
│  │  Document | Question | UserProgress | Test       │  │
│  └──────────────────┬───────────────────────────────┘  │
│  ┌──────────────────▼───────────────────────────────┐  │
│  │         Database Layer (SQLite)                   │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Proposed Testing Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Test Pyramid                           │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │         E2E Tests (Playwright)                  │    │
│  │  Full user flows, browser automation            │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │      Integration Tests (pytest + TestClient)    │    │
│  │  API endpoints, database interactions           │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │         Unit Tests (pytest + vitest)            │    │
│  │  Individual functions, classes, components      │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │    Property-Based Tests (Hypothesis)            │    │
│  │  Algorithm correctness, data validation         │    │
│  └────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### Code Quality Pipeline

```
Developer Commit
      │
      ▼
┌─────────────────┐
│  Pre-commit     │
│  Hooks          │
│  - Black        │
│  - Flake8       │
│  - isort        │
│  - ESLint       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Local Tests    │
│  - Unit tests   │
│  - Type checks  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Git Push       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  CI Pipeline    │
│  - All tests    │
│  - Coverage     │
│  - Security     │
│  - Build        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Code Review    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Merge          │
└─────────────────┘
```

## Components and Interfaces

### 1. Testing Framework Components

#### Property-Based Testing with Hypothesis

**Purpose**: Validate algorithmic correctness across wide input ranges

**Interface**:
```python
from hypothesis import given, strategies as st
from hypothesis.stateful import RuleBasedStateMachine, rule

# Strategy definitions for generating test data
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

# Property-based test example
@given(progress=user_progress_strategy())
def test_sm2_properties(progress):
    """Test SM-2 algorithm properties"""
    # Test implementation
    pass
```

#### Integration Testing Framework

**Purpose**: Test API endpoints and database interactions

**Interface**:
```python
from fastapi.testclient import TestClient
import pytest

@pytest.fixture
def api_client(db_session):
    """Create test client with database override"""
    # Setup test client
    pass

def test_upload_document_flow(api_client, tmp_path):
    """Test complete document upload flow"""
    # Test implementation
    pass
```

### 2. Code Quality Tools

#### Linting and Formatting Configuration

**Black Configuration** (pyproject.toml):
```toml
[tool.black]
line-length = 100
target-version = ['py39']
include = '\.pyi?$'
extend-exclude = '''
/(
  # directories
  \.eggs
  | \.git
  | \.venv
  | build
  | dist
)/
'''
```

**Flake8 Configuration** (.flake8):
```ini
[flake8]
max-line-length = 100
extend-ignore = E203, W503
exclude = .git,__pycache__,venv,.venv,migrations
```

**MyPy Configuration** (pyproject.toml):
```toml
[tool.mypy]
python_version = "3.9"
warn_return_any = true
warn_unused_configs = true
disallow_untyped_defs = true
```

### 3. Monitoring and Observability

#### Structured Logging

**Interface**:
```python
import structlog

logger = structlog.get_logger()

# Usage
logger.info(
    "question_generated",
    document_id=doc_id,
    num_questions=count,
    duration_seconds=elapsed,
    ai_provider=provider
)
```

#### Metrics Collection

**Interface**:
```python
from prometheus_client import Counter, Histogram

# Define metrics
question_generation_duration = Histogram(
    'question_generation_duration_seconds',
    'Time spent generating questions',
    ['provider', 'difficulty']
)

api_requests_total = Counter(
    'api_requests_total',
    'Total API requests',
    ['method', 'endpoint', 'status']
)
```

### 4. Development Environment

#### Docker Compose Configuration

**Interface**:
```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/testme
    volumes:
      - ./backend:/app
    depends_on:
      - db
  
  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    volumes:
      - ./frontend:/app
  
  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=testme
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

## Data Models

### Testing Data Models

#### Test Fixtures

```python
@dataclass
class TestDocument:
    """Test document fixture"""
    id: int
    filename: str
    content: str
    file_type: str
    sections: List[TestSection]

@dataclass
class TestSection:
    """Test document section"""
    text: str
    page: int
    section: str
    paragraph: int
```

#### Property Test Generators

```python
from hypothesis import strategies as st

# Generate valid questions
question_strategy = st.builds(
    dict,
    question_text=st.text(min_size=10, max_size=500),
    options=st.lists(
        st.builds(
            dict,
            option=st.sampled_from(['A', 'B', 'C', 'D']),
            text=st.text(min_size=5, max_size=200)
        ),
        min_size=4,
        max_size=4
    ),
    correct_answer=st.sampled_from(['A', 'B', 'C', 'D']),
    explanation=st.text(min_size=20, max_size=1000),
    difficulty=st.sampled_from(['easy', 'medium', 'hard'])
)
```

### Configuration Models

#### Environment Configuration

```python
from pydantic import BaseSettings, Field

class TestSettings(BaseSettings):
    """Test environment settings"""
    test_database_url: str = "sqlite:///:memory:"
    test_ai_provider: str = "mock"
    test_upload_dir: str = "/tmp/test_uploads"
    
    class Config:
        env_prefix = "TEST_"
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### SM-2 Algorithm Properties

**Property 1: Easiness factor bounds invariant**
*For any* valid SM-2 algorithm inputs (easiness factor, interval, repetitions, quality score, time taken), the calculated easiness factor should always be greater than or equal to 1.3
**Validates: Requirements 1.1**

**Property 2: Interval monotonicity with correct answers**
*For any* sequence of correct answers (quality >= 3), each successive interval should be greater than or equal to the previous interval
**Validates: Requirements 1.2**

**Property 3: Incorrect answer reset**
*For any* SM-2 state where quality < 3 (incorrect answer), the resulting repetitions should be 0 and interval should be 1
**Validates: Requirements 1.3**

**Property 4: Time penalty application**
*For any* answer where time_taken > time_limit, the effective quality score used in calculations should be reduced by at least 1 compared to the base quality
**Validates: Requirements 1.4**

**Property 5: Mastery calculation determinism**
*For any* set of input parameters (repetitions, easiness_factor, times_correct, times_incorrect), calling calculate_mastery_level multiple times should always return identical results
**Validates: Requirements 1.5**

### Question Generator Properties

**Property 6: Required fields validation**
*For any* parsed question from AI response, if the question is included in the valid results, it must contain all required fields: question_text, options (list of 4), correct_answer, explanation, difficulty
**Validates: Requirements 2.1**

**Property 7: Four options structure**
*For any* generated question, the options list must contain exactly 4 items with labels 'A', 'B', 'C', 'D' in order
**Validates: Requirements 2.2**

**Property 8: Single correct answer**
*For any* generated question, exactly one option must be marked as correct (is_correct=True)
**Validates: Requirements 2.3**

**Property 9: Graceful error handling**
*For any* malformed AI response (invalid JSON, missing fields, wrong types), the parser should return an empty list without raising exceptions
**Validates: Requirements 2.4**

**Property 10: Even section distribution**
*For any* document with N sections and request for K sections (K < N), the selected sections should be distributed with approximately equal spacing (max spacing difference <= 2 indices)
**Validates: Requirements 2.5**

### Error Handling Properties

**Property 11: Question generation error logging**
*For any* error during question generation, the log output must contain document_id, section information, and error message
**Validates: Requirements 4.1**

**Property 12: API error response structure**
*For any* API request that results in an error, the response must be valid JSON with 'detail' field and appropriate HTTP status code (4xx or 5xx)
**Validates: Requirements 4.2**

**Property 13: File upload validation**
*For any* file upload attempt, if the file type is not in the allowed list or size exceeds MAX_UPLOAD_SIZE, the request must be rejected before processing
**Validates: Requirements 4.3**

**Property 14: Database transaction rollback**
*For any* database operation that raises an exception, the transaction must be rolled back and the error must be logged
**Validates: Requirements 4.4**

**Property 15: AI API failure handling**
*For any* AI API call that fails (timeout, invalid key, rate limit), the system must return a clear error message without exposing internal details
**Validates: Requirements 4.5**

### Integration Flow Properties

**Property 16: Anki export validity**
*For any* deck with valid questions, the generated .apkg file must be parseable by the genanki library and contain all questions with their options
**Validates: Requirements 6.3**

**Property 17: Review session selection correctness**
*For any* review session request, the selected questions must prioritize overdue questions (next_review_date <= now) before new questions
**Validates: Requirements 6.4**

**Property 18: Concurrent request safety**
*For any* two concurrent answer submissions for the same question, both should complete successfully and the final state should reflect both submissions
**Validates: Requirements 6.5**

### Performance Properties

**Property 19: Question generation time bounds**
*For any* document section of size S characters, question generation should complete within (S / 1000) * 5 seconds + 10 seconds base time
**Validates: Requirements 8.1**

**Property 20: API response time SLA**
*For any* API endpoint call with valid inputs, the response time should be less than 2 seconds for 95% of requests
**Validates: Requirements 8.3**

**Property 21: Memory usage bounds for parsing**
*For any* document being parsed, peak memory usage should not exceed 5x the document file size
**Validates: Requirements 8.4**

### Observability Properties

**Property 22: Request logging completeness**
*For any* API request processed, the logs must contain request_id, method, path, duration_ms, and status_code
**Validates: Requirements 10.1**

**Property 23: AI usage tracking**
*For any* question generation request, the system must record provider, model, token_count, and cost_estimate in metrics
**Validates: Requirements 10.2**

**Property 24: Error context capture**
*For any* exception raised, the error log must include stack_trace, timestamp, user_context, and request_context
**Validates: Requirements 10.3**

**Property 25: Structured log format**
*For any* log entry emitted, it must be valid JSON with fields: timestamp, level, message, and context
**Validates: Requirements 10.5**

## Error Handling

### Error Categories

1. **Validation Errors** (400 Bad Request)
   - Invalid file types
   - File size exceeded
   - Missing required fields
   - Invalid parameter values

2. **Authentication/Authorization Errors** (401/403)
   - Invalid API keys
   - Insufficient permissions

3. **Resource Not Found** (404)
   - Question not found
   - Document not found
   - Deck not found

4. **External Service Errors** (502/503)
   - AI API failures
   - Database connection issues
   - Timeout errors

5. **Internal Server Errors** (500)
   - Unexpected exceptions
   - Database constraint violations
   - File system errors

### Error Response Format

All API errors should follow this structure:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable error message",
    "details": {
      "field": "specific_field",
      "reason": "why it failed"
    },
    "request_id": "uuid-for-tracking"
  }
}
```

### Error Logging Strategy

```python
import structlog

logger = structlog.get_logger()

try:
    # Operation
    pass
except SpecificException as e:
    logger.error(
        "operation_failed",
        operation="question_generation",
        document_id=doc_id,
        error_type=type(e).__name__,
        error_message=str(e),
        stack_trace=traceback.format_exc(),
        exc_info=True
    )
    raise HTTPException(
        status_code=500,
        detail={
            "code": "GENERATION_FAILED",
            "message": "Failed to generate questions",
            "request_id": request_id
        }
    )
```

## Testing Strategy

### Test Pyramid Distribution

- **Property-Based Tests**: 20% (critical algorithms and data validation)
- **Unit Tests**: 50% (individual functions and classes)
- **Integration Tests**: 25% (API endpoints and database interactions)
- **End-to-End Tests**: 5% (critical user flows)

### Property-Based Testing Approach

**Framework**: Hypothesis for Python

**Configuration**:
```python
from hypothesis import settings, HealthCheck

# Global test settings
settings.register_profile("ci", max_examples=1000, deadline=None)
settings.register_profile("dev", max_examples=100, deadline=None)
settings.load_profile("dev")
```

**Test Organization**:
```
backend/tests/
├── property/
│   ├── test_sm2_properties.py
│   ├── test_question_generator_properties.py
│   ├── test_error_handling_properties.py
│   └── test_performance_properties.py
├── unit/
│   ├── test_sm2_algorithm.py (existing)
│   ├── test_models.py (existing)
│   └── ...
├── integration/
│   ├── test_api_endpoints.py (existing)
│   └── test_user_flows.py (new)
└── e2e/
    └── test_critical_flows.py (new)
```

**Property Test Example**:
```python
from hypothesis import given, strategies as st
from hypothesis.stateful import RuleBasedStateMachine, rule, invariant

@given(
    ef=st.floats(min_value=1.3, max_value=3.0),
    interval=st.integers(min_value=0, max_value=365),
    reps=st.integers(min_value=0, max_value=20),
    quality=st.sampled_from(list(ReviewResult))
)
def test_easiness_factor_bounds(ef, interval, reps, quality):
    """Property 1: EF should always be >= 1.3"""
    new_ef, _, _, _ = SM2Algorithm.calculate_next_review(
        easiness_factor=ef,
        interval=interval,
        repetitions=reps,
        quality=quality
    )
    assert new_ef >= 1.3, f"EF {new_ef} is below minimum 1.3"
```

### Unit Testing Standards

- **Coverage Target**: 80% line coverage, 90% for critical paths
- **Test Naming**: `test_<function>_<scenario>_<expected_result>`
- **Fixtures**: Use pytest fixtures for common setup
- **Mocking**: Mock external dependencies (AI APIs, file system)
- **Assertions**: Use descriptive assertion messages

### Integration Testing Standards

- **Database**: Use in-memory SQLite for fast tests
- **API Client**: Use FastAPI TestClient
- **Test Data**: Create minimal fixtures for each test
- **Cleanup**: Ensure tests clean up after themselves
- **Isolation**: Each test should be independent

### End-to-End Testing Standards

- **Framework**: Playwright for browser automation
- **Scope**: Test critical user journeys only
- **Data**: Use dedicated test database
- **Speed**: Run in CI only, not locally by default
- **Reliability**: Implement retry logic for flaky tests

### Test Execution

**Local Development**:
```bash
# Run all tests
pytest

# Run specific test types
pytest tests/unit/
pytest tests/property/
pytest tests/integration/

# Run with coverage
pytest --cov=app --cov-report=html

# Run property tests with more examples
pytest tests/property/ --hypothesis-profile=ci
```

**CI Pipeline**:
```yaml
test:
  script:
    - pytest tests/unit/ tests/property/ --cov=app --cov-report=xml
    - pytest tests/integration/
    - pytest tests/e2e/ --headed=false
  coverage: '/TOTAL.*\s+(\d+%)$/'
```

### Performance Testing

**Benchmarking Framework**: pytest-benchmark

**Example**:
```python
def test_question_generation_performance(benchmark, sample_document):
    """Benchmark question generation speed"""
    result = benchmark(
        generator.generate_questions,
        parsed_doc=sample_document,
        num_questions=10
    )
    
    # Assert performance requirements
    assert benchmark.stats['mean'] < 30.0  # 30 seconds max
```

### Test Data Generation

**Strategy**: Use factories for consistent test data

```python
from factory import Factory, Faker, SubFactory

class DocumentFactory(Factory):
    class Meta:
        model = Document
    
    filename = Faker('file_name', extension='pdf')
    content = Faker('text', max_nb_chars=5000)
    file_type = 'PDF'
    file_size = Faker('random_int', min=1000, max=1000000)

class QuestionFactory(Factory):
    class Meta:
        model = Question
    
    document = SubFactory(DocumentFactory)
    question_text = Faker('sentence')
    explanation = Faker('paragraph')
    difficulty = Faker('random_element', elements=['easy', 'medium', 'hard'])
```

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
- Set up property-based testing framework (Hypothesis)
- Configure code quality tools (Black, Flake8, mypy, ESLint)
- Set up pre-commit hooks
- Create Docker Compose configuration
- Establish CI/CD pipeline structure

### Phase 2: Core Testing (Week 3-4)
- Implement property-based tests for SM-2 algorithm
- Implement property-based tests for question generator
- Add integration tests for critical API flows
- Achieve 80% code coverage baseline

### Phase 3: Architecture Consistency (Week 5)
- Resolve naming inconsistencies (Deck vs Test)
- Standardize API endpoint naming
- Update branding consistently
- Refactor code to follow established patterns

### Phase 4: Observability (Week 6)
- Implement structured logging with structlog
- Add Prometheus metrics
- Create monitoring dashboards
- Set up error tracking

### Phase 5: Documentation (Week 7)
- Enhance API documentation with examples
- Create Architecture Decision Records
- Update README with comprehensive setup guide
- Document all environment variables

### Phase 6: Performance & Polish (Week 8)
- Add performance benchmarks
- Optimize slow queries
- Add database indexes
- Final testing and validation

## Success Metrics

### Code Quality Metrics
- **Test Coverage**: >= 80% line coverage
- **Property Tests**: >= 25 properties implemented
- **Linting**: 0 linting errors in CI
- **Type Coverage**: >= 70% of functions have type hints

### Performance Metrics
- **API Response Time**: p95 < 2 seconds
- **Question Generation**: < 30 seconds for 10 questions
- **Database Queries**: < 100ms for 95% of queries

### Developer Experience Metrics
- **Setup Time**: < 15 minutes from clone to running
- **Test Execution**: < 5 minutes for full test suite
- **CI Pipeline**: < 10 minutes for full pipeline

### Reliability Metrics
- **Test Flakiness**: < 1% flaky test rate
- **Error Rate**: < 0.1% of API requests fail
- **Uptime**: > 99.9% availability

## Migration Strategy

### Backward Compatibility

All changes must maintain backward compatibility:
- Existing API endpoints continue to work
- Database schema changes use migrations
- Configuration changes have sensible defaults
- Deprecated features have 2-version deprecation cycle

### Rollout Plan

1. **Development Environment**: Test all changes locally
2. **Staging Environment**: Deploy and run full test suite
3. **Canary Deployment**: Deploy to 10% of production traffic
4. **Full Deployment**: Roll out to all production traffic
5. **Monitoring**: Watch metrics for 48 hours post-deployment

### Rollback Procedures

Each phase has a rollback plan:
- Database migrations are reversible
- Feature flags control new functionality
- Previous Docker images are retained
- Automated rollback on critical metric degradation

## Dependencies

### New Python Dependencies
- `hypothesis` - Property-based testing
- `pytest-benchmark` - Performance testing
- `structlog` - Structured logging
- `prometheus-client` - Metrics collection
- `factory-boy` - Test data factories
- `faker` - Fake data generation

### New JavaScript Dependencies
- `@playwright/test` - E2E testing
- `vitest` - Fast unit testing
- `@testing-library/react` - Component testing

### Development Tools
- `pre-commit` - Git hooks
- `black` - Python formatting
- `flake8` - Python linting
- `mypy` - Python type checking
- `prettier` - JavaScript formatting

## Risk Mitigation

### Technical Risks

**Risk**: Property-based tests may be slow
**Mitigation**: Configure different profiles for local vs CI, use hypothesis database for reproducibility

**Risk**: Integration tests may be flaky
**Mitigation**: Use in-memory database, implement proper cleanup, add retry logic

**Risk**: Breaking changes during refactoring
**Mitigation**: Comprehensive test coverage before refactoring, feature flags for new behavior

### Process Risks

**Risk**: Team resistance to new tools
**Mitigation**: Gradual rollout, training sessions, clear documentation

**Risk**: Increased CI time
**Mitigation**: Parallel test execution, caching, selective test runs

**Risk**: Maintenance burden of tests
**Mitigation**: Focus on high-value tests, regular test review and cleanup

## Conclusion

This design provides a comprehensive approach to improving the Test Me platform's code quality, testing coverage, and developer experience. The phased implementation allows for incremental progress while maintaining system stability. The focus on property-based testing ensures algorithmic correctness, while the observability improvements enable better production monitoring and debugging.

The success of this initiative will be measured by improved code quality metrics, faster development cycles, and increased confidence in system reliability.
