# BlueGate Phase 7 — Multi-location Subscription

## Native 3x-ui multi-location first
A single BlueGate service instance on one 3x-ui provider can target multiple inbound IDs. The same client identity/subId is provisioned on every selected inbound. If that panel is connected to multiple nodes, the panel-native subscription remains the single customer URL and contains those locations.

## Data model
`service_instance_targets` stores the inbound/node targets attached to one `service_instance`, avoiding duplicate accounting for one client that spans several inbounds.

## Reconciliation
Retry checks the client's real inbound memberships. If a prior request created the client on only some inbounds, BlueGate adds only the missing targets rather than reporting a false success or creating a second client.

## Legacy and token 3x-ui
Token mode submits the inbound ID array to the panel API. Legacy mode adds the same UUID/email/subId to each selected inbound with best-effort rollback if a later inbound fails. Renewal/update actions update all stored inbound targets.

## Multi-provider fallback
When a BlueGate service truly spans more than one provider/panel, BlueGate exposes a stable aggregate subscription at `/service.php?sub=<token>`. It deduplicates config links and can merge provider subscription payloads. For one 3x-ui panel, BlueGate intentionally returns the native panel subscription instead of proxying it.

## Admin
Plan → Provider Mapping includes `Multi Inbound IDs`, e.g. `12,18,21`, plus a `One 3x-ui panel · multi-inbound native sub` mode. The primary inbound remains available for compatibility and display.

## Phase boundary
Phase 7 does not add Marzban/Remnawave drivers; those remain Phase 8. Existing active-service bulk migration remains Phase 9.
