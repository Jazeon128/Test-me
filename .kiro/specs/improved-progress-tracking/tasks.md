# Implementation Plan

- [x] 1. Add database fields for question tracking




- [x] 1.1 Create database migration for new fields


  - Add `current_question` column to `generation_status` table (Integer, default=0)
  - Add `total_questions` column to `generation_status` table (Integer, default=0)
  - _Requirements: 2.5_

- [x] 1.2 Update GenerationStatus model


  - Add `current_question` field to model class
  - Add `total_questions` field to model class
  - Update `to_dict()` method to include new fields in API response
  - _Requirements: 2.5_

- [x] 1.3 Write property test for database persistence


  - **Property 6: Database Persistence**
  - **Validates: Requirements 1.5**

- [x] 2. Implement progress callback in QuestionGenerator





- [x] 2.1 Add progress_callback parameter to generate_questions()


  - Add optional `progress_callback` parameter with type `Optional[Callable[[int, int], None]]`
  - Update method signature and docstring
  - _Requirements: 4.3_

- [x] 2.2 Invoke callback after each question is generated


  - Modify `_generate_batch_questions()` to track question count
  - Call `progress_callback(current, total)` after each question is parsed from AI response
  - Handle None callback gracefully (no-op if not provided)
  - _Requirements: 4.1, 4.2, 4.4, 4.5_

- [x] 2.3 Write property test for callback invocation


  - **Property 5: Progress Callback Invocation**
  - **Validates: Requirements 4.1, 4.2, 4.4**

- [x] 2.4 Write unit test for callback edge case


  - Test that generation works without callback (None)
  - **Validates: Requirements 4.5**

- [x] 3. Implement progress calculation logic




- [x] 3.1 Create progress calculation utility function


  - Implement formula: `20 + (questions_completed / total_questions * 70)`
  - Round to nearest integer
  - Ensure result never exceeds 90 during generation phase
  - Handle edge case: zero questions (avoid division by zero)
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3.2 Write property test for progress calculation


  - **Property 2: Progress Calculation Formula**
  - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

- [x] 3.3 Write property test for progress monotonicity


  - **Property 1: Progress Monotonicity**
  - **Validates: Requirements 3.5**

- [x] 4. Update process_document background task





- [x] 4.1 Define progress callback function


  - Create callback that updates `gen_status.current_question` and `gen_status.total_questions`
  - Calculate progress using utility function from task 3.1
  - Update `gen_status.progress` with calculated value
  - Update `gen_status.current_step` with formatted message
  - Commit changes to database immediately
  - _Requirements: 1.3, 1.5, 2.1, 2.2, 2.4, 3.3, 5.3_

- [x] 4.2 Pass callback to QuestionGenerator

  - Pass progress callback to `generator.generate_questions()` call
  - Wrap callback in try-except to handle errors gracefully
  - _Requirements: 4.1_

- [x] 4.3 Update milestone progress values

  - Set progress to 10% when parsing starts with message "Parsing document"
  - Set progress to 20% when parsing completes
  - Set progress to 90% when generation completes, before saving
  - Set progress to 100% when saving completes with message "Complete"
  - _Requirements: 1.1, 1.2, 1.4, 5.1, 5.2, 5.4, 5.5_

- [x] 4.4 Write property test for question counter accuracy


  - **Property 3: Question Counter Accuracy**
  - **Validates: Requirements 2.1, 2.2, 2.5**

- [x] 4.5 Write property test for status message format


  - **Property 4: Status Message Format**
  - **Validates: Requirements 2.3, 5.3**


- [x] 5. Update frontend to display granular progress




- [x] 5.1 Update Upload page to show question counter


  - Extract `current_question` and `total_questions` from status response
  - Display "Generating question X of Y" when these fields are present
  - Show question counter below or alongside progress bar
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 5.2 Ensure progress bar reflects granular updates


  - Verify progress bar updates smoothly as progress increments
  - Test with different question counts (1, 5, 10, 20)
  - _Requirements: 1.3, 3.5_

- [x] 6. Run database migration




  - Execute migration to add new columns
  - Verify columns exist with correct defaults
  - Test that existing generation_status records work correctly
  - _Requirements: 2.5_

- [x] 7. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.
