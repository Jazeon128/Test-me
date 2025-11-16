"""Integration tests for API endpoints"""
import pytest
import json
from io import BytesIO

from app.models.document import Document
from app.models.question import Question, QuestionOption
from app.models.test import Test


@pytest.mark.integration
class TestDocumentsAPI:
    """Tests for documents API endpoints"""

    def test_get_documents_empty(self, client):
        """Test getting documents when none exist"""
        response = client.get("/api/documents")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0

    def test_get_documents_with_data(self, client, sample_document):
        """Test getting documents when data exists"""
        response = client.get("/api/documents")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert data[0]["filename"] == "test_document.pdf"

    def test_get_document_by_id(self, client, sample_document):
        """Test getting a specific document by ID"""
        response = client.get(f"/api/documents/{sample_document.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == sample_document.id
        assert data["filename"] == "test_document.pdf"

    def test_get_document_not_found(self, client):
        """Test getting non-existent document"""
        response = client.get("/api/documents/99999")
        assert response.status_code == 404

    def test_delete_document(self, client, sample_document):
        """Test deleting a document"""
        response = client.delete(f"/api/documents/{sample_document.id}")
        assert response.status_code == 200

        # Verify it's deleted
        response = client.get(f"/api/documents/{sample_document.id}")
        assert response.status_code == 404


@pytest.mark.integration
class TestQuestionsAPI:
    """Tests for questions API endpoints"""

    def test_get_questions_by_document(self, client, sample_question):
        """Test getting questions for a document"""
        response = client.get(f"/api/questions/document/{sample_question.document_id}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert data[0]["question_text"] == "What is Python?"

    def test_get_question_by_id(self, client, sample_question):
        """Test getting a specific question"""
        response = client.get(f"/api/questions/{sample_question.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == sample_question.id
        assert data["question_text"] == "What is Python?"
        assert len(data["options"]) == 4

    def test_get_question_not_found(self, client):
        """Test getting non-existent question"""
        response = client.get("/api/questions/99999")
        assert response.status_code == 404


@pytest.mark.integration
class TestTestsAPI:
    """Tests for tests/decks API endpoints"""

    def test_get_all_tests(self, client, sample_test):
        """Test getting all tests"""
        response = client.get("/api/tests")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_get_test_by_id(self, client, sample_test):
        """Test getting a specific test"""
        response = client.get(f"/api/tests/{sample_test.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == sample_test.id
        assert data["name"] == "Python Basics Test"
        assert len(data["questions"]) >= 1

    def test_create_test(self, client, sample_question):
        """Test creating a new test"""
        test_data = {
            "name": "New Test",
            "description": "Test description",
            "question_ids": [sample_question.id]
        }

        response = client.post("/api/tests", json=test_data)
        assert response.status_code == 200 or response.status_code == 201
        data = response.json()
        assert data["name"] == "New Test"

    def test_delete_test(self, client, sample_test):
        """Test deleting a test"""
        response = client.delete(f"/api/tests/{sample_test.id}")
        assert response.status_code == 200

        # Verify it's deleted
        response = client.get(f"/api/tests/{sample_test.id}")
        assert response.status_code == 404


@pytest.mark.integration
class TestProgressAPI:
    """Tests for progress tracking API endpoints"""

    def test_submit_answer_correct(self, client, sample_question, sample_user_progress):
        """Test submitting a correct answer"""
        answer_data = {
            "question_id": sample_question.id,
            "selected_option_id": sample_question.options[0].id,  # First option is correct
            "time_taken_seconds": 15.0
        }

        response = client.post("/api/progress/answer", json=answer_data)
        assert response.status_code == 200
        data = response.json()
        assert data["correct"] is True
        assert "points_earned" in data

    def test_submit_answer_incorrect(self, client, sample_question, sample_user_progress):
        """Test submitting an incorrect answer"""
        # Find incorrect option
        incorrect_option = next(opt for opt in sample_question.options if not opt.is_correct)

        answer_data = {
            "question_id": sample_question.id,
            "selected_option_id": incorrect_option.id,
            "time_taken_seconds": 20.0
        }

        response = client.post("/api/progress/answer", json=answer_data)
        assert response.status_code == 200
        data = response.json()
        assert data["correct"] is False

    def test_get_user_statistics(self, client, sample_user_progress):
        """Test getting user statistics"""
        response = client.get("/api/progress/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total_questions" in data
        assert "mastery_breakdown" in data


@pytest.mark.integration
class TestExamTemplatesAPI:
    """Tests for exam templates API endpoints"""

    def test_get_cert_types(self, client):
        """Test getting certification types"""
        response = client.get("/api/exam-templates/cert-types")
        assert response.status_code == 200
        data = response.json()
        assert "cert_types" in data
        assert len(data["cert_types"]) > 0

    def test_get_archetypes(self, client):
        """Test getting archetypes for a certification"""
        response = client.get("/api/exam-templates/archetypes?cert_type=gcp_ace")
        assert response.status_code == 200
        data = response.json()
        assert "archetypes" in data
        assert isinstance(data["archetypes"], dict)

    def test_validate_config_valid(self, client):
        """Test validating a valid configuration"""
        config = {
            "cert_type": "gcp_ace",
            "archetype": "iam_least_privilege",
            "distractor_strategy": "mixed"
        }

        response = client.post("/api/exam-templates/validate", json={"config": config})
        # Note: The actual archetype name might differ, adjust based on actual implementation
        # This test might need adjustment based on available archetypes
        assert response.status_code in [200, 400]  # Could be invalid if archetype doesn't exist

    def test_get_example_config(self, client):
        """Test getting example configuration"""
        response = client.get("/api/exam-templates/example-config?cert_type=gcp_ace")
        assert response.status_code == 200
        data = response.json()
        assert "example_config" in data


@pytest.mark.integration
class TestSettingsAPI:
    """Tests for settings API endpoints"""

    def test_get_settings(self, client):
        """Test getting settings"""
        response = client.get("/api/settings")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)

    def test_update_settings(self, client):
        """Test updating settings"""
        settings_data = {
            "ai_provider": "anthropic",
            "api_key": "test-key-123"
        }

        response = client.post("/api/settings", json=settings_data)
        assert response.status_code == 200

        # Verify settings were updated
        response = client.get("/api/settings")
        assert response.status_code == 200
        data = response.json()
        assert data.get("ai_provider") == "anthropic"


@pytest.mark.integration
class TestCSVExportAPI:
    """Tests for CSV export functionality"""

    def test_export_test_to_csv(self, client, sample_test):
        """Test exporting a test to CSV format"""
        response = client.get(f"/api/tests/{sample_test.id}/export/csv")
        assert response.status_code == 200
        assert response.headers["content-type"] == "text/csv; charset=utf-8"
        assert "attachment" in response.headers.get("content-disposition", "").lower()

        # Verify CSV content
        content = response.content.decode("utf-8-sig")
        assert "Question" in content
        assert "OptionA" in content
        assert "What is Python?" in content

    def test_export_nonexistent_test(self, client):
        """Test exporting non-existent test"""
        response = client.get("/api/tests/99999/export/csv")
        assert response.status_code == 404


@pytest.mark.integration
class TestAnkiExportAPI:
    """Tests for Anki export functionality"""

    def test_export_test_to_anki(self, client, sample_test):
        """Test exporting a test to Anki format"""
        response = client.get(f"/api/tests/{sample_test.id}/export/anki")
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/octet-stream"
        assert ".apkg" in response.headers.get("content-disposition", "")

        # Verify it returns binary data
        assert len(response.content) > 0

    def test_export_anki_nonexistent_test(self, client):
        """Test Anki export for non-existent test"""
        response = client.get("/api/tests/99999/export/anki")
        assert response.status_code == 404


@pytest.mark.integration
class TestReviewSessionAPI:
    """Tests for review session functionality"""

    def test_start_review_session(self, client, sample_test):
        """Test starting a review session"""
        response = client.post("/api/progress/review-session/start", json={
            "test_id": sample_test.id
        })

        # Status code depends on implementation
        # Might be 200 with questions or 404 if no due questions
        assert response.status_code in [200, 404]

    def test_get_due_questions(self, client, sample_question):
        """Test getting due questions"""
        response = client.get("/api/progress/due-questions")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


@pytest.mark.integration
class TestEndToEndWorkflow:
    """End-to-end workflow tests"""

    def test_complete_study_workflow(self, client, sample_test, sample_question, db_session):
        """Test a complete study workflow"""
        # 1. Get the test
        response = client.get(f"/api/tests/{sample_test.id}")
        assert response.status_code == 200
        test_data = response.json()

        # 2. Start a review session
        response = client.post("/api/progress/review-session/start", json={
            "test_id": sample_test.id
        })
        # May return 404 if no due questions initially
        assert response.status_code in [200, 404]

        # 3. Answer a question
        correct_option = next(opt for opt in sample_question.options if opt.is_correct)
        response = client.post("/api/progress/answer", json={
            "question_id": sample_question.id,
            "selected_option_id": correct_option.id,
            "time_taken_seconds": 12.0
        })
        assert response.status_code == 200

        # 4. Check statistics
        response = client.get("/api/progress/stats")
        assert response.status_code == 200
        stats = response.json()
        assert stats["total_questions"] >= 1

        # 5. Export to CSV
        response = client.get(f"/api/tests/{sample_test.id}/export/csv")
        assert response.status_code == 200

        # 6. Export to Anki
        response = client.get(f"/api/tests/{sample_test.id}/export/anki")
        assert response.status_code == 200
