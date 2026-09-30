from sqlalchemy import Column, Integer, String
from .base import Base, TimestampMixin


class Settings(Base, TimestampMixin):
    """Store application settings"""

    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(255), unique=True, nullable=False, index=True)
    value = Column(String(1000), nullable=True)

    def __repr__(self):
        return f"<Settings {self.key}>"
