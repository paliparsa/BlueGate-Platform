# BlueGate v0.10.5 — Persian Infrastructure & MHSanaei API Update

این نسخه رابط «زیرساخت» و «امکانات پیشرفته» را برای استفاده روزمره ساده و تا حد ممکن فارسی می‌کند و اتصال 3x-ui را با API رسمی جدید MHSanaei هماهنگ می‌کند.

## تجربه کاربری جدید

- صفحه زیرساخت از فرم فنی به جریان ساده «پنل‌ها → اتصال پلن‌ها → صف و مانیتورینگ» تبدیل شده است.
- اتصال پلن در 3x-ui فقط این اطلاعات را می‌خواهد: پنل، Inbound یا Inboundها، حجم، تعداد روز و محدودیت IP.
- Inboundها مستقیم از پنل خوانده می‌شوند و به شکل انتخابی نمایش داده می‌شوند؛ نیازی به وارد کردن دستی ID یا JSON نیست.
- با انتخاب چند Inbound، BlueGate به‌صورت خودکار حالت Multi-Inbound را تشخیص می‌دهد و از Subscription بومی همان 3x-ui استفاده می‌کند.
- گزینه‌های تخصصی فقط برای Marzban و Remnawave نمایش داده می‌شوند.
- Infrastructure و Advanced Features در Web Admin و Mini App فارسی‌تر و هماهنگ‌تر شده‌اند.

## 3x-ui جدید MHSanaei

BlueGate ابتدا از Client API رسمی جدید 3x-ui استفاده می‌کند:

- ساخت Client از `/panel/api/clients/add`
- اتصال یک Client به چند Inbound در همان درخواست
- دریافت و ویرایش Client با endpointهای `/panel/api/clients/...`
- دریافت Traffic و Links از Client API
- Bearer API Token یا Session Login

برای نسخه‌های قدیمی‌تر 3x-ui، مسیر legacy به‌عنوان fallback حفظ شده است.

> محدودیت IP در 3x-ui به فعال و صحیح بودن Fail2ban در سمت پنل نیاز دارد.

## سازگاری داده

تنظیمات قدیمی Mapping حذف نشده‌اند و migration مخرب وجود ندارد. فرم جدید همان فیلدهای backend موجود را با ورودی ساده‌تر تولید می‌کند؛ بنابراین Plan Mappingهای قبلی نیز قابل ویرایش باقی می‌مانند.
