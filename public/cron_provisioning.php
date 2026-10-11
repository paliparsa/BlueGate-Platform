<?php
require_once dirname(__DIR__).'/app/bootstrap.php';
$isCli = PHP_SAPI === 'cli';
$key = (string)($_GET['key'] ?? ($_SERVER['HTTP_X_CRON_KEY'] ?? ''));
$wantKey = (string)app_config('CRON_KEY', '');
$placeholder = ($wantKey === '' || str_starts_with($wantKey, 'CHANGE_ME'));
$auth = $isCli || (!$placeholder && $key !== '' && hash_equals($wantKey, $key));

if (!$auth) {
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'FORBIDDEN'], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
    exit;
}

header('Content-Type: application/json; charset=utf-8');
try {
    $limit = max(1, min(100, (int)($_GET['limit'] ?? 25)));
    $r = bluegate_run_due_provisioning_jobs($limit);
    $cacheDir = dirname(__DIR__) . '/storage/cache';
    if (!is_dir($cacheDir)) {
        @mkdir($cacheDir, 0755, true);
    }
    @file_put_contents($cacheDir . '/cron-provisioning.last', (string)time());
    echo json_encode(['ok' => true] + $r, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
} catch (Throwable $e) {
    error_log('[cron_provisioning] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'WORKER_FAILED'], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
}
