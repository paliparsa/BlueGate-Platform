# راهنمای BlueGate Merged Edition

این نسخه حاصل تلفیق **BlueGate Storefront V9** با **BlueReferral** است. BlueReferral هسته‌ی بک‌اند و دیتابیس است و Storefront V9 رابط فروش اصلی.

## مسیرهای نهایی

- `/` → فروشگاه جدید BlueGate
- `/web/` → Storefront V9 متصل به API واقعی
- `/portal/` → پنل کامل کاربر و ادمین BlueReferral
- `/miniapp/` → Telegram Mini App
- `/api.php` → API مرکزی
- `/bot.php` → Webhook ربات

## چه چیزهایی یکپارچه شده‌اند؟

- یک دیتابیس MySQL برای کاربران، محصولات، Variantها، سفارش‌ها، کیف پول، رفرال، تخفیف و پرداخت
- Login/Register وب در Storefront
- لینک رفرال وب `/?ref=CODE` با حفظ Query بعد از Redirect و پرشدن خودکار کد معرف
- ثبت سفارش واقعی از Storefront به جای ساخت کد سفارش محلی/ارسال مستقیم به تلگرام
- نمایش سفارش‌ها و وضعیت پرداخت در Drawer حساب کاربری
- کیف پول، کارت‌به‌کارت، ثبت رسید، کد تخفیف
- اتصال پرداخت Crypto و Telegram Stars به پنل کامل موجود
- محصولات VPN از `products + product_variants`
- Telegram Premium از Variantهای USD
- Telegram Stars به‌صورت مقدار دلخواه؛ **قیمت نهایی فقط سمت PHP محاسبه می‌شود**
- تنظیمات Storefront و Stars در پنل ادمین
- CORS محدود به همان Host یا `WEB_ALLOWED_ORIGIN`
- اعتبارسنجی MIME/حجم و نام امن برای تصویر رسید

## دیتای اولیه Storefront

در اولین migration نسخه تلفیقی، اگر Catalog مخصوص Storefront قبلاً seed نشده باشد، محصولات زیر ایجاد/تطبیق داده می‌شوند:

- BlueGate Standard: 20GB / 30GB / 50GB / Unlimited 1 User / Unlimited 2 Users
- BlueGate Pro: 5GB / 10GB / 15GB / 20GB / 25GB
- BlueGate Emergency: 5GB / 10GB / 15GB / 20GB
- Telegram Stars
- Telegram Premium: 3 / 6 / 12 months

Seed فقط یک‌بار اجرا می‌شود (`storefront_catalog_seeded_v1`) تا تغییرات بعدی قیمت از پنل ادمین با اجرای دوباره migration ریست نشوند.

## نصب تازه از Repo جدید

Repo پیشنهادی این نسخه: `paliparsa/BlueGate-Platform` روی branch `main`. بعد از آپلود پروژه، روی Ubuntu/Debian این یک خط را اجرا کن:

```bash
curl -fsSL https://raw.githubusercontent.com/paliparsa/BlueGate-Platform/main/install.sh -o /tmp/bluegate-install.sh && sudo bash /tmp/bluegate-install.sh --full
```

Installer خودش Packageها، Repo، `config.php`، MariaDB، Nginx، SSL، Migration/Seed، Webhook، Cron و Health Check را انجام می‌دهد. بعد از نصب منوی مدیریت با `sudo bluegate` در دسترس است.

### آپدیت‌های بعدی

بعد از Push نسخه جدید به GitHub:

```bash
sudo bluegate --update
```

`config.php` و دیتابیس حفظ می‌شوند؛ سپس Permissionها اصلاح، Migration اجرا و Nginx reload می‌شود.

### فایل‌ها و مسیرهای مدیریتی

- App: `/var/www/bluegate-platform`
- Installer state: `/etc/bluegate-platform.env`
- Installer log: `/var/log/bluegate-platform-install.log`
- Crypto cron: `/etc/cron.d/bluegate-platform`
- Manager command: `sudo bluegate`

## نکته قیمت Premium

Variantهای Premium بر پایه USD هستند. برای تبدیل به تومان باید نرخ USDT/ارز در سیستم BlueReferral معتبر باشد. از بخش Crypto/Rate پنل ادمین نرخ‌ها را Refresh یا Manual Rate را تنظیم کن.

## تنظیم Stars

Admin → Settings → General → **Storefront V9**:

- Price basis: Toman یا USDT
- Price per Star
- Slider min/max/step
- Presets
- Hero و Announcement

حتی اگر JavaScript دستکاری شود، مبلغ سفارش Stars از مقدار انتخابی روی سرور دوباره محاسبه و validate می‌شود.

## Supabase

Storefront جدید دیگر به Supabase وابسته نیست. فایل‌های Supabase و Admin قدیمی Storefront از خروجی نهایی حذف شده‌اند. MySQL + API مرکزی BlueReferral منبع داده است.

## سازگاری

پنل کامل قدیمی BlueReferral عمداً در `/portal/` نگه داشته شده تا امکاناتی مثل مدیریت کامل سفارش، ادمین، Crypto، Stars Payment، Wallet، Referral، Backup و Inventory از بین نروند. Mini App و Bot هم روی همان دیتابیس کار می‌کنند.
