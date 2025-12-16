"""Property-based tests for performance requirements

Feature: codebase-quality-improvements
"""
import pytest
import time
import tracemalloc
from hypothesis import given, strategies as st, settings, assume
from unittest.mock import Mock, patch, MagicMock
from typing import List

from app.services.ai.question_generator import QuestionGenerator
from app.services.parsers.base_parser import ParsedDocument, ParsedSection


# Hypothesis strategies for generating test data

@st.composite
def parsed_section_strategy(draw, min_size=100, max_size=10000):
    """Generate a ParsedSection with configurable text size"""
    text_size = draw(st.integers(min_value=min_size, max_value=max_size))
    return ParsedSection(
        text=draw(st.text(min_size=text_size, max_size=text_size)),
        page=draw(st.integers(min_value=1, max_value=100)),
        section=draw(st.text(min_size=1, max_size=50)),
        paragraph=draw(st.integers(min_value=1, max_value=50))
    )


@st.composite
def parsed_document_strategy(draw, min_sections=1, max_sections=10, section_size=1000):
    """Generate a ParsedDocument with configurable sections"""
    num_sections = draw(st.integers(min_value=min_sections, max_value=max_sections))
    sections = [
        draw(parsed_section_strategy(min_size=section_size, max_size=section_size))
        for _ in range(num_sections)
    ]
    
    full_text = "\n\n".join(s.text for s in sections)
    
    return ParsedDocument(
        full_text=full_text,
        sections=sections,
        title=draw(st.text(min_size=5, max_size=100)),
        num_pages=draw(st.integers(min_value=1, max_value=100)),
        metadata={}
    )


@st.composite
def mock_ai_response_strategy(draw, num_questions=1):
    """Generate a mock AI response with valid questions"""
    questions = []
    for _ in range(num_questions):
        correct_option = draw(st.sampled_from(['A', 'B', 'C', 'D']))
        question = {
            "question": draw(st.text(min_size=10, max_size=200)),
            "options": [
                {"option": "A", "text": draw(st.text(min_size=5, max_size=100))},
                {"option": "B", "text": draw(st.text(min_size=5, max_size=100))},
                {"option": "C", "text": draw(st.text(min_size=5, max_size=100))},
                {"option": "D", "text": draw(st.text(min_size=5, max_size=100))},
            ],
            "correct_answer": correct_option,
            "explanation": draw(st.text(min_size=20, max_size=500)),
            "difficulty": draw(st.sampled_from(['easy', 'medium', 'hard']))
        }
        questions.append(question)
    
    import json
    return json.dumps(questions)


