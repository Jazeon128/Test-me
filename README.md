# Test Me

Test Me is a local notebook workspace for studying your sources. Add material, ask questions with citations, make quizzes, flashcards and canvases, then practise and review questions when they are due.

## Features

| Feature | What it does |
| --- | --- |
| Notebook workspace | Sources on the left, chat or an open deck in the centre, Studio on the right |
| Sources | Add files or a YouTube uniform resource locator (URL) without generating questions |
| Source selection | Tick ready sources to choose the material used for chat and generation |
| Grounded chat | Answers cite selected sources with numbered excerpts. Missing evidence produces a refusal |
| Studio | Generate Quiz and Flashcards decks. Create a Canvas from a selected source |
| Generation progress | Named steps, section counts, elapsed time, provider retries and partial-generation warnings |
| Practice | Open a deck in the workspace. Review everything due at `/review` |
| Quality review | Held-back questions keep their reasons and can be restored or discarded in the deck editor |
| Progress | Home shows Review due and a Progress section. Studio shows notebook progress |
| Providers | Anthropic, OpenAI, Gemini and OpenRouter, with separate generation and chat models |
| Settings | OpenRouter model catalog, prices and credit. Keys saved in the operating system (OS) credential store |
| Export | Anki package and comma-separated values (CSV) exports through the deck API |
| Phone layout | Sources and Studio become drawers below 1,024 pixels |

## Quick start

Use Python 3.11 and Node.js 20, matching continuous integration (CI). Run these commands from the repository root in PowerShell.

```powershell
cd backend
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
.venv/Scripts/python -m alembic upgrade head
.venv/Scripts/python main.py
```

In a second terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Open `http://localhost:5173`. The backend binds to `127.0.0.1:8000`. Interactive application programming interface (API) documentation is at `http://127.0.0.1:8000/docs`. No provider key is needed to start the app.

Recommended: select OpenRouter or Gemini in Settings. Check account free allowances and catalog prices before choosing a paid model. Choose a model for question generation and a model for chat. Save the relevant provider key and test the connection. Anthropic and OpenAI are also supported. TypeSafe is optional for section ranking and quality features.

Keys entered in Settings go to the OS credential store through `keyring`. Windows uses Windows Credential Manager. The API reports whether a key is configured and where it comes from. It never returns key characters.

### Environment alternative

If a secure credential store is unavailable, copy the example and edit the private copy:

```powershell
Copy-Item backend/.env.example backend/.env
```

Set `AI_PROVIDER`, optionally `AI_MODEL`, and the matching key variable in `backend/.env`. Supported values are `anthropic`, `openai`, `gemini` and `openrouter`. Never commit `backend/.env`. Never put real keys in `backend/.env.example`, screenshots, issue reports or documentation.

Key lookup uses the OS credential store first, then environment configuration including `backend/.env`, then a legacy database value read only. Task settings saved in Settings override the default provider and model.

### Existing installations

Stop the backend before upgrading the database. Keep any local backup private. Run `alembic upgrade head` through the backend virtual environment. The migration head is `f2a8c4e6b1d9`. Existing sources and decks without a notebook move into Unsorted.

Preview old database keys, then move them to the credential store:

```powershell
cd backend
.venv/Scripts/python scripts/move_keys_to_keyring.py
.venv/Scripts/python scripts/move_keys_to_keyring.py --apply
```

The first command is a dry run. The second saves and verifies each credential before clearing its database value. `backend/backups/` is ignored by Git. Database backups contain whatever the database held when copied, including legacy keys. Moving keys does not erase old backups.

## How to use

1. Create a notebook from home and open it.
2. In Sources, choose Add source. Add files or a YouTube URL. Wait for Ready.
3. Tick the sources you want to use. Select all selects ready sources. Clear unticks them.
4. Ask a question in the centre. Open a numbered citation to read the source excerpt.
5. In Studio, choose Quiz or Flashcards. Set the deck total from 1 to 100 questions and choose difficulty. Generate.
6. Watch the progress card. Read warnings and held-back counts when it finishes.
7. Choose Practise on an artifact. Choose Open to edit it or review held-back questions.
8. Use Review due on home for due questions across notebooks. The card is hidden when 0 questions are due.

Supported files are Portable Document Format (PDF), HyperText Markup Language (HTML), Markdown, Word documents (`.docx`) and PowerPoint presentations (`.pptx`). The default file limit is 10,485,760 bytes. YouTube needs an available transcript. Display names use the original file name or title, including YouTube titles when available.

