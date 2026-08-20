<?php
require_once __DIR__ . '/../app/bootstrap.php';
require_once __DIR__ . '/../app/service_viewer.php';

header('Cache-Control: private, no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header('X-Frame-Options: SAMEORIGIN');
header("Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()");

function sv_fail(string $message, int $code=403): never {
    http_response_code($code);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="fa" dir="rtl"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#08111f;color:#e8f0ff;font-family:Tahoma,Arial,sans-serif;display:grid;place-items:center;min-height:100vh;padding:24px;box-sizing:border-box}.box{max-width:420px;text-align:center;padding:28px;border:1px solid #24364f;border-radius:24px;background:#0d1929;box-shadow:0 20px 60px #0006}.ico{font-size:42px}h2{font-size:18px;margin:14px 0 8px}p{font-size:14px;line-height:1.9;color:#aabbd0}</style></head><body><div class="box"><div class="ico">🔒</div><h2>نمایش امن سرویس</h2><p>'.htmlspecialchars($message,ENT_QUOTES,'UTF-8').'</p></div></body></html>';
    exit;
}

$ticket = trim((string)($_GET['ticket'] ?? ''));
$tp = bg_sv_verify_ticket($ticket);
if (!$tp) sv_fail('دسترسی منقضی یا نامعتبر است. از صفحه سفارش دوباره روی «باز کردن سرویس» بزن.', 401);

$orderId=(int)$tp['o']; $userId=(int)$tp['u'];
$order=order_by_id($orderId);
if(!$order || (int)$order['user_id'] !== $userId) sv_fail('این سرویس برای حساب شما نیست.',403);
if(normalize_order_status((string)$order['status']) !== 'delivered' || empty($order['delivery_url'])) sv_fail('سرویس هنوز برای این سفارش فعال نشده است.',404);

$remote = (string)$order['delivery_url'];
if (!empty($_GET['r'])) {
    $unsealed=bg_sv_unseal_url((string)$_GET['r'],$orderId);
    if(!$unsealed) sv_fail('درخواست داخلی سرویس نامعتبر یا منقضی است.',401);
    $remote=$unsealed;
}

try {
    $res=bg_sv_fetch($remote);
    $ctype=strtolower((string)$res['content_type']);
    $allowed = str_starts_with($ctype,'text/') || str_starts_with($ctype,'image/') || str_starts_with($ctype,'font/')
        || str_contains($ctype,'javascript') || str_contains($ctype,'json') || str_contains($ctype,'xml')
        || str_contains($ctype,'pdf') || str_contains($ctype,'woff') || str_contains($ctype,'octet-stream');
    if(!$allowed) throw new RuntimeException('SERVICE_CONTENT_TYPE_BLOCKED');

    $body=(string)$res['body'];
    if(str_contains($ctype,'application/octet-stream') && !str_contains($body, "\0")) { $res['content_type']='text/plain; charset=utf-8'; $ctype='text/plain'; }
    $final=(string)$res['url'];
    $exp=(int)$tp['e'];
    if(str_contains($ctype,'text/html') || str_contains($ctype,'application/xhtml+xml')) {
        $body=bg_sv_rewrite_html($body,$final,$ticket,$orderId,$exp);
        header("Content-Security-Policy: default-src 'self' data: blob:; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; font-src 'self' data:; connect-src 'self'; frame-src 'self'; media-src 'self' data: blob:; form-action 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'self'");
    } elseif(str_contains($ctype,'text/css')) {
        $body=bg_sv_rewrite_css($body,$final,$ticket,$orderId,$exp);
    }
    header('Content-Type: '.$res['content_type']);
    header('Content-Disposition: inline');
    echo $body;
} catch(Throwable $e) {
    error_log('[BlueGate Service Viewer] order='.$orderId.' '.$e->getMessage());
    sv_fail('صفحه سرویس در حالت امن قابل بارگذاری نبود. اگر این خطا تکرار شد، لینک تحویل را در پنل مدیریت بررسی کن.',502);
}
