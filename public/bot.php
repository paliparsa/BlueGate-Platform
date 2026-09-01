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
handle_update($update);
echo 'OK';
