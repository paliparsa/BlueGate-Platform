# BlueGate Platform

BlueGate یک پلتفرم یکپارچه برای فروش و مدیریت سرویس‌های دیجیتال و سرویس‌های VPN است. هسته‌ی سیستم شامل فروشگاه وب، Telegram Mini App، ربات تلگرام، کیف پول، سفارش و پرداخت، مدیریت موجودی، Service Engine، Provisioning خودکار، مانیتورینگ و اتصال مستقیم به پنل‌های VPN است.

این README فقط امکانات پروژه و روش نصب و راه‌اندازی را توضیح می‌دهد.

---

## امکانات

### فروشگاه و حساب کاربری

- فروشگاه وب و Telegram Mini App با کاتالوگ مشترک
- دسته‌بندی، سرویس، پلن و محصولات دیجیتال
- سبد خرید و ثبت سفارش
- کیف پول داخلی کاربران
- شارژ کیف پول
- کد تخفیف
- تاریخچه سفارش‌ها و تراکنش‌ها
- رسید سفارش و وضعیت تحویل
- سیستم Referral و پاداش معرفی
- مأموریت‌های روزانه و Lucky Wheel
- اعلان‌های داخل حساب کاربری
- احراز هویت وب و اتصال حساب به Telegram
- پنل ادمین تحت وب
- نقش‌ها و سطح دسترسی ادمین
- Audit Log برای عملیات مدیریتی

### پرداخت

- پرداخت از کیف پول
- کارت‌به‌کارت و ثبت رسید
- Telegram Stars
- پرداخت کریپتو
- نرخ خودکار و دستی ارزهای پشتیبانی‌شده
- بررسی دوره‌ای پرداخت‌ها توسط Cron
- تنظیم روش‌های پرداخت از پنل مدیریت

### Service Engine

BlueGate برای سرویس‌های Managed یک Service Engine مستقل دارد و سرویس کاربر را جدا از سفارش نگهداری می‌کند.

- `user_services` برای سرویس اصلی کاربر
- `service_instances` برای اتصال سرویس به Provider
- Provisioning Job Queue
- Idempotency برای جلوگیری از ساخت چندباره سرویس
- Retry با backoff
- ثبت Service Events
- ثبت Usage Snapshot
- رمزگذاری Credentialهای Provider

### 3x-ui

- اتصال مستقیم به 3x-ui
- API Token و Username/Password
- Test Connection
- دریافت Inboundها
- ساخت Client
- مشاهده Client
- Update Client
- Suspend / Enable
- حذف Client
- دریافت Usage و Expiry
- Subscription URL
- QR Code
- اتصال یک Client به چند Inbound روی یک پنل
- استفاده از یک Subscription Native پنل برای چند Location/Node
- Reconciliation هنگام timeout برای جلوگیری از Client تکراری

### Marzban

اتصال Marzban از API خود پنل انجام می‌شود.

- Authentication
- Health Check
- Create / Read / Update / Delete User
- Data Limit
- Expiry
- Status
- Subscription URL
- Proxies / Inbounds Mapping
- Renewal و Add-on روی User موجود

### Remnawave

اتصال Remnawave با Bearer API Token انجام می‌شود.

- اتصال API
- Create / Read / Update User
- Enable / Disable
- Usage و Expiry
- Internal Squads
- Mapping سرویس به Squad UUID
- Subscription
- Renewal و Add-on روی User موجود

### Provisioning و تحویل خودکار

- اتصال Plan فروشگاه به Provider
- اتصال Plan به Inbound یا Squad
- ساخت خودکار سرویس بعد از تأیید پرداخت
- ثبت Service و Instance
- تحویل Subscription URL
- Retry خودکار در خطاهای موقت
- جلوگیری از Provisioning تکراری در Webhookهای تکراری
- Queue قابل مشاهده و Retry از پنل ادمین

### تمدید و Add-on

- تمدید همان Client موجود بدون ساخت سرویس جدید
- افزایش حجم
- افزایش مدت سرویس
- قیمت مستقل برای هر GB اضافه
- قیمت مستقل برای هر روز اضافه
- حداقل و حداکثر قابل تنظیم
- اجرای عملیات از طریق Job Queue

