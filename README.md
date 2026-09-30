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

- 🤖 **AI-Generated Questions** - Google Gemini, Anthropic or OpenAI creates questions automatically
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

## 🚀 Quick start

### Prerequisites

- Python 3.9+ and Node.js 18+.
- A provider application programming interface (API) key for question generation. Enter it in Settings after starting the app. Imported decks work without a generation key.

Docker is not currently provided.

### Local setup

**1. Clone the repository**

```bash
git clone https://github.com/Jazeon128/Test-me.git
cd Test-me
```

**2. Install backend dependencies**

On Windows, use Command Prompt from the repository root:

```cmd
cd backend
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
```

On other systems, use a shell from the repository root:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

**3. Configure the backend**

The backend uses SQLite locally. `backend/.env` is optional. See `backend/.env.example` for available variables. Its provider defaults and required-key comments are outdated. Google Gemini is the provider used in practice. Select it in Settings in step 7.

Keys saved in Settings take priority. Environment keys are optional fallbacks. If you create `backend/.env` from the example, remove the placeholder key values. Set `AI_PROVIDER=gemini` for the Gemini fallback. `HOST=127.0.0.1` and `PORT=8000` control the backend address. Relative database and upload paths resolve against `backend/`.

**4. Apply database migrations**

From `backend/` on Windows:

```cmd
.venv\Scripts\python -m alembic upgrade head
```

On other systems, with the virtual environment active in `backend/`:

```bash
python -m alembic upgrade head
```

The migration head is `f6b1d8e3a9c5`.

**5. Start the backend**

On Windows, from the repository root in a new Command Prompt:

```cmd
scripts\dev-backend.cmd
```

The script starts in `backend/` and uses `backend/.venv`. On other systems, from `backend/` with the virtual environment active:

```bash
python main.py
```

The backend listens on `http://127.0.0.1:8000` by default.

**6. Start the frontend**

In a new terminal, from the repository root:

```bash
cd frontend
npm install
npm run dev
```

**7. Open the app and configure keys**

Open `http://localhost:5173`. In Settings, select Google Gemini and enter its key. Anthropic and OpenAI are also supported. Enter the optional TypeSafe key in the TypeSafe card for Jev features. Save and test the keys in Settings.

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
│   │   │   ├── ai/         # Question generation (Gemini/Anthropic/OpenAI)
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
└── README.md           # This file
```

## 🛠️ Tech Stack

### Backend
- **FastAPI** - Modern Python web framework
- **SQLAlchemy** - SQL toolkit and ORM
- **SQLite** - Lightweight database
- **Google Gemini / Anthropic Claude / OpenAI** - AI question generation
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
http://127.0.0.1:8000/docs
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
- API keys saved through Settings in the local database. Optional fallback keys use `backend/.env` (not committed to git).
- No external data collection
- Documents processed locally

## 🗺️ Roadmap

- [ ] Multi-user support with authentication
- [ ] Mobile app (React Native)
- [ ] Audio/video content support
- [ ] Collaborative study groups
- [ ] Cloud storage integration
- [ ] Custom question creation
- [x] Multiple AI providers
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
- **AI** - Google Gemini, Anthropic Claude, OpenAI

## 📧 Contact

For questions or suggestions, please open an issue on GitHub.

## 🔧 Troubleshooting

### Common Issues

**Getting fewer questions than requested:**
- **Solution**: Jobs report generated versus requested counts and failed sections. Check the job report and your provider limits.

**"Failed to generate questions":**
- Check and test your provider key in Settings. Check `backend/.env` if using an environment fallback.
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
