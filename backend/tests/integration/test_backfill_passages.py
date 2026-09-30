import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.document import Document, DocumentType
from app.models.question import Question
from app.services.ai.question_generator import passage_from
from scripts import backfill_passages


@pytest.fixture
def backfill_db(tmp_path, monkeypatch):
    engine = create_engine("sqlite:///" + str(tmp_path / "backfill.db"))
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    monkeypatch.setattr(backfill_passages, "SessionLocal", factory)
    yield factory
    engine.dispose()


def add_question(factory, path, reference):
    with factory() as db:
        document = Document(
            filename=path.name, original_filename=path.name, file_type=DocumentType.MARKDOWN,
            file_path=str(path), file_size=0,
        )
        question = Question(document=document, question_text="A question?", source_reference=reference)
        db.add(question)
        db.commit()
        return question.id


@pytest.mark.parametrize("apply", [False, True])
def test_backfill_markdown_apply_and_dry_run(backfill_db, tmp_path, capsys, apply):
    passage = "A source paragraph begins here. " + "More source facts. " * 150
    path = tmp_path / "source.md"
    path.write_text("# Source\n\n" + passage, encoding="utf-8")
    original = {"text": passage[:200] + "...", "page": 1, "section": "Source", "paragraph": 2}
    question_id = add_question(backfill_db, path, original)
    backfill_passages.main(["--apply"] if apply else [])
    assert capsys.readouterr().out.strip() == (
        "questions checked: 1, filled: 1, no match: 0, missing file: 0"
    )
    with backfill_db() as db:
        reference = db.get(Question, question_id).source_reference
        assert reference == ({**original, "passage": passage_from(passage.strip())} if apply else original)


def test_missing_file_is_counted(backfill_db, tmp_path, capsys):
    question_id = add_question(backfill_db, tmp_path / "missing.md", {"text": "Missing source..."})
    backfill_passages.main(["--apply"])
    assert capsys.readouterr().out.strip() == (
        "questions checked: 1, filled: 0, no match: 0, missing file: 1"
    )
    with backfill_db() as db:
        assert db.get(Question, question_id).source_reference == {"text": "Missing source..."}


def test_backfill_normalises_prefix_and_parses_each_document_once(
    backfill_db, tmp_path, monkeypatch, capsys
):
    path = tmp_path / "source.md"
    first = "The first section has enough text to be parsed. Its later fact."
    second = "The second section has enough text to be parsed. Its later fact."
    path.write_text(f"# Source\n\n{first}\n\n{second}", encoding="utf-8")
    question_id = add_question(backfill_db, path, {"text": " The  first\nsection..."})
    with backfill_db() as db:
        document_id = db.get(Question, question_id).document_id
        db.add_all([
            Question(document_id=document_id, question_text="Second?", source_reference={"text": second[:30] + "..."}),
            Question(document_id=document_id, question_text="Unmatched?", source_reference={"text": "No such prefix..."}),
            Question(document_id=document_id, question_text="Existing?", source_reference={"text": first, "passage": "Keep this."}),
            Question(document_id=document_id, question_text="Manual?", source_reference=None),
        ])
        db.commit()
    parser = backfill_passages.get_parser_for_type(DocumentType.MARKDOWN)
    calls = []
    original_parse = parser.parse

    def parse(file_path):
        calls.append(file_path)
        return original_parse(file_path)

    monkeypatch.setattr(parser, "parse", parse)
    monkeypatch.setattr(backfill_passages, "get_parser_for_type", lambda file_type: parser)
    backfill_passages.main(["--apply"])
    assert calls == [str(path)]
    assert capsys.readouterr().out.strip() == (
        "questions checked: 3, filled: 2, no match: 1, missing file: 0"
    )
    with backfill_db() as db:
        assert db.get(Question, question_id).source_reference["passage"] == first
        assert db.query(Question).filter_by(question_text="Second?").one().source_reference["passage"] == second
        assert db.query(Question).filter_by(question_text="Existing?").one().source_reference["passage"] == "Keep this."