### My Services

- نمایش سرویس‌های فعال کاربر
- وضعیت سرویس
- حجم کل
- حجم مصرف‌شده
- حجم باقی‌مانده
- تاریخ انقضا
- Subscription Link
- QR
- Sync دستی
- تمدید
- خرید حجم اضافه
- خرید روز اضافه
- نمایش Instance و Locationها
- Usage History
- Event History
- Service Card گرافیکی

### Multi-location

برای 3x-ui، BlueGate می‌تواند یک Client را روی چند Inbound همان پنل ایجاد کند. اگر 3x-ui به Nodeهای مختلف متصل باشد، کاربر یک Subscription URL خود پنل دریافت می‌کند و Locationهای مختلف داخل همان Subscription قرار می‌گیرند.

برای سناریوهای چندپنلی نیز ساختار BlueGate امکان نگهداری چند Instance و Subscription Aggregation را دارد.

### Routing و Failover

- Priority Routing
- Weighted Routing
- Capacity-aware Routing
- Priority + Weighted
- Fallback خودکار بین Providerها
- Circuit Breaker
- Half-open recovery
- Max Clients
- Soft Capacity
- Capacity Reserve
- حذف Provider خراب یا پر از Routing
- Route History
- Routing Attempts
- Reconciliation قبل از Failover در خطاهای مبهم

### Monitoring و Automation

- Sync دوره‌ای مصرف سرویس‌ها
- Sync Expiry و Status
- Health Check دوره‌ای Providerها
- وضعیت Online / Degraded / Offline
- Provider Incident Tracking
- Recovery Tracking
- هشدار مصرف 80٪، 90٪ و 100٪
- هشدار نزدیک‌شدن به انقضا
- Dedupe هشدارها برای جلوگیری از Spam
- Expire خودکار
- Suspend خودکار در صورت نیاز
- Cron Monitoring
- Monitoring Dashboard

### امکانات پیشرفته

- Free Trial واقعی روی Provider
- محدودیت Trial برای هر کاربر
- Cooldown
- Support Ticket داخلی
- Ticket Thread و Reply برای کاربر و ادمین
- اتصال Ticket به Service یا Order
- Usage Chart
- Service Event Timeline
- Service Card SVG
- Provider Analytics
- درآمد منتسب به Provider
- هزینه ماهانه Provider
- هزینه تقریبی Bandwidth
- Maintenance Mode برای Provider
- خارج‌شدن Provider از Routing در Maintenance
- Soft Capacity برای انتقال Provisioning جدید به Node دیگر

### مدیریت سیستم

BlueGate دارای CLI مدیریتی اختصاصی است:

```bash
bluegate
```

امکانات CLI شامل:

- Status
- Health Check
- Doctor / Repair
- Backup / Restore
- Database migration
- Update
- Logs
- Telegram status
- Webhook refresh
- Domain migration
- SSL repair
- Cron repair
- Maintenance mode
- System information

---

# نصب کامل BlueGate

## 1. پیش‌نیازها

Installer فعلی برای سرورهای Debian/Ubuntu مبتنی بر `apt` طراحی شده است.

پیشنهاد:

- Ubuntu 22.04 یا Ubuntu 24.04
- VPS با دسترسی Root
- حداقل 1 GB RAM؛ 2 GB یا بیشتر پیشنهاد می‌شود
- یک دامنه یا Subdomain
- دسترسی به DNS دامنه
- Telegram Bot Token
- Telegram numeric ID ادمین

Installer موارد زیر را خودش نصب می‌کند:

- nginx
- MariaDB
- PHP-FPM
- PHP CLI
- PHP MySQL
- PHP cURL
- PHP mbstring
- PHP XML
- PHP ZIP
- Git
- Curl
- Unzip
- OpenSSL
- rsync
- jq
- Certbot

---

## 2. ساخت Telegram Bot

در Telegram وارد `@BotFather` شوید.

دستور زیر را ارسال کنید:

```text
/newbot
```

بعد از ساخت Bot این دو مورد را نگه دارید:

```text
Bot Token
Bot Username
```

Username را هنگام نصب **بدون @** وارد کنید.

