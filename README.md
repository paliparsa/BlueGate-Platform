> **v2.3.0 Guided Service Flow:** انتخاب سرویس در موبایل به کارت‌های swipe/snap تبدیل شده، سوییچر فقط بعد از ورود به جزئیات Sticky می‌شود و BluePing حالا مسیر واقعی نوع سرویس → پکیج → تایید سفارش دارد.

> **Security build note:** this archive is the Verified-35 variant of v2.2.0. Five previously unverified controls are intentionally excluded; see `RELEASE-NOTES-v2.2.0.md`.
> **v2.3.0 Service Navigation UX:** انتخاب کارت سرویس در Storefront حالا مستقیماً با offset صحیح زیر Header/Service Switcher به جزئیات همان سرویس اسکرول می‌کند؛ مخصوصاً روی موبایل دیگر کاربر بالای بخش محصولات رها نمی‌شود.
>

# BlueGate Platform

> نسخه فعلی: **v2.3.0**  
> هسته یکپارچه فروشگاه BlueGate شامل Website، حساب کاربری، سفارش، کیف پول، Referral، Admin، Telegram Mini App و Telegram Bot روی یک API و یک دیتابیس MySQL/MariaDB.

> **v2.2.0 Security:** احراز هویت وب، دسترسی‌های Admin، callbackهای پرداخت، عملیات مالی همزمان، Telegram Stars/Webhook و مسیرهای Legacy سخت‌سازی شده‌اند. برای جزئیات `RELEASE-NOTES-v2.2.0.md` را ببین.

---

## فهرست

