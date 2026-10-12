# Web Admin Settings Audit — 2026-10-12

## Already converted to visual controls
- Spin-wheel prizes: title, amount, probability weight, and admin notification are separate fields/cards. The API payload remains backward-compatible via `spin_rewards_text`.
- VIP tiers: Bronze, Silver, Gold, Diamond each expose referral threshold and commission multiplier; saved through `admin_save_vip_rates`, not a JSON editor.
- Referral rewards: valid invite reward, referred-purchase reward, minimum referrals for custom code, and referrals-per-spin are numeric controls shared by web and Mini App.
- Crypto wallets: structured wallet cards backed by the wallet API, including asset/network/address/confirmation count/order/active state.

## Remaining line/CSV-style fields found in web settings
- `card_accounts_text`: one line per bank/card account, pipe-separated title, card number, owner, IBAN.
- `crypto_manual_rates_text`: one line per currency, `SYMBOL|RATE`.
- `storefront_stars_presets`: comma-separated list of preset Stars quantities.
- `crypto_rate_provider_priority`: comma-separated provider priority list.
- `crypto_wallets_text`: legacy compatibility fallback only; structured wallet API is already the primary editor.
- `spin_rewards_text`: legacy compatibility storage format only; the web UI is already visual.

## Settings intentionally kept as ordinary fields
- Brand/storefront text, payment instructions, announcement text, maintenance message, notification text, support replies and product descriptions are human-readable content, not machine configuration formats.
- Numeric amounts/rates, booleans, selects, and color pickers are already suitable controls.

## Code/config-only settings (not safe to expose as arbitrary editable code)
- Secrets and infrastructure credentials (Telegram bot token, provider API credentials, database/config secrets, signing keys) belong in protected server configuration or dedicated credential fields. Do not expose raw PHP/JSON/config files in the browser admin.
- Advanced provider mappings, routing rules, monitoring settings, and role capabilities have dedicated structured admin workflows where available; keep those workflows rather than adding raw code/JSON editors.

## Compatibility and safety rules
- Preserve the existing database keys and API payload contracts while changing only the editor presentation.
- Do not migrate or delete legacy values merely because the UI becomes visual.
- Do not expose stored secret values when rendering forms.
- Validate non-negative rates/rewards and required identifiers before saving.
- Keep web and Mini App settings in sync through the existing shared settings APIs.
