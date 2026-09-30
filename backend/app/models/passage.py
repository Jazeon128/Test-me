from sqlalchemy import Column, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from .base import Base


class DocumentPassage(Base):
    __tablename__ = "document_passages"
    __table_args__ = (UniqueConstraint("document_id", "ordinal"),)

    id = Column(Integer, primary_key=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"),
                         nullable=False, index=True)
    ordinal = Column(Integer, nullable=False)
    section_index = Column(Integer, nullable=False)
    page = Column(Integer, nullable=True)
    heading = Column(String(512), nullable=True)
    locator = Column(String(255), nullable=False)
    text = Column(Text, nullable=False)
    char_start = Column(Integer, nullable=False)
    char_end = Column(Integer, nullable=False)

    document = relationship("Document", back_populates="passages")
