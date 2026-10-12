# Web Admin Settings Audit — 2026-10-12

## Visual editors now implemented in both web admin bundles
- Spin-wheel rewards: separate cards for title, amount, probability weight and admin notification.
- VIP tiers: Bronze, Silver, Gold and Diamond each have referral threshold and commission multiplier fields; saved through the existing VIP API.
- Referral rewards: valid-invite reward, referred-purchase reward, minimum referrals for custom code and referrals per spin are numeric controls.
- Card accounts: individual visual rows for title, card number, account holder and IBAN.
- Manual crypto rates: individual visual rows for asset symbol and rate.
- Stars presets: add/remove controls for preset quantities.
- Crypto provider priority: ordered selectors for Wallex, Ramzinex and Nobitex.
- Crypto wallets: structured wallet manager backed by the existing wallet API.

## Compatibility retained
- Existing setting keys and storage formats remain unchanged: card accounts and manual rates serialize to their original line formats; Stars presets and provider priority serialize to their original comma-separated values; wheel rewards serialize to the existing `spin_rewards_text` format.
- VIP tier thresholds and multipliers are sent to the existing `admin_save_vip_rates` endpoint as the shared `vip_tier_rates` object.
- Both `public/web` and `modules/pro-web/public` admin bundles have been updated.
- Both web entrypoints use a new JavaScript cache key so browsers do not keep the previous editor.

## Settings intentionally kept as ordinary fields
- Storefront hero copy, payment instructions, maintenance messages, notification content, support replies and product descriptions remain text areas because they are human-readable content, not machine configuration formats.
- Numeric amounts/rates, booleans, selects and color pickers remain native controls.

## Security and scope
- Secrets and infrastructure credentials are not exposed as editable raw configuration/code in the browser.
- Advanced provider mappings, routing, monitoring and role capabilities retain their dedicated workflows where available.
- Static JavaScript syntax checks passed for both updated admin bundles. Live browser/backend integration tests still need to run in the deployed environment.
