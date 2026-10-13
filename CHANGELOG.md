# BlueGate Platform v5.1.4 — language flag image fix

- Replace the hand-drawn Persian lion-and-sun toggle icon with the user-provided Wikimedia image URL in the web and Mini App language switchers.
- Keep the US flag for English.
- Version bump: 5.1.3 → 5.1.4 (PATCH).

# BlueGate Platform v5.1.3 — renewal checkout and duplicate job protection

- Reuse the same active renewal order when a customer taps renew repeatedly; return them to the existing checkout instead of creating a second order.
- Tell Telegram users when a renewal checkout already exists and show that same order invoice; expose reuse state to the web/Mini App API.
- Serialize VPN service actions per order and service instance, and mark concurrent/duplicate jobs as ignored so the same purchase cannot extend service twice.
- Replace language-toggle text with flag-only controls: Iran lion-and-sun style for Persian and the United States flag for English.
- Version bump: 5.1.2 → 5.1.3 (PATCH).

# BlueGate Platform v5.1.2 — x-ui allowedIPs renewal fix

- Normalize the official x-ui Client.allowedIPs field to a JSON string array before sending update requests.
- Accept array values and JSON/comma-separated string representations from existing panel client data.
- Fixes renewal/update failures caused by Go JSON decoding a string into []string.
- Version bump: 5.1.1 → 5.1.2 (PATCH).

# BlueGate Platform v5.1.1 — VPN renewal and payment reliability

- Notify Telegram admins when an order is fully paid using the wallet in the bot.
- Surface VPN service-action queue failures and provider execution errors to admins with job identifiers and diagnostic details.
- Report the start of paid service renewal/add-on operations instead of silently leaving failures in logs.
- Version bump: 5.1.0 → 5.1.1 (PATCH; backward-compatible bug fixes).

# BlueGate Platform v5.1.0 — Dual-currency wallet (IRT + USD)

- Add an independent USD wallet balance without rewriting existing IRT balances.
- Use the existing USDT/Toman provider to snapshot USD top-up quotes and USD wallet checkout conversions.
- Keep USD principal fixed as rates move; only its IRT display equivalent changes.
- Record currency and exchange-rate metadata for wallet transactions, top-ups, and orders; old ledger rows remain IRT.
- Add safe additive migrations and English Mini App wallet/top-up display support.
- USD top-ups use existing payment methods and settle at the quoted Toman equivalent; card-to-card remains unavailable in English mode.

# BlueGate Platform v5.0.55 — Translation reliability and admin refresh fix

- Stop automatically starting the catalog translation batch every time the web admin mounts or refreshes; keep explicit translation actions and catalog-related flows available.
- Respect provider retry-after hints and use bounded backoff for HTTP 429/503 translation errors.
- Retain failed UI translation tasks for up to eight attempts instead of dropping them after three failures.
- Validation: PHP syntax, JavaScript syntax, and SQL translation-column uniqueness checks passed in GitHub Actions.

## Versioning policy

BlueGate Platform uses Semantic Versioning for the core release: `MAJOR.MINOR.PATCH`.
- **MAJOR**: incompatible changes, breaking migrations, or major architectural changes.
- **MINOR**: backward-compatible features and functionality.
- **PATCH**: backward-compatible bug fixes, reliability improvements, and small corrections.
- The core version is recorded in `VERSION`; the Pro modules have their own version and are not automatically bumped with core releases.
- Every release must update `VERSION` and add a new entry at the top of this changelog. Formal release tags use the `v` prefix (for example, `v5.0.55`).

---

# BlueGate Platform v5.0.54 — Shared AI Live Translation

- Add a shared OpenAI-compatible AI translation service with server-side cache and protected placeholders, links, numbers, and markup.
- Add a rate-limited public translation endpoint for unknown UI strings.
- Add browser-side live translation fallback for Mini App, website, and web admin, including a website language toggle.
- Localize Telegram bot messages and visible keyboard labels according to Telegram's detected language while preserving callback payloads.
- Add optional server-side AI provider settings; existing catalog providers remain a fallback.
- Extend CI syntax checks for the new translation components.

