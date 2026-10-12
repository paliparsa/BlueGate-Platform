# BlueGate AI Live Translation

## What this adds

- A shared server-side translation service for English and Persian.
- An OpenAI-compatible Chat Completions provider, with server-side caching.
- A rate-limited API endpoint used by the Mini App and website/admin DOM scanner.
- Automatic translation of newly-rendered Persian UI text and selected accessibility/placeholder attributes.
- Telegram message and visible keyboard-label translation based on a stored language preference. Callback data and URLs are not rewritten.
- Existing catalog translation providers remain a fallback for short, plain UI labels.

## Enable the AI provider

Add these values to the deployed `config.php` (never commit a real key):

```php
$TRANSLATION_AI_API_KEY = 'your-provider-api-key';
$TRANSLATION_AI_BASE_URL = 'https://api.openai.com/v1';
$TRANSLATION_AI_MODEL = 'gpt-4o-mini';
```

An existing `$OPENAI_API_KEY` is also accepted as the key fallback. For an OpenAI-compatible provider, set its API base URL and model explicitly. Keep credentials server-side.

If no AI key is configured, unknown live UI strings remain in the source language rather than triggering a chain of slow provider requests. The existing catalog translation providers continue to handle catalog translations through the catalog's current workflow. Configure the AI key to enable live translation of previously unseen UI strings and full Telegram messages.

## Runtime behavior

- The endpoint accepts at most 20 strings per request, up to 500 characters each, and is rate-limited per client IP.
- Successful translations are cached by source text, target language, and context.
- HTML tags, URLs, Telegram handles, template placeholders, format tokens, and numeric sequences are protected and restored after translation.
- Failed or invalid translations leave the original text in place.
- Telegram language is initially detected from the Telegram profile; a signed-in user's explicit Mini App/web language choice overrides that default for Telegram-linked accounts.
- The browser scanner translates only Persian text while English mode is active. Switch back to Persian to stop live translation and reload the original interface.

## Deployment checklist

1. Configure the server-side AI key in the real `config.php`; do not put it in JavaScript or Git.
2. Deploy the updated PHP and static files together.
3. Ensure the database user can create the two `ai_translation_*` tables on first use, or apply the new table definitions from `schema.sql`.
4. Test both languages on the Mini App, website, admin pages, and Telegram bot.
5. Verify login, wallet, checkout, callback buttons, order IDs, URLs, and payment instructions. Do not treat a green syntax check as a live integration test.
