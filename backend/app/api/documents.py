from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, BackgroundTasks
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import update, case, or_
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from typing import List, Optional
import os
import hashlib
from datetime import datetime
import traceback
import uuid

from ..utils.cache import invalidate_stats_cache
from ..db import get_db
from ..models.document import Document, DocumentType
from ..models.passage import DocumentPassage
from ..models.question import Question, QuestionOption
from ..models.test import Test
from ..models.generation_status import GenerationStatus
from ..models.flagged_question import FlaggedQuestion
from ..services.parsers import (
    PDFParser,
    HTMLParser,
    MarkdownParser,
    DOCXParser,
    YouTubeParser,
    PowerPointParser,
)
from ..services.ai import QuestionGenerator, sourcing
from ..config import settings
from ..utils.logging import get_logger
from ..utils.file_validation import validate_upload_file
from ..services.source_names import display_name
from ..services.notebooks import resolve_notebook_id
from ..services.generation import remove_failed_empty_deck
from ..services.ingest import store_passages, passage_counts, source_fields
from .questions import _typesafe_key
from ..exceptions import (
    FileUploadError,
    ResourceNotFoundError,
    AIServiceError,
    QuestionGenerationError,
)

logger = get_logger(__name__)

router = APIRouter()


@router.post("/upload")
async def upload_document(
    files: List[UploadFile] = File(...),
    num_questions: int = Form(10),
    difficulty: str = Form("mixed"),
    deck_id: Optional[str] = Form(None),
    deck_name: Optional[str] = Form(None),
    deck_description: Optional[str] = Form(None),
    notebook_id: Optional[int] = Form(None),
    regenerate: bool = Form(False),
    custom_prompt: Optional[str] = Form(None),
    skip_preflight: bool = Form(False),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
):
    """
    Upload one or more documents and generate questions

    Args:
        files: One or more document files (PDF, HTML, MD, DOCX)
        num_questions: Number of questions to generate per document (default 10)
        difficulty: Question difficulty - "easy", "medium", "hard", or "mixed"
        deck_id: Optional deck ID to add questions to existing deck
        deck_name: Name for new deck (if creating)
        deck_description: Description for new deck (if creating)
        notebook_id: The notebook these sources belong to
        regenerate: If True, regenerate all questions from all documents in deck
        custom_prompt: Custom instructions for question generation
        skip_preflight: If True, generate without checking the sources first
    """
    type_mapping = {
        ".pdf": DocumentType.PDF,
        ".html": DocumentType.HTML,
        ".htm": DocumentType.HTML,
        ".md": DocumentType.MARKDOWN,
        ".docx": DocumentType.DOCX,
        ".pptx": DocumentType.PPTX,
        ".youtube": DocumentType.YOUTUBE,
    }

    notebook_id = resolve_notebook_id(db, notebook_id)
    uploaded_documents = []

    # Get or create deck
    deck = None
    deck_created = False
    if deck_id and deck_id != "new":
        # Use existing deck
        try:
            deck_id_int = int(deck_id)
            deck = db.query(Test).filter(Test.id == deck_id_int).first()
            if not deck:
                raise HTTPException(status_code=404, detail="Deck not found")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid deck_id format")
    else:
        # Create new deck with meaningful name based on uploaded files
        if not deck_name:
            if len(files) == 1:
                # Single file: use filename without extension
                base_name = os.path.splitext(files[0].filename)[0]
                final_deck_name = f"{base_name}"
            else:
                # Multiple files: use first filename + count
                base_name = os.path.splitext(files[0].filename)[0]
                final_deck_name = f"{base_name} + {len(files)-1} more"
        else:
            final_deck_name = deck_name

        final_deck_description = deck_description or f"Questions from {len(files)} document(s)"
        deck = Test(
            name=final_deck_name,
            description=final_deck_description,
            notebook_id=notebook_id,
        )
        db.add(deck)
        db.commit()
        invalidate_stats_cache()
        db.refresh(deck)
        deck_created = True

    for file in files:
        try:
            # Validate file (type, size, content)
            content = await validate_upload_file(file)
            file_size = len(content)
            file_ext = os.path.splitext(file.filename)[1].lower()
        except FileUploadError as e:
            # Log validation failure and skip this file
            logger.warning(
                "file_validation_failed",
                filename=file.filename,
                error_code=e.code,
                error_message=e.message,
                details=e.details,
            )
            # Re-raise to return error to client
            raise

        # Save file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        filename = f"{timestamp}_{file.filename}"
        file_path = os.path.join(settings.UPLOAD_DIR, filename)

        with open(file_path, "wb") as f:
            f.write(content)

        # Calculate content hash
        content_hash = hashlib.sha256(content).hexdigest()

        # Create document record
        document = Document(
            notebook_id=notebook_id,
            filename=filename,
            original_filename=file.filename,
            file_type=type_mapping[file_ext],
            file_path=file_path,
            file_size=file_size,
            content_hash=content_hash,
        )

        if document.file_type == DocumentType.YOUTUBE:
            document.title = await run_in_threadpool(
                YouTubeParser.fetch_title, content.decode("utf-8").strip()
            )
        db.add(document)
        db.commit()
        invalidate_stats_cache()
        db.refresh(document)

        uploaded_documents.append(
            {
                "id": document.id,
                "filename": file.filename,
                "display_name": display_name(document),
                "file_path": file_path,
                "file_type": type_mapping[file_ext],
            }
        )

    # Create generation status record
    source_ids = [document["id"] for document in uploaded_documents]
    if deck_created:
        deck.source_ids = source_ids
    job_id = str(uuid.uuid4())
    gen_status = GenerationStatus(
        job_id=job_id,
        deck_id=deck.id,
        result_id=deck.id,
        deck_created=deck_created,
        notebook_id=notebook_id,
        source_ids=source_ids,
        kind="regenerate" if regenerate and not deck_created else "quiz",
        status="pending",
        total_documents=len(uploaded_documents),
        total_questions_requested=num_questions * len(uploaded_documents),
        logs=[],
    )
    gen_status.add_log("Generation job created")
    gen_status.add_log(f"Uploaded {len(uploaded_documents)} document(s)")
    db.add(gen_status)
    db.commit()
    db.refresh(gen_status)

    pending_request = {
        "mode": "regenerate" if (regenerate and deck_id and deck_id != "new") else "normal",
        "deck_id": deck.id,
        "deck_created": deck_created,
        "num_questions": num_questions,
        "difficulty": difficulty,
        "custom_prompt": custom_prompt,
        "documents": [
            {"id": d["id"], "filename": d["filename"], "file_path": d["file_path"],
             "file_type": d["file_type"].value}
            for d in uploaded_documents
        ],
    }

    # Pre-flight: judge each source before any generation token is spent. It
    # runs only with a TypeSafe key, and an unchecked source always passes, so
    # without Jev the upload behaves exactly as it did before.
    preflight = []
    api_key = _typesafe_key(db)
    if api_key and not skip_preflight:
        preflight = await run_in_threadpool(assess_sources, uploaded_documents, api_key)

    source_names = {d["id"]: d["display_name"] for d in uploaded_documents}
    for item in preflight:
        item["display_name"] = source_names.get(item["document_id"])

    base_response = {
        "job_id": job_id,
        "deck_id": deck.id,
        "deck_name": deck.name,
        "documents": [{"id": d["id"], "filename": d["filename"],
                       "display_name": d["display_name"]} for d in uploaded_documents],
        "regenerate": regenerate,
        "preflight": preflight,
    }

    rejected = [item for item in preflight if not item["worth_generating"]]
    if rejected:
        pending_request["empty_sources"] = [item["document_id"] for item in rejected
                                            if item.get("reason") == "empty"]
        gen_status.status = "awaiting_confirmation"
        gen_status.current_step = "Waiting for confirmation"
        gen_status.pending_request = pending_request
        for item in rejected:
            gen_status.add_log(
                f"Pre-flight: {item['filename']} looks unteachable "
                f"(teachable {item['is_teachable']:.2f})",
                level="warning",
            )
        db.commit()
        return {
            **base_response,
            "status": "needs_confirmation",
            "message": f"{len(rejected)} source(s) may not contain anything to study.",
        }

    message = schedule_generation(background_tasks, pending_request, job_id)
    return {**base_response, "status": "processing", "message": message}


