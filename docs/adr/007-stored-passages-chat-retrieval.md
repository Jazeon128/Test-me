# ADR-007: Stored passages and grounded chat retrieval

This architecture decision record (ADR) captures an implemented decision.

## Status

Accepted

## Date

2026-09-30

## Context

Notebook chat needs bounded evidence from selected sources. Re-parsing whole files for each question repeats work and obscures citation provenance.

## Decision

Store parsed source passages in `document_passages`. Split at up to 1,500 characters with 200-character overlap. Retrieve selected ready-source passages with Best Matching 25 (BM25). Refuse below score 1.0 without a model call. Jev reranks the top 25 candidates when available. Send up to 6 passages to the chat model.

Treat passage text as data. Validate numbered citations and keep source, locator and excerpt metadata. Mark deleted citations as Removed source.

Sending whole documents or adding a vector database were alternatives. Stored passages and local lexical retrieval keep the current local architecture simple. Jev failure retains BM25 order.

## Consequences

### Positive Consequences

Repeated chat reuses parsed evidence. Weak retrieval avoids an answer-model call. Citations have stable provenance.

### Negative Consequences

Lexical retrieval can miss paraphrases. Thresholds require labelled evaluation. Citation validation does not prove claim correctness.

### Neutral Consequences

Passages require local storage and cascade with source deletion. Model and optional reranking calls still send source text externally.

## Implementation Notes

Implemented by `528626b` and `081d464`. Local passage storage and BM25 monthly fixed service cost is $0. External chat and Jev costs depend on account usage. Evaluate free allowances before paid calls. No new search service is provisioned.

## References

- [Developer guide](../DEVELOPER_GUIDE.md#grounded-chat-retrieval)
- [Evaluation harness](../../backend/evals/README.md)
