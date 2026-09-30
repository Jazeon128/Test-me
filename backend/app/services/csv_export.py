import csv
from typing import List
from io import StringIO
from ..models.question import Question
from ..models.test import Test
from sqlalchemy.orm import Session


class CSVExporter:
    """Export questions to spreadsheet CSV format"""

    # CSV Headers for simplified format
    HEADERS = [
        "Question",
        "OptionA",
        "OptionB",
        "OptionC",
        "OptionD",
        "CorrectAnswer",
        "Explanation",
        "Source",
        "Difficulty",
    ]

    def export_test(self, db: Session, test: Test, output_path: str) -> str:
        """
        Export a test to CSV format

        Args:
            db: Database session
            test: Test object to export
            output_path: Path where the CSV file will be saved

        Returns:
            Path to the created CSV file
        """
        with open(output_path, "w", newline="", encoding="utf-8-sig") as csvfile:
            writer = csv.writer(csvfile, quoting=csv.QUOTE_ALL)

            # Write header row
            writer.writerow(self.HEADERS)

            # Write each question as a row
            for question in test.questions:
                row = self._format_question_row(question)
                writer.writerow(row)

        return output_path

    def export_questions(self, questions: List[Question], output_path: str) -> str:
        """
        Export a list of questions to CSV format

        Args:
            questions: List of Question objects
            output_path: Path where the CSV file will be saved

        Returns:
            Path to the created CSV file
        """
        with open(output_path, "w", newline="", encoding="utf-8-sig") as csvfile:
            writer = csv.writer(csvfile, quoting=csv.QUOTE_ALL)

            # Write header row
            writer.writerow(self.HEADERS)

            # Write each question
            for question in questions:
                row = self._format_question_row(question)
                writer.writerow(row)

        return output_path

    def export_to_string(self, questions: List[Question]) -> str:
        """
        Export questions to CSV string (useful for API responses)

        Args:
            questions: List of Question objects

        Returns:
            CSV content as string
        """
        output = StringIO()
        writer = csv.writer(output, quoting=csv.QUOTE_ALL)

        # Write header
        writer.writerow(self.HEADERS)

        # Write questions
        for question in questions:
            row = self._format_question_row(question)
            writer.writerow(row)

        return output.getvalue()

    def _format_question_row(self, question: Question) -> List[str]:
        """
        Format a Question object as a CSV row

        Args:
            question: Question object

        Returns:
            List of strings representing the CSV row
        """
        # Sort options by order
        options = sorted(question.options, key=lambda x: x.order)

        # Extract option texts (pad if less than 4 options)
        option_texts = [opt.option_text for opt in options] + [""] * (4 - len(options))

        # Find correct answer letter (A, B, C, or D)
        correct_answer = ""
        for opt in options:
            if opt.is_correct:
                correct_answer = chr(65 + opt.order)  # Convert 0->A, 1->B, etc.
                break

        # Format source reference from JSON
        source = self._format_source_reference(question.source_reference or {})  # type: ignore[arg-type]

        # Build row
        row = [
            question.question_text,
            option_texts[0],
            option_texts[1],
            option_texts[2],
            option_texts[3],
            correct_answer or "A",  # Default to A if no correct answer found
            question.explanation or "No explanation provided.",
            source,
            question.difficulty or "medium",
        ]

        # Protect spreadsheet cells only: Anki CSV prefixes would show on cards.
        return ["'" + cell if cell.startswith(("=", "+", "-", "@", "\t", "\r")) else cell for cell in row]

    def _format_source_reference(self, source_reference: dict) -> str:
        """
        Format source reference from JSON to readable string

        Args:
            source_reference: Dictionary with page, section, text keys

        Returns:
            Formatted reference string
        """
        if not source_reference:
            return ""

        parts = []

        if source_reference.get("page"):
            parts.append(f"Page {source_reference['page']}")

        if source_reference.get("section"):
            parts.append(f"Section: {source_reference['section']}")

        if source_reference.get("text"):
            text = source_reference["text"]
            # Truncate long text to 100 characters
            if len(text) > 100:
                text = text[:100] + "..."
            parts.append(f'"{text}"')

        return ", ".join(parts)
