# Roadmap

Reviewed against commits through `f4b450e` on 2026-09-30. Done means implemented in the repository. It does not mean deployed publicly or validated by the pending evaluation pilot.

## Shipped

| Work | Verdict | Evidence |
| --- | --- | --- |
| Activity record, daily streak and persisted points | Done | `f83356f` fixes due order, statistics and heat-map weekdays. `backend/app/models/activity.py` stores study days and awards |
| Source passages for question support | Done | `7fcc6e2` stores question passages and uses them for hints and explanation checks |
| Held-back question review | Done | `7002c1b` retains flagged candidates and reasons |
| Written practice and explanation checks | Done | `da5153f` grades imported flashcards against their back text. Written and Explain it modes use optional TypeSafe |
| Safe generation and deletion | Done | `e438968`, `0fc5245` preserve shared material and report failures |
| Generation steps and source names | Done | `65b4094` adds named steps, retry visibility and real source names |
| Independent source ingestion | Done | `528626b` adds source parsing and stored passages without generation |
| Generation from selected sources | Done | `0cb7eeb` adds allocation and workspace aggregation. `7293484` removes failed empty decks and stops on daily quota |
| Notebook workspace | Done | `38eb641`, `9275d40` add the three-column workspace, drawers and accessibility |
| Current notebook navigation | Done | `b6ae34e` retires standalone pages, adds home Review due and Progress, and keeps compatibility redirects |
| OpenRouter and call ledger | Done | `69dda7b` adds provider, catalog, usage ledger and secure keys |
| Per-task model selection | Done | `a17cf91` separates generation and chat settings |
| Secure key status | Done | `f6e9602` shows TypeSafe storage source |
| Grounded notebook chat | Done | `081d464`, `0d83c91` add local retrieval, checked citations and chat interface |
| OpenRouter routing and deadlines | Done | `27f9d26` sorts providers by throughput and bounds generation/canvas at 180 seconds and chat at 90 seconds per attempt |
| Manual evaluation harness | Done | `dd849a9`, `1f62847`, `4e1dd9c` add freeze, generation, checking, judging and reporting |
| Evaluation recovery and judge pricing | Done | `08ce4ce`, `f4b450e` restrict reservation recovery to the writer and save offline judge prices |

## Open work

| Work | Verdict | Next action |
| --- | --- | --- |
| Pre-flight accepts tooling documents as teachable | Recommended | Use labelled teaching and tooling sources to measure false positives before changing prompts or thresholds |
| Static Firebase Hosting demo | Recommended | Prepare a static demonstration. Define its scope without exposing local keys or a paid public backend |
| Live public hosting | Deferred | Add authentication, tenancy, durable jobs and spend caps before deployment |
| Evaluation pilot results | Recommended | Finish the manual pilot, blind human review and agreement analysis. Publish aggregate conclusions without private corpus or run artifacts |
| Duplicate and retrieval thresholds | Recommended | Validate against labelled representative questions and source queries |
| Extra learning mechanics and canvas templates | Deferred | Reassess after quality measurements. Do not treat future ideas as shipped behaviour |
| Shared inference infrastructure | Skip | No new shared service is needed for the local app |

## Costs

Application programming interface (API) calls are usage billed. Evaluate free allowances and known zero-price models first.

| Component | Monthly fixed service cost | Usage or decision |
| --- | ---: | --- |
| Existing local frontend, backend, database and credential store | $0 | Existing device and electricity |
| Imported multiple-choice study | $0 | $0 model calls |
| Provider inference | $0 app subscription | Account and model dependent |
| Manual evaluation | $0 local service fees | Pilot generation/check cap $3.00, judge cap $2.50. Screening accounts separately |
| Static Firebase Hosting demo | $0 provisioned by this work | No hosting plan selected. Evaluate the free tier before provisioning |
| Live public hosting | $0 provisioned by this work | Deferred. No paid architecture selected |

The harness exists. Pilot results remain pending. Neither successful implementation tests nor a small earlier live sample establishes question quality across study sets.
