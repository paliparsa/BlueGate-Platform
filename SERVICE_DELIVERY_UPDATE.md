# BlueGate v0.10.6 — Service Delivery UX

- Initial provisioning finalizes the order and publishes the subscription URL.
- Admin Web + Mini App expose **Build & Send from Panel** and keep manual subscription delivery.
- Customer My Services shows managed and legacy/manual VPN subscriptions, with Open/Copy/QR.
- Client usernames are persisted as `userId_telegramId_random5`.
- Retry-safe: generated client username is stored in `user_services.metadata_json`.
