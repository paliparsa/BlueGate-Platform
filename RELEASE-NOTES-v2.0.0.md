# BlueGate Platform v2.0.0 — Catalog v2

## مدل جدید

```text
Store Category
└── Service
    └── Group
        └── Plan
```

- `Group` برای سرویس‌های ساده در UI اختیاری است؛ سیستم از `Default Group` مخفی استفاده می‌کند.
- جداول Legacy یعنی `products` و `product_variants` حذف نمی‌شوند.
- Checkout همچنان Legacy ID واقعی را نگه می‌دارد تا سفارش، انبار و تحویل قبلی نشکنند.
- سفارش‌ها Snapshot مسیر Service / Group / Plan را ذخیره می‌کنند.

## روش Migration بعد از Update

1. قبل از آپدیت از دیتابیس Backup بگیر.
2. فایل‌های نسخه جدید را Deploy کن و `config.php`، `storage/` و `public/uploads/` فعلی را نگه دار.
3. Migration دیتابیس را با Installer پروژه اجرا کن (`public/install.php` / مرحله Database Migration).
4. وارد Web Admin یا Mini App Admin شو و تب **کاتالوگ** را باز کن.
5. **اسکن مجدد** را بزن و پیشنهادها را بررسی کن.
6. موارد سبز/زرد با **اعمال Migration** منتقل می‌شوند؛ موارد قرمز خودکار دست‌کاری نمی‌شوند.
7. موارد `Needs Review` را با نگاشت دستی مرتب کن.
8. بعد از Apply، Storefront از Catalog v2 می‌خواند؛ آیتم‌های Legacy حل‌نشده همچنان قابل مشاهده می‌مانند.

## Organizer

- Web Admin: Tree View + Drag & Drop برای Group و Plan.
- Mini App: Selector ساده برای انتقال Group و Plan.
- Fast Create: ساخت Service + Group + Plan در یک مرحله.
- هیچ Auto Apply بدون Preview/Confirmation از UI انجام نمی‌شود.

## سازگاری

- Website Storefront: Catalog v2
- Mini App Storefront: Catalog v2
- Telegram Bot Store: Catalog v2-compatible adapter
- Sitemap: Catalog v2-compatible
- Orders/Inventory/Delivery: Legacy ID compatible
