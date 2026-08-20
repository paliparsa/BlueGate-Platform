<?php
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Cache-Control: post-check=0, pre-check=0', false);
header('Pragma: no-cache');

$query = trim((string)($_SERVER['QUERY_STRING'] ?? ''));
$suffix = $query !== '' ? ('?' . $query) : '';

// Public entry point: BlueGate Storefront. Preserve referral/deep-link query params.
header('Location: /web/' . $suffix, true, 302);
exit;
