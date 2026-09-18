# BlueGate Phase 1 — Service Engine Foundation

BlueGate is a new project and is independent from BlueGate Platform.

## Implemented in Phase 1

- Provider abstraction through `BlueGateServiceProviderInterface` and `BlueGateProviderRegistry`.
- Provider records with driver, priority, weight, capacity and health metadata.
- Encrypted provider password/token storage using libsodium SecretBox when available, AES-256-GCM fallback otherwise.
- Dedicated `SERVICE_ENCRYPTION_KEY`, generated automatically by the BlueGate CLI installer.
- Managed service model: `user_services` and `service_instances`.
- Plan-to-provider mapping foundation.
- Idempotent `provisioning_jobs` queue (`idempotency_key` is unique).
- Service event history and provider health logs.
- Admin Infrastructure view: provider inventory, create/edit, enable/disable and connection-test action.
- Initial registered drivers: 3x-ui (Phase 2), Marzban (Phase 8), Remnawave (Phase 8), Manual.
- BlueGate-specific installation paths, CLI command, database defaults, cookies and browser storage namespaces.

## Intentionally not implemented yet

Live 3x-ui API calls, inbound discovery, client creation and subscription handling belong to Phase 2. The Phase 1 test action validates the provider architecture and records a `not_implemented` health result for future drivers instead of pretending connectivity exists.

## Phase roadmap

1. Service Engine Foundation ✅
2. 3x-ui Integration
3. Auto Provisioning & Auto Delivery
4. My Services + Renewal
5. Monitoring + Automation
6. Multi-Panel Routing & Failover
7. Multi-location Subscription
8. Marzban + Remnawave
9. Migration + Bulk Tools
10. Advanced Features
