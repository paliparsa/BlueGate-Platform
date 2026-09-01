# پلتفرم BlueGate

**نسخه فعلی: v3.0.7.3 — Credit Top-up Receipt Review**

BlueGate Platform هسته اصلی فروش و مدیریت سرویس‌های BlueGate است. این پروژه شامل وب‌سایت فروشگاهی، حساب کاربری، پنل مدیریت، Telegram Mini App و ربات تلگرام است و همه این بخش‌ها از یک Backend، دیتابیس، کاتالوگ و سیستم سفارش مشترک استفاده می‌کنند.

این نسخه به‌صورت کامل برای نصب روی سرور طراحی شده و تغییرات محصولات، پلن‌ها، سفارش‌ها و کاربران بین وب و Mini App مشترک است.

---

## امکانات اصلی

- فروشگاه وب BlueGate
- Telegram Mini App
- حساب و پروفایل کاربری
- سیستم ثبت و مدیریت سفارش‌ها
- بخش «سرویس‌های من» و مدیریت سرویس‌های فعال
- اکشن‌های اختصاصی سرویس VPN مانند باز کردن سرویس، کپی لینک Subscription و تمدید
- کیف پول / BlueGate Credit
- سیستم معرفی دوستان و Referral
- پنل مدیریت تحت وب
- پنل مدیریت داخل Mini App
- Telegram Bot و Webhook
- Catalog Studio
- مدیریت پرداخت‌ها
- پیش‌نمایش امن رسیدهای افزایش اعتبار برای ادمین وب و Mini App
- کوپن و تخفیف
- مدیریت موجودی و Inventory
- اعلان‌های کاربری
- Backup / Restore و ثبت فعالیت‌های مدیریتی

---

## قابلیت‌های جدید v3.0.7.2

### Welcome / Onboarding

در وب و Telegram Mini App برای کاربران یک صفحه/پنجره خوش‌آمدگویی اضافه شده است که امکانات اصلی BlueGate را به‌صورت کوتاه معرفی می‌کند.

کاربر می‌تواند گزینه «دیگر نمایش نده» را فعال کند. وضعیت نمایش Welcome روی حساب کاربر ذخیره می‌شود تا تجربه کاربری بین Web و Mini App هماهنگ بماند. در سمت کلاینت نیز fallback محلی در نظر گرفته شده است.

### اعلان‌های مدیریتی داخل برنامه

ادمین اکنون می‌تواند از بخش مدیریت اعلان ارسال کند و پیام‌ها در Notification Center کاربران در Web و Mini App نمایش داده می‌شوند.

قابلیت‌های سیستم اعلان شامل موارد زیر است:

- ارسال اعلان مدیریتی برای کاربران
- عنوان و متن اختصاصی
- انواع مختلف اعلان مانند عادی، مهم، تخفیف، سرویس و امنیتی
- وضعیت خوانده‌شده / خوانده‌نشده برای هر کاربر
- Badge تعداد اعلان‌های خوانده‌نشده
- پشتیبانی از Action برای هدایت کاربر به بخش‌های مختلف سیستم یا لینک معتبر
- ثبت Campaign و تاریخچه ارسال‌های مدیریتی
- حفظ اعلان‌های سیستمی قبلی مانند تغییر وضعیت سفارش

Backend اعلان بین Website و Mini App مشترک است.

### هشدار تکمیل امنیت حساب

در بخش حساب کاربری، اگر کاربر ایمیل یا شماره تماس خود را کامل نکرده باشد یک هشدار زرد نمایش داده می‌شود.

این هشدار برای افزایش امنیت حساب و امکان بازیابی بهتر دسترسی طراحی شده و تا زمان تکمیل اطلاعات باقی می‌ماند. متن هشدار بر اساس فیلد ناقص تغییر می‌کند و کاربر مستقیماً به بخش تکمیل اطلاعات حساب هدایت می‌شود.

---

## ساختار کاتالوگ

ساختار اصلی Catalog Studio به شکل زیر است:

```text
Category
└── Service
    └── Group / Sub-service
        └── Plan / Product
```

Catalog Studio محل اصلی مدیریت روزمره محصولات است. جداول Legacy مربوط به Product و Variant برای سازگاری با Checkout قدیمی همچنان حفظ شده‌اند، اما نباید به‌عنوان یک کاتالوگ جداگانه به‌صورت دستی مدیریت شوند.

### موارد قابل مدیریت برای Service

- عنوان
- Slug
- توضیحات
- تصویر
- Theme
- Badge
- Featured
- فعال / غیرفعال
- ترتیب نمایش

### موارد قابل مدیریت برای Group / Sub-service

- عنوان
- Slug
- توضیحات
- تصویر
- فعال / غیرفعال
- ترتیب نمایش

### موارد قابل مدیریت برای Plan / Product

- عنوان
- توضیحات
- تصویر
- فعال / غیرفعال
- ترتیب نمایش
- مدت سرویس
- تخفیف
- نوع تحویل
- نوع و مقدار کمیسیون
- واحد قیمت
- قیمت تومان
- قیمت دلار

مدیریت کاتالوگ از Web Admin و Mini App Admin در دسترس است.

---

## قیمت‌گذاری دلاری

پلن‌ها می‌توانند مستقیماً با قیمت تومان یا USD تعریف شوند.

