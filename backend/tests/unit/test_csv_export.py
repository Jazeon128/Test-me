"""Unit tests for CSV export service"""
import pytest
import csv
from io import StringIO

from app.services.csv_export import CSVExporter
from app.models.question import Question, QuestionOption


@pytest.mark.unit
class TestCSVExporter:
    """Tests for CSV export functionality"""

    def test_export_to_string_basic(self, sample_question):
        """Test exporting a single question to CSV string"""
        exporter = CSVExporter()
        csv_content = exporter.export_to_string([sample_question])

        # Parse CSV content
        reader = csv.DictReader(StringIO(csv_content))
        rows = list(reader)

        assert len(rows) == 1
        assert rows[0]['Question'] == "What is Python?"
        assert rows[0]['CorrectAnswer'] == 'A'
        assert rows[0]['Difficulty'] == 'medium'

    def test_export_to_string_multiple_questions(self, db_session, sample_document):
        """Test exporting multiple questions"""
        # Create additional questions
        questions = []
        for i in range(3):
            q = Question(
                document_id=sample_document.id,
                question_text=f"Question {i+1}?",
                explanation=f"Explanation {i+1}",
                difficulty="easy",
                source_reference={"page": i+1}
            )
            db_session.add(q)
            db_session.flush()

            # Add options
            for j in range(4):
                opt = QuestionOption(
                    question_id=q.id,
                    option_text=f"Option {j+1}",
                    is_correct=(j == 0),
                    order=j
                )
                db_session.add(opt)

            db_session.commit()
            db_session.refresh(q)
            questions.append(q)

        exporter = CSVExporter()
        csv_content = exporter.export_to_string(questions)

        reader = csv.DictReader(StringIO(csv_content))
        rows = list(reader)

        assert len(rows) == 3
        for i, row in enumerate(rows):
            assert row['Question'] == f"Question {i+1}?"
            assert row['Explanation'] == f"Explanation {i+1}"

    def test_format_question_row_correct_answer(self, sample_question):
        """Test that correct answer is properly identified"""
        exporter = CSVExporter()
        row = exporter._format_question_row(sample_question)

        # Row format: [Question, OptionA, OptionB, OptionC, OptionD, CorrectAnswer, Explanation, Source, Difficulty]
        assert row[5] == 'A'  # CorrectAnswer field
        assert row[1] == "A programming language"  # OptionA

    def test_format_question_row_with_all_options(self, sample_question):
        """Test formatting with all 4 options"""
        exporter = CSVExporter()
        row = exporter._format_question_row(sample_question)

        assert row[1] == "A programming language"
        assert row[2] == "A snake"
        assert row[3] == "A framework"
        assert row[4] == "A database"

    def test_format_question_row_with_missing_options(self, db_session, sample_document):
        """Test formatting when question has less than 4 options"""
        question = Question(
            document_id=sample_document.id,
            question_text="Binary question?",
            explanation="Test",
            difficulty="easy"
        )
        db_session.add(question)
        db_session.flush()

        # Add only 2 options
        opt1 = QuestionOption(question_id=question.id, option_text="Yes", is_correct=True, order=0)
        opt2 = QuestionOption(question_id=question.id, option_text="No", is_correct=False, order=1)
        db_session.add(opt1)
        db_session.add(opt2)
        db_session.commit()
        db_session.refresh(question)

        exporter = CSVExporter()
        row = exporter._format_question_row(question)

        assert row[1] == "Yes"
        assert row[2] == "No"
        assert row[3] == ""  # Padded empty option
        assert row[4] == ""  # Padded empty option

    def test_format_source_reference_full(self):
        """Test formatting complete source reference"""
        exporter = CSVExporter()
        source_ref = {
            "page": 5,
            "section": "Introduction",
            "text": "This is the source text from the document"
        }

        result = exporter._format_source_reference(source_ref)
        assert "Page 5" in result
        assert "Section: Introduction" in result
        assert '"This is the source text from the document"' in result

    def test_format_source_reference_partial(self):
        """Test formatting partial source reference"""
        exporter = CSVExporter()
        source_ref = {"page": 3}

        result = exporter._format_source_reference(source_ref)
        assert result == "Page 3"

    def test_format_source_reference_long_text_truncation(self):
        """Test that long source text is truncated"""
        exporter = CSVExporter()
        long_text = "a" * 150  # Text longer than 100 chars
        source_ref = {"text": long_text}

        result = exporter._format_source_reference(source_ref)
        assert len(result) < len(long_text) + 10  # Should be truncated
        assert "..." in result

    def test_format_source_reference_empty(self):
        """Test formatting empty source reference"""
        exporter = CSVExporter()
        result = exporter._format_source_reference(None)
        assert result == ""

        result = exporter._format_source_reference({})
        assert result == ""

    def test_csv_headers(self):
        """Test that CSV headers match expected format"""
        exporter = CSVExporter()
        expected_headers = [
            'Question', 'OptionA', 'OptionB', 'OptionC', 'OptionD',
            'CorrectAnswer', 'Explanation', 'Source', 'Difficulty'
        ]
        assert exporter.HEADERS == expected_headers

    def test_export_to_string_special_characters(self, db_session, sample_document):
        """Test handling of special characters in CSV"""
        question = Question(
            document_id=sample_document.id,
            question_text='What is "Python"?',
            explanation="It's a language with 'quotes'",
            difficulty="medium"
        )
        db_session.add(question)
        db_session.flush()

        opt = QuestionOption(
            question_id=question.id,
            option_text='A "programming" language',
            is_correct=True,
            order=0
        )
        db_session.add(opt)
        db_session.commit()
        db_session.refresh(question)

        exporter = CSVExporter()
        csv_content = exporter.export_to_string([question])

        # Should not raise an error and should properly escape quotes
        assert csv_content is not None
        assert "Python" in csv_content

    def test_export_test_object(self, sample_test, tmp_path):
        """Test exporting a Test object to file"""
        exporter = CSVExporter()
        output_file = tmp_path / "test_export.csv"

        result_path = exporter.export_test(None, sample_test, str(output_file))

        assert result_path == str(output_file)
        assert output_file.exists()

        # Read and verify content
        with open(output_file, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
            assert len(rows) == 1
            assert rows[0]['Question'] == "What is Python?"

    def test_export_questions_to_file(self, sample_question, tmp_path):
        """Test exporting questions list to file"""
        exporter = CSVExporter()
        output_file = tmp_path / "questions_export.csv"

        result_path = exporter.export_questions([sample_question], str(output_file))

        assert result_path == str(output_file)
        assert output_file.exists()

        # Verify UTF-8 BOM encoding
        with open(output_file, 'rb') as f:
            first_bytes = f.read(3)
            assert first_bytes == b'\xef\xbb\xbf'  # UTF-8 BOM

    def test_correct_answer_letter_mapping(self, db_session, sample_document):
        """Test correct answer letter mapping for different positions"""
        exporter = CSVExporter()

        for correct_index in range(4):
            question = Question(
                document_id=sample_document.id,
                question_text=f"Question with answer at position {correct_index}",
                difficulty="medium"
            )
            db_session.add(question)
            db_session.flush()

            for i in range(4):
                opt = QuestionOption(
                    question_id=question.id,
                    option_text=f"Option {i}",
                    is_correct=(i == correct_index),
                    order=i
                )
                db_session.add(opt)

            db_session.commit()
            db_session.refresh(question)

            row = exporter._format_question_row(question)
            expected_letter = chr(65 + correct_index)  # A, B, C, or D
            assert row[5] == expected_letter

    def test_missing_explanation_default(self, db_session, sample_document):
        """Test default explanation when none provided"""
        question = Question(
            document_id=sample_document.id,
            question_text="Question without explanation",
            explanation=None,
            difficulty="easy"
        )
        db_session.add(question)
        db_session.commit()

        exporter = CSVExporter()
        row = exporter._format_question_row(question)

        assert row[6] == "No explanation provided."

    def test_missing_difficulty_default(self, db_session, sample_document):
        """Test default difficulty when none provided"""
        question = Question(
            document_id=sample_document.id,
            question_text="Question without difficulty",
            difficulty=None
        )
        db_session.add(question)
        db_session.commit()

        exporter = CSVExporter()
        row = exporter._format_question_row(question)

        assert row[8] == "medium"  # Default difficulty
