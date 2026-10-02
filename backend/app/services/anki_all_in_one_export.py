import csv
import html
from typing import List
from .anki_export import is_flashcard
from ..models.question import Question
from ..models.test import Test
from sqlalchemy.orm import Session


def _escape_text(text: str) -> str:
    return html.escape(text, quote=False).replace("\n", "<br>")


# Anki consumes this CSV, so spreadsheet apostrophe prefixes would show on cards.
class AnkiAllInOneExporter:
    """Export questions to CSV format compatible with Anki AllInOne note type"""

    # CSV Headers for AllInOne format (11 columns)
    HEADERS = [
        "Question",
        "QType",
        "Q_1",
        "Q_2",
        "Q_3",
        "Q_4",
        "Q_5",
        "Answers",
        "Sources",
        "Extra 1",
        "Tags",
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

    def _format_question_row(self, question: Question) -> List[str]:
        """
        Format a Question object as a CSV row for AllInOne format

        Args:
            question: Question object

        Returns:
            List of strings representing the CSV row
        """
        if is_flashcard(question):
            return [_escape_text(question.question_text),
                    _escape_text(question.explanation or "")]

        # Sort options by order
        options = sorted(question.options, key=lambda x: x.order)

        # Extract option texts (pad if less than 5 options)
        # AllInOne format expects up to 5 options (Q_1 to Q_5)
        option_texts = [_escape_text(opt.option_text) for opt in options] + [""] * (5 - len(options))

        # Truncate if more than 5 options (though UI usually limits to 4)
        option_texts = option_texts[:5]

        # Determine QType and Answers binary string
        # QType: 1 = Multiple choice (multiple correct), 2 = Single choice (one correct)
        correct_indices = [i for i, opt in enumerate(options) if opt.is_correct]

        if len(correct_indices) > 1:
            q_type = "1"
        else:
            q_type = "2"

        # Build binary answer string (e.g., "0 1 0 0 0")
        # Must be 5 digits separated by spaces
        answers_list = ["0"] * 5
        for idx in correct_indices:
            if idx < 5:
                answers_list[idx] = "1"

        answers_str = " ".join(answers_list)

        # Format Explanation (Extra 1) as HTML
        explanation_html = self._format_explanation_html(question, options)

        # Build row
        row = [
            _escape_text(question.question_text),  # Question
            q_type,  # QType
            option_texts[0],  # Q_1
            option_texts[1],  # Q_2
            option_texts[2],  # Q_3
            option_texts[3],  # Q_4
            option_texts[4],  # Q_5
            answers_str,  # Answers
            "",  # Sources (empty)
            explanation_html,  # Extra 1 (Explanation)
            "",  # Tags (empty)
        ]

        return row

    def _format_explanation_html(self, question: Question, options: List) -> str:
        """
        Format the explanation field as HTML according to requirements
        """
        # Find correct answer(s) for the header
        correct_options = [opt for opt in options if opt.is_correct]
        correct_labels = [chr(65 + opt.order) for opt in correct_options]
        correct_header = (
            f"{' and '.join(correct_labels)} is correct" if correct_labels else "Correct Answer"
        )

        # Start HTML
        html_parts = ['<div class="explanation">']

        # Add correct answer statement in green bold
        # Using the provided explanation text if available, otherwise generic text
        explanation_text = _escape_text(question.explanation or "No detailed explanation provided.")
        html_parts.append(
            f'<p style="color: #2d7a2d; font-weight: bold;">{correct_header} - {explanation_text}</p>'
        )

        # Add bullet list for options (if we had specific reasons for each, we'd list them)
        # Since we only have a general explanation, we'll just list the options and their status
        html_parts.append('<ul style="margin: 10px 0; padding-left: 20px;">')

        for opt in options:
            label = chr(65 + opt.order)
            status = "Correct" if opt.is_correct else "Incorrect"
            # We don't have specific "why wrong" text per option in our model,
            # so we'll just list the option text.
            # If we had per-option feedback, we would insert it here.
            html_parts.append(
                f"<li><strong>Option {label}:</strong> {_escape_text(opt.option_text)} ({status})</li>"
            )

        html_parts.append("</ul>")
        html_parts.append("</div>")

        return "".join(html_parts)
