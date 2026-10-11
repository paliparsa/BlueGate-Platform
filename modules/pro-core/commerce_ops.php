<?php

function veyra_pro_admin_broadcast_home(int $chat_id,$message_id,string $forcedChannel=''): void {
    $channel=$forcedChannel?:'both';
    $channelLabel=['telegram'=>'Telegram','mini'=>'Mini App','both'=>'Telegram + Mini App'][$channel]??'هر دو';
    $rows=[];
    if(!$forcedChannel)$rows[]=[['text'=>'✈️ فقط Telegram','callback_data'=>'adm_bc_ch_telegram'],['text'=>'🔔 فقط Mini App','callback_data'=>'adm_bc_ch_mini']];
    if(!$forcedChannel)$rows[]=[['text'=>'⚡ هر دو همزمان','callback_data'=>'adm_bc_ch_both']];
    foreach([['all','👥 همه'],['customers','🛍 مشتری‌ها'],['vpn','🔐 VPN'],['recent','🟢 فعال اخیر']] as $a){
        $count=count(admin_audience_user_ids($a[0]));
        $rows[]=[['text'=>$a[1].' · '.$count,'callback_data'=>'adm_bc_a_'.$channel.'_'.$a[0]]];
    }
    $rows[]=[['text'=>'🔙 کنترل سنتر','callback_data'=>'adm_home']];
    send_or_edit($chat_id,$message_id,"📣 <b>Broadcast Center</b>\n\nکانال: <b>{$channelLabel}</b>\nمخاطب رو با دکمه انتخاب کن.",json_markup(['inline_keyboard'=>$rows]));
}


function veyra_pro_admin_broadcast_preview_keyboard(): string {return json_markup(['inline_keyboard'=>[[['text'=>'✅ ارسال نهایی','callback_data'=>'adm_bc_send'],['text'=>'✏️ تغییر پیام','callback_data'=>'adm_bc_edit']],[['text'=>'❌ لغو','callback_data'=>'adm_home']]]]);}


function veyra_pro_admin_send_telegram_broadcast(array $ids,string $text): array {
    $sent=0;$failed=0;
    if(!$ids)return ['sent'=>0,'failed'=>0];
    $ph=implode(',',array_fill(0,count($ids),'?'));
    $q=db()->prepare("SELECT telegram_id FROM users WHERE id IN ({$ph}) AND telegram_id IS NOT NULL");$q->execute(array_map('intval',$ids));
    foreach($q->fetchAll(PDO::FETCH_COLUMN)?:[] as $tid){try{$r=tg('sendMessage',['chat_id'=>(int)$tid,'text'=>$text,'parse_mode'=>'HTML','disable_web_page_preview'=>true]);if(is_array($r)&&array_key_exists('ok',$r)&&!$r['ok'])$failed++;else$sent++;}catch(Throwable $e){$failed++;}usleep(35000);}return compact('sent','failed');
}


function veyra_pro_admin_notification_campaigns(int $limit=50): array {
    if(!table_exists('notification_campaigns'))return [];$limit=max(1,min(100,$limit));
    return db()->query('SELECT id,admin_telegram_id,type,title,body,action_type,action_value,audience,recipient_count,created_at FROM notification_campaigns ORDER BY id DESC LIMIT '.(int)$limit)->fetchAll()?:[];
}


