<?php
require_once dirname(__DIR__).'/app/bootstrap.php';
$isCli=PHP_SAPI==='cli';$key=(string)($_GET['key']??($_SERVER['HTTP_X_CRON_KEY']??''));$want=(string)app_config('CRON_KEY','');
if(!$isCli&&($want===''||!hash_equals($want,$key))){http_response_code(403);header('Content-Type: application/json');echo json_encode(['ok'=>false,'error'=>'FORBIDDEN']);exit;}
header('Content-Type: application/json; charset=utf-8');
try{$r=bluegate_run_monitoring((int)($_GET['limit']??0));echo json_encode(['ok'=>true,'phase'=>5]+$r,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);}catch(Throwable $e){http_response_code(500);error_log('[BlueGate monitoring] '.$e->getMessage());echo json_encode(['ok'=>false,'error'=>'MONITORING_FAILED']);}