# BlueGate Platform v5.0.53 — Automatic translation worker and complete account UI localization

- Add DeepL API and Google Cloud Translation provider support, then fall back to Google Translate web endpoint and MyMemory; all translations remain cached server-side.
- Start a bounded background translation worker automatically when the admin panel opens and after catalog saves; the Translate button resumes the worker instead of doing just one isolated batch.
- Expand English dictionary coverage for account completion, Telegram connection, account details, balance center, top-ups, profile/security, VPN services, referrals, and support.
- Normalize Persian spacing/zero-width characters before dictionary matching and translate relevant input values, placeholders, labels, and titles.
- Add provider configuration examples; existing Persian text remains unchanged and saved manual translations are preserved.

# BlueGate Platform v5.0.52 — Editable automatic English catalog translations

- Add persisted English translation fields for categories, products, variants, services, service groups, and plans, including descriptions.
- Add cached Persian-to-English translation using optional configured LibreTranslate and a MyMemory fallback; translation failures safely fall back to Persian.
- Add a bounded batch translation endpoint and a web-admin translation editor for manual overrides and backfilling existing catalog entries.
- Return saved English fields in API catalog payloads and display them in English Mini App category/product/service/plan views.
- Add additive migrations for existing installations; no existing Persian source text or identifiers are overwritten.

# BlueGate Platform v5.0.51 — Bilingual international Mini App

- Add a persistent Persian/English language toggle with automatic browser/Telegram locale selection and RTL/LTR layout switching.
- Add an offline translation dictionary and dynamic DOM translation for common storefront, account, order, checkout, wallet, support, and authentication UI labels.
- Display product-card and purchase-sheet prices in USD for English storefront users using explicit product USD prices where available, otherwise an approximate conversion from the current USDT/Toman rate (with a documented fallback).
- Hide card-to-card payment choices in the English storefront and reject card payment-method selection and card top-ups server-side when the request is in English mode.
- Preserve Persian mode and existing order amount/checkout calculations; USD display is a presentation conversion, not a new settlement currency.

---

# BlueGate Platform v5.0.50 — Visual admin settings controls

- Convert legacy card-account and manual crypto-rate line editors into structured visual forms while preserving existing storage/API formats.
- Convert Stars quantity presets into add/remove visual controls.
- Convert crypto rate-provider priority into ordered selectors backed by the existing comma-separated setting.
- Align the pro-web admin wheel reward cards and VIP tier threshold/multiplier controls with the main web admin.
- Preserve existing setting keys and API payload compatibility; bump web admin JavaScript cache keys.

---

# Changelog

# BlueGate Platform v5.0.49 — Web visual wheel and VIP editors

- Replace the web admin wheel prize line editor with add/remove prize cards matching the Mini App workflow.
- Replace the VIP JSON editor with per-tier threshold and commission multiplier fields matching Mini App.
- Save wheel prizes through shared settings and VIP rates through the dedicated API.

---

# BlueGate Platform v5.0.48 — Mobile auth drawer hardening

- Fix mobile login/register dialog positioning and overflow using a viewport-bounded centered dialog with explicit closed/open visibility states.
- Ensure the account drawer and backdrop are dismissed after successful login, including the pending-action path, preventing a blank “BlueGate Account” panel from remaining open.
- Refresh auth CSS and JavaScript cache keys for web and pro-web.

---

# BlueGate Platform v5.0.47 — Referral reward settings UI

- Add visible settings in Mini App and web admin for valid-invite reward, referred-purchase base reward, custom referral-code threshold and wheel chances.
- Keep wheel prize editing as visual cards in Mini App and explain the supported line format in web admin.
- Persist these values through the shared admin API and return them in admin settings payload.

---

# BlueGate Platform v5.0.46 — Admin mobile ticket navigation

