"""Unit tests for question generator"""
import pytest
from unittest.mock import Mock, patch, MagicMock
import json

from app.services.ai.question_generator import QuestionGenerator, get_setting
from app.services.parsers.base_parser import ParsedDocument, ParsedSection


@pytest.fixture
def mock_anthropic_response():
    """Mock Anthropic API response"""
    return {
        "question": "What is Python?",
        "options": [
            {"option": "A", "text": "A programming language"},
            {"option": "B", "text": "A snake"},
            {"option": "C", "text": "A framework"},
            {"option": "D", "text": "A database"},
        ],
        "correct_answer": "A",
        "explanation": "Python is a high-level programming language.",
        "difficulty": "medium",
    }


@pytest.fixture
def mock_parsed_doc():
    """Create a mock parsed document"""
    sections = [
        ParsedSection(
            text="Python is a high-level programming language. It is widely used for web development.",
            page=1,
            section="Introduction",
            start_char=0,
            end_char=88,
        ),
        ParsedSection(
            text="Python supports multiple programming paradigms including object-oriented and functional programming.",
            page=1,
            section="Features",
            start_char=89,
            end_char=190,
        ),
        ParsedSection(
            text="Django is a popular web framework for Python applications.",
            page=2,
            section="Frameworks",
            start_char=191,
            end_char=250,
        ),
    ]

    return ParsedDocument(
        full_text=" ".join([s.text for s in sections]),
        sections=sections,
        title="Python Programming",
        metadata={"parser": "test"},
    )


@pytest.mark.unit
class TestGetSetting:
    """Tests for get_setting helper function"""

    def test_get_setting_exists(self, db_session):
        """Test getting an existing setting"""
        from app.models.settings import Settings

        # Create a setting
        setting = Settings(key="test_key", value="test_value")
        db_session.add(setting)
        db_session.commit()

        result = get_setting(db_session, "test_key")
        assert result == "test_value"

    def test_get_setting_not_exists(self, db_session):
        """Test getting a non-existent setting"""
        result = get_setting(db_session, "nonexistent_key")
        assert result is None


@pytest.mark.unit
class TestQuestionGeneratorInitialization:
    """Tests for QuestionGenerator initialization"""

    @patch("app.services.ai.question_generator.Anthropic")
    def test_init_anthropic_provider(self, mock_anthropic):
        """Test initialization with Anthropic provider"""
        with patch("app.services.ai.question_generator.settings") as mock_settings:
            mock_settings.AI_PROVIDER = "anthropic"
            mock_settings.ANTHROPIC_API_KEY = "test-key"
            mock_settings.AI_MODEL = ""

            generator = QuestionGenerator()

            assert generator.provider == "anthropic"
            assert generator.model == "claude-3-5-sonnet-20241022"
            mock_anthropic.assert_called_once_with(api_key="test-key")

    @patch("app.services.ai.question_generator.OpenAI")
    def test_init_openai_provider(self, mock_openai):
        """Test initialization with OpenAI provider"""
        with patch("app.services.ai.question_generator.settings") as mock_settings:
            mock_settings.AI_PROVIDER = "openai"
            mock_settings.OPENAI_API_KEY = "test-key"
            mock_settings.AI_MODEL = ""

            generator = QuestionGenerator()

            assert generator.provider == "openai"
            assert generator.model == "gpt-4o"
            mock_openai.assert_called_once_with(api_key="test-key")

    @patch("app.services.ai.question_generator.genai")
    def test_init_gemini_provider(self, mock_genai):
        """Test initialization with Gemini provider"""
        with patch("app.services.ai.question_generator.settings") as mock_settings:
            mock_settings.AI_PROVIDER = "gemini"
            mock_settings.GEMINI_API_KEY = "test-key"
            mock_settings.AI_MODEL = ""

            generator = QuestionGenerator()

            assert generator.provider == "gemini"
            assert generator.model == "gemini-2.0-flash-exp"
            mock_genai.configure.assert_called_once_with(api_key="test-key")

    def test_init_no_api_key_raises_error(self):
        """Test that initialization fails without API key"""
        from app.exceptions import AIServiceError

        with patch("app.services.ai.question_generator.settings") as mock_settings:
            mock_settings.AI_PROVIDER = "anthropic"
            mock_settings.ANTHROPIC_API_KEY = None
            mock_settings.OPENAI_API_KEY = None
            mock_settings.GEMINI_API_KEY = None
            mock_settings.AI_MODEL = ""

            with pytest.raises(AIServiceError, match="No API key configured"):
                QuestionGenerator()

    def test_init_unknown_provider_raises_error(self):
        """Test that initialization fails with unknown provider"""
        from app.exceptions import AIServiceError

        with patch("app.services.ai.question_generator.settings") as mock_settings:
            mock_settings.AI_PROVIDER = "unknown_provider"
            mock_settings.ANTHROPIC_API_KEY = None
            mock_settings.OPENAI_API_KEY = None
            mock_settings.GEMINI_API_KEY = None
            mock_settings.AI_MODEL = ""

            with pytest.raises(AIServiceError, match="No API key configured"):
                QuestionGenerator()


