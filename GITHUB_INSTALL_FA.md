# نصب BlueGate Platform از GitHub

1. در GitHub یک Repo جدید با نام دقیق `BlueGate-Platform` بساز.
2. تمام فایل‌های این پوشه را در ریشه Repo و branch `main` قرار بده.
3. Repo برای نصب با `git clone` باید Public باشد؛ اگر Private باشد باید روش احراز هویت Git را جدا تنظیم کنی.
4. A Record دامنه/ساب‌دامین تست را به IP VPS وصل کن. اگر Cloudflare داری، هنگام گرفتن SSL بهتر است موقتاً DNS Only باشد.
5. روی VPS این دستور را اجرا کن:

```bash
curl -fsSL https://raw.githubusercontent.com/paliparsa/BlueGate-Platform/main/install.sh -o /tmp/bluegate-install.sh && sudo bash /tmp/bluegate-install.sh --full
```

## اطلاعاتی که Installer می‌پرسد

- Domain بدون `https://`
- Telegram Bot Token
- Bot username بدون `@`
- Telegram numeric Admin ID
- Support username
- Repo URL؛ پیش‌فرض همین `https://github.com/paliparsa/BlueGate-Platform.git` است
- Database name/user؛ پیش‌فرض‌های امن قابل قبول‌اند
- Database password و Webhook secret؛ Installer مقدار تصادفی آماده دارد و با Enter می‌توانی همان را نگه داری
- Brand / Theme
- Resend اختیاری
- SSL

## بعد از نصب

```bash
sudo bluegate --status
sudo bluegate --health
```

صفحات:

- `https://DOMAIN/`
- `https://DOMAIN/portal/`
- `https://DOMAIN/miniapp/`
- `https://DOMAIN/api.php?action=storefront`

## آپدیت از GitHub

هر بار نسخه جدید را Push کردی:

```bash
sudo bluegate --update
```

برای منوی کامل مدیریت:

```bash
sudo bluegate
```
