# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for the Test Me learning platform.

## What is an ADR?

An Architecture Decision Record (ADR) is a document that captures an important architectural decision made along with its context and consequences.

## ADR Format

Each ADR follows a consistent format:
- **Title**: Short noun phrase describing the decision
- **Status**: Proposed, Accepted, Deprecated, or Superseded
- **Context**: The issue motivating this decision
- **Decision**: The change being proposed or made
- **Consequences**: The resulting context after applying the decision

## ADR Index

| ADR | Title | Status |
|-----|-------|--------|
| [ADR-001](001-spaced-repetition-algorithm.md) | Use SuperMemo 2 (SM-2) for Spaced Repetition | Accepted |
| [ADR-002](002-property-based-testing-strategy.md) | Adopt Property-Based Testing with Hypothesis | Accepted |
| [ADR-003](003-technology-stack-selection.md) | Technology Stack: FastAPI, React, and SQLite | Accepted |
| [ADR-004](004-database-choice-sqlite-vs-postgresql.md) | SQLite for Development, PostgreSQL for Production | Accepted |
| [ADR-005](005-naming-standardization-deck-vs-test.md) | Standardize on "Deck" Terminology | Accepted |
| [ADR-006](006-notebook-workspaces.md) | Notebooks as workspaces | Accepted |
| [ADR-007](007-stored-passages-chat-retrieval.md) | Stored passages and grounded chat retrieval | Accepted |
| [ADR-008](008-os-credential-store.md) | Provider keys in the operating system credential store | Accepted |

## Creating New ADRs

1. Copy the template from `template.md`
2. Number it sequentially (e.g., `006-your-decision.md`)
3. Fill in all sections
4. Update this README with the new ADR
5. Submit for review

## ADR Lifecycle

- **Proposed**: The ADR is under discussion
- **Accepted**: The decision has been made and is being implemented
- **Deprecated**: The decision is no longer relevant but kept for historical context
- **Superseded**: Replaced by a newer ADR (link to the replacement)
