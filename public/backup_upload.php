<?php
require_once __DIR__ . '/../app/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
function outj(array $data, int $code=200): void { http_response_code($code); echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }
try {
    $initData = (string)($_POST['initData'] ?? '');
    $webToken = $_SERVER['HTTP_X_WEB_TOKEN'] ?? (isset($_SERVER['HTTP_AUTHORIZATION']) ? str_replace('Bearer ', '', $_SERVER['HTTP_AUTHORIZATION']) : null);
    $tgUser = null;

    if (!empty($initData)) {
        $validated = verify_webapp_init_data($initData);
        if ($validated && !empty($validated['user'])) {
            $tgUser = json_decode($validated['user'], true);
        }
    } elseif (!empty($webToken)) {
        $user = get_user_by_token($webToken);
        if ($user) {
            $tgUser = ['id' => $user['telegram_id']];
        }
    }

    if (!$tgUser || empty($tgUser['id'])) outj(['ok'=>false,'error'=>'UNAUTHORIZED','message'=>'شما وارد نشده‌اید.'], 401);
    if (!is_admin((int)$tgUser['id'])) outj(['ok'=>false,'error'=>'ADMIN_ONLY','message'=>'Admin only.'], 403);
    if (($_POST['confirm'] ?? '') !== 'RESTORE') outj(['ok'=>false,'error'=>'CONFIRM_REQUIRED','message'=>'Confirm value must be RESTORE.'], 400);
    if (empty($_FILES['backup']) || !is_uploaded_file($_FILES['backup']['tmp_name'])) outj(['ok'=>false,'error'=>'NO_FILE','message'=>'Backup file not uploaded.'], 400);
    $name = (string)($_FILES['backup']['name'] ?? 'backup.json.gz');
    if (!str_ends_with(strtolower($name), '.json.gz') && !str_ends_with(strtolower($name), '.json')) outj(['ok'=>false,'error'=>'INVALID_EXTENSION','message'=>'Only .json.gz backup files are accepted.'], 400);
    $tmp = blue_backup_dir() . '/uploaded-restore-' . date('Ymd-His') . '-' . bin2hex(random_bytes(4)) . '.json.gz';
    if (!move_uploaded_file($_FILES['backup']['tmp_name'], $tmp)) outj(['ok'=>false,'error'=>'UPLOAD_MOVE_FAILED','message'=>'Could not save upload.'], 500);
    $res = blue_backup_restore_from_file($tmp, true);
    @unlink($tmp);
    outj(['ok'=>true,'restore'=>$res,'message'=>'Backup restored successfully.']);
} catch (Throwable $e) {
    outj(['ok'=>false,'error'=>$e->getMessage(),'message'=>'Restore failed: '.$e->getMessage()], 500);
}
