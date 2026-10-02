# Flow atlas

Run `npm run atlas` from `frontend/`. Requires the existing backend virtual
environment and Microsoft Edge. No browser download or paid service is needed.

Each run backs up SQLite with the backup API and copies uploads into
`tmp/flow-atlas/YYYYMMDD-HHMMSS/work/`. It starts FastAPI on 8001 and Vite on
5174. Occupied ports cause exit 2. The original app ports are never used.

The copy receives four sample flashcards through the normal API. Edge captures
desktop (1440 × 900) and mobile (390 × 844) flows in dark mode. Output includes
viewport JPEGs in `shots/`, `manifest.json`, `backend.log` and `vite.log`.
Step failures produce an error screenshot and skip to the next flow. Errors
cause exit 1. Successful runs exit 0.

Browser routing blocks paid endpoints, settings writes, provider tag reads,
global search reranking, OpenRouter catalog/key reads and
written grading. External browser traffic is refused. The backend receives a
dead outbound proxy. Forms for generation and chat are never submitted.
Process trees stop and `work/` is deleted in `finally`, including failed runs.

Sources have no preview control. The ready-source step captures its selected
row. Restore original requires an edit, so the script moves a node on the copy
when needed, opens confirmation and cancels. The deck creation API has no kind
field. The sample deck contains four `flashcard` items through the questions API.
