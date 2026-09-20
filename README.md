# BlueGate Platform v4.2.0

BlueGate یک پلتفرم یکپارچه برای فروش و مدیریت محصولات دیجیتال و سرویس‌های VPN است و شامل فروشگاه وب، Telegram Mini App، ربات تلگرام، کیف پول، پرداخت، پنل ادمین، Service Engine، Provisioning خودکار، مانیتورینگ و اتصال مستقیم به پنل‌های VPN می‌شود.

## امکانات

### فروشگاه و کاربران

- فروشگاه وب و Telegram Mini App با کاتالوگ مشترک
- دسته‌بندی، محصول، سرویس و پلن‌های متعدد
- نمایش پلن‌های محصول به‌صورت Accordion در کاتالوگ ادمین
- قیمت‌گذاری ثابت یا مبتنی بر USD و نرخ زنده
- بروزرسانی خودکار قیمت پلن‌های دلاری بدون نیاز به Edit/Save مجدد محصول
- سبد خرید و ثبت سفارش
- کیف پول داخلی و شارژ موجودی
- کد تخفیف
- تاریخچه سفارش‌ها و تراکنش‌ها
- رسید سفارش و وضعیت تحویل
- Referral و پاداش معرفی
- مأموریت‌های روزانه و Lucky Wheel
- اعلان‌های داخل حساب کاربری
- اتصال حساب وب به Telegram

### پرداخت

- پرداخت از کیف پول
- کارت‌به‌کارت و ثبت رسید
- Telegram Stars
- پرداخت کریپتو
- نرخ خودکار و دستی ارزها
- Refresh دوره‌ای نرخ‌ها با Cron
- بررسی دوره‌ای وضعیت پرداخت‌ها
- مدیریت روش‌های پرداخت از پنل ادمین

### پنل مدیریت

- مدیریت کاربران، محصولات، پلن‌ها و سفارش‌ها
- مدیریت قیمت و نرخ تبدیل
- مدیریت Providerها و زیرساخت VPN
- مدیریت Plan Mapping
- مدیریت پرداخت‌ها و رسیدها
- مدیریت کدهای تخفیف
- مدیریت اعلان‌ها
- نقش‌ها و سطح دسترسی
- Audit Log
- Monitoring Dashboard
- Provider Analytics
- Queue و Retry برای Provisioning

### Service Engine و Provisioning

- نگهداری مستقل سرویس کاربر از سفارش
- `user_services` و `service_instances`
- Provisioning Job Queue
- Idempotency برای جلوگیری از ساخت تکراری
- Retry با Backoff
- Service Events و Usage Snapshot
- رمزگذاری Credentialهای Provider
- ساخت خودکار سرویس بعد از تأیید پرداخت
- تمدید سرویس موجود بدون ساخت Client جدید
- افزایش حجم و مدت سرویس
- Subscription URL و QR Code

### 3x-ui

- اتصال مستقیم به 3x-ui
- API Token یا Username/Password
- Test Connection
- دریافت Inboundها
- Create / Read / Update / Delete Client
- Suspend / Enable
- Usage و Expiry
- Subscription URL
- QR Code
- اتصال یک Client به چند Inbound
- Multi-location روی یک پنل
- Reconciliation برای جلوگیری از Client تکراری

### Marzban

- اتصال مستقیم از API
- Authentication و Health Check
- Create / Read / Update / Delete User
- Data Limit و Expiry
- Status و Subscription URL
- Proxy / Inbound Mapping
- Renewal و Add-on روی User موجود

### Remnawave

- اتصال با Bearer API Token
- Create / Read / Update User
- Enable / Disable
- Usage و Expiry
- Internal Squads
- Squad UUID Mapping
- Subscription
- Renewal و Add-on روی User موجود

### Routing و Failover

- Priority Routing
- Weighted Routing
- Capacity-aware Routing
- Priority + Weighted
- Fallback خودکار بین Providerها
- Circuit Breaker و Half-open Recovery
- Max Clients و Soft Capacity
- Capacity Reserve
- Route History و Routing Attempts
- حذف Provider خراب، پر یا در Maintenance از Routing

### Monitoring و Automation

- Sync دوره‌ای Usage، Expiry و Status
- Health Check دوره‌ای Providerها
- Online / Degraded / Offline status
- Incident و Recovery Tracking
- هشدار مصرف 80٪، 90٪ و 100٪
- هشدار نزدیک‌شدن به انقضا
- Dedupe هشدارها
- Expire و Suspend خودکار
- Cronهای خودکار برای Payment، Provisioning، Monitoring و Rates

