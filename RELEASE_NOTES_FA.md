# BlueGate Platform 1.5.0

## Direct Service Delivery

- Secure reverse-proxy Viewer نسخه 1.4 حذف شد. لینک تحویل همان URL مستقیم HTTPS است که ادمین برای سفارش ثبت می‌کند.
- لینک مستقیم فقط برای سفارش تحویل‌شده و فقط داخل payload حساب مالک همان سفارش نمایش داده می‌شود.
- کاربر در Website و Mini App دو اکشن دارد: **باز کردن سرویس** و **کپی لینک ساب**.
- Website لینک را مستقیم داخل Phone Modal باز می‌کند و دکمه‌های Copy، Open Direct، Reload و Close دارد.
- Mini App لینک را مستقیم داخل Viewer تمام‌صفحه باز می‌کند؛ Overlay به `documentElement` متصل شده و ارتفاعش با Visual Viewport/Telegram viewport تنظیم می‌شود تا پایین صفحه یا داخل layout قبلی گیر نکند.
- اگر مقصد با `X-Frame-Options` یا `CSP frame-ancestors` نمایش داخل iframe را ببندد، دکمه ↗ همان URL را مستقیماً در مرورگر تلگرام/تب جدید باز می‌کند.
- URL فقط `https://` پذیرفته می‌شود و localhost / IPهای private-reserved رد می‌شوند.
- `service_viewer_ticket` برای سازگاری با cache نسخه 1.4 باقی مانده، اما دیگر Ticket/Proxy تولید نمی‌کند و همان لینک مستقیم را به مالک سفارش برمی‌گرداند.

## علت مشکل Viewer قبلی

Viewer v1.4 صفحه مقصد را با cURL از خود VPS دریافت و HTML/CSS/redirectها را rewrite می‌کرد. این روش برای لینک‌هایی که Cloudflare/anti-bot دارند، فقط IPv6 هستند، به Cookie/JavaScript/WebSocket وابسته‌اند یا پاسخ متفاوت به درخواست server-side می‌دهند می‌تواند 502 بدهد. در v1.5 این لایه حذف شده و مرورگر کاربر مستقیماً مقصد را باز می‌کند.

## Database

Migration جدیدی لازم نیست؛ ستون‌های `delivery_url` و `delivery_title` نسخه 1.4 استفاده می‌شوند.

## Upgrade

```bash
sudo bluegate --update
sudo bluegate --health
```

بعد از آپدیت Website را Hard Refresh و Mini App را کامل ببند و دوباره باز کن.
