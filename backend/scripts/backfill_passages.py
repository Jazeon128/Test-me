"""Recover longer source passages. Run from backend, with --apply to commit."""

import argparse
from pathlib import Path
import sys

# Direct script execution puts scripts/, rather than backend/, on sys.path.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db import SessionLocal
from app.models.question import Question
from app.services.ai.question_generator import passage_from
from app.services.parsers import get_parser_for_type


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Commit recovered passages")
    args = parser.parse_args(argv)
    checked = filled = no_match = missing_file = 0
    sections_by_document = {}
    with SessionLocal() as db:
        for question in db.query(Question).order_by(Question.id):
            reference = question.source_reference or {}
            if not reference.get("text") or "passage" in reference:
                continue
            checked += 1
            if question.document_id not in sections_by_document:
                document = question.document
                if document is None or not Path(document.file_path).is_file():
                    sections_by_document[question.document_id] = None
                else:
                    sections_by_document[question.document_id] = get_parser_for_type(
                        document.file_type
                    ).parse(document.file_path).sections
            sections = sections_by_document[question.document_id]
            if sections is None:
                missing_file += 1
                continue
            prefix = " ".join(reference["text"].removesuffix("...").split())
            section = next(
                (section for section in sections if " ".join(section.text.split()).startswith(prefix)),
                None,
            )
            if section is None:
                no_match += 1
                continue
            filled += 1
            if args.apply:
                question.source_reference = {**reference, "passage": passage_from(section.text)}
        if args.apply:
            db.commit()
    print(
        f"questions checked: {checked}, filled: {filled}, "
        f"no match: {no_match}, missing file: {missing_file}"
    )


if __name__ == "__main__":
    main()
