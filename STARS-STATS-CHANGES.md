# Stars stats (admin only) — v5.0.15

نمایش موجودی بات و مجموع خریدهای Telegram Stars در داشبورد ادمین (Mini App و وب).

- API: اکشن `admin_stars_stats` (مجوز `dashboard`، rate limit: ۳۰ درخواست در دقیقه). پارامتر `refresh=1` موجودی را از تلگرام دوباره می‌گیرد (حداقل فاصله ۱۰ ثانیه).
- موجودی بات: `getMyStarBalance`، کش ۶۰ ثانیه‌ای در `settings.stars_balance_cache`. در صورت خطا فقط در لاگ سرور ثبت می‌شود.
- مجموع فروش: رکوردهای `orders` و `credit_topups` که `stars_charge_id` دارند.
- ستون جدید `stars_paid_at` در هر دو جدول (migration + backfill خودکار با `bluegate update` یا `bluegate migrate`). تا قبل از migration، آمار بازه‌ای از `created_at`/`credited_at` حساب می‌شود.
- ثبت `stars_paid_at` بعد از commit تراکنش پرداخت و best-effort انجام می‌شود تا مسیر پرداخت را تحت تأثیر قرار ندهد.
- فرانت: کارت در `public/miniapp/app.js` و `modules/pro-web/public/js/admin.js` (کپی در `public/web/js/admin.js`).
- بعد از آپدیت: `bluegate update` (یا `bluegate migrate`) و بعد یک بار رفرش کامل Mini App/وب.
- تست نشده: PHP روی محیط ساخت نبود؛ قبل از پروداکشن `find . -name '*.php' -exec php -l {} \;`.
