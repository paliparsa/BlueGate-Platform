<?php
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
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

function bg_asset_version(string $file): string {
    return is_file($file) ? (string)filemtime($file) : '0';
}

function bg_versioned_shell(string $shell): string {
    $html = (string)@file_get_contents($shell);
    if ($html === '') return $html;
    $shellDir = dirname($shell);
    $pubDir = __DIR__;
    $out = preg_replace_callback(
        '#((?:href|src)=["\'])([^"\']+?)(?:\?v=[^"\']*)?(["\'])#',
        function (array $m) use ($shellDir, $pubDir): string {
            $url = $m[2];
            $path = parse_url($url, PHP_URL_PATH) ?: $url;
            $file = null;
            if ($path === '/design-system.css') $file = $pubDir . '/design-system.css';
            elseif (str_starts_with($path, '/web/')) $file = $shellDir . '/' . substr($path, 5);
            elseif (!str_contains($path, '://') && !str_starts_with($path, '/')) $file = $shellDir . '/' . ltrim($path, '/');
            if (!$file || !is_file($file)) return $m[0];
            return $m[1] . $url . '?v=' . bg_asset_version($file) . $m[3];
        }, $html
    );
    return $out ?? $html;
}

$path='/' . trim((string)(parse_url($_SERVER['REQUEST_URI']??'/',PHP_URL_PATH)?:'/'),'/');
if($path==='//')$path='/';
$allowed=['/','/index.php','/account','/orders','/wallet','/referral','/profile','/admin','/admin/overview','/admin/orders','/admin/catalog','/admin/inventory','/admin/customers','/admin/users','/admin/coupons','/admin/settings','/admin/activity','/admin/roles','/admin/backups'];
if(in_array(rtrim($path,'/')?:'/',$allowed,true)){
    // Web storefront always available in unrestricted mode
    // if(!veyra_license_has_feature('web_storefront') || !veyra_pro_core_active()) veyra_free_landing();
    $shell=dirname(__DIR__).'/modules/pro-web/public/index.html';
    if(!is_file($shell)) $shell=__DIR__.'/web/index.html';
    if(!is_file($shell)){http_response_code(503);header('Content-Type:text/plain; charset=UTF-8');echo 'BlueGate Pro Web module is not installed. Run: sudo bluegate pro install';exit;}
    header('Content-Type: text/html; charset=UTF-8'); echo bg_versioned_shell($shell); exit;
}
if(str_starts_with($path,'/web')){require __DIR__.'/web_gate.php';exit;}
header('Location: /',true,302);exit;
