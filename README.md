# 📚 Test Me - Gamified Learning Platform

> **⚠️ WORK IN PROGRESS** - This project is actively under development. Features may be incomplete, documentation may be outdated, and breaking changes may occur. Use at your own discretion and expect frequent updates.

<div align="center">

![Test Me Banner](https://img.shields.io/badge/Learning-Gamified-blue?style=for-the-badge)
![Python](https://img.shields.io/badge/Python-3.9+-green?style=for-the-badge&logo=python)
![React](https://img.shields.io/badge/React-18-blue?style=for-the-badge&logo=react)
![FastAPI](https://img.shields.io/badge/FastAPI-Modern-teal?style=for-the-badge&logo=fastapi)
![Work in Progress](https://img.shields.io/badge/Status-Work%20in%20Progress-orange?style=for-the-badge)

**Transform any document into an engaging, gamified quiz with AI-powered questions and spaced repetition learning.**

[Quick Start](#-quick-start) • [Features](#-features) • [Demo](#-screenshots) • [API Docs](#-api-documentation)

</div>

---

## 🎯 What is Test Me?

Test Me is a powerful study application that uses AI to generate multiple-choice questions from your documents (PDF, HTML, Markdown, DOCX), helping you learn faster through:

- 🤖 **AI-Generated Questions** - Claude/GPT-4 creates high-quality questions automatically
- 🧠 **Spaced Repetition** - SM-2 algorithm (same as Anki) for optimal retention
- ⏱️ **Rapid-Fire Testing** - 30-second timer keeps you engaged
- 🎮 **Gamification** - Streaks, points, and achievements motivate learning
- 💾 **Anki Export** - Export to .apkg format for offline studying
- 📊 **Progress Tracking** - Detailed analytics on your learning journey

## ✨ Features

### Document Processing
- ✅ Multi-format support (PDF, HTML, Markdown, DOCX)
- ✅ **NEW:** YouTube Video Support (extracts transcripts)
- ✅ **NEW:** PowerPoint Support (.pptx slides)
- ✅ Intelligent text extraction with structure preservation
- ✅ Source reference tracking for every answer
- ✅ Batch question generation (1-50 questions per document)

### Learning Experience
- ✅ Spaced repetition system (SM-2 algorithm)
- ✅ Adaptive difficulty based on performance
- ✅ Real-time 30-second timer per question
- ✅ Instant feedback with explanations
- ✅ Mastery tracking and progress analytics
- ✅ **NEW:** Tagging System for organizing questions
- ✅ **NEW:** Global Search to find questions instantly

### Gamification
- ✅ Points system with streak multipliers
- ✅ Achievement unlocks
- ✅ Current/best streak tracking
- ✅ Visual progress indicators
- ✅ Motivational feedback

### Integrations
- ✅ Export to Anki (.apkg files)
- ✅ Export to Anki All-In-One CSV (supports "Multiple Choice for Anki" add-on)
- ✅ Beautiful card formatting
- ✅ Source references included
- ✅ Difficulty tags

### Security & Design
- 🔒 **Enhanced Security:** Content-based file validation and secure secret management
- 🎨 **Premium UI:** Modern glassmorphism design with Inter font and smooth animations
- 🌓 **NEW:** Dark Mode support with system preference detection

## 🚀 Quick Start

### Prerequisites
- **Option 1 (Docker - Recommended):** Docker and Docker Compose
- **Option 2 (Local):** Python 3.9+, Node.js 18+
- API key from [Anthropic](https://console.anthropic.com/) or [OpenAI](https://platform.openai.com/)

### 🐳 Docker Setup (Recommended)

The easiest way to get started is with Docker Compose, which sets up everything automatically including PostgreSQL database.

**1. Clone the repository**
```bash
git clone https://github.com/yourusername/Test-me.git
cd Test-me
```

**2. Configure Environment**
```bash
cp .env.example .env
# Edit .env and add your API key:
# ANTHROPIC_API_KEY=your_key_here
# AI_PROVIDER=anthropic
```

**3. Start All Services**
```bash
docker-compose up -d
```

**4. Open Your Browser**
```
http://localhost:5173
```

**Docker Commands:**
```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild after code changes
docker-compose up -d --build

# Run database migrations
docker-compose exec backend alembic upgrade head

# Access backend shell
docker-compose exec backend bash

# Access database
docker-compose exec db psql -U testme_user -d testme
```

**What's Included:**
- ✅ PostgreSQL database (production-like environment)
- ✅ Backend API with hot reloading
- ✅ Frontend with hot reloading
- ✅ Automatic database migrations
- ✅ Persistent data volumes
- ✅ Health checks for all services

### 💻 Local Development Setup

**1. Clone the repository**
```bash
git clone https://github.com/yourusername/Test-me.git
cd Test-me
```

**2. Backend Setup**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

**3. Configure Environment**
```bash
cp .env.example .env
# Edit .env and add your API key:
# ANTHROPIC_API_KEY=your_key_here
# AI_PROVIDER=anthropic
```

**4. Run Database Migrations**
```bash
alembic upgrade head
```

**5. Start Backend**
```bash
python main.py
# Server runs on http://localhost:8000
```

**6. Frontend Setup** (new terminal)
```bash
cd frontend
npm install
npm run dev
# App runs on http://localhost:5173
```

**7. Open Your Browser**
```
http://localhost:5173
```

See [QUICKSTART.md](QUICKSTART.md) for detailed instructions.

## 🐳 Docker Development Environment

### Architecture

The Docker Compose setup includes three services:

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Network                        │
│                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────┐ │
│  │   Frontend   │───▶│   Backend    │───▶│   DB     │ │
│  │   (React)    │    │   (FastAPI)  │    │ (Postgres)│ │
│  │   :5173      │    │   :8000      │    │   :5432  │ │
│  └──────────────┘    └──────────────┘    └──────────┘ │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Database Migrations

The project uses Alembic for database schema management.

**Create a New Migration:**
```bash
# After modifying models in backend/app/models/
docker-compose exec backend alembic revision --autogenerate -m "Description of changes"
```

**Apply Migrations:**
```bash
# Upgrade to latest version
docker-compose exec backend alembic upgrade head

# Downgrade one version
docker-compose exec backend alembic downgrade -1

# View migration history
docker-compose exec backend alembic history

# View current version
docker-compose exec backend alembic current
```

**Migration Files:**
- Located in `backend/alembic/versions/`
- Automatically generated from SQLAlchemy models
- Review and edit before applying to production

### Volume Management

**Persistent Data:**
- `postgres_data` - Database files
- `backend_uploads` - Uploaded documents

**View Volumes:**
```bash
docker volume ls
```

**Backup Database:**
```bash
docker-compose exec db pg_dump -U testme_user testme > backup.sql
```

**Restore Database:**
```bash
docker-compose exec -T db psql -U testme_user testme < backup.sql
```

### Hot Reloading

Both frontend and backend support hot reloading:
- **Backend**: Changes to Python files automatically reload the server
- **Frontend**: Changes to React files automatically refresh the browser

### Environment Variables

All environment variables can be configured in the `.env` file. Copy `.env.example` to `.env` and customize as needed.

#### Required Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `ANTHROPIC_API_KEY` | Anthropic Claude API key | (empty) | `sk-ant-api03-...` |
| `OPENAI_API_KEY` | OpenAI GPT API key | (empty) | `sk-proj-...` |
| `GEMINI_API_KEY` | Google Gemini API key | (empty) | `AIza...` |
| `AI_PROVIDER` | AI provider to use | `anthropic` | `anthropic`, `openai`, `gemini` |

**Note:** At least one AI API key must be configured. Get your keys from:
- Anthropic: https://console.anthropic.com/
- OpenAI: https://platform.openai.com/
- Google AI: https://makersuite.google.com/

#### Optional Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `AI_MODEL` | Specific AI model to use | (provider default) | `claude-3-sonnet-20240229`, `gpt-4`, `gemini-pro` |
| `DATABASE_URL` | Database connection string | `sqlite:///./test_me.db` | `postgresql://user:pass@localhost:5432/testme` |
| `DEBUG` | Enable debug mode | `true` | `true`, `false` |
| `SECRET_KEY` | Secret key for security | `dev-secret-key-change-in-production` | Generate with: `python -c "import secrets; print(secrets.token_urlsafe(32))"` |
| `CORS_ORIGINS_STR` | Allowed CORS origins (comma-separated) | `http://localhost:5173,http://localhost:3000` | `https://myapp.com,https://app.myapp.com` |
| `ENVIRONMENT` | Application environment | `development` | `development`, `staging`, `production` |
| `LOG_LEVEL` | Logging verbosity | `INFO` | `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL` |
| `MAX_UPLOAD_SIZE` | Maximum file upload size (bytes) | `10485760` (10MB) | `20971520` (20MB), `52428800` (50MB) |
| `UPLOAD_DIR` | Directory for uploaded files | `./uploads` | `/app/uploads` (Docker) |

#### Environment Variable Validation

The application validates environment variables on startup and will exit with clear error messages if:
- No AI API keys are configured
- The selected `AI_PROVIDER` doesn't have a corresponding API key
- `SECRET_KEY` is still the default value in production
- `LOG_LEVEL` or `ENVIRONMENT` have invalid values
- `MAX_UPLOAD_SIZE` is not a positive integer

#### Production Configuration

For production deployments, ensure you:
1. Set `ENVIRONMENT=production`
2. Change `SECRET_KEY` to a secure random value
3. Set `DEBUG=false`
4. Use `LOG_LEVEL=WARNING` or `ERROR`
5. Configure a PostgreSQL database URL
6. Use HTTPS URLs in `CORS_ORIGINS_STR`

Example production `.env`:
```bash
# AI Configuration
ANTHROPIC_API_KEY=sk-ant-api03-your-production-key
AI_PROVIDER=anthropic

# Application
DEBUG=false
SECRET_KEY=your-secure-random-secret-key-here
CORS_ORIGINS_STR=https://app.example.com
ENVIRONMENT=production
LOG_LEVEL=WARNING

# Database
DATABASE_URL=postgresql://user:password@db.example.com:5432/testme

# File Upload
MAX_UPLOAD_SIZE=20971520
UPLOAD_DIR=/var/app/uploads
```

### Troubleshooting Docker

**Port Already in Use:**
```bash
# Change ports in docker-compose.yml
# For example, change "5173:5173" to "3000:5173"
```

**Database Connection Issues:**
```bash
# Check database health
docker-compose ps

# View database logs
docker-compose logs db

# Restart database
docker-compose restart db
```

**Rebuild After Dependency Changes:**
```bash
# Rebuild all services
docker-compose up -d --build

# Rebuild specific service
docker-compose up -d --build backend
```

**Clean Start:**
```bash
# Stop and remove all containers, networks, and volumes
docker-compose down -v

# Rebuild and start fresh
docker-compose up -d --build
```

## 🛠️ Development Setup

### Code Quality Tools

This project uses automated code quality tools to maintain consistent code standards.

**Install Pre-commit Hooks** (Recommended for contributors)
```bash
# Install pre-commit (if not already installed)
pip install pre-commit

# Install the git hooks
pre-commit install

# (Optional) Run against all files
pre-commit run --all-files
```

**Pre-commit hooks will automatically:**
- Format Python code with Black
- Sort imports with isort
- Lint Python code with Flake8
- Type check Python code with mypy
- Lint JavaScript/React code with ESLint
- Format JavaScript/React code with Prettier

**Manual Code Quality Checks:**

Python (Backend):
```bash
cd backend

# Format code
black .

# Sort imports
isort .

# Lint code
flake8 .

# Type check
mypy app/
```

JavaScript (Frontend):
```bash
cd frontend

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check
```

### CI/CD Pipeline

The project includes automated CI/CD workflows that run on every push and pull request:

**Code Quality Workflow** (`.github/workflows/code-quality.yml`):
- ✅ Backend: Black, isort, Flake8, mypy
- ✅ Frontend: ESLint, Prettier
- ✅ Unit tests with coverage reporting
- ✅ Property-based tests (Hypothesis)
- ✅ Integration tests
- ✅ Security scanning (Trivy)

**Branch Protection:**
- All checks must pass before merging to `main` or `develop`
- Code coverage reports uploaded to Codecov
- Security vulnerabilities reported to GitHub Security tab

## 📖 Usage

### 1️⃣ Upload a Document
- Navigate to the **Upload** page
- Drag & drop or select a file (PDF, HTML, MD, DOCX)
- Configure question count (1-50) and difficulty
- Wait for AI to generate questions (10-30 seconds)

### 2️⃣ Start Learning
- Click **Start Review Session** from dashboard
- Answer questions within 30 seconds
- Get instant feedback with explanations
- Build streaks and earn points!

### 3️⃣ Track Progress
- View statistics on the **Progress** page
- Monitor success rate, streaks, and mastery
- See questions due for review
- Unlock achievements

### 4️⃣ Export to Anki
- Go to **Documents** page
- Click download icon on any document
- Import .apkg file into Anki desktop/mobile

## 🏗️ Architecture

```
Test-me/
├── backend/              # FastAPI Python backend
│   ├── app/
│   │   ├── api/         # REST API endpoints
│   │   ├── models/      # SQLAlchemy database models
│   │   ├── services/    # Business logic
│   │   │   ├── parsers/    # Document parsers (PDF, HTML, MD, DOCX)
│   │   │   ├── ai/         # Question generation (Claude/GPT-4)
│   │   │   └── spaced_repetition/  # SM-2 algorithm
│   │   └── db/          # Database configuration
│   └── main.py          # Application entry point
│
├── frontend/            # React + Vite frontend
│   ├── src/
│   │   ├── components/ # Reusable UI components
│   │   ├── pages/      # Page components
│   │   ├── services/   # API client
│   │   └── App.jsx     # Main application
│   └── package.json
│
├── PROJECT_README.md    # Detailed documentation
├── QUICKSTART.md        # 5-minute setup guide
└── README.md           # This file
```

## 🛠️ Tech Stack

### Backend
- **FastAPI** - Modern Python web framework
- **SQLAlchemy** - SQL toolkit and ORM
- **SQLite** - Lightweight database
- **Anthropic Claude / OpenAI GPT-4** - AI question generation
- **pdfplumber** - PDF text extraction
- **python-docx** - DOCX parsing
- **python-pptx** - PowerPoint parsing
- **BeautifulSoup4** - HTML parsing
- **youtube-transcript-api** - YouTube transcript extraction
- **genanki** - Anki deck generation

### Frontend
- **React 18** - UI library
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Framer Motion** - Animations
- **Axios** - HTTP client
- **React Router** - Navigation

## 📊 API Documentation

API documentation is automatically generated and available at:
```
http://localhost:8000/docs
```

Key endpoints:
- `POST /api/documents/upload` - Upload and process document
- `POST /api/progress/submit` - Submit answer and update progress
- `POST /api/progress/review-session` - Get questions for review
- `GET /api/progress/stats` - Get learning statistics
- `GET /api/tests/{id}/export/anki` - Export to Anki (.apkg)
- `GET /api/tests/{id}/export/anki-csv` - Export to Anki All-In-One CSV

## 🧪 Testing & Quality Assurance

Test Me includes comprehensive testing to ensure reliability and performance:

### Test Suite

**Unit Tests** - Test individual functions and components
```bash
cd backend
pytest tests/unit/ -v
```

**Property-Based Tests** - Validate algorithmic correctness across wide input ranges
```bash
pytest tests/property/ -v
```

**Integration Tests** - Test API endpoints and database interactions
```bash
pytest tests/integration/ -v
```

**Performance Benchmarks** - Measure and track performance over time
```bash
pytest tests/benchmarks/ --benchmark-only
```

### Test Coverage

Run tests with coverage reporting:
```bash
pytest --cov=app --cov-report=html --cov-report=term
```

Target: 80% code coverage with focus on critical paths

### Performance Benchmarks

The project includes performance benchmarks for:
- Question generation speed
- Database query performance
- API response times
- Memory usage during parsing

**Run benchmarks:**
```bash
# Run all benchmarks
pytest tests/benchmarks/ --benchmark-only

# Save baseline
pytest tests/benchmarks/ --benchmark-only --benchmark-save=baseline

# Compare against baseline
pytest tests/benchmarks/ --benchmark-only --benchmark-compare=baseline

# Generate HTML report
pytest tests/benchmarks/ --benchmark-only --benchmark-histogram
```

**Performance Targets:**
- Question generation: < (S / 1000) * 5 + 10 seconds for section size S
- API response time: < 2 seconds for 95% of requests
- Database queries: < 100ms for 95% of queries
- Memory usage: < 5x document file size during parsing

See [backend/tests/benchmarks/README.md](backend/tests/benchmarks/README.md) for detailed documentation.

## 🧪 Spaced Repetition System

Test Me uses the **SM-2 algorithm** (SuperMemo 2), the same algorithm powering Anki:

- **Easiness Factor (EF)**: Starts at 2.5, adjusts based on performance
- **Interval**: Days until next review (1 → 6 → EF × previous interval)
- **Repetitions**: Consecutive correct answers
- **Quality**: 0-5 scale based on correctness and response time

**Mastery Criteria:**
- 5+ consecutive correct answers
- Easiness Factor ≥ 2.5
- Success rate ≥ 80%

## 🎮 Gamification System

- **Base Points**: 10 points per correct answer
- **Streak Bonus**: Current streak × 5 additional points
- **Achievements**: Unlock milestones (First Steps, Streak Master, Grand Master, etc.)
- **Progress Tracking**: Visual indicators for mastery, success rate, and streaks

## 📸 Screenshots

*Coming soon - add screenshots of your app in action!*

## 🔒 Security & Privacy

- All data stored locally in SQLite database
- API keys stored in `.env` (not committed to git)
- No external data collection
- Documents processed locally

## 🗺️ Roadmap

- [ ] Multi-user support with authentication
- [ ] Mobile app (React Native)
- [ ] Audio/video content support
- [ ] Collaborative study groups
- [ ] Cloud storage integration
- [ ] Custom question creation
- [ ] Multiple AI providers
- [ ] Offline mode

## 🤝 Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues for:
- Bug reports
- Feature requests
- Documentation improvements
- Code optimization

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **SM-2 Algorithm** - SuperMemo (Piotr Woźniak)
- **Inspiration** - Anki, Quizlet, Duolingo
- **AI** - Anthropic Claude, OpenAI GPT-4

## 📧 Contact

For questions or suggestions, please open an issue on GitHub.

## 🔧 Troubleshooting

### Common Issues

**Getting fewer questions than requested:**
- **Solution**: The system now automatically adjusts batch sizes. If issues persist, check your API key limits.

**"Failed to generate questions":**
- Check your API key in `.env`
- Ensure the backend is running
- Check backend logs for errors

**"Upload failed":**
- Check file size (max 10MB by default)
- Ensure file format is supported (PDF, HTML, MD, DOCX)

**Emoji encoding errors on Windows:**
- **Fixed**: The system now uses ASCII characters for progress logging on Windows to prevent encoding errors.

---

<div align="center">

**Made with ❤️ for learners everywhere**

⭐ Star this repo if you find it useful! ⭐

</div>
