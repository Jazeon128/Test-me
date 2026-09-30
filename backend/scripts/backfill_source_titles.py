"""Backfill missing YouTube titles. Dry run unless --apply is supplied."""
import argparse
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db import SessionLocal
from app.models.document import Document, DocumentType
from app.services.parsers.youtube import YouTubeParser


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    with SessionLocal() as db:
        documents = db.query(Document).filter(Document.file_type == DocumentType.YOUTUBE).all()
        for document in documents:
            if document.title and document.title.strip():
                continue
            url = Path(document.file_path).read_text(encoding="utf-8").strip()
            title = YouTubeParser.fetch_title(url)
            print(f"{document.id}: {document.title!r} -> {title!r}")
            if args.apply:
                document.title = title
        if args.apply:
            db.commit()


if __name__ == "__main__":
    main()
