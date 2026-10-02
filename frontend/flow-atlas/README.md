# Flow atlas

Run `npm run atlas` from `frontend/`. Requires the existing backend virtual
environment and Microsoft Edge. No browser download or paid service is needed.

Each run backs up SQLite with the backup API and copies uploads into
`tmp/flow-atlas/YYYYMMDD-HHMMSS/work/`. It starts FastAPI on 8001 and Vite on
5174. Occupied ports cause exit 2. The original app ports are never used.

The copy receives four sample flashcards through the normal API. A parameterised
SQLite UPDATE sets that deck to `kind = "flashcards"` in `work/test_me.db` only.
Each flow loads the page after seeding, so Studio lists it under Flashcards. Edge captures
desktop (1440 × 900) and mobile (390 × 844) flows in dark mode. Output includes
viewport JPEGs in `shots/`, `manifest.json`, `backend.log` and `vite.log`.
Step failures produce an error screenshot and skip to the next flow. Errors
cause exit 1. Successful runs exit 0.

Browser routing blocks paid endpoints, settings writes, provider tag reads,
global search reranking, OpenRouter key reads and
written grading. External browser traffic is refused. The backend receives a
dead outbound proxy. Forms for generation and chat are never submitted.
Process trees stop and `work/` is deleted in `finally`, including failed runs.

Sources have no preview control. The ready-source step captures its selected
row. Restore original requires an edit, so the script moves the first non-header node on the copy
when needed, opens confirmation and cancels. The deck creation API has no kind
field. The sample deck contains four `flashcard` items through the questions API.
Its kind is then updated in the work copy before any page is loaded.

Canvas captures open from the notebook Canvases list in the centre column.
The Studio Canvas step opens New canvas. The final canvas step closes the centre view.

The model catalogue GET is fulfilled locally with a fixture shaped like `get_models`.
It includes the selected OpenRouter model IDs read from the copied database's
`generation_model` and `chat_model` settings, with the `ai_model` fallback, plus
2 additional model IDs. Fixture prices and token limits are unknown. No catalogue
request reaches a provider. `manifest.json` records these in `stubbed`, separate
from `blocked`. The final count prints both blocked requests and stubbed requests.
The capture does not read `backend/.env` or the credential store for the fixture.
