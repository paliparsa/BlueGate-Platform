# آپدیت BlueGate Platform به v1.5.2

این نسخه ظاهر Service Viewer مینی‌اپ را با Phone Viewer سایت یکسان می‌کند.

## تغییرات

- Viewer تمام‌صفحه قبلی Mini App حذف شد.
- همان طراحی Phone Modal سایت به Mini App منتقل شد: قاب تیره، گوشه‌های گرد، toolbar، دکمه‌های Copy / Open / Reload / Close.
- اندازه Viewer بر اساس viewport واقعی Telegram تنظیم می‌شود و روی صفحه‌های کوچک یا کوتاه خودکار کوچک‌تر می‌شود.
- Bottom Navigation و Topbar هنگام باز بودن Viewer مخفی می‌شوند.
- پیام fallback بزرگ که روی محتوای ساب می‌افتاد حذف شد و فقط یک hint کوچک و غیرمزاحم نمایش داده می‌شود.
- لینک ساب همچنان قابل کپی و باز شدن مستقیم است.
- بارگذاری iframe بعد از زمان کوتاه از حالت Spinner خارج می‌شود تا محتوای قابل استفاده پشت لودر نماند.

## آپدیت

```bash
sudo bluegate --update
sudo bluegate --health
```

بعد Mini App را کامل ببندید و دوباره از Bot باز کنید.
