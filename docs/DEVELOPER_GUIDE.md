# Developer guide

This guide describes the implementation at `f4b450e` on 2026-09-30. The [README](../README.md) covers setup. The [user guide](USER_GUIDE.md) covers workspace tasks.

## Architecture

| Component | Responsibility | Monthly fixed service cost |
| --- | --- | ---: |
| React and Vite frontend | Notebook workspace, Settings, practice and canvases | $0 locally |
| FastAPI backend | Application programming interface (API), parsing, model calls and review scheduling | $0 locally |
| SQLAlchemy and SQLite | Local persistence | $0 |
| Operating system (OS) credential store through `keyring` | Provider secrets | $0 |
| Anthropic, OpenAI, Gemini, OpenRouter | External model inference | $0 app subscription, usage billed by provider |
| Optional TypeSafe Jev | Section ranking and quality checks | $0 app subscription, usage billed by provider |
| Manual evaluation harness | Offline analysis and budget-capped external calls | $0 locally, separate usage caps |

Check account free allowances and known zero-price catalog models before paid calls. No shared inference service is required. Public hosting remains deferred until authentication, tenancy, durable jobs and spend caps exist.

### Repository map

| Path | Purpose |
| --- | --- |
| `backend/main.py` | Startup, routes, origin checks, health and metrics |
| `backend/app/api/` | Request validation and endpoint handlers |
| `backend/app/models/` | SQLAlchemy models |
| `backend/app/services/ingest.py` | Save and parse sources independently of generation |
| `backend/app/services/passages.py` | Bounded passage splitting |
| `backend/app/services/generation.py` | Selected-source validation, count allocation and empty-deck cleanup |
| `backend/app/services/workspace.py` | Workspace aggregate response |
| `backend/app/services/chat/` | Retrieval, grounded prompts and citation validation |
| `backend/app/services/ai/` | Provider clients, completion, retries and generation |
| `backend/app/services/secrets.py` | Shared secret resolver |
| `backend/app/services/parsers/` | Source parsers |
| `backend/app/services/viz/` | Canvas routing and generation |
| `backend/app/services/spaced_repetition/` | SuperMemo 2 (SM-2) scheduling |
| `backend/alembic/versions/` | Schema migrations |
| `backend/evals/` | Manual quality evaluation |
| `frontend/src/pages/NotebookWorkspace.jsx` | Workspace selection, polling and embedded deck views |
| `frontend/src/components/workspace/` | Sources, chat, citations, Studio and drawers |
| `frontend/src/services/api.js` | Shared frontend API client |
| `electron/` | Desktop launcher and packaging |

## Setup and configuration

Set `VITE_DYNAMIC_CANVAS=true` in the frontend environment to enable the shelved Dynamic Canvas and its dev-only stress route.

Use Python 3.11 and Node.js 20 to match continuous integration (CI). From `backend/`:

```powershell
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
.venv/Scripts/python -m alembic upgrade head
.venv/Scripts/python main.py
```

From `frontend/`, run `npm ci` and `npm run dev`. Frontend development uses port 5173. The backend binds to `127.0.0.1:8000`. The API schema is available at `http://127.0.0.1:8000/docs`. `scripts/dev-backend.cmd` is the Windows launcher for an existing backend virtual environment.

Relative database and upload paths resolve against `backend/`. Configuration loads `backend/.env`. Settings task values override environment provider and model defaults.

| Variable | Default or purpose |
| --- | --- |
| `DATABASE_URL` | `sqlite:///./test_me.db` |
| `AI_PROVIDER` | `anthropic`, also accepts `openai`, `gemini`, `openrouter` |
| `AI_MODEL` | Empty means provider default |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY` | Optional private environment credentials |
| `TYPESAFE_API_KEY` | Optional Jev credential |
| `HOST`, `PORT` | `127.0.0.1`, `8000` |
| `MAX_UPLOAD_SIZE` | 10,485,760 bytes |
| `UPLOAD_DIR` | `./uploads` |
| `CORS_ORIGINS_STR` | Cross-Origin Resource Sharing origins, `http://localhost:5173,http://localhost:3000` |
| `CA_BUNDLE` | Optional certificate authority bundle for intercepted Transport Layer Security connections |
| `DEBUG`, `ENVIRONMENT`, `LOG_LEVEL` | `true`, `development`, `INFO` |
| `SECRET_KEY` | Development placeholder. Production validation rejects the default |