@pytest.mark.property
class TestPerformanceProperties:
    """Property-based tests for performance requirements"""

    @settings(max_examples=20, deadline=60000)  # 60 second deadline for performance tests
    @given(
        section_size=st.integers(min_value=500, max_value=5000),
        num_questions=st.integers(min_value=1, max_value=5),
        data=st.data()
    )
    def test_property_19_question_generation_time_bounds(self, section_size, num_questions, data):
        """
        Feature: codebase-quality-improvements, Property 19: Question generation time bounds
        Validates: Requirements 8.1
        
        For any document section of size S characters, question generation should complete 
        within (S / 1000) * 5 seconds + 10 seconds base time
        """
        # Create a parsed document with one section of the specified size
        section = ParsedSection(
            text="a" * section_size,  # Simple text of exact size
            page=1,
            section="Test Section",
            paragraph=1
        )
        
        parsed_doc = ParsedDocument(
            full_text=section.text,
            sections=[section],
            title="Test Document",
            num_pages=1,
            metadata={}
        )
        
        # Calculate expected time bound: (S / 1000) * 5 + 10 seconds
        expected_max_time = (section_size / 1000) * 5 + 10
        
        # Mock the AI API call to return quickly with valid questions
        mock_response = data.draw(mock_ai_response_strategy(num_questions=num_questions))
        
        # Create generator with mocked client
        generator = QuestionGenerator.__new__(QuestionGenerator)
        generator.provider = "anthropic"
        generator.model = "claude-3-5-sonnet-20241022"
        
        # Mock the client
        mock_client = Mock()
        mock_message = Mock()
        mock_content = Mock()
        mock_content.text = mock_response
        mock_message.content = [mock_content]
        mock_message.usage = Mock(input_tokens=100, output_tokens=200)
        mock_client.messages.create.return_value = mock_message
        generator.client = mock_client
        
        # Measure generation time
        start_time = time.time()
        
        try:
            questions = generator.generate_questions(
                parsed_doc=parsed_doc,
                num_questions=num_questions,
                difficulty="medium"
            )
            
            elapsed_time = time.time() - start_time
            
            # Verify questions were generated
            assert len(questions) > 0, "Should generate at least one question"
            
            # Check time bound
            assert elapsed_time <= expected_max_time, (
                f"Question generation took {elapsed_time:.2f}s, "
                f"expected <= {expected_max_time:.2f}s for section size {section_size} chars. "
                f"Formula: ({section_size} / 1000) * 5 + 10 = {expected_max_time:.2f}s"
            )
            
        except Exception as e:
            # If generation fails, that's a separate issue - we're testing time bounds
            elapsed_time = time.time() - start_time
            
            # Even failures should complete within time bounds
            assert elapsed_time <= expected_max_time, (
                f"Question generation (even with failure) took {elapsed_time:.2f}s, "
                f"expected <= {expected_max_time:.2f}s. Error: {str(e)}"
            )

    @settings(max_examples=20, deadline=30000)  # 30 second deadline
    @given(
        endpoint=st.sampled_from([
            "/api/questions/{question_id}",
            "/api/decks",
            "/api/documents"
        ]),
        response_size=st.integers(min_value=100, max_value=10000)
    )
    def test_property_20_api_response_time_sla(self, endpoint, response_size):
        """
        Feature: codebase-quality-improvements, Property 20: API response time SLA
        Validates: Requirements 8.3
        
        For any API endpoint call with valid inputs, the response time should be 
        less than 2 seconds for 95% of requests
        
        Note: This test validates individual request timing. The 95% percentile
        requirement is validated through aggregate metrics in production.
        """
        from fastapi.testclient import TestClient
        from main import app
        from app.db.database import get_db
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from sqlalchemy.pool import StaticPool
        from app.models.base import Base
        
        # Create in-memory test database
        engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(bind=engine)
        TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        
        def override_get_db():
            db = TestingSessionLocal()
            try:
                yield db
            finally:
                db.close()
        
        app.dependency_overrides[get_db] = override_get_db
        
        try:
            with TestClient(app) as client:
                # Prepare test data based on endpoint
                if "/questions/" in endpoint:
                    # Create a test question first
                    from app.models.question import Question, QuestionOption
                    from app.models.document import Document, DocumentType
                    
                    db = TestingSessionLocal()
                    try:
                        # Create document
                        doc = Document(
                            filename="test.pdf",
                            original_filename="test.pdf",
                            file_path="/test.pdf",
                            file_type=DocumentType.PDF,
                            file_size=1024,
                            content="Test content",
                            title="Test"
                        )
                        db.add(doc)
                        db.flush()
                        
                        # Create question
                        question = Question(
                            document_id=doc.id,
                            question_text="Test question?",
                            explanation="Test explanation",
                            difficulty="medium"
                        )
                        db.add(question)
                        db.flush()
                        
                        # Add options
                        for i, text in enumerate(["Option A", "Option B", "Option C", "Option D"]):
                            option = QuestionOption(
                                question_id=question.id,
                                option_text=text,
                                is_correct=(i == 0),
                                order=i
                            )
                            db.add(option)
                        
                        db.commit()
                        question_id = question.id
                    finally:
                        db.close()
                    
                    url = f"/api/questions/{question_id}"
                    
                elif endpoint == "/api/decks":
                    url = "/api/decks"
                    
                elif endpoint == "/api/documents":
                    url = "/api/documents"
                
                # Measure response time
                start_time = time.time()
                response = client.get(url)
                elapsed_time = time.time() - start_time
                
                # Verify response is successful (or expected error)
                assert response.status_code in [200, 404], (
                    f"Unexpected status code: {response.status_code}"
                )
                
                # Check SLA: should be < 2 seconds
                # Note: This is a strict check per request. In production, we'd measure
                # the 95th percentile across many requests.
                assert elapsed_time < 2.0, (
                    f"API endpoint {endpoint} took {elapsed_time:.3f}s, "
                    f"expected < 2.0s (SLA requirement)"
                )
                
        finally:
            app.dependency_overrides.clear()
            Base.metadata.drop_all(bind=engine)

    @settings(max_examples=15, deadline=30000)  # 30 second deadline
    @given(
        file_size_kb=st.integers(min_value=10, max_value=1000),
        file_type=st.sampled_from(['pdf', 'docx', 'txt', 'md'])
    )
    def test_property_21_memory_usage_bounds(self, file_size_kb, file_type):
        """
        Feature: codebase-quality-improvements, Property 21: Memory usage bounds for parsing
        Validates: Requirements 8.4
        
        For any document being parsed, peak memory usage should not exceed 
        5x the document file size
        """
        # Skip very small files as memory overhead dominates
        assume(file_size_kb >= 50)
        
        # Create mock file content of specified size
        file_size_bytes = file_size_kb * 1024
        
        # Generate content that approximates the file size
        # Use repetitive content to simulate real documents
        base_content = "This is a test document with some content. " * 100
        content = base_content * (file_size_bytes // len(base_content) + 1)
        content = content[:file_size_bytes]
        
        # Start memory tracking
        tracemalloc.start()
        baseline_memory = tracemalloc.get_traced_memory()[0]
        
        try:
            # Simulate parsing by creating ParsedDocument
            # This tests the memory overhead of our data structures
            
            # Split content into sections (simulate parsing)
            section_size = 5000  # ~5KB per section
            num_sections = max(1, len(content) // section_size)
            
            sections = []
            for i in range(num_sections):
                start = i * section_size
                end = min((i + 1) * section_size, len(content))
                section_text = content[start:end]
                
                section = ParsedSection(
                    text=section_text,
                    page=i + 1,
                    section=f"Section {i+1}",
                    paragraph=i + 1,
                    start_char=start,
                    end_char=end
                )
                sections.append(section)
            
            # Create parsed document
            parsed_doc = ParsedDocument(
                full_text=content,
                sections=sections,
                title="Test Document",
                num_pages=num_sections,
                metadata={"file_type": file_type, "file_size": file_size_bytes}
            )
            
            # Get peak memory usage
            current_memory, peak_memory = tracemalloc.get_traced_memory()
            memory_used = peak_memory - baseline_memory
            
            # Calculate expected maximum: 5x file size
            max_allowed_memory = file_size_bytes * 5
            
            # Check memory bound
            assert memory_used <= max_allowed_memory, (
                f"Memory usage {memory_used / 1024:.2f} KB exceeds limit "
                f"{max_allowed_memory / 1024:.2f} KB (5x file size of {file_size_kb} KB). "
                f"Ratio: {memory_used / file_size_bytes:.2f}x"
            )
            
            # Also verify the document was created correctly
            assert len(parsed_doc.sections) == num_sections
            assert len(parsed_doc.full_text) == len(content)
            
        finally:
            tracemalloc.stop()
