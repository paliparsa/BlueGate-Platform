# BlueGate Platform 4.0 Migration Audit

Source baseline checked: BlueGate Platform v3.5.4.
Target: BlueGate Platform v4.0.0 Service Engine Merge.

## Compatibility guarantees

- Existing default application path remains `/var/www/bluegate-platform`.
- Existing env file remains `/etc/bluegate-platform.env`.
- Existing DB defaults remain `bluegate_platform` / `bluegate_user`.
- Existing CLI remains `bluegate` and `cli/bluegate`.
- Existing nginx site, cron file, log and backup paths remain under `bluegate-platform`.
- Existing commerce tables are not replaced.
- New VPN/Service Engine tables are additive.
- Existing users, balances, transactions, catalog, orders, inventory and settings remain in place.

## Schema audit

The v3.5.4 schema and v4.0.0 schema share 30 legacy tables. All new columns introduced on those existing tables are covered by guarded `add_column_if_missing()` migration calls. New Service Engine tables are created with `CREATE TABLE IF NOT EXISTS`.

## First-update cron compatibility

The first `bluegate update` can start under the v3.x CLI process, whose in-memory `configure_cron()` knows only the legacy jobs. `cron_crypto.php` therefore includes a compatibility bridge that runs due provisioning and monitoring when the dedicated v4 heartbeats are missing/stale. After the update, `bluegate repair` installs the dedicated current cron entries.

## Encryption compatibility

BlueGate v3.x did not have `SERVICE_ENCRYPTION_KEY`. On upgraded installs, if that key is absent, the Service Engine derives a stable key from the existing `WEBHOOK_SECRET`. If the configuration wizard is later run, it writes the same deterministic value instead of changing the encryption key.

## Validation performed

- PHP syntax check across all PHP files.
- JavaScript syntax check across all JavaScript files.
- Bash syntax check across installer/CLI scripts.
- CLI `version` and `help` smoke checks.
- Legacy-vs-current schema column audit.
- BlueGate filesystem/env/CLI naming audit.
