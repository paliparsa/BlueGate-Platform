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
