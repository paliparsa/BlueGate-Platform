<?php
require_once __DIR__ . '/../app/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
function outj(array $data,int $code=200): void {http_response_code($code);echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);exit;}
try{
    $initData=(string)($_POST['initData']??'');$token=trim((string)($_COOKIE['bg_session']??($_SERVER['HTTP_X_WEB_TOKEN']??'')));$user=false;
    if($initData!==''){$v=verify_webapp_init_data($initData);if($v&&!empty($v['user'])){$tg=json_decode($v['user'],true);if($tg&&!empty($tg['id']))$user=get_user_by_tid((int)$tg['id']);}}
    elseif($token!=='')$user=get_user_by_token($token);
    if(!$user||user_is_blocked($user))outj(['ok'=>false,'error'=>'UNAUTHORIZED','message'=>'شما وارد نشده‌اید.'],401);
    if(!is_full_admin($user))outj(['ok'=>false,'error'=>'ADMIN_ONLY','message'=>'فقط ادمین کامل اجازه Restore دارد.'],403);
    if($initData===''&&!empty($_COOKIE['bg_session'])){$origin=trim((string)($_SERVER['HTTP_ORIGIN']??''));$oh=strtolower((string)(parse_url($origin,PHP_URL_HOST)?:''));$host=strtolower(preg_replace('/:\d+$/','',(string)($_SERVER['HTTP_HOST']??'')));$allowed=trim((string)app_config('WEB_ALLOWED_ORIGIN',''));$ok=$origin!==''&&(($allowed!==''&&rtrim($origin,'/')===rtrim($allowed,'/'))||($oh!==''&&$oh===$host));if(!$ok)outj(['ok'=>false,'error'=>'CSRF_CHECK_FAILED','message'=>'درخواست امنیتی معتبر نیست.'],403);}
    if(($_POST['confirm']??'')!=='RESTORE')outj(['ok'=>false,'error'=>'CONFIRM_REQUIRED','message'=>'برای بازیابی مقدار confirm باید RESTORE باشد.'],400);
    if(empty($_FILES['backup'])||!is_uploaded_file($_FILES['backup']['tmp_name']))outj(['ok'=>false,'error'=>'NO_FILE','message'=>'فایل بکاپ ارسال نشده است.'],400);
    $name=(string)($_FILES['backup']['name']??'backup.json.gz');if(!str_ends_with(strtolower($name),'.json.gz')&&!str_ends_with(strtolower($name),'.json'))outj(['ok'=>false,'error'=>'INVALID_EXTENSION','message'=>'فقط فایل بکاپ JSON/JSON.GZ پذیرفته می‌شود.'],400);
    $tmp=blue_backup_dir().'/uploaded-restore-'.date('Ymd-His').'-'.bin2hex(random_bytes(4)).'.json.gz';if(!move_uploaded_file($_FILES['backup']['tmp_name'],$tmp))outj(['ok'=>false,'error'=>'UPLOAD_MOVE_FAILED','message'=>'ذخیره فایل موقت ناموفق بود.'],500);
    try{$res=blue_backup_restore_from_file($tmp,true);}finally{@unlink($tmp);}outj(['ok'=>true,'restore'=>$res,'message'=>'Backup restored successfully.']);
}catch(Throwable $e){error_log('[Backup upload] '.$e->getMessage());outj(['ok'=>false,'error'=>'RESTORE_FAILED','message'=>'بازیابی بکاپ ناموفق بود؛ جزئیات در لاگ سرور ثبت شد.'],500);}
