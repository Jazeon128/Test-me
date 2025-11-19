# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Test Me** is a full-stack gamified learning platform that transforms documents (PDF, HTML, Markdown, DOCX) into AI-generated multiple-choice questions with spaced repetition learning and multiple export formats (Anki .apkg and CSV).

**Type**: Web Application (Full-Stack)
**Stack**: FastAPI (Python) + React (Vite) + SQLite
**AI Providers**: Anthropic Claude / OpenAI GPT-4 / Google Gemini
**Repository**: Test-me

## Development Commands

### Backend (FastAPI)

```bash
# Setup
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add:
# - ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY
# - AI_PROVIDER=anthropic, openai, or gemini

# Run development server
python main.py
# Server runs on http://localhost:8000
# API docs at http://localhost:8000/docs

# Run tests
pytest
pytest tests/unit/
pytest tests/integration/
```

### Frontend (React + Vite)

```bash
# Setup
cd frontend
npm install

# Run development server
npm run dev
# App runs on http://localhost:5173

# Build for production
npm run build
npm run preview

# Lint
npm run lint
```

## Architecture Overview

### High-Level System Design

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React Frontend│───▶│  FastAPI Backend │───▶│  SQLite DB      │
│   (Port 5173)   │◀───│  (Port 8000)     │◀───│  (test_me.db)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────┐
                       │  AI Services │
                       │ Claude/GPT-4 │
                       └──────────────┘
```

### Backend Architecture (`backend/app/`)

**Layered Architecture Pattern:**

1. **API Layer** (`app/api/`):
   - `documents.py` - Document upload, processing, deletion
   - `questions.py` - Question retrieval and management
   - `tests.py` - Test creation, session management, Anki/CSV export
   - `decks.py` - Deck management and regeneration
   - `progress.py` - Answer submission, review sessions, statistics
   - `settings.py` - Settings management

2. **Models Layer** (`app/models/`):
   - SQLAlchemy ORM models
   - `document.py` - Document metadata and content
   - `question.py` - Questions with answers and explanations
   - `test.py` - Test/deck groupings
   - `user_progress.py` - SM-2 algorithm state per question
   - `settings.py` - User settings

3. **Services Layer** (`app/services/`):
   - **AI Services** (`ai/`):
     - `question_generator.py` - Generates questions using Claude/GPT-4
     - Supports both Anthropic and OpenAI providers
     - Creates questions with 4 options, explanations, and source references

   - **Document Parsers** (`parsers/`):
     - `base_parser.py` - Abstract base class for all parsers
     - `pdf_parser.py` - PDF extraction using pdfplumber
     - `docx_parser.py` - DOCX parsing using python-docx
     - `html_parser.py` - HTML parsing using BeautifulSoup4
     - `markdown_parser.py` - Markdown parsing
     - All return `ParsedDocument` with sections and references

   - **Spaced Repetition** (`spaced_repetition/`):
     - `sm2_algorithm.py` - SuperMemo 2 algorithm implementation
     - Tracks easiness factor, interval, repetitions
     - Adjusts difficulty based on time taken (30s default)

   - **Export Services**:
     - `anki_export.py` - Generates .apkg files using genanki
     - `csv_export.py` - Generates CSV files compatible with Anki import

4. **Database Layer** (`app/db/`):
   - `database.py` - SQLAlchemy setup and session management
   - SQLite database stored at `backend/test_me.db`

### Frontend Architecture (`frontend/src/`)

**Component-Based Architecture:**

1. **Pages** (`pages/`):
   - `Dashboard.jsx` - Main overview with session start
   - `Upload.jsx` - Document upload and question generation
   - `Documents.jsx` - Document library with deck management
   - `TestSession.jsx` - Quiz interface with 30s timer
   - `Progress.jsx` - Statistics and analytics
   - `Settings.jsx` - Settings configuration
   - `Decks.jsx` - Deck management with Anki and CSV export

2. **Components** (`components/`):
   - Reusable UI components
   - `Layout.jsx` - App layout wrapper

3. **Services** (`services/`):
   - API client using axios
   - Base URL: `http://localhost:8000`

4. **State Management**:
   - Zustand for global state
   - React Router for navigation

## Key Implementation Patterns

### Document Processing Flow

1. **Upload**: User uploads file via `/api/documents/upload`
2. **Parse**: Appropriate parser extracts text into sections with references
3. **Section Selection**: Sections are evenly distributed to cover entire document
4. **Question Generation**: AI generates questions from selected sections
5. **Storage**: Questions stored with metadata and source references
6. **Deck Creation**: Questions grouped into test/deck

### Spaced Repetition (SM-2) Flow

