<?php
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
<<<<<<< HEAD
header('Pragma: no-cache');
require_once __DIR__.'/../app/license.php';
veyra_license_gate_http('html');

function veyra_free_landing(): void {
    $mini='/miniapp/';
    $upgrade='https://t.me/bluegatesupport';
    $isPro=veyra_license_is_pro();
    $hasWeb=veyra_license_has_feature('web_storefront');
    $module=veyra_pro_core_active();
    $title=(!$isPro || !$hasWeb) ? 'فروشگاه وب در BlueGate Pro' : 'ماژول وب Pro آماده نیست';
    $text=(!$isPro || !$hasWeb)
        ? 'نسخه Free برای فروش و مدیریت داخل Telegram Mini App طراحی شده است.<br>برای فعال‌سازی فروشگاه وب اختصاصی، با پشتیبانی BlueGate تماس بگیر.'
        : 'لایسنس شما دسترسی وب دارد اما ماژول Pro روی این سرور فعال نیست.<br>برای نصب یا بررسی ماژول با پشتیبانی BlueGate تماس بگیر.';
    http_response_code(200);
    header('Content-Type: text/html; charset=UTF-8');
    echo '<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BlueGate Platform</title><style>body{margin:0;background:#090612;color:#f7f3ff;font-family:Tahoma,Arial,sans-serif;min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box}.c{width:min(590px,100%);padding:34px;border:1px solid #39275d;border-radius:28px;background:radial-gradient(circle at 20% 0,#37206199,transparent 44%),#120c20;box-shadow:0 24px 80px #0007;text-align:center}.m{width:72px;height:72px;margin:auto;border-radius:22px;display:grid;place-items:center;background:linear-gradient(135deg,#7c3aed,#a855f7);font-size:34px;font-weight:800}.h{font-size:28px;font-weight:900;margin:20px 0 10px}.p{color:#c9bddb;line-height:2}.a{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:20px}.b{display:inline-flex;padding:14px 20px;border-radius:15px;color:white;text-decoration:none;font-weight:800;border:1px solid #62449a;background:#211535}.b.p{border:0;background:linear-gradient(135deg,#7c3aed,#a855f7)}.s{font-size:12px;color:#8f80a6;margin-top:25px}</style></head><body><main class="c"><div class="m">V</div><div class="h">'.htmlspecialchars($title,ENT_QUOTES).'</div><div class="p">'.$text.'</div><div class="a"><a class="b" href="'.htmlspecialchars($mini,ENT_QUOTES).'">باز کردن Mini App</a><a class="b p" href="'.htmlspecialchars($upgrade,ENT_QUOTES).'" target="_blank" rel="noopener">ارتقا از طریق @bluegatesupport</a></div><div class="s">BlueGate Platform · Built by BlueGate</div></main></body></html>';
    exit;
}

$path='/' . trim((string)(parse_url($_SERVER['REQUEST_URI']??'/',PHP_URL_PATH)?:'/'),'/');
if($path==='//')$path='/';
$allowed=['/','/index.php','/account','/orders','/wallet','/referral','/profile','/admin','/admin/overview','/admin/orders','/admin/catalog','/admin/inventory','/admin/customers','/admin/users','/admin/coupons','/admin/settings','/admin/activity','/admin/roles','/admin/backups'];
if(in_array(rtrim($path,'/')?:'/',$allowed,true)){
    if(!veyra_license_has_feature('web_storefront') || !veyra_pro_core_active()) veyra_free_landing();
    $shell=dirname(__DIR__).'/modules/pro-web/public/index.html';
    if(!is_file($shell)){http_response_code(503);header('Content-Type:text/plain; charset=UTF-8');echo 'BlueGate Pro Web module is not installed. Run: sudo bluegate pro install';exit;}
    header('Content-Type: text/html; charset=UTF-8'); readfile($shell); exit;
}
if(str_starts_with($path,'/web')){require __DIR__.'/web_gate.php';exit;}
header('Location: /',true,302);exit;
=======
header('Cache-Control: post-check=0, pre-check=0', false);
header('Pragma: no-cache');

$path = '/' . trim((string)(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/'), '/');
if ($path === '//') $path = '/';

// Real browser paths handled by the Web History API router.
$allowed = [
    '/', '/index.php',
    '/account', '/orders', '/wallet', '/referral', '/profile',
    '/admin', '/admin/overview', '/admin/orders', '/admin/catalog', '/admin/inventory',
    '/admin/customers', '/admin/users', '/admin/coupons', '/admin/settings', '/admin/activity',
    '/admin/roles', '/admin/backups',
];

if (in_array(rtrim($path, '/') ?: '/', $allowed, true)) {
    $shell = __DIR__ . '/web/index.html';
    if (!is_file($shell)) {
        http_response_code(500);
        echo 'BlueGate Web shell is missing.';
        exit;
    }
    header('Content-Type: text/html; charset=UTF-8');
    readfile($shell);
    exit;
}

// Keep the historical /web/ entry available and avoid turning arbitrary paths into valid pages.
header('Location: /web/' . (!empty($_SERVER['QUERY_STRING']) ? ('?' . $_SERVER['QUERY_STRING']) : ''), true, 302);
exit;
>>>>>>> b06396cb95f094df789e0b021fa8bf0bb21d4b26
