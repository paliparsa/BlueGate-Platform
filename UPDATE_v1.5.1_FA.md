# آپدیت BlueGate Platform به v1.5.1

این نسخه یک Hotfix برای Service Viewer نسخه 1.5 است.

## تغییرات

- Viewer سایت از `dialog.showModal()` استفاده می‌کند تا همیشه بالاتر از تمام UI باز شود.
- Spinner سایت دیگر بی‌نهایت باقی نمی‌ماند؛ بعد از زمان کوتاه خودکار کنار می‌رود و iframe نمایش داده می‌شود.
- سازگاری iframe برای پنل‌های Subscription بیشتر شده است (clipboard، modal، fullscreen، storage access و top-navigation با تعامل کاربر).
- Viewer مینی‌اپ به native dialog top-layer منتقل شد؛ Bottom Navigation و Topbar زیر آن پنهان می‌شوند.
- Viewer مینی‌اپ تمام viewport تلگرام را می‌گیرد و دیگر داخل flow صفحه سفارش قرار نمی‌گیرد.
- دکمه‌های «کپی لینک» و «باز کردن مستقیم» هم در toolbar و هم fallback در دسترس هستند.
- Cache buster سایت و Mini App تغییر کرده تا نسخه قدیمی CSS/JS در Telegram یا Service Worker باقی نماند.

## آپدیت

```bash
sudo bluegate --update
sudo bluegate --health
```

بعد از آپدیت، Website را Hard Refresh کنید و Mini App را کامل ببندید و دوباره باز کنید.
