# 📚 Test Me - Gamified Learning Platform

<div align="center">

![Test Me Banner](https://img.shields.io/badge/Learning-Gamified-blue?style=for-the-badge)
![Python](https://img.shields.io/badge/Python-3.9+-green?style=for-the-badge&logo=python)
![React](https://img.shields.io/badge/React-18-blue?style=for-the-badge&logo=react)
![FastAPI](https://img.shields.io/badge/FastAPI-Modern-teal?style=for-the-badge&logo=fastapi)

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
- ✅ Intelligent text extraction with structure preservation
- ✅ Source reference tracking for every answer
- ✅ Batch question generation (1-50 questions per document)

### Learning Experience
- ✅ Spaced repetition system (SM-2 algorithm)
- ✅ Adaptive difficulty based on performance
- ✅ Real-time 30-second timer per question
- ✅ Instant feedback with explanations
- ✅ Mastery tracking and progress analytics

### Gamification
- ✅ Points system with streak multipliers
- ✅ Achievement unlocks
- ✅ Current/best streak tracking
- ✅ Visual progress indicators
- ✅ Motivational feedback

### Integrations
- ✅ Export to Anki (.apkg files)
- ✅ **NEW:** Export to Anki All-In-One CSV (supports "Multiple Choice for Anki" add-on)
- ✅ Beautiful card formatting
- ✅ Source references included
- ✅ Difficulty tags

### Security & Design
- 🔒 **Enhanced Security:** Content-based file validation and secure secret management
- 🎨 **Premium UI:** Modern glassmorphism design with Inter font and smooth animations

## 🚀 Quick Start

### Prerequisites
- Python 3.9+
- Node.js 18+
- API key from [Anthropic](https://console.anthropic.com/) or [OpenAI](https://platform.openai.com/)

### Installation

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

**4. Start Backend**
```bash
python main.py
# Server runs on http://localhost:8000
```

**5. Frontend Setup** (new terminal)
```bash
cd frontend
npm install
npm run dev
# App runs on http://localhost:5173
```

**6. Open Your Browser**
```
http://localhost:5173
```

See [QUICKSTART.md](QUICKSTART.md) for detailed instructions.

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
- **BeautifulSoup4** - HTML parsing
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
