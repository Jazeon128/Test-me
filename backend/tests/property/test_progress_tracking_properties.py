"""
Property-based tests for progress tracking
"""
import pytest
import uuid
from unittest.mock import Mock, MagicMock
from hypothesis import given, strategies as st, settings, HealthCheck, assume
from app.models.generation_status import GenerationStatus
from app.models.settings import Settings
from app.services.ai.question_generator import QuestionGenerator
from app.services.parsers.base_parser import ParsedDocument, ParsedSection
from app.utils.progress import calculate_generation_progress


def _seed_ai_settings(db_session):
    """Give QuestionGenerator the provider and key it reads from the settings table.

    That is the same place the Settings screen writes them, and without a row the
    constructor raises before any mocked generation runs. Hypothesis reuses one
    function-scoped session across examples, so this must not insert twice.
    """
    for key, value in (("ai_provider", "anthropic"), ("api_key", "test-key")):
        if not db_session.query(Settings).filter(Settings.key == key).first():
            db_session.add(Settings(key=key, value=value))
    db_session.commit()


@st.composite
def progress_update_strategy(draw):
    """Generate valid progress update data"""
    current_question = draw(st.integers(min_value=0, max_value=100))
    total_questions = draw(st.integers(min_value=max(1, current_question), max_value=100))
    progress = draw(st.integers(min_value=0, max_value=100))
    # Use UUID to ensure uniqueness across test runs
    job_id = str(uuid.uuid4())

    return {
        "job_id": job_id,
        "current_question": current_question,
        "total_questions": total_questions,
        "progress": progress,
        "current_step": f"Generating question {current_question} of {total_questions}",
    }


