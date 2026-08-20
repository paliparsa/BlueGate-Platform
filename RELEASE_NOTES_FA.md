# BlueGate Platform 1.1.0

## Unified Website

- حذف UI مستقل Portal و انتقال Account/Admin به Storefront V9
- اضافه شدن routeهای account/orders/wallet/referral/profile/admin
- Redirect لینک‌های قدیمی `/portal/`
- حفظ کامل UI Mini App بدون تغییر فایل
- پرداخت Crypto و Telegram Stars از Website بدون نیاز به Portal
- Admin اصلی داخل Website: محصولات، Variant، انبار، سفارش، Coupon، برداشت، تنظیمات، Broadcast و Backup

## Installer fixes

- رفع `try_files directive is duplicate` در Nginx config
- رفع گزارش اشتباه `failed with exit code 0`
- Health check HTTPS با loopback `--resolve` به‌جای وابستگی به DNS hairpin
- Status/Install output به مسیر جدید Account اشاره می‌کند

## تکمیل‌های نهایی

- محصولات عادی ساخته‌شده از Admin به‌صورت خودکار در Storefront وب نمایش داده می‌شوند.
- ورود با Telegram Login Widget به Website اضافه شد تا حساب وب/Bot/Mini App یکی باشد.
- پرداخت Telegram Stars برای حساب‌های صرفاً وبی تا زمان ورود با Telegram غیرفعال و شفاف نمایش داده می‌شود.
- برای Telegram Login لازم است دامنه با `/setdomain` در BotFather ثبت شود.
