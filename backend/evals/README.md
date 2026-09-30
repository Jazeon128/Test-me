# Question evaluation, part 1

Run from `backend/` using the existing virtual environment.

Copy `evals/pilot.local.example.json` to `evals/pilot.local.json` and replace the
placeholder paths with your source folders. The public `pilot.json` names the
local file and contains only set names and evaluation settings. The local file
is gitignored. Loading the pilot fails clearly if the local file is missing.

```
.venv/Scripts/python -m evals.run freeze --config evals/pilot.json
.venv/Scripts/python -m evals.run freeze --config evals/pilot.json --no-screen
.venv/Scripts/python -m evals.run generate --config evals/pilot.json --run pilot1 --dry-run
.venv/Scripts/python -m evals.run generate --config evals/pilot.json --run pilot1
.venv/Scripts/python -m evals.run check --run pilot1
```

Screened freeze and the last 2 commands make paid calls. `--no-screen` freeze
and generation dry-run make no API calls. Freeze reads source files without copying
them. Manifests and run artifacts are ignored by Git. Every call keeps its raw
response, generation passage, production-parser results, errors, usage and timing.
Cells resume by model, passage and full prompt hash. Use a new run name when
changing configuration. Practice-test CSV rows remain reference items.

Default freeze requires the TypeSafe key from the application's secret resolver.
It selects at most `screen_limit` representative groups per set with the seed
and extension stratification. The default limit is 40. It scores the first 12000
characters of parsed section text with the application's `assess_source`, pinned
to `jev-1.13.0`. Only checked, worth-generating groups enter the final sample.
Every screened group, including rejected and unchecked groups, is recorded in
the manifest's `screened` list. `--no-screen` preserves the original sampling.

Scores are cached by source SHA-256 in `evals/corpus/screen_cache.json`, including
unchecked results. Repeated freezes reuse scores without paid calls. Screening
uses `screen` phase entries in each set's `screen_ledger.jsonl`. The configured
budget cap covers all screening ledgers together, separately from generation
run ledgers. Reservations estimate input characters / 3.5 plus 1024 tokens for
assessment instructions. Reported Jev input tokens replace that estimate.
Rejected groups still consume screening cost. Budget refusals remain unchecked.

Dry-run makes 0 network calls. Supply `catalog_prices` in a config as an object
mapping model IDs to `prompt_per_million` and `completion_per_million` decimal
strings from the public OpenRouter catalog. Without saved prices, the total is
unknown and calls are refused. The pilot includes a public catalog price snapshot
retrieved on 2026-09-30. Live generation always uses the application catalog.

The ledger persists reservations before every attempt. Failed requests and
interrupted requests retain their reservation because billing is uncertain.
Never delete reservations to resume a run. Reported cost replaces the successful
attempt's reservation. An unresolved reservation stops that cell on resume.
Character token estimates use ceiling(characters / 3.5), output limit 4096.
This is the specified estimate, rather than an exact tokenizer bound. Upstream
charges exceeding the reserved estimate cannot be undone.

Jev uses `jev-1.13.0` only within each harness check. Unavailable checks remain
unchecked. Rates use generated question count as denominator. Unchecked includes
questions not yet checked after a budget stop. Parse failures count failed calls.
Costs include generation attempts and Jev checks. Zero-denominator cost metrics
are blank. Latency percentiles use linear interpolation on call latency seconds.

| Component | Monthly fixed cost | Usage cost |
|---|---:|---|
| Local harness | $0 | $0 |
| OpenRouter | $0 | Catalog model prices, shared $3.00 run cap |
| Jev | $0 | $0.042 per 1000000 input tokens, free output |

Free catalog models with known zero prices are supported. The pilot evaluates
the 4 requested models and does not substitute free models or fallback models.

## Blind judging and owner review

Run `python -m evals.run judge --config evals/pilot.json --run NAME --dry-run`
to inspect the seeded sample and worst-case price without calls. Missing catalog
prices print unknown and refuse calls. Supply saved judge catalog prices in config.
The primary judge is anthropic/claude-sonnet-5.5. The second judge is
mistralai/mistral-large-2512. The independent judge budget defaults to $2.00.
Judging resumes from judges.jsonl. Each call records prompt hashes and option mapping.
Each item and judge uses two separate calls. The solve call omits explanation and
key. The subsequent rubric call includes them and never receives the solve answer.
Completed calls persist in judge_calls.jsonl. Resume skips a completed solve call.
Each call records its own prompt hash and reserves and settles its own budget amount.
Dry run counts both calls.

Judging creates human_review.csv and a separate human_review_key.csv. Existing
sheets are preserved. Fill key_correct, good and excellent with yes or no.
When fewer than 60 items or fewer than 10 disagreements or rejections exist,
the export uses available items and prints the shortage.
Run `python -m evals.run agreement --run NAME` for percent agreement and kappa.
Run `python -m evals.run report --run NAME` for an offline, self-contained report.
Undefined kappa is reported as None. Unjudged rates are unchecked.
Run facts use the saved generation date when present, otherwise config file mtime.
If the generation commit was not saved, the report labels the current report HEAD.
Judge configuration is snapshotted separately to support existing generation runs.
