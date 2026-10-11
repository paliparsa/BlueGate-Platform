# BlueGate Platform

BlueGate یک پلتفرم یکپارچه برای فروش و مدیریت محصولات دیجیتال و سرویس‌های VPN است.

## وضعیت فعلی

- هسته PHP با فروشگاه وب و Telegram Mini App
- ربات تلگرام، Webhook و پنل مدیریت
- کاتالوگ، محصولات، سفارش‌ها، کیف پول و کد تخفیف
- پرداخت کارت‌به‌کارت، Telegram Stars، کریپتو و SwapWallet
- Provisioning خودکار و مدیریت سرویس‌های VPN
- Providerهای 3x-UI/X-UI، Marzban و Remnawave
- Monitoring، Health Check، Routing و Failover
- Referral، مأموریت‌ها، Lucky Wheel و اعلان‌های کاربری
- نقش‌ها، Audit Log، محدودیت دسترسی و رمزگذاری Credentialها
- نصب، migration، update و backup از طریق CLI

### Backup و به‌روزرسانی

در `bluegate update`، فایل‌های قابل‌بازسازی مانند cache و log و همچنین
`public/uploads` در آرشیو فایل backup قرار نمی‌گیرند. فایل‌های upload هنگام
restore نیز عمداً حفظ می‌شوند؛ بنابراین حذف آن‌ها از آرشیو باعث سریع‌تر و
کوچک‌تر شدن backup می‌شود و rollback کد و database همچنان انجام می‌شود.

## نسخه و انتشار

نسخه رسمی فقط در فایل `VERSION` نگهداری می‌شود. برای ساخت بسته انتشار، از `./make-release.sh` استفاده کنید؛ نام پوشه و ZIP از `VERSION` ساخته می‌شوند.

نسخه ماژول Pro مستقل از نسخه پلتفرم است و در `modules/pro-core/module.json` و `modules/pro-web/module.json` تعریف می‌شود.

جزئیات تغییرات تاریخی در `CHANGELOG.md` ثبت شده است.
