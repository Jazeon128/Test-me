# Open work review

Reviewed 2026-09-29.

| Item | Status | Next action |
| --- | --- | --- |
| Commit existing sessions | Recommended | Review the combined diff and commit coherent groups. Do not treat the secret-pattern scan as a complete public-release review. |
| Duplicate threshold | Implemented | Raised from 0.70 to 0.85. Keep duplicates advisory. No automatic deletion. The threshold still needs evaluation on labelled question pairs. |
| Written practice | Implemented | Select Written answer in practice. The backend grades once per submission and uses its 0 to 5 quality for SM-2 and its pass result for accuracy. Grading failure records no attempt. Configure TYPESAFE_API_KEY on the backend. |
| Suggested tags | Implemented | Tags button on each deck card. Apply or remove existing tags by hand, or ask Jev and accept or dismiss each suggestion. Deck details now return question tags, which also fixed the tag filter. |
| Source pre-flight | Implemented | With a TypeSafe key, upload parses and assesses each stored source before scheduling generation. A source judged unteachable holds the job (awaiting_confirmation). Generate anyway reuses the stored file. Cancel deletes the files and any deck the upload created. An unchecked source never blocks. Migration 9c1e4f2a7b30 adds generation_status.pending_request. |
| Gemini SDK | Recommended | Migrate both question_generator.py and completion.py to google.genai. Use a per-client key, models.generate_content and explicit timeouts. Update the dependency and the unit/property mocks together. Verify question generation and canvas generation. No migration was made in this pass. |
| Browser onboarding | Implemented | First browser visit now offers onboarding. Configure opens the existing web Settings page. Completion persists locally. Skip keeps imported decks usable without a generation key. |
| Success colours | Implemented | Added 100, 200, 700, 800 and 900. |
| Upload dark mode | Implemented | Defined missing input-field and card classes. Added dark text colours on Upload. |
| Heading case | Partial | Upload now uses sentence case. Audit the remaining pages in a separate copy pass. |
| Figma | Deferred | An Editor seat remains an account decision. No seat or billing changes made. |

## Product and cost recommendation

Recommended: keep imported decks free of AI dependencies and keep generation on users' own keys for the current local app. Defer a shared inference account until there is a defined hosted product, user isolation and a usage budget. No new infrastructure is needed for this pass.

| Component | Monthly cost | Free option |
| --- | --- | --- |
| Existing local frontend, backend and SQLite | $0 additional service fees | Continue running locally. Excludes existing device and electricity costs. |
| Imported-deck study | $0 AI API cost | No generation or grading API required for multiple choice. |
| Generation with user keys | $0 operator subsidy | User charges depend on provider, model, token volume and account-specific free allowance. No fixed monthly estimate is justified without these inputs. |
| Jev direct API | $0.042 per 1 million input tokens, output $0 | No free allowance found in the reviewed official documentation. |
| Jev example usage | $0.42 for 10 million input tokens per month | Example, not measured app usage. |

Sources: [TypeSafe model pricing](https://docs.typesafe.ai/models) and [Google SDK migration guide](https://ai.google.dev/gemini-api/docs/migrate), checked 2026-09-29.

Cost per feature is still unmeasured. Capture the input_tokens already exposed by the Jev adapter and attribute them to grade_answer, assess_source, rank_sections and verify_batch. Calculate monthly cost as total input tokens / 1,000,000 * 0.042. Do not infer cost from request count alone. Existing generation already invokes verification when a TypeSafe key exists.

## Validation limits

The written-review API tests replace the external grader with deterministic results. They cover every quality from 0 through 5, accuracy, SM-2 updates and unavailable grading. Frontend tests cover submission, displayed grade, retryable failure and timeout submission. Browser checks cover onboarding navigation and written-mode reachability. No paid external grading or generation calls were made. The secret-pattern scan found no matching key material in changed candidate files, and Git confirms the Figma key filename is ignored. This is not a full repository-history secret audit.
