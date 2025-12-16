# 🐳 Docker Development Guide

This guide provides comprehensive information about using Docker for Test Me platform development.

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Services](#services)
- [Database Migrations](#database-migrations)
- [Development Workflow](#development-workflow)
- [Production Deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)

## Quick Start

### Prerequisites

- Docker Desktop (Windows/Mac) or Docker Engine + Docker Compose (Linux)
- At least 4GB RAM allocated to Docker
- 10GB free disk space

### First Time Setup

1. **Clone and Configure**
   ```bash
   git clone https://github.com/yourusername/Test-me.git
   cd Test-me
   cp .env.example .env
   ```

2. **Edit .env File**
   ```bash
   # Add your AI API key
   ANTHROPIC_API_KEY=your_actual_key_here
   AI_PROVIDER=anthropic
   ```

3. **Start Services**
   ```bash
   docker-compose up -d
   ```

4. **Wait for Initialization**
   ```bash
   # Watch logs to see when services are ready
   docker-compose logs -f
   ```

5. **Access Application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs
   - Metrics: http://localhost:8000/metrics

## Architecture

### Service Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Docker Network                          │
│                                                              │
│  ┌────────────────┐                                         │
│  │   Frontend     │  React + Vite                           │
│  │   Port: 5173   │  Hot reload enabled                     │
│  └───────┬────────┘                                         │
│          │ HTTP                                             │
│          ▼                                                   │
│  ┌────────────────┐                                         │
│  │   Backend      │  FastAPI + Python                       │
│  │   Port: 8000   │  Hot reload enabled                     │
│  └───────┬────────┘  Uvicorn server                         │
│          │ SQL                                              │
│          ▼                                                   │
│  ┌────────────────┐                                         │
│  │   Database     │  PostgreSQL 15                          │
│  │   Port: 5432   │  Persistent volume                      │
│  └────────────────┘                                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Volumes

- **postgres_data**: Database files (persistent)
- **backend_uploads**: Uploaded documents (persistent)
- **Source code mounts**: For hot reloading (development only)

### Networks

- **testme-network**: Bridge network connecting all services

## Services

### Frontend Service

**Configuration:**
- Base Image: `node:20-alpine`
- Port: 5173
- Hot Reload: ✅ Enabled via volume mount
- Health Check: HTTP GET to localhost:5173

**Volume Mounts:**
```yaml
- ./frontend:/app          # Source code
- /app/node_modules        # Exclude node_modules
```

**Environment Variables:**
- `VITE_API_URL`: Backend API URL (default: http://localhost:8000)

### Backend Service

**Configuration:**
- Base Image: `python:3.11-slim`
- Port: 8000
- Hot Reload: ✅ Enabled via uvicorn --reload
- Health Check: HTTP GET to /health endpoint

**Volume Mounts:**
```yaml
- ./backend:/app           # Source code
- backend_uploads:/app/uploads  # Persistent uploads
- /app/__pycache__         # Exclude cache
- /app/.pytest_cache       # Exclude test cache
- /app/.hypothesis         # Exclude hypothesis cache
```

**Startup Sequence:**
1. Wait for database to be healthy
2. Run database migrations (`alembic upgrade head`)
3. Start uvicorn server with hot reload

### Database Service

**Configuration:**
- Image: `postgres:15-alpine`
- Port: 5432
- Persistent Storage: ✅ Via postgres_data volume
- Health Check: `pg_isready` command

**Default Credentials:**
- Database: `testme`
- User: `testme_user`
- Password: `testme_password`

**Initialization:**
- Runs `backend/scripts/init-db.sql` on first start
- Creates extensions and sets up permissions

## Database Migrations

### Overview

Test Me uses Alembic for database schema management. Migrations are version-controlled and can be applied/reverted safely.

### Migration Workflow

**1. Modify Models**
```python
# Edit files in backend/app/models/
# For example, add a new field to Document model
```

**2. Generate Migration**
```bash
docker-compose exec backend alembic revision --autogenerate -m "Add new field to Document"
```

**3. Review Migration**
```bash
# Check the generated file in backend/alembic/versions/
# Edit if necessary to add custom logic
```

**4. Apply Migration**
```bash
docker-compose exec backend alembic upgrade head
```

### Common Migration Commands

```bash
# View current database version
docker-compose exec backend alembic current

# View migration history
docker-compose exec backend alembic history

# Upgrade to latest version
docker-compose exec backend alembic upgrade head

# Upgrade to specific version
docker-compose exec backend alembic upgrade <revision_id>

# Downgrade one version
docker-compose exec backend alembic downgrade -1

# Downgrade to specific version
docker-compose exec backend alembic downgrade <revision_id>

# Show SQL without executing
docker-compose exec backend alembic upgrade head --sql
```

### Migration Best Practices

1. **Always review auto-generated migrations** before applying
2. **Test migrations on development database** before production
3. **Create backup** before running migrations in production
4. **Use descriptive migration messages** for easy identification
5. **Never edit applied migrations** - create new ones instead

### Troubleshooting Migrations

**Migration Fails:**
```bash
# Check database logs
docker-compose logs db

# Check backend logs
docker-compose logs backend

# Manually connect to database
docker-compose exec db psql -U testme_user -d testme
```

**Reset Database:**
```bash
# WARNING: This deletes all data
docker-compose down -v
docker-compose up -d
```

## Development Workflow

### Daily Development

**Start Working:**
```bash
# Start all services
docker-compose up -d

# Watch logs (optional)
docker-compose logs -f
```

**Make Changes:**
- Edit frontend code → Browser auto-refreshes
- Edit backend code → Server auto-reloads
- Edit models → Generate and apply migration

**Stop Working:**
```bash
# Stop services (keeps data)
docker-compose down

# Or stop specific service
docker-compose stop backend
```

### Running Tests

**Backend Tests:**
```bash
# Run all tests
docker-compose exec backend pytest

# Run specific test file
docker-compose exec backend pytest tests/unit/test_sm2_algorithm.py

# Run with coverage
docker-compose exec backend pytest --cov=app --cov-report=html

# Run property-based tests
docker-compose exec backend pytest tests/property/
```

**Frontend Tests:**
```bash
# Run tests
docker-compose exec frontend npm test

# Run tests in watch mode
docker-compose exec frontend npm test -- --watch
```

### Code Quality Checks

```bash
# Backend formatting
docker-compose exec backend black .

# Backend linting
docker-compose exec backend flake8 .

# Backend type checking
docker-compose exec backend mypy app/

# Frontend linting
docker-compose exec frontend npm run lint

# Frontend formatting
docker-compose exec frontend npm run format
```

### Database Operations

**Backup Database:**
```bash
# Create backup
docker-compose exec db pg_dump -U testme_user testme > backup_$(date +%Y%m%d).sql

# Or use the backup script
docker-compose exec backend python scripts/backup_db.py
```

**Restore Database:**
```bash
# Restore from backup
docker-compose exec -T db psql -U testme_user testme < backup_20231204.sql
```

**Access Database Shell:**
```bash
# PostgreSQL shell
docker-compose exec db psql -U testme_user -d testme

# Common SQL commands:
# \dt          - List tables
# \d+ table    - Describe table
# \q           - Quit
```

**View Database Data:**
```bash
# Count records
docker-compose exec db psql -U testme_user -d testme -c "SELECT COUNT(*) FROM documents;"

# View recent uploads
docker-compose exec db psql -U testme_user -d testme -c "SELECT id, filename, created_at FROM documents ORDER BY created_at DESC LIMIT 10;"
```

### Viewing Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend

# Last 100 lines
docker-compose logs --tail=100 backend

# Since specific time
docker-compose logs --since 2023-12-04T10:00:00 backend
```

### Accessing Service Shells

```bash
# Backend shell
docker-compose exec backend bash

# Frontend shell
docker-compose exec frontend sh

# Database shell
docker-compose exec db bash
```

## Production Deployment

### Production Configuration

**1. Create Production .env:**
```bash
# Use strong secrets
SECRET_KEY=$(openssl rand -hex 32)

# Set production values
DEBUG=false
ENVIRONMENT=production
LOG_LEVEL=WARNING

# Use production database
DATABASE_URL=postgresql://user:pass@prod-db:5432/testme
```

**2. Update docker-compose.yml:**
```yaml
# Remove volume mounts for source code
# Use production-optimized images
# Add resource limits
# Configure restart policies
```

**3. Build Production Images:**
```bash
docker-compose -f docker-compose.prod.yml build
```

**4. Deploy:**
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Production Best Practices

1. **Use environment-specific compose files**
   - `docker-compose.yml` - Development
   - `docker-compose.prod.yml` - Production

2. **Set resource limits**
   ```yaml
   deploy:
     resources:
       limits:
         cpus: '2'
         memory: 2G
   ```

3. **Configure restart policies**
   ```yaml
   restart: unless-stopped
   ```

4. **Use secrets management**
   - Docker secrets
   - External secret managers (AWS Secrets Manager, etc.)

5. **Enable monitoring**
   - Prometheus metrics at /metrics
   - Health checks at /health
   - Structured logging

6. **Regular backups**
   - Automated database backups
   - Upload directory backups
   - Test restore procedures

## Troubleshooting

### Common Issues

**Port Already in Use:**
```bash
# Find process using port
# Windows:
netstat -ano | findstr :8000
# Linux/Mac:
lsof -i :8000

# Change port in docker-compose.yml
ports:
  - "8001:8000"  # Use 8001 instead
```

**Database Connection Failed:**
```bash
# Check database is running
docker-compose ps db

# Check database logs
docker-compose logs db

# Verify connection string
docker-compose exec backend env | grep DATABASE_URL

# Test connection manually
docker-compose exec backend python -c "from app.db import engine; print(engine.connect())"
```

**Out of Disk Space:**
```bash
# Check Docker disk usage
docker system df

# Clean up unused resources
docker system prune -a

# Remove specific volumes
docker volume rm testme_postgres_data
```

**Container Won't Start:**
```bash
# Check container status
docker-compose ps

# View container logs
docker-compose logs <service_name>

# Inspect container
docker inspect testme-backend

# Rebuild container
docker-compose up -d --build <service_name>
```

**Hot Reload Not Working:**
```bash
# Verify volume mounts
docker-compose config

# Restart service
docker-compose restart backend

# Check file permissions (Linux)
ls -la backend/
```

**Migration Errors:**
```bash
# Check migration status
docker-compose exec backend alembic current

# View migration history
docker-compose exec backend alembic history

# Stamp database to specific version
docker-compose exec backend alembic stamp head

# Reset migrations (WARNING: loses data)
docker-compose down -v
docker-compose up -d
```

### Performance Issues

**Slow Startup:**
- Increase Docker memory allocation (Docker Desktop settings)
- Use Docker BuildKit for faster builds
- Pre-pull images: `docker-compose pull`

**Slow Hot Reload:**
- Reduce number of files being watched
- Use `.dockerignore` to exclude unnecessary files
- Increase Docker CPU allocation

**Database Performance:**
- Add indexes to frequently queried columns
- Use connection pooling
- Monitor slow queries with `pg_stat_statements`

### Getting Help

**View Service Health:**
```bash
docker-compose ps
```

**Check Resource Usage:**
```bash
docker stats
```

**Export Logs:**
```bash
docker-compose logs > debug.log
```

**Reset Everything:**
```bash
# WARNING: Deletes all data
docker-compose down -v
docker system prune -a
docker-compose up -d --build
```

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Alembic Documentation](https://alembic.sqlalchemy.org/)
- [FastAPI Docker Guide](https://fastapi.tiangolo.com/deployment/docker/)

## Support

For issues specific to Docker setup:
1. Check this documentation
2. Search existing GitHub issues
3. Create a new issue with:
   - Output of `docker-compose ps`
   - Relevant logs from `docker-compose logs`
   - Your environment (OS, Docker version)
