# آپدیت BlueGate Platform به v1.4.0

این نسخه Secure Service Viewer را اضافه می‌کند و دیتابیس را بدون حذف کاربران یا سفارش‌های قبلی ارتقا می‌دهد.

## روش استاندارد

بعد از جایگزین کردن فایل‌های v1.4.0 روی branch `main` رپوی GitHub:

```bash
sudo bluegate --update
sudo bluegate --health
```

`--update` به‌صورت خودکار این کارها را انجام می‌دهد:

1. Pull آخرین نسخه از GitHub
2. اصلاح Permissionها
3. اجرای Migration دیتابیس
4. بازسازی/بررسی Nginx

ستون‌های جدید `orders.delivery_url` و `orders.delivery_title` به‌صورت امن اضافه می‌شوند و داده‌های قبلی باقی می‌مانند.

## اگر دستور bluegate نسخه قدیمی است

```bash
curl -fsSL https://raw.githubusercontent.com/paliparsa/BlueGate-Platform/main/install.sh -o /tmp/bluegate-install.sh
sudo bash /tmp/bluegate-install.sh --update
sudo bluegate --health
```

## بعد از آپدیت

روی Website یک Hard Refresh انجام بده:

- Windows/Linux: `Ctrl + Shift + R`
- macOS: `Cmd + Shift + R`

Mini App را هم یک بار کامل ببند و دوباره از تلگرام باز کن.

## تست قابلیت جدید

1. به `/admin` برو.
2. یک سفارش VPN را پیدا کن.
3. روی `🌐 لینک سرویس` بزن.
4. URL اصلی Subscription/Panel را با `https://` وارد کن.
5. عنوان دکمه، مثلاً `مدیریت سرویس` را وارد کن.
6. ذخیره کن.

سفارش در صورت نیاز Delivered می‌شود. مشتری در Website و Mini App دکمه `🌐 باز کردن سرویس` خواهد دید.

لینک اصلی سرویس در payload عمومی سفارش نمایش داده نمی‌شود. Viewer با Ticket کوتاه‌عمر، کنترل مالکیت سفارش و Proxy امن کار می‌کند.
