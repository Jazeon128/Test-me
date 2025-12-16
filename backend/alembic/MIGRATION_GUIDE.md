# Database Migration Guide

This guide explains how to work with Alembic database migrations in the Test Me platform.

## Overview

Alembic is a database migration tool for SQLAlchemy. It allows you to:
- Track database schema changes over time
- Apply changes incrementally
- Rollback changes if needed
- Generate migrations automatically from model changes

## Quick Reference

```bash
# Create new migration
alembic revision --autogenerate -m "Description"

# Apply migrations
alembic upgrade head

# Rollback one version
alembic downgrade -1

# View current version
alembic current

# View history
alembic history
```

## Migration Workflow

### 1. Modify Models

Edit your SQLAlchemy models in `backend/app/models/`:

```python
# Example: Adding a new field to Document model
class Document(Base):
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    # New field
    author = Column(String, nullable=True)  # Add this
```

### 2. Generate Migration

```bash
# From backend directory
alembic revision --autogenerate -m "Add author field to documents"
```

This creates a new file in `alembic/versions/` like:
```
96bad6a9040d_add_author_field_to_documents.py
```

### 3. Review Migration

**Always review the generated migration!** Alembic may not detect all changes correctly.

```python
def upgrade() -> None:
    # Review these operations
    op.add_column('documents', sa.Column('author', sa.String(), nullable=True))

def downgrade() -> None:
    # Review rollback operations
    op.drop_column('documents', 'author')
```

### 4. Apply Migration

```bash
# Apply to database
alembic upgrade head
```

### 5. Verify Changes

```bash
# Check current version
alembic current

# Or connect to database
psql -U testme_user -d testme
\d+ documents  # Describe table
```

## Common Operations

### Adding a Column

**Model Change:**
```python
class Document(Base):
    new_field = Column(String, nullable=True)
```

**Generated Migration:**
```python
def upgrade():
    op.add_column('documents', sa.Column('new_field', sa.String(), nullable=True))

def downgrade():
    op.drop_column('documents', 'new_field')
```

### Removing a Column

**Model Change:**
```python
class Document(Base):
    # Remove: old_field = Column(String)
    pass
```

**Generated Migration:**
```python
def upgrade():
    op.drop_column('documents', 'old_field')

def downgrade():
    op.add_column('documents', sa.Column('old_field', sa.String(), nullable=True))
```

### Renaming a Column

**Manual Migration Required:**
```python
def upgrade():
    op.alter_column('documents', 'old_name', new_column_name='new_name')

def downgrade():
    op.alter_column('documents', 'new_name', new_column_name='old_name')
```

### Adding an Index

**Model Change:**
```python
class Document(Base):
    filename = Column(String, nullable=False, index=True)  # Add index=True
```

**Generated Migration:**
```python
def upgrade():
    op.create_index(op.f('ix_documents_filename'), 'documents', ['filename'])

def downgrade():
    op.drop_index(op.f('ix_documents_filename'), table_name='documents')
```

### Creating a New Table

**Model Change:**
```python
class NewModel(Base):
    __tablename__ = "new_table"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
```

**Generated Migration:**
```python
def upgrade():
    op.create_table('new_table',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

def downgrade():
    op.drop_table('new_table')
```

### Adding a Foreign Key

**Model Change:**
```python
class Question(Base):
    document_id = Column(Integer, ForeignKey('documents.id'))
    document = relationship("Document", back_populates="questions")
```

**Generated Migration:**
```python
def upgrade():
    op.create_foreign_key(
        'fk_questions_document_id',
        'questions', 'documents',
        ['document_id'], ['id']
    )

def downgrade():
    op.drop_constraint('fk_questions_document_id', 'questions', type_='foreignkey')
```

## Advanced Usage

### Data Migrations

Sometimes you need to migrate data, not just schema:

```python
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column

def upgrade():
    # First, add the column
    op.add_column('documents', sa.Column('status', sa.String(), nullable=True))
    
    # Then, populate it with data
    documents = table('documents',
        column('id', sa.Integer),
        column('status', sa.String)
    )
    
    op.execute(
        documents.update().values(status='active')
    )
    
    # Finally, make it non-nullable
    op.alter_column('documents', 'status', nullable=False)

def downgrade():
    op.drop_column('documents', 'status')
```

### Conditional Migrations

```python
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

def upgrade():
    conn = op.get_bind()
    inspector = inspect(conn)
    
    # Check if column exists
    columns = [col['name'] for col in inspector.get_columns('documents')]
    if 'new_field' not in columns:
        op.add_column('documents', sa.Column('new_field', sa.String()))
```

### Multiple Database Support

```python
def upgrade():
    # Get database dialect
    bind = op.get_bind()
    
    if bind.dialect.name == 'postgresql':
        # PostgreSQL-specific operation
        op.execute('CREATE INDEX CONCURRENTLY ...')
    elif bind.dialect.name == 'sqlite':
        # SQLite-specific operation
        op.create_index(...)
```

