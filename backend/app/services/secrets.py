"""API credentials live in the OS store, with read-only legacy fallback."""

import keyring
from keyring.errors import KeyringError, NoKeyringError
from sqlalchemy.exc import SQLAlchemyError

from ..config import settings
from ..db.database import SessionLocal
from ..models.settings import Settings

SERVICE = "test-me"
NAMES = {"anthropic", "openai", "gemini", "openrouter", "typesafe"}
NO_STORE = "No secure credential store on this machine. Put the key in backend/.env instead."


class SecretStoreError(RuntimeError):
    """A credential could not be saved securely."""


def _backend():
    backend = keyring.get_keyring()
    module = type(backend).__module__
    if module in {"keyring.backends.fail", "keyring.backends.null"}:
        raise NoKeyringError(NO_STORE)
    return backend


def _name(name):
    if name not in NAMES:
        raise ValueError("Unknown credential name")
    return name


def _text(value):
    return value.strip() if isinstance(value, str) else ""


def legacy_secrets(db):
    """Return legacy rows paired with their credential names."""
    rows = {row.key: row for row in db.query(Settings).all()}
    provider_row = rows.get("ai_provider")
    provider = provider_row.value if provider_row else None
    pairs = []
    for name in sorted(NAMES):
        row = rows.get(f"{name}_api_key")
        if row and _text(row.value):
            pairs.append((name, row))
    row = rows.get("api_key")
    if provider in NAMES - {"typesafe"} and row and _text(row.value):
        pairs.append((provider, row))
    return pairs


def _legacy(name, db):
    for candidate, row in legacy_secrets(db):
        if candidate == name:
            return _text(row.value)
    return ""


def _resolve(name, db=None, config=None):
    _name(name)
    try:
        value = _text(_backend().get_password(SERVICE, name))
    except KeyringError:
        value = ""
    if value:
        return value, "keyring"
    configured = config if config is not None else settings
    value = _text(getattr(configured, f"{name.upper()}_API_KEY", ""))
    if value:
        return value, "env"
    if db is not None:
        value = _legacy(name, db)
    else:
        with SessionLocal() as session:
            try:
                value = _legacy(name, session)
            except SQLAlchemyError:
                value = ""
    return (value, "database") if value else ("", None)


def get_secret(name, db=None, config=None):
    return _resolve(name, db, config)[0]


def secret_status(name, db=None):
    value, source = _resolve(name, db)
    return {"configured": bool(value), "source": source}


def set_secret(name, value):
    _name(name)
    try:
        _backend().set_password(SERVICE, name, value.strip())
    except NoKeyringError:
        raise SecretStoreError(NO_STORE) from None
    except KeyringError:
        raise SecretStoreError("Could not save the key in the secure credential store.") from None


def delete_secret(name):
    _name(name)
    try:
        backend = _backend()
        if backend.get_password(SERVICE, name) is not None:
            backend.delete_password(SERVICE, name)
    except NoKeyringError:
        return
    except KeyringError:
        raise SecretStoreError("Could not remove the key from the secure credential store.") from None
