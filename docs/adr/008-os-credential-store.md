# ADR-008: Provider keys in the OS credential store

This architecture decision record (ADR) captures an implemented decision.

## Status

Accepted

## Date

2026-09-30

## Context

Plaintext provider keys in the database can enter backups. The public repository must not teach users to expose credentials.

## Decision

Save Settings keys in the operating system (OS) credential store through `keyring`. Windows uses Windows Credential Manager. Resolve keys from that store first, private environment configuration second and legacy database values read only third.

Return configured and storage-source metadata through the application programming interface (API). Never return key characters. If secure storage is unavailable, require private `backend/.env` rather than writing new database secrets.

Retaining database writes was the alternative. It keeps secrets coupled to ordinary study backups and is rejected.

## Consequences

### Positive Consequences

New key writes leave the study database. Settings can report storage source without revealing credentials.

### Negative Consequences

Secure storage depends on the OS environment. A private environment file is still plaintext. Old backups can retain keys.

### Neutral Consequences

Non-secret model settings remain in the database. Removing a stored key can reveal a lower-priority key.

## Implementation Notes

Implemented by `69dda7b` and `f6e9602`. `backend/scripts/move_keys_to_keyring.py` defaults to dry run. `--apply` saves and verifies each key before clearing the legacy value. `backend/backups/` is gitignored but must remain private. Never put real keys in `.env.example` or commit `.env`.

OS credential storage monthly fixed service cost is $0. No paid secret service is added.

## References

- [README key migration](../../README.md#existing-installations)
- [Developer secrets guide](../DEVELOPER_GUIDE.md#secrets-and-backups)
