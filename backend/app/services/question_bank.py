"""Notebook-wide question bank queries and serialization."""
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import and_, case, or_
from sqlalchemy.orm import joinedload, selectinload

from ..models.deck import Deck, DeckQuestion
from ..models.document import Document
from ..models.flagged_question import FlaggedQuestion
from ..models.question import Question, QuestionOption
from ..models.tag import Tag
from ..models.user_progress import UserProgress
from .source_names import display_name
from .workspace import question_notebook_membership


def _status(now):
    return case(
        (UserProgress.id.is_(None), "new"),
        (UserProgress.next_review_date <= now, "due"),
        (UserProgress.is_mastered.is_(True), "mastered"),
        else_="learning",
    )


def _filters(query, filters, now):
    search = filters.get("search")
    if search:
        # Escape LIKE metacharacters so search remains a literal substring.
        pattern = "%" + search.lower().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        query = query.filter(or_(
            Question.question_text.ilike(pattern, escape="\\"),
            Question.explanation.ilike(pattern, escape="\\"),
            Question.options.any(QuestionOption.option_text.ilike(pattern, escape="\\")),
        ))
    for key in ("difficulty", "card_type"):
        if filters.get(key):
            query = query.filter(getattr(Question, key) == filters[key])
    if filters.get("source_id"):
        query = query.filter(Question.document_id == filters["source_id"])
    if filters.get("deck_id"):
        query = query.filter(Question.deck_questions.any(DeckQuestion.deck_id == filters["deck_id"]))
    if filters.get("tag_id"):
        query = query.filter(Question.tags.any(Tag.id == filters["tag_id"]))
    if filters.get("status"):
        query = query.filter(_status(now) == filters["status"])
    return query


def _iso(value):
    return value.isoformat() if value else None


def _item(question, status, progress):
    return dict(
        id=question.id, card_type=question.card_type, question_text=question.question_text,
        options=[dict(option=chr(65 + option.order), text=option.option_text,
                      is_correct=option.is_correct)
                 for option in sorted(question.options, key=lambda option: (option.order, option.id))],
        explanation=question.explanation, difficulty=question.difficulty,
        source=dict(id=question.document.id, name=display_name(question.document))
        if question.document else None,
        decks=[dict(id=link.deck.id, name=link.deck.name)
               for link in sorted(question.deck_questions, key=lambda link: link.deck_id)],
        tags=[dict(id=tag.id, name=tag.name, color=tag.color, shared=tag.shared)
              for tag in sorted(question.tags, key=lambda tag: tag.id)],
        status=status, next_review_date=_iso(progress.next_review_date) if progress else None,
        times_seen=progress.times_seen if progress else 0,
        times_correct=progress.times_correct if progress else 0,
        edited=bool((question.source_reference or {}).get("edited")),
        created_at=_iso(question.created_at),
    )


def question_bank(db, notebook_id, offset=0, limit=50, **filters):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    membership = question_notebook_membership(db)
    ids = db.query(membership.c.question_id).filter(membership.c.notebook_id == notebook_id)
    query = db.query(Question, _status(now), UserProgress).outerjoin(
        UserProgress, UserProgress.question_id == Question.id,
    ).filter(Question.id.in_(ids))
    query = _filters(query, filters, now)
    total = query.count()
    rows = query.options(
        joinedload(Question.document), selectinload(Question.options),
        selectinload(Question.tags),
        selectinload(Question.deck_questions).joinedload(DeckQuestion.deck),
    ).order_by(Question.created_at.desc(), Question.id.desc()).offset(offset).limit(limit).all()
    return dict(total=total, offset=offset, limit=limit,
                items=[_item(question, status, progress) for question, status, progress in rows])


def held_back(db, notebook_id):
    rows = db.query(FlaggedQuestion, Deck, Document).outerjoin(
        Deck, FlaggedQuestion.deck_id == Deck.id,
    ).outerjoin(Document, FlaggedQuestion.document_id == Document.id).filter(
        and_(FlaggedQuestion.status == "pending",
             or_(Deck.notebook_id == notebook_id, Document.notebook_id == notebook_id)),
    ).order_by(FlaggedQuestion.created_at.desc(), FlaggedQuestion.id.desc()).all()
    return [dict(
        id=item.id, card_type=item.payload.get("card_type", "mcq"),
        question_text=item.payload.get("front") or item.payload.get("question") or "",
        reasons=item.reasons, deck=dict(id=deck.id, name=deck.name) if deck else None,
        source=dict(id=source.id, name=display_name(source)) if source else None,
    ) for item, deck, source in rows]


