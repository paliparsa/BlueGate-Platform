# BlueGate Platform

BlueGate یک پلتفرم فروش و مدیریت سرویس‌های دیجیتال است که شامل فروشگاه وب، حساب کاربری، Telegram Mini App، ربات تلگرام، پنل مدیریت و سیستم مشترک کاتالوگ، سفارش، پرداخت و اعتبار است.

## قابلیت‌های پروژه

### فروشگاه و کاتالوگ

- ساخت Category، Service، Sub-service / Group و Plan
- قیمت‌گذاری به تومان یا دلار
- تخفیف، مدت سرویس، تصویر، Badge، Featured و ترتیب نمایش
- فعال/غیرفعال کردن سرویس و پلن
- Inventory و تحویل محصولات موجودی‌محور
- نمایش محصولات در Web و Telegram Mini App از یک Catalog مشترک

### سفارش و پرداخت

- ثبت و پیگیری سفارش
- وضعیت‌های مختلف سفارش و مدیریت تحویل
- پرداخت با BlueGate Credit
- کارت‌به‌کارت
- Crypto
- Telegram Stars
- ثبت و بررسی رسید
- ثبت TXID و بررسی تراکنش‌های پشتیبانی‌شده
- تمدید سرویس‌های قبلی

### حساب کاربری

- ورود و حساب کاربری
- پروفایل و Avatar
- امکان استفاده از عکس پروفایل Telegram یا عکس سفارشی
- BlueGate Credit و افزایش اعتبار
- تاریخچه سفارش‌ها و پرداخت‌ها
- «سرویس‌های من»
- Referral و معرفی دوستان
- Notification Center

### Telegram Mini App

- فروشگاه کامل داخل Telegram
- مشاهده و خرید محصولات
- کیف پول و افزایش اعتبار
- سفارش‌ها و سرویس‌های فعال
- پروفایل و تنظیمات حساب
- اعلان‌ها
- پنل مدیریت مخصوص Mini App
- Catalog Builder مرحله‌ای برای ساخت و ویرایش سرویس‌ها

### Telegram Bot

#### امکانات کاربر

- خرید سریع دکمه‌ای
- Category → Service → Group → Plan
- مشاهده فاکتور و انتخاب روش پرداخت
- مشاهده موجودی BlueGate Credit
- افزایش اعتبار
- کارت‌به‌کارت، Crypto و Telegram Stars
- مشاهده سفارش‌ها
- مشاهده سرویس‌های فعال
- تمدید سریع سرویس
- Deep Link مستقیم برای خرید محصول یا پلن

#### امکانات ادمین

- Admin Control Center دکمه‌ای
- Broadcast Center
- ارسال پیام Telegram به کاربران
- ارسال اعلان داخل Mini App
- ارسال همزمان پیام Telegram و اعلان Mini App
- مشاهده سفارش‌های نیازمند رسیدگی
- مدیریت درخواست‌های افزایش اعتبار
- Customer 360
- جستجوی مشتری
- افزایش/کاهش سریع اعتبار مشتری
- مشاهده سرویس‌های نزدیک انقضا
- ارسال یادآوری تمدید
- داشبورد سریع فروش و سفارش‌ها

### پنل مدیریت Web

- مدیریت Catalog
- مدیریت کاربران
- Customer 360
- مدیریت سفارش‌ها
- مدیریت پرداخت‌ها و رسیدها
- مدیریت BlueGate Credit
- مدیریت Walletهای Crypto
- مدیریت نرخ ارز و Telegram Stars
- مدیریت Inventory
- اعلان‌های مدیریتی
- کوپن و تخفیف
- تنظیمات عمومی سیستم

---

# استفاده از پروژه

## مدیریت کاتالوگ

از پنل Admin وارد بخش Catalog شوید.

ساختار کاتالوگ:

```text
Category
└── Service
    └── Group / Sub-service
        └── Plan
```

برای ساخت محصول جدید:

1. Category موردنظر را انتخاب یا ایجاد کنید.
2. روی «افزودن سرویس» بزنید.
3. اطلاعات اصلی سرویس را وارد کنید.
4. در صورت نیاز Group / Sub-service اضافه کنید.
5. Planهای سرویس را تعریف کنید.
6. قیمت، مدت، نوع تحویل و سایر تنظیمات را ثبت کنید.
7. سرویس را ذخیره و فعال کنید.

همین Catalog در Web، Mini App و Telegram Bot استفاده می‌شود.

## مدیریت سفارش‌ها

