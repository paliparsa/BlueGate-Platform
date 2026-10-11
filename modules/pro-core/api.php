<?php
/** API routes physically shipped with Veyra Pro Core. */
function veyra_pro_api_handler(string $action,array $input,array $user): bool {

    if ($action === 'admin_routing_settings') { require_admin($user); try{$r=veyra_save_routing_settings($input);log_admin_action((int)$user['telegram_id'],'routing_settings','system',1);api_out(['ok'=>true,'settings'=>$r,'routing'=>veyra_routing_dashboard(),'infrastructure'=>veyra_infrastructure_summary()]);}catch(Throwable $e){api_out(['ok'=>false,'error'=>api_exception_code($e),'message'=>'Saving routing settings failed.'],400);} }

    if ($action === 'admin_monitoring_run') { require_admin($user);try{$r=veyra_run_monitoring((int)($input['limit']??0));api_out(['ok'=>true,'result'=>$r,'monitoring'=>veyra_monitoring_dashboard(),'infrastructure'=>veyra_infrastructure_summary()]);}catch(Throwable $e){api_out(['ok'=>false,'error'=>api_exception_code($e),'message'=>'Monitoring run failed.'],500);} }

    if ($action === 'admin_monitoring_settings') { require_admin($user); try{$r=veyra_save_monitoring_settings($input);log_admin_action((int)$user['telegram_id'],'monitoring_settings','system',1);api_out(['ok'=>true,'settings'=>$r,'monitoring'=>veyra_monitoring_dashboard()]);}catch(Throwable $e){api_out(['ok'=>false,'error'=>api_exception_code($e),'message'=>'Saving monitoring settings failed.'],400);} }

    if ($action === 'admin_catalog_apply') {
        require_admin($user);
        if (strtoupper(trim((string)($input['confirm'] ?? ''))) !== 'APPLY') api_out(['ok'=>false,'message'=>'برای اعمال Migration باید Preview را تأیید کنی.'],400);
        try { $result=catalog_apply_legacy_mapping(); log_admin_action((int)$user['telegram_id'],'catalog_v2_apply','catalog',0,'legacy mapping applied'); api_out(admin_payload()+['catalog_result'=>$result]); }
        catch(Throwable $e){ api_out(['ok'=>false,'error'=>api_exception_code($e),'message'=>'اعمال کاتالوگ انجام نشد؛ دیتای Legacy دست‌نخورده باقی ماند.'],400); }
    }

    if ($action === 'admin_catalog_apply_one') {
        require_admin($user); $legacyId=(int)($input['legacy_product_id']??0);
        if($legacyId<=0 || strtoupper(trim((string)($input['confirm']??'')))!=='APPLY') api_out(['ok'=>false,'message'=>'تأیید این مورد لازم است.'],400);
        try{$result=catalog_apply_legacy_product($legacyId);log_admin_action((int)$user['telegram_id'],'catalog_v2_apply_one','product',$legacyId,'manual mapping');api_out(admin_payload()+['catalog_result'=>$result]);}
        catch(Throwable $e){api_out(['ok'=>false,'error'=>api_exception_code($e),'message'=>'نگاشت دستی این مورد انجام نشد.'],400);}
    }

    if ($action === 'admin_catalog_move_group') {
        require_admin($user); $gid=(int)($input['group_id']??0); $sid=(int)($input['service_id']??0);
        if($gid<=0||$sid<=0) api_out(['ok'=>false,'message'=>'سرویس و زیرسرویس معتبر انتخاب کن.'],400);
        catalog_move_group($gid,$sid); log_admin_action((int)$user['telegram_id'],'catalog_move_group','service_group',$gid,'to service '.$sid); api_out(admin_payload());
    }

    if ($action === 'admin_catalog_move_plan') {
        require_admin($user); $pid=(int)($input['plan_id']??0); $gid=(int)($input['group_id']??0);
        if($pid<=0||$gid<=0) api_out(['ok'=>false,'message'=>'زیرسرویس و پلن معتبر انتخاب کن.'],400);
        catalog_move_plan($pid,$gid); log_admin_action((int)$user['telegram_id'],'catalog_move_plan','service_plan',$pid,'to group '.$gid); api_out(admin_payload());
    }

    if ($action === 'admin_notification_broadcast') {
        require_admin($user); api_require_pro_capability('marketing_automation','کمپین و اعلان همگانی در Veyra Pro فعال است.');
        $title=trim((string)($input['title']??''));$body=trim((string)($input['body']??''));
        if($title==='')api_out(['ok'=>false,'error'=>'TITLE_REQUIRED','message'=>'عنوان اعلان الزامی است.'],400);
        $type=trim((string)($input['type']??'info'));$audience=trim((string)($input['audience']??'all'));
        $actionType=trim((string)($input['action_type']??''));$actionValue=trim((string)($input['action_value']??''));
        if($actionType==='url'&&$actionValue!==''&&!preg_match('#^https://#i',$actionValue))api_out(['ok'=>false,'error'=>'INVALID_URL','message'=>'لینک اعلان باید با https:// شروع شود.'],400);
        try{$campaign=create_notification_campaign((int)$user['telegram_id'],$type,$title,$body,$actionType,$actionValue,$audience);log_admin_action((int)$user['telegram_id'],'notification_broadcast','notification_campaign',(int)$campaign['id'],$campaign['recipient_count'].' recipients');api_out(admin_payload()+['notification_campaign'=>$campaign,'message'=>'اعلان برای '.number_format((int)$campaign['recipient_count']).' کاربر ثبت شد.']);}
        catch(Throwable $e){api_out(['ok'=>false,'error'=>api_exception_code($e),'message'=>'ارسال اعلان انجام نشد.'],500);}
    }

    if ($action === 'admin_broadcast') {
        require_admin($user); api_require_pro_capability('marketing_automation','ارسال همگانی و کمپین‌های بازاریابی در Veyra Pro فعال است.');$text=trim((string)($input['text']??''));if($text===''&&empty($input['media_b64']))api_out(['ok'=>false,'message'=>'متن پیام یا فایل الزامی است.'],400);$fileId=null;$method='sendMessage';$field=null;
        if(!empty($input['media_b64'])){$parts=explode(',',(string)$input['media_b64']);$decoded=base64_decode(count($parts)===2?$parts[1]:$parts[0],true);if($decoded===false||strlen($decoded)>20*1024*1024)api_out(['ok'=>false,'message'=>'فایل نامعتبر یا بیش از حد بزرگ است.'],400);$filename=preg_replace('/[^a-zA-Z0-9.\-_]/','',(string)($input['filename']??'file.dat'))?:'file.dat';$tmp=sys_get_temp_dir().'/nx_bc_'.bin2hex(random_bytes(6)).'_'.$filename;file_put_contents($tmp,$decoded);$mime=mime_content_type($tmp)?:'application/octet-stream';$method=str_starts_with($mime,'image/')&&!str_contains($mime,'svg')&&!str_contains($mime,'gif')?'sendPhoto':((str_starts_with($mime,'video/')||str_contains($mime,'gif'))?'sendVideo':'sendDocument');$field=['sendPhoto'=>'photo','sendVideo'=>'video','sendDocument'=>'document'][$method];$res=tg($method,['chat_id'=>(int)$user['telegram_id'],$field=>new CURLFile($tmp,$mime,$filename),'caption'=>$text,'parse_mode'=>'HTML']);@unlink($tmp);if(empty($res['ok']))api_out(['ok'=>false,'message'=>'آپلود فایل به تلگرام شکست خورد.'],500);$msg=$res['result']??[];if($field==='photo'){$ph=$msg['photo']??[];$last=$ph?end($ph):null;$fileId=$last['file_id']??null;}else $fileId=$msg[$field]['file_id']??null;if(!$fileId)api_out(['ok'=>false,'message'=>'شناسه فایل تلگرام دریافت نشد.'],500);}
        $job=queue_broadcast_job((int)$user['telegram_id'],$text,$method,$field,$fileId);log_admin_action((int)$user['telegram_id'],'broadcast_queue','broadcast_job',(int)$job['id'],$job['total_count'].' recipients');api_out(admin_payload()+['broadcast_job'=>$job,'message'=>'ارسال همگانی در صف قرار گرفت و توسط Cron پردازش می‌شود.']);
    }

    if ($action === 'admin_set_role') { require_admin($user); api_require_pro_capability('team_roles','مدیریت چند ادمین و نقش‌ها در Veyra Pro فعال است.'); if(admin_role((int)$user['telegram_id'])!=='full') api_out(['ok'=>false,'error'=>'FULL_ADMIN_ONLY','message'=>'فقط ادمین کامل می‌تواند نقش بسازد.'],403); $tid=(int)($input['telegram_id']??0); $role=(string)($input['role']??'full'); $name=(string)($input['display_name']??''); if($tid<=0) api_out(['ok'=>false,'error'=>'INVALID_TID','message'=>'Telegram ID نامعتبر.'],400); log_admin_action((int)$user['telegram_id'],'set_role','admin_role',$tid,$role); $list=admin_set_role($tid,$role,$name); api_out(['ok'=>true,'admin_roles'=>$list]); }

    if ($action === 'admin_remove_role') { require_admin($user); api_require_pro_capability('team_roles','مدیریت چند ادمین و نقش‌ها در Veyra Pro فعال است.'); if(admin_role((int)$user['telegram_id'])!=='full') api_out(['ok'=>false,'error'=>'FULL_ADMIN_ONLY','message'=>'فقط ادمین کامل می‌تواند نقش حذف کند.'],403); $tid=(int)($input['telegram_id']??0); log_admin_action((int)$user['telegram_id'],'remove_role','admin_role',$tid); $list=admin_remove_role($tid); api_out(['ok'=>true,'admin_roles'=>$list]); }

    if ($action === 'admin_backup_send_bot') { require_admin($user); api_require_pro_capability('advanced_backups','ارسال، خروجی و بازیابی پیشرفته بکاپ در Veyra Pro فعال است.'); $b=blue_backup_send_to_admin((int)$user['telegram_id']); api_out(admin_payload() + ['backup'=>$b, 'message'=>'Backup sent to your Telegram chat.']); }

    if ($action === 'admin_backup_restore_server') { require_admin($user); api_require_pro_capability('advanced_backups','Restore پیشرفته در Veyra Pro فعال است.'); $fn=(string)($input['filename']??''); if (!empty($input['confirm']) && strtoupper((string)$input['confirm'])==='RESTORE') { $res=blue_backup_restore_from_file(blue_backup_file_path($fn), true); api_out(admin_payload() + ['restore'=>$res, 'message'=>'Backup restored.']); } api_out(['ok'=>false,'message'=>'برای restore باید confirm=RESTORE ارسال شود.'],400); }

    if ($action === 'trial_request') { try{api_out(['ok'=>true,'service'=>veyra_request_trial((int)$user['id']),'trial'=>veyra_trial_eligibility((int)$user['id'])]);}catch(Throwable $e){api_out(['ok'=>false,'error'=>api_exception_code($e),'message'=>'Trial could not be created.'],400);} }

    if ($action === 'admin_advanced_summary') { require_admin($user);api_out(['ok'=>true,'advanced'=>veyra_advanced_dashboard()]); }

    if ($action === 'admin_trial_settings') { require_admin($user);try{api_out(['ok'=>true,'settings'=>veyra_save_trial_settings($input),'advanced'=>veyra_advanced_dashboard()]);}catch(Throwable $e){api_out(['ok'=>false,'error'=>api_exception_code($e)],400);} }

    if ($action === 'admin_provider_economics') { require_admin($user); try{api_out(['ok'=>true,'economics'=>veyra_save_provider_economics($input),'advanced'=>veyra_advanced_dashboard()]);}catch(Throwable $e){api_out(['ok'=>false,'error'=>api_exception_code($e)],400);} }

    if ($action === 'admin_save_vip_rates') {
        require_admin($user); api_require_pro_capability('advanced_commerce','قیمت‌گذاری VIP و قوانین تجاری پیشرفته در Veyra Pro فعال است.');
        $rates = is_array($input['vip_tier_rates'] ?? null) ? $input['vip_tier_rates'] : [];
        if (!empty($rates)) {
            set_setting('vip_tier_rates', $rates);
        }
        api_out(admin_payload() + ['message' => 'نرخ‌های VIP با موفقیت به روز شد.']);
    }
    return false;
}
veyra_register_api_handler('veyra_pro_api_handler');