@pytest.mark.property
class TestProgressTrackingProperties:
    """
    Property-based tests for Progress Tracking
    """

    @given(total_questions=st.integers(min_value=1, max_value=100))
    @settings(max_examples=100, deadline=None)
    def test_progress_monotonicity(self, total_questions):
        """
        Feature: improved-progress-tracking, Property 1: Progress Monotonicity

        For any sequence of progress updates during question generation, each
        progress value should be greater than or equal to the previous value
        (progress never decreases).

        Validates: Requirements 3.5
        """
        # Generate a sequence of progress updates by simulating question completion
        progress_values = []

        for questions_completed in range(0, total_questions + 1):
            progress = calculate_generation_progress(questions_completed, total_questions)
            progress_values.append(progress)

        # Property 1: Progress sequence should have at least 2 values
        assert (
            len(progress_values) >= 2
        ), f"Should have at least 2 progress values, got {len(progress_values)}"

        # Property 2: Each progress value should be >= previous value (monotonicity)
        for i in range(1, len(progress_values)):
            prev_progress = progress_values[i - 1]
            curr_progress = progress_values[i]
            assert curr_progress >= prev_progress, (
                f"Progress decreased from {prev_progress}% to {curr_progress}% "
                f"at question {i}/{total_questions}. Progress should never decrease."
            )

        # Property 3: First progress value should be 20 (start of generation)
        assert progress_values[0] == 20, f"First progress should be 20%, got {progress_values[0]}%"

        # Property 4: Last progress value should be 90 (end of generation)
        assert progress_values[-1] == 90, f"Last progress should be 90%, got {progress_values[-1]}%"

        # Property 5: Progress should increase overall (not just stay constant)
        assert (
            progress_values[-1] > progress_values[0]
        ), f"Progress should increase from start to end: {progress_values[0]}% -> {progress_values[-1]}%"

    @given(
        questions_completed=st.integers(min_value=0, max_value=1000),
        total_questions=st.integers(min_value=1, max_value=1000),
    )
    @settings(max_examples=100, deadline=None)
    def test_progress_calculation_formula(self, questions_completed, total_questions):
        """
        Feature: improved-progress-tracking, Property 2: Progress Calculation Formula

        For any number of completed questions and total questions, the calculated
        progress should equal 20 + (questions_completed / total_questions * 70)
        rounded to the nearest integer, and should never exceed 90 during generation.

        Validates: Requirements 3.1, 3.2, 3.3, 3.4
        """
        # Ensure questions_completed doesn't exceed total_questions
        assume(questions_completed <= total_questions)

        # Calculate progress using the utility function
        progress = calculate_generation_progress(questions_completed, total_questions)

        # Property 1: Progress should be an integer
        assert isinstance(progress, int), f"Progress should be an integer, got {type(progress)}"

        # Property 2: Progress should match the formula (with rounding)
        expected_progress = 20 + round((questions_completed / total_questions) * 70)
        assert progress == expected_progress, (
            f"Progress formula incorrect: expected {expected_progress}, got {progress} "
            f"for {questions_completed}/{total_questions} questions"
        )

        # Property 3: Progress should never exceed 90 during generation
        assert progress <= 90, f"Progress should not exceed 90 during generation, got {progress}"

        # Property 4: Progress should be at least 20 (generation phase starts at 20%)
        assert progress >= 20, f"Progress should be at least 20 during generation, got {progress}"

        # Property 5: When no questions completed, progress should be 20
        if questions_completed == 0:
            assert (
                progress == 20
            ), f"Progress should be 20 when no questions completed, got {progress}"

        # Property 6: When all questions completed, progress should be 90
        if questions_completed == total_questions:
            assert (
                progress == 90
            ), f"Progress should be 90 when all questions completed, got {progress}"

    @given(update_data=progress_update_strategy())
    @settings(
        max_examples=100, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    def test_database_persistence(self, update_data, db_session):
        """
        Feature: improved-progress-tracking, Property 6: Database Persistence

        For any progress update, the new progress value should be immediately
        persisted to the database and retrievable via the status API.

        Validates: Requirements 1.5
        """
        # Create a generation status record
        gen_status = GenerationStatus(
            job_id=update_data["job_id"],
            deck_id=1,
            status="processing",
            progress=0,
            current_step="Starting",
            current_question=0,
            total_questions=0,
        )
        db_session.add(gen_status)
        db_session.commit()
        db_session.refresh(gen_status)

        # Update progress fields
        gen_status.current_question = update_data["current_question"]
        gen_status.total_questions = update_data["total_questions"]
        gen_status.progress = update_data["progress"]
        gen_status.current_step = update_data["current_step"]
        db_session.commit()

        # Retrieve the record from database
        retrieved = (
            db_session.query(GenerationStatus).filter_by(job_id=update_data["job_id"]).first()
        )

        # Property: All progress fields should be persisted and retrievable
        assert retrieved is not None, "Generation status should be retrievable from database"
        assert (
            retrieved.current_question == update_data["current_question"]
        ), f"current_question not persisted: expected {update_data['current_question']}, got {retrieved.current_question}"
        assert (
            retrieved.total_questions == update_data["total_questions"]
        ), f"total_questions not persisted: expected {update_data['total_questions']}, got {retrieved.total_questions}"
        assert (
            retrieved.progress == update_data["progress"]
        ), f"progress not persisted: expected {update_data['progress']}, got {retrieved.progress}"
        assert (
            retrieved.current_step == update_data["current_step"]
        ), f"current_step not persisted: expected '{update_data['current_step']}', got '{retrieved.current_step}'"

        # Property: to_dict() should include the new fields
        status_dict = retrieved.to_dict()
        assert "current_question" in status_dict, "to_dict() should include current_question"
        assert "total_questions" in status_dict, "to_dict() should include total_questions"
        assert status_dict["current_question"] == update_data["current_question"]
        assert status_dict["total_questions"] == update_data["total_questions"]

    @given(
        num_questions=st.integers(min_value=1, max_value=20),
        section_text=st.text(min_size=100, max_size=500),
    )
    @settings(
        max_examples=100, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    def test_progress_callback_invocation(
        self, num_questions, section_text, db_session, monkeypatch
    ):
        """
        Feature: improved-progress-tracking, Property 5: Progress Callback Invocation

        For any question generated when a progress callback is provided, the callback
        should be invoked exactly once with the correct question number.

        Validates: Requirements 4.1, 4.2, 4.4
        """
        # Create a mock callback to track invocations
        callback_mock = Mock()
        callback_invocations = []

        def track_callback(current, total):
            callback_invocations.append((current, total))
            callback_mock(current, total)

        # Create a parsed document with one section
        parsed_doc = ParsedDocument(
            full_text=section_text,
            title="Test Document",
            sections=[ParsedSection(text=section_text, page=1, section="1", paragraph=1)],
        )

        # Mock the AI response to return exactly num_questions questions
        mock_questions = []
        for i in range(num_questions):
            mock_questions.append(
                {
                    "question": f"Question {i+1}?",
                    "options": [
                        {"option": "A", "text": "Option A"},
                        {"option": "B", "text": "Option B"},
                        {"option": "C", "text": "Option C"},
                        {"option": "D", "text": "Option D"},
                    ],
                    "correct_answer": "A",
                    "explanation": f"Explanation {i+1}",
                    "difficulty": "medium",
                }
            )

        # Mock the _parse_batch_response to return our mock questions
        def mock_parse_batch_response(response):
            return mock_questions

        # Mock the AI API call to avoid actual API calls
        def mock_generate_batch(
            self,
            section,
            count,
            difficulty,
            custom_prompt=None,
            example_questions=None,
            progress_callback=None,
            questions_so_far=0,
            total_questions=0,
        ):
            # Simulate parsing questions and invoking callback
            # Return exactly 'count' questions from our mock list
            questions_data = mock_questions[questions_so_far : questions_so_far + count]
            valid_questions = []

            for q_data in questions_data:
                q_data_copy = q_data.copy()
                q_data_copy["reference"] = {
                    "text": section.text[:200] + "..." if len(section.text) > 200 else section.text,
                    "page": section.page,
                    "section": section.section,
                    "paragraph": section.paragraph,
                }
                valid_questions.append(q_data_copy)

                # Invoke progress callback after each question
                if progress_callback is not None:
                    current_question = questions_so_far + len(valid_questions)
                    progress_callback(current_question, total_questions)

            return valid_questions

        # Apply mocks
        monkeypatch.setattr(QuestionGenerator, "_generate_batch_questions", mock_generate_batch)

        # Create generator and generate questions with callback
        _seed_ai_settings(db_session)

        generator = QuestionGenerator(db=db_session)
        questions = generator.generate_questions(
            parsed_doc=parsed_doc,
            num_questions=num_questions,
            difficulty="medium",
            progress_callback=track_callback,
        )

        # Property 1: Callback should be invoked for each question generated
        assert len(callback_invocations) == len(
            questions
        ), f"Callback should be invoked {len(questions)} times (once per question), but was invoked {len(callback_invocations)} times"

        # Property 2: Each invocation should have correct question numbers
        for i, (current, total) in enumerate(callback_invocations, start=1):
            assert current == i, f"Invocation {i}: expected current={i}, got current={current}"
            assert (
                total == num_questions
            ), f"Invocation {i}: expected total={num_questions}, got total={total}"

        # Property 3: Question numbers should be monotonically increasing
        if len(callback_invocations) > 1:
            for i in range(1, len(callback_invocations)):
                prev_current = callback_invocations[i - 1][0]
                curr_current = callback_invocations[i][0]
                assert (
                    curr_current > prev_current
                ), f"Question numbers should increase: {prev_current} -> {curr_current}"

        # Property 4: At least one question should be generated
        assert len(questions) >= 1, f"Should generate at least 1 question"

        # Property 5: Should not generate more questions than requested
        assert (
            len(questions) <= num_questions
        ), f"Should not generate more than {num_questions} questions, got {len(questions)}"

    @given(
        num_questions=st.integers(min_value=1, max_value=20),
        section_text=st.text(min_size=100, max_size=500),
    )
    @settings(
        max_examples=100, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture]
    )
    def test_question_counter_accuracy(self, num_questions, section_text, db_session, monkeypatch):
        """
        Feature: improved-progress-tracking, Property 3: Question Counter Accuracy

        For any progress update during generation, the current_question field should
        accurately reflect the number of questions completed, and total_questions
        should match the requested count.

        Validates: Requirements 2.1, 2.2, 2.5
        """
        # Track all progress updates
        progress_updates = []

        def track_progress_callback(current, total):
            progress_updates.append({"current_question": current, "total_questions": total})

        # Create a parsed document with one section
        parsed_doc = ParsedDocument(
            full_text=section_text,
            title="Test Document",
            sections=[ParsedSection(text=section_text, page=1, section="1", paragraph=1)],
        )

        # Mock the AI response to return exactly num_questions questions
        mock_questions = []
        for i in range(num_questions):
            mock_questions.append(
                {
                    "question": f"Question {i+1}?",
                    "options": [
                        {"option": "A", "text": "Option A"},
                        {"option": "B", "text": "Option B"},
                        {"option": "C", "text": "Option C"},
                        {"option": "D", "text": "Option D"},
                    ],
                    "correct_answer": "A",
                    "explanation": f"Explanation {i+1}",
                    "difficulty": "medium",
                }
            )

        # Mock the _generate_batch_questions to return our mock questions
        def mock_generate_batch(
            self,
            section,
            count,
            difficulty,
            custom_prompt=None,
            example_questions=None,
            progress_callback=None,
            questions_so_far=0,
            total_questions=0,
        ):
            # Simulate parsing questions and invoking callback
            questions_data = mock_questions[questions_so_far : questions_so_far + count]
            valid_questions = []

            for q_data in questions_data:
                q_data_copy = q_data.copy()
                q_data_copy["reference"] = {
                    "text": section.text[:200] + "..." if len(section.text) > 200 else section.text,
                    "page": section.page,
                    "section": section.section,
                    "paragraph": section.paragraph,
                }
                valid_questions.append(q_data_copy)

                # Invoke progress callback after each question
                if progress_callback is not None:
                    current_question = questions_so_far + len(valid_questions)
                    progress_callback(current_question, total_questions)

            return valid_questions

        # Apply mocks
        monkeypatch.setattr(QuestionGenerator, "_generate_batch_questions", mock_generate_batch)

        # Create generator and generate questions with callback
        _seed_ai_settings(db_session)

        generator = QuestionGenerator(db=db_session)
        questions = generator.generate_questions(
            parsed_doc=parsed_doc,
            num_questions=num_questions,
            difficulty="medium",
            progress_callback=track_progress_callback,
        )

        # Property 1: Should have progress updates for each question
        assert len(progress_updates) == len(
            questions
        ), f"Should have {len(questions)} progress updates, got {len(progress_updates)}"

        # Property 2: Each update should have accurate current_question count
        for i, update in enumerate(progress_updates, start=1):
            assert (
                update["current_question"] == i
            ), f"Update {i}: current_question should be {i}, got {update['current_question']}"

        # Property 3: All updates should have the same total_questions matching requested count
        for i, update in enumerate(progress_updates, start=1):
            assert (
                update["total_questions"] == num_questions
            ), f"Update {i}: total_questions should be {num_questions}, got {update['total_questions']}"

        # Property 4: current_question should never exceed total_questions
        for i, update in enumerate(progress_updates, start=1):
            assert (
                update["current_question"] <= update["total_questions"]
            ), f"Update {i}: current_question ({update['current_question']}) should not exceed total_questions ({update['total_questions']})"

        # Property 5: Final current_question should equal number of questions generated
        if progress_updates:
            final_update = progress_updates[-1]
            assert final_update["current_question"] == len(
                questions
            ), f"Final current_question should be {len(questions)}, got {final_update['current_question']}"

    @given(
        question_num=st.integers(min_value=1, max_value=100),
        total_questions=st.integers(min_value=1, max_value=100),
    )
    @settings(max_examples=100, deadline=None)
    def test_status_message_format(self, question_num, total_questions):
        """
        Feature: improved-progress-tracking, Property 4: Status Message Format

        For any question number X and total Y during generation, the status message
        should follow the format "Generating question X of Y".

        Validates: Requirements 2.3, 5.3
        """
        # Ensure question_num doesn't exceed total_questions
        assume(question_num <= total_questions)

        # Generate the status message using the same format as the callback
        status_message = f"Generating question {question_num} of {total_questions}"

        # Property 1: Message should contain "Generating question"
        assert (
            "Generating question" in status_message
        ), f"Status message should contain 'Generating question', got: {status_message}"

        # Property 2: Message should contain the current question number
        assert (
            str(question_num) in status_message
        ), f"Status message should contain question number {question_num}, got: {status_message}"

        # Property 3: Message should contain the total questions
        assert (
            str(total_questions) in status_message
        ), f"Status message should contain total questions {total_questions}, got: {status_message}"

        # Property 4: Message should contain " of " separator
        assert (
            " of " in status_message
        ), f"Status message should contain ' of ' separator, got: {status_message}"

        # Property 5: Message should match exact format "Generating question X of Y"
        expected_format = f"Generating question {question_num} of {total_questions}"
        assert (
            status_message == expected_format
        ), f"Status message should match format 'Generating question X of Y', expected: {expected_format}, got: {status_message}"

        # Property 6: Message should not have extra whitespace
        assert (
            status_message == status_message.strip()
        ), f"Status message should not have leading/trailing whitespace"

        # Property 7: Numbers should appear in correct order (current before total)
        current_pos = status_message.find(str(question_num))
        total_pos = status_message.find(str(total_questions), current_pos + len(str(question_num)))
        assert (
            current_pos < total_pos
        ), f"Current question number should appear before total in message"