مثال:

```text
Bot username: BlueGateBot
```

برای ADMIN ID نیز numeric Telegram ID خودتان را آماده کنید. اگر چند ادمین دارید، IDها با کاما وارد می‌شوند:

```text
123456789,987654321
```

---

## 3. تنظیم DNS

قبل از اجرای Installer، دامنه باید به IP سرور اشاره کند.

در DNS Provider یک رکورد `A` بسازید:

```text
Type: A
Name: bot
Value: SERVER_IP
```

مثلاً اگر دامنه شما این باشد:

```text
bot.example.com
```

باید:

```text
bot.example.com -> IP VPS
```

Resolve شود.

می‌توانید روی سرور بررسی کنید:

```bash
getent ahostsv4 bot.example.com
```

**قبل از فعال‌کردن SSL، DNS باید درست Resolve شود.**

اگر Cloudflare استفاده می‌کنید و در صدور اولیه SSL مشکلی داشتید، موقتاً Proxy را روی `DNS only` قرار دهید و بعد از نصب دوباره تنظیم دلخواه را اعمال کنید.

---

## 4. آپلود و Extract پروژه

فایل ZIP نسخه BlueGate را روی سرور آپلود کنید؛ مثلاً داخل `/root`.

سپس:

```bash
cd /root
unzip BlueGate-Platform-v0.10.1-Debug-Fix.zip
cd BlueGate-Platform-v0.10.1-Debug-Fix
```

اگر نام پوشه نسخه شما متفاوت بود، وارد همان پوشه شوید.

Executable permission را تنظیم کنید:

```bash
chmod +x install.sh health.sh update.sh uninstall.sh cli/bluegate
```

---

## 5. اجرای نصب کامل

با Root اجرا کنید:

```bash
sudo ./install.sh --full
```

یا اگر از قبل Root هستید:

```bash
./install.sh --full
```

Installer وارد Configuration Wizard می‌شود.

---

## 6. تنظیمات Wizard

### Domain

دامنه را بدون `https://` وارد کنید:

```text
bot.example.com
```

درست:

```text
bot.example.com
```

غلط:

```text
https://bot.example.com/
```

### Telegram Bot Token

Token دریافتی از BotFather را وارد کنید.

### Bot Username

بدون `@`:

```text
BlueGateBot
```

### Admin Telegram IDs

یک یا چند ID عددی:

```text
123456789
```

یا:

```text
123456789,987654321
```

### Support Username

Username پشتیبانی بدون `@`:

```text
BlueGateSupport
```

### Git Repository

اگر این نسخه را از ZIP نصب می‌کنید، Installer سورس local همین release را تشخیص می‌دهد و برای نصب اولیه از همان استفاده می‌کند.

برای Updateهای Git می‌توانید Repository پروژه را وارد کنید.

### Install Directory

مسیر نهایی نصب برنامه.

در حالت عادی مقدار پیش‌فرض را نگه دارید.

### Database Name

پیشنهاد:

```text
bluegate_platform
```

### Database User

پیشنهاد:

```text
bluegate_user
```

### Database Password

Installer در صورت خالی‌بودن تنظیم قبلی یک رمز تصادفی امن ایجاد می‌کند. می‌توانید رمز دلخواه نیز وارد کنید.

### Brand Name

مثلاً:

```text
BlueGate
```

### Theme Color

مثلاً:

```text
#1d9bf0
```

### Force Join Channel

اختیاری است.

برای غیرفعال‌کردن می‌توانید طبق Wizard مقدار `-` بدهید.

### Resend API Key / Sender

اختیاری است و فقط در صورت استفاده از قابلیت‌های Email لازم است.

### SSL

پیشنهاد:

```text
yes
```

اگر SSL فعال باشد، یک Email برای Let's Encrypt درخواست می‌شود.

### Backup Retention

تعداد Release Backupهایی که نگه داشته شوند و مدت نگهداری Database Backup را تعیین کنید یا مقدار پیش‌فرض را نگه دارید.

---

## 7. کارهایی که Installer خودکار انجام می‌دهد

بعد از Wizard، BlueGate به‌ترتیب:

