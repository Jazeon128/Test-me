# ADR-006: Notebooks as workspaces

This architecture decision record (ADR) captures an implemented decision.

## Status

Accepted

## Date

2026-09-30

## Context

Separate source addition, deck management and progress navigation fragmented study tasks. Sources, chat and generated artifacts need a shared topic context.

## Decision

Use `/notebooks/:id` as a three-column workspace. Sources selects material. The centre holds chat or an open deck. Studio generates and lists artifacts. Embed deck practice and editing with `?deck=<id>&view=practice|edit`.

Historical routes for the Upload page, Decks page and Progress page are retired. Compatibility redirects preserve old links. Home owns Review due and Progress. `/review` handles due questions across notebooks.

Keeping separate pages was the alternative. The workspace reduces navigation while preserving deck resources in the backend.

## Consequences

### Positive Consequences

Sources and outputs remain visible together. Closing a deck returns to the same chat and draft.

### Negative Consequences

The workspace requires careful focus handling and responsive panels. Legacy links need redirects.

### Neutral Consequences

Below 1,024 pixels, side panels become drawers. Desktop panels can collapse. Canvas currently uses the first selected source.

## Implementation Notes

Implemented by `38eb641`, `9275d40` and `b6ae34e`. Local frontend, backend and database monthly fixed service cost is $0. Existing provider usage charges remain account dependent. No hosting service is added.

## References

- [User guide](../USER_GUIDE.md)
- [Developer guide](../DEVELOPER_GUIDE.md)