### My Services

- نمایش سرویس‌های فعال
- حجم کل، مصرف‌شده و باقی‌مانده
- تاریخ انقضا و وضعیت
- Subscription Link و QR
- Sync دستی
- تمدید
- خرید حجم و روز اضافه
- نمایش Locationها و Instanceها
- Usage History و Event Timeline
- Service Card گرافیکی

### امکانات پیشرفته

- Free Trial واقعی روی Provider
- محدودیت و Cooldown برای Trial
- Support Ticket و Thread داخلی
- اتصال Ticket به Service یا Order
- Usage Chart
- Provider Analytics
- درآمد منتسب به Provider
- هزینه ماهانه و تقریبی Bandwidth
- Maintenance Mode
- Soft Capacity

### رابط کاربری و Motion Experience

- Dark UI با جلوه‌های Glass و Glow کنترل‌شده
- Page Transition نرم
- Accordion animation
- CTA shine effect
- Active/Online status pulse
- Animated counters
- Skeleton loaders
- Success animation
- Copy-to-check interaction
- Animated progress bars
- VPN data-flow effect
- Location/flag transition
- Dynamic border glow
- Modal blur و transition
- Mini App bottom-nav animation
- Connection-test visual states
- Logo reveal
- Desktop magnetic CTA و subtle card tilt
- پشتیبانی از `prefers-reduced-motion`

### ابزار مدیریتی CLI

پس از نصب، دستور `bluegate` برای مدیریت سیستم در دسترس است و امکاناتی مانند Status، Health Check، Doctor/Repair، Backup/Restore، Migration، Update، Logs، Telegram/Webhook، Domain/SSL، Cron و Maintenance را ارائه می‌دهد.

---

# آموزش نصب

## 1. پیش‌نیازها

Installer برای Ubuntu/Debian و سرور دارای `apt` طراحی شده است.

پیشنهاد می‌شود از موارد زیر استفاده کنید:

- Ubuntu 22.04 یا 24.04
- دسترسی `root` یا `sudo`
- حداقل 1 GB RAM؛ 2 GB یا بیشتر پیشنهاد می‌شود
- یک Domain یا Subdomain که به IP سرور اشاره کند
- Telegram Bot Token
- Username ربات تلگرام
- Telegram Numeric ID ادمین

پکیج‌هایی مانند nginx، MariaDB، PHP، Git، Curl، Unzip، OpenSSL، rsync، jq و Certbot در صورت نیاز توسط Installer نصب می‌شوند.

## 2. ساخت ربات تلگرام

در Telegram وارد `@BotFather` شوید و یک Bot بسازید:

```text
/newbot
```

این اطلاعات را نگه دارید:

```text
Bot Token
Bot Username
```

Username را هنگام نصب بدون `@` وارد کنید.

Telegram Numeric ID ادمین را نیز آماده داشته باشید. برای چند ادمین می‌توانید IDها را با کاما جدا کنید:

```text
123456789,987654321
```

## 3. تنظیم DNS

قبل از نصب، یک رکورد `A` برای Domain/Subdomain بسازید و آن را به IP سرور متصل کنید.

مثال:

```text
bot.example.com -> SERVER_IP
```

روی سرور می‌توانید Resolve شدن دامنه را بررسی کنید:

```bash
getent ahostsv4 bot.example.com
```

اگر از Cloudflare استفاده می‌کنید و صدور اولیه SSL با مشکل مواجه شد، Proxy را موقتاً روی `DNS only` قرار دهید.

## 4. آپلود و Extract پروژه

فایل ZIP پروژه را روی سرور آپلود کنید؛ مثلاً داخل `/root`.

سپس:

```bash
cd /root
unzip BlueGate-Platform-v4.2.0.zip -d BlueGate-Platform-v4.2.0
cd BlueGate-Platform-v4.2.0
```

اگر نام ZIP یا پوشه متفاوت است، نام واقعی فایل خودتان را جایگزین کنید.

مجوز اجرای اسکریپت‌ها را تنظیم کنید:

```bash
chmod +x install.sh update.sh health.sh uninstall.sh cli/bluegate
```

## 5. اجرای Installer

اگر با کاربر معمولی وارد شده‌اید:

