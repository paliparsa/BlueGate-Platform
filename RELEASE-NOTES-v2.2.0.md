
## Verified-35 build scope

This package intentionally includes only the 35 controls that passed the previous validation pass. The following five unverified controls are intentionally NOT included in this build:

- POST-only enforcement for mutating API actions.
- Telegram secret-token header webhook registration.
- Transaction/row-lock rewrite of the spin endpoint.
- Transaction/row-lock rewrite of the withdrawal creation endpoint.
- Expanded account-deletion anonymization/deactivation behavior.

Other v2.2.0 security and cleanup changes remain included.

# BlueGate Platform v2.2.0 — Security & Integrity Release

This release applies the selected A–C security work plus technical cleanup.

## Security hotfixes
- Removed username-based admin elevation; admin access now requires configured Telegram IDs or explicit admin roles.
- SwapWallet callbacks no longer trust callback status: every callback is re-verified against the SwapWallet API before an order can become paid.
- Login, registration, OTP, resend and password-reset rate limiting added; OTP generation uses `random_int` and stored OTP values are hashed.
- Password-reset responses are non-enumerating.
- User bans are enforced by web auth and Telegram bot auth; active sessions are revoked on ban.
- Telegram webhook uses Telegram's `secret_token` header instead of putting the secret in the webhook URL.

## Money integrity
- Wallet usage, coupon application, referral signup rewards and order-delivery commissions use the verified transactional/locking hardening in this build. Spin and withdrawal endpoint row-lock rewrites are intentionally excluded from this Verified-35 package.
- Withdrawal approve/reject is idempotent; repeat reject cannot double-refund.
- Coupon global/per-user limits are checked while the coupon row is locked.
- Order payment confirmation has an explicit state machine.
- Telegram Stars pre-checkout and successful-payment payloads validate owner, currency, exact amount and unique Telegram charge ID.

## Auth/admin hardening
- Sessions are SHA-256 hashed in DB and expire (default 168 hours); raw DB auth tokens are deprecated.
- First migration invalidates old raw sessions, so users must sign in again once after upgrade.
- Browser auth uses an HttpOnly session cookie; frontend no longer persists auth tokens in localStorage. Cookie-authenticated writes enforce allowed Origin/JSON checks to prevent CSRF.
- Mutating API actions require POST and tokens are no longer accepted from query strings.
- Admin role permissions are enforced server-side and partial-role payloads are filtered. Bot-side admin tools are full-admin-only; scoped roles use Web Admin.
- Resend API keys are never returned in plaintext to the admin UI.

## Technical cleanup
- Direct legacy Product/Category/Variant mutation APIs return HTTP 410; legacy bot-edit routes are disabled; Catalog Studio is the single product-management path.
- Catalog Undo is scoped per admin rather than global.
- `phone`/`phone_number` schema mismatches fixed.
- Account deletion retains the prior account-data clearing behavior with corrected session/phone fields; the expanded anonymization/deactivation change is intentionally excluded from this Verified-35 package.
- Removed production `dev.init.js` loader.
- Admin notification lookup now uses `admin_roles`, removing dead `users.is_admin/users.role` references.
- Broadcasts are queued in DB and processed incrementally by the existing one-minute cron rather than holding a PHP-FPM worker open.
- Sensitive handled API/admin/restore/cron errors returned to clients are sanitized; internal SQL/HTTP details stay in server logs. Backup restore accepts the new HttpOnly cookie session and remains full-admin-only.

## Upgrade safety
- Migration ordering for Telegram Stars columns was corrected so older installations add `stars_amount` before charge-ID fields.
- Legacy raw auth sessions are intentionally invalidated once during the v2.2 migration.

## Upgrade
1. Back up the database.
2. Deploy files.
3. Run `php public/install.php` once (or the normal update/migration step).
4. Telegram webhook registration remains on the prior URL-secret flow in this Verified-35 package; the secret-header registration change is intentionally excluded.
5. Confirm the existing one-minute cron is installed; it now also drains broadcast jobs.
6. Users will need to sign in again once because legacy raw sessions are invalidated.
