# BlueGate Platform v5.0.1 — BlueGate Pro Modules Integration

This package is based on BlueGate Platform v5.0.0 with the following additions from BlueGate Platform Pro v2.1.6:

## Added Components
- Full modular Pro system: `modules/pro-core/` and `modules/pro-web/`
- License runtime: `app/license.php` + `cli/lib/license.sh`
- Module loader with integrity verification: `app/module_loader.php`
- Capabilities metadata: `manifest/capabilities.json` and `installer-schema.json`
- Mini App improvements: updated `public/miniapp/app.js`, `final-polish.css/js`, `bluegate-theme.css`, `admin-web-parity.css`
- Public entry points: `public/web_gate.php`, updated `public/index.php`
- CLI support for `bluegate license ...` commands

## Integration Notes
- `app/bootstrap.php` now loads `license.php` and `module_loader.php`
- Existing BlueGate features (`advanced_features.php` with `bluegate_*` functions) remain intact and continue to work
- Pro modules load only when a valid signed Pro entitlement is present (fail-closed otherwise)
- License paths are currently BlueGate-oriented (`/etc/bluegate/license`). Adjust `LICENSE_STATE_DIR` in config if needed for BlueGate deployments
- No breaking changes to core Free/BlueGate functionality

## Version
5.0.1-pro-modules

## Visual & Functional Additions (v5.0.2)

- Mini App now uses BlueGate's resilient Telegram bridge (`waitForTelegramBridge`)
- Full Pro feature locking UI: `proBadge()`, `showProUpgrade()`, `BLUEGATE_PRO_FEATURES`
- Admin panel tiles with Free/Pro distinction and upgrade prompts
- Pro CSS styles (badges, upsell sheets, locked tiles) from `component-parity.css`
- All polish layers (final-polish, bluegate-theme, admin-web-parity) loaded

These are user-visible improvements in the Telegram Mini App.