def schedule_generation(background_tasks: BackgroundTasks, request: dict, job_id: str) -> str:
    """Queue generation for stored documents. Returns the message for the user."""
    documents = request["documents"]
    if request["mode"] == "regenerate":
        # Regenerate all questions from all documents in the deck
        background_tasks.add_task(
            regenerate_deck_questions,
            request["deck_id"],
            request["num_questions"],
            request["difficulty"],
            request["custom_prompt"],
            job_id,
            [doc["id"] for doc in documents],
        )
        return (
            f"Regenerating all questions in the deck from {len(documents)} document(s). "
            "Your existing questions are kept until the new ones are ready."
        )

    for doc in documents:
        background_tasks.add_task(
            process_document,
            doc["id"],
            doc["file_path"],
            DocumentType(doc["file_type"]),
            request["num_questions"],
            request["difficulty"],
            request["deck_id"],
            request["custom_prompt"],
            job_id,
        )
    return f"{len(documents)} document(s) uploaded. Questions are being generated."


def _parser_for(file_type: DocumentType):
    return {
        DocumentType.PDF: PDFParser,
        DocumentType.HTML: HTMLParser,
        DocumentType.MARKDOWN: MarkdownParser,
        DocumentType.DOCX: DOCXParser,
        DocumentType.PPTX: PowerPointParser,
        DocumentType.YOUTUBE: YouTubeParser,
    }[file_type]()


