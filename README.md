# BlueGate Platform

**BlueGate Platform** یک فروشگاه یکپارچه PHP/MySQL برای BlueGate است: Storefront وب، حساب کاربری، سفارش، کیف پول، Referral، Admin، Telegram Mini App و Bot همگی از یک API و یک دیتابیس استفاده می‌کنند.

## معماری رابط کاربری

از نسخه **1.1.0** وب‌سایت و Portal قدیمی یکی شده‌اند. در **1.2.0** کل Website App یک UI Overhaul کامل گرفت و در **1.3.0** کاتالوگ «سرویس‌های بیشتر» به Accordion پیش‌فرض بسته با دسته‌بندی زنده از دیتابیس تبدیل شده، خرید بدون Popup تأیید مستقیماً سفارش می‌سازد و UI روش‌های پرداخت وب با الگوی Mini App بازطراحی شده است. Storefront V9 رابط اصلی وب است و Mini App تلگرام عمداً ظاهر مستقل خودش را حفظ کرده است.

### مسیرها

- `/` و `/web/` — Storefront اصلی
- `/account` — داشبورد کاربر
- `/orders` — سفارش‌ها و پرداخت
- `/wallet` — کیف پول، تراکنش، برداشت و پاداش
- `/referral` — همکاری در فروش
- `/profile` — پروفایل
- `/admin` — پنل مدیریت داخل همان Website
- `/portal/` — فقط Redirect سازگاری به Dashboard جدید؛ UI جدا ندارد
- `/miniapp/` — Telegram Mini App مستقل
- `/api.php` — API مرکزی
- `/bot.php` — Telegram Bot webhook

## نصب اتوماتیک از GitHub

Repo را با نام `BlueGate-Platform` روی branch `main` قرار بده و سپس روی Ubuntu/Debian:

```bash
curl -fsSL https://raw.githubusercontent.com/paliparsa/BlueGate-Platform/main/install.sh -o /tmp/bluegate-install.sh && sudo bash /tmp/bluegate-install.sh --full
```

Installer به‌ترتیب Packageها، Repo، `config.php`، MariaDB، Nginx، SSL، Migration/Seed، Telegram Webhook، Cron و Health Check را انجام می‌دهد.

بعد از نصب:

```bash
sudo bluegate --status
sudo bluegate --health
```

آپدیت بعد از هر Push:

```bash
sudo bluegate --update
```

## نکات امنیتی Installer

- `config.php` داخل Git قرار نمی‌گیرد و Permission محدود دارد.
- `public/install.php` از وب مسدود است و Migration فقط CLI است.
- فقط `public/uploads` و `storage` برای PHP writable هستند.
- Database password و Webhook secret در نصب اول می‌توانند تصادفی تولید شوند.
- Health check HTTPS روی loopback با `--resolve` اجرا می‌شود تا به hairpin DNS وابسته نباشد.

## Product Engine

Category، Product، Variant، Inventory، Coupon، Wallet، Referral و Order lifecycle از هسته BlueReferral حفظ شده‌اند. VPN/Premium از Product/Variant عمومی استفاده می‌کنند و Telegram Stars Dynamic Quantity دارد که قیمت آن سمت PHP محاسبه می‌شود.

جزئیات Merge و Release در `MERGE_GUIDE_FA.md` و `RELEASE_NOTES_FA.md` است.

## Telegram Login در Website

Website علاوه بر username/password از Telegram Login Widget هم پشتیبانی می‌کند تا همان کاربری که در Bot/Mini App وجود دارد، با همان Telegram ID وارد سایت شود. برای فعال شدن Widget، دامنه سایت را یک‌بار با `/setdomain` در `@BotFather` برای همان Bot ثبت کن (دامنه بدون `https://`).

محصولات عادی (`product_type=normal`) که از Admin ساخته می‌شوند نیز به‌صورت خودکار در بخش «سرویس‌های بیشتر» Storefront نمایش داده می‌شوند؛ اگر Variant داشته باشند، انتخاب پلن در همان کارت انجام می‌شود.


## Direct Service Delivery (v1.5)

Admin can attach a per-order HTTPS subscription/service URL. After delivery, only the authenticated owner receives that URL in their order payload. Website and Mini App can open it directly and the customer can copy the subscription link. The old server-side reverse proxy was removed for compatibility with modern subscription panels and anti-bot/CDN setups.

