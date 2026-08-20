<?php
/**
 * BlueReferral crypto cron
 * Engine: manual wallets + TXID verification + multi-provider cached rates
 *
 * This file intentionally does NOT run migrations.
 * It is the only place that contacts Wallex/Ramzinex/Nobitex / TronScan / Toncenter so the
 * Mini App and bot webhook stay fast.
 *
 * Modes:
 *   php cron_crypto.php --check-payments   # verify pending TXIDs only
 *   php cron_crypto.php --refresh-rates    # refresh Wallex/Ramzinex/Nobitex rate cache only
 *   php cron_crypto.php --all              # run both, for manual diagnostics
 *
 * HTTP:
 *   /cron_crypto.php?secret=...&mode=check-payments
 *   /cron_crypto.php?secret=...&mode=refresh-rates
 *   /cron_crypto.php?secret=...&mode=all
 */
require_once __DIR__ . '/../app/bootstrap.php';

$startedAt = microtime(true);

if (PHP_SAPI !== 'cli') {
    $secret = (string)($_GET['secret'] ?? '');
    if ($secret === '' || $secret !== (string)app_config('WEBHOOK_SECRET','')) {
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok'=>false,'engine'=>'manual_crypto','error'=>'FORBIDDEN'], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
        exit;
    }
}
header('Content-Type: application/json; charset=utf-8');

function blue_ref_cron_mode(): string {
    if (PHP_SAPI === 'cli') {
        $args = $_SERVER['argv'] ?? [];
        if (in_array('--refresh-rates', $args, true) || in_array('--rates', $args, true)) return 'refresh_rates';
        if (in_array('--all', $args, true)) return 'all';
        // Safe default for legacy one-minute cron: do NOT call external rate APIs.
        return 'check_payments';
    }
    $mode = strtolower(str_replace('_', '-', (string)($_GET['mode'] ?? $_GET['action'] ?? 'check-payments')));
    if (in_array($mode, ['refresh-rates','rates','refresh'], true)) return 'refresh_rates';
    if (in_array($mode, ['all','both'], true)) return 'all';
    return 'check_payments';
}

function blue_ref_cron_limit(): int {
    if (PHP_SAPI === 'cli') {
        $args = $_SERVER['argv'] ?? [];
        foreach ($args as $i => $arg) {
            if ($arg === '--limit' && isset($args[$i+1])) return max(1, min(100, (int)$args[$i+1]));
            if (str_starts_with($arg, '--limit=')) return max(1, min(100, (int)substr($arg, 8)));
        }
        return 25;
    }
    $limit = (int)($_GET['limit'] ?? 25);
    if ($limit < 1) $limit = 25;
    if ($limit > 100) $limit = 100;
    return $limit;
}

function blue_ref_check_crypto_payments(int $limit): array {
    $checked = 0; $confirmed = 0; $errors = 0;
    if (!table_exists('crypto_payment_checks')) {
        return ['checked'=>0, 'confirmed'=>0, 'errors'=>0, 'skipped'=>'missing_table'];
    }
    $q = db()->prepare('SELECT order_id FROM crypto_payment_checks WHERE status="pending" AND tx_hash IS NOT NULL AND tx_hash<>"" ORDER BY COALESCE(last_checked_at, created_at) ASC LIMIT ?');
    $q->bindValue(1, $limit, PDO::PARAM_INT);
    $q->execute();
    foreach ($q->fetchAll() as $row) {
        $checked++;
        try {
            $before = get_crypto_check_by_order((int)$row['order_id']);
            $after = crypto_verify_order((int)$row['order_id']);
            if ($after && ($after['status'] ?? '') === 'confirmed' && (!$before || ($before['status'] ?? '') !== 'confirmed')) $confirmed++;
        } catch (Throwable $e) {
            $errors++;
            error_log('[BlueReferral Crypto Cron] order '.$row['order_id'].' '.$e->getMessage());
        }
    }
    return ['checked'=>$checked, 'confirmed'=>$confirmed, 'errors'=>$errors];
}

try {
    $expiredCount = cancel_expired_orders();
    $mode = blue_ref_cron_mode();
    $limit = blue_ref_cron_limit();

    $rateResult = ['skipped'=>true, 'reason'=>'mode_'.$mode];
    $paymentResult = ['skipped'=>true, 'reason'=>'mode_'.$mode];

    if ($mode === 'refresh_rates' || $mode === 'all') {
        if (setting('crypto_rate_source','auto') !== 'manual') {
            $rateResult = crypto_refresh_rates_from_providers(true);
        } else {
            $rateResult = ['skipped'=>true, 'reason'=>'rate_source_manual'];
        }
    }

    if ($mode === 'check_payments' || $mode === 'all') {
        $paymentResult = blue_ref_check_crypto_payments($limit);
    }

    echo json_encode([
        'ok'=>true,
        'engine'=>'manual_crypto_txid_split_cron',
        'mode'=>$mode,
        'rate_providers'=>$rateResult,
        'nobitex_rates'=>$rateResult, // legacy key
        'payments'=>$paymentResult,
        // Legacy keys kept for older diagnostics/UI scripts.
        'checked'=>(int)($paymentResult['checked'] ?? 0),
        'confirmed'=>(int)($paymentResult['confirmed'] ?? 0),
        'errors'=>(int)($paymentResult['errors'] ?? 0),
        'duration_ms'=>(int)round((microtime(true)-$startedAt)*1000),
    ], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
} catch (Throwable $e) {
    http_response_code(500);
    error_log('[BlueReferral Crypto Cron] '.$e->getMessage());
    echo json_encode(['ok'=>false,'engine'=>'manual_crypto_txid_split_cron','error'=>$e->getMessage(),'duration_ms'=>(int)round((microtime(true)-$startedAt)*1000)], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
}