No model key is required to start the app. Production configuration does not add authentication. Keep the backend local.

## Workspace and routes

The canonical route is `/notebooks/:id`. Sources and Studio flank the centre. An open deck uses `?deck=<id>&view=practice` or `?deck=<id>&view=edit`. With no open deck, the centre is chat. Closing a deck preserves chat state.

Below 1,024 pixels, side panels become modal drawers. At 1,024 pixels and above, side panels collapse independently. Drawer focus is trapped. Escape or backdrop closes the drawer. Reduced-motion settings disable animated movement.

Home contains notebook cards, Review due and a Progress section. `/review` practises due questions across notebooks. Review due is hidden at 0. Old standalone routes redirect to home, the notebook workspace, the home Progress anchor or `/review`. These compatibility redirects are historical entry points, not current navigation.

### API surface

| Method | Endpoint | Contract |
| --- | --- | --- |
| GET, POST | `/api/notebooks/` | List and create notebooks |
| GET, PATCH, DELETE | `/api/notebooks/{id}` | Read, update and delete empty notebooks |
| POST | `/api/notebooks/{id}/sources` | Multipart `files` and optional `youtube_url`, returns 202 |
| GET | `/api/notebooks/{id}/workspace` | Notebook, sources, jobs, artifacts and progress |
| POST | `/api/notebooks/{id}/generate` | Selected sources and deck options, returns 202 |
| POST | `/api/notebooks/{id}/chat` | `message` and `source_ids` |
| GET | `/api/notebooks/{id}/chat` | Paged history |
| DELETE | `/api/notebooks/{id}/chat` | Clear notebook chat |
| GET | `/api/status/{job_id}` | Job step, counts, logs and warnings |
| GET, POST | `/api/decks/` | Deck collections remain backend resources |
| POST | `/api/progress/submit` | Persist attempt and schedule review |
| POST | `/api/progress/review-session` | Due questions |
| GET | `/api/progress/stats` | Learning statistics |
| GET | `/api/settings/openrouter/models` | Catalog, optional `refresh=true` |
| GET | `/api/settings/openrouter/key` | Credit or usage |

Use the generated API schema for complete field definitions. The deprecated `/api/tests` backend router remains for compatibility.

## Source ingestion and passages

`save_source` hashes content and deduplicates within a notebook. It writes a local file and a `documents` row with `processing` status. Re-adding a failed duplicate schedules parsing again. A background task parses the source without generating questions.

Supported parsers handle Portable Document Format (PDF), HyperText Markup Language (HTML), Markdown, Word documents, PowerPoint presentations and YouTube transcripts. YouTube titles use oEmbed when available. `source_names.display_name` avoids exposing timestamped storage names as user labels.

Successful parsing stores full text, metadata and passages, then sets `ready` and `parsed_at`. Failed parsing sets `failed` and an error message. Empty parsed text sets `failed` with `No text could be read from this source.`

Passages are section-local chunks of at most 1,500 characters with a 200-character overlap before whitespace trimming. Splitting prefers whitespace near the boundary. Each passage has an ordinal, section index, page or heading, locator and character offsets. YouTube locators use Part numbers. Passages cascade with source deletion.

The workspace polls every 2,000 milliseconds while sources process or jobs run. Newly ready sources become selected. Only ready sources can be ticked in the interface.

## Generation jobs and provenance

`GenerateRequest` accepts `source_ids`, `kind` (`quiz` or `flashcards`), `num_questions` from 1 to 100, difficulty (`easy`, `medium`, `hard`, `mixed`), optional custom prompt and deck name.

