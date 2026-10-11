# BlueGate Platform

<p align="center">
  <strong>فروشگاه، ربات تلگرام و مدیریت سرویس‌های VPN در یک پلتفرم یکپارچه</strong>
</p>

<p align="center">
  <a href="#قابلیت‌ها">قابلیت‌ها</a> ·
  <a href="#معماری">معماری</a> ·
  <a href="#نصب-و-راه‌اندازی">نصب</a> ·
  <a href="#استقرار">استقرار</a> ·
  <a href="#امنیت">امنیت</a>
</p>

BlueGate یک پلتفرم PHP/MariaDB برای فروش و مدیریت سرویس‌های دیجیتال و VPN است. این پروژه تجربه کاربر را بین **Telegram Mini App**، وب‌اپلیکیشن و ربات تلگرام یکپارچه می‌کند و در سمت مدیریت، سفارش، پرداخت، اعتبار، provisioning و سلامت Providerها را در یک پنل واحد کنترل می‌کند.

> **نسخه فعلی:** `5.0.30-performance-hardening`
> **Pro Modules:** `2.1.6`

## قابلیت‌ها

### تجربه مشتری

- فروشگاه واکنش‌گرا در Mini App و وب
- کاتالوگ دسته‌بندی‌شده، پلن، Variant، تخفیف و کد دعوت
- سفارش، پرداخت، ارسال رسید و timeline وضعیت
- کیف پول و اعتبار، شارژ کارت‌به‌کارت، Telegram Stars و کریپتو
- مشاهده سرویس‌های VPN، لینک Subscription، مصرف و تاریخ انقضا
- Referral، مأموریت روزانه، Lucky Wheel و اعلان‌های کاربری
- سیستم تیکت پشتیبانی دوطرفه برای کاربر و ادمین

### عملیات و مدیریت

- Provisioning خودکار سرویس پس از پرداخت
- اتصال به `3x-UI / X-UI`، `Marzban` و `Remnawave`
- Routing، Failover و Mapping پلن به Provider
- Health Check، Monitoring، Incident و صف Retry
- مدیریت کاربران، نقش‌ها، سفارش‌ها، کاتالوگ، اعتبار و تنظیمات
- Audit Log و کنترل مجوزهای ادمین
- Backup، Restore، Migration و Update از طریق CLI

### پایداری

- پاسخ سریع Webhook تلگرام پیش از اجرای Handlerهای سنگین
- timeout محدود برای ارتباط با Providerهای خارجی
- جلوگیری از قفل‌شدن طولانی PHP-FPM در Health Check و عملیات شبکه
- کش و نرخ‌دهی کنترل‌شده برای سرویس‌های بیرونی
- backup سبک‌تر با حذف فایل‌های قابل‌بازسازی و uploads از آرشیو فایل

## معماری

```text
Telegram Bot ───────┐
Telegram Mini App ──┼──> public/api.php ──> app/ ──> MariaDB
Web App ────────────┘          │             │
                               │             ├── Payments
                               │             ├── Tickets
                               │             ├── Provisioning
                               │             └── Provider Drivers
                               │
                               └── 3x-UI / Marzban / Remnawave
```

ساختار اصلی پروژه:

| مسیر | مسئولیت |
|---|---|
| `app/` | Bootstrap، دامنه، احراز هویت، پرداخت، بات و سرویس‌ها |
| `public/` | Entry pointهای API، Webhook، Mini App و وب عمومی |
| `modules/pro-core/` | قابلیت‌های Pro، Providerها، Monitoring و Routing |
| `modules/pro-web/` | داشبورد وب و assetهای رابط مدیریت |
| `cli/` | نصب، migration، backup، update و عیب‌یابی |
| `schema.sql` | ساختار اولیه دیتابیس |
| `config.example.php` | الگوی تنظیمات محیط |

## نصب و راه‌اندازی

### پیش‌نیازها

- Linux Debian/Ubuntu
- PHP 8.1+ با `curl`, `mbstring`, `mysql`, `xml` و `zip`
- MariaDB 10.4+
- Nginx
- دامنه دارای HTTPS برای Webhook و Mini App
- Bot Token معتبر از BotFather

