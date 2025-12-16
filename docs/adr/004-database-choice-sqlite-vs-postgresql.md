# ADR-004: SQLite for Development, PostgreSQL for Production

## Status

Accepted

## Date

2024-10-15

## Context

The Test Me platform needs a database solution that balances ease of development with production scalability. The application has the following database requirements:

### Data Model Requirements

- **Relational data**: Documents, Questions, UserProgress, Decks, Tags
- **Foreign keys**: Questions belong to Documents, Progress tracks Questions
- **Transactions**: Ensure data consistency during answer submissions
- **Queries**: Complex joins for review session selection
- **Full-text search**: Search questions and documents (future requirement)
- **JSON storage**: Store question options and metadata

### Development Requirements

- **Zero configuration**: Developers should start coding immediately
- **Easy reset**: Quickly reset database for testing
- **Version control**: Database schema in migrations
- **Portability**: Works on Windows, macOS, Linux
- **Testing**: Fast test execution with in-memory database

### Production Requirements

- **Concurrent users**: Handle multiple simultaneous users
- **Data integrity**: ACID compliance
- **Backup/restore**: Regular backups without downtime
- **Scalability**: Support growing user base
- **Performance**: Fast queries for review sessions
- **Monitoring**: Query performance insights

### Database Options Evaluated

1. **SQLite only**: Simple, but limited concurrency
2. **PostgreSQL only**: Powerful, but complex setup
3. **MySQL**: Similar to PostgreSQL, less feature-rich
4. **MongoDB**: NoSQL, poor fit for relational data
5. **Hybrid approach**: SQLite for dev, PostgreSQL for production

### Key Considerations

- **Developer experience**: Time to first working environment
- **Production reliability**: Proven at scale
- **Migration complexity**: Effort to switch databases
- **Feature parity**: Differences between dev and prod
- **Cost**: Hosting and maintenance costs

## Decision

We will use a **hybrid database strategy**:

- **SQLite for local development and testing**
- **PostgreSQL for staging and production environments**

### SQLite for Development

Use SQLite as the default database for:
- Local development on developer machines
- Automated test suites (unit, integration, property tests)
- CI/CD pipeline tests
- Quick prototyping and experimentation

Configuration:
```python
# Development settings
DATABASE_URL = "sqlite:///./test_me.db"

# Test settings (in-memory)
TEST_DATABASE_URL = "sqlite:///:memory:"
```

### PostgreSQL for Production

Use PostgreSQL for:
- Production environment
- Staging environment
- Performance testing
- Load testing

Configuration:
```python
# Production settings
DATABASE_URL = "postgresql://user:password@host:5432/testme"
```

### SQLAlchemy Abstraction

Use SQLAlchemy ORM to abstract database differences:
```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Works with both SQLite and PostgreSQL
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
```

### Migration Strategy

Use Alembic for database migrations that work with both databases:
```python
# alembic/env.py
from app.config import settings

config.set_main_option("sqlalchemy.url", settings.database_url)
```

## Consequences

### Positive Consequences

**SQLite for Development:**
- **Zero setup**: No database server installation required
- **Fast tests**: In-memory database for instant test execution
- **Easy reset**: Delete file to reset database
- **Portable**: Database file can be committed (for fixtures)
- **Debugging**: Easy to inspect with SQLite browser tools
- **Offline work**: No network dependency
- **Consistent**: Same database for all developers

**PostgreSQL for Production:**
- **Concurrent writes**: Handles multiple simultaneous users
- **Advanced features**: JSON columns, full-text search, window functions
- **Proven scalability**: Used by major applications
- **Backup tools**: pg_dump, continuous archiving, point-in-time recovery
- **Monitoring**: pg_stat_statements, query analysis tools
- **Replication**: Read replicas for scaling reads
- **Extensions**: PostGIS, pg_trgm for advanced features

**Hybrid Approach:**
- **Best of both worlds**: Simple dev, powerful production
- **Risk mitigation**: Test with SQLite, deploy to PostgreSQL
- **Cost effective**: Free for development, pay only for production
- **Gradual learning**: Start simple, add complexity as needed

### Negative Consequences

**Development/Production Parity:**
- **Feature differences**: Some PostgreSQL features not in SQLite
- **SQL dialect differences**: Minor syntax variations
- **Performance characteristics**: Different query optimization
- **Concurrency behavior**: Different locking mechanisms
- **Data type differences**: PostgreSQL has more types

**Migration Complexity:**
- **Testing burden**: Must test migrations on both databases
- **Compatibility issues**: Some queries may need database-specific code
- **CI complexity**: Need PostgreSQL service for integration tests
- **Documentation**: Must document both database setups