Canvas currently uses the first ticked source. Tick only the intended source to make that choice explicit. Chat uses ticked ready sources. Closing an open deck returns to chat without losing its history or draft.

Read the [user guide](docs/USER_GUIDE.md) for task instructions and the [developer guide](docs/DEVELOPER_GUIDE.md) for architecture and maintenance.

## API reference

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET, POST | `/api/notebooks/` | List or create notebooks |
| GET, PATCH, DELETE | `/api/notebooks/{id}` | Read, update or delete an empty notebook |
| POST | `/api/notebooks/{id}/sources` | Add multipart `files` or `youtube_url`, returns 202 |
| GET | `/api/notebooks/{id}/workspace` | Sources, jobs, artifacts and progress |
| POST | `/api/notebooks/{id}/generate` | Generate a deck from selected sources, returns 202 |
| POST, GET, DELETE | `/api/notebooks/{id}/chat` | Send, page through or clear chat |
| GET | `/api/status/{job_id}` | Job progress and warnings |
| POST | `/api/progress/submit` | Record an answer and update review scheduling |
| POST | `/api/progress/review-session` | Fetch due review questions |
| GET | `/api/progress/stats` | Learning statistics |
| GET | `/api/decks/{id}/export/anki` | Export an Anki package |
| GET | `/api/decks/{id}/export/anki-csv` | Export Anki CSV |
| GET | `/api/settings/openrouter/models` | OpenRouter catalog |
| GET | `/api/settings/openrouter/key` | Credit information |

`num_questions` is the deck total, split across sources by passage count. It is not the count per source. Full request schemas are in the interactive API documentation.

## Tests

```powershell
cd frontend
npm test -- --run
```

```powershell
cd backend
.venv/Scripts/python -m pytest -m "not slow" -q -p no:cacheprovider
```

The [evaluation harness](backend/evals/README.md) compares question quality with budget caps. It is manual only and never runs in CI.

## Privacy and costs

The database and uploaded files live locally. Selected source text goes to the configured model provider for generation and chat. Optional TypeSafe checks also send text externally. YouTube title and transcript retrieval contacts external services.

| Component | Monthly fixed service cost | Usage cost |
| --- | ---: | --- |
| Local React frontend, FastAPI backend and SQLite | $0 | Existing device and electricity |
| OS credential store | $0 | $0 |
| Imported multiple-choice practice | $0 | $0 model calls |
| Provider calls | $0 app subscription | Account and model dependent. Check free allowances first |
| Optional TypeSafe calls | $0 app subscription | Account dependent |

Live public hosting is deferred until authentication, tenancy, durable jobs and spend caps exist. A static Firebase Hosting demo is separate open work. See the [roadmap](docs/ROADMAP.md) and [open work review](docs/OPEN_WORK_REVIEW.md).

## Troubleshooting

| Symptom | Action |
| --- | --- |
| Backend does not start | Install backend requirements in `.venv`. Run migrations from `backend/`. Check terminal errors |
| Workspace does not load | Check `http://127.0.0.1:8000/health` and that both terminals are running |
| Source is Reading | Wait for parsing. Generation cannot use a source that is still processing |
| Source is Failed | Read the error. Check file format, size and readable text. Re-add the failed source to retry |
| YouTube source fails | Check the URL and transcript availability |
| Chat refuses | Tick relevant ready sources and ask about their content. A refusal can happen without a model call |
| Answer has no citations | Treat it as unsupported. Ask again and inspect source excerpts |
| Generation returns fewer questions | Read generated versus requested counts, failed sections and held-back counts. Check provider limits |
| OpenRouter takes too long | Each generation or canvas attempt waits at most 180 seconds. Chat waits at most 90 seconds. A deadline is retried once. Try another model |
| Key cannot be saved | Use private `backend/.env` when the OS credential store is unavailable |
| Key still configured after removal | A lower-priority environment or legacy database key may remain. Check the reported source |
| Provider connection fails | Test the key in Settings and check credit or quota. For an intercepting proxy, configure `CA_BUNDLE` with a trusted certificate authority bundle |

## Feedback

Open a GitHub issue for bugs or documentation corrections without sharing credentials or private source files.

## License

MIT. See [LICENSE](LICENSE).
