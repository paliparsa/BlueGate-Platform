# BlueGate Phase 4 — My Services + Renewal

Phase 4 turns provisioned provider clients into first-class managed services.

## Included

- `My Services` API backed by `user_services` / `service_instances`, not inferred from orders.
- Per-service status, traffic limit, traffic usage, remaining traffic, expiry, last sync and provider instances.
- On-demand provider sync with usage snapshots for history.
- Subscription URL and QR action in the Mini App.
- Renewal orders bound to the existing `user_service` and existing provider client.
- Extra traffic purchases priced per GB.
- Extra-time purchases priced per day.
- Per-plan min/max controls for traffic and day add-ons.
- Admin add-on pricing controls in Infrastructure.
- Idempotent service-action jobs (`renew`, `add_traffic`, `add_days`) using the Phase 3 queue.
- Automatic retries/backoff without creating a second provider client.
- An action order is marked delivered only after all related service instances finish successfully.
- Web member center and Mini App expose managed-service actions.

## Database additions

`service_plans`:

- `extra_traffic_price_per_gb`
- `extra_day_price`
- `addon_min_gb`
- `addon_max_gb`
- `addon_min_days`
- `addon_max_days`

`orders`:

- `user_service_id`
- `service_action`
- `service_action_json`

New table:

- `service_usage_snapshots`

## Renewal behavior

A paid renewal no longer calls the normal create-service path when it is associated with a managed service. BlueGate resolves the existing service instances and calls the provider update/renew operation using the existing client identity.

For 3x-ui this updates the same client UUID/email and keeps the subscription identity instead of creating another client.

## Add-ons

Set pricing under **Admin → Infrastructure → Plan → Add-ons**. A price of `0` disables that add-on type.

Traffic uses binary GB (`1 GB = 1,073,741,824 bytes`). Time add-ons extend from the current expiry, or from the current time if the service has already expired.

## QR

The Mini App QR action currently renders the subscription URL through QuickChart's QR endpoint. The subscription URL is therefore sent to that external QR rendering service when the user explicitly taps QR. Subscription copy/open actions remain local and do not require this service.

## Scope boundary

Scheduled monitoring, automatic periodic usage sync, threshold notifications and provider health automation remain Phase 5. Phase 4 provides the service lifecycle and manual/on-demand sync primitives that Phase 5 will schedule.