**Question State:**
- `easiness_factor` (EF): Starts at 2.5, min 1.3
- `interval`: Days until next review
- `repetitions`: Consecutive correct answers
- `next_review_date`: When question is due

**Answer Processing:**
1. User submits answer with time taken
2. Quality calculated based on correctness and time (0-5 scale):
   - Correct + fast (≤15s) = PERFECT (5)
   - Correct + medium (≤24s) = CORRECT_MEDIUM (4)
   - Correct + slow (>24s) = CORRECT_HARD (3)
   - Incorrect = INCORRECT_EASY (2) or INCORRECT_HARD (1)
3. SM-2 algorithm updates EF, interval, repetitions
4. Next review date calculated
5. Points awarded (10 base + streak × 5 bonus)

**Review Session Logic:**
- Prioritizes overdue questions (past next_review_date)
- Includes new questions (never answered)
- Mixes for variety

**Mastery Criteria:**
- 5+ consecutive correct answers
- Easiness Factor ≥ 2.5
- Success rate ≥ 80%

### AI Question Generation

**Prompt Strategy:**
- Expert educational assessment designer approach
- Bloom's Taxonomy cognitive level alignment (remember, understand, apply, analyze, evaluate, create)
- Complete standalone question stems (no negatives like "Which is NOT...")
- Plausible distractors based on common student misconceptions
- Professional exam language with format consistency
- Quality checklist to avoid vague or ambiguous questions
- Tests understanding and application, not just memorization
- Generates exactly the requested number of questions

**Generation Parameters:**
- **Batch Size**: Dynamically adjusted (5 for <20 questions, 10 for ≥20 questions)
- **Token Limits**: 8192 max_tokens for all providers (prevents truncation)
- **Section Coverage**: Evenly distributed across document sections
- **Progress Logging**: Real-time status updates during generation

**Provider Configuration:**
- Settings stored in database (`settings` table)
- Falls back to environment variables
- Current models and limits:
  - **Anthropic**: `claude-3-5-sonnet-20241022` (8192 tokens)
  - **OpenAI**: `gpt-4-turbo-preview` (8192 tokens)
  - **Google Gemini**: `gemini-1.5-pro` (8192 tokens)

**System Message Structure:**
The prompt includes comprehensive guidelines:
- Question stem quality requirements
- Answer option formatting (similar length, grammar)
- Cognitive level alignment for difficulty
- Quality checklist (7 criteria)
- Common mistakes to avoid (5 rules)

### Deck Management Pattern

**Deck Lifecycle:**
1. Created from document with N questions
2. Can be regenerated with custom prompts
3. Supports learning from examples (upload + analyze pattern)
4. Multi-file upload to generate cohesive deck
5. Each question tracks individual SM-2 state

### Export Options

Test Me supports multiple export formats for maximum flexibility:

#### Anki .apkg Export

**Export Format:**
- Generates `.apkg` files using genanki library
- Professional card template with custom CSS styling
- Fully compatible with Anki desktop and mobile apps

**Card Structure:**
- **Front**: Question with all 4 options (A, B, C, D)
- **Back**:
  - All options with correct answer highlighted in green
  - Detailed explanation
  - Source reference from original document
  - Difficulty tag

**How to Export:**
1. **Via Frontend UI**:
   - Go to Decks page (`/decks`)
   - Click green Download icon (📥) on any deck
   - File downloads as `{deck_name}.apkg`

2. **Via API**:
   ```bash
   curl -o my_deck.apkg http://localhost:8000/api/tests/{test_id}/export/anki
   ```

**Import to Anki:**
1. Open Anki desktop or mobile app
2. File → Import → Select the `.apkg` file
3. Questions appear as new deck with custom styling
4. Each card tagged with difficulty level

**Implementation:** `backend/app/services/anki_export.py`

#### CSV Export

**Export Format:**
- Generates simplified CSV files compatible with Anki import
- UTF-8 encoding with BOM for Excel compatibility
- Proper quoting for special characters and multiline text

**CSV Structure:**
```csv
Question, OptionA, OptionB, OptionC, OptionD, CorrectAnswer, Explanation, Source, Difficulty
```

**Fields:**
- `Question` - The question text/scenario
- `OptionA-D` - The four answer options
- `CorrectAnswer` - Letter indicating correct answer (A, B, C, or D)
- `Explanation` - Detailed explanation of the answer
- `Source` - Formatted source reference (e.g., "Page 5, Section: Intro, "quote"")
- `Difficulty` - Question difficulty level (easy, medium, hard)

**How to Export:**
1. **Via Frontend UI**:
   - Go to Decks page (`/decks`)
   - Click blue FileText icon (📄) on any deck
   - File downloads as `{deck_name}.csv`

