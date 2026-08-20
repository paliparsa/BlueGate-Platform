# BlueGate Platform 1.4.0

## Secure Service Viewer

- برای هر سفارش یک **لینک امن سرویس / Subscription** قابل ثبت توسط ادمین اضافه شد.
- لینک اصلی سرویس در payload کاربر یا UI عمومی ارسال نمی‌شود؛ کاربر فقط یک Ticket کوتاه‌عمر برای Viewer دریافت می‌کند.
- Viewer قبل از نمایش، مالکیت سفارش، وضعیت `delivered` و وجود لینک سرویس را بررسی می‌کند.
- URLهای سرویس فقط با HTTPS پذیرفته می‌شوند و مقصدهای private/reserved/localhost برای جلوگیری از SSRF مسدود هستند.
- درخواست Viewer از سرور BlueGate عبور می‌کند و DNS مقصد به IP عمومی pin می‌شود. لینک‌های داخلی صفحه به URLهای رمز‌شده و موقت Viewer تبدیل می‌شوند.
- Website: دکمه «🌐 باز کردن سرویس» داخل سفارش اضافه شده و صفحه سرویس در Phone Modal امن باز می‌شود؛ روی موبایل Viewer تمام‌صفحه است.
- Mini App: همان دکمه داخل جزئیات سفارش اضافه شده و Viewer تمام‌صفحه داخل خود Mini App باز می‌شود؛ کاربر از Mini App خارج نمی‌شود.
- Admin Website و Admin Mini App هر دو امکان ثبت `delivery_url`، عنوان دکمه و پیام تحویل را برای هر سفارش دارند. ثبت لینک امن، سفارش را در صورت نیاز Delivered می‌کند و بدون افشای URL به کاربر تلگرام اطلاع می‌دهد.
- تحویل متنی قبلی همچنان برای محصولات غیر VPN و تحویل‌های معمولی حفظ شده است.

## Database migration

دو ستون جدید به جدول `orders` اضافه می‌شود:

- `delivery_url`
- `delivery_title`

Migration در `sudo bluegate --update` به‌صورت خودکار و بدون حذف داده‌های قبلی اجرا می‌شود.

## ارتقا

بعد از Push نسخه جدید روی GitHub:

```bash
sudo bluegate --update
sudo bluegate --health
```

سپس یک Hard Refresh روی Website انجام بده. برای تست، یک سفارش را از Admin باز کن، «لینک سرویس» را بزن و URL HTTPS پنل/ساب را ثبت کن.

> نکته: Viewer برای صفحه‌های Subscription معمولی و صفحات server-rendered طراحی شده است. اگر صفحه مقصد شدیداً به JavaScript، WebSocket، Cookie یا APIهای cross-origin وابسته باشد ممکن است برای همان پنل نیاز به سازگارسازی اختصاصی داشته باشد.
