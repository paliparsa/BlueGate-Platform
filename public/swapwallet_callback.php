<?php
require_once __DIR__ . '/../app/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');

$secret = app_config('WEBHOOK_SECRET', '');
if ($secret !== '' && isset($_GET['secret']) && !hash_equals((string)$secret, (string)$_GET['secret'])) {
    http_response_code(403);
    echo json_encode(['ok'=>false,'error'=>'FORBIDDEN'], JSON_UNESCAPED_UNICODE);
    exit;
}

$raw = file_get_contents('php://input') ?: '';
$body = json_decode($raw, true);
if (!is_array($body)) $body = [];

$invoiceId = '';
foreach (['invoice_id','invoiceId','id','uuid','hash','invoiceHash','invoice_hash','walletId','wallet_id'] as $k) {
    if (!empty($body[$k])) { $invoiceId = (string)$body[$k]; break; }
}

$orderId = (int)($_GET['order_id'] ?? 0);
if (!$orderId) {
    $custom = $body['customData'] ?? $body['custom_data'] ?? null;
    if (is_string($custom)) {
        $decoded = json_decode($custom, true);
        if (is_array($decoded) && !empty($decoded['order_id'])) $orderId = (int)$decoded['order_id'];
    } elseif (is_array($custom) && !empty($custom['order_id'])) {
        $orderId = (int)$custom['order_id'];
    }
}

$status = strtoupper((string)($body['status'] ?? $body['state'] ?? $body['paymentStatus'] ?? $body['payment_status'] ?? ''));
try {
    if ($invoiceId !== '') {
        db()->prepare('UPDATE swapwallet_invoices SET callback_raw=?, status=IF(?="",status,?), last_checked_at=NOW() WHERE invoice_id=?')
            ->execute([$raw, $status, $status, $invoiceId]);
        $invQ = db()->prepare('SELECT * FROM swapwallet_invoices WHERE invoice_id=?');
        $invQ->execute([$invoiceId]);
        $inv = $invQ->fetch();
        if ($inv) $orderId = (int)$inv['order_id'];
    } elseif ($orderId > 0) {
        db()->prepare('UPDATE swapwallet_invoices SET callback_raw=?, status=IF(?="",status,?), last_checked_at=NOW() WHERE order_id=?')
            ->execute([$raw, $status, $status, $orderId]);
    }
    if ($orderId > 0 && in_array($status, ['PAID','COMPLETED','PAID_CONFIRMED'], true)) {
        db()->prepare('UPDATE swapwallet_invoices SET status="PAID", paid_at=COALESCE(paid_at,NOW()) WHERE order_id=?')->execute([$orderId]);
        $paid = mark_order_paid($orderId);
        add_order_event($orderId, 'payment_confirmed', 'پرداخت SwapWallet با callback تایید شد', $invoiceId ? ('Invoice: '.$invoiceId) : '', true);
        if ($paid) {
            send_msg((int)$paid['telegram_id'], "✅ پرداخت سواپ‌ولت سفارش <code>#{$paid['id']}</code> تایید شد.\nسفارش شما برای آماده‌سازی ثبت شد.", main_menu_keyboard(is_admin($paid['telegram_id'])));
            notify_admins("✅ پرداخت SwapWallet با callback تایید شد\nسفارش: <code>#{$paid['id']}</code>\nInvoice: <code>".h($invoiceId)."</code>");
        }
    }
    echo json_encode(['ok'=>true], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    error_log('[BlueReferral SwapWallet Callback] '.$e->getMessage());
    echo json_encode(['ok'=>false,'error'=>$e->getMessage()], JSON_UNESCAPED_UNICODE);
}
