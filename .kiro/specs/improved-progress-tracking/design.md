# Design Document: Improved Progress Tracking

## Overview

This design implements real-time progress tracking for question generation, addressing the current limitation where the progress bar jumps to 30% and remains static until completion. The solution introduces a callback-based progress reporting mechanism that provides granular updates as each question is generated, along with descriptive status messages and question counters.

The design focuses on three key improvements:
1. **Granular Progress Updates**: Progress increments smoothly as each question completes (not just at batch boundaries)
2. **Question Counter Display**: Shows "Generating question X of Y" to give users detailed visibility
3. **Accurate Progress Calculation**: Allocates progress percentages across parsing (10%), generation (70%), and saving (20%)

## Architecture

### Component Interaction Flow

```
Frontend (Upload Page)
    ↓ polls every 500ms
Backend API (/api/progress/{job_id})
    ↓ queries
GenerationStatus (Database)
    ↑ updated by
process_document (Background Task)
    ↓ calls with callback
QuestionGenerator.generate_questions()
    ↓ invokes after each question
progress_callback(question_num)
    ↓ updates
GenerationStatus (Database)
```

### Key Design Decisions

1. **Callback-Based Progress Reporting**: The `QuestionGenerator` accepts an optional `progress_callback` parameter that gets invoked after each individual question is generated. This allows the background task to update the database in real-time.

2. **Database-Centric Progress Tracking**: All progress updates are persisted to the `GenerationStatus` table immediately, ensuring the frontend can poll for current status without requiring WebSocket connections.

3. **Progress Allocation Formula**: 
   - Parsing: 10% (progress = 10)
   - Generation: 70% (progress = 20 + (questions_completed / total_questions * 70))
   - Saving: 20% (progress = 90 → 100)

4. **Monotonic Progress**: Progress values are designed to never decrease, providing a consistent user experience.

## Components and Interfaces

### 1. QuestionGenerator (Modified)

**File**: `backend/app/services/ai/question_generator.py`

**Changes**:
- Add `progress_callback` parameter to `generate_questions()` method
- Invoke callback after each question is generated (not just after batches)
- Callback signature: `progress_callback(current_question: int, total_questions: int) -> None`

**Interface**:
```python
class QuestionGenerator:
    def generate_questions(
        self,
        parsed_doc: ParsedDocument,
        num_questions: int = 10,
        difficulty: str = "mixed",
        custom_prompt: Optional[str] = None,
        example_questions: Optional[List[Dict]] = None,
        progress_callback: Optional[Callable[[int, int], None]] = None
    ) -> List[Dict]:
        """
        Generate questions with optional progress reporting.
        
        Args:
            progress_callback: Optional callback invoked as (current, total) 
                             after each question completes
        """
```

### 2. GenerationStatus Model (Modified)

**File**: `backend/app/models/generation_status.py`

**Changes**:
- Add `current_question` field (Integer, default=0)
- Add `total_questions` field (Integer, default=0)
- Update `to_dict()` to include new fields

**Schema**:
```python
class GenerationStatus(Base):
    # ... existing fields ...
    current_question = Column(Integer, default=0)
    total_questions = Column(Integer, default=0)
```

### 3. process_document Background Task (Modified)

**File**: `backend/app/api/documents.py`

**Changes**:
- Define progress callback function that updates `GenerationStatus`
- Pass callback to `QuestionGenerator.generate_questions()`
- Update progress calculation to use the formula: `20 + (current / total * 70)`
- Update `current_step` with "Generating question X of Y" format

**Progress Callback Implementation**:
```python
def progress_callback(current: int, total: int):
    if gen_status:
        gen_status.current_question = current
        gen_status.total_questions = total
        # Calculate progress: 20% base + (70% * completion ratio)
        progress_pct = 20 + int((current / total) * 70)
        gen_status.progress = min(progress_pct, 90)  # Cap at 90 before saving
        gen_status.current_step = f"Generating question {current} of {total}"
        db.commit()
```

### 4. Frontend Progress Display (Modified)

**File**: `frontend/src/pages/Upload.jsx` (or equivalent)

**Changes**:
- Display `current_question` and `total_questions` from status response
- Show question counter: "Generating question {current} of {total}"
- Update progress bar to reflect granular progress values

## Data Models

### GenerationStatus (Updated)

