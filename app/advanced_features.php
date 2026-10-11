<?php
/* BlueGate Phase 10 — Advanced Features. Phase 9 intentionally skipped. */
function bluegate_trial_settings(): array {
    if(!table_exists('trial_settings')) return ['enabled'=>0];
    $r=db()->query('SELECT * FROM trial_settings WHERE id=1')->fetch(); return $r?:['enabled'=>0];
}
function bluegate_save_trial_settings(array $in): array {
    $plan=max(0,(int)($in['service_plan_id']??0));
    db()->prepare('INSERT INTO trial_settings (id,enabled,service_plan_id,traffic_limit_bytes,duration_minutes,max_per_user,cooldown_days) VALUES (1,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE enabled=VALUES(enabled),service_plan_id=VALUES(service_plan_id),traffic_limit_bytes=VALUES(traffic_limit_bytes),duration_minutes=VALUES(duration_minutes),max_per_user=VALUES(max_per_user),cooldown_days=VALUES(cooldown_days)')
      ->execute([!empty($in['enabled'])?1:0,$plan?:null,max(0,(int)($in['traffic_limit_bytes']??1073741824)),max(15,(int)($in['duration_minutes']??120)),max(1,(int)($in['max_per_user']??1)),max(0,(int)($in['cooldown_days']??30))]);
    return bluegate_trial_settings();
}
function bluegate_trial_eligibility(int $userId): array {
    $s=bluegate_trial_settings(); if(empty($s['enabled'])) return ['eligible'=>false,'reason'=>'TRIAL_DISABLED'];
    if(empty($s['service_plan_id'])) return ['eligible'=>false,'reason'=>'TRIAL_PLAN_NOT_SET'];
    $q=db()->prepare('SELECT COUNT(*) c,MAX(requested_at) last_at FROM trial_requests WHERE user_id=?');$q->execute([$userId]);$h=$q->fetch()?:[];
    if((int)($h['c']??0)>=(int)$s['max_per_user']) return ['eligible'=>false,'reason'=>'TRIAL_LIMIT_REACHED'];
    if(!empty($h['last_at'])&&(int)$s['cooldown_days']>0&&strtotime((string)$h['last_at'])>time()-((int)$s['cooldown_days']*86400)) return ['eligible'=>false,'reason'=>'TRIAL_COOLDOWN'];
    return ['eligible'=>true,'settings'=>$s];
}
function bluegate_request_trial(int $userId): array {
    $e=bluegate_trial_eligibility($userId); if(empty($e['eligible'])) throw new RuntimeException((string)$e['reason']); $s=$e['settings'];
    $q=db()->prepare('SELECT sp.*,sg.name group_name,sv.name service_name FROM service_plans sp JOIN service_groups sg ON sg.id=sp.group_id JOIN services sv ON sv.id=sg.service_id WHERE sp.id=?');$q->execute([(int)$s['service_plan_id']]);$plan=$q->fetch();if(!$plan)throw new RuntimeException('TRIAL_PLAN_NOT_FOUND');
    $maps=function_exists('bluegate_route_candidates')?bluegate_route_candidates((int)$plan['id']):array_values(array_filter(bluegate_plan_provider_maps((int)$plan['id']),fn($m)=>!empty($m['is_active'])&&!empty($m['provider_active'])));if(!$maps)throw new RuntimeException('TRIAL_NO_HEALTHY_PROVIDER');
    $map=$maps[0]; $providerId=(int)$map['provider_id']; $cfg=$map['config']??[]; $token=bin2hex(random_bytes(32)); $expires=date('Y-m-d H:i:s',time()+((int)$s['duration_minutes']*60));
    $pdo=db();$pdo->beginTransaction();try{$pdo->prepare('INSERT INTO user_services (user_id,service_plan_id,service_type,display_name,status,traffic_limit_bytes,started_at,expires_at,subscription_token,metadata_json) VALUES (?,? ,"trial",?,"pending",?,NOW(),?,?,?)')->execute([$userId,(int)$plan['id'],'Trial '.trim(($plan['service_name']??'').' '.($plan['title']??'')),(int)$s['traffic_limit_bytes'],$expires,$token,json_encode(['source'=>'trial','phase'=>10],JSON_UNESCAPED_SLASHES)]);$sid=(int)$pdo->lastInsertId();$pdo->prepare('INSERT INTO trial_requests (user_id,service_plan_id,user_service_id,status,expires_at) VALUES (?,?,?,"provisioning",?)')->execute([$userId,(int)$plan['id'],$sid,$expires]);$tid=(int)$pdo->lastInsertId();$pdo->commit();}catch(Throwable $x){if($pdo->inTransaction())$pdo->rollBack();throw$x;}
    try{$username='vytrial_u'.$userId.'_t'.$tid;$driver=bluegate_provider_driver($providerId);$targets=function_exists('bluegate_map_inbound_ids')?bluegate_map_inbound_ids($map):[(string)$map['remote_target_id']];$r=$driver->createService(['email'=>$username,'external_username'=>$username,'inbound_ids'=>$targets,'inbound_id'=>(string)($targets[0]??$map['remote_target_id']),'remote_target_id'=>(string)($targets[0]??$map['remote_target_id']),'provider_config'=>$cfg,'traffic_limit_bytes'=>(int)$s['traffic_limit_bytes'],'expires_at'=>$expires]);$sub=$r['subscription']['url']??$r['subscription_url']??null;$ext=(string)($r['external_client_id']??$r['id']??$username);db()->prepare('INSERT INTO service_instances (user_service_id,provider_id,external_client_id,external_username,remote_target_id,status,subscription_url,traffic_limit_bytes,expires_at,metadata_json) VALUES (?,?,?,?,?,"active",?,?,?,?)')->execute([$sid,$providerId,$ext,$username,(string)$map['remote_target_id'],$sub,(int)$s['traffic_limit_bytes'],$expires,json_encode(['trial'=>true,'provider_result'=>$r],JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE)]);$iid=(int)db()->lastInsertId();if(function_exists('bluegate_sync_instance_targets'))bluegate_sync_instance_targets($iid,$targets);db()->prepare('UPDATE user_services SET status="active" WHERE id=?')->execute([$sid]);db()->prepare('UPDATE trial_requests SET status="active",provisioned_at=NOW() WHERE id=?')->execute([$tid]);db()->prepare('INSERT INTO service_events (user_service_id,service_instance_id,event_type,title,details_json) VALUES (?,? ,"trial_started","Trial started",?)')->execute([$sid,$iid,json_encode(['trial_request_id'=>$tid],JSON_UNESCAPED_SLASHES)]);return bluegate_service_public(bluegate_service_record($sid,$userId),true);}catch(Throwable $x){db()->prepare('UPDATE trial_requests SET status="failed",reason=? WHERE id=?')->execute([mb_substr($x->getMessage(),0,255),$tid]);db()->prepare('UPDATE user_services SET status="provisioning_failed" WHERE id=?')->execute([$sid]);throw$x;}
}
function bluegate_ticket_record(int $ticketId, int $userId=0): ?array {
    $sql='SELECT t.*,u.username,u.first_name FROM support_tickets t JOIN users u ON u.id=t.user_id WHERE t.id=?';
    $args=[$ticketId];
    if($userId>0){$sql.=' AND t.user_id=?';$args[]=$userId;}
    $q=db()->prepare($sql);$q->execute($args);$row=$q->fetch();
    return $row?:null;
}
function bluegate_user_tickets(int $uid,int $limit=50): array {$q=db()->prepare('SELECT t.*,COUNT(m.id) message_count,MAX(m.created_at) last_message_at FROM support_tickets t LEFT JOIN support_messages m ON m.ticket_id=t.id WHERE t.user_id=? GROUP BY t.id ORDER BY last_message_at DESC,t.id DESC LIMIT '.max(1,min(100,$limit)));$q->execute([$uid]);return$q->fetchAll()?:[];}
function bluegate_ticket_messages(int $ticketId, string $viewerType=''): array {
    if($viewerType==='user')db()->prepare('UPDATE support_messages SET read_at=COALESCE(read_at,NOW()) WHERE ticket_id=? AND sender_type="admin"')->execute([$ticketId]);
    if($viewerType==='admin')db()->prepare('UPDATE support_messages SET read_at=COALESCE(read_at,NOW()) WHERE ticket_id=? AND sender_type="user"')->execute([$ticketId]);
    $q=db()->prepare('SELECT id,ticket_id,sender_type,sender_id,body,attachment_url,attachment_name,attachment_mime,created_at,delivered_at,read_at FROM support_messages WHERE ticket_id=? ORDER BY id');$q->execute([$ticketId]);return$q->fetchAll()?:[];
}
function bluegate_ticket_attachment(?string $data, ?string $name=''): array {
    $data=trim((string)$data);$name=trim((string)$name);
    if($data==='')return ['url'=>null,'name'=>null,'mime'=>null];
    if(strlen($data)>8*1024*1024||!preg_match('#^data:([^;,]+);base64,(.+)$#s',$data,$m))throw new RuntimeException('TICKET_ATTACHMENT_INVALID');
    $bin=base64_decode($m[2],true);if($bin===false||strlen($bin)>5*1024*1024)throw new RuntimeException('TICKET_ATTACHMENT_TOO_LARGE');
    $fi=new finfo(FILEINFO_MIME_TYPE);$mime=(string)$fi->buffer($bin);$allowed=['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp','application/pdf'=>'pdf','text/plain'=>'txt'];
    if(!isset($allowed[$mime]))throw new RuntimeException('TICKET_ATTACHMENT_TYPE_UNSUPPORTED');
    $dir=__DIR__.'/../public/uploads/support';if(!is_dir($dir)&&!mkdir($dir,0750,true))throw new RuntimeException('TICKET_ATTACHMENT_SAVE_FAILED');
    $file=bin2hex(random_bytes(16)).'.'.$allowed[$mime];if(file_put_contents($dir.'/'.$file,$bin,LOCK_EX)===false)throw new RuntimeException('TICKET_ATTACHMENT_SAVE_FAILED');
    return ['url'=>'/uploads/support/'.$file,'name'=>mb_substr($name!==''?$name:('attachment.'.$allowed[$mime]),0,255),'mime'=>$mime];
}
function bluegate_create_ticket(int $uid,array $in): array {
    $sub=trim((string)($in['subject']??''));$body=trim((string)($in['message']??''));
    if($sub===''||$body==='')throw new RuntimeException('TICKET_SUBJECT_MESSAGE_REQUIRED');
    if(mb_strlen($sub)>255||mb_strlen($body)>4000)throw new RuntimeException('TICKET_MESSAGE_TOO_LONG');
    $sid=max(0,(int)($in['service_id']??0));if($sid&&!bluegate_service_record($sid,$uid))throw new RuntimeException('SERVICE_NOT_FOUND');
    $oid=max(0,(int)($in['order_id']??0));if($oid){$q=db()->prepare('SELECT id FROM orders WHERE id=? AND user_id=?');$q->execute([$oid,$uid]);if(!$q->fetchColumn())throw new RuntimeException('ORDER_NOT_FOUND');}
    $category=substr((string)($in['category']??'other'),0,64);$priority=in_array(($in['priority']??'normal'),['low','normal','high','urgent'],true)?(string)$in['priority']:'normal';
    db()->prepare('INSERT INTO support_tickets (user_id,user_service_id,order_id,category,priority,status,subject,last_message_at) VALUES (?,?,?,?,?,"open",?,NOW())')->execute([$uid,$sid?:null,$oid?:null,$category,$priority,mb_substr($sub,0,255)]);
    $id=(int)db()->lastInsertId();$a=bluegate_ticket_attachment($in['attachment_data']??null,$in['attachment_name']??'');db()->prepare('INSERT INTO support_messages (ticket_id,sender_type,sender_id,body,attachment_url,attachment_name,attachment_mime,delivered_at) VALUES (?,"user",?,?,?,?,?,NOW())')->execute([$id,$uid,$body,$a['url'],$a['name'],$a['mime']]);
    if(function_exists('notify_admins'))notify_admins("🎫 <b>تیکت جدید #{$id}</b>\n".h($sub));
    return ['ticket_id'=>$id,'ticket'=>bluegate_ticket_record($id,$uid)];
}
function bluegate_reply_ticket(int $ticketId,string $senderType,int $senderId,string $body,?string $attachmentData=null,?string $attachmentName=null): void {
    $body=trim($body);if($body==='')throw new RuntimeException('EMPTY_MESSAGE');if(mb_strlen($body)>4000)throw new RuntimeException('TICKET_MESSAGE_TOO_LONG');
    $ticket=bluegate_ticket_record($ticketId);if(!$ticket)throw new RuntimeException('TICKET_NOT_FOUND');
    if($ticket['status']==='closed')throw new RuntimeException('TICKET_CLOSED');
    $a=bluegate_ticket_attachment($attachmentData,$attachmentName);db()->prepare('INSERT INTO support_messages (ticket_id,sender_type,sender_id,body,attachment_url,attachment_name,attachment_mime,delivered_at) VALUES (?,?,?,?,?,?,?,NOW())')->execute([$ticketId,$senderType,$senderId,$body,$a['url'],$a['name'],$a['mime']]);
    $status=$senderType==='admin'?'waiting_customer':'waiting_admin';db()->prepare('UPDATE support_tickets SET status=?,last_message_at=NOW(),closed_at=NULL WHERE id=?')->execute([$status,$ticketId]);
    if($senderType!=='admin'&&function_exists('notify_admins'))notify_admins("💬 <b>پاسخ جدید در تیکت #{$ticketId}</b>");
}
function bluegate_service_usage_history(int $serviceId,int $userId=0,int $days=30): array {if($userId&&!bluegate_service_record($serviceId,$userId))throw new RuntimeException('SERVICE_NOT_FOUND');$days=max(1,min(365,$days));$q=db()->prepare('SELECT created_at,SUM(traffic_used_bytes) traffic_used_bytes,SUM(COALESCE(traffic_limit_bytes,0)) traffic_limit_bytes,MIN(expires_at) expires_at FROM service_usage_snapshots WHERE user_service_id=? AND created_at>=DATE_SUB(NOW(),INTERVAL '.$days.' DAY) GROUP BY DATE_FORMAT(created_at,"%Y-%m-%d %H:00:00") ORDER BY created_at');$q->execute([$serviceId]);return$q->fetchAll()?:[];}
function bluegate_service_event_history(int $serviceId,int $userId=0,int $limit=100): array {if($userId&&!bluegate_service_record($serviceId,$userId))throw new RuntimeException('SERVICE_NOT_FOUND');$q=db()->prepare('SELECT * FROM service_events WHERE user_service_id=? ORDER BY id DESC LIMIT '.max(1,min(300,$limit)));$q->execute([$serviceId]);return$q->fetchAll()?:[];}
function bluegate_provider_economics(int $providerId): array {$q=db()->prepare('SELECT * FROM provider_economics WHERE provider_id=?');$q->execute([$providerId]);return$q->fetch()?:['provider_id'=>$providerId,'monthly_cost'=>0,'cost_currency'=>'USD','bandwidth_cost_per_gb'=>0,'maintenance_mode'=>0,'soft_capacity_percent'=>90];}
function bluegate_save_provider_economics(array $in): array {$pid=(int)($in['provider_id']??0);if($pid<=0||!bluegate_provider($pid))throw new RuntimeException('PROVIDER_NOT_FOUND');db()->prepare('INSERT INTO provider_economics (provider_id,monthly_cost,cost_currency,bandwidth_cost_per_gb,maintenance_mode,maintenance_message,soft_capacity_percent) VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE monthly_cost=VALUES(monthly_cost),cost_currency=VALUES(cost_currency),bandwidth_cost_per_gb=VALUES(bandwidth_cost_per_gb),maintenance_mode=VALUES(maintenance_mode),maintenance_message=VALUES(maintenance_message),soft_capacity_percent=VALUES(soft_capacity_percent)')->execute([$pid,max(0,(float)($in['monthly_cost']??0)),substr(strtoupper((string)($in['cost_currency']??'USD')),0,8),max(0,(float)($in['bandwidth_cost_per_gb']??0)),!empty($in['maintenance_mode'])?1:0,trim((string)($in['maintenance_message']??''))?:null,max(1,min(100,(int)($in['soft_capacity_percent']??90)))]);return bluegate_provider_economics($pid);}
function bluegate_provider_analytics(): array {
    $sql='SELECT p.id,p.name,p.driver,p.status,COALESCE(e.monthly_cost,0) monthly_cost,COALESCE(e.cost_currency,"USD") cost_currency,COALESCE(e.bandwidth_cost_per_gb,0) bandwidth_cost_per_gb,COALESCE(e.maintenance_mode,0) maintenance_mode,e.maintenance_message,COALESCE(e.soft_capacity_percent,90) soft_capacity_percent,COUNT(DISTINCT si.id) active_instances,COUNT(DISTINCT si.user_service_id) active_services,COALESCE(SUM(si.traffic_used_bytes),0) traffic_used_bytes,COALESCE(SUM(si.traffic_limit_bytes),0) traffic_limit_bytes FROM service_providers p LEFT JOIN provider_economics e ON e.provider_id=p.id LEFT JOIN service_instances si ON si.provider_id=p.id AND si.status IN ("active","degraded","suspended") GROUP BY p.id ORDER BY p.id';
    $rows=db()->query($sql)->fetchAll()?:[];
    foreach($rows as &$r){$q=db()->prepare('SELECT COALESCE(SUM(x.final_amount),0) revenue_toman FROM (SELECT DISTINCT o.id,o.final_amount FROM service_instances si JOIN user_services us ON us.id=si.user_service_id JOIN orders o ON o.id=us.order_id WHERE si.provider_id=? AND o.status="delivered") x');$q->execute([(int)$r['id']]);$r['revenue_toman']=(int)$q->fetchColumn();$used=(float)$r['traffic_used_bytes']/1073741824;$r['estimated_bandwidth_cost']=(float)$r['bandwidth_cost_per_gb']*$used;}
    unset($r);return $rows;
}
function bluegate_advanced_dashboard(): array {return ['phase'=>10,'phase9_skipped'=>true,'trial'=>bluegate_trial_settings(),'provider_analytics'=>table_exists('provider_economics')?bluegate_provider_analytics():[],'tickets_open'=>table_exists('support_tickets')?(int)db()->query("SELECT COUNT(*) FROM support_tickets WHERE status NOT IN ('closed','resolved')")->fetchColumn():0,'trials_active'=>table_exists('trial_requests')?(int)db()->query("SELECT COUNT(*) FROM trial_requests WHERE status='active' AND (expires_at IS NULL OR expires_at>NOW())")->fetchColumn():0];}
