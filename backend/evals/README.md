# Manual question evaluation

This harness is manual only. It never runs in continuous integration (CI). Generation, Jev checks and judging can make paid application programming interface (API) calls. Report and agreement are offline.

Run from `backend/` with the existing virtual environment. Copy `evals/pilot.local.example.json` to `evals/pilot.local.json` and replace placeholders with private source folders. The local file is gitignored. Public `pilot.json` contains set names, model identifiers and evaluation settings. Loading the pilot fails clearly if its local file is missing.

Keys use the application's resolver: operating system (OS) credential store, environment configuration including private `backend/.env`, then read-only legacy database values. Never put keys or personal paths in public configuration. Corpus and run artifacts are gitignored and may contain private source text.

## Commands

Freeze reads local files with 0 API calls.

```powershell
.venv/Scripts/python -m evals.run freeze --config evals/pilot.json
```

Then inspect generation before making calls:

```powershell
.venv/Scripts/python -m evals.run generate --config evals/pilot.json --run pilot1 --dry-run
.venv/Scripts/python -m evals.run generate --config evals/pilot.json --run pilot1
.venv/Scripts/python -m evals.run check --run pilot1
.venv/Scripts/python -m evals.run judge --config evals/pilot.json --run pilot1 --dry-run
.venv/Scripts/python -m evals.run judge --config evals/pilot.json --run pilot1
.venv/Scripts/python -m evals.run report --run pilot1
.venv/Scripts/python -m evals.run agreement --run pilot1
```

Fill the exported human review sheet before using agreement to assess human labels.

| Command | Network and output |
| --- | --- |
| `freeze` | 0 API calls. Reads files without copying them and saves deterministic manifests |
| `generate --dry-run` | 0 network calls. Estimates calls and cost from saved catalog prices |
| `generate` | OpenRouter calls. Saves raw responses, passages, parser results, errors, usage and timing |
| `check` | Deterministic rules plus paid Jev checks when available |
| `judge --dry-run` | No calls. Shows seeded sample and worst-case judge estimate |
| `judge` | Two independent judges, with separate solve and rubric calls |
| `report` | Offline, self-contained HyperText Markup Language (HTML) report |
| `agreement` | Offline human/judge agreement and Cohen's kappa |

## Freeze

Freeze samples with the configured seed and extension stratification. Practice-test CSV rows remain reference items. Reference-only files retain their references once per file independently of sampling. Existing manifests remain readable.

## Pilot configuration and prices

| Setting | Saved pilot value |
| --- | --- |
| Seed | 20260930 |
| Study sets | 5 |
| Sources per set | 8 |
| Passages per source | 1 |
| Questions per call | 3 |
| Prompt variants | `production`, `exam_scenario`, `code_tracing` |
| Models | `google/gemini-3.8-flash`, `deepseek/deepseek-v4.1-flash`, `qwen/qwen3.8-flash`, `openai/gpt-6-luna` |
| Generation/check cap | $3.00 |
| Judge cap | $2.50 |
| Judge sample per cell | 20 |

Dry-run uses `catalog_prices`, mapping model identifiers to `prompt_per_million` and `completion_per_million` decimal strings. Missing prices make cost unknown and calls are refused. The pilot saves a 2026-09-30 catalog snapshot including judge prices. It is a saved estimate, not a current price guarantee. Live generation uses the application catalog.

Known zero-price catalog models are supported. Evaluate those and account free allowances before paid calls. The pilot keeps its 4 configured generation models without substitution or fallback.

| Component | Monthly fixed service cost | Usage accounting |
| --- | ---: | --- |
| Local harness | $0 | $0 local service fees |
| OpenRouter generation and checks | $0 app subscription | Catalog prices, shared $3.00 pilot run cap |
| OpenRouter judges | $0 app subscription | Separate $2.50 pilot judge cap. Generic default is $2.00 if not configured |
| Jev | $0 app subscription | Harness estimate $0.042 per 1,000,000 input tokens, output $0 |

OpenRouter generation and judging request `provider.sort=throughput`. Harness client timeout is 120 seconds. This is a client timeout, not the application's total-deadline wrapper. A trickling response can outlast a read timeout.

## Budgets and resume

The ledger reserves cost before every attempt. Failed or interrupted calls retain uncertain billing. Successful reported cost replaces the reservation. Never delete reservations to resume a run.

Only the active writer for generate, check or judge recovers open reservations under a per-run lock. Recovery counts abandoned reservations as spent and frees their identifiers for retry. Readers do not recover reservations. A stale lock from a dead process can be replaced. Retries can stop at the cap because uncertain previous calls still count.

Character estimates use ceiling(characters / 3.5), with generation output limit 4,096 tokens. This is an estimate, not an exact tokenizer bound. The cap cannot undo upstream charges above the reserved estimate.

Generation cells resume by model, passage and full prompt hash. Use a new run name when generation configuration changes. Judge settings can be added to an existing generation run without changing generation cells. Judge configuration is snapshotted separately.

## Checks and metrics

Harness checks pin Jev to `jev-1.13.0`. Unavailable checks remain unchecked, never passed. Generated question count is the denominator for check rates. Budget stops leave remaining checks unchecked. Parse failures count as failed calls. Costs include generation attempts and Jev checks. Zero-denominator cost metrics are blank. Latency percentiles use linear interpolation.

The report ranks cells by good rate with Wilson intervals, compares paired models using passage-level bootstrap intervals and shows best cells per study set. It includes cost per 10 accepted questions, latency and failure examples. Unjudged rates remain unchecked. Run facts use saved generation date or configuration file modification time. If generation commit is absent, the report labels the current report HEAD.

## Blind judging and human review

The primary judge is `anthropic/claude-sonnet-5.5`. The second is `mistralai/mistral-large-2512`. Neither judge family generates pilot questions. Judge temperature is 0.

Each item and judge gets 2 separate calls. Solve sees the passage, stem and shuffled options without the answer key or explanation. Rubric sees the key and explanation but never the solve answer. It checks key correctness, a single best answer, plausible distractors, grounding, understanding, stem clarity and explanation correctness.

Completed calls persist in `judge_calls.jsonl`. Resume skips completed solve calls. Results persist in `judges.jsonl`. Each call records its prompt hash, option mapping and its own reservation and settlement.

Judging exports `human_review.csv` and a separate `human_review_key.csv`. Existing sheets are preserved. Keep the model key hidden while reviewing. Fill `key_correct`, `good` and `excellent` with yes or no. The export targets 60 items with at least 10 disagreements or rejections. If too few exist, it uses available items and prints the shortage.

Agreement reports percent agreement and Cohen's kappa per judge. Undefined kappa is `None`. Pilot results are pending. Do not infer model quality from harness implementation tests.