- Add a visible “تیکت‌های پشتیبانی” entry to the admin mobile “بیشتر” menu so the support tab is reachable on phones when the desktop sidebar is hidden.
- Refresh admin JavaScript cache keys for web and pro-web.

---

# BlueGate Platform v5.0.45 — Center mobile login/register dialog

- Center the home-page login/register dialog on phone screens instead of using a bottom sheet.
- Constrain the dialog to the visible viewport with internal scrolling, safe-area padding and a small-screen width limit.
- Keep the dialog header visible while scrolling and refresh account CSS cache keys for both web and pro-web.

---

# BlueGate Platform v5.0.44 — Mobile web ticket creation sheet

- Fix the new-ticket popup on phones with a bottom-aligned, viewport-bounded sheet, internal scrolling, safe-area padding, sticky header and responsive fields/file input.
- Use dynamic viewport units with a `100vh` fallback to avoid browser chrome/keyboard viewport sizing issues.

---

# BlueGate Platform v5.0.43 — Web/Mini App ticketing parity

- Match web user/admin ticket statuses to Mini App with consistent green/yellow/red badges and summary counts.
- Make resolved/closed user conversations read-only in the web UI while retaining message history and keeping backend enforcement.
- Add image attachment previews, delivery/read ticks, live message polling and live status/composer updates to web ticket chats.
- Add full admin status controls (open, waiting for support, waiting for customer, resolved, closed), customer identity details and live message polling.
- Refresh web asset cache keys so the ticketing updates are loaded immediately after deployment.

---

# BlueGate Platform v5.0.42 — Close ticket creation sheet after submit

- Close the new-ticket creation sheet after successful submission (including duplicate-detection recovery) before opening the exact ticket chat, reducing overlapping screens and confusion.

---

# BlueGate Platform v5.0.41 — Closed ticket restrictions and status colors

- Prevent user replies and re-opening for resolved/closed tickets in the backend.
- Show a read-only closed-ticket notice instead of the reply composer while preserving access to the conversation history.
- Color ticket statuses consistently: open green, waiting for a reply yellow, and resolved/closed red.
- Keep message polling active for read-only closed conversations.

---

# BlueGate Platform v5.0.40 — Ticket WebApp buttons

- Use Telegram inline WebApp buttons for ticket notifications and target the configured Mini App URL with the exact ticket ID, avoiding browser launches without Telegram `initData`.

---

# BlueGate Platform v5.0.39 — Support composer spacing and admin controls

- Add bottom clearance and a distinct composer surface for user/admin ticket chats so attachment and send controls no longer sit flush against the screen edge.
- Keep ticket messages as the independently scrollable region and reorganize admin status actions into a consistent, touch-friendly two-column grid.
- Improve wrapping of admin support page action buttons on narrow screens.

---

# BlueGate Platform v5.0.38 — Telegram ticket notifications

- Add a direct Mini App ticket button to admin Telegram notifications, with customer name, username, internal user ID and Telegram ID where available.
- Notify the ticket owner when support replies or the ticket status changes, including the current status and a direct button back to that exact ticket.
- Support `ticket_<id>` Mini App deep links for both customer and authenticated admin views.

---

# BlueGate Platform v5.0.37 — Admin ticket sheet sizing

- Fix admin ticket conversation sizing to fit the available viewport, keep the message area scrollable, respect device safe areas, and prevent composer/status controls from overflowing on narrow screens.

---

# BlueGate Platform v5.0.36 — Admin ticketing and duplicate prevention

- Redesigned the admin Mini App ticket list and conversation view to match the customer support UI, with ticket stats, status badges, mobile layouts, attachment previews, and clearer reply/status controls.
- Prevented repeat submissions in the ticket form and added server-side short-window idempotency for identical ticket creation requests, including concurrent requests.

---

# BlueGate Platform v5.0.35 — Mini App ticketing UI

- Redesigned the Mini App support ticket list with clearer ticket cards, localized status labels, and an improved empty state.
- Improved the new-ticket form and support chat header.
- Refined chat bubbles, message composer, status badges, and responsive layouts for small mobile screens.
- Added responsive and reduced-motion styling for the ticketing experience.