1. پکیج‌های مورد نیاز را نصب می‌کند.
2. سورس پروژه را در Install Directory قرار می‌دهد.
3. `config.php` را ایجاد می‌کند.
4. Secretهای لازم را تولید می‌کند.
5. MariaDB database و user را ایجاد می‌کند.
6. Permissionها را تنظیم می‌کند.
7. nginx را تنظیم می‌کند.
8. SSL را با Let's Encrypt دریافت می‌کند.
9. nginx را برای HTTPS دوباره تنظیم می‌کند.
10. Database migrationها را اجرا می‌کند.
11. Cron jobها را نصب می‌کند.
12. Telegram webhook را ثبت می‌کند.
13. Telegram commands/menu را Sync می‌کند.
14. دستور سراسری `bluegate` را نصب می‌کند.
15. Health Check نهایی را اجرا می‌کند.

Secretهای اصلی مثل موارد زیر توسط Wizard قابل تولید هستند و نباید عمومی شوند:

```text
DB password
WEBHOOK_SECRET
TELEGRAM_WEBHOOK_SECRET
SWAPWALLET_CALLBACK_SECRET
SERVICE_ENCRYPTION_KEY
CRON_KEY
```

---

# بررسی بعد از نصب

## وضعیت کلی

```bash
sudo bluegate status
```

## Health Check

```bash
sudo bluegate health
```

این دستور مواردی مثل PHP extensionها، nginx، MariaDB، Database، SSL، Cron و Application endpoint را بررسی می‌کند.

## Doctor

برای بررسی و Repair خودکار بخش‌های امن:

```bash
sudo bluegate doctor
```

## اطلاعات سیستم

```bash
sudo bluegate system-info
```

---

# آدرس‌های اصلی

با فرض دامنه:

```text
https://bot.example.com
```

فروشگاه اصلی:

```text
https://bot.example.com/
```

Telegram Mini App:

```text
https://bot.example.com/miniapp/
```

Web App:

```text
https://bot.example.com/web/
```

Portal:

```text
https://bot.example.com/portal/
```

Admin داخل Web UI برای کاربرانی که Telegram ID آن‌ها در لیست Adminها قرار دارد قابل دسترسی است.

---

# Telegram Webhook

وضعیت Telegram:

```bash
sudo bluegate telegram status
```

ثبت مجدد Webhook:

```bash
sudo bluegate telegram webhook-refresh
```

Sync منو و commandهای Bot:

```bash
sudo bluegate telegram sync-ui
```

همچنین می‌توانید از دستور زیر استفاده کنید:

```bash
sudo bluegate webhook
```

---

# Cron Jobs

Installer Cronها را در این فایل ایجاد می‌کند:

```text
/etc/cron.d/bluegate-platform
```

Jobهای اصلی شامل:

- بررسی پرداخت‌ها: هر دقیقه
- Provisioning Queue: هر دقیقه
- Monitoring: هر 5 دقیقه
- Refresh نرخ‌ها: هر 10 دقیقه

برای ساخت یا Repair مجدد Cron:

```bash
sudo bluegate cron
```

بعد از چند دقیقه:

```bash
sudo bluegate health
```

باید وضعیت Cronها را مشاهده کنید.

---

# تنظیم Providerهای VPN

بعد از نصب، وارد Admin شوید و بخش Infrastructure را باز کنید.

## 3x-ui

Provider جدید ایجاد کنید و موارد زیر را وارد کنید:

- Name
- Driver: `3x-ui`
- Panel URL
- API Token یا Username/Password
- TLS Verification
- Max Clients در صورت نیاز

سپس:

1. Test Connection را اجرا کنید.
2. Inboundها را دریافت کنید.
3. Plan Mapping ایجاد کنید.
4. یک Plan را به Provider و Inbound مورد نظر وصل کنید.

برای چند Location روی یک پنل 3x-ui می‌توانید چند Inbound را برای همان Mapping انتخاب کنید. BlueGate همان Client را روی Inboundهای انتخاب‌شده ایجاد می‌کند و Subscription native همان پنل را تحویل می‌دهد.

## Marzban

Provider را با Driver مربوط به Marzban ایجاد کنید و Credential/API اطلاعات پنل را وارد کنید.

