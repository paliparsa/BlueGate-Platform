# BlueGate Phase 6 — Routing + Failover

Phase 6 turns single-provider auto provisioning into a health- and capacity-aware routing layer.

## Routing strategies

- `priority_weighted` (default): only the best priority tier participates in the first weighted selection; remaining eligible routes become ordered fallbacks.
- `priority`: lowest numeric priority first, then lower utilization.
- `weighted`: weighted selection across all eligible mappings.
- `capacity`: lowest provider utilization first.

Mapping `weight` and Provider `weight` are both used for weighted selection. A degraded provider can be kept as a lower-quality fallback or excluded entirely from Routing Settings.

## Eligibility

A route is excluded when its map/provider is disabled, its driver is not live, the provider is offline, its circuit is open, or its configured `max_clients` capacity (including reserve) is exhausted.

## Failover safety

Create jobs in `single` mode are route jobs rather than jobs pinned to the first map. A single worker run can try multiple eligible mappings. Deterministic service usernames preserve idempotency.

For ambiguous network/timeout failures BlueGate performs a reconciliation lookup on the same provider before any fallback. If existence cannot be determined safely, the job is retried later instead of creating on a second provider and risking a duplicate service.

## Circuit breaker

`provider_route_state` tracks consecutive failures. After the configured threshold, the provider circuit opens for the configured interval. Successful provisioning closes/reset the circuit.

## Audit trail

- `routing_decisions` records the candidate set and chosen route.
- `routing_attempts` records every success, failure, ambiguous result and latency.
- Infrastructure shows open circuits, full providers and recent route attempts.

## Scope boundary

Phase 6 reroutes **new provisioning**. It does not automatically migrate already-active clients between providers; bulk/manual migration belongs to Phase 9.
