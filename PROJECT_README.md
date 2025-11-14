# Test Me - Gamified Learning Platform

A gamified study application that generates multiple-choice tests from documents (PDF, HTML, Markdown, DOCX) using AI, featuring spaced repetition learning and Anki export capabilities.

## Features

### Document Processing
- **Multi-format Support**: Upload PDF, HTML, Markdown, or DOCX files
- **Intelligent Parsing**: Extracts text while maintaining structure and references
- **AI-Powered Question Generation**: Uses Claude or GPT-4 to create high-quality multiple-choice questions
- **Source References**: Every question includes a reference to where the answer appears in the source material

### Spaced Repetition System (SRS)
- **SM-2 Algorithm**: Same algorithm used by Anki for optimal learning
- **Adaptive Scheduling**: Questions appear based on your performance
- **Mastery Tracking**: Track which questions you've mastered
- **Intelligent Review**: Prioritizes overdue questions and new content

### Gamification
- **Real-time Timer**: 30-second timer per question (configurable)
- **Streak System**: Build streaks with consecutive correct answers
- **Points & Bonuses**: Earn points with streak multipliers
- **Achievement System**: Unlock achievements as you progress
- **Progress Dashboard**: Visualize your learning journey

### Anki Integration
- **Export to Anki**: Generate .apkg files from your question sets
- **Formatted Cards**: Beautiful, readable cards with explanations
- **Source References**: Includes references in exported cards
- **Difficulty Tags**: Questions tagged by difficulty level

## Tech Stack

### Backend
- **FastAPI**: Modern, fast Python web framework
- **SQLAlchemy**: SQL toolkit and ORM
- **SQLite**: Lightweight database (easily upgradeable to PostgreSQL)
- **Anthropic Claude / OpenAI GPT**: AI question generation
- **Document Parsers**:
  - pdfplumber (PDF)
  - python-docx (DOCX)
  - BeautifulSoup4 (HTML)
  - markdown (Markdown)
- **genanki**: Anki deck generation

### Frontend
- **React 18**: Modern UI library
- **Vite**: Fast build tool
- **Tailwind CSS**: Utility-first CSS
- **Framer Motion**: Smooth animations
- **Axios**: HTTP client
- **React Router**: Navigation

## Installation

### Prerequisites
- Python 3.9+
- Node.js 18+
- npm or yarn

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Create virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Configure environment:
```bash
cp .env.example .env
# Edit .env and add your API keys:
# - ANTHROPIC_API_KEY or OPENAI_API_KEY
# - Choose AI_PROVIDER (anthropic or openai)
```

5. Run the server:
```bash
python main.py
```

The API will be available at `http://localhost:8000`
API docs at `http://localhost:8000/docs`

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Usage

### 1. Upload a Document
- Click "Upload" in the navigation
- Drag and drop or select a file (PDF, HTML, MD, or DOCX)
- Configure number of questions (default: 10)
- Choose difficulty level (easy, medium, hard, or mixed)
- Wait for processing

### 2. Start Learning
- Click "Start Review Session" from the dashboard
- Answer questions with the 30-second timer
- Get instant feedback with explanations
- Build your streak and earn points!

### 3. Track Progress
- View detailed statistics on the Progress page
- See your success rate, streaks, and mastery levels
- Monitor questions due for review
- Unlock achievements

### 4. Export to Anki
- Go to Documents page
- Click the download icon on any document
- Import the .apkg file into Anki

## API Endpoints

### Documents
- `POST /api/documents/upload` - Upload and process document
- `GET /api/documents/` - List all documents
- `GET /api/documents/{id}` - Get document details
- `DELETE /api/documents/{id}` - Delete document

### Questions
- `GET /api/questions/{id}` - Get question details
- `GET /api/questions/document/{document_id}` - Get all questions for a document

### Tests
- `POST /api/tests/` - Create test from questions
- `GET /api/tests/` - List all tests
- `GET /api/tests/{id}` - Get test details
- `POST /api/tests/{id}/start` - Start test session
- `GET /api/tests/{id}/export/anki` - Export test to Anki

### Progress
- `POST /api/progress/submit` - Submit answer and update progress
- `GET /api/progress/question/{id}` - Get progress for question
- `GET /api/progress/stats` - Get overall statistics
- `POST /api/progress/review-session` - Get questions for review

## Configuration

### Backend (.env)
```env
# Database
DATABASE_URL=sqlite:///./test_me.db

# AI Provider
ANTHROPIC_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
AI_PROVIDER=anthropic  # or openai

# Application
DEBUG=True
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# File Upload
MAX_UPLOAD_SIZE=10485760  # 10MB
```

### Spaced Repetition
The SM-2 algorithm parameters can be adjusted in:
`backend/app/services/spaced_repetition/sm2_algorithm.py`

### Timer Settings
Default timer (30s) can be changed in:
`frontend/src/pages/TestSession.jsx`

## Architecture

### Spaced Repetition (SM-2)
The app uses the SuperMemo 2 algorithm:
- **Easiness Factor (EF)**: Starts at 2.5, adjusts based on performance
- **Interval**: Days until next review (1, 6, then EF × previous)
- **Repetitions**: Consecutive correct answers
- **Quality**: 0-5 scale based on correctness and speed

### Question Generation
1. Document is parsed into sections with references
2. Sections are distributed to cover the entire document
3. AI generates questions with 4 options
4. Questions include explanations and source references
5. Stored in database with metadata

### Gamification System
- **Points**: 10 points per correct answer
- **Streak Bonus**: Current streak × 5 additional points
- **Mastery**: Achieved after 5 consecutive correct answers with EF ≥ 2.5 and 80%+ success rate
- **Achievements**: Unlocked based on various milestones

## Development

### Running Tests
```bash
cd backend
pytest
```

### Building for Production

Backend:
```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000
```

Frontend:
```bash
cd frontend
npm run build
npm run preview
```

## Future Enhancements

- [ ] Multi-user support with authentication
- [ ] Mobile app (React Native)
- [ ] Audio/video content support
- [ ] Collaborative study groups
- [ ] Advanced analytics and insights
- [ ] Custom question creation
- [ ] Multiple AI providers selection
- [ ] Cloud storage integration
- [ ] Offline mode

## License

MIT License - feel free to use this project for your own learning!

## Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues for bugs and feature requests.

## Credits

- **SM-2 Algorithm**: SuperMemo (Piotr Woźniak)
- **Inspiration**: Anki, Quizlet, Duolingo
- **AI**: Anthropic Claude, OpenAI GPT-4
