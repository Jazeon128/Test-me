"""Property-based tests for question generator

Feature: codebase-quality-improvements
"""
import pytest
import json
from unittest.mock import Mock, patch, MagicMock
from hypothesis import given, strategies as st, assume
from typing import List, Dict

from app.services.ai.question_generator import QuestionGenerator


# Hypothesis strategies for generating test data


@st.composite
def valid_question_dict(draw):
    """Generate a valid question dictionary"""
    correct_option = draw(st.sampled_from(["A", "B", "C", "D"]))
    return {
        "question": draw(st.text(min_size=10, max_size=500)),
        "options": [
            {"option": "A", "text": draw(st.text(min_size=5, max_size=200))},
            {"option": "B", "text": draw(st.text(min_size=5, max_size=200))},
            {"option": "C", "text": draw(st.text(min_size=5, max_size=200))},
            {"option": "D", "text": draw(st.text(min_size=5, max_size=200))},
        ],
        "correct_answer": correct_option,
        "explanation": draw(st.text(min_size=20, max_size=1000)),
        "difficulty": draw(st.sampled_from(["easy", "medium", "hard"])),
    }


@st.composite
def question_with_missing_fields(draw):
    """Generate a question dictionary with some required fields missing"""
    all_fields = ["question", "options", "correct_answer", "explanation"]
    # Remove at least one required field
    num_to_remove = draw(st.integers(min_value=1, max_value=len(all_fields)))
    fields_to_remove = draw(
        st.lists(
            st.sampled_from(all_fields), min_size=num_to_remove, max_size=num_to_remove, unique=True
        )
    )

    question = {
        "question": draw(st.text(min_size=10, max_size=500)),
        "options": [
            {"option": "A", "text": draw(st.text(min_size=5, max_size=200))},
            {"option": "B", "text": draw(st.text(min_size=5, max_size=200))},
            {"option": "C", "text": draw(st.text(min_size=5, max_size=200))},
            {"option": "D", "text": draw(st.text(min_size=5, max_size=200))},
        ],
        "correct_answer": draw(st.sampled_from(["A", "B", "C", "D"])),
        "explanation": draw(st.text(min_size=20, max_size=1000)),
        "difficulty": draw(st.sampled_from(["easy", "medium", "hard"])),
    }

    for field in fields_to_remove:
        if field in question:
            del question[field]

    return question


@st.composite
def question_with_wrong_option_count(draw):
    """Generate a question with incorrect number of options"""
    num_options = draw(st.integers(min_value=0, max_value=10).filter(lambda x: x != 4))
    options = []
    for i in range(num_options):
        label = chr(65 + i) if i < 26 else f"Option{i}"
        options.append({"option": label, "text": draw(st.text(min_size=5, max_size=200))})

    return {
        "question": draw(st.text(min_size=10, max_size=500)),
        "options": options,
        "correct_answer": draw(st.sampled_from(["A", "B", "C", "D"])),
        "explanation": draw(st.text(min_size=20, max_size=1000)),
        "difficulty": draw(st.sampled_from(["easy", "medium", "hard"])),
    }


@st.composite
def question_with_wrong_option_labels(draw):
    """Generate a question with incorrect option labels"""
    # Generate 4 options but with wrong labels
    wrong_labels = draw(
        st.lists(
            st.text(min_size=1, max_size=5).filter(lambda x: x not in ["A", "B", "C", "D"]),
            min_size=4,
            max_size=4,
            unique=True,
        )
    )

    return {
        "question": draw(st.text(min_size=10, max_size=500)),
        "options": [
            {"option": wrong_labels[0], "text": draw(st.text(min_size=5, max_size=200))},
            {"option": wrong_labels[1], "text": draw(st.text(min_size=5, max_size=200))},
            {"option": wrong_labels[2], "text": draw(st.text(min_size=5, max_size=200))},
            {"option": wrong_labels[3], "text": draw(st.text(min_size=5, max_size=200))},
        ],
        "correct_answer": draw(st.sampled_from(["A", "B", "C", "D"])),
        "explanation": draw(st.text(min_size=20, max_size=1000)),
        "difficulty": draw(st.sampled_from(["easy", "medium", "hard"])),
    }


