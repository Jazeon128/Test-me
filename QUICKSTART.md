# Quick Start Guide

Get up and running with Test Me in 5 minutes!

## Step 1: Install Dependencies

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Frontend
```bash
cd frontend
npm install
```

## Step 2: Configure API Keys

Create `backend/.env`:
```env
ANTHROPIC_API_KEY=your_anthropic_api_key_here
AI_PROVIDER=anthropic
```

Or use OpenAI:
```env
OPENAI_API_KEY=your_openai_api_key_here
AI_PROVIDER=openai
```

Get API keys:
- Anthropic: https://console.anthropic.com/
- OpenAI: https://platform.openai.com/api-keys

## Step 3: Start the Backend

```bash
cd backend
python main.py
```

You should see:
```
✅ Database initialized
INFO:     Uvicorn running on http://0.0.0.0:8000
```

## Step 4: Start the Frontend

In a new terminal:
```bash
cd frontend
npm run dev
```

You should see:
```
  VITE v5.0.8  ready in 500 ms

  ➜  Local:   http://localhost:5173/
```

## Step 5: Use the App!

1. Open http://localhost:5173/ in your browser
2. Click **Upload** in the navigation
3. Drop a PDF, Markdown, HTML, or DOCX file
4. Wait for questions to generate (10-30 seconds)
5. Click **Start Review Session**
6. Answer questions and build your streak!

## Test Files

Create a simple test file to try it out:

**test.md**:
```markdown
# The Solar System

The Solar System consists of the Sun and the objects that orbit it. The eight planets in order from the Sun are: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, and Neptune.

## Earth

Earth is the third planet from the Sun and the only known planet to harbor life. It has one natural satellite, the Moon. Earth's atmosphere is composed mainly of nitrogen and oxygen.

## Mars

Mars is the fourth planet from the Sun and is often called the Red Planet due to its reddish appearance. Mars has two small moons, Phobos and Deimos.
```

Upload this file and the AI will generate questions like:
- "What is the third planet from the Sun?"
- "How many moons does Mars have?"
- "What gases make up most of Earth's atmosphere?"

## Troubleshooting

### "Failed to generate questions"
- Check your API key in `.env`
- Ensure the backend is running
- Check backend logs for errors

### "Cannot connect to backend"
- Make sure backend is running on port 8000
- Check that frontend proxy is configured (it should be by default)

### "Upload failed"
- Check file size (max 10MB by default)
- Ensure file format is supported (PDF, HTML, MD, DOCX)
- Check backend logs

## Next Steps

- Explore the **Progress** page to see statistics
- Try the **Anki export** feature (download icon on documents)
- Experiment with different difficulty levels
- Build a learning streak!

## Need Help?

- Check `PROJECT_README.md` for detailed documentation
- View API docs at http://localhost:8000/docs
- Check the browser console and backend logs for errors

Enjoy learning with Test Me! 🎓
