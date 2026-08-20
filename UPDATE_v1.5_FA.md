# آپدیت BlueGate Platform به v1.5.0

1. فایل‌های این نسخه را روی branch `main` رپوی `BlueGate-Platform` Push کن.
2. روی VPS اجرا کن:

```bash
sudo bluegate --update
sudo bluegate --health
```

3. Website: `Ctrl + Shift + R` بزن.
4. Mini App تلگرام را کامل Close و دوباره Open کن تا JavaScript/CSS قدیمی cache نباشد.

برای تست: یک سفارش Delivered با `delivery_url` باز کن. باید دو دکمه «باز کردن سرویس» و «کپی لینک ساب» دیده شود.