2. **Via API**:
   ```bash
   curl -o my_deck.csv http://localhost:8000/api/tests/{test_id}/export/csv
   ```

**Use Cases:**
- Import into Anki using standard CSV import
- Open in Excel/Google Sheets for review
- Process with custom scripts
- Share with users who don't have Anki
- Archive questions in human-readable format

**Example CSV Output:**
```csv
"What is 2+2?","3","4","5","6","B","2+2 equals 4 by basic arithmetic.","Page 1, Section: Introduction","easy"
```

**Implementation:** `backend/app/services/csv_export.py`

## Database Schema

**Key Relationships:**
- `Document` 1:N `Question` - One document has many questions
- `Question` N:M `Test` - Questions can be in multiple tests/decks
- `Question` 1:1 `UserProgress` - Each question has one progress record
- `Settings` - Key-value store for configuration

**Important Fields:**
- `Question.source_reference` - Where answer appears in document
- `UserProgress.next_review_date` - SM-2 scheduling
- `UserProgress.easiness_factor` - SM-2 difficulty adjustment
- `UserProgress.streak_count` - Gamification

## Configuration

### Environment Variables (`.env`)

```bash
# Database
DATABASE_URL=sqlite:///./test_me.db

# AI Provider
ANTHROPIC_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
GEMINI_API_KEY=your_key_here
AI_PROVIDER=anthropic  # anthropic, openai, or gemini

# Application
DEBUG=True
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# File Upload
MAX_UPLOAD_SIZE=10485760  # 10MB
UPLOAD_DIR=uploads
```

### Frontend API Configuration

Base URL configured in `frontend/src/services/` - defaults to `http://localhost:8000`

## Testing Strategy

### Backend Tests
- Unit tests for SM-2 algorithm logic
- Integration tests for API endpoints
- Document parser tests for each format
- AI question generation mocks

### Frontend Tests
- Component rendering tests
- User interaction flows
- API integration tests

## Common Development Tasks

### Adding a New Document Format

1. Create parser in `backend/app/services/parsers/`
2. Extend `BaseParser` class
3. Implement `parse()` method returning `ParsedDocument`
4. Register in document upload endpoint
5. Update file type validation in frontend

### Modifying SM-2 Algorithm Parameters

- Edit `backend/app/services/spaced_repetition/sm2_algorithm.py`
- Key constants: `time_limit_seconds`, quality thresholds
- Mastery criteria in `calculate_mastery_level()`

### Changing Timer Duration

- Frontend: `frontend/src/pages/TestSession.jsx`
- Backend: Adjust quality calculation in `sm2_algorithm.py`

### Adding New AI Provider

1. Update `QuestionGenerator` in `backend/app/services/ai/question_generator.py`
2. Add provider authentication
3. Format prompts for provider's API
4. Update settings model and API

### Adding New Export Format

1. Create exporter service in `backend/app/services/` (e.g., `json_export.py`)
2. Extend pattern from `csv_export.py` or `anki_export.py`
3. Add endpoint to `backend/app/api/tests.py` (e.g., `/tests/{test_id}/export/json`)
4. Add API method to `frontend/src/services/api.js` (e.g., `exportJSON`)
5. Add export button to `frontend/src/pages/Decks.jsx`
6. Test with various question sets

## File Upload Locations

- Uploaded files: `backend/uploads/`
- Database: `backend/test_me.db`
- Both excluded from git via `.gitignore`

## API Documentation

Interactive API docs available at `http://localhost:8000/docs` when backend is running.

### Key Export Endpoints

**Anki Export:**
```
GET /api/tests/{test_id}/export/anki
Response: application/octet-stream (.apkg file)
```

**CSV Export:**
```
GET /api/tests/{test_id}/export/csv
Response: text/csv; charset=utf-8 (.csv file)
```

Both endpoints:
- Require test to exist and have questions
- Return file with Content-Disposition header
- Use test name for filename
- Handle special characters properly
- Clean up temporary files automatically

## Known Patterns

### Error Handling
- API returns FastAPI HTTPException with status codes
- Frontend displays user-friendly error messages
- File size limits enforced (10MB default)

### CORS Configuration
- Configured in `main.py`
- Allows localhost:5173 and localhost:3000
- Update `CORS_ORIGINS` in `.env` for production

### Database Migrations
- Currently using SQLAlchemy with direct model sync
- Consider adding Alembic migrations for production schema changes

## Database Backup & Recovery

### Backup Script

Located at `backend/scripts/backup_db.py` - preserves all user progress, questions, and settings.

**Create Backup:**
```bash
cd backend
python scripts/backup_db.py
```

