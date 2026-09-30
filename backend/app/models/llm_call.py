"""Usage and cost of one logical model call, including its retries."""

from sqlalchemy import Column, DateTime, Integer, Numeric, String, func

from .base import Base


class LLMCall(Base):
    __tablename__ = "llm_calls"

    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    task = Column(String(32), nullable=False)
    provider = Column(String(32), nullable=False)
    requested_model = Column(String(255), nullable=False)
    actual_model = Column(String(255), nullable=False)
    upstream_provider = Column(String(255), nullable=True)
    input_tokens = Column(Integer, nullable=False, default=0)
    output_tokens = Column(Integer, nullable=False, default=0)
    cost_usd = Column(Numeric(12, 6), nullable=True)
    cost_source = Column(String(32), nullable=False)
    latency_ms = Column(Integer, nullable=False)
    attempts = Column(Integer, nullable=False)
    status = Column(String(16), nullable=False)
    error_type = Column(String(255), nullable=True)
    job_id = Column(String(255), nullable=True)
    response_id = Column(String(255), nullable=True)
