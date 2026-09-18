# BlueGate v0.10.1 — Full Debug Audit

This patch release is based on v0.10.0 Phase 10. Phase 9 remains intentionally skipped.

## Fixed

- Database migrations no longer silently swallow SQL errors. Installation/update now fails loudly with a compact statement preview when schema application fails.
- Remnawave usage parsing supports the current official response shape where traffic is nested under `userTraffic.usedTrafficBytes`, while retaining backward compatibility with older top-level fields.
- Marzban suspend/resume no longer resets `expire` or `data_limit`. Update payloads are now partial and only modify fields explicitly requested.
- Marzban and Remnawave idempotent create checks now treat only HTTP 404 as "user does not exist". Network/auth/server failures abort instead of falling through to a create request.
- Usage-history SQL now uses a validated integer for the `INTERVAL` expression to avoid driver/version-specific native prepare issues.

## Validation performed

- PHP syntax lint across all PHP files.
- JavaScript syntax check across all JS files.
- Bash syntax check across all shell scripts.
- Static scan of Service Engine, provisioning, monitoring, routing, Phase 10 trial/ticket/analytics paths.
- Official Remnawave API contract rechecked for users, internal squads, actions, and current nested user traffic response.
- Marzban connector behavior reviewed against the official REST API model.

## Limits of this audit

Live end-to-end provider calls require actual 3x-ui, Marzban, and Remnawave instances plus credentials. This package has been hardened for those runtime paths, but no external provider credentials were available in the audit environment.
- Cross-provider service sync now normalizes 3x-ui, Marzban, and Remnawave status/limit/expiry shapes; Marzban/Remnawave services are no longer falsely marked suspended after sync.
- Service-action retry accounting fixed an off-by-one error that could exhaust a 3-attempt job after only 2 real failures.
- Provisioning retry delay SQL now interpolates a bounded integer instead of relying on a parameter marker inside a MySQL INTERVAL expression.
