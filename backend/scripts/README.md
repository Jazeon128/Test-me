# Backend Scripts

Utility scripts for database management and maintenance.

## backup_db.py

Database backup and restore utility.

### Usage

**Create a backup:**
```bash
python scripts/backup_db.py
```

**Create a backup and clean old backups (keep last 10):**
```bash
python scripts/backup_db.py --clean
```

**List all backups:**
```bash
python scripts/backup_db.py --list
```

**Restore from a backup:**
```bash
python scripts/backup_db.py --restore backups/test_me_backup_20251114_193000.db
```

**Keep specific number of backups:**
```bash
python scripts/backup_db.py --clean --keep 5
```

### Backup Location

Backups are stored in `backend/backups/` with timestamped filenames.

### Safety Features

- Before restoring, a safety backup is automatically created
- Old backups can be automatically cleaned
- File integrity is preserved with copy metadata
