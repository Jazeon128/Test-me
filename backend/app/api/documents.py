from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, BackgroundTasks
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from typing import List, Optional
import os
import hashlib
from datetime import datetime
import traceback
import uuid

from ..db import get_db
from ..models.document import Document, DocumentType
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
from ..utils.progress import calculate_generation_progress
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

        db.add(document)
        db.commit()
        db.refresh(document)

        uploaded_documents.append(
            {
                "id": document.id,
                "filename": file.filename,
                "file_path": file_path,
                "file_type": type_mapping[file_ext],
            }
        )

    # Create generation status record
    job_id = str(uuid.uuid4())
    gen_status = GenerationStatus(
        job_id=job_id,
        deck_id=deck.id,
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

    base_response = {
        "job_id": job_id,
        "deck_id": deck.id,
        "deck_name": deck.name,
        "documents": [{"id": d["id"], "filename": d["filename"]} for d in uploaded_documents],
        "regenerate": regenerate,
        "preflight": preflight,
    }

    rejected = [item for item in preflight if not item["worth_generating"]]
    if rejected:
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
        }
        try:
            parsed = _parser_for(doc["file_type"]).parse(doc["file_path"])
        except Exception as error:  # noqa: BLE001 - any parse failure means unchecked
            logger.warning("preflight_parse_failed", filename=doc["filename"], error=str(error))
            results.append(result)
            continue

        assessment = sourcing.assess_source(parsed.title or doc["filename"], parsed.full_text, api_key)
        result.update(
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

    return {"job_id": job_id, "status": "cancelled", "deck_removed": deck_removed}


def _save_generated_question(db, q_data, document_id, deck) -> Question:
    """Save a generated question and its children without committing."""
    from ..models.deck import DeckQuestion

    question = Question(
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
):
    """Background task to parse document and generate questions"""
    from ..db import SessionLocal
    import sys
    from io import StringIO

    db = SessionLocal()
    gen_status = None

    # Get generation status if job_id provided
    if job_id:
        gen_status = db.query(GenerationStatus).filter(GenerationStatus.job_id == job_id).first()
        if gen_status:
            gen_status.status = "processing"
            gen_status.started_at = datetime.now()
            gen_status.progress = 10
            gen_status.current_step = "Parsing document"
            gen_status.add_log(f"Started processing document {document_id}")
            db.commit()

    # Define progress callback function for question generation
    def progress_callback(current: int, total: int):
        """Update generation status with current question progress"""
        if gen_status:
            try:
                gen_status.current_question = current
                gen_status.total_questions = total
                # Calculate progress using utility function
                progress_pct = calculate_generation_progress(current, total)
                gen_status.progress = progress_pct
                gen_status.current_step = f"Generating question {current} of {total}"
                db.commit()
            except Exception as e:
                # Log error but don't fail generation
                logger.error(
                    "progress_callback_error",
                    error_message=str(e),
                    current_question=current,
                    total_questions=total,
                )

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
        parsed_doc = parser.parse(file_path)

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
            document.title = parsed_doc.title
            document.num_pages = parsed_doc.num_pages
            db.commit()

        # Generate questions
        logger.info(
            "question_generation_starting",
            document_id=document_id,
            num_questions=num_questions,
            difficulty=difficulty,
        )
        if gen_status:
            gen_status.progress = 20
            gen_status.current_step = f"Generating {num_questions} questions using AI"
            gen_status.add_log(f"Starting AI question generation ({num_questions} questions)")
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
                progress_callback=progress_callback,
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
            if gen_status:
                gen_status.status = "failed"
                gen_status.error_message = str(e)
                gen_status.add_log(f"Error: {str(e)}", level="error")
                if isinstance(e, AIServiceError):
                    gen_status.add_log(
                        "Please configure your AI API key in Settings page or .env file",
                        level="error",
                    )
                db.commit()
            return
        finally:
            sys.stdout = old_stdout

        logger.info(
            "questions_generated", document_id=document_id, num_questions=len(questions_data)
        )
        if gen_status:
            gen_status.progress = 90
            gen_status.current_step = "Saving questions to database"
            gen_status.add_log(f"Successfully generated {len(questions_data)} questions")
            gen_status.total_questions_generated = len(questions_data)
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
            gen_status.total_questions_flagged = (gen_status.total_questions_flagged or 0) + len(flagged)
            if flagged:
                gen_status.add_log(f"{len(flagged)} question(s) held back by the quality check")
                flag_modified(gen_status, "logs")
        db.commit()
        logger.info(
            "questions_saved",
            document_id=document_id,
            num_questions=len(questions_data),
            deck_id=deck_id,
        )

        if gen_status:
            gen_status.status = "completed"
            gen_status.progress = 100
            gen_status.current_step = "Complete"
            gen_status.completed_at = datetime.now()
            gen_status.add_log(f"Successfully saved {len(questions_data)} questions to database")
            gen_status.add_log("Generation completed successfully")
            db.commit()

    except Exception as e:
        logger.error(
            "document_processing_error",
            document_id=document_id,
            error_type=type(e).__name__,
            error_message=str(e),
            stack_trace=traceback.format_exc(),
            exc_info=True,
        )
        if gen_status:
            gen_status.status = "failed"
            gen_status.error_message = str(e)
            gen_status.add_log(f"Error: {str(e)}", level="error")
            gen_status.add_log(traceback.format_exc(), level="error")
            db.commit()
        db.rollback()
    finally:
        db.close()


@router.get("/{document_id}")
async def get_document(document_id: int, db: Session = Depends(get_db)):
    """Get document details"""
    document = db.query(Document).filter(Document.id == document_id).first()

    if not document:
        raise ResourceNotFoundError("Document", document_id)

    return {
        "id": document.id,
        "filename": document.original_filename,
        "file_type": document.file_type.value,
        "file_size": document.file_size,
        "title": document.title,
        "num_pages": document.num_pages,
        "num_questions": len(document.questions),
        "created_at": document.created_at,
    }


@router.get("/")
async def list_documents(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """List all documents"""
    documents = db.query(Document).offset(skip).limit(limit).all()

    return [
        {
            "id": doc.id,
            "filename": doc.original_filename,
            "file_type": doc.file_type.value,
            "title": doc.title,
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

    # Delete file
    if os.path.exists(document.file_path):
        os.remove(document.file_path)

    # Delete from database (cascade will handle questions)
    db.query(FlaggedQuestion).filter_by(document_id=document_id).delete(synchronize_session="fetch")
    db.delete(document)
    db.commit()

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
        document_ids = sorted({q.document_id for q in old_questions if q.document_id is not None})
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
            parsed_doc = _parser_for(document.file_type).parse(document.file_path)

            def progress_callback(current: int, total: int):
                if gen_status:
                    gen_status.current_question = index * num_questions_per_doc + current
                    gen_status.progress = 20 + int(
                        60 * (index + current / max(total, 1)) / len(source_documents)
                    )
                    gen_status.current_step = (
                        f"Generating question {current} of {total} for document {index + 1}"
                    )
                    db.commit()

            if gen_status:
                gen_status.current_step = f"Generating questions for document {index + 1}"
                add_log(f"Starting AI question generation ({num_questions_per_doc} questions)")
                db.commit()
            flagged_start = len(getattr(generator, "flagged_questions", []))
            questions_data = generator.generate_questions(
                parsed_doc,
                num_questions=num_questions_per_doc,
                difficulty=difficulty,
                custom_prompt=custom_prompt,
                progress_callback=progress_callback,
            )
            generated.extend((document.id, q_data) for q_data in questions_data)
            flagged.extend(
                (document.id, q_data)
                for q_data in getattr(generator, "flagged_questions", [])[flagged_start:]
            )
            if gen_status:
                add_log(f"Generated {len(questions_data)} questions from {document.original_filename}")
                db.commit()

        if not generated:
            raise ValueError("No questions were generated")

        if gen_status:
            gen_status.progress = 90
            gen_status.current_step = "Saving questions to database"
            add_log(f"Successfully generated {len(generated)} questions")
            db.commit()

        # No commits or generation callbacks after deletion until replacement is complete.
        for question in old_questions:
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
            db.commit()
    finally:
        db.close()