Selected sources must belong to the notebook. Processing sources return 409. Failed or foreign sources return 400.

`num_questions` is the total for the deck. `question_split` weights by passage count and uses largest remainder allocation with source identifier tie breaks. With 0 passages across all sources, allocation uses equal weights. Shares sum to the requested total. Sources allocated 0 questions do not spawn generation tasks.

The handler creates a deck and a job with notebook, source identifiers, artifact kind and result identifier. Background tasks process each allocated source. Job rows retain current step, step start, section progress, generated and held-back counts, failed-source counts and logs. Warning-level logs become API warnings.

Quality checks preserve held-back candidates and reasons in `flagged_questions`. Restore adds a question to the deck. Discard rejects it. Failed generation removes only the new empty deck created by that job when no accepted or pending held-back material exists. Regeneration preserves existing material on failure. Shared questions use deck associations.

Job state persists, but execution uses in-process background tasks. It is not a durable worker queue. Restart recovery and distributed execution remain hosting prerequisites.

## Grounded chat retrieval

Retrieval searches stored passages from selected ready sources in the notebook. Best Matching 25 (BM25) runs locally with `k1=1.2` and `b=0.75`. Current query terms have weight 1.0. Previous user query terms add weight 0.5. Stop words are removed.

The minimum score is 1.0. No passages or a score below that threshold returns the refusal without a model call. Jev reranks the top 25 candidates using a 400-character window centred on query terms. If Jev is unavailable, BM25 order remains. Up to 6 passages reach the chat model.

The prompt wraps and escapes passages as data. It instructs the model to ignore instructions inside passages and cite claims with `[n]`. History is context, not evidence. Only the last 6 stored turns, bounded to 6,000 characters, enter the prompt. Chat completion uses 1,500 output tokens and temperature 0.2.

Citation validation strips out-of-range references, records invalid references and flags uncited answers unless the answer says Not in your sources. Citations store source, locator and a 300-character excerpt. History serialization marks deleted documents as Removed source and removes their excerpts. Citation validation checks references, not semantic correctness.

`ChatRequest.message` is 1 to 2,000 characters and must contain non-whitespace text. It requires at least 1 source identifier. Foreign sources return 400. Processing sources return 409. The frontend retains the draft on 409 and offers Retry for other errors. History supports Load earlier and clear confirmation.

## Provider clients, retries and deadlines

`client_for(task, db)` resolves task provider and model, then legacy general settings, then environment defaults. It builds per-client credentials through the shared secret resolver. Provider software development kit (SDK) retries are disabled so the shared retry policy owns attempts.

| Provider | Code default model | Client |
| --- | --- | --- |
| Anthropic | `claude-sonnet-5` | Anthropic |
| OpenAI | `gpt-4o` | OpenAI |
| Gemini | `gemini-3.8-flash` | `google.genai` |
| OpenRouter | `openrouter/auto` | OpenAI-compatible client at `https://openrouter.ai/api/v1` |

These are code defaults, not promises of provider availability. Settings exposes separate generation and chat choices and an OpenRouter catalog with prices. Key-scoped credit shows a remaining limit or usage when no limit exists.

OpenRouter sends `provider.sort=throughput`. Its socket timeout is 10 seconds for connection and 180 seconds for reads. A total deadline bounds each caller wait to 180 seconds for generation and canvas, or 90 seconds for chat. A deadline becomes a retryable 504 and is retried once. A running request cannot be cancelled by the deadline wrapper, so upstream billing can remain uncertain.

Other retryable statuses are 429, 500, 502, 503 and 504, with at most 4 attempts. Numeric Retry-After delays are capped at 60 seconds. Otherwise backoff uses provider details or bounded exponential delay and jitter. Daily quota exhaustion and OpenRouter exhausted credit stop retries. Generation exposes provider retry steps to users.

## Secrets and backups