**Backup with Cleanup (keep last 10):**
```bash
python scripts/backup_db.py --clean
```

**List Available Backups:**
```bash
python scripts/backup_db.py --list
```

**Restore from Backup:**
```bash
python scripts/backup_db.py --restore backups/test_me_backup_20251114_193734.db
```

**Features:**
- Timestamped backups in `backend/backups/`
- Automatic cleanup of old backups
- Safety backup created before restore
- Preserves all user progress data (SM-2 state, streaks, mastery)

## Recent Features

### Latest (November 2025)
- **Enhanced Question Quality**: Completely redesigned AI prompt with Bloom's Taxonomy alignment, better distractors, and educational best practices
- **Increased Question Generation**: Fixed batch size and token limits to reliably generate 20+ questions (was capped at ~10)
- **Manual Question Creation**: Made document_id nullable to allow creating questions without documents
- **Token Limit Optimization**: Increased to 8192 tokens across all AI providers (Anthropic, OpenAI, Gemini)
- **Progress Logging**: Real-time generation status with section-by-section updates
- **Windows Compatibility**: Fixed emoji encoding issues in console output

### Previous Features
- **CSV Export**: Added CSV export option alongside Anki .apkg export for maximum flexibility
- **Google Gemini Support**: Added Gemini 1.5 Pro as third AI provider option
- **Smart Deck Naming**: Decks automatically named after uploaded files instead of timestamps
- **Database Backup**: Comprehensive backup/restore script with cleanup
- **Settings Router**: Fixed settings endpoint for saving AI configuration
- **Progress Tracking**: Fixed answer submission to properly initialize user progress
- **Deck Regeneration**: Can regenerate questions with custom prompts (backend/app/api/decks.py:73)
- **Example-Based Learning**: Upload documents to learn question patterns
- **Multi-File Upload**: Generate cohesive decks from multiple files
- **Settings Integration**: Database-backed settings override environment variables

## Troubleshooting

### Common Issues

**Getting fewer questions than requested (e.g., 10 instead of 20):**
- **Fixed (Nov 2025)**: Increased batch size to 10 for large requests and added max_tokens=8192 to all AI providers
- Location: `backend/app/services/ai/question_generator.py:94, 162-185`
- Cause: Conservative batch size limit and missing token parameters caused output truncation
- **Solution**: Backend now generates exactly the number requested with progress logging

**Poor quality or unhelpful questions:**
- **Fixed (Nov 2025)**: Enhanced AI prompt with educational best practices
- Location: `backend/app/services/ai/question_generator.py:224-272`
- Improvements: Bloom's Taxonomy alignment, plausible distractors, complete question stems, quality checklist
- Questions now test understanding vs memorization

**"500 Internal Server Error" when creating manual questions:**
- **Fixed (Nov 2025)**: Made document_id nullable in Question model
- Location: `backend/app/models/question.py:12`
- Cause: Manual questions don't have associated documents
- **Solution**: Can now create questions without document_id

**Emoji encoding errors on Windows console:**
- **Fixed (Nov 2025)**: Replaced emoji characters with ASCII in progress logging
- Symptoms: `'charmap' codec can't encode character` errors
- **Solution**: Uses `[*]`, `[+]`, `[-]` instead of emojis

**"Failed to submit answer" error:**
- **Fixed**: UserProgress fields now properly initialized with default values
- Location: `backend/app/api/progress.py:62-74`
- Cause: NoneType fields when creating new progress records

**"Not Found" error when saving settings:**
- **Fixed**: Settings router now included in main.py
- Location: `backend/main.py:75`
- Requires backend restart to take effect

**Decks have timestamp names instead of file names:**
- **Fixed**: Deck names now based on uploaded filenames
- Location: `backend/app/api/documents.py:70-80`
- Format: Single file uses filename, multiple files use "filename + N more"

**API Key Validation:**
- Anthropic keys start with `sk-ant-`
- OpenAI keys start with `sk-`
- Gemini keys start with `AIza`
- Keys stored in database settings table, fallback to .env

### Settings Persistence

Settings are stored in two places (priority order):
1. **Database** (`settings` table) - Takes precedence
2. **Environment variables** (`.env` file) - Fallback

To switch providers:
- Use Settings page in UI (saves to database)
- Or edit `.env` and restart backend

## Important Notes

- The SM-2 algorithm is the same algorithm used by Anki
- Time taken affects quality score (questions answered slowly get lower quality)
- Streak system multiplies points (streak × 5 bonus points)
- Questions must be answered within 30 seconds for optimal quality scoring
- Source references preserve learning context from original documents
- Database backups do NOT include uploaded files (only metadata) - back up `backend/uploads/` separately if needed
