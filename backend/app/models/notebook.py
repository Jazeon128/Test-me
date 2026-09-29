from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.orm import relationship

from .base import Base, TimestampMixin


class Notebook(Base, TimestampMixin):
    """A topic: the sources that belong to it, and everything made from them.

    A notebook owns its documents and its decks. Canvases follow from their
    document, so they need no column of their own.
    """

    __tablename__ = "notebooks"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # A single emoji, shown on the notebook card.
    icon = Column(String(16), nullable=True)

    documents = relationship("Document", back_populates="notebook")
    decks = relationship("Deck", back_populates="notebook")

    def __repr__(self) -> str:
        return f"<Notebook {self.id}: {self.name}>"
