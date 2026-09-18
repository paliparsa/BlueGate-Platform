<?php
require_once dirname(__DIR__).'/app/bootstrap.php';
$isCli=PHP_SAPI==='cli';$key=(string)($_GET['key']??($_SERVER['HTTP_X_CRON_KEY']??''));$want=(string)app_config('CRON_KEY','');
if(!$isCli&&($want===''||!hash_equals($want,$key))){http_response_code(403);header('Content-Type: application/json');echo json_encode(['ok'=>false,'error'=>'FORBIDDEN']);exit;}
header('Content-Type: application/json; charset=utf-8');
try{$r=bluegate_run_due_provisioning_jobs((int)($_GET['limit']??25));echo json_encode(['ok'=>true]+$r,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);}catch(Throwable $e){http_response_code(500);echo json_encode(['ok'=>false,'error'=>'WORKER_FAILED']);}