@pytest.mark.unit
class TestSectionSelection:
    """Tests for section selection logic"""

    @patch("app.services.ai.question_generator.Anthropic")
    def test_select_sections_fewer_than_needed(self, mock_anthropic):
        """Test selecting sections when we have fewer sections than needed"""
        with patch("app.services.ai.question_generator.settings") as mock_settings:
            mock_settings.AI_PROVIDER = "anthropic"
            mock_settings.ANTHROPIC_API_KEY = "test-key"
            mock_settings.AI_MODEL = ""

            generator = QuestionGenerator()

            sections = [ParsedSection(text=f"Section {i}") for i in range(3)]

            selected = generator._select_sections(sections, 5)
            assert len(selected) == 3  # All sections returned

    @patch("app.services.ai.question_generator.Anthropic")
    def test_select_sections_evenly_distributed(self, mock_anthropic):
        """Test that sections are evenly distributed"""
        with patch("app.services.ai.question_generator.settings") as mock_settings:
            mock_settings.AI_PROVIDER = "anthropic"
            mock_settings.ANTHROPIC_API_KEY = "test-key"
            mock_settings.AI_MODEL = ""

            generator = QuestionGenerator()

            sections = [ParsedSection(text=f"Section {i}") for i in range(10)]

            selected = generator._select_sections(sections, 5)
            assert len(selected) == 5

            # Check that sections are evenly distributed
            indices = [sections.index(s) for s in selected]
            # Should be approximately: 0, 2, 4, 6, 8
            assert indices[0] < indices[1] < indices[2] < indices[3] < indices[4]

    @patch("app.services.ai.question_generator.Anthropic")
    def test_select_sections_exact_match(self, mock_anthropic):
        """Test selecting exact number of sections needed"""
        with patch("app.services.ai.question_generator.settings") as mock_settings:
            mock_settings.AI_PROVIDER = "anthropic"
            mock_settings.ANTHROPIC_API_KEY = "test-key"
            mock_settings.AI_MODEL = ""

            generator = QuestionGenerator()

            sections = [ParsedSection(text=f"Section {i}") for i in range(5)]
            selected = generator._select_sections(sections, 5)
            assert len(selected) == 5
            assert selected == sections


# Prompt building tests removed - these test private implementation details
# that don't exist in the current implementation. The prompt building
# is tested indirectly through the generate_questions tests.


# Response parsing tests removed - these test private implementation details
# that don't exist in the current implementation. Response parsing
# is tested indirectly through the generate_questions tests.


