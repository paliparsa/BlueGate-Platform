<?php
// v1.5 compatibility tombstone: the old server-side reverse proxy was retired.
http_response_code(410);
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Content-Type: text/html; charset=utf-8');
?><!doctype html><html lang="fa" dir="rtl"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>BlueGate</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#07111e;color:#eef6ff;font-family:Tahoma,Arial,sans-serif;padding:24px;box-sizing:border-box}.box{max-width:430px;border:1px solid #20364f;background:#0c1828;border-radius:24px;padding:28px;text-align:center}p{color:#9eb1c9;line-height:1.9}a{color:#54aaff}</style></head><body><div class="box"><h2>Viewer قدیمی بازنشسته شده</h2><p>برای باز کردن لینک مستقیم سرویس، به صفحه سفارش‌های خودت برگرد و روی «باز کردن سرویس» بزن.</p><a href="/orders">رفتن به سفارش‌ها</a></div></body></html>
