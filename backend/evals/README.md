# Question evaluation, part 1

Run from `backend/` using the existing virtual environment.

```
.venv/Scripts/python -m evals.run freeze --config evals/pilot.json
.venv/Scripts/python -m evals.run generate --config evals/pilot.json --run pilot1 --dry-run
.venv/Scripts/python -m evals.run generate --config evals/pilot.json --run pilot1
.venv/Scripts/python -m evals.run check --run pilot1
```

The last 2 commands make paid calls. Freeze reads source files without copying
them. Manifests and run artifacts are ignored by Git. Every call keeps its raw
response, generation passage, production-parser results, errors, usage and timing.
Cells resume by model, passage and full prompt hash. Use a new run name when
changing configuration. Practice-test CSV rows remain reference items.

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
