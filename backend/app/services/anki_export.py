import genanki
import html
import random
from typing import List
from ..models.question import Question
from ..models.test import Test
from sqlalchemy.orm import Session


# New fixed ID: adding CorrectA-D fields requires a new Anki note type.
MODEL_ID = 1874562391
BASIC_MODEL_ID = 1874562392


def _escape_text(text: str) -> str:
    return html.escape(text, quote=False).replace("\n", "<br>")


def is_flashcard(question: Question) -> bool:
    return question.card_type == "flashcard" or (
        len(question.options) == 1
        and question.options[0].option_text == "Flip to see answer"
    )


class AnkiExporter:
    """Export questions to Anki .apkg format"""

    def __init__(self) -> None:
        # Create a custom model for our multiple-choice questions
        self.model = genanki.Model(
            MODEL_ID,
            "Test Me - Multiple Choice",
            fields=[
                {"name": "Question"},
                {"name": "OptionA"},
                {"name": "OptionB"},
                {"name": "OptionC"},
                {"name": "OptionD"},
                {"name": "CorrectAnswer"},
                {"name": "Explanation"},
                {"name": "Reference"},
                {"name": "CorrectA"},
                {"name": "CorrectB"},
                {"name": "CorrectC"},
                {"name": "CorrectD"},
            ],
            templates=[
                {
                    "name": "Multiple Choice Card",
                    "qfmt": """
                        <div class="question">{{Question}}</div>
                        <hr>
                        <div class="options">
                            <div class="option">A) {{OptionA}}</div>
                            <div class="option">B) {{OptionB}}</div>
                            <div class="option">C) {{OptionC}}</div>
                            <div class="option">D) {{OptionD}}</div>
                        </div>
                    """,
                    "afmt": """
                        <div class="question">{{Question}}</div>
                        <hr>
                        <div class="options">
                            <div class="option {{#CorrectA}}correct{{/CorrectA}}">A) {{OptionA}}</div>
                            <div class="option {{#CorrectB}}correct{{/CorrectB}}">B) {{OptionB}}</div>
                            <div class="option {{#CorrectC}}correct{{/CorrectC}}">C) {{OptionC}}</div>
                            <div class="option {{#CorrectD}}correct{{/CorrectD}}">D) {{OptionD}}</div>
                        </div>
                        <hr>
                        <div class="answer">
                            <strong>Correct Answer: {{CorrectAnswer}}</strong>
                        </div>
                        <div class="explanation">
                            {{Explanation}}
                        </div>
                        {{#Reference}}
                        <div class="reference">
                            <em>Reference: {{Reference}}</em>
                        </div>
                        {{/Reference}}
                    """,
                },
            ],
            css="""
                .card {
                    font-family: arial;
                    font-size: 20px;
                    text-align: center;
                    color: black;
                    background-color: white;
                }
                .question {
                    font-size: 24px;
                    font-weight: bold;
                    margin-bottom: 20px;
                }
                .options {
                    text-align: left;
                    margin: 20px auto;
                    max-width: 600px;
                }
                .option {
                    padding: 10px;
                    margin: 5px 0;
                    border: 1px solid #ddd;
                    border-radius: 5px;
                }
                .option.correct {
                    background-color: #d4edda;
                    border-color: #28a745;
                    font-weight: bold;
                }
                .answer {
                    color: #28a745;
                    font-size: 18px;
                    margin: 15px 0;
                }
                .explanation {
                    color: #666;
                    font-size: 16px;
                    margin: 15px auto;
                    max-width: 600px;
                    text-align: left;
                }
                .reference {
                    color: #999;
                    font-size: 14px;
                    margin-top: 15px;
                    font-style: italic;
                }
            """,
        )

        self.basic_model = genanki.Model(
            BASIC_MODEL_ID, "Test Me - Basic",
            fields=[{"name": "Front"}, {"name": "Back"}, {"name": "Source"}],
            templates=[{"name": "Basic", "qfmt": "{{Front}}",
                        "afmt": '{{FrontSide}}<hr id="answer">{{Back}}'
                                '{{#Source}}<hr>{{Source}}{{/Source}}'}],
        )

    def export_test(self, db: Session, test: Test, output_path: str) -> str:
        """
        Export a test to an Anki deck

        Args:
            db: Database session
            test: Test object to export
            output_path: Path where the .apkg file will be saved

        Returns:
            Path to the created .apkg file
        """
        # Create deck
        deck = genanki.Deck(random.randrange(1 << 30, 1 << 31), test.name)  # Random deck ID

        # Add each question as a note
        for question in test.questions:
            note = self._create_note_from_question(question)
            deck.add_note(note)

        # Generate package
        package = genanki.Package(deck)
        package.write_to_file(output_path)

        return output_path

    def export_questions(self, questions: List[Question], deck_name: str, output_path: str) -> str:
        """
        Export a list of questions to an Anki deck

        Args:
            questions: List of Question objects
            deck_name: Name for the Anki deck
            output_path: Path where the .apkg file will be saved

        Returns:
            Path to the created .apkg file
        """
        # Create deck
        deck = genanki.Deck(random.randrange(1 << 30, 1 << 31), deck_name)

        # Add each question
        for question in questions:
            note = self._create_note_from_question(question)
            deck.add_note(note)

        # Generate package
        package = genanki.Package(deck)
        package.write_to_file(output_path)

        return output_path

    def _create_note_from_question(self, question: Question) -> genanki.Note:
        """Create an Anki note from a Question object"""
        # Sort options by order
        options = sorted(question.options, key=lambda x: x.order)

        # Extract option texts (pad if less than 4 options)
        option_texts = [opt.option_text for opt in options] + [""] * (4 - len(options))

        # Find correct answer letter
        correct_answer = None
        for opt in options:
            if opt.is_correct:
                correct_answer = chr(65 + opt.order)  # Convert 0->A, 1->B, etc.
                break

        # Format reference
        reference = ""
        if question.source_reference:
            ref = question.source_reference
            parts = []
            if ref.get("page"):
                parts.append(f"Page {ref['page']}")
            if ref.get("section"):
                parts.append(f"Section: {ref['section']}")
            if ref.get("text"):
                text = ref["text"][:100] + "..." if len(ref["text"]) > 100 else ref["text"]
                parts.append(f'"{text}"')
            reference = ", ".join(parts)

        if is_flashcard(question):
            return genanki.Note(
                model=self.basic_model,
                fields=[_escape_text(question.question_text),
                        _escape_text(question.explanation or ""), _escape_text(reference)],
                tags=[f"difficulty:{question.difficulty}"],
            )

        # Create note
        note = genanki.Note(
            model=self.model,
            fields=[
                _escape_text(question.question_text),
                _escape_text(option_texts[0]),
                _escape_text(option_texts[1]),
                _escape_text(option_texts[2]),
                _escape_text(option_texts[3]),
                correct_answer or "A",
                _escape_text(question.explanation or "No explanation provided."),
                _escape_text(reference),
            ] + ["1" if correct_answer == letter else "" for letter in "ABCD"],
            tags=[f"difficulty:{question.difficulty}"],
        )

        return note
