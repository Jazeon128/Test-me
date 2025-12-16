# 🐳 Docker Quick Start Guide

Get Test Me running in 5 minutes with Docker!

## Prerequisites

- Docker Desktop (Windows/Mac) or Docker Engine + Docker Compose (Linux)
- At least 4GB RAM allocated to Docker
- An API key from [Anthropic](https://console.anthropic.com/), [OpenAI](https://platform.openai.com/), or [Google AI](https://makersuite.google.com/)

## Installation Steps

### 1. Verify Docker Installation

**Windows:**
```powershell
.\verify-docker-setup.ps1
```

**Linux/Mac:**
```bash
chmod +x verify-docker-setup.sh
./verify-docker-setup.sh
```

This will check if Docker is installed and all required files are present.

### 2. Configure Environment

The verification script creates a `.env` file for you. Edit it and add your API key:

```bash
# Open .env in your favorite editor
notepad .env  # Windows
nano .env     # Linux/Mac
```

Add your API key:
```env
ANTHROPIC_API_KEY=sk-ant-your-key-here
AI_PROVIDER=anthropic
```

Or for OpenAI:
```env
OPENAI_API_KEY=sk-your-key-here
AI_PROVIDER=openai
```

### 3. Start Services

```bash
docker-compose up -d
```

This will:
- Download required Docker images (first time only)
- Start PostgreSQL database
- Run database migrations
- Start backend API server
- Start frontend development server

**First time setup takes 2-3 minutes. Subsequent starts take ~10 seconds.**

### 4. Verify Services

Check that all services are running:

```bash
docker-compose ps
```

You should see:
```
NAME                IMAGE               STATUS
testme-backend      ...                 Up (healthy)
testme-db           postgres:15-alpine  Up (healthy)
testme-frontend     ...                 Up (healthy)
```

### 5. Access Application

Open your browser and navigate to:

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs
- **Metrics**: http://localhost:8000/metrics

### 6. Upload Your First Document

1. Click "Upload Document" in the web interface
2. Select a PDF, DOCX, or Markdown file
3. Choose number of questions (1-50)
4. Click "Generate Questions"
5. Wait 10-30 seconds for AI to generate questions
6. Start learning!

## Common Commands

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f db
```

### Stop Services

```bash
# Stop all services (keeps data)
docker-compose down

# Stop and remove all data (fresh start)
docker-compose down -v
```

### Restart Services

```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart backend
```

### Rebuild After Code Changes

```bash
docker-compose up -d --build
```

### Access Service Shells

```bash
# Backend shell
docker-compose exec backend bash

# Database shell
docker-compose exec db psql -U testme_user -d testme

# Frontend shell
docker-compose exec frontend sh
```

## Database Operations

### Run Migrations

```bash
docker-compose exec backend alembic upgrade head
```

### Create New Migration

```bash
# After modifying models in backend/app/models/
docker-compose exec backend alembic revision --autogenerate -m "Description"
```

### Backup Database

```bash
docker-compose exec db pg_dump -U testme_user testme > backup.sql
```

### Restore Database

```bash
docker-compose exec -T db psql -U testme_user testme < backup.sql
```

## Troubleshooting

### Services Won't Start

**Check logs:**
```bash
docker-compose logs
```

**Common issues:**
- Port already in use → Change ports in docker-compose.yml
- Out of memory → Increase Docker memory allocation
- Missing .env file → Run verification script

### Database Connection Errors

```bash
# Check database health
docker-compose ps db

# Restart database
docker-compose restart db

# View database logs
docker-compose logs db
```

### Hot Reload Not Working

```bash
# Restart the service
docker-compose restart backend  # or frontend

# Check volume mounts
docker-compose config
```

### Clean Start

If everything is broken, start fresh:

```bash
# WARNING: This deletes all data!
docker-compose down -v
docker system prune -a
docker-compose up -d --build
```

## Development Workflow

### Making Code Changes

**Backend (Python):**
1. Edit files in `backend/app/`
2. Server automatically reloads
3. Check logs: `docker-compose logs -f backend`

**Frontend (React):**
1. Edit files in `frontend/src/`
2. Browser automatically refreshes
3. Check logs: `docker-compose logs -f frontend`

**Database Models:**
1. Edit models in `backend/app/models/`
2. Generate migration: `docker-compose exec backend alembic revision --autogenerate -m "Description"`
3. Apply migration: `docker-compose exec backend alembic upgrade head`

### Running Tests

```bash
# Backend tests
docker-compose exec backend pytest

# Backend tests with coverage
docker-compose exec backend pytest --cov=app

# Frontend tests
docker-compose exec frontend npm test
```

### Code Quality

```bash
# Format Python code
docker-compose exec backend black .

# Lint Python code
docker-compose exec backend flake8 .

# Type check Python code
docker-compose exec backend mypy app/

# Lint JavaScript code
docker-compose exec frontend npm run lint

# Format JavaScript code
docker-compose exec frontend npm run format
```

## What's Running?

### Services

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 5173 | React + Vite development server |
| Backend | 8000 | FastAPI Python API |
| Database | 5432 | PostgreSQL 15 |

### Volumes

| Volume | Purpose |
|--------|---------|
| postgres_data | Database files (persistent) |
| backend_uploads | Uploaded documents (persistent) |

### Networks

All services communicate through the `testme-network` bridge network.

## Next Steps

### For Learning

1. Upload documents and generate questions
2. Start review sessions
3. Track your progress
4. Export to Anki for offline study

### For Development

1. Read [DOCKER.md](DOCKER.md) for comprehensive guide
2. Read [backend/alembic/MIGRATION_GUIDE.md](backend/alembic/MIGRATION_GUIDE.md) for database migrations
3. Check [README.md](README.md) for project overview
4. Review code quality tools in [.pre-commit-config.yaml](.pre-commit-config.yaml)

### For Production

1. Create `docker-compose.prod.yml` with production settings
2. Use environment-specific secrets management
3. Set up monitoring and logging
4. Configure automated backups
5. Set resource limits and restart policies

## Getting Help

### Documentation

- [DOCKER.md](DOCKER.md) - Comprehensive Docker guide
- [backend/alembic/MIGRATION_GUIDE.md](backend/alembic/MIGRATION_GUIDE.md) - Database migrations
- [README.md](README.md) - Project overview
- [DOCKER_SETUP_SUMMARY.md](DOCKER_SETUP_SUMMARY.md) - Implementation details

### Support

1. Check documentation above
2. Search [GitHub Issues](https://github.com/yourusername/Test-me/issues)
3. Create new issue with:
   - Output of `docker-compose ps`
   - Relevant logs from `docker-compose logs`
   - Your environment (OS, Docker version)

## Tips

### Performance

- Allocate at least 4GB RAM to Docker
- Use SSD for Docker volumes
- Close unnecessary applications

### Security

- Never commit `.env` file to git
- Use strong SECRET_KEY in production
- Keep Docker and images updated
- Review security advisories

### Productivity

- Use `docker-compose logs -f` to watch logs
- Use `docker-compose exec` to run commands
- Create aliases for common commands
- Use Docker Desktop dashboard for visual management

## Success!

If you see the Test Me interface at http://localhost:5173, you're all set! 🎉

Start uploading documents and learning with AI-powered questions!

---

**Need more help?** See [DOCKER.md](DOCKER.md) for detailed documentation.
