<?php
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Cache-Control: post-check=0, pre-check=0', false);
header('Pragma: no-cache');

$query = trim((string)($_SERVER['QUERY_STRING'] ?? ''));
$suffix = $query !== '' ? ('?' . $query) : '';
$path = trim((string)(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/'), '/');

// Friendly website routes all resolve to the one unified Storefront UI.
$routes = [
    'account' => 'account',
    'orders' => 'orders',
    'wallet' => 'wallet',
    'referral' => 'referral',
    'profile' => 'profile',
    'admin' => 'admin',
];
if (isset($routes[$path])) {
    header('Location: /web/' . $suffix . '#/' . $routes[$path], true, 302);
    exit;
}

// Public entry point: BlueGate Storefront. Preserve referral/deep-link query params.
header('Location: /web/' . $suffix, true, 302);
exit;