بعد از Test Connection، Planها را به ساختار مناسب Marzban Map کنید.

## Remnawave

برای Remnawave از Bearer API Token استفاده کنید.

Plan Mapping می‌تواند به Internal Squad UUID متصل شود.

بعد از ایجاد Provider حتماً Test Connection را اجرا کنید.

---

# تنظیم Auto Provisioning

برای اینکه خرید یک Plan باعث ساخت خودکار VPN شود:

1. Provider را ایجاد و تست کنید.
2. Service Plan مورد نظر را در Catalog داشته باشید.
3. در Infrastructure یک Plan → Provider Mapping بسازید.
4. Target مناسب را مشخص کنید:
   - 3x-ui: Inbound یا چند Inbound
   - Remnawave: Squad
   - Marzban: تنظیمات User/Proxy/Inbound مربوطه
5. Mapping را فعال کنید.
6. یک سفارش تستی با مبلغ کم یا محیط تست ثبت کنید.
7. بعد از تأیید پرداخت، Provisioning Queue را بررسی کنید.

Provisioning worker هر دقیقه اجرا می‌شود.

در صورت نیاز از Admin می‌توانید Job را دستی Retry کنید.

---

# Monitoring و Routing

بعد از راه‌اندازی Providerها:

- Health Check Providerها را فعال کنید.
- Thresholdهای Monitoring را بررسی کنید.
- Routing Strategy را انتخاب کنید.
- `max_clients` و Soft Capacity را در صورت نیاز تنظیم کنید.

Provider در Maintenance Mode وارد Provisioning جدید نمی‌شود.

اگر Circuit Breaker یک Provider باز شود، Routing تا زمان Recovery آن Provider را کنار می‌گذارد.

---

# SSL

وضعیت دامنه و SSL:

```bash
sudo bluegate domain status
```

Repair یا Renew:

```bash
sudo bluegate ssl repair
```

BlueGate مسیر ACME Challenge را در nginx نگه می‌دارد تا تمدید Let's Encrypt دچار مشکل نشود.

---

# تغییر دامنه

BlueGate ابزار Domain Migration دارد.

منو:

```bash
sudo bluegate domain menu
```

یا:

```bash
sudo bluegate domain migrate NEW-DOMAIN
```

این ابزار برای تغییر دامنه می‌تواند nginx، SSL، application config، Telegram webhook و URLهای ذخیره‌شده را هماهنگ کند.

قبل از Domain Migration از صحت DNS دامنه جدید مطمئن شوید.

---

# Backup و Restore

برای دیدن دستورات:

```bash
sudo bluegate help
```

ساخت Backup:

```bash
sudo bluegate backup
```

نمایش Backupها:

```bash
sudo bluegate backups
```

قبل از Updateهای بزرگ یا تغییر Providerها Backup بگیرید.

---

# Update

اگر Repository پروژه در تنظیمات تعریف شده باشد:

```bash
sudo bluegate update
```

یا از wrapper پروژه:

```bash
sudo ./update.sh
```

Update Pipeline به‌صورت خودکار:

1. Preflight انجام می‌دهد.
2. Backup می‌گیرد.
3. Maintenance Mode را فعال می‌کند.
4. نسخه جدید را Deploy می‌کند.
5. Migration را اجرا می‌کند.
6. Permissionها را اصلاح می‌کند.
7. nginx و Cron را Refresh می‌کند.
8. Telegram را Sync می‌کند.
9. Health Check نهایی اجرا می‌کند.
10. Maintenance را خاموش می‌کند.

---

# Repair

اگر فایل‌ها سالم هستند ولی nginx، Cron، Permission، migration یا Webhook مشکل دارد:

```bash
sudo bluegate repair
```

برای بررسی تشخیصی:

```bash
sudo bluegate doctor
```

---

# Logs

منوی Logs:

```bash
sudo bluegate logs
```

نمونه:

```bash
sudo bluegate logs nginx
sudo bluegate logs php
sudo bluegate logs cron
sudo bluegate logs app
sudo bluegate logs bot
```

برای مشکل Provisioning علاوه بر Logها، Provisioning Queue و Route Attempts را از Admin بررسی کنید.

