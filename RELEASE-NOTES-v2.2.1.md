# BlueGate Platform v2.2.1 — Web Telegram Login Fix

## Fixed
- Website authentication state no longer depends on the removed JavaScript/localStorage token.
- Telegram Login Widget now verifies the new HttpOnly-cookie session with a fresh `me` request before opening the account dashboard.
- Email OTP / password-reset login flows also refresh the cookie-backed session before navigation.
- Authenticated dashboard responses explicitly return `is_guest: false`, while guest responses remain `is_guest: true`.
- Website startup now restores authentication exclusively from the server-side HttpOnly session cookie.
- Web asset/service-worker cache version bumped to 2.2.1 so browsers do not keep the broken 2.2.0 auth JavaScript.

## Mini App behavior
Telegram Mini App authentication remains intentionally automatic when opened inside Telegram because Telegram supplies signed `initData`; this is independent from website Login Widget authentication.

## Security
The v2.2.0 Verified-35 security model remains intact: no web auth token is restored to localStorage or query strings.