1. [معرفی](#معرفی)
2. [معماری پروژه](#معماری-پروژه)
3. [قابلیت‌های اصلی](#قابلیتهای-اصلی)
4. [مسیرهای Website و Mini App](#مسیرهای-website-و-mini-app)
5. [نیازمندی‌های سرور](#نیازمندیهای-سرور)
6. [نصب خودکار از GitHub](#نصب-خودکار-از-github)
7. [اطلاعاتی که Installer می‌پرسد](#اطلاعاتی-که-installer-میپرسد)
8. [تنظیم Telegram Bot و Mini App](#تنظیم-telegram-bot-و-mini-app)
9. [تنظیم Resend برای ایمیل](#تنظیم-resend-برای-ایمیل)
10. [مدیریت پروژه روی VPS](#مدیریت-پروژه-روی-vps)
11. [آپدیت پروژه](#آپدیت-پروژه)
12. [Catalog Studio v2.1](#catalog-v2-و-organizer)
13. [لایه سازگاری داخلی](#محصولات-دستهبندی-و-variant)

14. [جریان خرید Website در v1.6.0](#جریان-خرید-website-در-v160)
15. [سفارش‌ها و روش‌های پرداخت](#سفارشها-و-روشهای-پرداخت)
16. [تحویل لینک سرویس و Subscription](#تحویل-لینک-سرویس-و-subscription)
17. [Backup و Restore](#backup-و-restore)
18. [انتقال فایل‌های Upload](#انتقال-فایلهای-upload)
19. [مهاجرت از BlueReferral قدیمی](#مهاجرت-از-bluereferral-قدیمی)
20. [امنیت و Permissionها](#امنیت-و-permissionها)
21. [Cloudflare، Nginx و SSL](#cloudflare-nginx-و-ssl)
22. [Troubleshooting](#troubleshooting)
23. [Uninstall](#uninstall)
24. [مسیر فایل‌های مهم](#مسیر-فایلهای-مهم)

---

# معرفی

**BlueGate Platform** نسخه یکپارچه فروشگاه BlueGate است. Backend اصلی بر پایه PHP + MySQL/MariaDB است و Website، Telegram Mini App و Bot همگی از یک دیتابیس و یک API استفاده می‌کنند.

ساختار اصلی پروژه:

```text
Website / Storefront
        │
        ├── Account
        ├── Orders
        ├── Wallet
        ├── Referral
        ├── Profile
        └── Admin
        │
      api.php
        │
      MySQL
        │
   ┌────┴─────┐
   │          │
Mini App   Telegram Bot
```

Website و Portal قدیمی دیگر دو رابط جدا نیستند. `/portal/` فقط برای سازگاری با لینک‌های قدیمی نگه داشته شده و کاربر را به Dashboard جدید هدایت می‌کند.

**Mini App عمداً ظاهر مستقل خودش را حفظ می‌کند** ولی اطلاعات آن با Website مشترک است.

---

# معماری پروژه

BlueGate Platform از بخش‌های زیر تشکیل شده:

- **Storefront Website** برای معرفی و خرید محصولات
- **Account Dashboard** برای کاربر
- **Orders** برای مشاهده سفارش، پرداخت و تحویل
- **Wallet** برای موجودی، تراکنش، برداشت و پاداش
- **Referral / Affiliate** برای همکاری در فروش
- **Admin** برای مدیریت کل فروشگاه
- **Telegram Mini App** با UI مستقل
- **Telegram Bot** برای تعامل تلگرامی، اعلان و مدیریت
- **MySQL/MariaDB** به‌عنوان Source of Truth
- **PHP API** برای ارتباط همه Frontendها

Supabase در نسخه فعلی هسته اصلی پروژه نیست و اطلاعات فروشگاه از MySQL/API مرکزی خوانده می‌شود.

---

# قابلیت‌های اصلی

## فروشگاه و محصول

- Catalog Studio v2.1: Category → Service → Group → Plan
- Wizard پنج‌مرحله‌ای مشترک برای ساخت و ویرایش سرویس‌های فعلی
- Product / Variant قدیمی فقط به‌عنوان لایه سازگاری داخلی و خارج از منوی عادی Admin
- Guided Migration Assistant با Preview، Confidence و Manual Review
- Draft محلی، Preview قبل از انتشار، Undo آخرین تغییر و حذف امن/Archive
- Dynamic product types
- Inventory
- Coupon
- تصویر محصول
- ترتیب نمایش دسته‌ها
- وضعیت فعال/غیرفعال محصول
- VPN Standard / Pro / Emergency
- Telegram Premium
- Telegram Stars با مقدار Dynamic
- محصولات عمومی مثل AI، Music، Subscription و هر محصول جدیدی که از Admin ساخته شود

## حساب کاربری

- Register / Login
- Telegram Login
- Email verification
- Password reset
- Order history
- Wallet
- Referral
- Profile
- حذف حساب

## سفارش

Lifecycle سفارش شامل وضعیت‌هایی مثل:

```text
pending_payment
reviewing
payment_confirmed
preparing
delivered
rejected
canceled
refunded
```

## پرداخت

- Wallet
- Card to Card
- Telegram Stars
- Crypto
- Coupon
- Upload receipt

## ادمین

- Dashboard فروش
- Products
- Variants
- Categories
- Orders
- Inventory
- Users
- Wallet adjustment
- Withdrawals
- Coupons
- Payment settings
- Crypto settings
- Storefront settings
- Broadcast
- Backup / Restore
- Activity log
- Admin roles

---

# مسیرهای Website و Mini App

پس از نصب روی دامنه `example.com`:

```text
https://example.com/              Storefront
https://example.com/web/          Storefront compatibility path
https://example.com/account       Dashboard کاربر
https://example.com/orders        سفارش‌ها
https://example.com/wallet        کیف پول
https://example.com/referral      همکاری در فروش
https://example.com/profile       پروفایل
https://example.com/admin         پنل مدیریت Website
https://example.com/portal/       Redirect سازگاری؛ Portal مستقل نیست
https://example.com/miniapp/      Telegram Mini App
https://example.com/api.php       API اصلی
https://example.com/bot.php       Telegram Webhook
```

---

# نیازمندی‌های سرور

پیشنهاد:

- Ubuntu / Debian جدید
- دسترسی root یا sudo
- حداقل 1GB RAM؛ 2GB بهتر است
- Domain یا Subdomain متصل به VPS
- Port 80 و 443 باز
- GitHub Repo قابل دسترسی از VPS

Installer خودش این موارد را نصب می‌کند:

```text
nginx
mariadb-server
git
curl
unzip
openssl
php-fpm
php-cli
php-mysql
php-curl
php-mbstring
php-xml
certbot
python3-certbot-nginx
```

---

# نصب خودکار از GitHub

Repo اصلی مورد انتظار Installer:

```text
https://github.com/paliparsa/BlueGate-Platform
```

Branch پیش‌فرض:

```text
main
```

قبل از نصب، A Record دامنه را روی IP VPS قرار بده.

سپس روی VPS:

```bash
curl -fsSL https://raw.githubusercontent.com/paliparsa/BlueGate-Platform/main/install.sh \
-o /tmp/bluegate-install.sh && \
sudo bash /tmp/bluegate-install.sh --full
```

Installer این مراحل را انجام می‌دهد:

1. نصب Packageها
2. Clone یا Update Repo
3. ساخت `config.php`
4. ساخت Database و DB User
5. Permissionها
6. Nginx
7. SSL با Certbot
8. Migration / Seed
9. Telegram Webhook
10. Crypto Cron
11. Health Check
12. نصب دستور مدیریتی `bluegate`

مسیر نصب پیش‌فرض:

```text
/var/www/bluegate-platform
```

---

# اطلاعاتی که Installer می‌پرسد

Setup Wizard موارد زیر را می‌خواهد:

```text
Domain
Telegram Bot Token
Bot Username
Admin Telegram IDs
Support Username
GitHub Repository URL
Install Directory
Database Name
Database User
Database Password
Webhook Secret
Brand Name
Theme Color
Force Join Channel (optional)
Resend API Key (optional)
Resend Sender Email (optional)
SSL yes/no
Let's Encrypt Email
```

### Domain

فقط Hostname وارد شود:

```text
shop.example.com
```

نه:

```text
https://shop.example.com/
```

### Admin Telegram IDs

مثال:

```text
123456789,987654321
```

باید Numeric Telegram ID باشند، نه Username.

### Force Join Channel

اختیاری:

```text
@BlueGate
```

برای غیرفعال بودن خالی بگذار.

---

# تنظیم Telegram Bot و Mini App

## Webhook

Installer در نصب کامل Webhook را ست می‌کند.

برای تنظیم مجدد:

```bash
sudo bluegate --webhook
```

## Telegram Login روی Website

برای Login with Telegram باید در `@BotFather` یک‌بار دامنه را ثبت کنی:

```text
/setdomain
```

Bot را انتخاب کن و دامنه را بدون `https://` بده:

```text
example.com
```

## Mini App

URL Mini App به‌صورت زیر ساخته می‌شود:

```text
https://example.com/miniapp/
```

Website و Mini App ظاهر مستقل دارند، ولی User / Order / Wallet / Referral / Products مشترک هستند.

---

# تنظیم Resend برای ایمیل

Resend برای Email Verification و Password Reset استفاده می‌شود.

## API Key

داخل حساب Resend:

```text
API Keys → Create API Key
```

کلید معمولاً به شکل زیر است:

```text
re_xxxxxxxxxxxxxxxxx
```

## Sender Email

Sender Email را خودت انتخاب می‌کنی؛ مثلاً:

```text
noreply@example.com
```

اما دامنه `example.com` باید داخل Resend Verify شده باشد.

پیشنهاد:

```text
BlueGate <noreply@example.com>
```

اگر ایمیل نمی‌خواهی، Resend API Key را خالی بگذار.

---


# پنل مدیریت Website در v1.8.0

از v1.8.0 پنل Admin سایت به سطح قابلیت‌های Admin Mini App ارتقا پیدا کرده و با فونت، فرم و کارت‌های بزرگ‌تر برای دسکتاپ/تبلت/موبایل طراحی شده است.

بخش‌های اصلی:

```text
Dashboard
Orders + Search + Kanban + Bulk Actions + Cleanup
Products + Reorder + Soft/Hard Delete + CSV
Categories + Reorder + Soft/Hard Delete
Variants / Plans
Inventory
Coupons
Withdrawals
Customer 360 + Edit + Balance + Ban
Activity Log
Admin Roles
Settings: General / Payments / Crypto / Appearance / Gamification
Backup Center: Create / Send to Bot / Download / Restore / Upload Restore
Broadcast with optional attachment
Purchase Referral Reward
```

تمام این بخش‌ها از همان API و دیتابیس مشترک Mini App استفاده می‌کنند؛ بنابراین تغییرات Website Admin و Mini App Admin بلافاصله روی یک داده مشترک اعمال می‌شود.

---

# مدیریت پروژه روی VPS

بعد از نصب:

```bash
sudo bluegate
```

منوی مدیریتی شامل:

```text
1) Full install / reinstall
2) Setup wizard
3) Install/repair system packages
4) Clone/update GitHub repository
5) Generate/repair config.php
6) Create/update database
7) Set secure permissions
8) Configure nginx
9) Request/repair SSL
10) Run database migrations
11) Set Telegram webhook
12) Install/repair manager command
13) Update project from GitHub
14) Status / diagnostics
15) Install/repair crypto cron
16) Health check
17) Remove app files only
```

دستورهای سریع:

```bash
sudo bluegate --status
sudo bluegate --health
sudo bluegate --webhook
sudo bluegate --update
sudo bluegate --crypto-cron
```

Log Installer:

```text
/var/log/bluegate-platform-install.log
```

تنظیمات Installer:

```text
/etc/bluegate-platform.env
```

---

# آپدیت پروژه

بعد از Push نسخه جدید روی GitHub:

```bash
sudo bluegate --update
```

Update این کارها را انجام می‌دهد:

1. `git fetch`
2. Reset روی `origin/main`
3. Permission repair
4. Database migrations
5. Nginx repair/reload

بعد از Update:

```bash
sudo bluegate --health
```

اگر Website هنوز فایل‌های قدیمی را نشان می‌دهد:

```text
Ctrl + Shift + R
```

برای Mini App بهتر است آن را کامل ببندی و دوباره از Telegram باز کنی.

### اگر Manager قدیمی یا خراب بود

```bash
curl -fsSL https://raw.githubusercontent.com/paliparsa/BlueGate-Platform/main/install.sh \
-o /tmp/bluegate-install.sh

sudo bash /tmp/bluegate-install.sh --update
```

---

# Catalog v2 و Organizer

از نسخه **v2.0.0** مدل فروشگاه به ساختار زیر ارتقا داده شده است:

```text
Store Category
└── Service
    └── Group
        └── Plan
```

- **Category** فقط قفسه/دسته فروشگاه است.
- **Service** سرویس مادر مثل BluePing، Spotify Premium یا ChatGPT است.
- **Group** نوع یا زیرسرویس مثل Standard / Pro / Individual است.
- **Plan** گزینه واقعی قابل خرید است.
- برای سرویس‌هایی که Group ندارند، یک **Default Group** داخلی ساخته می‌شود و در UI مشتری مخفی می‌ماند.

جداول جدید `store_categories`, `services`, `service_groups`, `service_plans` در کنار جداول Legacy ساخته می‌شوند. `products` و `product_variants` حذف نمی‌شوند و Checkout برای سازگاری همچنان Legacy ID واقعی را نگه می‌دارد. سفارش‌های جدید Snapshot مسیر Service/Group/Plan را ذخیره می‌کنند و هنگام Migration سفارش‌های قدیمی قابل نگاشت نیز Backfill می‌شوند.

در **v2.1.0** مدیریت محصول به **Catalog Studio** تبدیل شده است. ساخت و اصلاح سرویس‌های فعلی هر دو با یک Wizard پنج‌مرحله‌ای انجام می‌شوند: اطلاعات سرویس → مدل انتخاب → زیرسرویس‌ها → پلن‌ها → Preview. برای سرویس‌های ساده، Default Group پشت صحنه می‌ماند و در UI نمایش داده نمی‌شود. Draft فرم به‌صورت محلی نگه‌داری و هنگام بازگشت بازیابی می‌شود، ذخیره‌ی نهایی یک Undo یک‌مرحله‌ای دارد و حذف Group/Plan به‌صورت Archive امن انجام می‌شود تا تاریخچه سفارش‌ها دست‌نخورده بماند.

بخش‌های قدیمی Products / Categories / Variants دیگر در منوی عادی Web Admin یا Mini App نمایش داده نمی‌شوند و مسیرهای قدیمی نیز به Catalog هدایت می‌شوند. جدول‌های Legacy همچنان فقط برای سازگاری Checkout، Inventory و Order history در Backend باقی می‌مانند.

Migration Assistant ابتدا فروشگاه قبلی را Scan می‌کند و پیشنهادها را با سه Confidence نمایش می‌دهد. Auto Apply فقط موارد مطمئن را پس از Preview و تأیید ادمین اعمال می‌کند؛ موارد `Needs Review` در صف اصلاح باقی می‌مانند. روی Desktop جابه‌جایی Group/Plan با Drag & Drop ممکن است و روی موبایل همان عملیات با selector و Sheet ریسپانسیو انجام می‌شود.

تا قبل از تأیید Migration، Storefront از ساختار قبلی استفاده می‌کند. پس از فعال‌شدن Catalog جدید، ساختار نمایش از Catalog Studio خوانده می‌شود ولی آیتم‌های حل‌نشده تا زمان Review از دسترس خارج نمی‌شوند.

---

# محصولات، دسته‌بندی و Variant

> این بخش **لایه سازگاری داخلی** است و در v2.1 از منوی معمول Admin مخفی شده. برای ساخت یا ویرایش محصول از **Catalog Studio** استفاده کن.

Product Engine قدیمی برای سازگاری Checkout، Inventory و سفارش‌های قبلی نگه داشته شده است.

مثال:

```text
Category: AI
Product: ChatGPT Plus
Variants:
- 1 Month
- 3 Months
```

یا:

```text
Category: Music
Product: Spotify Premium
Variants:
- Individual
- Family
```

## دسته‌بندی

Categoryها از دیتابیس خوانده می‌شوند. بخش «سرویس‌های بیشتر» Website در حالت اولیه بسته است و با باز کردن آن، دسته‌بندی‌ها از Database نمایش داده می‌شوند.

فقط محصولات دسته انتخاب‌شده نمایش داده می‌شوند تا Catalog شلوغ نشود.

## VPN

VPNها از Product + Variant استفاده می‌کنند:

```text
BlueGate Standard
BlueGate Pro
BlueGate Emergency
```

هر Package یک Variant است.

## Telegram Stars

Stars مقدار Dynamic دارد و قیمت سمت PHP محاسبه/Validate می‌شود؛ Browser منبع نهایی قیمت نیست.

---

# جریان خرید Website در v1.6.0

از v1.6.0 ثبت سفارش Website دوباره Confirmation نهایی دارد.

Flow:

```text
Product
   ↓
Purchase Confirmation Modal
   ↓
Variant / Package / Stars Selection
   ↓
نمایش قیمت و مشخصات نهایی
   ↓
تایید و ثبت سفارش
   ↓
Create Order
   ↓
Orders
```

تا زمانی که کاربر دکمه نهایی را نزند، Order ساخته نمی‌شود.

## VPN

انتخاب Package دیگر در Stage جداگانه پایین کارت نیست؛ داخل Confirmation Modal انجام می‌شود.

## Premium و محصولات عمومی

Variant داخل همان Confirmation قابل انتخاب است.

## Stars

تعداد Stars داخل Confirmation قابل تغییر است و قیمت Live Update می‌شود.

## Coupon

کد تخفیف اختیاری داخل Confirmation قابل وارد کردن است.

---

# سفارش‌ها و روش‌های پرداخت

در Website همه سفارش‌های کاربر به‌صورت پیش‌فرض **Accordion بسته** هستند.

Summary سفارش فقط اطلاعات اصلی را نشان می‌دهد:

```text
نام محصول
شماره سفارش
مبلغ
وضعیت
```

با باز کردن سفارش، این موارد نمایش داده می‌شوند:

- Timeline وضعیت
- روش پرداخت
- Upload Receipt
- Crypto payment
- Wallet payment
- Telegram Stars
- Customer note
- Delivery
- Subscription link
- Copy/Open service actions

این طراحی باعث می‌شود با زیاد شدن تعداد سفارش‌ها صفحه شلوغ نشود.

---

# تحویل لینک سرویس و Subscription

Admin می‌تواند برای هر سفارش تحویل‌شده یک لینک اختصاصی سرویس ثبت کند.

فیلدهای اصلی:

```text
delivery_url
delivery_title
```

مثال:

```text
https://panel.example.com/sub/xxxxxxxx
```

بعد از Delivery، مشتری داخل Website یا Mini App می‌تواند:

```text
🌐 باز کردن سرویس
📋 کپی لینک ساب
```

را ببیند.

### نکته امنیتی

Subscription URL در عمل شبیه Credential است. هر کسی که لینک را داشته باشد ممکن است بتواند از آن استفاده کند. پس:

- فقط به صاحب سفارش تحویل بده.
- لینک عمومی منتشر نشود.
- در صورت Leak شدن، لینک را از سمت سرویس اصلی Rotate/Replace کن.

BlueGate در نسخه فعلی لینک را مستقیم باز می‌کند؛ Reverse Proxy قدیمی حذف شده چون با بعضی پنل‌ها، CDNها، Cookieها و Anti-Botها سازگاری خوبی نداشت.

---

# Backup و Restore

BlueGate Backup دیتابیس را در فرمت `.json.gz` می‌سازد.

مسیر Backupها روی VPS:

```text
/var/www/bluegate-platform/storage/backups/
```

## ساخت Backup از Admin

داخل Admin → Backup می‌توان Backup ساخت، دانلود یا Restore کرد.

## Backup از Telegram Bot

برای Admin:

```text
/backup
```

سیستم Backup می‌سازد و داخل چت Bot می‌فرستد.

## Restore از Telegram Bot

```text
/restore_backup
```

سپس فایل `.json.gz` را ارسال کن.

قبل از Restore، سیستم تلاش می‌کند یک Safety Backup خودکار بسازد.

## Restore از Website Admin

Admin → Backup → Upload & Restore

یا Restore یکی از Backupهای موجود روی سرور.

### مهم

Restore دیتابیس فعلی را با Backup جایگزین می‌کند. قبل از Restore روی Production حتماً Backup تازه بگیر.

### Backup دیتابیس چه چیزهایی را شامل می‌شود؟

مثل:

- Users
- Referrals
- Transactions
- Withdrawals
- Missions
- Spins
- Payment methods
- Categories
- Products
- Variants
- Orders
- Order events
- Coupons
- Crypto data
- Settings
- Admin logs/roles
- Inventory records

### چه چیزهایی داخل Backup دیتابیس نیست؟

فایل‌های فیزیکی مثل:

```text
public/uploads/
```

همچنین موارد سروری مثل:

```text
config.php
Nginx config
SSL certificates
/etc/bluegate-platform.env
```

پس Backup دیتابیس را با Backup فایل‌های Upload اشتباه نگیر.

---

# انتقال فایل‌های Upload

محصولات ممکن است در دیتابیس فقط مسیر عکس را ذخیره کنند، اما خود فایل تصویر در Disk است.

مسیر فعلی Uploadها:

```text
/var/www/bluegate-platform/public/uploads/
```

برای Backup دستی:

```bash
mkdir -p /root/bluegate-keep
cp -a /var/www/bluegate-platform/public/uploads /root/bluegate-keep/uploads
```

برای Restore:

```bash
mkdir -p /var/www/bluegate-platform/public/uploads

rsync -aHAX --info=progress2 \
/root/bluegate-keep/uploads/ \
/var/www/bluegate-platform/public/uploads/

chown -R www-data:www-data /var/www/bluegate-platform/public/uploads

find /var/www/bluegate-platform/public/uploads \
-type d -exec chmod 750 {} \;

find /var/www/bluegate-platform/public/uploads \
-type f -exec chmod 640 {} \;
```

تعداد فایل‌ها را می‌توان مقایسه کرد:

```bash
echo BACKUP:
find /root/bluegate-keep/uploads -type f | wc -l

echo RESTORED:
find /var/www/bluegate-platform/public/uploads -type f | wc -l
```

---

# مهاجرت از BlueReferral قدیمی

BlueGate Platform از هسته BlueReferral تکامل پیدا کرده و بسیاری از جدول‌های اصلی با آن سازگار هستند.

روش کم‌ریسک:

1. از BlueReferral Backup بگیر.
2. Uploadها را جدا ذخیره کن.
3. BlueGate Platform را Fresh نصب کن.
4. Backup دیتابیس را از Admin/Bot Restore کن.
5. Migration نسخه جدید را اجرا کن.
6. Uploadها را برگردان.
7. Website / Bot / Mini App / Users / Orders / Wallet را تست کن.
8. بعد نسخه قدیمی را حذف کن.

Migration دستی:

```bash
cd /var/www/bluegate-platform
sudo -u www-data php public/install.php
```

`public/install.php` از وب توسط Nginx بسته شده و برای Migration باید از CLI اجرا شود.

### توصیه

تا وقتی نسخه جدید کامل تست نشده، دیتابیس و پوشه BlueReferral قدیمی را حذف نکن.

---

# امنیت و Permissionها

Installer به‌صورت پیش‌فرض:

- `config.php` را داخل Git قرار نمی‌دهد.
- `config.php` را با Permission محدود نگه می‌دارد.
- `public/install.php` را از Web مسدود می‌کند.
- فقط `public/uploads` و `storage` را برای PHP writable می‌کند.
- Webhook Secret و DB Password می‌توانند تصادفی تولید شوند.

Permissionهای پروژه:

```text
Project files: root:www-data
Directories:   750
Files:         640
Uploads:       www-data:www-data
Storage:       www-data:www-data
```

هرگز `config.php`، Bot Token، DB Password یا API Key را داخل Public GitHub Repo Commit نکن.

---

# Cloudflare، Nginx و SSL

## DNS

A Record دامنه باید به Public IP VPS اشاره کند.

چک:

```bash
getent ahostsv4 example.com
curl -4 -s https://api.ipify.org
```

IPها باید مطابق باشند.

## Cloudflare

برای گرفتن SSL اولیه اگر مشکل داشتی، Proxy را موقتاً روی:

```text
DNS Only
```

بگذار.

پس از گرفتن Certificate می‌توان Proxy را دوباره فعال و SSL Mode را روی:

```text
Full (strict)
```

قرار داد.

## SSL

Repair:

```bash
sudo bluegate
```

و گزینه Request/repair SSL.

یا مستقیم:

```bash
certbot --nginx -d example.com
```

## Nginx Test

```bash
nginx -t
systemctl reload nginx
```

## Ports

```bash
ss -lntp | grep -E ':80|:443'
```

---

# Troubleshooting

## وضعیت کلی

```bash
sudo bluegate --status
```

## Health Check

```bash
sudo bluegate --health
```

Health Check موارد اصلی PHP/API و HTTPS را بررسی می‌کند.

## Installer Log

```bash
tail -n 200 /var/log/bluegate-platform-install.log
```

## Nginx

```bash
nginx -t
systemctl status nginx --no-pager
```

## MariaDB

```bash
systemctl status mariadb --no-pager
```

## PHP-FPM Socket

```bash
find /run/php -name 'php*-fpm.sock'
```

## Webhook Bot کار نمی‌کند

Webhook را دوباره ست کن:

```bash
sudo bluegate --webhook
```

بعد Bot را تست کن.

## Website بعد از Update ظاهر قدیمی دارد

```text
Ctrl + Shift + R
```

و در صورت نیاز Cache مرورگر یا Service Worker را پاک کن.

## Mini App ظاهر قدیمی دارد

Mini App را کامل Close کن و دوباره از Telegram باز کن.

فایل واقعی سرو شده را می‌توان بررسی کرد:

```bash
curl -sk https://example.com/miniapp/ | grep -E 'style\.css|app\.js'
```

## عکس‌ها 404 می‌شوند

چک کن فایل‌ها واقعاً موجود باشند:

```bash
find /var/www/bluegate-platform/public/uploads -type f | head
```

و Permissionها:

```bash
chown -R www-data:www-data /var/www/bluegate-platform/public/uploads
```

## Migration

```bash
cd /var/www/bluegate-platform
sudo -u www-data php public/install.php
```

---

# Uninstall

برای حذف فایل‌های App:

```bash
cd /var/www/bluegate-platform
sudo bash uninstall.sh
```

یا از:

```bash
sudo bluegate
```

گزینه Remove app files only.

Uninstall پیش‌فرض این موارد را حذف می‌کند:

- App files
- Nginx site
- Crypto cron

ولی این موارد را نگه می‌دارد:

- Database
- `/etc/bluegate-platform.env`

برای حذف Manager command در صورت نیاز:

```bash
rm -f /usr/local/bin/bluegate
```

**Database را فقط وقتی مطمئن هستی Backup لازم را داری، دستی Drop کن.**

---

# مسیر فایل‌های مهم

```text
/var/www/bluegate-platform/                   Project root
/var/www/bluegate-platform/config.php         Private config
/var/www/bluegate-platform/public/            Web root
/var/www/bluegate-platform/public/uploads/    Uploaded files/images
/var/www/bluegate-platform/public/miniapp/    Telegram Mini App
/var/www/bluegate-platform/storage/backups/   Database backups
/var/www/bluegate-platform/storage/cache/     App cache
/etc/bluegate-platform.env                    Installer/manager state
/etc/nginx/sites-available/bluegate-platform  Nginx config
/etc/cron.d/bluegate-platform                 Crypto cron
/var/log/bluegate-platform-install.log        Installer log
/usr/local/bin/bluegate                       Manager command
```

---

# وضعیت نسخه 1.8.0

مهم‌ترین تغییرات v1.8.0:

- Full Web Admin Parity با پنل Admin Mini App
- Admin Sidebar/Responsive Navigation جدید
- Typography و کنترل‌های بزرگ‌تر در کل Admin
- Customer 360، Activity Log و Admin Roles در Website
- Orders Kanban/List، Bulk Actions، Cleanup، Archive و Receipt Viewer
- مدیریت کامل Product/Category/Variant/Inventory/Coupon با Hard Delete و Reorder
- Backup Send-to-Bot و Upload & Restore از Website
- Broadcast با فایل، Purchase Reward و VIP Rates
- Settings پنج‌بخشی شامل General/Payments/Crypto/Appearance/Gamification

قابلیت‌های خرید و سفارش v1.6.0 نیز حفظ شده‌اند:

- رفع Horizontal Overflow / فضای سیاه اضافه در Mobile Website
- بازگشت Confirmation پیش از ثبت سفارش Website
- طراحی Confirmation بر اساس Invoice UI Mini App
- انتخاب Package VPN داخل Confirmation
- انتخاب Variant محصولات عمومی و Premium داخل Confirmation
- تنظیم مقدار Stars داخل Confirmation
- Coupon داخل Confirmation
- Orders Accordion؛ همه سفارش‌ها در شروع بسته هستند
- Timeline، Payment، Delivery و Subscription actions فقط بعد از باز کردن Order نمایش داده می‌شوند
- Mini App در Flow خرید v1.6.0 عمداً تغییر نکرده است

---

## نکته نهایی

برای Production همیشه قبل از تغییرات بزرگ این دو چیز را جداگانه Backup کن:

```text
1) Database Backup (.json.gz)
2) public/uploads/
```

داشتن فقط یکی از این دو، Backup کامل فروشگاه محسوب نمی‌شود.


## Product hierarchy in v1.8.0

The storefront supports parent/child products. Example:

```text
BluePing (service_group)
├── Standard (vpn)
│   ├── 20 GB
│   ├── 30 GB
│   └── 50 GB
└── Pro (vpn)
    ├── 5 GB
    ├── 10 GB
    └── 20 GB
```

`products.parent_id` links sub-products to a service product. `product_variants` are the purchasable plans. Website rendering is database-driven: names such as Standard/Pro are not used to infer behavior; icon, badge, theme and benefits come from product configuration.

The website is dark-only in v1.8.0. Light mode and its toggle were removed.
