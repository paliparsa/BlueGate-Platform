# BlueGate Phase 5 — Monitoring + Automation

Phase 5 turns the managed-service lifecycle into an automated operations loop.

## Automated service monitoring

`public/cron_monitoring.php` runs the service monitor and provider monitor. The installer schedules it every 5 minutes. Service monitoring processes the least-recently-synced managed services in bounded batches, records usage snapshots, updates aggregate status, evaluates traffic and expiry alerts, and automatically suspends expired provider clients when enabled.

Default traffic thresholds are `80,90,100`. Only the highest newly crossed threshold is sent in a run. Alerts are stateful and deduplicated through `service_alert_states`; changing/resetting a quota creates a new alert cycle rather than permanently suppressing future warnings.

Default expiry warnings are `3,1,0` days. Expiration is separately recorded and can trigger provider-side suspension. All customer alerts are inserted into Mini App notifications; Telegram delivery can be enabled/disabled independently.

## Provider monitoring

Active live providers are health-checked automatically. BlueGate classifies them as online, degraded (latency above the configured threshold), or offline. `provider_incidents` tracks open incidents, occurrence counts, recovery time, and details. Admins receive Telegram notifications on a new incident and on recovery, not on every poll.

Placeholder drivers scheduled for later phases are intentionally skipped by the health monitor.

## Admin controls

Infrastructure now includes Monitoring Settings, Run Monitoring, incident counters, open incidents, and recent monitoring runs. Settings include:

- Service usage sync on/off
- Provider health checks on/off
- Automatic suspension of expired services
- Telegram user alerts on/off
- Traffic thresholds
- Expiry warning days
- Degraded latency threshold
- Service batch size

## Cron and health checks

Installer cron:

- Every minute: payment checks
- Every minute: provisioning queue
- Every 5 minutes: monitoring + automation
- Every 10 minutes: rate refresh

`bluegate health` now verifies provisioning and monitoring cron success markers in addition to the existing cron checks.

## New persistence

- `monitoring_settings`
- `service_alert_states`
- `provider_incidents`
- `monitoring_runs`

Phase 6 remains responsible for routing, capacity-aware selection and failover. Phase 5 observes provider health but does not reroute new provisioning jobs automatically.
