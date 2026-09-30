"""Resolve the single TypeSafe key used by every System One feature."""

from typing import Optional

from .secrets import get_secret, secret_status

SETTING_KEY = "typesafe_api_key"


def typesafe_key(db) -> str:
    return get_secret("typesafe", db=db)


def typesafe_key_source(db) -> Optional[str]:
    return secret_status("typesafe", db=db)["source"]
