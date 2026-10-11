# BlueGate Platform

<p align="center"><strong>پلتفرم یکپارچه فروش محصولات دیجیتال، ربات تلگرام و مدیریت سرویس‌های VPN</strong></p>

<p align="center"><a href="#معرفی">معرفی</a> · <a href="#قابلیت‌ها">قابلیت‌ها</a> · <a href="#پیش‌نیازها">پیش‌نیازها</a> · <a href="#نصب-خودکار">نصب خودکار</a> · <a href="#مدیریت-و-به‌روزرسانی">مدیریت</a> · <a href="#امنیت">امنیت</a> · <a href="#عیب‌یابی">عیب‌یابی</a></p>

## معرفی

BlueGate Platform سامانه‌ای مبتنی بر PHP و MariaDB برای فروش محصولات دیجیتال و مدیریت سرویس‌های VPN است. وب‌سایت، Telegram Mini App، ربات تلگرام، پنل مدیریت، سفارش‌ها، پرداخت‌ها و اتصال به Providerهای VPN در یک پروژه یکپارچه قرار گرفته‌اند.

- **نسخه هسته:** فایل [VERSION](VERSION)
- **نسخه ماژول‌های Pro:** `2.1.6`
- **سیستم‌عامل هدف نصب‌کننده:** Debian / Ubuntu با APT
- **نصب:** راهنمای مرحله‌ای CLI؛ نصب‌کننده برای تنظیمات مهم از شما سؤال می‌پرسد و کاملاً بدون ورودی نیست.

## قابلیت‌ها

### فروشگاه و کاربران
- فروشگاه واکنش‌گرا برای وب و Telegram Mini App
- کاتالوگ، دسته‌بندی، پلن، سفارش و پیگیری وضعیت پرداخت
- کیف پول، اعتبار، کد تخفیف و سیستم دعوت
- رسید کارت‌به‌کارت، Telegram Stars و پرداخت کریپتو در صورت پیکربندی
- مشاهده سرویس VPN، لینک اشتراک، مصرف و تاریخ انقضا
- مأموریت‌ها، گردونه شانس، اعلان‌ها و گفت‌وگوی پشتیبانی با پیوست

### مدیریت و زیرساخت
- مدیریت کاربران، سفارش‌ها، کاتالوگ، اعتبار و تنظیمات
- نقش‌ها، مجوزهای مدیر و ثبت رویدادها
- Provisioning سرویس پس از پرداخت تأییدشده، در صورت تنظیم درست Provider
- اتصال به `3x-UI / X-UI`، `Marzban` و `Remnawave`
- صف کارها، Retry، Health Check، Monitoring و قابلیت‌های Routing در ماژول‌های سازگار
- CLI برای نصب، تعمیر، Migration، Backup، Restore و Update

## ساختار پروژه

```text
app/                  منطق برنامه، پرداخت، بات و سرویس‌ها
public/               API، Webhook، وب و Mini App
public/miniapp/       رابط Telegram Mini App
public/web/           فایل‌های رابط وب
modules/pro-core/     قابلیت‌های هسته Pro و Providerها
modules/pro-web/      ماژول رابط وب Pro
cli/bluegate          نصب‌کننده و ابزار خط فرمان
cli/lib/              توابع نصب و نگهداری
schema.sql            ساختار اولیه دیتابیس
config.example.php    نمونه تنظیمات دستی
VERSION               نسخه رسمی هسته
CHANGELOG.md          تاریخچه تغییرات
```

## پیش‌نیازها

