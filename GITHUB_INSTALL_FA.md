# نصب BlueGate Platform از GitHub

1. Repo جدید `BlueGate-Platform` را در GitHub بساز.
2. محتویات پروژه را در root و branch `main` قرار بده.
3. A Record دامنه/ساب‌دامین را به IP VPS وصل کن. برای گرفتن SSL اگر Cloudflare داری می‌توانی موقتاً DNS Only کنی.
4. روی VPS اجرا کن:

```bash
curl -fsSL https://raw.githubusercontent.com/paliparsa/BlueGate-Platform/main/install.sh -o /tmp/bluegate-install.sh && sudo bash /tmp/bluegate-install.sh --full
```

## بعد از نصب

```bash
sudo bluegate --status
sudo bluegate --health
```

مسیرهای تست:

- `https://DOMAIN/`
- `https://DOMAIN/account`
- `https://DOMAIN/orders`
- `https://DOMAIN/wallet`
- `https://DOMAIN/referral`
- `https://DOMAIN/admin`
- `https://DOMAIN/miniapp/`
- `https://DOMAIN/api.php?action=storefront`

`/portal/` فقط برای لینک‌های قدیمی نگه داشته شده و به Dashboard جدید Redirect می‌شود.

## آپدیت

بعد از Push نسخه جدید:

```bash
sudo bluegate --update
```

برای منوی کامل:

```bash
sudo bluegate
```

## ورود با Telegram در Website

برای اینکه دکمه **Login with Telegram** روی سایت کار کند، بعد از نصب در `@BotFather` این کار را یک‌بار انجام بده:

1. دستور `/setdomain`
2. بات BlueGate را انتخاب کن.
3. دامنه سایت را بدون `https://` وارد کن؛ مثال: `tststs.asgharpay.tr`

این تنظیم فقط برای Login Widget وب است و با Webhook/Mini App تداخلی ندارد.

## آپدیت از نسخه 1.0.0 نصب‌شده

اگر سرور هنوز Installer نسخه 1.0.0 را دارد، برای اولین آپدیت به 1.1.0 بهتر است خود Installer جدید را مستقیم اجرا کنی تا باگ Nginx قدیمی هم در همان اجرا تعمیر شود:

```bash
curl -fsSL https://raw.githubusercontent.com/paliparsa/BlueGate-Platform/main/install.sh -o /tmp/bluegate-install.sh && sudo bash /tmp/bluegate-install.sh --update
```

بعد از آن، آپدیت‌های معمولی دوباره با این دستور کافی است:

```bash
sudo bluegate --update
```
