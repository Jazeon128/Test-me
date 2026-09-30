# Open work review

Reviewed 2026-09-30 after the overnight run.

| Item | Status | Current state or next action |
| --- | --- | --- |
| Overnight changes | Implemented | Committed through `54786de`. Added cards join their requested deck. Unknown decks return 404 before writes. Every review attempt and job-log append persists. Frontend lint warnings are cleared and model-selector listeners are removed on cleanup. |
| Duplicate threshold | Implemented | Raised from 0.70 to 0.85. Duplicates remain advisory with no automatic deletion. Evaluation on labelled question pairs is still needed. |
| Written practice | Implemented | Written answer grades once per submission. Its 0 to 5 quality updates SuperMemo 2 (SM-2), and its pass result updates accuracy. Unavailable grading records no attempt. Enter the TypeSafe application programming interface (API) key in Settings. |
| Suggested tags | Implemented | The deck-card Tags button supports manual tags and Jev suggestions. Deck details return question tags for filtering. |
| Source pre-flight | Implemented | With a TypeSafe key, upload assesses stored sources before generation. An unteachable source holds the job for confirmation. Generate anyway reuses the file. Cancel removes the files and any deck created by the upload. Unchecked sources never block. |
| Gemini software development kit (SDK) | Implemented | Question generation and completion use `google.genai`, per-client keys, `models.generate_content` and explicit timeouts. Anthropic and OpenAI completion also honour timeouts. |
| Browser onboarding | Implemented | First browser visit offers onboarding. Configure opens Settings. Completion persists locally. Skip keeps imported decks usable without a generation key. |
| Success colours and Upload dark mode | Implemented | Success shades 100, 200, 700, 800 and 900 exist. Upload has input-field and card classes with dark text colours. |
| Heading case and notebook icons | Implemented | Headings use sentence case. Invalid notebook icons return 400. Migration `d4e8b2f6a1c3` clears broken icons, and the notebook list falls back to a book icon. |
| Backend launcher | Implemented | `scripts\dev-backend.cmd` starts in `backend/` with `.venv`. Relative paths resolve against `backend/`. The default bind address is `127.0.0.1:8000`. |
| TypeSafe configuration and usage | Implemented | Settings supports save, test and remove. Shared key lookup replaces duplicate lookups. `jev_calls` records feature labels, input tokens, duration and outcome. Settings shows the last 30 days. Recording is best effort. |
| Jev response handling | Implemented | Missing, malformed, non-finite or incorrectly typed answer units make the call unavailable. Probability scores must be in [0, 1]. Verification matches answer letters regardless of case or padding. |
| Held-back questions | Implemented | Flagged questions retain their reasons. Upload reports them and links to review. Decks offer Restore and Discard. Deck or document deletion removes their held-back questions. |
| Source passages | Implemented | Questions retain up to 2,000 source characters, cut at a sentence end. Hints use the passage. Explain it judges statements against the passage when available. The backfill script defaults to a dry run and counts parse failures. |
| Generation, regeneration and deletion | Implemented | Failed batches record redacted errors. Partial uploads report generated versus requested counts. Failed regeneration preserves the deck. Shared questions survive regeneration. All held-back replacements remain reviewable. Multi-file jobs aggregate counts and name failed files. Source deletion handles canvases and removes files after the database commit. Migration head is `f6b1d8e3a9c5`. |
| Canvas review fixes | Implemented | Candidates use job identifiers. Unknown jobs return 404 and jobs without a pending choice return 409. Reopened canvases retain their source document identifier. |
| Backend deprecation warnings | Implemented | Pydantic 2 configuration, SQLAlchemy declarations and Coordinated Universal Time (UTC) datetime replacements reduce backend test warnings from about 7,400 to 29. |
| Larger real-data evaluation | Recommended | Six questions is a small sample. Repeat on 3 or more documents before trusting the verification thresholds further. |
| Pending request field | Deferred | `generation_status.pending_request` holds both a pre-flight request and a canvas routing log. Split it if a third use appears. |
| Sandbox cleanup | Recommended | An administrator must delete the whole `.test-tmp/` folder. Inside `tmp/`, delete only the `pytest-of-*`, `testme-tests-*` and `tmp*` subfolders created by the Codex sandbox. |
| Local demo questions | Recommended | Review the 7 placeholder Python questions attached to the AIP-C01 document in the local database as demo data. |
| Figma | Deferred | An Editor seat remains an account decision. No seat or billing changes were made. |
| Shared inference infrastructure | Skip | The current local app needs no new infrastructure. Revisit only for a defined hosted product with user isolation and a usage budget. |

## Product and cost recommendation

Recommended: keep imported decks free of artificial intelligence (AI) dependencies. Keep generation on users' own keys for the current local app. Evaluate provider free allowances before paid generation. Defer a shared inference account until there is a defined hosted product, user isolation and a usage budget.

| Component | Monthly cost | Free option |
| --- | --- | --- |
| Existing local frontend, backend and SQLite | $0 additional service fees | Continue running locally. Excludes existing device and electricity costs. |
| Imported-deck study | $0 AI API cost | No generation or grading API required for multiple choice. |
| Generation with user keys | $0 operator subsidy | User charges depend on provider, model, token volume and account-specific free allowance. No fixed monthly estimate is justified without these inputs. |
| Jev direct API | $0.042 per 1 million input tokens, output $0 | No free allowance found in the previously reviewed official documentation. |
| Jev example usage | $0.42 for 10 million input tokens per month | Example, not measured monthly app usage. |

Pricing source: [TypeSafe model pricing](https://docs.typesafe.ai/models), as recorded in the 2026-09-29 review and supplied for this review.

Measured Jev usage from real runs on 2026-09-30:

| Feature label | Calls | Average input tokens |
| --- | --- | --- |
| `verify_question` | 6 | 1,280 |
| `review_explanation` | 1 | 661 |
| `grade_answer` | 1 | 538 |
| `settings_test` | 1 | 313 |

Verifying a 12-question deck uses about 15,400 input tokens and costs about $0.0006. At 100 such decks per month, verification uses about 1,540,000 input tokens and costs $0.06468. This monthly example excludes generation and other Jev features. Calculate Jev cost as total input tokens / 1,000,000 * 0.042. Request count alone does not determine cost.

## Validation limits

The planner's real-data evaluation on 2026-09-30 used Gemini 3.8 Flash and the AIP-C01 exam guide. It produced 6 of 12 requested questions. Gemini returned 503 "high demand" on 2 of 4 sections. These failures are now recorded and reported. All 6 generated questions were correct on a human read. Jev flagged none at the configured thresholds.

With deliberately wrong answer keys, `answer_is_wrong` scored 0.96 to 0.97 and caught 6 of 6. On good questions, `tests_wording` drifted from 0.34 to 0.71. Its threshold is 0.85. `answer_is_wrong`, `not_in_source` and `ambiguous_options` use 0.7. This small evaluation does not establish accuracy across documents or validate duplicate thresholds.

Deterministic written-review tests cover quality 0 through 5, accuracy, SM-2 updates and unavailable grading. Frontend tests cover submission, displayed grade, retryable failure and timeout submission. Earlier browser checks cover onboarding navigation and written-mode reachability. These checks complement the real-data evaluation. They do not replace it. This documentation update makes no new external generation or grading calls and does not audit repository history for secrets.
