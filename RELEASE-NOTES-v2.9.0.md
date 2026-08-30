# BlueGate Platform v2.9.0 — UI Convergence

## هدف نسخه

این نسخه Feature مالی جدید اضافه نمی‌کند؛ تمرکز روی یکپارچگی تجربه Website، Telegram Mini App و Web Admin است.

## Mini App — Product Purchase

- Product Sheet قدیمی Mini App حذف شد.
- Purchase Dialog جدید از زبان بصری Checkout نسخه Website استفاده می‌کند.
- یک پنجره واحد برای تصویر/نام محصول، انتخاب پلن، مشخصات، توضیحات، قیمت، کد تخفیف، Share، افزودن به سبد و ثبت سفارش.
- روی موبایل Telegram به Bottom Sheet touch-friendly تبدیل می‌شود.
- انتخاب Variant در همان Dialog انجام می‌شود و popup دوم وجود ندارد.
- پیش از ثبت سفارش Product ID و Variant ID با منطق موجود Mini App دوباره validate می‌شوند.
- Flash/Special cards نیز به همین Purchase Dialog هدایت می‌شوند.
- Share از Purchase Dialog به Share Sheet موجود منتقل می‌شود بدون Overlay stacking.

## Mini App — Website Parity

- `web-parity.css` برای نزدیک کردن Surface، Card، Search، Category chips، Flash cards و Bottom Navigation به Website اضافه شد.
- Accent قابل‌تغییر Mini App حفظ شده، اما Glow/Shadowهای اضافه کاهش یافته‌اند.
- Design tokens و UI System نسخه 2.8 همچنان پایه Overlayهای غیرمحصولی هستند.

## Web Admin

- Navigation دسکتاپ به دو گروه «مدیریت فروش» و «ابزار و سیستم» مرتب شد.
- Navigation موبایل به Dashboard / Orders / Catalog / Customers / More جمع شد.
- Inventory، Coupons، Settings، Activity، Roles و Backups داخل More قرار گرفتند.
- native `confirm()` و `prompt()` از Admin اصلی حذف و با Confirm/Prompt اختصاصی BlueGate جایگزین شدند.
- Modal، Form Prompt، Confirm و منوی More زبان طراحی واحد دریافت کردند.
- Modalهای موبایل به Bottom Sheet ریسپانسیو تبدیل شدند.
- Legacy Admin fallback دیگر UI قدیمی دوم را نمایش نمی‌دهد؛ اگر Admin bundle لود نشود پیام خطای واضح نشان داده می‌شود.

## Cache / Version

- Mini App assets شامل `purchase.js`, `purchase.css`, `web-parity.css` در cache versioning پوشش داده شدند.
- Website cache به `bluegate-platform-v2.9.0` ارتقا یافت.

## Validation

- PHP syntax
- JavaScript syntax
- Shell syntax
- CSS brace validation
- Static assertions برای Web-parity Purchase، حذف popup قدیمی Mini App، Admin Confirm/Prompt و Navigation

> قبل از Production deploy از دیتابیس Backup بگیرید. این نسخه منطق مالی Backend و schema پرداخت را تغییر نمی‌دهد.