@st.composite
def question_with_multiple_correct_answers(draw):
    """Generate a question where multiple options are marked as correct"""
    num_correct = draw(st.integers(min_value=0, max_value=4).filter(lambda x: x != 1))
    correct_indices = draw(
        st.lists(
            st.integers(min_value=0, max_value=3),
            min_size=num_correct,
            max_size=num_correct,
            unique=True,
        )
    )

    options = []
    for i, label in enumerate(["A", "B", "C", "D"]):
        option = {"option": label, "text": draw(st.text(min_size=5, max_size=200))}
        if i in correct_indices:
            option["is_correct"] = True
        options.append(option)

    return {
        "question": draw(st.text(min_size=10, max_size=500)),
        "options": options,
        "correct_answer": draw(st.sampled_from(["A", "B", "C", "D"])),
        "explanation": draw(st.text(min_size=20, max_size=1000)),
        "difficulty": draw(st.sampled_from(["easy", "medium", "hard"])),
    }


@st.composite
def malformed_json_response(draw):
    """Generate malformed JSON responses"""
    malformed_types = draw(
        st.sampled_from(
            ["invalid_json", "not_a_list", "empty_string", "null", "number", "nested_wrong"]
        )
    )

    if malformed_types == "invalid_json":
        return "{ this is not valid json ["
    elif malformed_types == "not_a_list":
        return json.dumps({"question": "test"})
    elif malformed_types == "empty_string":
        return ""
    elif malformed_types == "null":
        return "null"
    elif malformed_types == "number":
        return "42"
    else:  # nested_wrong
        return json.dumps({"questions": [{"question": "test"}]})


@st.composite
def parsed_section_strategy(draw):
    """Generate a ParsedSection-like object"""
    from app.services.parsers.base_parser import ParsedSection

    return ParsedSection(
        text=draw(st.text(min_size=100, max_size=5000)),
        page=draw(st.integers(min_value=1, max_value=100)),
        section=draw(st.text(min_size=1, max_size=50)),
        paragraph=draw(st.integers(min_value=1, max_value=50)),
    )