def selected_questions(db, notebook_id, question_ids):
    membership = question_notebook_membership(db)
    ids = db.query(membership.c.question_id).filter(membership.c.notebook_id == notebook_id)
    questions = db.query(Question).filter(Question.id.in_(question_ids), Question.id.in_(ids)).options(
        selectinload(Question.options), selectinload(Question.tags),
        selectinload(Question.deck_questions),
    ).order_by(Question.created_at.desc(), Question.id.desc()).all()
    outsiders = sorted(set(question_ids) - {question.id for question in questions})
    if outsiders:
        raise HTTPException(status_code=400, detail=f"Items outside this notebook: {outsiders}")
    return questions


def validate_bulk_target(db, notebook_id, request):
    if request.action in ('tag', 'untag'):
        tag = db.get(Tag, request.tag_id)
        if tag is None or tag.notebook_id not in (None, notebook_id):
            raise HTTPException(status_code=400, detail="Tag is not available in this notebook")
        return tag
    if request.deck_id is not None:
        deck = db.get(Deck, request.deck_id)
        if deck is None or deck.notebook_id != notebook_id:
            raise HTTPException(status_code=400, detail="Deck is not in this notebook")
        return deck
    return None


def _add_to_deck(db, notebook_id, request, questions, deck):
    if deck is None:
        kind = 'flashcards' if all(q.card_type == 'flashcard' for q in questions) else 'quiz'
        deck = Deck(notebook_id=notebook_id, kind=kind, name=request.new_deck_name.strip())
        db.add(deck)
        db.flush()
    links = db.query(DeckQuestion).filter_by(deck_id=deck.id).all()
    existing = {link.question_id for link in links}
    order = max((link.order for link in links), default=-1) + 1
    added = [q for q in questions if q.id not in existing]
    for index, question in enumerate(added):
        db.add(DeckQuestion(deck_id=deck.id, question_id=question.id, order=order + index))
    return len(added), deck.id


def _tag_questions(questions, tag, add):
    affected = 0
    for question in questions:
        present = tag in question.tags
        if add and not present:
            question.tags.append(tag)
            affected += 1
        elif not add and present:
            question.tags.remove(tag)
            affected += 1
    return affected


def bulk_questions(db, notebook_id, request, delete_question_data):
    try:
        questions = selected_questions(db, notebook_id, request.question_ids)
        target = validate_bulk_target(db, notebook_id, request)
        deck_id = request.deck_id
        if request.action == 'add_to_deck':
            affected, deck_id = _add_to_deck(db, notebook_id, request, questions, target)
        elif request.action == 'remove_from_deck':
            affected = db.query(DeckQuestion).filter(
                DeckQuestion.deck_id == target.id,
                DeckQuestion.question_id.in_(request.question_ids),
            ).delete(synchronize_session='fetch')
        elif request.action in ('tag', 'untag'):
            affected = _tag_questions(questions, target, request.action == 'tag')
        else:
            for question in questions:
                delete_question_data(db, question)
            affected = len(questions)
        db.commit()
    except Exception:
        db.rollback()
        raise
    result = dict(action=request.action, affected=affected, skipped=len(questions) - affected)
    if deck_id is not None:
        result['deck_id'] = deck_id
    return result


def practice_questions(db, notebook_id, question_ids):
    questions = {q.id: q for q in selected_questions(db, notebook_id, question_ids)}
    items = []
    for question_id in question_ids:
        q = questions[question_id]
        items.append(dict(
            id=q.id, question_text=q.question_text, card_type=q.card_type,
            source_reference=q.source_reference, difficulty=q.difficulty, explanation=q.explanation,
            options=[dict(option=chr(65 + o.order), text=o.option_text)
                     for o in sorted(q.options, key=lambda o: o.order)],
            correct_option=next((chr(65 + o.order) for o in q.options if o.is_correct), None),
        ))
    return dict(num_questions=len(items), questions=items)
