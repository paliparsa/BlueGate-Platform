<?php
require_once __DIR__ . '/../app/bootstrap.php';
$secret = (string)($_GET['secret'] ?? '');
$expected = trim((string)app_config('WEBHOOK_SECRET', ''));
// Keep the existing webhook URL contract, but never accept unsigned updates when config is incomplete.
if ($expected === '') {
    error_log('[BlueGate Bot] WEBHOOK_SECRET is empty; refusing webhook request.');
    http_response_code(503);
    exit('Webhook not configured');
}
if (!hash_equals($expected, $secret)) {
    http_response_code(403);
    exit('Forbidden');
}
$raw = file_get_contents('php://input');
$update = json_decode($raw ?: '{}', true) ?: [];
require_once __DIR__ . '/../app/bot_logic.php';
try {
    handle_update($update);
} catch (Throwable $e) {
    error_log('[BlueGate Bot webhook] '.$e->getMessage().' @ '.$e->getFile().':'.$e->getLine());
    $cb=$update['callback_query'] ?? null;
    if (is_array($cb)) {
        try { if (!empty($cb['id'])) answer_cb((string)$cb['id'], 'خطای موقت؛ دوباره تلاش کن.'); } catch (Throwable $ignore) {}
        $cid=(int)($cb['message']['chat']['id'] ?? $cb['from']['id'] ?? 0);
        if ($cid) { try { send_msg($cid,'⚠️ اجرای این دکمه با خطا روبه‌رو شد. دوباره امتحان کن؛ اگر ادامه داشت لاگ Bot را بررسی کن.'); } catch (Throwable $ignore) {} }
    }
}
echo 'OK';
