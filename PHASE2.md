# BlueGate Phase 2 — 3x-ui Integration

Phase 2 adds a live 3x-ui connector on top of the Phase 1 Service Engine. BlueGate Platform remains a separate project.

## Implemented

- Live `BlueGateXuiProvider` driver.
- Bearer API Token authentication for modern 3x-ui deployments.
- Legacy username/password session authentication.
- TLS certificate verification enabled by default.
- Real provider health test based on inbound discovery.
- Inbound discovery with protocol, port, enabled state, traffic counters and client count.
- Client lookup / traffic lookup.
- Client create for token and legacy APIs.
- Client update for token and legacy APIs.
- Enable/suspend support through client update.
- Client delete for token API; legacy delete uses the configured default inbound ID.
- Traffic usage / remaining quota / expiry normalization.
- Modern client-links lookup using `/panel/api/clients/links/{email}`.
- Subscription URL generation using configurable `subscription_base_url` and `subscription_path`.
- QR-ready subscription data and Admin QR preview.
- Admin Infrastructure UI for Test, Inbounds and Client Tools.
- Admin API endpoints for 3x-ui CRUD and diagnostics.
- Admin audit logging for create/update/delete operations.

## 3x-ui provider configuration

Recommended mode:

```text
Authentication: Bearer API Token
Base URL: https://panel.example.com
API Token: <token>
Verify TLS: enabled
```

Legacy mode:

```text
Authentication: Legacy Username / Password
Base URL: https://panel.example.com
Username: <panel username>
Password: <panel password>
Default inbound ID: <required for legacy delete>
```

Optional subscription settings:

```text
Subscription base URL: https://sub.example.com
Subscription path: /sub/{subId}
```

Supported placeholders: `{subId}` and `{email}`.

## Phase boundary

Phase 2 intentionally does **not** automatically create a VPN service after a paid BlueGate order. Mapping Catalog plans to providers, queue execution and automatic order delivery belong to Phase 3.

## Roadmap

1. Service Engine Foundation ✅
2. 3x-ui Integration ✅
3. Auto Provisioning & Auto Delivery
4. My Services + Renewal
5. Monitoring + Automation
6. Multi-Panel Routing & Failover
7. Multi-location Subscription
8. Marzban + Remnawave
9. Migration + Bulk Tools
10. Advanced Features