از بخش Orders در Web Admin یا Mini App Admin می‌توانید:

- سفارش را مشاهده کنید.
- پروفایل مشتری را باز کنید.
- رسید را بررسی کنید.
- پرداخت را تأیید یا رد کنید.
- وضعیت سفارش را تغییر دهید.
- لینک سرویس یا متن تحویل را ثبت کنید.
- سفارش را آرشیو یا حذف کنید.

## مدیریت اعتبار کاربران

از بخش Wallet / Credit:

- موجودی کاربر را مشاهده کنید.
- درخواست‌های افزایش اعتبار را بررسی کنید.
- رسید را مشاهده کنید.
- درخواست را تأیید یا رد کنید.
- از Customer 360 اعتبار کاربر را مدیریت کنید.

## مدیریت Telegram Bot

کاربر از منوی Bot می‌تواند «خرید سریع»، «اعتبار من»، «سفارش‌های من» و «سرویس‌های من» را استفاده کند.

ادمین از دکمه Admin Control Center وارد ابزارهای مدیریتی Bot می‌شود.

## ارسال همگانی و اعلان

از Admin Control Center وارد Broadcast Center شوید.

می‌توانید انتخاب کنید:

- فقط Telegram
- فقط Mini App Notification
- هر دو همزمان

سپس گروه کاربران را انتخاب، پیام را وارد، Preview را مشاهده و ارسال را تأیید کنید.

---

# نصب روی VPS

## نیازمندی‌ها

پیشنهاد می‌شود از Ubuntu یا Debian استفاده شود.

پروژه به موارد زیر نیاز دارد:

```text
Nginx
PHP 8.2+
PHP-FPM
PHP CLI
PDO MySQL
cURL
mbstring
MySQL یا MariaDB
Git
Cron
HTTPS
```

## نصب جدید از GitHub

ابتدا Repository را روی VPS دریافت کنید:

```bash
cd /var/www
git clone https://github.com/USERNAME/REPOSITORY.git bluegate-platform
cd bluegate-platform
```

سپس Installer را اجرا کنید:

```bash
sudo bash install.sh
```

یا:

```bash
sudo chmod +x cli/bluegate
sudo ./cli/bluegate install
```

Installer تنظیمات لازم شامل Domain، Database، Telegram Bot، Nginx، Cron و Permissionها را انجام می‌دهد.

پس از نصب Health Check را اجرا کنید:

```bash
sudo ./cli/bluegate health
```

## آپدیت پروژه از GitHub

هر زمان نسخه جدید را روی GitHub قرار دادید:

```bash
cd /var/www/bluegate-platform
git pull origin main
sudo ./cli/bluegate update
```

بعد از آپدیت:

```bash
sudo ./cli/bluegate health
```

`update` قبل از اعمال تغییرات Backup می‌سازد و سپس Migration، Permissionها، Cron، Telegram و Health Check را اجرا می‌کند.

## Dashboard ترمینال

برای باز کردن داشبورد CLI:

```bash
sudo ./cli/bluegate
```

اگر command سراسری نصب شده باشد:

```bash
sudo bluegate
```

## کامندهای اصلی مدیریت سرور

```bash
sudo ./cli/bluegate status
```

نمایش وضعیت سریع سیستم.

```bash
sudo ./cli/bluegate health
```

بررسی کامل PHP، Database، Web، Telegram، Cron، TLS و Permissionها.

```bash
sudo ./cli/bluegate update
```

آپدیت امن پروژه.

```bash
sudo ./cli/bluegate backup
```

ساخت Backup.

```bash
sudo ./cli/bluegate backups
```

نمایش Backupهای موجود.

```bash
sudo ./cli/bluegate restore <backup>
```

بازیابی Backup.

```bash
sudo ./cli/bluegate migrate
```

اجرای Migrationهای دیتابیس.

```bash
sudo ./cli/bluegate doctor
```

بررسی مشکلات رایج نصب و سرور.

```bash
sudo ./cli/bluegate repair
```

Repair تنظیمات، Permissionها، Cron، Nginx و Migrationها.

```bash
sudo ./cli/bluegate logs
```

مشاهده Log Center.

```bash
sudo ./cli/bluegate telegram status
```

مشاهده وضعیت Telegram Bot و Webhook.

```bash
sudo ./cli/bluegate telegram webhook-refresh
```

ثبت مجدد Webhook تلگرام.

```bash
sudo ./cli/bluegate maintenance on
sudo ./cli/bluegate maintenance off
```

فعال یا غیرفعال کردن Maintenance Mode.
