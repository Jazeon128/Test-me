# Open work review

Reviewed 2026-09-30 through `f4b450e`. This review separates shipped implementation from pending product validation.

## Completed work

| Item | Verdict | Evidence and current behaviour |
| --- | --- | --- |
| Source names and generation progress | Done | `65b4094`. Real display names, YouTube titles, named steps, section counts, elapsed time and retry messages |
| Source ingestion and passages | Done | `528626b`. Add sources without generation. Store ready/failed state and bounded passages |
| Source-based generation | Done | `0cb7eeb`, `7293484`. Allocate a deck total by passage count. Keep held-back material and remove failed new empty decks |
| Notebook workspace | Done | `38eb641`, `9275d40`. Sources, centre and Studio. Drawers below 1,024 pixels and desktop collapse |
| Notebook navigation and due review | Done | `b6ae34e`. Embedded practice/edit views, `/review`, home Review due and Progress |
| Provider and task settings | Done | `69dda7b`, `a17cf91`. Anthropic, OpenAI, Gemini and OpenRouter. Separate generation and chat choices, catalog prices and credit |
| Secure key storage | Done | `69dda7b`, `f6e9602`. Operating system (OS) credential store, environment fallback, read-only legacy database fallback and storage-source status |
| Model ledger | Done | `69dda7b`. Every application model call records tokens, latency, outcome and cost metadata |
| Grounded chat | Done | `081d464`, `0d83c91`. Selected-source retrieval, refusal without a model call when evidence is weak, checked citations and removed-source notices |
| OpenRouter deadlines | Done | `27f9d26`. Fast-provider routing. 180-second generation/canvas and 90-second chat attempt deadlines, retried once on deadline |
| Manual evaluation | Done | `dd849a9`, `1f62847`, `4e1dd9c`. Freeze, generate, check, judge, report and agreement |
| Safe evaluation recovery | Done | `08ce4ce`, `f4b450e`. Writer-only reservation recovery under a run lock. Pilot judge cap $2.50 |
| Earlier integrity and safety fixes | Done | `e438968`, `715a177`, `2611211`. Generation/deletion preservation, key error redaction, cross-site write checks, imports and export handling |
| Desktop and test repairs | Done | `c849f23`, `f5ae38f`, `36a8abd`, `b2c5040`. Launcher, tests, desktop request routing and encrypted desktop settings |

The database migration head is `f2a8c4e6b1d9`. Backups are gitignored but retain whatever the database held, including legacy credentials. Keep backups private.

## Open decisions and validation

| Item | Verdict | Next action |
| --- | --- | --- |
| Source pre-flight gate | Removed 2026-10-02 | The user decides what to study |
| Static Firebase Hosting demo | Recommended | Define a static demo that exposes neither local secrets nor a shared paid backend. Content chosen 2026-10-02: the learning pyramid |
| Live public hosting | Deferred | Require authentication, tenancy, durable jobs and spend caps |
| Evaluation pilot results | Recommended | Complete generation, checks, blind judging, human review, agreement and aggregate report |
| Gemini overload fallback | Deferred | Use pilot evidence to decide whether a fallback is needed and which model to select |
| Duplicate and retrieval thresholds | Recommended | Validate on labelled data. Existing thresholds are not measured accuracy claims |
| Pending request field | Resolved | Only the canvas uses it for routing_log_id |
| Shared inference service | Skip | Keep the current app local and use the user's provider account |

## Cost and validation limits

Application programming interface (API) inference is usage billed. Check free allowances first.

| Component | Monthly fixed service cost | Usage |
| --- | ---: | --- |
| Local frontend, backend, SQLite and OS credential store | $0 | Existing device and electricity |
| Imported multiple-choice practice | $0 | No model calls |
| Generation, chat and optional TypeSafe | $0 app subscription | Account and model dependent |
| Evaluation harness | $0 | Pilot generation/check cap $3.00 and judge cap $2.50 |
| Static demo or live hosting | $0 provisioned by this work | No service selected or deployed |

Earlier live samples on 2026-09-30 returned 6 of 12 and 1 of 4 requested questions during Gemini overload. Those samples are historical observations, not the pilot result. They do not validate model ranking or quality thresholds.

The harness is manual only and never runs in continuous integration (CI). This documentation update makes no paid calls. It does not audit repository history for secrets. See [the harness guide](../backend/evals/README.md) for budget and recovery limits.
