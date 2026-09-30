from sqlalchemy import Boolean, Column, DateTime, Integer, String, func

from .base import Base


class JevCall(Base):
    __tablename__ = "jev_calls"

    id = Column(Integer, primary_key=True)
    label = Column(String(64), nullable=False, index=True)
    questions = Column(Integer, nullable=False)
    input_tokens = Column(Integer, nullable=False, default=0)
    duration_ms = Column(Integer, nullable=False, default=0)
    ok = Column(Boolean, nullable=False)
    error = Column(String(200), nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now(), index=True)