| Priority | Store | Behaviour |
| --- | --- | --- |
| 1 | OS credential store | `keyring`, service `test-me`, credential name is provider |
| 2 | Environment configuration | Includes private `backend/.env` |
| 3 | Legacy database values | Read only fallback |

Supported names are `anthropic`, `openai`, `gemini`, `openrouter` and `typesafe`. New Settings key writes use the credential store. Windows uses Windows Credential Manager. Missing secure storage produces an error directing the user to private environment configuration. There is no new plaintext database write fallback.

The API returns configured and storage-source metadata, never key characters. Removing a credential-store value can expose an environment or legacy value. Model settings remain in the database.

Run these manually from `backend/` for old installations:

```powershell
.venv/Scripts/python scripts/move_keys_to_keyring.py
.venv/Scripts/python scripts/move_keys_to_keyring.py --apply
```

The default is a dry run showing provider names and character counts. Apply saves, reads back and verifies each credential before clearing its database row. Unverified values remain in the database on failure.

Never put real keys in `.env.example`. Never commit `.env`. `backend/backups/` is gitignored, but backups contain all database values present at backup time. Old backups can retain legacy keys after migration. Keep them private.

Origin checks reject cross-site browser writes with 403. Loopback, desktop origins and requests without an Origin header can still be allowed. This is not authentication or tenancy.

## Model call ledger

Every application model call is recorded in `llm_calls` with task, requested and actual model, provider, upstream provider, input and output tokens, latency, attempts, outcome and cost. A logical call includes retries. The first OpenRouter deadline can add its own timeout row. Costs use United States dollars (USD) and may be unknown. `cost_source` distinguishes reported, estimated or unknown cost. The ledger is observability, not a spend cap.

Jev calls use `jev_calls` with feature label, question count, input tokens, duration, success and error. Recording is best effort. Settings shows recent TypeSafe usage. Eval calls use their own persisted budget ledgers described in the harness README.

## Data model

JavaScript Object Notation (JSON) columns preserve source selection, provenance, citations, diagram payloads and job metadata.

| Table | Important fields and relationships |
| --- | --- |
| `notebooks` | Name, description, icon. Owns documents and decks |
| `documents` | Notebook, original and stored file names, type, path, size, full content, content hash, title, pages, `status`, `error_message`, `parsed_at` |
| `document_passages` | Document foreign key with deletion cascade, ordinal unique per document, section index, page, heading, locator, text, `char_start`, `char_end` |
| `decks` | Notebook, name, description, `kind`, `source_ids` |
| `deck_questions` | Deck-question association and order. Supports shared questions |
| `questions` | Document, stem, explanation, difficulty, source reference including source text |
| `question_options` | Question, option text, correctness and order |
| `flagged_questions` | Document and deck, raw question data, reasons, review status |
| `generation_status` | Unique job identifier, deck, notebook, source identifiers, kind, result identifier, `deck_created`, state, current step, progress, logs, errors, pending request, requested/generated/flagged counts, document completion/failure counts, timestamps including `step_started_at` |
| `chat_messages` | Notebook foreign key with cascade, role, content, source identifiers, citations, refusal flag, model, created time |
| `llm_calls` | Task, provider, requested/actual model, upstream provider, input/output tokens, `cost_usd` numeric (12, 6), cost source, latency milliseconds, attempts, status, error type, job and response identifiers |
| `jev_calls` | Feature label, question count, input tokens, duration milliseconds, outcome and error |
| `canvases` | Document, request, template, title, payload, layout, sources, routing confidence and user choice |
| `canvas_routing_log` | Routing probabilities, shape signals, confidence, chosen template, override, duration and tokens |
| `user_progress` | Question, SM-2 factor/interval/repetitions, due time, attempts, accuracy, timing, mastery and mutable history |
| `study_days` | Unique local date, answered/correct counts, canvases and persisted points |
| `awards` | Unique award code, title, description and earned detail |
| `tags`, `question_tags` | Tags and question associations |
| `settings` | Unique key/value pairs for configuration and read-only legacy secrets |