**Operational Overhead:**
- **Two configurations**: Maintain settings for both databases
- **PostgreSQL hosting**: Need to provision and manage server
- **Backup strategy**: Different approaches for each database
- **Monitoring**: Different tools for each database

### Neutral Consequences

- **SQLAlchemy dependency**: Must use ORM, not raw SQL
- **Alembic migrations**: Required for schema changes
- **Docker Compose**: Useful for local PostgreSQL testing
- **Environment variables**: Database URL configured per environment

## Implementation Notes

### Database Configuration

```python
# backend/app/config.py
from pydantic import BaseSettings

class Settings(BaseSettings):
    database_url: str = "sqlite:///./test_me.db"
    
    class Config:
        env_file = ".env"

settings = Settings()

# Override for tests
if os.getenv("TESTING"):
    settings.database_url = "sqlite:///:memory:"
```

### SQLAlchemy Models

Write models that work with both databases:

```python
from sqlalchemy import Column, Integer, String, DateTime, Text, JSON
from sqlalchemy.sql import func

class Question(Base):
    __tablename__ = "questions"
    
    id = Column(Integer, primary_key=True)
    question_text = Column(Text, nullable=False)  # Works in both
    options = Column(JSON, nullable=False)        # Works in both
    created_at = Column(DateTime, server_default=func.now())  # Works in both
```

### Avoiding Database-Specific Features

**Avoid:**
```python
# PostgreSQL-specific
from sqlalchemy.dialects.postgresql import ARRAY, JSONB

class Question(Base):
    tags = Column(ARRAY(String))  # SQLite doesn't support arrays
    metadata = Column(JSONB)       # SQLite has JSON, not JSONB
```

**Use instead:**
```python
# Cross-database compatible
class Question(Base):
    tags = relationship("Tag", secondary=question_tags)  # Use junction table
    metadata = Column(JSON)  # Both support JSON
```

### Testing with Both Databases

```python
# conftest.py
import pytest
from sqlalchemy import create_engine

@pytest.fixture(params=["sqlite", "postgresql"])
def db_engine(request):
    """Test with both databases"""
    if request.param == "sqlite":
        engine = create_engine("sqlite:///:memory:")
    else:
        engine = create_engine("postgresql://test:test@localhost/test_db")
    
    Base.metadata.create_all(engine)
    yield engine
    Base.metadata.drop_all(engine)
```

### Docker Compose for Local PostgreSQL

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: testme
      POSTGRES_USER: testme
      POSTGRES_PASSWORD: testme
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### Migration Workflow

```bash
# Create migration (works with current DATABASE_URL)
alembic revision --autogenerate -m "Add user_progress table"

# Test migration with SQLite
DATABASE_URL=sqlite:///./test.db alembic upgrade head

# Test migration with PostgreSQL
DATABASE_URL=postgresql://user:pass@localhost/testme alembic upgrade head

# Apply in production
alembic upgrade head
```

### Handling Database-Specific Code

When database-specific code is unavoidable:

```python
from sqlalchemy import create_engine

def get_database_type(engine):
    return engine.dialect.name

def optimize_query(query, engine):
    """Apply database-specific optimizations"""
    if get_database_type(engine) == "postgresql":
        # Use PostgreSQL-specific features
        return query.with_hint(Table, "INDEX(idx_name)")
    else:
        # SQLite fallback
        return query
```

### Production Deployment Checklist

- [ ] Set `DATABASE_URL` to PostgreSQL connection string
- [ ] Run Alembic migrations: `alembic upgrade head`
- [ ] Configure connection pooling
- [ ] Set up automated backups (pg_dump)
- [ ] Configure monitoring (pg_stat_statements)
- [ ] Set up read replicas (if needed)
- [ ] Test failover procedures
- [ ] Document restore procedures

### When to Use PostgreSQL Locally

Developers should use PostgreSQL locally when:
- Testing PostgreSQL-specific features
- Debugging production issues
- Performance testing with realistic data
- Testing concurrent operations
- Validating migrations before production

Use Docker Compose to easily switch:
```bash
# Use SQLite (default)
python main.py

# Use PostgreSQL (via Docker)
docker-compose up -d db
DATABASE_URL=postgresql://testme:testme@localhost/testme python main.py
```

## References

- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [SQLAlchemy Documentation](https://docs.sqlalchemy.org/)
- [Alembic Documentation](https://alembic.sqlalchemy.org/)
- [ADR-003: Technology Stack Selection](003-technology-stack-selection.md)
- [Migration Guide](../backend/alembic/MIGRATION_GUIDE.md)
- [12-Factor App: Dev/Prod Parity](https://12factor.net/dev-prod-parity)
