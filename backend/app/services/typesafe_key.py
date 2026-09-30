"""Resolve the single TypeSafe key used by every System One feature."""

from typing import Optional

from ..config import settings as config_settings
from ..models.settings import Settings

SETTING_KEY = "typesafe_api_key"


def _resolved_key(db) -> tuple[str, Optional[str]]:
    row = db.query(Settings).filter(Settings.key == SETTING_KEY).first()
    stored = row.value if row is not None else None
    if isinstance(stored, str) and stored.strip():
        return stored.strip(), "settings"
    configured = config_settings.TYPESAFE_API_KEY
    if isinstance(configured, str) and configured.strip():
        return configured.strip(), "environment"
    return "", None


def typesafe_key(db) -> str:
    return _resolved_key(db)[0]


def typesafe_key_source(db) -> Optional[str]:
    return _resolved_key(db)[1]