اگر قیمت USD انتخاب شود، BlueGate با استفاده از سیستم نرخ USDT/Toman مقدار قابل پرداخت به تومان را محاسبه می‌کند و اطلاعات نرخ تبدیل را نیز نگه می‌دارد.

فیلدهای مرتبط شامل موارد زیر هستند:

```text
price
price_currency
price_usd
price_rate_toman
price_rate_source
price_rate_updated_at
```

به این ترتیب ادمین می‌تواند قیمت اصلی محصول را دلاری نگه دارد و Checkout همچنان مبلغ نهایی تومان را دریافت کند.

---

## تصاویر کاتالوگ

تصویر Service، Group و Plan را می‌توان از طریق URL یا Upload مستقیم از پنل مدیریت ثبت کرد.

فرمت‌های پشتیبانی‌شده:

```text
JPG
JPEG
PNG
WEBP
```

حداکثر حجم فایل: **6 MB**

فایل‌های Upload شده در مسیر زیر ذخیره می‌شوند:

```text
public/uploads/catalog/YYYYMM/
```

وب‌سرور باید اجازه نوشتن در مسیر `public/uploads/catalog/` را داشته باشد.

---

## مسیرهای اصلی

برای نمونه اگر پروژه روی `https://example.com` نصب شده باشد:

```text
/                 فروشگاه
/account          حساب کاربری
/orders           سفارش‌ها
/wallet           کیف پول BlueGate Credit
/referral         معرفی دوستان
/profile          پروفایل
/admin            پنل مدیریت وب
/miniapp/         Telegram Mini App
/api.php          API اصلی برنامه
/bot.php          Telegram Bot Webhook
/portal/          مسیر سازگاری / Redirect
```

---

## نیازمندی‌های سرور

پیشنهاد پایه:

- Ubuntu یا Debian
- Nginx
- PHP-FPM
- PHP CLI
- MySQL یا MariaDB
- دامنه یا Subdomain با HTTPS
- حداقل 1GB RAM؛ پیشنهاد 2GB یا بیشتر

پکیج‌های متداول PHP مورد استفاده پروژه:

```text
php-fpm
php-cli
php-mysql
php-curl
php-mbstring
php-xml
```

اسکریپت نصب می‌تواند وابستگی‌های متداول را روی یک سرور تمیز نصب و تنظیم کند.

---

## نصب تازه

فایل‌های پروژه را روی سرور Upload یا Clone کنید و سپس Installer را با دسترسی مناسب اجرا کنید:

```bash
chmod +x install.sh
sudo ./install.sh
```

Installer اطلاعات لازم مانند تنظیمات دیتابیس، آدرس عمومی سایت و تنظیمات برنامه را دریافت می‌کند.

نمونه فایل تنظیمات:

```text
config.example.php
```

فایل تنظیمات Production که شامل Password، API Key یا Bot Token است را داخل Repository عمومی قرار ندهید.

---

## آپدیت نسخه موجود

قبل از آپدیت Production:

1. از دیتابیس Backup بگیرید.
2. یک کپی از Config فعلی نگه دارید.
3. سپس Update Script را اجرا کنید.

```bash
chmod +x update.sh
sudo ./update.sh
```

سیستم Migration تغییرات مورد نیاز دیتابیس را اعمال می‌کند. در v3.0.7.2 این تغییرات شامل فیلدهای مورد نیاز Welcome، Actionهای Notification و Campaignهای اعلان نیز می‌شود.

روی نصب موجود، `schema.sql` را به‌صورت دستی جایگزین دیتابیس Production نکنید.

---

## Telegram Mini App

Mini App برای احراز هویت تلگرامی از `initData` استفاده می‌کند و با همان API و دیتابیس Website کار می‌کند.

برای راه‌اندازی Production:

1. BlueGate را روی HTTPS نصب کنید.
2. Bot Token را در Config تنظیم کنید.
3. آدرس Telegram Mini App را روی `/miniapp/` قرار دهید.
4. در صورت استفاده از Bot Webhook، آدرس `bot.php` را به‌عنوان Webhook تنظیم کنید.

اگر Mini App صفحه خالی نمایش داد، ابتدا Console مرورگر، Network Requests و پاسخ API بررسی شود؛ خطای Authentication، Cache قدیمی Frontend یا خطای API می‌تواند باعث Boot ناقص Mini App شود.

---

## دسترسی پوشه تصاویر

اگر Upload تصویر با Permission Error مواجه شد، مسیر Upload را ایجاد و دسترسی آن را بررسی کنید.

نمونه برای Ubuntu/Debian:

```bash
sudo mkdir -p public/uploads/catalog
sudo chown -R www-data:www-data public/uploads
sudo find public/uploads -type d -exec chmod 755 {} \;
sudo find public/uploads -type f -exec chmod 644 {} \;
```

از `chmod 777` برای پوشه‌های پروژه استفاده نکنید.

---

## فایل‌های مهم پروژه

```text
app/bootstrap.php       هسته اصلی برنامه و Migrationها
app/catalog.php         منطق Catalog Studio
public/api.php          API مشترک Web و Mini App
public/web/             رابط وب کاربر و مدیریت
public/miniapp/         Telegram Mini App
public/bot.php          ورودی Telegram Bot
app/bot_logic.php       منطق Bot
schema.sql              Schema نصب تازه
install.sh              نصب پروژه
update.sh               آپدیت پروژه
config.example.php      نمونه تنظیمات
VERSION                 نسخه فعلی پروژه
```

---

## نسخه

```text
3.0.7.2
```