function veyra_pro_create_notification_campaign(int $adminTid,string $type,string $title,string $body,string $actionType='',string $actionValue='',string $audience='all'): array {
    $type=in_array($type,['info','important','promo','service','security'],true)?$type:'info';
    $audience=in_array($audience,['all','service','vpn'],true)?$audience:'all';
    $allowedActions=['','store','orders','wallet','account','profile','service','url'];
    if(!in_array($actionType,$allowedActions,true))$actionType='';
    $pdo=db();$pdo->beginTransaction();
    try{
        $sql='SELECT DISTINCT u.id FROM users u WHERE u.deleted_at IS NULL AND u.is_banned=0';
        if($audience==='service')$sql.=" AND EXISTS (SELECT 1 FROM orders o WHERE o.user_id=u.id AND o.status='delivered')";
        if($audience==='vpn')$sql.=" AND EXISTS (SELECT 1 FROM orders o LEFT JOIN products p ON p.id=o.product_id LEFT JOIN service_plans sp ON sp.id=o.catalog_plan_id WHERE o.user_id=u.id AND o.status='delivered' AND (LOWER(COALESCE(sp.delivery_type,p.delivery_type,''))='vpn' OR LOWER(COALESCE(o.delivery_url,'')) LIKE '%/sub/%'))";
        $ids=$pdo->query($sql)->fetchAll(PDO::FETCH_COLUMN)?:[];
        $q=$pdo->prepare('INSERT INTO notification_campaigns (admin_telegram_id,type,title,body,action_type,action_value,audience,recipient_count) VALUES (?,?,?,?,?,?,?,?)');
        $q->execute([$adminTid,$type,mb_substr($title,0,255),mb_substr($body,0,1000),$actionType?:null,$actionValue?mb_substr($actionValue,0,255):null,$audience,count($ids)]);
        $cid=(int)$pdo->lastInsertId();
        $ins=$pdo->prepare('INSERT INTO user_notifications (user_id,type,title,body,action_type,action_value,campaign_id) VALUES (?,?,?,?,?,?,?)');
        foreach($ids as $uid)$ins->execute([(int)$uid,$type,mb_substr($title,0,255),mb_substr($body,0,1000),$actionType?:null,$actionValue?mb_substr($actionValue,0,255):null,$cid]);
        $pdo->commit(); return ['id'=>$cid,'recipient_count'=>count($ids)];
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}


function veyra_pro_admin_role(int $telegramId): string {
    if(in_array($telegramId,array_map('intval',app_config('ADMIN_IDS',[])),true))return 'full';
    if(table_exists('admin_roles')){$q=db()->prepare('SELECT role FROM admin_roles WHERE telegram_id=?');$q->execute([$telegramId]);$r=$q->fetch();if($r&&!empty($r['role']))return (string)$r['role'];}
    if(table_exists('users')){try{$q=db()->prepare('SELECT is_admin FROM users WHERE telegram_id=? AND is_admin=1 LIMIT 1');$q->execute([$telegramId]);if($q->fetchColumn())return 'full';}catch(Throwable $e){}}
    return 'none';
}


function veyra_pro_admin_list_roles(): array {
    return db()->query('SELECT * FROM admin_roles ORDER BY id DESC')->fetchAll() ?: [];
}


function veyra_pro_admin_set_role(int $telegramId, string $role, string $displayName=''): array {
    if(!in_array($role,['full','orders','products','finance','none'],true)) $role='full';
    db()->prepare('INSERT INTO admin_roles (telegram_id,role,display_name) VALUES (?,?,?) ON DUPLICATE KEY UPDATE role=VALUES(role),display_name=VALUES(display_name)')->execute([$telegramId,$role,$displayName?:null]);
    return admin_list_roles();
}


function veyra_pro_admin_remove_role(int $telegramId): array {
    db()->prepare('DELETE FROM admin_roles WHERE telegram_id=?')->execute([$telegramId]);
    return admin_list_roles();
}


function veyra_pro_queue_broadcast_job(int $adminTid,string $text,string $method='sendMessage',?string $field=null,?string $fileId=null): array {
    $pdo=db();$pdo->beginTransaction();try{$ids=$pdo->query('SELECT telegram_id FROM users WHERE telegram_id IS NOT NULL AND telegram_id>0 AND telegram_id<9000000000 AND is_banned=0 AND deleted_at IS NULL')->fetchAll(PDO::FETCH_COLUMN);$ids=array_values(array_unique(array_map('intval',$ids)));$q=$pdo->prepare('INSERT INTO broadcast_jobs (admin_telegram_id,text,telegram_method,media_field,telegram_file_id,total_count) VALUES (?,?,?,?,?,?)');$q->execute([$adminTid,$text,$method,$field,$fileId,count($ids)]);$jobId=(int)$pdo->lastInsertId();$ins=$pdo->prepare('INSERT IGNORE INTO broadcast_job_recipients (job_id,telegram_id) VALUES (?,?)');foreach($ids as $tid)if($tid>0)$ins->execute([$jobId,$tid]);$pdo->commit();return ['id'=>$jobId,'total_count'=>count($ids),'status'=>'queued'];}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}


function veyra_pro_process_broadcast_jobs(int $limit=40): array {
    if(!table_exists('broadcast_jobs')||!table_exists('broadcast_job_recipients'))return ['processed'=>0,'sent'=>0,'failed'=>0];
    $limit=max(1,min(100,$limit));$pdo=db();$locked=false;
    try{
        $l=$pdo->query("SELECT GET_LOCK('veyra_broadcast_worker',0) l")->fetch();$locked=!empty($l['l']);
        if(!$locked)return ['processed'=>0,'sent'=>0,'failed'=>0,'busy'=>true];
        $job=$pdo->query('SELECT * FROM broadcast_jobs WHERE status IN ("queued","running") ORDER BY id ASC LIMIT 1')->fetch();
        if(!$job)return ['processed'=>0,'sent'=>0,'failed'=>0];
        $jobId=(int)$job['id'];$pdo->prepare('UPDATE broadcast_jobs SET status="running",started_at=COALESCE(started_at,NOW()) WHERE id=?')->execute([$jobId]);
        $q=$pdo->prepare('SELECT * FROM broadcast_job_recipients WHERE job_id=? AND status="queued" ORDER BY id ASC LIMIT ?');$q->bindValue(1,$jobId,PDO::PARAM_INT);$q->bindValue(2,$limit,PDO::PARAM_INT);$q->execute();$rows=$q->fetchAll();$sent=0;$failed=0;
        foreach($rows as $r){
            $data=['chat_id'=>(int)$r['telegram_id'],'parse_mode'=>'HTML','disable_web_page_preview'=>true];$method=(string)$job['telegram_method'];
            if(!empty($job['telegram_file_id'])&&!empty($job['media_field'])){$data[(string)$job['media_field']]=$job['telegram_file_id'];if(trim((string)$job['text'])!=='')$data['caption']=$job['text'];unset($data['disable_web_page_preview']);}
            else{$data['text']=(string)$job['text'];}
            $res=tg($method,$data);
            if(!empty($res['ok'])){$u=$pdo->prepare('UPDATE broadcast_job_recipients SET status="sent",attempts=attempts+1,sent_at=NOW(),last_error=NULL WHERE id=? AND status="queued"');$u->execute([(int)$r['id']]);if($u->rowCount()===1)$sent++;}
            else{$err=mb_substr((string)($res['description']??'Telegram send failed'),0,500);$u=$pdo->prepare('UPDATE broadcast_job_recipients SET status="failed",attempts=attempts+1,last_error=? WHERE id=? AND status="queued"');$u->execute([$err,(int)$r['id']]);if($u->rowCount()===1)$failed++;}
            usleep(50000);
        }
        $pdo->prepare('UPDATE broadcast_jobs SET sent_count=sent_count+?,failed_count=failed_count+? WHERE id=?')->execute([$sent,$failed,$jobId]);
        $leftQ=$pdo->prepare('SELECT COUNT(*) c FROM broadcast_job_recipients WHERE job_id=? AND status="queued"');$leftQ->execute([$jobId]);$left=(int)$leftQ->fetch()['c'];
        if($left===0)$pdo->prepare('UPDATE broadcast_jobs SET status="done",finished_at=NOW() WHERE id=?')->execute([$jobId]);
        return ['processed'=>count($rows),'sent'=>$sent,'failed'=>$failed,'remaining'=>$left,'job_id'=>$jobId];
    } finally {
        if($locked){try{$pdo->query("SELECT RELEASE_LOCK('veyra_broadcast_worker')");}catch(Throwable $e){}}
    }
}


function veyra_pro_admin_revenue_forecast(): array {
    $last30=db()->query('SELECT COALESCE(SUM(final_amount),0) s, COUNT(*) c FROM orders WHERE created_at >= DATE_SUB(NOW(),INTERVAL 30 DAY) AND status IN ("payment_confirmed","preparing","delivered")')->fetch();
    $prev30=db()->query('SELECT COALESCE(SUM(final_amount),0) s FROM orders WHERE created_at >= DATE_SUB(NOW(),INTERVAL 60 DAY) AND created_at < DATE_SUB(NOW(),INTERVAL 30 DAY) AND status IN ("payment_confirmed","preparing","delivered")')->fetch();
    $dailyAvg=(int)($last30['s']/30);
    $forecast=$dailyAvg*30;
    $change=$prev30['s']>0?round((($last30['s']-$prev30['s'])/$prev30['s'])*100,1):0;
    return ['last30_sum'=>(int)$last30['s'],'last30_count'=>(int)$last30['c'],'daily_avg'=>$dailyAvg,'forecast'=>$forecast,'change_percent'=>$change];
}


function veyra_pro_blue_backup_load_payload_from_file(string $path): array {
    if (!is_file($path)) throw new RuntimeException('BACKUP_FILE_NOT_FOUND');
    if (filesize($path) > 80 * 1024 * 1024) throw new RuntimeException('BACKUP_FILE_TOO_LARGE');
    $raw = file_get_contents($path);
    if ($raw === false || $raw === '') throw new RuntimeException('BACKUP_READ_FAILED');
    $json = gzdecode($raw);
    if ($json === false) $json = $raw;
    $data = json_decode($json, true);
    if (!is_array($data) || ($data['format'] ?? '') !== 'blue_referral_backup' || empty($data['tables']) || !is_array($data['tables'])) throw new RuntimeException('INVALID_BACKUP_FORMAT');
    return $data;
}


function veyra_pro_blue_backup_restore_from_file(string $path, bool $makeSafetyBackup=true): array {
    $data = blue_backup_load_payload_from_file($path);
    $safety = null;
    if ($makeSafetyBackup) {
        try { $safety = blue_backup_create('before-restore'); } catch (Throwable $e) { $safety = ['error'=>$e->getMessage()]; }
    }
    $tables = array_intersect(blue_backup_tables(), array_keys($data['tables']));
    $restoredRows = 0;
    db()->exec('SET FOREIGN_KEY_CHECKS=0');
    try {
        foreach (array_reverse($tables) as $table) db()->exec('TRUNCATE TABLE `'.str_replace('`','``',$table).'`');
        foreach ($tables as $table) {
            $currentColumns = blue_backup_table_columns($table);
            $rows = $data['tables'][$table]['rows'] ?? [];
            if (!is_array($rows) || !$rows) continue;
            foreach ($rows as $row) {
                if (!is_array($row)) continue;
                $cols = array_values(array_intersect($currentColumns, array_keys($row)));
                if (!$cols) continue;
                $sql = 'INSERT INTO `'.str_replace('`','``',$table).'` (`'.implode('`,`', array_map(fn($c)=>str_replace('`','``',$c), $cols)).'`) VALUES ('.implode(',', array_fill(0, count($cols), '?')).')';
                $stmt = db()->prepare($sql);
                $stmt->execute(array_map(fn($c)=>$row[$c], $cols));
                $restoredRows++;
            }
        }
    } finally {
        db()->exec('SET FOREIGN_KEY_CHECKS=1');
    }
    set_setting('backup_last_restored_at', date('Y-m-d H:i:s'));
    set_setting('backup_last_restored_file', basename($path));
    return ['restored_rows'=>$restoredRows, 'tables'=>count($tables), 'safety_backup'=>$safety];
}


function veyra_pro_blue_backup_send_to_admin(int $telegram_id): array {
    if(!is_full_admin($telegram_id))throw new RuntimeException('ADMIN_ONLY');
    $b = blue_backup_create();
    $res = send_document_file($telegram_id, $b['path'], "💾 <b>BlueReferral backup</b>\nFile: <code>{$b['filename']}</code>\nRows: <b>{$b['rows']}</b>\nTables: <b>{$b['tables']}</b>");
    if (empty($res['ok'])) throw new RuntimeException('TELEGRAM_SEND_BACKUP_FAILED: '.($res['description'] ?? 'unknown'));
    return $b + ['telegram_sent'=>true];
}

