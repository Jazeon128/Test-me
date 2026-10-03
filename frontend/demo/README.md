# Static demo

Run `npm run build:demo` from `frontend`. Vite uses `.env.demo` and writes
`dist-demo`. Serve that directory with SPA fallback to `index.html`. The root
`firebase.json` configures Firebase Hosting with this fallback and a 31536000-second
cache for hashed assets. No Firebase project is selected and no deployment occurs.

The normal `npm run build` excludes the dynamically imported demo adapter and fixture.
The demo needs no backend, account, provider key, or paid API. It answers requests
from `demo/fixture.json`, with a 150 to 300 ms delay. Answers and canvas edits live
only in memory and reset when the page reloads. Other writes and exports display:

> This is a read-only demo. Run Test Me on your own computer to add sources and generate questions.

The checked-in fixture is a tiny test sample. To replace it, start a backend with
a separate database containing only the intended demo content. Then run:

```sh
npm run demo:snapshot -- --api http://127.0.0.1:8002 --notebook "The learning pyramid"
```

The script makes only GET requests. It selects exactly one notebook by name,
collects all question-bank pages and chat history, and records related sources,
passages, decks, questions, canvas nodes, tags, jobs, activity and progress.
Global notebook, document, deck, canvas and notebook-progress lists contain only
the selected notebook's data. Global activity and overall progress describe the
database, so use the separate demo database. Settings and provider keys are never fetched.

Before writing sorted JSON with 2-space indentation, the privacy check rejects
`sk-`, `AIza`, `api_key`, and Windows drive paths (`:\`) in keys or values. A failure
prints the offending JSON key path and leaves the existing fixture intact. Review
the snapshot before publishing. Do not place real credentials in the demo database.

The bank supports backend `search`, `offset`, `limit`, `difficulty`, `card_type`,
`source_id`, `deck_id`, `tag_id`, and `status`. It also accepts `q`, `page`, and
`page_size`. Held-back records come from the separate `/held-back` route.
Written-answer grading requires a provider and is blocked in the demo.
