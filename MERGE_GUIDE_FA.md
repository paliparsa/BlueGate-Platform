# معماری یکپارچه BlueGate Platform

BlueGate Platform از **BlueReferral به‌عنوان Backend/API/MySQL** و **BlueGate Storefront V9 به‌عنوان Website اصلی** استفاده می‌کند.

## از نسخه 1.1.0

Website و Portal قدیمی به یک رابط واحد تبدیل شده‌اند:

```text
Website (Storefront + Account + Admin)
              │
              ├── /account
              ├── /orders
              ├── /wallet
              ├── /referral
              ├── /profile
              └── /admin
              │
           api.php
              │
            MySQL
              │
      ┌───────┴────────┐
      │                │
 Telegram Mini App    Bot
 (UI مستقل و حفظ‌شده)
```

`/portal/` دیگر UI مستقل ندارد و فقط Redirect compatibility است.

## قابلیت‌های Dashboard جدید Website

- Login/Register داخل Storefront
- داشبورد حساب و آمار خرید
- سفارش‌ها + Timeline + Delivery
- پرداخت Wallet / Card / Crypto / Telegram Stars
- Coupon و آپلود Receipt
- Wallet transactions / Withdraw / Spin / Missions
- Referral link/code و لیست زیرمجموعه‌ها
- Profile و حذف حساب
- Admin داخل همان Design System شامل:
  - Dashboard فروش
  - مدیریت Order lifecycle و Delivery
  - Product / Variant / Category
  - Inventory
  - Coupons
  - Withdrawals
  - Storefront & Payment settings
  - Rate refresh
  - Broadcast
  - Backup
  - Balance adjustment

## Mini App

Mini App در `/miniapp/` از نظر HTML/CSS/JS عمداً مستقل مانده و ظاهر قبلی آن تغییر نکرده؛ فقط همان API و دیتابیس مشترک Website را مصرف می‌کند.

## Product Engine

Standard / Pro / Emergency / Premium روی `products + product_variants` هستند. Telegram Stars Dynamic Quantity است و مبلغ سمت Server validate و محاسبه می‌شود.

## Supabase

Storefront به Supabase وابسته نیست؛ MySQL + API مرکزی منبع داده واحد هستند.