---

# BlueGate Platform v5.0.32 — Support chat fixes

- چت Mini App در موبایل به پنل تمام‌قد با ارتفاع و اسکرول داخلی پایدار تبدیل شد.
- صفحه چت ادمین Mini App از نمایش کارت‌های پراکنده به گفت‌وگوی کامل با polling و پاسخ مستقیم تبدیل شد.
- تصویر پیوست داخل lightbox داخلی Mini App پیش‌نمایش می‌شود و به لینک خام عکس منتقل نمی‌شود.
- فایل انتخاب‌نشده دیگر به‌صورت MIME خالی به API ارسال نمی‌شود؛ ارسال پیام بدون پیوست اصلاح شد.
- پاسخ فقط‌پیوست نیز معتبر است و پیام خالی واقعی همچنان رد می‌شود.

---

# BlueGate Platform v5.0.31 — Live support chat

- صفحه ساخت تیکت در Mini App و وب به composer حرفه‌ای گفت‌وگو تبدیل شد.
- پیام‌ها به شکل bubbleهای دوطرفه با تیک تحویل و تیک دوم خوانده‌شدن نمایش داده می‌شوند.
- بازخوانی خودکار گفت‌وگو هر ۵ ثانیه در Mini App و وب اضافه شد.
- ارسال و نمایش پیوست‌های JPEG، PNG، WebP، PDF و TXT تا سقف ۵ مگابایت اضافه شد.
- خواندن پیام‌های طرف مقابل هنگام بازکردن گفتگو ثبت می‌شود و وضعیت read برای هر پیام برمی‌گردد.
- نسخه‌های کپی وب و manifest integrity پس از تغییرات همگام شدند.

---

# BlueGate Platform v5.0.30 — Performance hardening

- پاسخ Webhook تلگرام پیش از اجرای handlerهای سنگین flush می‌شود تا تأخیر Provider یا اعلان، صف Telegram را کند نکند.
- timeout پیش‌فرض و سقف timeout ارتباط با Providerهای X-UI، Marzban و Remnawave کوتاه و قابل‌کنترل شد.
- `connect_timeout` و `request_timeout` هنگام ذخیره تنظیمات Provider محدود و normalize می‌شوند.
- `web_gate.php` اکنون bootstrap کامل را load می‌کند و خطای `veyra_pro_core_active()` در entry point مستقیم رفع شده است.
- نسخه هسته پلتفرم به `5.0.30-performance-hardening` و نسخه manifest ماژول Pro Core به `2.1.6` همگام شد.

---

# Mini App design unification — v5.0.16

یکدست‌سازی زبان طراحی Mini App (فقط `public/miniapp/`؛ وب، ماژول‌ها و `integrity.json` دست‌نخورده‌اند).

- فایل جدید `miniapp/tokens.css` (بعد از `design-system.css` لود می‌شود): مقیاس شعاع (`--r-sm/md/lg/xl/xxl`)، فاصله، سایه و استایل واحد آیکون (`.bg-ico`).
- `border-radius` از ۱۰ تا ۳۰ پیکسل (۵۲۵ مورد) روی ۵ پله ۱۲/۱۶/۲۰/۲۴/۲۸ جمع شد. مقدارهای ≤۹، `999` و ≥۳۱ دست‌نخورده‌اند.
- `font-size` های اعشاری (۱۱.۵، ۱۲.۵، ۱۳.۵، ۱۴.۵، ۱۶.۵) به عدد صحیح گرد شدند (۲۸۶ مورد).
- رنگ‌های پراکنده (`#00f2fe`, `#45c8ff`, `#58ddff`, `#4ade80`, `#86efac`, `#6ee7a0`, `#22c55e`, `#f59e0b`, `#fbbf24`, `#8b5cf6`, `#1d9bf0`) به توکن‌های `--bgds-*` / `--accent` وصل شدند (۷۹ مورد؛ نسخه‌های آلفا مثل `#22c55e33` دست‌نخورده ماندند).
- آیکون ناوبری (کاربر + ادمین)، سبد خرید و اعلان‌ها از یونیکد/اموجی به SVG هم‌سبک تبدیل شد.
- فونت Inter و preconnect به Google Fonts حذف شد (Vazirmatn از `design-system.css` به‌صورت محلی لود می‌شود).
- `tokens.css` به لیست asset های `miniapp/index.php` اضافه شد (cache-busting خودکار).
- تم روشن اضافه نشد: بسیاری از گرادیان‌ها رنگ ثابت تیره دارند و نیمه‌کاره‌بودنش بدتر از تم تیره یکدست است.
- تست نشده: PHP روی محیط ساخت نبود (`php -l` اجرا نشده).