- VPS یا سرور اختصاصی Debian/Ubuntu با دسترسی `root` یا `sudo`
- دامنه با DNS اشاره‌کننده به IP سرور
- دسترسی ورودی به پورت‌های 80 و 443
- توکن ربات از [@BotFather](https://t.me/BotFather)
- شناسه عددی تلگرام حداقل یک مدیر
- اینترنت برای دریافت بسته‌های سیستم، سورس پروژه و گواهی SSL

نصب‌کننده با APT وابستگی‌هایی مانند Nginx، MariaDB، PHP-FPM، افزونه‌های PHP، Git و Certbot را نصب یا بررسی می‌کند. نصب خودکار برای توزیع‌های غیر Debian/Ubuntu تضمین نشده است.

## نصب خودکار

### نصب تازه روی VPS

این دستورات را در ترمینال سرور اجرا کنید:

```bash
sudo apt-get update
sudo apt-get install -y git
git clone https://github.com/paliparsa/BlueGate-Platform.git
cd BlueGate-Platform
chmod +x cli/bluegate cli/lib/*.sh
sudo ./cli/bluegate install
```

نصب‌کننده مرحله‌به‌مرحله این کارها را انجام می‌دهد:

1. بررسی اولیه سرور و فضای دیسک
2. دریافت دامنه، نام برند، رنگ تم و اطلاعات ربات تلگرام
3. دریافت شناسه عددی مدیران و اطلاعات دیتابیس
4. نصب وابستگی‌ها و سرویس‌های موردنیاز
5. دریافت و استقرار فایل‌های برنامه
6. تولید تنظیمات خصوصی، ایجاد دیتابیس و اجرای Migrationها
7. تنظیم Nginx و تلاش برای فعال‌سازی SSL
8. تنظیم Cron و تلاش برای ثبت Telegram Webhook و همگام‌سازی منوی ربات
9. اجرای بررسی نهایی و نمایش خلاصه نصب

**قبل از اجرا آماده کنید:** دامنه نهایی، Bot Token، نام کاربری ربات بدون `@`، شناسه عددی مدیر یا مدیران (با کاما جدا شوند) و نام کاربری پشتیبانی.

دامنه را بدون `https://` وارد کنید؛ نمونه: `shop.example.com`. برای SSL خودکار، DNS باید به سرور اشاره کند و پورت‌های 80 و 443 از اینترنت قابل دسترسی باشند.

مسیر پیش‌فرض برنامه `/var/www/bluegate-platform` و فایل تنظیمات خصوصی CLI معمولاً `/etc/bluegate-platform.env` است. مقادیر نهایی را در طول ویزارد بررسی کنید.

### بعد از نصب

```bash
sudo bluegate status
sudo bluegate health
sudo bluegate system-info
sudo nginx -t
```

سپس پنل و Mini App را باز کنید، روش‌های پرداخت و اطلاعات فروش را تنظیم کنید، Provider VPN را وصل کنید و Mapping پلن‌ها را انجام دهید. یک سفارش آزمایشی اجرا کنید و ایجاد سرویس را بررسی کنید. نصب برنامه به‌تنهایی به معنی آماده‌بودن پرداخت یا Provider برای فروش واقعی نیست.

## تنظیمات دستی

برای مشاهده الگوی تنظیمات دستی:

```bash
cp config.example.php config.php
nano config.php
```

مقادیر مهم شامل `BOT_TOKEN`، `BOT_USERNAME`، `ADMIN_IDS`، `PUBLIC_BASE_URL`، `WEBHOOK_SECRET`، اطلاعات `DB_*`، `SERVICE_ENCRYPTION_KEY`، `CRON_KEY` و `TRUSTED_PROXIES` هستند. برای نصب تازه، روش پیشنهادی استفاده از `sudo ./cli/bluegate install` است تا نصب‌کننده تنظیمات خصوصی را تولید کند.

**هرگز** `config.php`، رمز دیتابیس، Bot Token، کلیدهای Provider یا secretهای واقعی را به GitHub Commit نکنید.

## مدیریت و به‌روزرسانی

| دستور | کاربرد |
|---|---|
| `sudo bluegate status` | وضعیت کلی برنامه |
| `sudo bluegate health` | بررسی سلامت سرویس‌ها |
| `sudo bluegate doctor` | تشخیص مشکلات رایج |
| `sudo bluegate configure` | اجرای مجدد ویزارد تنظیمات |
| `sudo bluegate repair` | تعمیر تنظیمات و سرویس‌های نصب |
| `sudo bluegate update` | به‌روزرسانی برنامه |
| `sudo bluegate migrate` | اجرای Migrationها |
| `sudo bluegate backup` | ایجاد نسخه پشتیبان |
| `sudo bluegate backups` | فهرست Backupها |
| `sudo bluegate restore` | بازیابی تعاملی Backup |
| `sudo bluegate db status` | بررسی اتصال دیتابیس |
| `sudo bluegate telegram status` | بررسی اتصال ربات |
| `sudo bluegate telegram webhook-refresh` | ثبت مجدد Webhook |
| `sudo bluegate system-info` | اطلاعات سرور |
| `sudo bluegate logs` | نمایش منوی لاگ‌ها |

### روند پیشنهادی Update

```bash
sudo bluegate backup
sudo bluegate update
sudo bluegate health
```

قبل از به‌روزرسانی سرور عملیاتی، از وجود نسخه پشتیبان دیتابیس و فایل‌های مهم مطمئن شوید. هنگام Restore، نسخه و مقصد انتخاب‌شده را با دقت بررسی کنید.

## پرداخت و Provisioning سرویس

- پرداخت‌ها به تنظیمات و دسترسی‌های حساب مربوطه وابسته‌اند.
- بررسی خودکار کریپتو به شبکه، دارایی، کیف پول و تنظیمات API نیاز دارد.
- ایجاد خودکار سرویس به Provider معتبر، دسترسی API و Mapping صحیح پلن نیاز دارد.
- پیش از فروش واقعی، پرداخت موفق و ناموفق، سفارش تکراری، Retry و قطع ارتباط Provider را آزمایش کنید.

## امنیت

- فایل‌های تنظیمات، secretها و کلیدهای رمزگذاری را محرمانه نگه دارید.
- اگر از Cloudflare یا Reverse Proxy استفاده می‌کنید، فقط IP/CIDR پراکسی‌های واقعی را در `TRUSTED_PROXIES` وارد کنید؛ در غیر این صورت خالی بگذارید.
- دسترسی SSH و مجوزهای سرور را محدود کنید.
- قبل از تغییر مهم یا Update، Backup بگیرید.
- SSL و تمدید گواهی را بررسی کنید؛ وجود دامنه به‌تنهایی HTTPS را تضمین نمی‌کند.
- اسکریپت‌های ناشناس را با دسترسی root اجرا نکنید.

## عیب‌یابی

### بررسی سرویس‌ها

```bash
sudo bluegate status
sudo bluegate health
sudo systemctl status nginx mariadb --no-pager
sudo nginx -t
systemctl list-units --type=service --all | grep -E 'php.*fpm'
```

### لاگ‌ها

```bash
sudo bluegate logs
sudo journalctl -u nginx --since '1 hour ago' --no-pager
sudo journalctl -u mariadb --since '1 hour ago' --no-pager
```

### مشکلات رایج

- **دامنه باز نمی‌شود:** DNS، IP سرور، فایروال و پورت‌های 80/443 را بررسی کنید.
- **SSL فعال نمی‌شود:** DNS و دسترسی بیرونی به مسیر اعتبارسنجی HTTP را بررسی کنید.
- **ربات پاسخ نمی‌دهد:** Bot Token، نام کاربری و وضعیت Webhook را بررسی کنید.
- **دیتابیس وصل نمی‌شود:** تنظیمات دیتابیس و وضعیت MariaDB را بررسی کنید.
- **سرویس VPN ساخته نمی‌شود:** دسترسی API Provider، Health Check، Mapping پلن و لاگ Provisioning را بررسی کنید.
- **CSS یا JS قدیمی نمایش داده می‌شود:** Refresh کامل انجام دهید و پاسخ فایل‌های CSS/JS را در ابزار توسعه مرورگر بررسی کنید.

## توسعه و بررسی قبل از انتشار

```bash
git diff --check
find . -name '*.php' -not -path './vendor/*' -exec php -l {} \;
```

اگر PHP روی محیط توسعه نصب نیست، دستور lint اجرا نخواهد شد؛ این را تست موفق تلقی نکنید. نسخه‌های متناظر رابط وب و ماژول Pro را پس از تغییرات همگام نگه دارید و در صورت تغییر فایل‌های تحت بررسی یکپارچگی، manifest مربوطه را نیز بررسی کنید.

تاریخچه تغییرات در [CHANGELOG.md](CHANGELOG.md) ثبت می‌شود.

## گزارش باگ

هنگام گزارش مشکل، نسخه موجود در `VERSION`، سیستم‌عامل، مرحله وقوع خطا و متن خطای پاک‌سازی‌شده را ارائه دهید. Bot Token، رمزها، کلیدهای API، اطلاعات پرداخت و داده‌های خصوصی کاربران را ارسال نکنید.

---

<p align="center"><strong>BlueGate Platform</strong><br><sub>فروشگاه، اتوماسیون و مدیریت سرویس‌های دیجیتال</sub></p>