```bash
sudo ./install.sh --full
```

اگر مستقیماً با Root وارد شده‌اید:

```bash
./install.sh --full
```

Installer وارد Wizard تنظیمات می‌شود.

## 6. اطلاعات مورد نیاز Wizard

### Domain

فقط دامنه را بدون `https://` و بدون `/` انتهایی وارد کنید:

```text
bot.example.com
```

### Telegram Bot Token

Token دریافتی از BotFather را وارد کنید.

### Bot Username

بدون `@` وارد کنید:

```text
BlueGateBot
```

### Admin Telegram IDs

یک یا چند ID عددی:

```text
123456789,987654321
```

### Support Username

Username پشتیبانی را بدون `@` وارد کنید.

### Install Directory

در حالت عادی مقدار پیش‌فرض Installer را نگه دارید.

### Database

می‌توانید مقادیر پیشنهادی را استفاده کنید:

```text
Database Name: bluegate_platform
Database User: bluegate_user
```

برای Database Password می‌توانید رمز دلخواه وارد کنید یا در صورت پشتیبانی Wizard اجازه دهید رمز امن تولید شود.

### Brand و Theme

مثال:

```text
Brand Name: BlueGate
Theme Color: #1d9bf0
```

### Force Join Channel

اختیاری است. در صورت عدم نیاز آن را غیرفعال نگه دارید.

### SSL

فعال‌کردن SSL پیشنهاد می‌شود. دامنه باید قبل از این مرحله به IP سرور Resolve شده باشد.

## 7. عملیات خودکار Installer

Installer به‌صورت خودکار موارد اصلی زیر را انجام می‌دهد:

1. نصب dependencyهای مورد نیاز
2. قرار دادن سورس در مسیر نهایی
3. ساخت `config.php`
4. تولید Secretهای لازم
5. ساخت Database و Database User
6. اجرای Schema/Migration
7. تنظیم Permissionها
8. تنظیم nginx
9. دریافت و تنظیم Let's Encrypt SSL
10. نصب Cron jobها
11. ثبت Telegram Webhook
12. Sync منو و Commandهای Telegram
13. نصب دستور سراسری `bluegate`
14. اجرای Health Check نهایی

Secretهای زیر را در اختیار شخص دیگری قرار ندهید:

```text
DB password
WEBHOOK_SECRET
TELEGRAM_WEBHOOK_SECRET
SWAPWALLET_CALLBACK_SECRET
SERVICE_ENCRYPTION_KEY
CRON_KEY
```

## 8. بررسی نصب

بعد از اتمام Installer اجرا کنید:

```bash
sudo bluegate status
```

سپس:

```bash
sudo bluegate health
```

در صورت مشاهده مشکل قابل Repair:

```bash
sudo bluegate doctor
```

یا:

```bash
sudo bluegate repair
```

## 9. آدرس‌های اصلی

اگر دامنه شما `bot.example.com` باشد:

```text
Storefront: https://bot.example.com/
Mini App:   https://bot.example.com/miniapp/
Web App:    https://bot.example.com/web/
Portal:     https://bot.example.com/portal/
```

## 10. بررسی Telegram Webhook

```bash
sudo bluegate telegram status
```

در صورت نیاز به ثبت مجدد:

```bash
sudo bluegate telegram webhook-refresh
```

برای Sync منو و Commandها:

```bash
sudo bluegate telegram sync-ui
```

## 11. بررسی Cron

Cronهای BlueGate پس از نصب در سیستم ایجاد می‌شوند. برای Repair یا ساخت مجدد:

```bash
sudo bluegate cron
```

سپس وضعیت را دوباره بررسی کنید:

```bash
sudo bluegate health
```

## 12. ورود و راه‌اندازی اولیه

بعد از نصب:

1. وارد Web/Admin شوید.
2. روش‌های پرداخت و نرخ‌ها را تنظیم کنید.
3. محصولات و Planها را بررسی یا ایجاد کنید.
4. برای سرویس VPN وارد Infrastructure شوید.
5. Provider مورد نظر مانند 3x-ui، Marzban یا Remnawave را اضافه کنید.
6. `Test Connection` را اجرا کنید.
7. Plan Mapping را به Provider و Inbound/Squad مناسب متصل کنید.
8. یک سفارش تستی ایجاد کنید و Provisioning و تحویل Subscription را بررسی کنید.

نصب BlueGate در این مرحله کامل است.