---

# Maintenance Mode

فعال‌کردن:

```bash
sudo bluegate maintenance on
```

غیرفعال‌کردن:

```bash
sudo bluegate maintenance off
```

وضعیت:

```bash
sudo bluegate maintenance status
```

---

# Database

وضعیت:

```bash
sudo bluegate db status
```

اجرای Migration:

```bash
sudo bluegate db migrate
```

Optimize:

```bash
sudo bluegate db optimize
```

Console:

```bash
sudo bluegate db console
```

---

# نکات امنیتی

- `config.php` را عمومی نکنید.
- Bot Token و Provider Tokenها را در Git قرار ندهید.
- `SERVICE_ENCRYPTION_KEY` را بعد از ساخت Providerها بدون برنامه Migration تغییر ندهید؛ Credentialهای Provider با این کلید محافظت می‌شوند.
- Root password و Database password را در پیام یا Screenshot منتشر نکنید.
- TLS Verification Providerها را بدون دلیل غیرفعال نکنید.
- Admin Telegram ID فقط برای افراد مورد اعتماد تعریف شود.
- قبل از Update یا Domain Migration Backup بگیرید.
- `public/install.php` توسط nginx نصب‌شده BlueGate از دسترسی عمومی مسدود می‌شود.
- بعد از نصب همیشه `bluegate health` را اجرا کنید.

---

# عیب‌یابی سریع

## سایت باز نمی‌شود

```bash
sudo systemctl status nginx
sudo nginx -t
sudo bluegate health
sudo bluegate logs nginx
```

## خطای Database

```bash
sudo systemctl status mariadb
sudo bluegate db status
sudo bluegate db migrate
```

## Bot جواب نمی‌دهد

```bash
sudo bluegate telegram status
sudo bluegate telegram webhook-refresh
sudo bluegate logs bot
```

## SSL مشکل دارد

ابتدا DNS را بررسی کنید:

```bash
getent ahostsv4 YOUR-DOMAIN
```

سپس:

```bash
sudo bluegate ssl repair
sudo bluegate domain status
```

## Provisioning انجام نمی‌شود

1. Test Connection Provider را بررسی کنید.
2. Plan Mapping را بررسی کنید.
3. Provider در Maintenance نباشد.
4. Provider ظرفیت داشته باشد.
5. Provisioning Queue را در Admin بررسی کنید.
6. Cron را بررسی کنید:

```bash
sudo bluegate health
sudo bluegate logs cron
```

## بعد از تغییر فایل‌ها یا تنظیمات سیستم

```bash
sudo bluegate repair
sudo bluegate health
```

---

# دستورات کاربردی

```bash
sudo bluegate                 # منوی مدیریتی
sudo bluegate status          # وضعیت کلی
sudo bluegate health          # Health Check
sudo bluegate doctor          # تشخیص و Repair
sudo bluegate repair          # Repair نصب
sudo bluegate update          # Update
sudo bluegate backup          # Backup
sudo bluegate backups         # لیست Backupها
sudo bluegate db status       # وضعیت Database
sudo bluegate db migrate      # Migration
sudo bluegate telegram status # وضعیت Bot/Webhook
sudo bluegate webhook         # Refresh Webhook
sudo bluegate cron            # Repair Cron
sudo bluegate domain status   # وضعیت دامنه
sudo bluegate ssl repair      # Repair SSL
sudo bluegate logs            # Logs
```

---

## پایان نصب

اگر این دستور بدون Fail جدی تمام شود:

```bash
sudo bluegate health
```

و Domain، nginx، MariaDB، Database، Application endpoint و Cronها وضعیت سالم داشته باشند، نصب اصلی BlueGate آماده است.

مرحله بعدی، ورود به Admin، تنظیم روش‌های پرداخت، ساخت Providerها، ساخت Catalog/Planها و ایجاد Plan Mapping برای Auto Provisioning است.

## Installer safety

BlueGate can be installed from an extracted release package without configuring a Git repository. The installer will never remove the application directory merely because `REPO_URL` is empty. If neither a valid local release source nor a non-empty repository URL is available, installation stops without modifying `APP_DIR`.
