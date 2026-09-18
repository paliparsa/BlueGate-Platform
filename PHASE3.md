# BlueGate Phase 3 — Auto Provisioning & Auto Delivery

Implemented:
- Plan → Provider/Inbound mapping
- Paid-order provisioning hook
- Idempotent provisioning jobs
- Immediate first attempt + retry queue with exponential backoff
- user_services/service_instances persistence
- Automatic 3x-ui client creation
- Traffic/duration mapping
- Subscription URL delivery + QR-compatible delivery URL
- Provisioning worker endpoint protected by CRON_KEY
- Admin APIs for mapping, queue execution, retry and manual order provisioning
- Safe failure behavior: paid order remains undelivered when provisioning fails

Phase 4 remains My Services + Renewal lifecycle.