def assess_sources(documents: List[dict], api_key: str) -> List[dict]:
    """Parse each stored document and judge whether it is worth generating from.

    Runs in a worker thread. A file that cannot be parsed here is reported as
    unchecked rather than rejected: generation will surface the real error.
    """
    results = []
    for doc in documents:
        result = {
            "document_id": doc["id"],
            "filename": doc["filename"],
            "checked": False,
            "worth_generating": True,
            "is_teachable": None,
            "is_transcript": None,
            "has_study_content": None,
            "reason": "unchecked",
        }
        try:
            parsed = _parser_for(doc["file_type"]).parse(doc["file_path"])
        except Exception as error:  # noqa: BLE001 - any parse failure means unchecked
            logger.warning("preflight_parse_failed", filename=doc["filename"], error=str(error))
            results.append(result)
            continue

        assessment = sourcing.assess_source(parsed.title or doc["filename"], parsed.full_text, api_key)
        result.update(
            has_study_content=round(assessment.has_study_content, 3) if assessment.checked else None,
            reason=assessment.reason,
            checked=assessment.checked,
            worth_generating=assessment.worth_generating,
            is_teachable=round(assessment.is_teachable, 3) if assessment.checked else None,
            is_transcript=round(assessment.is_transcript, 3) if assessment.checked else None,
        )
        results.append(result)
    return results


