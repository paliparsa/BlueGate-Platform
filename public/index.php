<?php
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Cache-Control: post-check=0, pre-check=0', false);
header('Pragma: no-cache');

$path = '/' . trim((string)(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/'), '/');
if ($path === '//') $path = '/';

// Real browser paths handled by the Web History API router.
$allowed = [
    '/', '/index.php',
    '/account', '/orders', '/wallet', '/referral', '/profile',
    '/admin', '/admin/overview', '/admin/orders', '/admin/catalog', '/admin/inventory',
    '/admin/customers', '/admin/users', '/admin/coupons', '/admin/settings', '/admin/activity',
    '/admin/roles', '/admin/backups',
];

if (in_array(rtrim($path, '/') ?: '/', $allowed, true)) {
    $shell = __DIR__ . '/web/index.html';
    if (!is_file($shell)) {
        http_response_code(500);
        echo 'BlueGate Web shell is missing.';
        exit;
    }
    header('Content-Type: text/html; charset=UTF-8');
    readfile($shell);
    exit;
}

// Keep the historical /web/ entry available and avoid turning arbitrary paths into valid pages.
header('Location: /web/' . (!empty($_SERVER['QUERY_STRING']) ? ('?' . $_SERVER['QUERY_STRING']) : ''), true, 302);
exit;
