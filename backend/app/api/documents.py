from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import hashlib
from datetime import datetime
import traceback
import logging

from ..db import get_db
from ..models.document import Document, DocumentType
from ..models.question import Question, QuestionOption
from ..models.test import Test
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
    num_questions: int = 10,
    difficulty: str = "mixed",
    deck_id: Optional[int] = None,
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
    if deck_id:
        deck = db.query(Test).filter(Test.id == deck_id).first()
        if not deck:
            raise HTTPException(status_code=404, detail="Deck not found")
    else:
        # Create new deck for these documents
        deck_name = f"Deck - {datetime.now().strftime('%Y-%m-%d %H:%M')}"
        deck = Test(name=deck_name, description=f"Questions from {len(files)} document(s)")
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
            "filename": file.filename
        })

        # Parse document and generate questions in background
        background_tasks.add_task(
            process_document,
            document.id,
            file_path,
            type_mapping[file_ext],
            num_questions,
            difficulty,
            deck.id
        )

    return {
        "deck_id": deck.id,
        "deck_name": deck.name,
        "documents": uploaded_documents,
        "status": "processing",
        "message": f"{len(uploaded_documents)} document(s) uploaded. Questions are being generated."
    }


def process_document(
    document_id: int,
    file_path: str,
    file_type: DocumentType,
    num_questions: int,
    difficulty: str,
    deck_id: int = None
):
    """Background task to parse document and generate questions"""
    from ..db import SessionLocal

    db = SessionLocal()

    try:
        logger.info(f"📄 Processing document {document_id}: {file_path}")

        # Select parser based on file type
        parser_map = {
            DocumentType.PDF: PDFParser(),
            DocumentType.HTML: HTMLParser(),
            DocumentType.MARKDOWN: MarkdownParser(),
            DocumentType.DOCX: DOCXParser(),
        }

        parser = parser_map[file_type]
        parsed_doc = parser.parse(file_path)

        logger.info(f"✅ Parsed document {document_id}, extracted {len(parsed_doc.full_text)} characters")

        # Update document with parsed content
        document = db.query(Document).filter(Document.id == document_id).first()
        if document:
            document.content = parsed_doc.full_text
            document.title = parsed_doc.title
            document.num_pages = parsed_doc.num_pages
            db.commit()

        # Check if we have API keys configured
        if not settings.ANTHROPIC_API_KEY and not settings.OPENAI_API_KEY:
            logger.error("❌ No AI API keys configured! Please set ANTHROPIC_API_KEY or OPENAI_API_KEY in .env")
            return

        # Generate questions
        logger.info(f"🤖 Generating {num_questions} questions for document {document_id}...")
        generator = QuestionGenerator()
        questions_data = generator.generate_questions(
            parsed_doc,
            num_questions=num_questions,
            difficulty=difficulty
        )

        logger.info(f"✅ Generated {len(questions_data)} questions for document {document_id}")

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
                deck.questions.append(question)

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
        logger.info(f"✅ Saved {len(questions_data)} questions for document {document_id}")

    except Exception as e:
        logger.error(f"❌ Error processing document {document_id}: {e}")
        logger.error(traceback.format_exc())
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
