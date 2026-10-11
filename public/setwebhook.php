<?php
require_once __DIR__ . '/../app/bootstrap.php';
$secret = $_GET['secret'] ?? '';
if (!hash_equals((string)app_config('WEBHOOK_SECRET', ''), (string)$secret)) {
    http_response_code(403);
    exit('Forbidden');
}
$base = rtrim((string)app_config('PUBLIC_BASE_URL', ''), '/');
$url = $base . '/bot.php?secret=' . urlencode((string)app_config('WEBHOOK_SECRET', ''));
$payload = ['url' => $url, 'allowed_updates' => json_encode(['message','callback_query','pre_checkout_query'])];
$telegramSecret = trim((string)app_config('TELEGRAM_WEBHOOK_SECRET', ''));
if ($telegramSecret !== '') $payload['secret_token'] = $telegramSecret;
$res = tg('setWebhook', $payload);
header('Content-Type: application/json; charset=utf-8');
echo json_encode(['webhook_url'=>$url, 'telegram_response'=>$res], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