---

# Stars stats (admin only) — v5.0.15

نمایش موجودی بات و مجموع خریدهای Telegram Stars در داشبورد ادمین (Mini App و وب).

- API: اکشن `admin_stars_stats` (مجوز `dashboard`، rate limit: ۳۰ درخواست در دقیقه). پارامتر `refresh=1` موجودی را از تلگرام دوباره می‌گیرد (حداقل فاصله ۱۰ ثانیه).
- موجودی بات: `getMyStarBalance`، کش ۶۰ ثانیه‌ای در `settings.stars_balance_cache`. در صورت خطا فقط در لاگ سرور ثبت می‌شود.
- مجموع فروش: رکوردهای `orders` و `credit_topups` که `stars_charge_id` دارند.
- ستون جدید `stars_paid_at` در هر دو جدول (migration + backfill خودکار با `bluegate update` یا `bluegate migrate`). تا قبل از migration، آمار بازه‌ای از `created_at`/`credited_at` حساب می‌شود.
- ثبت `stars_paid_at` بعد از commit تراکنش پرداخت و best-effort انجام می‌شود تا مسیر پرداخت را تحت تأثیر قرار ندهد.
- فرانت: کارت در `public/miniapp/app.js` و `modules/pro-web/public/js/admin.js` (کپی در `public/web/js/admin.js`).
- بعد از آپدیت: `bluegate update` (یا `bluegate migrate`) و بعد یک بار رفرش کامل Mini App/وب.
- تست نشده: PHP روی محیط ساخت نبود؛ قبل از پروداکشن `find . -name '*.php' -exec php -l {} \;`.

---

# BlueGate v5.0.14 — Security hardening (بر پایه v5.0.13)

دست‌نخورده: `app/license.php`، `app/module_loader.php`، `integrity.json`ها، CLI لایسنس.

