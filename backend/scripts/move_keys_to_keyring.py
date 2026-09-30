"""Move legacy database credentials to the OS store. Dry run by default."""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.database import SessionLocal
from app.services.secrets import SERVICE, _backend, legacy_secrets, set_secret


def move_keys(db, apply=False):
    moved = 0
    for name, row in legacy_secrets(db):
        print(f"{name}: {len(row.value)} characters")
        if not apply:
            continue
        value = row.value.strip()
        set_secret(name, value)
        if _backend().get_password(SERVICE, name) != value:
            raise RuntimeError(f"Credential read-back verification failed for {name}")
        row.value = ""
        db.commit()
        moved += 1
    return moved


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    try:
        with SessionLocal() as db:
            move_keys(db, apply=args.apply)
    except Exception:
        # Backend exceptions may contain a SQL statement and bound key values.
        print("Key migration failed. Database values were retained for unverified keys.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