@pytest.mark.property
class TestQuestionGeneratorProperties:
    """Property-based tests for question generator correctness"""

    @given(questions=st.lists(valid_question_dict(), min_size=1, max_size=20))
    def test_property_6_required_fields_validation(self, questions):
        """
        Feature: codebase-quality-improvements, Property 6: Required fields validation
        Validates: Requirements 2.1

        For any parsed question from AI response, if the question is included in the
        valid results, it must contain all required fields: question_text, options
        (list of 4), correct_answer, explanation, difficulty
        """
        # Create a JSON response with the questions
        json_response = json.dumps(questions)

        # Create a generator instance (without DB to avoid API calls)
        generator = QuestionGenerator.__new__(QuestionGenerator)

        # Parse the response
        parsed_questions = generator._parse_batch_response(json_response)

        # All parsed questions should have required fields
        required_fields = ["question", "options", "correct_answer", "explanation"]

        for q in parsed_questions:
            for field in required_fields:
                assert field in q, (
                    f"Required field '{field}' missing from parsed question. " f"Question: {q}"
                )

            # Options should be a list
            assert isinstance(
                q["options"], list
            ), f"Options field should be a list, got {type(q['options'])}"

    @given(questions=st.lists(valid_question_dict(), min_size=1, max_size=20))
    def test_property_7_four_options_structure(self, questions):
        """
        Feature: codebase-quality-improvements, Property 7: Four options structure
        Validates: Requirements 2.2

        For any generated question, the options list must contain exactly 4 items
        with labels 'A', 'B', 'C', 'D' in order
        """
        # Create a JSON response with the questions
        json_response = json.dumps(questions)

        # Create a generator instance
        generator = QuestionGenerator.__new__(QuestionGenerator)

        # Parse the response
        parsed_questions = generator._parse_batch_response(json_response)

        for q in parsed_questions:
            options = q.get("options", [])

            # Should have exactly 4 options
            assert len(options) == 4, (
                f"Question should have exactly 4 options, got {len(options)}. "
                f"Question: {q['question']}"
            )

            # Options should be labeled A, B, C, D in order
            expected_labels = ["A", "B", "C", "D"]
            actual_labels = [opt.get("option") for opt in options]

            assert actual_labels == expected_labels, (
                f"Options should be labeled {expected_labels}, got {actual_labels}. "
                f"Question: {q['question']}"
            )

    @given(questions=st.lists(valid_question_dict(), min_size=1, max_size=20))
    def test_property_8_single_correct_answer(self, questions):
        """
        Feature: codebase-quality-improvements, Property 8: Single correct answer
        Validates: Requirements 2.3

        For any generated question, exactly one option must be marked as correct
        (is_correct=True)
        """
        # Create a JSON response with the questions
        json_response = json.dumps(questions)

        # Create a generator instance
        generator = QuestionGenerator.__new__(QuestionGenerator)

        # Parse the response
        parsed_questions = generator._parse_batch_response(json_response)

        for q in parsed_questions:
            correct_answer = q.get("correct_answer")

            # Should have a correct_answer field
            assert (
                correct_answer is not None
            ), f"Question should have a correct_answer field. Question: {q['question']}"

            # correct_answer should be one of A, B, C, D
            assert correct_answer in ["A", "B", "C", "D"], (
                f"correct_answer should be A, B, C, or D, got {correct_answer}. "
                f"Question: {q['question']}"
            )

    @given(response=malformed_json_response())
    def test_property_9_graceful_error_handling(self, response):
        """
        Feature: codebase-quality-improvements, Property 9: Graceful error handling
        Validates: Requirements 2.4

        For any malformed AI response (invalid JSON, missing fields, wrong types),
        the parser should return an empty list without raising exceptions
        """
        # Create a generator instance
        generator = QuestionGenerator.__new__(QuestionGenerator)

        # Parse the malformed response - should not raise an exception
        try:
            parsed_questions = generator._parse_batch_response(response)

            # Should return a list (possibly empty)
            assert isinstance(
                parsed_questions, list
            ), f"Parser should return a list, got {type(parsed_questions)}"

        except Exception as e:
            pytest.fail(
                f"Parser raised an exception for malformed response: {e}. "
                f"Response: {response[:100]}"
            )

    @given(
        num_sections=st.integers(min_value=5, max_value=50),
        num_needed=st.integers(min_value=2, max_value=10),
    )
    def test_property_10_even_section_distribution(self, num_sections, num_needed):
        """
        Feature: codebase-quality-improvements, Property 10: Even section distribution
        Validates: Requirements 2.5

        For any document with N sections and request for K sections (K < N), the
        selected sections should be distributed with approximately equal spacing
        (max spacing difference <= 2 indices)
        """
        from app.services.parsers.base_parser import ParsedSection

        # Only test when we need fewer sections than available
        assume(num_needed < num_sections)

        # Create mock sections
        sections = [
            ParsedSection(text=f"Section {i} content", page=i, section=f"Section {i}", paragraph=i)
            for i in range(num_sections)
        ]

        # Create a generator instance
        generator = QuestionGenerator.__new__(QuestionGenerator)

        # Select sections
        selected = generator._select_sections(sections, num_needed)

        # Should return exactly num_needed sections
        assert (
            len(selected) == num_needed
        ), f"Should select {num_needed} sections, got {len(selected)}"

        # Get the indices of selected sections
        selected_indices = [sections.index(s) for s in selected]

        # Calculate spacing between consecutive selected sections
        if len(selected_indices) > 1:
            spacings = [
                selected_indices[i + 1] - selected_indices[i]
                for i in range(len(selected_indices) - 1)
            ]

            # Check that spacing is approximately even (max difference <= 2)
            min_spacing = min(spacings)
            max_spacing = max(spacings)

            assert max_spacing - min_spacing <= 2, (
                f"Section spacing not even enough. Spacings: {spacings}. "
                f"Selected indices: {selected_indices}. "
                f"Total sections: {num_sections}, needed: {num_needed}"
            )

    @given(
        provider=st.sampled_from(["anthropic", "openai", "gemini"]),
        model_name=st.text(min_size=1, max_size=100).filter(
            lambda x: x.strip() and not any(c in x for c in ["\n", "\r", "\t"])
        ),
    )
    def test_property_7_ai_service_uses_exact_model_name(self, provider, model_name):
        """
        Feature: custom-model-input, Property 7: AI service uses exact model name
        Validates: Requirements 4.4

        For any model name stored in configuration, when the AI service initializes,
        it should pass that exact model name to the provider SDK without modification.
        """
        # Strip whitespace from model name as the code does
        model_name = model_name.strip()

        # Mock the database session and settings
        mock_db = Mock()
        mock_setting = Mock()
        mock_setting.value = model_name

        # Mock get_setting to return our test values
        with patch("app.services.ai.question_generator.get_setting") as mock_get_setting, patch(
            "app.services.ai.question_generator.get_secret", return_value="test-api-key-12345"
        ):

            def get_setting_side_effect(db, key):
                if key == "ai_provider":
                    return provider
                elif key == "ai_model":
                    return model_name
                elif key == "api_key":
                    return "test-api-key-12345"
                return None

            mock_get_setting.side_effect = get_setting_side_effect

            # Mock the provider clients
            if provider == "anthropic":
                with patch("app.services.ai.question_generator.Anthropic") as mock_anthropic:
                    mock_client = Mock()
                    mock_anthropic.return_value = mock_client

                    # Initialize the generator
                    generator = QuestionGenerator(db=mock_db)

                    # Verify the model name is stored exactly as provided
                    assert generator.model == model_name, (
                        f"Model name should be stored exactly as provided. "
                        f"Expected: '{model_name}', Got: '{generator.model}'"
                    )

                    # Verify Anthropic client was initialized with correct API key
                    mock_anthropic.assert_called_once_with(api_key="test-api-key-12345", max_retries=0)

            elif provider == "openai":
                with patch("app.services.ai.question_generator.OpenAI") as mock_openai:
                    mock_client = Mock()
                    mock_openai.return_value = mock_client

                    # Initialize the generator
                    generator = QuestionGenerator(db=mock_db)

                    # Verify the model name is stored exactly as provided
                    assert generator.model == model_name, (
                        f"Model name should be stored exactly as provided. "
                        f"Expected: '{model_name}', Got: '{generator.model}'"
                    )

                    # Verify OpenAI client was initialized with correct API key
                    mock_openai.assert_called_once_with(api_key="test-api-key-12345", max_retries=0)

            elif provider == "gemini":
                with patch("app.services.ai.question_generator.genai") as mock_genai:
                    # Initialize the generator
                    generator = QuestionGenerator(db=mock_db)

                    # Verify the model name is stored exactly as provided
                    assert generator.model == model_name, (
                        f"Model name should be stored exactly as provided. "
                        f"Expected: '{model_name}', Got: '{generator.model}'"
                    )

                    # Verify the Gemini client was created with the correct API key
                    mock_genai.Client.assert_called_once()
                    assert mock_genai.Client.call_args.kwargs["api_key"] == "test-api-key-12345"

    @given(
        provider=st.sampled_from(["anthropic", "openai", "gemini"]),
        model_name=st.text(min_size=1, max_size=100).filter(
            lambda x: x.strip() and not any(c in x for c in ["\n", "\r", "\t"])
        ),
    )
    def test_property_7_model_name_passed_to_api_calls(self, provider, model_name):
        """
        Feature: custom-model-input, Property 7: AI service uses exact model name (API calls)
        Validates: Requirements 4.4

        For any model name, when making API calls to the provider, the exact model name
        should be passed without modification or normalization.
        """
        from app.services.parsers.base_parser import ParsedSection

        # Strip whitespace from model name as the code does
        model_name = model_name.strip()

        # Create a test section
        section = ParsedSection(
            text="Test content for question generation", page=1, section="Test Section", paragraph=1
        )

        # Mock the database session and settings
        mock_db = Mock()

        # Mock get_setting to return our test values
        with patch("app.services.ai.question_generator.get_setting") as mock_get_setting, patch(
            "app.services.ai.question_generator.get_secret", return_value="test-api-key-12345"
        ):

            def get_setting_side_effect(db, key):
                if key == "ai_provider":
                    return provider
                elif key == "ai_model":
                    return model_name
                elif key == "api_key":
                    return "test-api-key-12345"
                return None

            mock_get_setting.side_effect = get_setting_side_effect

            # Test for each provider
            if provider == "anthropic":
                with patch("app.services.ai.question_generator.Anthropic") as mock_anthropic:
                    mock_client = Mock()
                    mock_response = Mock()
                    mock_response.content = [
                        Mock(
                            text='[{"question": "Test?", "options": [{"option": "A", "text": "1"}, {"option": "B", "text": "2"}, {"option": "C", "text": "3"}, {"option": "D", "text": "4"}], "correct_answer": "A", "explanation": "Test"}]'
                        )
                    ]
                    mock_response.usage = Mock(input_tokens=100, output_tokens=50)
                    mock_client.messages.create.return_value = mock_response
                    mock_anthropic.return_value = mock_client

                    # Initialize generator and make API call
                    generator = QuestionGenerator(db=mock_db)
                    generator._generate_batch_questions(section, 1, "medium")

                    # Verify the exact model name was passed to the API call
                    mock_client.messages.create.assert_called_once()
                    call_kwargs = mock_client.messages.create.call_args[1]
                    assert call_kwargs["model"] == model_name, (
                        f"Model name passed to Anthropic API should be exact. "
                        f"Expected: '{model_name}', Got: '{call_kwargs['model']}'"
                    )

            elif provider == "openai":
                with patch("app.services.ai.question_generator.OpenAI") as mock_openai:
                    mock_client = Mock()
                    mock_response = Mock()
                    mock_response.choices = [
                        Mock(
                            message=Mock(
                                content='[{"question": "Test?", "options": [{"option": "A", "text": "1"}, {"option": "B", "text": "2"}, {"option": "C", "text": "3"}, {"option": "D", "text": "4"}], "correct_answer": "A", "explanation": "Test"}]'
                            )
                        )
                    ]
                    mock_response.usage = Mock(prompt_tokens=100, completion_tokens=50)
                    mock_client.chat.completions.create.return_value = mock_response
                    mock_openai.return_value = mock_client

                    # Initialize generator and make API call
                    generator = QuestionGenerator(db=mock_db)
                    generator._generate_batch_questions(section, 1, "medium")

                    # Verify the exact model name was passed to the API call
                    mock_client.chat.completions.create.assert_called_once()
                    call_kwargs = mock_client.chat.completions.create.call_args[1]
                    assert call_kwargs["model"] == model_name, (
                        f"Model name passed to OpenAI API should be exact. "
                        f"Expected: '{model_name}', Got: '{call_kwargs['model']}'"
                    )

            elif provider == "gemini":
                with patch("app.services.ai.question_generator.genai") as mock_genai:
                    mock_response = Mock()
                    mock_response.text = '[{"question": "Test?", "options": [{"option": "A", "text": "1"}, {"option": "B", "text": "2"}, {"option": "C", "text": "3"}, {"option": "D", "text": "4"}], "correct_answer": "A", "explanation": "Test"}]'
                    mock_response.usage_metadata = Mock(
                        prompt_token_count=100, candidates_token_count=50
                    )
                    mock_client = mock_genai.Client.return_value
                    mock_client.models.generate_content.return_value = mock_response

                    # Initialize generator and make API call
                    generator = QuestionGenerator(db=mock_db)
                    generator._generate_batch_questions(section, 1, "medium")

                    # Verify the exact model name reached the API call
                    call_kwargs = mock_client.models.generate_content.call_args.kwargs
                    assert call_kwargs["model"] == model_name, (
                        f"Model name passed to Gemini API should be exact. "
                        f"Expected: '{model_name}', Got: '{call_kwargs['model']}'"
                    )
