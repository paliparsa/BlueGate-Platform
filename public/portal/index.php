<?php
// Legacy compatibility route. Portal UI was merged into the main BlueGate website in v1.1.
$tab = strtolower(trim((string)($_GET['tab'] ?? $_GET['view'] ?? 'account')));
$map = [
    'shop' => '',
    'account' => 'account',
    'dashboard' => 'account',
    'orders' => 'orders',
    'wallet' => 'wallet',
    'referral' => 'referral',
    'referrals' => 'referral',
    'profile' => 'profile',
    'admin' => 'admin',
];
$route = $map[$tab] ?? 'account';
$target = '/web/' . ($route !== '' ? '#/' . $route : '');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Location: ' . $target, true, 302);
exit;
