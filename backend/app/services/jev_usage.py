from datetime import datetime, timedelta, timezone

from sqlalchemy import case, func

from ..db import SessionLocal
from ..models.jev_call import JevCall
from ..utils.logging import get_logger

logger = get_logger(__name__)


def record(label, questions, input_tokens, duration_ms, ok, error=None):
    """Best-effort recording in a session owned by the calling worker."""
    try:
        with SessionLocal() as db:
            db.add(JevCall(
                label=label,
                questions=questions,
                input_tokens=input_tokens,
                duration_ms=duration_ms,
                ok=ok,
                error=error[:200] if error is not None else None,
            ))
            db.commit()
    except Exception:
        logger.warning("jev_usage_record_failed")


def summary(db, days=30):
    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=days)
    calls = func.count(JevCall.id)
    rows = db.query(
        JevCall.label,
        calls,
        func.sum(case((JevCall.ok.is_(False), 1), else_=0)),
        func.sum(JevCall.input_tokens),
        func.avg(JevCall.duration_ms),
    ).filter(JevCall.created_at >= cutoff).group_by(JevCall.label).order_by(
        calls.desc(), JevCall.label
    ).all()
    features = [
        {
            "label": label,
            "calls": count,
            "failures": failures,
            "input_tokens": tokens,
            "avg_duration_ms": round(duration),
        }
        for label, count, failures, tokens, duration in rows
    ]
    totals = {
        key: sum(feature[key] for feature in features)
        for key in ("calls", "failures", "input_tokens")
    }
    return {"features": features, "totals": totals}
