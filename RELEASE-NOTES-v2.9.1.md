# BlueGate Platform v2.9.1 — Performance & UX Fix Pack

## Performance
- Website Service Worker now uses stale-while-revalidate for static assets and network-first only for navigations.
- Versioned CSS/JS/images/fonts receive long-lived browser cache headers; HTML remains revalidated.
- Installer Nginx template enables gzip and long-lived static asset caching.
- Website scripts and Mini App scripts use deferred execution; Mini App Google Fonts no longer block first paint.
- Mini App runtime cache key and Website asset versions are bumped to 2.9.1.

## Coupon apply UX
- Website and Mini App purchase flows now include an explicit **ثبت کد** button.
- Coupon validity/discount can be previewed before order creation using authoritative server-side pricing.
- Final coupon application remains server-authoritative on the created order.

## Mini App account fixes
- Support opens the configured Telegram support account reliably.
- Account edit and secure email-change UI use the same visual language as Credit Top-up.
- Email input/OTP flow was polished and duplicate click binding was removed.

## Credit top-up
- Open top-up requests can be canceled by the owner before crediting.
- Users can change payment method: the old request is safely canceled and a fresh request with the same amount is created.
- Row locks/transactions prevent races with admin approval; credited requests cannot be canceled or replaced.

## Compatibility
- No destructive database migration is introduced by this release.
- Existing payment verification remains authoritative; client-side values never directly credit balance.
