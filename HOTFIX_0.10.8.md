# BlueGate 0.10.9

- Admin panel provisioning now returns success only when delivery is actually completed or a valid retry is queued; failed jobs are reset on explicit admin retry.
- Provider monitoring remains scheduled every 5 minutes and now uses 2-sample hysteresis for degraded/offline and recovery states.
- Telegram admin order keyboard is status-aware and adds Build from panel / Service status for VPN orders.
- Receipt notifications from Web/Mini App include the same admin action keyboard.
- Customer VPN orders use the normal order-detail screen before delivery and switch to the VPN service-detail screen only after delivery.