Indexes support document/difficulty queries, due-question queries, notebook jobs and passage lookup. Source deletion removes passages and handles dependent study material. Notebook deletion rejects notebooks still holding sources or decks with 409.

## Migrations

Stop the backend and keep a private backup before upgrades. From `backend/`:

```powershell
.venv/Scripts/python -m alembic current
.venv/Scripts/python -m alembic upgrade head
.venv/Scripts/python -m alembic heads
```

Startup `init_db` creates tables only for an empty database. It does not upgrade an existing schema. Use Alembic for schema changes. Do not stamp an old schema as head to bypass migrations.

| Revision in chain order | Change |
| --- | --- |
| `96bad6a9040d` | Initial schema |
| `32f25b397e98` | Composite indexes |
| `64306e156071` | Generation progress fields |
| `84d5a1b9211a` | Canvas and routing log |
| `2c468b48ab41` | Notebooks |
| `7b5dca85479c` | Study days and awards |
| `9c1e4f2a7b30` | Generation pending request |
| `b7f3a1c9d2e4` | Held-back questions |
| `d4e8b2f6a1c3` | Repair damaged notebook icons |
| `e5a9c3d7f1b2` | Jev usage |
| `f6b1d8e3a9c5` | Completed and failed document counts |
| `a1c4e7b9d2f6` | Step start time |
| `b7d2e4f8a1c3` | Source state and stored passages |
| `c3f9a2d6e8b4` | Artifact/job provenance and Unsorted backfill |
| `d8a1b5c7e2f9` | Job created-deck flag |
| `e4c7a9b1d3f5` | Model call ledger |
| `f2a8c4e6b1d9` | Chat messages, current head |

## Testing exactly as CI

`.github/workflows/ci.yml` uses Python 3.11 and Node.js 20 on Ubuntu. Run the same commands from each component directory. Local Windows commands can use `.venv/Scripts/python -m pytest` in place of the activated environment's `pytest`.

| Directory | Install | Checks in CI order |
| --- | --- | --- |
| `backend` | `pip install -r requirements.txt` | `flake8 app/`, `pytest -m "not slow"` |
| `frontend` | `npm ci` | `npm run lint`, `npm test -- --run`, `npm run build` |
| `electron` | `npm ci` | `npx jest --forceExit` |

Documentation sanity checks:

```powershell
cd frontend
npm test -- --run
```

```powershell
cd backend
.venv/Scripts/python -m pytest -m "not slow" -q -p no:cacheprovider
```

Do not replace real-user reproduction of a bug with unit tests alone. Test provider behaviour with mocks in CI. Do not run paid evaluation as part of CI.

## Manual evaluation harness

See [backend/evals/README.md](../backend/evals/README.md) for freeze, generate, check, judge, report and agreement commands. This is manual only, budget-capped and never in CI.

Freeze records a deterministic corpus manifest. Generate stores raw candidates and production parser results for each model, prompt and passage cell. Check runs deterministic rules and pinned Jev checks. Judge makes separate blind solve and rubric calls. Human review uses a blind sheet with a separate model key. Report produces a self-contained offline HTML report. Agreement compares human and judge labels.

`pilot.local.json` holds private source paths. Corpus and run artifacts are gitignored. Do not publish them as documentation. Generation dry-run makes 0 network calls and needs saved catalog prices. Freeze makes 0 API calls. Generation, checks and judging can spend money. Offline report and agreement do not.

Pilot caps are $3.00 for generation/check ledger work and $2.50 for judging. Reservations precede calls and uncertain billing is retained on recovery. Only the run's writer recovers reservations under a lock. A cap cannot undo upstream charges above the estimate.

Pilot results remain pending. No model recommendation follows from harness implementation alone.

## Architecture decisions

See the [architecture decision record (ADR) index](adr/README.md), especially the workspace, retrieval and OS credential-store records added on 2026-09-30.