## تغییرات
1. **Rate limit** (`bootstrap.php`, `api.php`): پارامتر `$failClosed`. برای register / login / OTP / forgot+reset password / telegram_login+link / email_change_* اگر جدول `rate_limits` نباشد یا DB خطا بدهد، درخواست رد می‌شود (پیام RATE_LIMITED). بقیه bucketها مثل قبل.
2. **IP واقعی**: `TRUSTED_PROXIES` در config (پیش‌فرض خالی). فقط اگر `REMOTE_ADDR` در این لیست باشد از `CF-Connecting-IP` یا `X-Forwarded-For` (از راست، اولین IP غیرمعتمد) استفاده می‌شود. پشتیبانی IPv4/IPv6 و CIDR.
3. **توکن در بدنه POST حذف شد** (فرانت‌اند هرگز `authToken` در body نمی‌فرستاد). فقط کوکی `nx_session` یا هدر `X-Web-Token`.
4. **اکشن‌های ادمین**: همه اکشن‌های غیر `admin_` بررسی شدند؛ همه مخصوص کاربر خودش هستند. یک لایه دفاعی اضافه شد: هر اکشن غیر `admin_` که نامش شامل broadcast/backup/restore/provisioning/routing/monitoring/vip_rates/set_role/remove_role باشد، نیاز به ادمین کامل دارد.
5. **`is_admin`**: فقط `is_full_admin` می‌تواند آن را عوض کند؛ حذف ادمین خود و حذف آخرین ادمین ممنوع. کوئری‌های تشخیص ادمین دیگر `users.id` را با `telegram_id` قاطی نمی‌کنند (فقط `telegram_id`).
6. **توکن رسید**: فرمت `<expiry>.<hmac>` با HMAC-SHA256، متصل به type+id+user_id+expiry، اعتبار ۱۵ دقیقه، `hash_equals`، بدون secret پیش‌فرض ثابت (اگر `WEBHOOK_SECRET` خالی باشد توکن ساخته نمی‌شود). پاسخ رسید: `Cache-Control: private, no-store`، `Referrer-Policy: no-referrer`، فقط image/jpeg|png|webp، CSP sandbox.
7. **نشت خطا**: به کلاینت فقط پیام فارسیِ دستی‌نوشته و بدون نشانه فنی (SQL، مسیر، URL، HTTP_FAILED، token…) می‌رسد؛ بقیه فقط در لاگ سرور. شامل global handler، `admin_provision_now`، health check.
8. **`verify_webapp_init_data`** (بازبینی + سخت‌سازی): الگوریتم HMAC درست بود. اضافه شد: رد کردن BOT_TOKEN خالی، hash غیررشته‌ای، `auth_date` اجباری و غیرآینده، سقف طول ورودی.
9. **وب‌سرور**: regex اشتباه `.htaccess` اصلاح شد (`config.php` را نمی‌گرفت)؛ nginx: رد `.sql/.log/.bak/.sh/.env/.ini`، رد `config*.php`/`app/`/`modules/`، اجرای PHP در `/uploads/` ممنوع، هدرهای nosniff/Referrer-Policy/HSTS. `public/uploads/.htaccess` جدید.
10. **Cron** (`cron_provisioning.php`): کلید `WEBHOOK_SECRET` و پارامتر `?secret=` حذف شد (WEBHOOK_SECRET کلید مادر secretهای مشتق‌شده است). `CRON_KEY` با مقدار `CHANGE_ME…` پذیرفته نمی‌شود. متن خطا دیگر برنمی‌گردد.
11. **endpoint سلامت providerها**: rate limit + سقف زمان، بدون نشت متن خطا.

## قبل از استفاده
- اگر کرون HTTP شما با `?key=<WEBHOOK_SECRET>` یا `?secret=` صدا زده می‌شود، به `CRON_KEY` یا هدر `X-Cron-Key` تغییرش دهید (کرون نصب‌کننده CLI است و تغییری لازم ندارد).
- پشت Cloudflare/پروکسی هستید؟ `$TRUSTED_PROXIES` را در `config.php` پر کنید.
- برای اعمال nginx جدید: `bluegate update` یا `bluegate repair`.
- لینک‌های رسید حالا ۱۵ دقیقه اعتبار دارند (با باز کردن دوباره رسید، لینک جدید ساخته می‌شود).
- پیام‌های خطای انگلیسی RuntimeException دیگر به کاربر نمی‌رسند (در لاگ هستند).

## تست نشده
PHP روی محیط ساخت نصب نبود؛ `php -l` اجرا نشده. فقط تعادل نحوی، شبیه‌سازی heredoc nginx و منطق CIDR بررسی شد. قبل از پروداکشن: `find . -name '*.php' -exec php -l {} \;`

---

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
## 5.0.33 - Notification deduplication

- Added a persistent Telegram dispatch guard for admin and user messages.
- Delivery notifications are now idempotent across Bot, Mini App, web, and retry paths.
- Order admin notifications use order/event keys to prevent duplicate sends.
- Removed noisy per-attempt provisioning retry notifications; only the final failure is sent.
## 5.0.34 - Backup timeout fix

- Prevented update step 2/9 from waiting indefinitely on `mysqldump` or file archiving.
- Added bounded database and application-file backup operations with explicit failure messages.
- Enabled streaming database dumps and skipped disposable dependency binaries that can unnecessarily slow backups.
