from sqlalchemy import Boolean, Column, Float, ForeignKey, Index, Integer, JSON, String, Text
from sqlalchemy.orm import relationship

from .base import Base, TimestampMixin


class Canvas(Base, TimestampMixin):
    """One generated diagram of a document."""

    __tablename__ = "canvases"

    __table_args__ = (Index("idx_canvases_document", "document_id"),)

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)

    source_ids = Column(JSON, nullable=True)

    # What was asked, and what was drawn in answer.
    request_text = Column(Text, nullable=False)
    template = Column(String(40), nullable=False)
    title = Column(String(255), nullable=True)

    # The model's output, validated against the template's schema.
    payload_json = Column(JSON, nullable=False)

    # Node positions after the user has dragged things. Null until they do,
    # which is how the frontend knows to run automatic layout instead.
    layout_json = Column(JSON, nullable=True)
    edited_json = Column(JSON, nullable=True)

    # The sections the payload cites, so a node can show its source without
    # re-parsing the document.
    sources_json = Column(JSON, nullable=False)

    # How the template was chosen. Null confidence means the person picked it.
    routing_confidence = Column(Float, nullable=True)
    chosen_by_user = Column(Boolean, default=False, nullable=False)

    document = relationship("Document", backref="canvases")

    def __repr__(self) -> str:
        return f"<Canvas {self.id}: {self.template} of document {self.document_id}>"


class CanvasRoutingLog(Base, TimestampMixin):
    """Every routing decision, so the confidence threshold can be tuned on data.

    The floor in router.py is a starting point, not a measured value. Without
    these rows there is nothing to measure it against.
    """

    __tablename__ = "canvas_routing_log"

    id = Column(Integer, primary_key=True, index=True)
    canvas_id = Column(Integer, ForeignKey("canvases.id"), nullable=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)

    request_text = Column(Text, nullable=False)
    chosen_template = Column(String(40), nullable=True)
    confidence = Column(Float, nullable=False, default=0.0)
    probabilities_json = Column(JSON, nullable=True)
    shape_signals_json = Column(JSON, nullable=True)
    granularity_index = Column(Integer, nullable=True)

    # Whether the app acted on the answer or asked the person instead, and what
    # they picked when it asked. Together these say whether the floor is right.
    auto_applied = Column(Boolean, default=False, nullable=False)
    user_override = Column(String(40), nullable=True)

    duration_ms = Column(Integer, nullable=True)
    input_tokens = Column(Integer, nullable=True)

    def __repr__(self) -> str:
        return f"<CanvasRoutingLog {self.id}: {self.chosen_template} @ {self.confidence:.2f}>"


def canvas_source_ids(canvas):
    """Ordered sources, including canvases saved before multi-source support."""
    return canvas.source_ids or [canvas.document_id]
