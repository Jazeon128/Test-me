from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import backref, relationship
from sqlalchemy.sql import func

from .base import Base


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True)
    notebook_id = Column(Integer, ForeignKey("notebooks.id", ondelete="CASCADE"),
                         nullable=False, index=True)
    role = Column(String(16), nullable=False)
    content = Column(Text, nullable=False)
    mode = Column(String(16), nullable=False, default="text", server_default="text")
    source_ids = Column(JSON, nullable=True)
    citations = Column(JSON, nullable=True)
    refused = Column(Boolean, nullable=False, default=False, server_default="0")
    model = Column(String(255), nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    notebook = relationship("Notebook", backref=backref(
        "chat_messages", cascade="all, delete-orphan",
    ))
