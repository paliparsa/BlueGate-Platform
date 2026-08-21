# BlueGate Platform v2.1.0 — Catalog Studio UX

## هدف این نسخه

v2.1 ساختار داده‌ی Catalog v2 را حفظ می‌کند، اما تجربه مدیریت محصول را از حالت فنی و Legacy-oriented به یک **Catalog Studio مرحله‌به‌مرحله** تبدیل می‌کند.

## تجربه جدید Admin

- حذف Products / Categories / Variants قدیمی از منوی عادی Web Admin و Mini App.
- مسیرهای قدیمی مدیریت محصول به Catalog Studio هدایت می‌شوند.
- یک Wizard مشترک ۵ مرحله‌ای برای **ساخت و ویرایش محصولات فعلی**:
  1. اطلاعات سرویس و دسته فروشگاه
  2. انتخاب ساختار Direct یا Grouped
  3. ساخت/ویرایش زیرسرویس‌ها
  4. ساخت/ویرایش پلن‌ها
  5. Preview و انتشار
- Default Group در سرویس‌های Direct کاملاً پشت صحنه است.
- کارت‌های سرویس با وضعیت، تعداد زیرسرویس، تعداد پلن و نمای ساختار.
- Desktop: Drag & Drop برای جابه‌جایی Group و Plan.
- Mobile/Mini App: Sheet تک‌ستونه، کنترل‌های لمسی و انتقال با selector.
- Empty state، microcopy و خطاهای فارسی و قابل‌فهم.

## ویرایش و ایمنی داده

- همان Wizard ساخت برای اصلاح سرویس‌های موجود با داده‌های از قبل پرشده استفاده می‌شود.
- حذف Group یا Plan از Wizard، Delete واقعی نیست: آیتم **Archive** می‌شود و سفارش‌های قبلی سالم می‌مانند.
- غیرفعال‌کردن Plan با Archive فرق دارد؛ Plan غیرفعال همچنان قابل ویرایش و فعال‌سازی مجدد است.
- Duplicate detection برای Service / Group / Plan.
- Mirrorهای Legacy با وضعیت Service/Group همگام می‌شوند تا آیتم‌های قدیمی به‌صورت جداگانه دوباره در Storefront ظاهر نشوند.
- Checkout و Inventory همچنان Legacy ID واقعی را برای سازگاری نگه می‌دارند.

## Draft / Preview / Undo

- Wizard در Web و Mini App هنگام حرکت بین مراحل Draft محلی ذخیره می‌کند.
- Draft نیمه‌کاره هنگام بازکردن دوباره همان سرویس بازیابی می‌شود.
- مرحله Preview قبل از انتشار ساختار مشتری را نمایش می‌دهد.
- آخرین Create/Edit کاتالوگ یک Undo یک‌مرحله‌ای دارد.
- تاریخچه تغییرات در Activity Log ثبت می‌شود.

## Migration Assistant

- Scan + Preview + Apply همچنان غیرمخرب است.
- موارد High/Medium پس از تأیید قابل اعمال‌اند.
- Needs Review جداگانه برای تصمیم دستی باقی می‌ماند.
- بخش Legacy به‌عنوان صفحه مدیریت مستقل نمایش داده نمی‌شود؛ فقط صف موارد حل‌نشده در Catalog Studio دیده می‌شود.

## Database migration

دو ستون امن و idempotent اضافه می‌شوند:

```text
service_groups.is_archived
service_plans.is_archived
```

`migrate()` آن‌ها را برای نصب‌های قبلی اضافه می‌کند. دیتای قدیمی حذف نمی‌شود.

## روش آپدیت

قبل از آپدیت از دیتابیس و Uploadها بکاپ بگیر. سپس همان Update معمول پروژه را اجرا کن. `migrate()` هنگام اجرا Schema جدید را بدون حذف جدول‌های قدیمی اعمال می‌کند.

بعد از ورود به Admin:

```text
Catalog Studio
→ در صورت نیاز Migration Assistant
→ بررسی سرویس‌ها
→ مدیریت و ویرایش
→ Preview
→ ذخیره تغییرات
```

فایل‌های Legacy در Backend عمداً حذف نشده‌اند؛ فقط از UX روزمره خارج شده‌اند تا Checkout، Inventory و Order history شکسته نشوند.