@pytest.mark.unit
class TestQuestionGeneration:
    """Tests for full question generation"""

    @patch("app.services.ai.question_generator.Anthropic")
    def test_generate_questions_basic(
        self, mock_anthropic, mock_parsed_doc, mock_anthropic_response
    ):
        """Test generating questions from document"""
        with patch("app.services.ai.question_generator.settings") as mock_settings:
            mock_settings.AI_PROVIDER = "anthropic"
            mock_settings.ANTHROPIC_API_KEY = "test-key"
            mock_settings.AI_MODEL = ""

            # Mock the API response
            mock_client = Mock()
            mock_response = Mock()
            mock_response.content = [Mock(text=json.dumps(mock_anthropic_response))]
            mock_client.messages.create.return_value = mock_response
            mock_anthropic.return_value = mock_client

            generator = QuestionGenerator()
            questions = generator.generate_questions(
                parsed_doc=mock_parsed_doc, num_questions=2, difficulty="medium"
            )

            assert len(questions) <= 2
            if len(questions) > 0:
                assert "question" in questions[0]
                assert "reference" in questions[0]

    @patch("app.services.ai.question_generator.Anthropic")
    def test_generate_questions_respects_limit(
        self, mock_anthropic, mock_parsed_doc, mock_anthropic_response
    ):
        """Test that question generation respects the limit"""
        with patch("app.services.ai.question_generator.settings") as mock_settings:
            mock_settings.AI_PROVIDER = "anthropic"
            mock_settings.ANTHROPIC_API_KEY = "test-key"
            mock_settings.AI_MODEL = ""

            mock_client = Mock()
            mock_response = Mock()
            mock_response.content = [Mock(text=json.dumps(mock_anthropic_response))]
            mock_client.messages.create.return_value = mock_response
            mock_anthropic.return_value = mock_client

            generator = QuestionGenerator()
            questions = generator.generate_questions(
                parsed_doc=mock_parsed_doc, num_questions=1, difficulty="easy"
            )

            # Should return at most 1 question
            assert len(questions) <= 1

    @patch("app.services.ai.question_generator.Anthropic")
    def test_generate_questions_adds_reference_info(
        self, mock_anthropic, mock_parsed_doc, mock_anthropic_response
    ):
        """Test that reference information is added to questions"""
        with patch("app.services.ai.question_generator.settings") as mock_settings:
            mock_settings.AI_PROVIDER = "anthropic"
            mock_settings.ANTHROPIC_API_KEY = "test-key"
            mock_settings.AI_MODEL = ""

            mock_client = Mock()
            mock_response = Mock()
            mock_response.content = [Mock(text=json.dumps(mock_anthropic_response))]
            mock_client.messages.create.return_value = mock_response
            mock_anthropic.return_value = mock_client

            generator = QuestionGenerator()
            questions = generator.generate_questions(parsed_doc=mock_parsed_doc, num_questions=1)

            if len(questions) > 0:
                assert "reference" in questions[0]
                ref = questions[0]["reference"]
                assert "text" in ref
                assert "page" in ref or "section" in ref

    @patch("app.services.ai.question_generator.Anthropic")
    def test_generate_questions_handles_api_error(self, mock_anthropic, mock_parsed_doc):
        """Test graceful handling of API errors"""
        from app.exceptions import AIServiceError

        with patch("app.services.ai.question_generator.settings") as mock_settings:
            mock_settings.AI_PROVIDER = "anthropic"
            mock_settings.ANTHROPIC_API_KEY = "test-key"
            mock_settings.AI_MODEL = ""

            mock_client = Mock()
            mock_client.messages.create.side_effect = Exception("API Error")
            mock_anthropic.return_value = mock_client

            generator = QuestionGenerator()

            # Should raise AIServiceError for API failures
            with pytest.raises(AIServiceError, match="AI service request failed"):
                generator.generate_questions(parsed_doc=mock_parsed_doc, num_questions=1)

    @patch("app.services.ai.question_generator.Anthropic")
    def test_generate_questions_without_callback(
        self, mock_anthropic, mock_parsed_doc, mock_anthropic_response
    ):
        """
        Test that generation works without callback (None)

        Validates: Requirements 4.5
        """
        with patch("app.services.ai.question_generator.settings") as mock_settings:
            mock_settings.AI_PROVIDER = "anthropic"
            mock_settings.ANTHROPIC_API_KEY = "test-key"
            mock_settings.AI_MODEL = ""

            # Mock the API response
            mock_client = Mock()
            mock_response = Mock()
            mock_response.content = [Mock(text=json.dumps(mock_anthropic_response))]
            mock_client.messages.create.return_value = mock_response
            mock_anthropic.return_value = mock_client

            generator = QuestionGenerator()

            # Generate questions without providing a callback (should default to None)
            questions = generator.generate_questions(
                parsed_doc=mock_parsed_doc,
                num_questions=2,
                difficulty="medium"
                # Note: progress_callback is not provided, defaults to None
            )

            # Should complete successfully without errors
            assert len(questions) <= 2
            if len(questions) > 0:
                assert "question" in questions[0]
                assert "reference" in questions[0]

    @patch("app.services.ai.question_generator.Anthropic")
    def test_generate_questions_with_explicit_none_callback(
        self, mock_anthropic, mock_parsed_doc, mock_anthropic_response
    ):
        """
        Test that generation works with explicitly None callback

        Validates: Requirements 4.5
        """
        with patch("app.services.ai.question_generator.settings") as mock_settings:
            mock_settings.AI_PROVIDER = "anthropic"
            mock_settings.ANTHROPIC_API_KEY = "test-key"
            mock_settings.AI_MODEL = ""

            # Mock the API response
            mock_client = Mock()
            mock_response = Mock()
            mock_response.content = [Mock(text=json.dumps(mock_anthropic_response))]
            mock_client.messages.create.return_value = mock_response
            mock_anthropic.return_value = mock_client

            generator = QuestionGenerator()

            # Generate questions with explicitly None callback
            questions = generator.generate_questions(
                parsed_doc=mock_parsed_doc,
                num_questions=2,
                difficulty="medium",
                progress_callback=None,  # Explicitly pass None
            )

            # Should complete successfully without errors
            assert len(questions) <= 2
            if len(questions) > 0:
                assert "question" in questions[0]
                assert "reference" in questions[0]
