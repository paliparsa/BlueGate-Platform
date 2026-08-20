# BlueGate Platform 1.2.0

## Website UI Overhaul

- بازطراحی کامل بخش «سرویس‌های بیشتر» با Product Card واقعی، قیمت واضح، Badge، Variant Chip و CTA مستقل.
- رفع باگ CSS نسخه 1.1 که باعث می‌شد استایل محصولات Generic به‌خاطر `\\n`های literal درست parse نشود.
- بازطراحی مقیاس بصری کل Website App: Dashboard، Orders، Wallet، Referral، Profile و بخش‌های مدیریتی خواناتر شده‌اند.
- افزایش Typography، spacing، touch targetها، radius و hierarchy اطلاعات در کل پنل کاربر.
- Dashboard جدید با Hero، کارت‌های آماری بزرگ‌تر و Quick Actionهای خرید، سفارش، کیف پول و همکاری در فروش.
- Orders با کارت‌های بزرگ‌تر، Status واضح‌تر، Timeline خواناتر و Payment UI جدید.
- روش‌های پرداخت به Payment Cardهای مجزا با آیکون، توضیح، وضعیت انتخاب و پنل جزئیات تبدیل شدند.
- Wallet دارای Balance Hero، summaryهای واضح‌تر و ساختار خواناتر تراکنش/برداشت/ماموریت شده است.
- Referral و Profile از Design System جدید Website استفاده می‌کنند و دیگر ظاهر ریز و فشرده ندارند.

## Responsive / Mobile / Tablet

- Mobile-first pass کامل برای Website و Member App.
- Bottom Navigation مخصوص حساب روی موبایل با safe-area support.
- Card list برای سفارش‌ها و چینش تک‌ستونه برای فرم‌ها روی موبایل.
- CTAها و کنترل‌ها حداقل touch target بزرگ‌تر دارند.
- Tablet layout مستقل: محصولات Generic دو ستونه، Dashboard stats دو در دو و payment cards دو ستونه.
- Breakpointهای جدا برای 1100px، 820px، 560px و 390px.
- انیمیشن‌ها با `prefers-reduced-motion` سازگارند.

## Motion & polish

- Entrance animation نرم برای Product Cardها و پنل‌های Dashboard.
- Hover lift و border/glow subtle برای کارت‌ها و CTAها در دستگاه‌های pointer-based.
- Reveal animation برای جزئیات روش پرداخت.
- Motion روی موبایل به تعاملات touch وابسته نشده و hover-only effectها فقط روی دستگاه مناسب فعال می‌شوند.

## Mini App

- ظاهر و فایل‌های Telegram Mini App عمداً بدون تغییر باقی مانده‌اند.
- Mini App همچنان Frontend مستقل خودش را دارد و فقط Backend/Data مشترک است.