```python
{
    "job_id": "uuid-string",
    "deck_id": 123,
    "status": "processing",  # pending, processing, completed, failed
    "progress": 45,  # 0-100
    "current_step": "Generating question 3 of 10",
    "current_question": 3,  # NEW FIELD
    "total_questions": 10,  # NEW FIELD
    "logs": [...],
    "error_message": null,
    "total_documents": 1,
    "total_questions_requested": 10,
    "total_questions_generated": 0,
    "created_at": "2024-01-01T00:00:00Z",
    "started_at": "2024-01-01T00:00:05Z",
    "completed_at": null
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Progress Monotonicity
*For any* sequence of progress updates during question generation, each progress value should be greater than or equal to the previous value (progress never decreases).
**Validates: Requirements 3.5**

### Property 2: Progress Calculation Formula
*For any* number of completed questions and total questions, the calculated progress should equal `20 + (questions_completed / total_questions * 70)` rounded to the nearest integer, and should never exceed 90 during generation.
**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

### Property 3: Question Counter Accuracy
*For any* progress update during generation, the `current_question` field should accurately reflect the number of questions completed, and `total_questions` should match the requested count.
**Validates: Requirements 2.1, 2.2, 2.5**

### Property 4: Status Message Format
*For any* question number X and total Y during generation, the status message should follow the format "Generating question X of Y".
**Validates: Requirements 2.3, 5.3**

### Property 5: Progress Callback Invocation
*For any* question generated when a progress callback is provided, the callback should be invoked exactly once with the correct question number.
**Validates: Requirements 4.1, 4.2, 4.4**

### Property 6: Database Persistence
*For any* progress update, the new progress value should be immediately persisted to the database and retrievable via the status API.
**Validates: Requirements 1.5**

### Property 7: Callback Optional Behavior
*For any* question generation request without a progress callback, the system should complete successfully without errors.
**Validates: Requirements 4.5** (edge case)

## Error Handling

### Callback Failures

If the progress callback raises an exception:
- Log the error but continue question generation
- Don't let callback failures break the generation process
- Ensure at least milestone progress updates (10%, 20%, 90%, 100%) succeed

### Database Update Failures

If progress updates fail to persist:
- Log the error
- Continue generation (don't fail the entire job)
- Ensure final status (completed/failed) is always persisted

### Progress Calculation Edge Cases

- **Zero questions requested**: Handle gracefully, don't divide by zero
- **More questions generated than requested**: Cap progress at 90% during generation
- **Callback invoked out of order**: Use max() to ensure monotonicity

## Testing Strategy

### Unit Tests

- Test progress calculation formula with various question counts (1, 5, 10, 100)
- Test status message formatting with different question numbers
- Test callback invocation with mock callbacks
- Test graceful handling when callback is None
- Test database persistence of new fields

### Property-Based Tests

Property-based tests will use **Hypothesis** (Python) to verify universal properties across many randomly generated inputs.

**Property 1: Progress Monotonicity**
- Generate random sequences of question completions
- Verify each progress value >= previous value
- **Feature: improved-progress-tracking, Property 1: Progress Monotonicity**

**Property 2: Progress Calculation Formula**
- Generate random (completed, total) pairs
- Verify formula: `20 + (completed / total * 70)`
- Verify result is integer and <= 90
- **Feature: improved-progress-tracking, Property 2: Progress Calculation Formula**

**Property 3: Question Counter Accuracy**
- Generate random question counts
- Simulate progress updates
- Verify current_question and total_questions are accurate
- **Feature: improved-progress-tracking, Property 3: Question Counter Accuracy**

**Property 4: Status Message Format**
- Generate random (X, Y) pairs
- Verify message matches "Generating question X of Y"
- **Feature: improved-progress-tracking, Property 4: Status Message Format**

**Property 5: Progress Callback Invocation**
- Generate random question counts
- Track callback invocations
- Verify callback called once per question with correct numbers
- **Feature: improved-progress-tracking, Property 5: Progress Callback Invocation**

**Property 6: Database Persistence**
- Generate random progress updates
- Verify each update is persisted and retrievable
- **Feature: improved-progress-tracking, Property 6: Database Persistence**

Each property-based test will run a minimum of 100 iterations to ensure comprehensive coverage across the input space.

## Implementation Notes

### Batch vs Individual Question Reporting

The current `QuestionGenerator` generates questions in batches (e.g., 5-10 questions per AI API call). To provide per-question progress:

1. **Option A (Recommended)**: Report progress after each question in the batch is parsed from the AI response
2. **Option B**: Make smaller batch sizes (1-2 questions per call) for more granular updates

We'll use Option A to minimize API calls while still providing granular progress.

### Progress Update Frequency

- Update database after each question completes
- Frontend polls every 500ms (existing behavior)
- This provides smooth visual progress without overwhelming the database

### Migration

A database migration is required to add `current_question` and `total_questions` columns to the `generation_status` table.

```python
# Migration: Add progress tracking fields
op.add_column('generation_status', sa.Column('current_question', sa.Integer(), nullable=True, server_default='0'))
op.add_column('generation_status', sa.Column('total_questions', sa.Integer(), nullable=True, server_default='0'))
```