### نصب سریع

```bash
git clone https://github.com/paliparsa/BlueGate-Platform.git
cd BlueGate-Platform
cp config.example.php config.php
nano config.php
chmod +x cli/bluegate cli/lib/*.sh
sudo ./cli/bluegate install
```

مقادیر مهم `config.php`:

```php
$BOT_TOKEN = '...';
$BOT_USERNAME = 'YourBotUsername';
$ADMIN_IDS = [123456789];
$PUBLIC_BASE_URL = 'https://example.com';
$WEBHOOK_SECRET = 'یک-رشته-تصادفی-طولانی';
$DB_NAME = 'bluegate_platform';
$DB_USER = 'bluegate_user';
$DB_PASS = '...';
```

اگر سایت پشت Cloudflare یا Reverse Proxy است، فقط IP یا CIDR پراکسی‌های قابل‌اعتماد را در `$TRUSTED_PROXIES` قرار دهید. این تنظیم برای تشخیص IP واقعی است و فهرست مسدودسازی اسکنرها نیست.

## CLI

```bash
./cli/bluegate system-info
./cli/bluegate migrate
./cli/bluegate update
./cli/bluegate backup
./cli/bluegate repair
./cli/bluegate telegram webhook
```

قبل از اجرای `update` از دیتابیس و تنظیمات production نسخه پشتیبان بگیرید. فایل‌های `config.php`، `public/uploads/` و credentialهای Provider نباید commit شوند.

## استقرار

1. روی VPS، کد را دریافت یا با `bluegate update` به‌روزرسانی کنید.
2. migrationها را اجرا کنید.
3. `nginx -t` و وضعیت PHP-FPM را بررسی کنید.
4. Webhook را با Token معتبر تنظیم و `getWebhookInfo` را بررسی کنید.
5. یک ورود Mini App، یک سفارش آزمایشی و یک Health Check Provider را تست کنید.

برای نسخه‌های release:

```bash
./make-release.sh
```

نسخه رسمی فقط از فایل `VERSION` خوانده می‌شود و نام بسته از همان مقدار ساخته می‌شود.

## امنیت

- `config.php` و secretها خارج از Git نگهداری می‌شوند.
- درخواست‌های بدون احراز هویت و عملیات حساس rate limit دارند.
- هدرهای Proxy فقط از `TRUSTED_PROXIES` پذیرفته می‌شوند.
- فایل‌های `.env`، backup، log، SQL و مسیرهای داخلی از وب مسدود هستند.
- PHP داخل `uploads` اجرا نمی‌شود.
- credentialهای Provider با کلید سرویس رمزگذاری می‌شوند.
- دسترسی ادمین بر پایه role و permission کنترل می‌شود.
- Webhook با secret مسیر و در صورت تنظیم با Telegram secret header اعتبارسنجی می‌شود.

## عیب‌یابی سریع

```bash
sudo systemctl status nginx mariadb php*-fpm --no-pager
sudo nginx -t
sudo journalctl -u php*-fpm --since "1 hour ago" --no-pager
curl -sS "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo" | jq .
```

اگر `pending_update_count` بالا است، ابتدا خطا و زمان پاسخ Webhook را بررسی کنید. اگر `/api.php` یا پنل Infrastructure timeout می‌دهد، Providerهای خارجی و لاگ PHP-FPM را بررسی کنید؛ Health Check و Provisioning نباید با timeoutهای طولانی اجرا شوند.

## توسعه

قبل از ارسال تغییرات:

```bash
git diff --check
find . -name '*.php' -not -path './vendor/*' -exec php -l {} \;
```

هر دو نسخه `modules/pro-web/public/` و `public/web/` باید بعد از تغییرات frontend همگام بمانند. تغییرات assetهای Pro ممکن است نیازمند به‌روزرسانی `integrity.json` باشند.

## مجوز و وضعیت

این مخزن برای استقرار و توسعه BlueGate Platform نگهداری می‌شود. جزئیات تغییرات هر release در [`CHANGELOG.md`](CHANGELOG.md) ثبت می‌شود.