def _awaiting_job(job_id: str, db: Session) -> GenerationStatus:
    job = db.query(GenerationStatus).filter(GenerationStatus.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Generation job not found")
    if job.status != "awaiting_confirmation" or not job.pending_request:
        raise HTTPException(status_code=409, detail="This job is not waiting for confirmation.")
    return job


@router.post("/jobs/{job_id}/confirm")
def confirm_generation(
    job_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Generate from sources that failed pre-flight, reusing the stored files."""
    job = _awaiting_job(job_id, db)
    request = job.pending_request
    if request.get("empty_sources"):
        raise HTTPException(status_code=409, detail="No text could be read from this source")

    job.status = "pending"
    job.current_step = "Queued"
    job.pending_request = None
    job.add_log("Generation confirmed by the user despite the pre-flight warning")
    db.commit()

    message = schedule_generation(background_tasks, request, job_id)
    return {"job_id": job_id, "deck_id": request["deck_id"], "status": "processing", "message": message}


@router.post("/jobs/{job_id}/cancel")
def cancel_generation(job_id: str, db: Session = Depends(get_db)):
    """Drop an upload that failed pre-flight: its files, rows and any new empty deck."""
    job = _awaiting_job(job_id, db)
    request = job.pending_request

    for doc in request["documents"]:
        document = db.query(Document).filter(Document.id == doc["id"]).first()
        if document:
            if document.file_path and os.path.exists(document.file_path):
                os.remove(document.file_path)
            db.delete(document)

    deck_removed = False
    if request.get("deck_created"):
        deck = db.query(Test).filter(Test.id == request["deck_id"]).first()
        if deck and not deck.questions:
            db.delete(deck)
            deck_removed = True

    job.status = "cancelled"
    job.current_step = "Cancelled"
    job.pending_request = None
    job.add_log("Upload cancelled after the pre-flight warning")
    db.commit()
    invalidate_stats_cache()

    return {"job_id": job_id, "status": "cancelled", "deck_removed": deck_removed}


def _save_generated_question(db, q_data, document_id, deck) -> Question:
    """Save a generated question and its children without committing."""
    from ..models.deck import DeckQuestion

    card_type = q_data.get("card_type", "mcq")
    if card_type not in ("mcq", "flashcard"):
        raise HTTPException(status_code=422, detail="Unknown card type")
    question = Question(
        card_type=card_type,
        document_id=document_id,
        question_text=q_data["question"],
        explanation=q_data.get("explanation", ""),
        source_reference=q_data.get("reference", {}),
        difficulty=q_data.get("difficulty", "medium"),
    )
    db.add(question)
    db.flush()

    if deck is not None:
        next_order = max((link.order for link in deck.deck_questions), default=-1) + 1
        deck.deck_questions.append(
            DeckQuestion(question_id=question.id, order=next_order)
        )

    if card_type == "flashcard":
        return question
    correct_answer = str(q_data["correct_answer"]).strip().upper()
    for order, option in enumerate(q_data["options"]):
        db.add(QuestionOption(
            question_id=question.id,
            option_text=option["text"],
            is_correct=str(option["option"]).strip().upper() == correct_answer,
            order=order,
        ))
    return question


def process_document(
    document_id: int,
    file_path: str,
    file_type: DocumentType,
    num_questions: int,
    difficulty: str,
    deck_id: int = None,
    custom_prompt: str = None,
    job_id: str = None,
    card_type: str = "mcq",
):
    """Background task to parse document and generate questions"""
    from ..db import SessionLocal
    import sys
    from io import StringIO

    db = SessionLocal()
    gen_status = None
    item_name = "cards" if card_type == "flashcard" else "questions"
    count_name = "card(s)" if card_type == "flashcard" else "question(s)"

    # Get generation status if job_id provided
    if job_id:
        gen_status = db.query(GenerationStatus).filter(GenerationStatus.job_id == job_id).first()
        if gen_status:
            gen_status.status = "processing"
            if not gen_status.started_at:
                gen_status.started_at = datetime.now()
            gen_status.progress = 10
            gen_status.current_step = "Parsing document"
            gen_status.add_log(f"Started processing document {document_id}")
            db.commit()

    def finish_document(error=None, generated=0, flagged=0):
        if gen_status is None:
            return
        document = db.query(Document).filter_by(id=document_id).first()
        filename = document.original_filename if document else os.path.basename(file_path)
        failure = f"{filename}: {error}" if error else None
        values = {
            "documents_completed": GenerationStatus.documents_completed + (0 if error else 1),
            "documents_failed": GenerationStatus.documents_failed + (1 if error else 0),
            "total_questions_generated": GenerationStatus.total_questions_generated + generated,
            "total_questions_flagged": GenerationStatus.total_questions_flagged + flagged,
        }
        if failure:
            values["error_message"] = case(
                (or_(GenerationStatus.error_message.is_(None), GenerationStatus.error_message == ""), failure),
                else_=GenerationStatus.error_message + "; " + failure,
            )
        flag_modified(gen_status, "logs")
        db.flush()
        db.execute(update(GenerationStatus).where(GenerationStatus.id == gen_status.id).values(**values))
        db.refresh(gen_status)
        finished = gen_status.documents_completed + gen_status.documents_failed
        # Derive terminal status in SQL too, so a concurrent task cannot write
        # processing over a job whose last document has already finished.
        terminal = (GenerationStatus.documents_completed + GenerationStatus.documents_failed >= GenerationStatus.total_documents)
        db.execute(update(GenerationStatus).where(GenerationStatus.id == gen_status.id).values(
            status=case((terminal, case((GenerationStatus.documents_completed > 0, "completed"), else_="failed")), else_="processing"),
            current_step=case((terminal, case((GenerationStatus.documents_completed > 0, "Complete"), else_="Failed")), else_=f"Finished document {finished} of {gen_status.total_documents}"),
            progress=case((terminal, 100), else_=GenerationStatus.progress),
            step_started_at=datetime.now(),
            completed_at=case((terminal, datetime.now()), else_=None),
        ))
        db.refresh(gen_status)
        remove_failed_empty_deck(db, gen_status)
        db.commit()
        db.refresh(gen_status)

    def step_callback(step: str, done: int, total: int):
        if gen_status:
            gen_status.current_step = step
            gen_status.current_question = done
            gen_status.total_questions = total
            gen_status.progress = int(100 * done / max(total, 1))
            db.commit()

    try:
        logger.info(
            "document_processing_started",
            document_id=document_id,
            file_path=file_path,
            file_type=file_type.value,
            num_questions=num_questions,
            difficulty=difficulty,
            job_id=job_id,
        )
        if gen_status:
            gen_status.add_log(f"Processing document: {os.path.basename(file_path)}")
            db.commit()

        # Select parser based on file type
        parser_map = {
            DocumentType.PDF: PDFParser(),
            DocumentType.HTML: HTMLParser(),
            DocumentType.MARKDOWN: MarkdownParser(),
            DocumentType.DOCX: DOCXParser(),
            DocumentType.PPTX: PowerPointParser(),
            DocumentType.YOUTUBE: YouTubeParser(),
        }

        parser = parser_map[file_type]
        try:
            parsed_doc = parser.parse(file_path)
        except Exception as error:
            document = db.get(Document, document_id)
            if document:
                document.status = "failed"
                document.error_message = str(error) or type(error).__name__
                db.commit()
            raise

        document = db.get(Document, document_id)
        if document:
            store_passages(db, document, parsed_doc)
            document.status = "ready"
            document.error_message = None
            document.parsed_at = datetime.now()

        logger.info(
            "document_parsed",
            document_id=document_id,
            text_length=len(parsed_doc.full_text),
            num_sections=len(parsed_doc.sections),
            title=parsed_doc.title,
        )
        if gen_status:
            gen_status.progress = 20
            gen_status.current_step = "Document parsed successfully"
            gen_status.add_log(f"Extracted {len(parsed_doc.full_text)} characters from document")
            db.commit()

        # Update document with parsed content
        document = db.query(Document).filter(Document.id == document_id).first()
        if document:
            document.content = parsed_doc.full_text
            if file_type != DocumentType.YOUTUBE:
                document.title = parsed_doc.title
            document.num_pages = parsed_doc.num_pages
            db.commit()
            invalidate_stats_cache()

        # Generate questions
        logger.info(
            "question_generation_starting",
            document_id=document_id,
            num_questions=num_questions,
            difficulty=difficulty,
        )
        if gen_status:
            gen_status.progress = 20
            gen_status.current_step = f"Generating {num_questions} {item_name} using AI"
            gen_status.add_log(f"Starting AI {'card' if card_type == 'flashcard' else 'question'} generation ({num_questions} {item_name})")
            gen_status.total_questions = num_questions
            db.commit()

        # Capture print output from question generator
        old_stdout = sys.stdout
        sys.stdout = log_capture = StringIO()

        try:
            generator = QuestionGenerator(db=db)
            questions_data = generator.generate_questions(
                parsed_doc,
                num_questions=num_questions,
                difficulty=difficulty,
                custom_prompt=custom_prompt,
                step_callback=step_callback,
                card_type=card_type,
            )

            # Capture the logs
            sys.stdout = old_stdout
            captured_logs = log_capture.getvalue()

            # Add captured logs to status
            if gen_status and captured_logs:
                for log_line in captured_logs.strip().split("\n"):
                    if log_line.strip():
                        gen_status.add_log(log_line.strip())
                db.commit()

        except (ValueError, AIServiceError, QuestionGenerationError) as e:
            sys.stdout = old_stdout
            logger.error(
                "question_generation_failed",
                document_id=document_id,
                error_type=type(e).__name__,
                error_message=str(e),
                exc_info=True,
            )
            raise
        finally:
            sys.stdout = old_stdout

        logger.info(
            "questions_generated", document_id=document_id, num_questions=len(questions_data)
        )
        if gen_status:
            gen_status.progress = 90
            gen_status.current_step = f"Saving {item_name} to database"
            gen_status.add_log(f"Successfully generated {len(questions_data)} {item_name}")
            db.commit()

        # Get deck if provided
        deck = None
        if deck_id:
            deck = db.query(Test).filter(Test.id == deck_id).first()

        # Save questions to database
        for q_data in questions_data:
            _save_generated_question(db, q_data, document_id, deck)

        flagged = getattr(generator, "flagged_questions", [])
        for q_data in flagged:
            db.add(FlaggedQuestion(
                deck_id=deck.id if deck else None, document_id=document_id, job_id=job_id,
                payload={key: value for key, value in q_data.items() if key != "flags"},
                reasons=q_data.get("flags", []),
            ))
        if gen_status:
            if flagged:
                gen_status.add_log(f"{len(flagged)} {count_name} held back by the quality check")
                flag_modified(gen_status, "logs")
        db.commit()
        invalidate_stats_cache()
        logger.info(
            "questions_saved",
            document_id=document_id,
            num_questions=len(questions_data),
            deck_id=deck_id,
        )

        if gen_status:
            failures = getattr(generator, "failed_batches", [])
            if failures:
                gen_status.add_log(
                    f"Generated {len(questions_data)} of {num_questions} {count_name}. "
                    f"Gemini failed on {len(failures)} section(s): {failures[-1]['message']}",
                    level="warning",
                )
            gen_status.add_log(f"Successfully saved {len(questions_data)} {item_name} to database")
        finish_document(generated=len(questions_data), flagged=len(flagged))

    except Exception as e:
        logger.error(
            "document_processing_error",
            document_id=document_id,
            error_type=type(e).__name__,
            error_message=str(e),
            stack_trace=traceback.format_exc(),
            exc_info=True,
        )
        db.rollback()
        if gen_status:
            gen_status.add_log(f"Error: {str(e)}", level="error")
        finish_document(error=str(e))
    finally:
        db.close()


@router.get("/{document_id}/passages")
def get_document_passages(document_id: int, db: Session = Depends(get_db)):
    document = db.query(Document).filter(Document.id == document_id).first()
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    passages = (db.query(DocumentPassage)
                .filter(DocumentPassage.document_id == document_id)
                .order_by(DocumentPassage.ordinal).all())
    return {
        "document_id": document_id,
        "passages": [
            {"ordinal": passage.ordinal, "page": passage.page,
             "heading": passage.heading, "text": passage.text}
            for passage in passages
        ],
    }


@router.get("/{document_id}")
async def get_document(document_id: int, db: Session = Depends(get_db)):
    """Get document details"""
    document = db.query(Document).filter(Document.id == document_id).first()

    if not document:
        raise ResourceNotFoundError("Document", document_id)

    return {
        "id": document.id,
        **source_fields(document, passage_counts(db, [document.id])),
        "filename": document.original_filename,
        "file_type": document.file_type.value,
        "file_size": document.file_size,
        "title": document.title,
        "display_name": display_name(document),
        "notebook_id": document.notebook_id,
        "notebook_name": document.notebook.name if document.notebook else None,
        "num_pages": document.num_pages,
        "num_questions": len(document.questions),
        "created_at": document.created_at,
    }


@router.get("/")
async def list_documents(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """List all documents"""
    documents = db.query(Document).offset(skip).limit(limit).all()
    counts = passage_counts(db, [doc.id for doc in documents])

    return [
        {
            "id": doc.id,
            **source_fields(doc, counts),
            "filename": doc.original_filename,
            "file_type": doc.file_type.value,
            "title": doc.title,
            "display_name": display_name(doc),
            "num_questions": len(doc.questions),
            "created_at": doc.created_at,
        }
        for doc in documents
    ]


@router.delete("/{document_id}")
async def delete_document(document_id: int, db: Session = Depends(get_db)):
    """Delete a document and its questions"""
    document = db.query(Document).filter(Document.id == document_id).first()

    if not document:
        raise ResourceNotFoundError("Document", document_id)

    from ..models.canvas import Canvas, CanvasRoutingLog, canvas_source_ids

    file_path = document.file_path
    canvases = [canvas for canvas in db.query(Canvas).all()
                if document_id in canvas_source_ids(canvas)]
    canvas_ids = [canvas.id for canvas in canvases]
    from ..models.deck import Deck, DeckQuestion

    canvas_decks = db.query(Deck).filter(Deck.canvas_id.in_(canvas_ids)).all()
    deck_ids = [deck.id for deck in canvas_decks]
    for deck in canvas_decks:
        deck.canvas_id = None
    retained_ids = db.query(DeckQuestion.question_id).filter(DeckQuestion.deck_id.in_(deck_ids))
    db.query(Question).filter(Question.id.in_(retained_ids), Question.document_id == document_id).update(
        {Question.document_id: None}, synchronize_session="fetch")
    db.query(FlaggedQuestion).filter(
        FlaggedQuestion.deck_id.in_(deck_ids), FlaggedQuestion.document_id == document_id,
    ).update({FlaggedQuestion.document_id: None}, synchronize_session="fetch")
    db.query(CanvasRoutingLog).filter(or_(
        CanvasRoutingLog.document_id == document_id,
        CanvasRoutingLog.canvas_id.in_(canvas_ids),
    )).delete(synchronize_session="fetch")
    for canvas in canvases:
        db.delete(canvas)
    db.flush()
    db.query(FlaggedQuestion).filter_by(document_id=document_id).delete(synchronize_session="fetch")
    db.delete(document)
    db.commit()
    invalidate_stats_cache()

    try:
        if os.path.exists(file_path):
            os.remove(file_path)
    except OSError as error:
        logger.warning("document_file_removal_failed", document_id=document_id, error_message=str(error))

    return {"message": "Document deleted successfully"}


def regenerate_deck_questions(
    deck_id: int,
    num_questions_per_doc: int,
    difficulty: str,
    custom_prompt: str = None,
    job_id: str = None,
    new_document_ids: Optional[List[int]] = None,
):
    """Generate every source before replacing the deck in one transaction."""
    from ..db import SessionLocal
    from ..models.deck import DeckQuestion

    db = SessionLocal()
    gen_status = None
    existing_count = 0

    def add_log(message: str, level: str = "info"):
        gen_status.add_log(message, level=level)
        flag_modified(gen_status, "logs")

    try:
        if job_id:
            gen_status = db.query(GenerationStatus).filter(GenerationStatus.job_id == job_id).first()
        deck = db.query(Test).filter(Test.id == deck_id).first()
        if not deck:
            raise ValueError(f"Deck {deck_id} not found")

        old_questions = list(deck.questions)
        existing_count = len(old_questions)
        held_back_sources = db.query(FlaggedQuestion.document_id).filter(
            FlaggedQuestion.deck_id == deck_id,
            FlaggedQuestion.status == "pending",
            FlaggedQuestion.document_id.isnot(None),
        ).all()
        document_ids = sorted(
            {q.document_id for q in old_questions if q.document_id is not None}
            | {row.document_id for row in held_back_sources}
        )
        for document_id in new_document_ids or []:
            if document_id not in document_ids:
                document_ids.append(document_id)
        documents_by_id = {
            doc.id: doc for doc in db.query(Document).filter(Document.id.in_(document_ids)).all()
        }
        if len(documents_by_id) != len(document_ids):
            raise ValueError("A source document was not found")
        source_documents = [documents_by_id[document_id] for document_id in document_ids]
        total_requested = num_questions_per_doc * len(source_documents)

        if gen_status:
            gen_status.source_ids = document_ids
            gen_status.status = "processing"
            gen_status.started_at = datetime.now()
            gen_status.progress = 10
            gen_status.current_step = "Parsing documents"
            gen_status.total_documents = len(source_documents)
            gen_status.total_questions_requested = total_requested
            gen_status.total_questions = total_requested
            gen_status.error_message = None
            add_log(f"Regenerating deck from {len(source_documents)} document(s)")
            db.commit()

        generated = []
        flagged = []
        generator = QuestionGenerator(db=db)
        for index, document in enumerate(source_documents):
            if gen_status:
                gen_status.current_step = f"Parsing document {index + 1} of {len(source_documents)}"
                add_log(f"Processing document: {document.original_filename}")
                db.commit()
            try:
                parsed_doc = _parser_for(document.file_type).parse(document.file_path)
            except Exception as error:
                document.status = "failed"
                document.error_message = str(error) or type(error).__name__
                db.commit()
                raise ValueError(f"{document.original_filename}: {error}") from error

            store_passages(db, document, parsed_doc)
            document.content = parsed_doc.full_text
            if document.file_type != DocumentType.YOUTUBE:
                document.title = parsed_doc.title
            document.num_pages = parsed_doc.num_pages
            document.status = "ready"
            document.error_message = None
            document.parsed_at = datetime.now()
            db.commit()

            def step_callback(step: str, done: int, total: int):
                if gen_status:
                    gen_status.current_step = step
                    gen_status.current_question = done
                    gen_status.total_questions = total
                    gen_status.progress = int(100 * done / max(total, 1))
                    db.commit()

            if gen_status:
                gen_status.current_step = f"Generating questions for document {index + 1}"
                add_log(f"Starting AI question generation ({num_questions_per_doc} questions)")
                db.commit()
            generator.flagged_questions = []
            try:
                questions_data = generator.generate_questions(
                    parsed_doc,
                    num_questions=num_questions_per_doc,
                    difficulty=difficulty,
                    custom_prompt=custom_prompt,
                    step_callback=step_callback,
                )
                current_flagged = getattr(generator, "flagged_questions", [])
                failures = getattr(generator, "failed_batches", [])
                if failures:
                    raise ValueError(f"Gemini failed on {len(failures)} section(s): {failures[-1]['message']}")
                if not questions_data and not current_flagged:
                    raise ValueError("No questions were generated before verification")
            except Exception as error:
                raise ValueError(f"{document.original_filename}: {error}") from error
            generated.extend((document.id, q_data) for q_data in questions_data)
            flagged.extend((document.id, q_data) for q_data in current_flagged)
            if gen_status:
                add_log(f"Generated {len(questions_data)} questions from {document.original_filename}")
                db.commit()

        if not generated:
            if not flagged:
                raise ValueError("No questions were generated")
            for document_id, q_data in flagged:
                db.add(FlaggedQuestion(
                    deck_id=deck.id, document_id=document_id, job_id=job_id,
                    payload={key: value for key, value in q_data.items() if key != "flags"},
                    reasons=q_data.get("flags", []),
                ))
            message = (
                "Every regenerated question was held back by the quality check. "
                f"The existing {existing_count} questions were kept. "
                "Review the held-back questions on the deck page."
            )
            if gen_status:
                gen_status.status = "failed"
                gen_status.error_message = message
                gen_status.current_step = "Failed"
                gen_status.completed_at = datetime.now()
                gen_status.total_questions_flagged = (gen_status.total_questions_flagged or 0) + len(flagged)
                gen_status.total_questions_generated = 0
                add_log(message, level="error")
            db.commit()
            return

        if gen_status:
            gen_status.progress = 90
            gen_status.current_step = "Saving questions to database"
            add_log(f"Successfully generated {len(generated)} questions")
            db.commit()

        # No commits or generation callbacks after deletion until replacement is complete.
        deck.deck_questions.clear()
        db.flush()
        for question in old_questions:
            if not db.query(DeckQuestion).filter_by(question_id=question.id).first():
                db.delete(question)
        db.flush()
        db.expire(deck, ["deck_questions"])
        for document_id, q_data in generated:
            _save_generated_question(db, q_data, document_id, deck)
        for document_id, q_data in flagged:
            db.add(FlaggedQuestion(
                deck_id=deck.id, document_id=document_id, job_id=job_id,
                payload={key: value for key, value in q_data.items() if key != "flags"},
                reasons=q_data.get("flags", []),
            ))

        if gen_status:
            gen_status.total_questions_flagged = (gen_status.total_questions_flagged or 0) + len(flagged)
            if flagged:
                add_log(f"{len(flagged)} question(s) held back by the quality check")
            gen_status.status = "completed"
            gen_status.progress = 100
            gen_status.current_step = "Complete"
            gen_status.completed_at = datetime.now()
            gen_status.total_questions_generated = len(generated)
            add_log(f"Successfully saved {len(generated)} questions to database")
            add_log("Generation completed successfully")
        db.commit()
        invalidate_stats_cache()

    except Exception as error:
        db.rollback()
        message = f"{error}. The existing {existing_count} questions were kept."
        logger.error("deck_regeneration_failed", deck_id=deck_id, error_message=message, exc_info=True)
        if gen_status:
            gen_status.status = "failed"
            gen_status.error_message = message
            gen_status.current_step = "Failed"
            gen_status.completed_at = datetime.now()
            gen_status.total_questions_generated = 0
            add_log(message, level="error")
            remove_failed_empty_deck(db, gen_status)
            db.commit()
    finally:
        db.close()
