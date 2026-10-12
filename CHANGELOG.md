# Changelog

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
