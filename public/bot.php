<?php
require_once __DIR__ . '/../app/bootstrap.php';
$secret = $_GET['secret'] ?? '';
$expected = app_config('WEBHOOK_SECRET', '');
if (!empty($expected) && !hash_equals($expected, $secret)) {
    http_response_code(403);
    exit('Forbidden');
}
$raw = file_get_contents('php://input');
$update = json_decode($raw ?: '{}', true) ?: [];
require_once __DIR__ . '/../app/bot_logic.php';
handle_update($update);
echo 'OK';
