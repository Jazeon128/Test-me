from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import hashlib
from datetime import datetime
import traceback
import logging
import uuid

from ..db import get_db
from ..models.document import Document, DocumentType
from ..models.question import Question, QuestionOption
from ..models.test import Test
from ..models.generation_status import GenerationStatus
from ..services.parsers import PDFParser, HTMLParser, MarkdownParser, DOCXParser
from ..services.ai import QuestionGenerator
from ..config import settings

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/upload")
async def upload_document(
    files: List[UploadFile] = File(...),
    num_questions: int = Form(10),
    difficulty: str = Form("mixed"),
    deck_id: Optional[str] = Form(None),
    deck_name: Optional[str] = Form(None),
    deck_description: Optional[str] = Form(None),
    regenerate: bool = Form(False),
    custom_prompt: Optional[str] = Form(None),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db)
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
        regenerate: If True, regenerate all questions from all documents in deck
        custom_prompt: Custom instructions for question generation
    """
    type_mapping = {
        ".pdf": DocumentType.PDF,
        ".html": DocumentType.HTML,
        ".htm": DocumentType.HTML,
        ".md": DocumentType.MARKDOWN,
        ".docx": DocumentType.DOCX,
    }

    uploaded_documents = []

    # Get or create deck
    deck = None
    if deck_id and deck_id != 'new':
        # Use existing deck
        deck = db.query(Test).filter(Test.id == int(deck_id)).first()
        if not deck:
            raise HTTPException(status_code=404, detail="Deck not found")
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
        deck = Test(name=final_deck_name, description=final_deck_description)
        db.add(deck)
        db.commit()
        db.refresh(deck)

    for file in files:
        # Validate file type
        file_ext = os.path.splitext(file.filename)[1].lower()

        if file_ext not in type_mapping:
            logger.warning(f"Skipping unsupported file type: {file.filename}")
            continue

        # Read file content
        content = await file.read()
        file_size = len(content)

        # Check file size
        if file_size > settings.MAX_UPLOAD_SIZE:
            logger.warning(f"Skipping oversized file: {file.filename}")
            continue

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

        uploaded_documents.append({
            "id": document.id,
            "filename": file.filename,
            "file_path": file_path,
            "file_type": type_mapping[file_ext]
        })


    # Create generation status record
    job_id = str(uuid.uuid4())
    gen_status = GenerationStatus(
        job_id=job_id,
        deck_id=deck.id,
        status="pending",
        total_documents=len(uploaded_documents),
        total_questions_requested=num_questions * len(uploaded_documents),
        logs=[]
    )
    gen_status.add_log("Generation job created")
    gen_status.add_log(f"Uploaded {len(uploaded_documents)} document(s)")
    db.add(gen_status)
    db.commit()
    db.refresh(gen_status)

    # Handle regeneration mode
    if regenerate and deck_id and deck_id != 'new':
        # Regenerate all questions from all documents in the deck
        background_tasks.add_task(
            regenerate_deck_questions,
            deck.id,
            num_questions,
            difficulty,
            custom_prompt,
            job_id
        )
        message = f"{len(uploaded_documents)} document(s) uploaded. Regenerating all questions in deck using combined material."
    else:
        # Normal mode - just process new documents
        for doc_info in uploaded_documents:
            background_tasks.add_task(
                process_document,
                doc_info["id"],
                doc_info["file_path"],
                doc_info["file_type"],
                num_questions,
                difficulty,
                deck.id,
                custom_prompt,
                job_id
            )
        message = f"{len(uploaded_documents)} document(s) uploaded. Questions are being generated."

    return {
        "job_id": job_id,
        "deck_id": deck.id,
        "deck_name": deck.name,
        "documents": [{"id": d["id"], "filename": d["filename"]} for d in uploaded_documents],
        "status": "processing",
        "regenerate": regenerate,
        "message": message
    }


def process_document(
    document_id: int,
    file_path: str,
    file_type: DocumentType,
    num_questions: int,
    difficulty: str,
    deck_id: int = None,
    custom_prompt: str = None,
    job_id: str = None
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

    try:
        logger.info(f"[*] Processing document {document_id}: {file_path}")
        if gen_status:
            gen_status.add_log(f"Processing document: {os.path.basename(file_path)}")
            db.commit()

        # Select parser based on file type
        parser_map = {
            DocumentType.PDF: PDFParser(),
            DocumentType.HTML: HTMLParser(),
            DocumentType.MARKDOWN: MarkdownParser(),
            DocumentType.DOCX: DOCXParser(),
        }

        parser = parser_map[file_type]
        parsed_doc = parser.parse(file_path)

        logger.info(f"[+] Parsed document {document_id}, extracted {len(parsed_doc.full_text)} characters")
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
        logger.info(f"[*] Generating {num_questions} questions for document {document_id}...")
        if gen_status:
            gen_status.progress = 30
            gen_status.current_step = f"Generating {num_questions} questions using AI"
            gen_status.add_log(f"Starting AI question generation ({num_questions} questions)")
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
                custom_prompt=custom_prompt
            )

            # Capture the logs
            sys.stdout = old_stdout
            captured_logs = log_capture.getvalue()

            # Add captured logs to status
            if gen_status and captured_logs:
                for log_line in captured_logs.strip().split('\n'):
                    if log_line.strip():
                        gen_status.add_log(log_line.strip())
                db.commit()

        except ValueError as e:
            sys.stdout = old_stdout
            logger.error(f"[-] {str(e)}")
            if gen_status:
                gen_status.status = "failed"
                gen_status.error_message = str(e)
                gen_status.add_log(f"Error: {str(e)}", level="error")
                gen_status.add_log("Please configure your AI API key in Settings page or .env file", level="error")
                db.commit()
            return
        finally:
            sys.stdout = old_stdout

        logger.info(f"[+] Generated {len(questions_data)} questions for document {document_id}")
        if gen_status:
            gen_status.progress = 70
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
            question = Question(
                document_id=document_id,
                question_text=q_data["question"],
                explanation=q_data.get("explanation", ""),
                source_reference=q_data.get("reference", {}),
                difficulty=q_data.get("difficulty", "medium"),
            )
            db.add(question)
            db.flush()  # Get question ID

            # Add to deck if specified
            if deck:
                from ..models.test import TestQuestion
                test_question = TestQuestion(
                    test_id=deck.id,
                    question_id=question.id,
                    order=len(deck.test_questions)
                )
                deck.test_questions.append(test_question)

            # Add options
            for i, opt_data in enumerate(q_data["options"]):
                option = QuestionOption(
                    question_id=question.id,
                    option_text=opt_data["text"],
                    is_correct=(opt_data["option"] == q_data["correct_answer"]),
                    order=i,
                )
                db.add(option)

        db.commit()
        logger.info(f"[+] Saved {len(questions_data)} questions for document {document_id}")

        if gen_status:
            gen_status.status = "completed"
            gen_status.progress = 100
            gen_status.current_step = "Complete"
            gen_status.completed_at = datetime.now()
            gen_status.add_log(f"Successfully saved {len(questions_data)} questions to database")
            gen_status.add_log("Generation completed successfully")
            db.commit()

    except Exception as e:
        logger.error(f"[-] Error processing document {document_id}: {e}")
        logger.error(traceback.format_exc())
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
        raise HTTPException(status_code=404, detail="Document not found")

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
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete file
    if os.path.exists(document.file_path):
        os.remove(document.file_path)

    # Delete from database (cascade will handle questions)
    db.delete(document)
    db.commit()

    return {"message": "Document deleted successfully"}


def regenerate_deck_questions(
    deck_id: int,
    num_questions_per_doc: int,
    difficulty: str,
    custom_prompt: str = None,
    job_id: str = None
):
    """Regenerate all questions in a deck from all its documents"""
    from ..db import SessionLocal

    db = SessionLocal()

    try:
        logger.info(f"🔄 Regenerating deck {deck_id}")

        # Get the deck
        deck = db.query(Test).filter(Test.id == deck_id).first()
        if not deck:
            logger.error(f"Deck {deck_id} not found")
            return

        # Get all documents linked to questions in this deck
        document_ids = set()
        for question in deck.questions:
            document_ids.add(question.document_id)

        documents = db.query(Document).filter(Document.id.in_(document_ids)).all()
        logger.info(f"Found {len(documents)} documents in deck")

        # Delete all existing questions in the deck
        logger.info(f"Deleting {len(deck.questions)} existing questions")
        for question in deck.questions:
            db.delete(question)
        db.commit()

        # Parse all documents and combine content
        all_parsed_docs = []
        combined_text = ""

        parser_map = {
            DocumentType.PDF: PDFParser(),
            DocumentType.HTML: HTMLParser(),
            DocumentType.MARKDOWN: MarkdownParser(),
            DocumentType.DOCX: DOCXParser(),
        }

        for doc in documents:
            parser = parser_map[doc.file_type]
            parsed_doc = parser.parse(doc.file_path)
            all_parsed_docs.append(parsed_doc)
            combined_text += f"\n\n=== {doc.title or doc.original_filename} ===\n\n{parsed_doc.full_text}"

        logger.info(f"Combined {len(all_parsed_docs)} documents, total {len(combined_text)} characters")

        # Analyze existing question styles if available (from database history)
        example_questions = []
        # Could query old questions here if we want to learn from previous style

        # Generate new questions from combined material
        total_questions = num_questions_per_doc * len(documents)
        logger.info(f"🤖 Generating {total_questions} questions from combined material...")

        try:
            generator = QuestionGenerator(db=db)

            # Create a combined parsed document
            from ..services.parsers.base_parser import ParsedDocument
            all_sections = []
            for parsed in all_parsed_docs:
                all_sections.extend(parsed.sections)

            combined_doc = ParsedDocument(
                full_text=combined_text,
                sections=all_sections,
                title=deck.name,
                metadata={"regenerated": True, "source_docs": len(documents)}
            )

            questions_data = generator.generate_questions(
                combined_doc,
                num_questions=total_questions,
                difficulty=difficulty,
                custom_prompt=custom_prompt,
                example_questions=example_questions
            )

        except ValueError as e:
            logger.error(f"❌ {str(e)}")
            return

        logger.info(f"✅ Generated {len(questions_data)} questions from combined material")

        # Save new questions
        for q_data in questions_data:
            # Associate with first document (or could be smarter about source)
            question = Question(
                document_id=documents[0].id if documents else None,
                question_text=q_data["question"],
                explanation=q_data.get("explanation", ""),
                source_reference=q_data.get("reference", {}),
                difficulty=q_data.get("difficulty", "medium"),
            )
            db.add(question)
            db.flush()

            # Add to deck
            from ..models.test import TestQuestion
            test_question = TestQuestion(
                test_id=deck.id,
                question_id=question.id,
                order=len(deck.test_questions)
            )
            deck.test_questions.append(test_question)

            # Add options
            for i, opt_data in enumerate(q_data["options"]):
                option = QuestionOption(
                    question_id=question.id,
                    option_text=opt_data["text"],
                    is_correct=(opt_data["option"] == q_data["correct_answer"]),
                    order=i,
                )
                db.add(option)

        db.commit()
        logger.info(f"✅ Successfully regenerated deck {deck_id} with {len(questions_data)} questions")

    except Exception as e:
        logger.error(f"❌ Error regenerating deck {deck_id}: {e}")
        logger.error(traceback.format_exc())
        db.rollback()
    finally:
        db.close()