## Migration History

### View History

```bash
# Show all migrations
alembic history

# Show verbose history
alembic history --verbose

# Show only applied migrations
alembic history --indicate-current
```

### Branching and Merging

If multiple developers create migrations simultaneously:

```bash
# Create merge migration
alembic merge -m "Merge migrations" <rev1> <rev2>
```

## Troubleshooting

### Migration Fails

**Check the error message:**
```bash
alembic upgrade head
# Read the error carefully
```

**Common issues:**
- Column already exists → Check if migration was partially applied
- Foreign key constraint fails → Ensure referenced table/column exists
- Data type mismatch → Review column definitions

**Solution:**
```bash
# Rollback to previous version
alembic downgrade -1

# Fix the migration file
# Then try again
alembic upgrade head
```

### Out of Sync

If your database is out of sync with migrations:

```bash
# Check current version
alembic current

# Stamp database to specific version (without running migrations)
alembic stamp <revision>

# Or stamp to head
alembic stamp head
```

### Reset Database

**Development only - WARNING: Deletes all data!**

```bash
# Drop all tables
alembic downgrade base

# Or recreate database
docker-compose down -v
docker-compose up -d
```

### Autogenerate Misses Changes

Alembic autogenerate has limitations:
- Doesn't detect table/column renames
- Doesn't detect changes to column types in some cases
- Doesn't detect changes to constraints

**Solution:** Manually edit the migration file.

## Best Practices

### 1. Always Review Generated Migrations

```bash
# After generating
alembic revision --autogenerate -m "Description"

# Review the file in alembic/versions/
# Check upgrade() and downgrade() functions
```

### 2. Test Migrations

```bash
# Apply migration
alembic upgrade head

# Test your application
# ...

# Test rollback
alembic downgrade -1

# Test forward again
alembic upgrade head
```

### 3. Use Descriptive Messages

```bash
# Good
alembic revision --autogenerate -m "Add user authentication tables"

# Bad
alembic revision --autogenerate -m "Update"
```

### 4. One Logical Change Per Migration

Don't combine unrelated changes:
```bash
# Good
alembic revision -m "Add author field to documents"
alembic revision -m "Add indexes to questions table"

# Bad
alembic revision -m "Various changes"
```

### 5. Never Edit Applied Migrations

If a migration has been applied to production:
- Don't edit it
- Create a new migration to fix issues

### 6. Backup Before Production Migrations

```bash
# Backup database
pg_dump -U testme_user testme > backup_before_migration.sql

# Apply migration
alembic upgrade head

# If something goes wrong
psql -U testme_user testme < backup_before_migration.sql
```

### 7. Use Transactions

Alembic uses transactions by default. Keep migrations atomic:
```python
def upgrade():
    # All operations in one transaction
    op.add_column(...)
    op.create_index(...)
    # If any fails, all rollback
```

### 8. Document Complex Migrations

```python
def upgrade():
    """
    This migration adds a new status field to documents and populates it
    based on existing data. Documents with questions are marked as 'processed',
    others as 'pending'.
    
    Related to: Issue #123
    """
    # Migration code...
```

## Production Deployment

### Pre-Deployment Checklist

- [ ] Test migration on development database
- [ ] Test migration on staging database
- [ ] Review migration for data loss risks
- [ ] Create database backup
- [ ] Plan rollback procedure
- [ ] Estimate migration duration
- [ ] Schedule maintenance window if needed

### Deployment Steps

1. **Backup Database**
   ```bash
   pg_dump -U testme_user testme > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Apply Migration**
   ```bash
   alembic upgrade head
   ```

3. **Verify**
   ```bash
   alembic current
   # Check application functionality
   ```

4. **Monitor**
   - Watch application logs
   - Monitor error rates
   - Check database performance

### Rollback Plan

If migration causes issues:

```bash
# Rollback migration
alembic downgrade -1

# Or restore from backup
psql -U testme_user testme < backup_20231204_120000.sql
```

## Configuration

### alembic.ini

Main configuration file:
```ini
[alembic]
script_location = alembic
sqlalchemy.url = # Set in env.py

[loggers]
keys = root,sqlalchemy,alembic
```

### env.py

Runtime configuration:
```python
# Import your models
from app.models import Base

# Set target metadata
target_metadata = Base.metadata

# Configure database URL
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)
```

## Resources

- [Alembic Documentation](https://alembic.sqlalchemy.org/)
- [SQLAlchemy Documentation](https://docs.sqlalchemy.org/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

## Getting Help

If you encounter issues:
1. Check this guide
2. Review Alembic documentation
3. Check migration file for errors
4. Ask in team chat or create an issue
