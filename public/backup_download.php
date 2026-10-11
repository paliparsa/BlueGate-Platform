<?php
require_once __DIR__ . '/../app/bootstrap.php';
$file = (string)($_GET['file'] ?? '');
$token = (string)($_GET['token'] ?? '');
try {
    if (!blue_backup_verify_token($file, $token)) { http_response_code(403); exit('Forbidden'); }
    $path = blue_backup_file_path($file);
    if (!is_file($path)) { http_response_code(404); exit('Not found'); }
    header('Content-Type: application/gzip');
    header('Content-Disposition: attachment; filename="'.basename($path).'"');
    header('Content-Length: '.filesize($path));
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    readfile($path);
} catch (Throwable $e) {
    http_response_code(400);
    echo 'Bad request';
}
