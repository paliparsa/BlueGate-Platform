# BlueGate Phase 10 — Advanced Features

Phase 9 (Migration + Bulk Tools) is intentionally skipped for now.

Implemented:
- Free Trial engine with per-user limit/cooldown, plan mapping, real provider provisioning, expiry and service/event records.
- Support Tickets linked to service/order with user/admin replies and status workflow.
- Usage history API based on service_usage_snapshots for charts.
- Advanced service event history API.
- Dynamic SVG Service Card (`public/service_card.php?token=...`).
- Provider analytics and economics: monthly cost, bandwidth cost, active services/instances and traffic totals.
- Provider maintenance mode metadata and soft-capacity percentage.
- Advanced admin/user APIs and dashboard payload integration.

Security notes:
- Trial follows existing provider abstraction and encrypted provider credentials.
- Ticket ownership is checked for user reads/replies.
- Service usage/event history enforces service ownership for user requests.
