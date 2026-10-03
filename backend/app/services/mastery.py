"""Computed topic mastery from notebook membership and answer history."""
from datetime import datetime, timezone

from sqlalchemy.orm import joinedload

from ..models.question import Question
from ..models.user_progress import UserProgress
from .source_names import display_name
from .workspace import question_notebook_membership

# Khan Academy: Attempted under 70%, Familiar 70 to 99%, Proficient 100%.
FAMILIAR_ACCURACY = 0.70
PROFICIENT_ACCURACY = 1.0
PROFICIENT_MIN_QUESTIONS = 4
LEVELS = ('not_started', 'attempted', 'familiar', 'proficient', 'mastered')


def _date(attempt):
    date = datetime.fromisoformat(attempt['date'].replace('Z', '+00:00'))
    return date.replace(tzinfo=timezone.utc) if date.tzinfo is None else date.astimezone(timezone.utc)


def notebook_mastery(db, notebook_id) -> dict:
    membership = question_notebook_membership(db)
    ids = db.query(membership.c.question_id).filter(membership.c.notebook_id == notebook_id)
    rows = db.query(Question, UserProgress).outerjoin(
        UserProgress, UserProgress.question_id == Question.id,
    ).filter(Question.id.in_(ids)).options(joinedload(Question.document)).order_by(Question.id).all()
    groups = {}
    for question, progress in rows:
        section = ((question.source_reference or {}).get('section') or '').strip() or 'General'
        group = groups.setdefault((question.document_id, section), dict(
            key=f'{question.document_id}:{section}', document_id=question.document_id,
            document_name=display_name(question.document) if question.document else 'Other questions',
            section=section, question_count=0, attempted_count=0, correct_count=0,
            question_ids=[], repeated=True,
        ))
        group['question_count'] += 1
        group['question_ids'].append(question.id)
        attempts = sorted(progress.attempt_history or [], key=_date) if progress else []
        if attempts:
            group['attempted_count'] += 1
            group['correct_count'] += bool(attempts[-1]['correct'] and not attempts[-1].get('hinted'))
            group['repeated'] &= (len(attempts) >= 2 and all(a['correct'] and not a.get('hinted') for a in attempts[-2:])
                                  and _date(attempts[-1]).date() != _date(attempts[-2]).date())
    topics = sorted(groups.values(), key=lambda topic: (topic['document_name'], topic['question_ids'][0]))
    counts = dict.fromkeys(LEVELS, 0)
    for topic in topics:
        attempted = topic['attempted_count']
        accuracy = topic['correct_count'] / attempted if attempted else 0
        repeated = topic.pop('repeated')
        if not attempted:
            level = 'not_started'
        elif accuracy < FAMILIAR_ACCURACY:
            level = 'attempted'
        elif accuracy < PROFICIENT_ACCURACY or attempted < min(PROFICIENT_MIN_QUESTIONS, topic['question_count']):
            level = 'familiar'
        else:
            level = 'mastered' if repeated else 'proficient'
        topic['level'] = level
        counts[level] += 1
    return dict(topics=topics, summary=dict(topic_count=len(topics),
                proficient_or_above=counts['proficient'] + counts['mastered'], levels=counts))
