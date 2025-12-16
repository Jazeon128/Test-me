"""Performance benchmarks for critical operations

These benchmarks use pytest-benchmark to measure and track performance over time.
Run with: pytest tests/benchmarks/ --benchmark-only
"""
import pytest
from unittest.mock import Mock, patch
import json

from app.services.ai.question_generator import QuestionGenerator
from app.services.parsers.base_parser import ParsedDocument, ParsedSection
from app.models.question import Question, QuestionOption
from app.models.document import Document, DocumentType


@pytest.fixture
def sample_parsed_doc():
    """Create a sample parsed document for benchmarking"""
    sections = []
    for i in range(10):
        section = ParsedSection(
            text=f"This is section {i} with some content about Python programming. " * 50,
            page=i + 1,
            section=f"Section {i+1}",
            paragraph=i + 1
        )
        sections.append(section)
    
    full_text = "\n\n".join(s.text for s in sections)
    
    return ParsedDocument(
        full_text=full_text,
        sections=sections,
        title="Test Document",
        num_pages=10,
        metadata={}
    )


@pytest.fixture
def mock_ai_response():
    """Create a mock AI response with valid questions"""
    questions = []
    for i in range(5):
        question = {
            "question": f"What is the purpose of feature {i}?",
            "options": [
                {"option": "A", "text": f"Option A for question {i}"},
                {"option": "B", "text": f"Option B for question {i}"},
                {"option": "C", "text": f"Option C for question {i}"},
                {"option": "D", "text": f"Option D for question {i}"},
            ],
            "correct_answer": "A",
            "explanation": f"Explanation for question {i}",
            "difficulty": "medium"
        }
        questions.append(question)
    
    return json.dumps(questions)


class TestQuestionGenerationBenchmarks:
    """Benchmarks for question generation performance"""

    def test_benchmark_question_generation_10_questions(
        self, benchmark, sample_parsed_doc, mock_ai_response
    ):
        """Benchmark generating 10 questions from a document"""
        # Create generator with mocked client
        generator = QuestionGenerator.__new__(QuestionGenerator)
        generator.provider = "anthropic"
        generator.model = "claude-3-5-sonnet-20241022"
        
        # Mock the client
        mock_client = Mock()
        mock_message = Mock()
        mock_content = Mock()
        mock_content.text = mock_ai_response
        mock_message.content = [mock_content]
        mock_message.usage = Mock(input_tokens=1000, output_tokens=2000)
        mock_client.messages.create.return_value = mock_message
        generator.client = mock_client
        
        # Benchmark the generation
        result = benchmark(
            generator.generate_questions,
            parsed_doc=sample_parsed_doc,
            num_questions=10,
            difficulty="medium"
        )
        
        # Verify results
        assert len(result) > 0
        assert len(result) <= 10

    def test_benchmark_section_selection(self, benchmark, sample_parsed_doc):
        """Benchmark section selection algorithm"""
        generator = QuestionGenerator.__new__(QuestionGenerator)
        
        result = benchmark(
            generator._select_sections,
            sections=sample_parsed_doc.sections,
            num_needed=5
        )
        
        assert len(result) == 5

    def test_benchmark_response_parsing(self, benchmark, mock_ai_response):
        """Benchmark parsing AI response into questions"""
        generator = QuestionGenerator.__new__(QuestionGenerator)
        
        result = benchmark(
            generator._parse_batch_response,
            response=mock_ai_response
        )
        
        assert len(result) > 0


class TestDatabaseBenchmarks:
    """Benchmarks for database operations"""

    def test_benchmark_question_query(self, benchmark, db_session, sample_document):
        """Benchmark querying questions by document"""
        # Create some test questions
        for i in range(20):
            question = Question(
                document_id=sample_document.id,
                question_text=f"Test question {i}?",
                explanation=f"Explanation {i}",
                difficulty="medium"
            )
            db_session.add(question)
            db_session.flush()
            
            # Add options
            for j, label in enumerate(['A', 'B', 'C', 'D']):
                option = QuestionOption(
                    question_id=question.id,
                    option_text=f"Option {label}",
                    is_correct=(j == 0),
                    order=j
                )
                db_session.add(option)
        
        db_session.commit()
        
        # Benchmark the query
        def query_questions():
            return db_session.query(Question).filter(
                Question.document_id == sample_document.id
            ).all()
        
        result = benchmark(query_questions)
        assert len(result) == 20

    def test_benchmark_question_with_options_query(self, benchmark, db_session, sample_question):
        """Benchmark querying a question with its options"""
        def query_with_options():
            question = db_session.query(Question).filter(
                Question.id == sample_question.id
            ).first()
            # Access options to trigger lazy loading
            _ = question.options
            return question
        
        result = benchmark(query_with_options)
        assert result is not None
        assert len(result.options) == 4

    def test_benchmark_bulk_question_insert(self, benchmark, db_session, sample_document):
        """Benchmark inserting multiple questions at once"""
        def insert_questions():
            questions = []
            for i in range(10):
                question = Question(
                    document_id=sample_document.id,
                    question_text=f"Bulk question {i}?",
                    explanation=f"Bulk explanation {i}",
                    difficulty="medium"
                )
                questions.append(question)
            
            db_session.bulk_save_objects(questions)
            db_session.commit()
        
        benchmark(insert_questions)


class TestAPIBenchmarks:
    """Benchmarks for API endpoint performance"""

    def test_benchmark_get_question_endpoint(self, benchmark, client, sample_question):
        """Benchmark GET /api/questions/{id} endpoint"""
        def get_question():
            return client.get(f"/api/questions/{sample_question.id}")
        
        response = benchmark(get_question)
        assert response.status_code == 200

    def test_benchmark_list_decks_endpoint(self, benchmark, client, sample_test):
        """Benchmark GET /api/decks endpoint"""
        def list_decks():
            return client.get("/api/decks")
        
        response = benchmark(list_decks)
        assert response.status_code == 200

    def test_benchmark_get_documents_endpoint(self, benchmark, client, sample_document):
        """Benchmark GET /api/documents endpoint"""
        def list_documents():
            return client.get("/api/documents")
        
        response = benchmark(list_documents)
        assert response.status_code == 200


class TestParsingBenchmarks:
    """Benchmarks for document parsing operations"""

    def test_benchmark_text_cleaning(self, benchmark):
        """Benchmark text cleaning operation"""
        from app.services.parsers.base_parser import BaseParser
        
        # Create a concrete implementation for testing
        class TestParser(BaseParser):
            def parse(self, file_path):
                pass
        
        parser = TestParser()
        
        # Create text with excessive whitespace
        dirty_text = "This   is    a   test\n\n\n   with   lots\t\tof    whitespace   "
        
        result = benchmark(parser._clean_text, dirty_text)
        assert "  " not in result  # No double spaces

    def test_benchmark_section_creation(self, benchmark):
        """Benchmark creating ParsedSection objects"""
        def create_sections():
            sections = []
            for i in range(100):
                section = ParsedSection(
                    text=f"Section {i} content " * 50,
                    page=i + 1,
                    section=f"Section {i+1}",
                    paragraph=i + 1,
                    start_char=i * 1000,
                    end_char=(i + 1) * 1000
                )
                sections.append(section)
            return sections
        
        result = benchmark(create_sections)
        assert len(result) == 100
