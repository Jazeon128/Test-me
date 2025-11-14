#!/usr/bin/env python3
"""
Database Backup Script for Test Me Application

This script creates timestamped backups of the SQLite database,
preserving all user progress, questions, and settings.

Usage:
    python scripts/backup_db.py              # Create a backup
    python scripts/backup_db.py --clean      # Create backup and clean old backups (keep last 10)
    python scripts/backup_db.py --restore <backup_file>  # Restore from a backup
"""

import os
import shutil
import argparse
from datetime import datetime
from pathlib import Path


def get_paths():
    """Get database and backup directory paths"""
    script_dir = Path(__file__).parent
    backend_dir = script_dir.parent
    db_path = backend_dir / "test_me.db"
    backup_dir = backend_dir / "backups"

    return db_path, backup_dir


def create_backup(keep_last_n=None):
    """
    Create a timestamped backup of the database

    Args:
        keep_last_n: If provided, keep only the last N backups

    Returns:
        Path to the created backup file
    """
    db_path, backup_dir = get_paths()

    if not db_path.exists():
        print(f"[ERROR] Database not found: {db_path}")
        return None

    # Create backup directory if it doesn't exist
    backup_dir.mkdir(parents=True, exist_ok=True)

    # Create timestamped backup filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"test_me_backup_{timestamp}.db"
    backup_path = backup_dir / backup_filename

    # Copy database file
    try:
        shutil.copy2(db_path, backup_path)
        file_size_mb = backup_path.stat().st_size / (1024 * 1024)
        print(f"[SUCCESS] Backup created: {backup_path}")
        print(f"[INFO] Size: {file_size_mb:.2f} MB")

        # Clean old backups if requested
        if keep_last_n:
            clean_old_backups(keep_last_n)

        return backup_path

    except Exception as e:
        print(f"[ERROR] Backup failed: {e}")
        return None


def clean_old_backups(keep_last_n=10):
    """
    Remove old backup files, keeping only the most recent N backups

    Args:
        keep_last_n: Number of recent backups to keep (default: 10)
    """
    db_path, backup_dir = get_paths()

    if not backup_dir.exists():
        return

    # Get all backup files sorted by modification time
    backup_files = sorted(
        backup_dir.glob("test_me_backup_*.db"),
        key=lambda p: p.stat().st_mtime,
        reverse=True
    )

    # Remove old backups
    removed_count = 0
    for backup_file in backup_files[keep_last_n:]:
        try:
            backup_file.unlink()
            removed_count += 1
            print(f"[INFO] Removed old backup: {backup_file.name}")
        except Exception as e:
            print(f"[WARNING] Could not remove {backup_file.name}: {e}")

    if removed_count > 0:
        print(f"[SUCCESS] Cleaned {removed_count} old backup(s), kept {keep_last_n} most recent")
    else:
        print(f"[INFO] No old backups to clean (found {len(backup_files)} total)")


def restore_backup(backup_file):
    """
    Restore database from a backup file

    Args:
        backup_file: Path to the backup file to restore

    Returns:
        True if successful, False otherwise
    """
    db_path, backup_dir = get_paths()
    backup_path = Path(backup_file)

    if not backup_path.exists():
        print(f"[ERROR] Backup file not found: {backup_path}")
        return False

    # Create a safety backup of current database before restoring
    if db_path.exists():
        safety_backup = db_path.with_suffix(".db.before_restore")
        shutil.copy2(db_path, safety_backup)
        print(f"[INFO] Safety backup created: {safety_backup}")

    # Restore from backup
    try:
        shutil.copy2(backup_path, db_path)
        print(f"[SUCCESS] Database restored from: {backup_path}")
        print(f"[INFO] Restored to: {db_path}")
        return True
    except Exception as e:
        print(f"[ERROR] Restore failed: {e}")
        return False


def list_backups():
    """List all available backup files"""
    db_path, backup_dir = get_paths()

    if not backup_dir.exists():
        print("[INFO] No backups found (backup directory doesn't exist)")
        return

    backup_files = sorted(
        backup_dir.glob("test_me_backup_*.db"),
        key=lambda p: p.stat().st_mtime,
        reverse=True
    )

    if not backup_files:
        print("[INFO] No backups found")
        return

    print(f"\n[INFO] Available backups ({len(backup_files)} total):\n")
    for i, backup_file in enumerate(backup_files, 1):
        size_mb = backup_file.stat().st_size / (1024 * 1024)
        modified = datetime.fromtimestamp(backup_file.stat().st_mtime)
        print(f"{i:2d}. {backup_file.name}")
        print(f"    Size: {size_mb:.2f} MB | Modified: {modified.strftime('%Y-%m-%d %H:%M:%S')}")


def main():
    parser = argparse.ArgumentParser(description="Backup and restore Test Me database")
    parser.add_argument(
        "--clean",
        action="store_true",
        help="Clean old backups after creating new one (keep last 10)"
    )
    parser.add_argument(
        "--restore",
        type=str,
        metavar="BACKUP_FILE",
        help="Restore database from a backup file"
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List all available backups"
    )
    parser.add_argument(
        "--keep",
        type=int,
        default=10,
        metavar="N",
        help="Number of backups to keep when cleaning (default: 10)"
    )

    args = parser.parse_args()

    if args.list:
        list_backups()
    elif args.restore:
        restore_backup(args.restore)
    else:
        # Create backup
        keep_last_n = args.keep if args.clean else None
        create_backup(keep_last_n=keep_last_n)


if __name__ == "__main__":
    main()
