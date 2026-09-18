# BlueGate Phase 8 — Marzban + Remnawave (Official APIs)

## Scope

Phase 8 adds production provider drivers for Marzban and Remnawave without scraping either panel UI or depending on undocumented browser endpoints.

## Marzban

Official REST API integration:

- Authentication: `POST /api/admin/token` using the official admin OAuth password flow, or an already-issued bearer token stored encrypted by BlueGate.
- Health: `GET /api/system`.
- User create/read/update/delete: `POST /api/user`, `GET /api/user/{username}`, `PUT /api/user/{username}`, `DELETE /api/user/{username}`.
- Usage/status/expiry are read from the official user response (`used_traffic`, `data_limit`, `expire`, `status`).
- Subscription uses Marzban's returned `subscription_url`.
- Provisioning mapping supports native Marzban `proxies` and `inbounds` JSON.

Marzban's official project documents its REST API and exposes Swagger/ReDoc when `DOCS=True`.

## Remnawave

Official Backend API integration:

- Authentication: Bearer API Token only.
- Health/auth check: `GET /api/users?size=1&start=0`.
- User create/update/read/delete: official `/api/users` routes.
- Enable/disable: `/api/users/{uuid}/actions/enable` and `/api/users/{uuid}/actions/disable`.
- Discovery: `GET /api/internal-squads`; BlueGate treats Internal Squad UUIDs as provisioning targets.
- Subscription uses `subscriptionUrl` returned by the backend, with the official `/api/sub/{shortUuid}` shape as a fallback when only `shortUuid` is present.
- Traffic/expiry use `usedTrafficBytes`, `trafficLimitBytes`, `expireAt`, and `status`.

## Security

- Provider API tokens/passwords remain encrypted using the Service Engine secret encryption layer.
- TLS verification stays enabled by default.
- Remnawave does not fall back to username/password login; BlueGate requires an API token.
- No panel UI scraping is used.
- Network errors and non-2xx API responses fail closed and remain visible to monitoring/routing.

## Compatibility with earlier phases

- Phase 4 renewal/add-ons update the existing Marzban/Remnawave user.
- Phase 5 monitoring health-checks both live drivers.
- Phase 6 routing/failover can route new provisioning between 3x-ui, Marzban and Remnawave mappings.
- Phase 7 target storage now supports string/UUID targets, required by Remnawave squads.

## Provider mapping examples

### Remnawave

Use an Internal Squad UUID as `remote_target_id`, or provide multiple UUIDs in Target IDs. `active_internal_squads_json` can also be set explicitly as a JSON array.

### Marzban

Example proxies JSON:

```json
{"vless": {}}
```

Example inbounds JSON:

```json
{"vless": ["VLESS TCP REALITY"]}
```

These fields are sent in Marzban's native user model.
