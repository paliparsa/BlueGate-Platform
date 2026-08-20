<?php
require_once __DIR__ . '/../app/bootstrap.php';
$secret = $_GET['secret'] ?? '';
if (!hash_equals(app_config('WEBHOOK_SECRET', ''), $secret)) {
    http_response_code(403);
    exit('Forbidden');
}
$base = rtrim(app_config('PUBLIC_BASE_URL', ''), '/');
$url = $base . '/bot.php?secret=' . urlencode(app_config('WEBHOOK_SECRET', ''));
$res = tg('setWebhook', ['url' => $url, 'allowed_updates' => json_encode(['message','callback_query','pre_checkout_query'])]);
header('Content-Type: application/json; charset=utf-8');
echo json_encode(['webhook_url'=>$url, 'telegram_response'=>$res], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
