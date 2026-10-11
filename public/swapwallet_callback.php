<?php
require_once __DIR__ . '/../app/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
$expected=swapwallet_callback_secret();$provided=(string)($_SERVER['HTTP_X_BLUEGATE_WEBHOOK_SECRET']??($_GET['secret']??''));
if($expected===''||$provided===''||!hash_equals($expected,$provided)){http_response_code(403);echo json_encode(['ok'=>false,'error'=>'FORBIDDEN']);exit;}
$raw=file_get_contents('php://input')?:'';$body=json_decode($raw,true);if(!is_array($body))$body=[];$invoiceId='';foreach(['invoice_id','invoiceId','id','uuid','hash','invoiceHash','invoice_hash','walletId','wallet_id'] as $k)if(!empty($body[$k])){$invoiceId=(string)$body[$k];break;}
$orderId=(int)($_GET['order_id']??0);if($invoiceId!==''){$q=db()->prepare('SELECT order_id FROM swapwallet_invoices WHERE invoice_id=?');$q->execute([$invoiceId]);$r=$q->fetch();if($r)$orderId=(int)$r['order_id'];}
if(!$orderId){$custom=$body['customData']??$body['custom_data']??null;if(is_string($custom))$custom=json_decode($custom,true);if(is_array($custom)&&!empty($custom['order_id']))$orderId=(int)$custom['order_id'];}
try{if($orderId<=0)throw new RuntimeException('INVOICE_NOT_FOUND');db()->prepare('UPDATE swapwallet_invoices SET callback_raw=?,last_checked_at=NOW() WHERE order_id=?')->execute([$raw,$orderId]);$after=swapwallet_refresh_invoice($orderId);echo json_encode(['ok'=>true,'verified_status'=>$after['status']??null],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);}catch(Throwable $e){http_response_code(400);error_log('[BlueGate SwapWallet Callback] '.$e->getMessage());echo json_encode(['ok'=>false,'error'=>'CALLBACK_VERIFICATION_FAILED'],JSON_UNESCAPED_UNICODE);}
