# BlueGate Platform

**BlueGate Platform** نسخه یکپارچه‌ی BlueGate Storefront + BlueReferral است؛ یک فروشگاه کامل PHP/MySQL با Storefront وب، حساب کاربری، سفارش، کیف پول، Referral، Mini App تلگرام، Bot و پنل مدیریت.

## مسیرها

- `/` و `/web/` — Storefront اصلی BlueGate
- `/portal/` — حساب کاربری و پنل کامل مدیریت
- `/miniapp/` — Telegram Mini App
- `/api.php` — API مرکزی
- `/bot.php` — Telegram Bot webhook

## پیش‌نیاز

Ubuntu/Debian، دامنه یا ساب‌دامین متصل به VPS، و برای Bot/Mini App یک Bot Token از BotFather. Installer خودش Nginx، MariaDB، PHP-FPM، SSL و Cron را نصب/تنظیم می‌کند.

## نصب اتوماتیک از GitHub

Repo جدید را با نام دقیق **`BlueGate-Platform`** روی اکانت `paliparsa` بساز و محتویات این پروژه را در branch `main` آپلود کن. سپس روی VPS:

```bash
curl -fsSL https://raw.githubusercontent.com/paliparsa/BlueGate-Platform/main/install.sh -o /tmp/bluegate-install.sh && sudo bash /tmp/bluegate-install.sh --full
```

Installer به‌ترتیب این کارها را انجام می‌دهد:

1. دریافت Domain، Bot Token، Bot Username، Admin ID و تنظیمات لازم
2. نصب Nginx / MariaDB / PHP / Certbot
3. Clone یا Update از `paliparsa/BlueGate-Platform`
4. ساخت `config.php`
5. ساخت Database و Database User
6. تنظیم Permissionهای امن
7. تنظیم Nginx و HTTPS
8. اجرای Migration و Seed محصولات BlueGate
9. تنظیم Telegram Webhook
10. نصب Cron پرداخت Crypto
11. Health Check نهایی

بعد از نصب، مدیریت پروژه از هر مسیری با این دستور باز می‌شود:

```bash
sudo bluegate
```

برای Update مستقیم:

```bash
sudo bluegate --update
```

برای Status و تست:

```bash
sudo bluegate --status
sudo bluegate --health
```

## نکات امنیتی Installer

- `config.php` داخل Git قرار نمی‌گیرد و Permission آن `640` است.
- `public/install.php` از طریق Nginx مسدود است و Migration فقط از CLI اجرا می‌شود.
- کل سورس writable توسط وب‌سرور نیست؛ فقط `public/uploads` و `storage` به `www-data` داده می‌شوند.
- Database password و Webhook secret در اولین نصب به‌صورت تصادفی ساخته می‌شوند مگر خودت مقدار بدهی.
- تنظیمات Installer در `/etc/bluegate-platform.env` با Permission محدود ذخیره می‌شوند.

## Update workflow

بعد از هر Push به branch `main`:

```bash
sudo bluegate --update
```

Update سورس را از GitHub می‌گیرد، Permissionها را اصلاح می‌کند، Migrationهای جدید را اجرا می‌کند و Nginx را Reload می‌کند. `config.php` و دیتابیس حذف نمی‌شوند.

## ساختار محصول

محصولات عمومی، Category، Variant، Inventory، Coupon، Wallet، Referral و Order lifecycle از هسته BlueReferral حفظ شده‌اند. محصولات BlueGate مثل Standard / Pro / Emergency / Telegram Premium از همان Product/Variant engine استفاده می‌کنند و Telegram Stars مسیر Dynamic Order اختصاصی دارد.

راهنمای جزئی‌تر معماری و Merge در `MERGE_GUIDE_FA.md` قرار دارد.
