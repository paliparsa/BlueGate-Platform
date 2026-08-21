<?php
require_once __DIR__ . '/../app/bootstrap.php';
if (!setting('schema_migrated_v3') || !setting('schema_merged_storefront_v1') || !setting('schema_catalog_v2')) { migrate(); set_setting('schema_migrated_v3', '1'); set_setting('schema_merged_storefront_v1', '1'); set_setting('schema_catalog_v2', '1'); }

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
