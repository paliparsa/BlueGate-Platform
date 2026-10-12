# BlueGate catalog translations

## Behavior
- Persian catalog text remains the source of truth; English fields are stored separately.
- The web admin's **🌐 ترجمه‌ها** editor lets an admin review and edit English translations for categories, products, service groups, services, plans, variants, and descriptions.
- Saving catalog content starts a small background translation batch. Use **ترجمه خودکار موارد ناقص** to backfill more existing records; repeat while the reported remaining count is nonzero.
- Translation output is cached by source text. If a provider is unavailable, the English field stays empty and the Mini App falls back to the Persian source text.
- Manual English edits are never overwritten by automatic translation.

## Translation providers
The translator uses a configured LibreTranslate endpoint first, if present, and otherwise tries MyMemory's public translation endpoint. This means uncached Persian catalog text may be sent to the selected third-party translation service. Do not use this for confidential content.

Optional settings in the server-side `config.php`:
- `$LIBRETRANSLATE_URL = 'https://your-translation-host';`
- `$LIBRETRANSLATE_API_KEY = '...';`

Use a trusted LibreTranslate deployment for predictable availability and privacy. No translation API key is exposed to the Mini App. If cURL or outbound HTTPS is unavailable, translations safely remain blank until the provider is reachable.

## Deployment
The normal application migration adds the English columns and translation cache table to existing installations. Deploy the code and run the project's usual migration/startup process before testing. Confirm database backup and test the admin editor, English storefront, checkout, and Persian fallback.
