"""Parse sources missing passages. Dry run unless --apply is supplied."""
import argparse
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db import SessionLocal
from app.models.document import Document, DocumentType
from app.services.ingest import _parser_for, store_parsed
from app.services.parsers.base_parser import ParsedDocument, ParsedSection
from app.services.passages import split_passages
from app.services.source_names import display_name


def _parse_offline(document):
    if document.file_type != DocumentType.YOUTUBE:
        return _parser_for(document.file_type).parse(document.file_path)
    if not document.content:
        raise ValueError("No stored YouTube transcript. Offline backfill cannot fetch it.")
    return ParsedDocument(
        full_text=document.content, sections=[ParsedSection(text=document.content)],
        title=document.title, num_pages=document.num_pages,
    )


def run(db, apply: bool):
    documents = db.query(Document).filter(~Document.passages.any()).order_by(Document.id).all()
    for document in documents:
        name = display_name(document)
        try:
            if not Path(document.file_path).is_file():
                raise FileNotFoundError(f"Missing file: {document.file_path}")
            parsed = _parse_offline(document)
            count = len(split_passages(parsed.sections))
            if apply:
                store_parsed(db, document, parsed)
                db.commit()
            print(f"{document.id}, {name}, passages={count}")
        except Exception as error:
            if apply:
                db.rollback()
                document.status = "failed"
                document.error_message = str(error) or type(error).__name__
                db.commit()
            print(f"{document.id}, {name}, failed: {error}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    with SessionLocal() as db:
        run(db, args.apply)


if __name__ == "__main__":
    main()
