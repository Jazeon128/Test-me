# Requirements Document

## Introduction

This feature improves the progress tracking and user feedback during question generation. Currently, the progress bar jumps to 30% immediately when generation starts and doesn't move until completion, providing poor user experience. Users cannot see which question is being generated or track real-time progress through the AI generation phase.

Additionally, this spec addresses a critical bug where question generation fails with `'Deck' object has no attribute 'test_questions'` due to incorrect relationship references in the codebase.

## Glossary

- **Progress Bar**: Visual indicator showing completion percentage of question generation
- **Question Generator**: AI service that creates flashcard questions from documents
- **Generation Status**: Database record tracking the state of an ongoing generation job
- **Real-time Progress**: Incremental progress updates as each question is generated
- **Question Counter**: Display showing current question number being processed (e.g., "3/10")

## Requirements

### Requirement 1

**User Story:** As a user generating questions, I want to see real-time progress updates, so that I know the system is working and can estimate completion time.

#### Acceptance Criteria

1. WHEN question generation starts THEN the System SHALL display an initial progress of 10% for document parsing
2. WHEN document parsing completes THEN the System SHALL update progress to 20%
3. WHEN each individual question is generated THEN the System SHALL increment progress proportionally between 20% and 90%
4. WHEN all questions are saved to the database THEN the System SHALL update progress to 100%
5. WHEN progress updates occur THEN the System SHALL persist the progress value to the database immediately

### Requirement 2

**User Story:** As a user generating questions, I want to see which question number is currently being worked on, so that I have detailed visibility into the generation process.

#### Acceptance Criteria

1. WHEN question generation is in progress THEN the System SHALL display the current question number being generated
2. WHEN question generation is in progress THEN the System SHALL display the total number of questions requested
3. WHEN displaying question progress THEN the System SHALL use the format "Generating question X of Y"
4. WHEN each question completes THEN the System SHALL update the displayed question counter immediately
5. WHEN the generation status is queried THEN the System SHALL return both current_question and total_questions fields

### Requirement 3

**User Story:** As a user, I want the progress bar to move smoothly and accurately reflect actual work being done, so that I can trust the progress indicator.

#### Acceptance Criteria

1. WHEN calculating progress percentage THEN the System SHALL allocate 10% for parsing, 70% for generation, and 20% for saving
2. WHEN generating multiple questions THEN the System SHALL divide the 70% generation allocation evenly across all questions
3. WHEN a question completes THEN the System SHALL calculate progress as: 20 + (questions_completed / total_questions * 70)
4. WHEN progress is calculated THEN the System SHALL round to the nearest integer percentage
5. WHEN progress updates THEN the System SHALL ensure progress never decreases

### Requirement 4

**User Story:** As a developer, I want the question generator to report progress after each question, so that the backend can update the status in real-time.

#### Acceptance Criteria

1. WHEN the Question Generator generates a batch of questions THEN the System SHALL report progress after each individual question completes
2. WHEN progress is reported THEN the System SHALL include the question number just completed
3. WHEN the Question Generator is initialized THEN the System SHALL accept a progress callback function parameter
4. WHEN a question completes THEN the System SHALL invoke the progress callback with current question number
5. WHEN no progress callback is provided THEN the System SHALL continue to function normally without errors

### Requirement 5

**User Story:** As a user, I want to see descriptive status messages during generation, so that I understand what phase of the process is currently executing.

#### Acceptance Criteria

1. WHEN document parsing starts THEN the System SHALL display "Parsing document"
2. WHEN question generation starts THEN the System SHALL display "Generating question 1 of N"
3. WHEN each subsequent question starts THEN the System SHALL update to "Generating question X of N"
4. WHEN saving questions starts THEN the System SHALL display "Saving questions to database"
5. WHEN generation completes THEN the System SHALL display "Complete"
