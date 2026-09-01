<?php
if (!ob_start('ob_gzhandler')) { ob_start(); }
require_once __DIR__ . '/../app/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
header('Vary: Accept-Encoding');
$requestOrigin = trim((string)($_SERVER['HTTP_ORIGIN'] ?? ''));
$allowedOrigin = trim((string)app_config('WEB_ALLOWED_ORIGIN', ''));
if ($requestOrigin !== '') {
    $originHost = strtolower((string)(parse_url($requestOrigin, PHP_URL_HOST) ?: ''));
    $requestHost = strtolower(preg_replace('/:\d+$/', '', (string)($_SERVER['HTTP_HOST'] ?? '')));
    if (($allowedOrigin !== '' && rtrim($requestOrigin, '/') === rtrim($allowedOrigin, '/')) || ($originHost !== '' && $originHost === $requestHost)) {
        header('Access-Control-Allow-Origin: '.$requestOrigin);
        header('Access-Control-Allow-Credentials: true');
    }
}
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Web-Token');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

function api_out(array $data, int $code = 200): void { http_response_code($code); echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }
set_exception_handler(function(Throwable $e){
    error_log('[BlueReferral API] '.$e->getMessage().' in '.$e->getFile().':'.$e->getLine());
    if (!headers_sent()) api_out(['ok'=>false,'error'=>'SERVER_ERROR','message'=>'خطای داخلی سرور؛ لاگ را بررسی کن.'], 500);
});
register_shutdown_function(function(){
    $e = error_get_last();
    if ($e && in_array($e['type'], [E_ERROR,E_PARSE,E_CORE_ERROR,E_COMPILE_ERROR], true) && !headers_sent()) {
        http_response_code(500);
        echo json_encode(['ok'=>false,'error'=>'FATAL_ERROR','message'=>'خطای داخلی سرور؛ لاگ را بررسی کن.'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
});
function request_json(): array { $raw = file_get_contents('php://input'); $data = json_decode($raw ?: '{}', true); return is_array($data) ? $data : []; }
function api_rate_limit(string $bucket,string $identity,int $max,int $window,int $block=0): void {$r=security_rate_limit($bucket,security_client_ip().'|'.$identity,$max,$window,$block);if(empty($r['allowed'])){header('Retry-After: '.(int)$r['retry_after']);api_out(['ok'=>false,'error'=>'RATE_LIMITED','message'=>'تعداد تلاش‌ها بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.','retry_after'=>(int)$r['retry_after']],429);}}
function api_exception_code(Throwable $e,string $fallback='REQUEST_FAILED'): string {
    $raw=trim((string)$e->getMessage());
    if(preg_match('/^[A-Z][A-Z0-9_]{2,80}$/',$raw))return $raw;
    error_log('[BlueGate API handled exception] '.$raw);
    return $fallback;
}
function api_exception_message(Throwable $e,string $fallback): string {
    $raw=trim((string)$e->getMessage());
    $unsafe=$raw===''||mb_strlen($raw)>240||preg_match('/SQLSTATE|PDO|HTTP_FAILED|CURL|\bBODY\b|stack trace|\.php:\d+/i',$raw);
    if(!$unsafe && $e instanceof RuntimeException && !preg_match('/^[A-Z][A-Z0-9_]{2,80}$/',$raw))return $raw;
    if($unsafe)error_log('[BlueGate API hidden exception] '.$raw);
    return $fallback;
}
function api_cookie_token(): string { return trim((string)($_COOKIE['bg_session']??'')); }
function api_set_session_cookie(string $token, bool $remember=true): void {$secure=(!empty($_SERVER['HTTPS'])&&strtolower((string)$_SERVER['HTTPS'])!=='off')||((string)($_SERVER['HTTP_X_FORWARDED_PROTO']??'')==='https');$origin=trim((string)app_config('WEB_ALLOWED_ORIGIN',''));$apiHost=strtolower((string)($_SERVER['HTTP_HOST']??''));$originHost=strtolower((string)(parse_url($origin,PHP_URL_HOST)?:''));$sameSite=($originHost&&$apiHost&&!str_contains($apiHost,$originHost)&&!str_contains($originHost,preg_replace('/:\d+$/','',$apiHost)))?'None':'Lax';$expires=$remember?time()+max(1,setting_int('auth_token_ttl_hours',168))*3600:0;setcookie('bg_session',$token,['expires'=>$expires,'path'=>'/','secure'=>$secure,'httponly'=>true,'samesite'=>$sameSite]);}
function api_clear_session_cookie(): void { setcookie('bg_session','',['expires'=>time()-3600,'path'=>'/','secure'=>!empty($_SERVER['HTTPS']),'httponly'=>true,'samesite'=>'Lax']); }
function api_issue_session(int $userId, bool $remember=true): void {$t=issue_user_auth_token($userId);api_set_session_cookie($t,$remember);}

function get_authenticated_user(string $initData, ?string $authToken = null): array|false {
    if (!empty($initData)) {
        $validated = verify_webapp_init_data($initData);
        if ($validated && !empty($validated['user'])) {
            $tgUser = json_decode($validated['user'], true);
            if ($tgUser && !empty($tgUser['id'])) {
                $user = create_or_update_user($tgUser, null);
                // Never block Mini App authentication on a Telegram Bot API network call.
                // Referral reward / force-join housekeeping is handled by the bot flow and can
                // be retried independently; authentication itself must remain local and fast.
                $fullUser = get_user_by_tid((int)$tgUser['id']);
                if ($fullUser && !user_is_blocked($fullUser)) return $fullUser;
            }
        }
    }
    if (!empty($authToken)) {
        $user = get_user_by_token($authToken);
        if ($user && !user_is_blocked($user)) {
            if (setting_bool('require_email_verification', true) && !empty($user['email']) && empty($user['email_verified_at'])) {
                return false;
            }
            return $user;
        }
    }
    return false;
}
function webapp_auth_user(string $initData): array {
    $u = get_authenticated_user($initData, null);
    if (!$u) api_out(['ok'=>false, 'error'=>'INVALID_TELEGRAM_WEBAPP_DATA', 'message'=>'Mini App باید داخل تلگرام باز شود.'], 401);
    return $u;
}
function guest_dashboard_payload(): array {
    $dir = __DIR__ . '/../storage/cache';
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    $cacheFile = $dir . '/guest_payload.json';
    if (is_file($cacheFile) && (time() - filemtime($cacheFile) < 30)) {
        $content = @file_get_contents($cacheFile);
        $json = json_decode($content ?: '', true);
        if (is_array($json)) return $json;
    }

    $products = array_map(fn($p)=>product_payload($p, true), storefront_shop_products());
    $payload = [
        'ok' => true,
        'is_guest' => true,
        'bot_username' => app_config('BOT_USERNAME',''),
        'brand' => setting('brand_name', app_config('BRAND_NAME', 'BlueGate')),
        'theme_color' => setting('theme_color', app_config('DEFAULT_THEME_COLOR', '#1d9bf0')),
        'button_colors_enabled' => setting_bool('button_colors_enabled', true),
        'button_colors' => button_colors(),
        'require_contact_auth' => false,
        'notify_new_user' => false,
        'start_reward' => setting_int('start_reward', 2000),
        'spin_every' => setting_int('spin_referrals_per_chance', 5),
        'spin_rewards' => spin_rewards_public(),
        'support_username' => setting('support_username', app_config('SUPPORT_USERNAME', 'BlueGateSupport')),
        'custom_code_min' => setting_int('custom_code_min_referrals', 3),
        'is_admin' => false,
        'user' => [
            'telegram_id' => 0,
            'username' => 'guest',
            'first_name' => 'کاربر میهمان',
            'last_name' => null,
            'phone_number' => null,
            'ref_code' => '',
            'referral_link' => '',
            'balance' => 0,
            'total_earned' => 0,
            'referrals_count' => 0,
            'today_referrals' => 0,
            'spin_balance' => 0,
            'is_guest' => true,
            'vip' => vip_info(0)
        ],
        'missions' => [],
        'leaderboard' => array_map(function($r){ return ['name'=>strip_tags(display_name($r)), 'referrals'=>(int)$r['referrals_count'], 'earned'=>(int)$r['total_earned']]; }, top_users(10)),
        'transactions' => [],
        'shop_categories' => array_map('category_payload', shop_categories(true)),
        'shop_products' => $products,
        'catalog' => catalog_public_payload(),
        'orders' => [],
        'payment_methods' => payment_methods_public(null),
        'payment_instructions' => setting('payment_instructions', 'لطفاً پرداخت را انجام دهید و رسید را ارسال کنید.'),
        'storefront_settings' => storefront_settings_payload(),
        'storefront_content' => storefront_content_payload(),
        'storefront_rates' => storefront_rates_payload(),
        'achievements' => []
    ];
    @file_put_contents($cacheFile, json_encode($payload, JSON_UNESCAPED_UNICODE));
    return $payload;
}
function product_payload(array $p, bool $activeVariants=true): array {
    if (array_key_exists('__catalog_variant_ids', $p)) {
        $variantRows=[];
        foreach((array)$p['__catalog_variant_ids'] as $vid){$v=product_variant((int)$vid);if($v&&(!$activeVariants||(int)$v['is_active']===1))$variantRows[]=$v;}
    } else $variantRows=product_variants((int)$p['id'], $activeVariants);
    $variants = array_map(function($v){
        $pm = price_meta_public($v);
        $vDiscount = (float)($v['discount_percent'] ?? 0);
        $rawVPrice = (int)$pm['toman'];
        $vOrigPrice = ($vDiscount > 0 && $vDiscount < 100) ? (int)round($rawVPrice / (1 - $vDiscount / 100)) : (int)($v['old_price'] ?? 0);
        return [
            'id' => (int)$v['id'],
            'product_id' => (int)$v['product_id'],
            'title' => $v['title'],
            'price' => $rawVPrice,
            'old_price' => $vOrigPrice,
            'price_label' => $pm['label'],
            'price_currency' => $pm['currency'],
            'price_usd' => $pm['usd'],
            'price_meta' => $pm,
            'duration_days' => (int)$v['duration_days'],
            'discount_percent' => $vDiscount,
            'description' => $v['description'] ?? '',
            'image_url' => $v['plan_image_url'] ?? null,
            'delivery_type' => $v['plan_delivery_type'] ?? $v['delivery_type'] ?? null,
            'delivery_type_fa' => delivery_type_fa($v['plan_delivery_type'] ?? $v['delivery_type'] ?? 'manual'),
            'commission_type' => $v['plan_commission_type'] ?? $v['commission_type'] ?? 'none',
            'commission_value' => (int)($v['plan_commission_value'] ?? $v['commission_value'] ?? 0),
            'sort_order' => (int)($v['sort_order'] ?? 0),
            'is_active' => (int)($v['is_active'] ?? 1)
        ];
    }, $variantRows);

    $pm = price_meta_public($p);
    $rawPPrice = (int)$pm['toman'];
    $pOrigPrice = (int)($p['old_price'] ?? 0);

    return [
        'id' => (int)$p['id'],
        'slug' => $p['slug'] ?? null,
        'product_type' => $p['product_type'] ?? 'normal',
        'config' => storefront_product_config($p),
        'category_id' => isset($p['category_id']) ? (int)$p['category_id'] : 0,
        'parent_id' => isset($p['parent_id']) ? (int)$p['parent_id'] : 0,
        'child_count' => (int)($p['child_count'] ?? 0),
        'parent_name' => $p['parent_name'] ?? null,
        'category_title' => $p['category_title'] ?? null,
        'category_emoji' => $p['category_emoji'] ?? null,
        'name' => $p['name'],
        'price' => $rawPPrice,
        'old_price' => $pOrigPrice,
        'price_label' => product_price_label($p),
        'price_currency' => $pm['currency'],
        'price_usd' => $pm['usd'],
        'price_meta' => $pm,
        'short_description' => $p['short_description'],
        'full_description' => $p['full_description'],
        'image_url' => $p['image_url'] ?? null,
        'image_srcset' => $p['image_srcset'] ?? null,
        'delivery_type' => $p['delivery_type'],
        'delivery_type_fa' => delivery_type_fa($p['delivery_type']),
        'commission_type' => $p['commission_type'] ?? 'none',
        'commission_value' => (int)($p['commission_value'] ?? 0),
        'commission' => product_commission_text($p),
        'duration_days' => (int)($p['duration_days'] ?? 0),
        'variant_count' => (int)($p['variant_count'] ?? count($variants)),
        'variants' => $variants,
        'inventory_available' => (int)($p['inventory_available'] ?? 0),
        'is_featured' => (int)($p['is_featured'] ?? 0),
        'is_active' => (int)($p['is_active'] ?? 1),
        'discount_percent' => (int)($p['discount_percent'] ?? 0),
        'created_at' => $p['created_at'] ?? null,
        'updated_at' => $p['updated_at'] ?? null,
    ];
}
function category_payload(array $c): array { return ['id'=>(int)$c['id'],'title'=>$c['title'],'emoji'=>$c['emoji'],'image_url'=>$c['image_url'] ?? null,'sort_order'=>(int)($c['sort_order'] ?? 0),'is_active'=>(int)$c['is_active']]; }

function spin_rewards_public(): array {
    $items = setting_json('spin_rewards', app_config('SPIN_REWARDS', []));
    $out = [];
    foreach ($items as $i => $r) {
        $out[] = [
            'id' => $i,
            'title' => (string)($r['title'] ?? 'جایزه گردونه'),
            'amount' => (int)($r['amount'] ?? 0),
            'weight' => max(1, (int)($r['weight'] ?? 1)),
            'notify_admin' => !empty($r['notify_admin']) ? 1 : 0,
        ];
    }
    if (!$out) $out[] = ['id'=>0,'title'=>'💰 ۵,۰۰۰ تومان اعتبار کیف پول','amount'=>5000,'weight'=>1,'notify_admin'=>0];
    return $out;
}
function spin_rewards_lines(): string {
    return implode("\n", array_map(function($r){
        return ($r['title'] ?? 'جایزه') . '|' . (int)($r['amount'] ?? 0) . '|' . max(1,(int)($r['weight'] ?? 1)) . '|' . (!empty($r['notify_admin']) ? '1' : '0');
    }, spin_rewards_public()));
}
function parse_spin_rewards_lines(string $text): array {
    $rows = array_values(array_filter(array_map('trim', preg_split('/\R/u', $text))));
    $out = [];
    foreach ($rows as $row) {
        $parts = array_map('trim', explode('|', $row));
        $title = $parts[0] ?? '';
        if ($title === '') continue;
        $out[] = [
            'title' => $title,
            'amount' => max(0, (int)($parts[1] ?? 0)),
            'weight' => max(1, (int)($parts[2] ?? 1)),
            'notify_admin' => !empty($parts[3]) && !in_array(strtolower((string)$parts[3]), ['0','false','no','off'], true),
        ];
    }
    return $out ?: app_config('SPIN_REWARDS', []);
}
function user_payload(array $user): array {
    $vip = vip_info((int)$user['referrals_count']); $today = today_referrals((int)$user['id']); $customer = customer_stats((int)$user['id']);
    $telegramId=(int)($user['telegram_id']??0);$telegramConnected=$telegramId>0&&$telegramId<9000000000;
    $hasPassword=!empty($user['password_hash']);$completionChecks=[trim((string)($user['first_name']??''))!=='',trim((string)($user['web_username']??$user['username']??''))!=='',!empty($user['email_verified_at']),$telegramConnected];$profileCompletion=(int)round((count(array_filter($completionChecks))/count($completionChecks))*100);$securityScore=count(array_filter([$hasPassword,!empty($user['email_verified_at']),$telegramConnected]));$securityLevel=$securityScore>=3?'great':($securityScore>=2?'good':'attention');
    return ['id'=>(int)$user['id'], 'telegram_id'=>$telegramId, 'telegram_connected'=>$telegramConnected, 'username'=>$user['username'], 'web_username'=>$user['web_username']??null, 'first_name'=>$user['first_name'], 'last_name'=>$user['last_name'] ?? null, 'email'=>$user['email'] ?? null, 'email_verified_at'=>$user['email_verified_at']??null, 'phone_number'=>$user['phone_number'] ?? null, 'phone_verified_at'=>$user['phone_verified_at'] ?? null, 'ref_code'=>$user['ref_code'], 'referral_link'=>referral_link($user), 'balance'=>(int)$user['balance'], 'total_earned'=>(int)$user['total_earned'], 'referrals_count'=>(int)$user['referrals_count'], 'today_referrals'=>$today, 'spin_balance'=>(int)$user['spin_balance'], 'vip'=>$vip, 'customer'=>$customer, 'theme_color'=>$user['theme_color'] ?? null, 'member_since'=>$user['created_at']??null, 'has_password'=>$hasPassword, 'profile_completion'=>$profileCompletion, 'security_level'=>$securityLevel];
}
function safe_mini_optional(callable $fn, $fallback) {
    try { return $fn(); }
    catch (Throwable $e) { error_log('[MiniApp optional payload] '.$e->getMessage()); return $fallback; }
}
function active_services_from_order_payloads(array $orders, int $limit=12): array {
    $seen=[];$out=[];$now=time();
    foreach($orders as $o){
        if(normalize_order_status((string)($o['status']??''))!=='delivered') continue;
        if(!empty($o['expires_at']) && strtotime((string)$o['expires_at'])<$now) continue;
        $key=!empty($o['catalog_plan_id'])?'p'.(int)$o['catalog_plan_id']:'l'.(int)($o['product_id']??0).'v'.(int)($o['variant_id']??0);
        if(isset($seen[$key])) continue;$seen[$key]=1;$o['renewable']=1;$out[]=$o;
        if(count($out)>=$limit) break;
    }
    return $out;
}
function dashboard_payload(array $user): array {
    $missions = []; $today = date('Y-m-d'); $todayCount = today_referrals((int)$user['id']);
    foreach (mission_rows() as $m) $missions[] = ['target'=>(int)$m['target'], 'reward'=>(int)$m['reward'], 'done'=>$todayCount >= (int)$m['target'], 'claimed'=>is_mission_claimed((int)$user['id'], $today, (int)$m['target'])];
    $tx = db()->prepare('SELECT type, amount, description, created_at FROM transactions WHERE user_id=? ORDER BY id DESC LIMIT 15'); $tx->execute([$user['id']]);
    $products = array_map(fn($p)=>product_payload($p, true), storefront_shop_products());
    // Keep authentication/bootstrap deliberately small. Mini App enhancements are hydrated after first paint.
    $orders = array_map('order_public_payload', user_orders((int)$user['id'], 20));
    return ['ok'=>true, 'is_guest'=>false, 'bot_username'=>app_config('BOT_USERNAME',''), 'brand'=>setting('brand_name', app_config('BRAND_NAME', 'BlueGate')), 'theme_color'=>setting('theme_color', app_config('DEFAULT_THEME_COLOR', '#1d9bf0')), 'button_colors_enabled'=>setting_bool('button_colors_enabled', true), 'button_colors'=>button_colors(), 'require_contact_auth'=>setting_bool('require_contact_auth', false), 'notify_new_user'=>setting_bool('notify_new_user', true), 'start_reward'=>setting_int('start_reward', 2000), 'spin_every'=>setting_int('spin_referrals_per_chance', 5), 'spin_rewards'=>spin_rewards_public(), 'support_username'=>setting('support_username', app_config('SUPPORT_USERNAME', 'BlueGateSupport')), 'custom_code_min'=>setting_int('custom_code_min_referrals', 3), 'is_admin'=>is_admin($user), 'user'=>user_payload($user), 'missions'=>$missions, 'leaderboard'=>array_map(function($r){ return ['name'=>strip_tags(display_name($r)), 'referrals'=>(int)$r['referrals_count'], 'earned'=>(int)$r['total_earned']]; }, top_users(10)), 'transactions'=>$tx->fetchAll(), 'credit_topup'=>credit_topup_config(), 'credit_topups'=>array_map('credit_topup_public',credit_topups_for_user((int)$user['id'],12)), 'shop_categories'=>array_map('category_payload', shop_categories(true)), 'shop_products'=>$products, 'catalog'=>catalog_public_payload(), 'orders'=>$orders, 'payment_methods'=>payment_methods_public($user), 'payment_instructions'=>setting('payment_instructions', 'لطفاً پرداخت را انجام دهید و رسید را ارسال کنید.'), 'storefront_settings'=>storefront_settings_payload(), 'storefront_content'=>storefront_content_payload(), 'storefront_rates'=>storefront_rates_payload(), 'achievements'=>user_achievements($user)];
}
function require_admin(array $user): void { if (!is_admin($user)) api_out(['ok'=>false,'error'=>'ADMIN_ONLY','message'=>'دسترسی ادمین لازم است.'],403); }
function require_admin_perm(array $user,string $perm): void { require_admin($user);if(!admin_can((int)$user['telegram_id'],$perm))api_out(['ok'=>false,'error'=>'ADMIN_PERMISSION_DENIED','message'=>'نقش ادمین شما اجازه این عملیات را نمی‌دهد.'],403);}
function admin_payload(): array {
    $admin=$GLOBALS['BG_CURRENT_USER']??null;$tid=is_array($admin)?(int)($admin['telegram_id']??0):0;$role=$tid?admin_role($tid):'full';
    $payload=['ok'=>true,
        'report'=>sales_report(),
        'cleanup'=>['all'=>cleanup_orders_count(), 'older_7'=>cleanup_orders_count(7), 'older_30'=>cleanup_orders_count(30), 'archived'=>archived_orders_count()],
        'orders'=>array_map(fn($o)=>order_public_payload($o, true), admin_orders(null, 80)),
        'products'=>array_map(fn($p)=>product_payload($p, false), shop_products(null, false)),
        'categories'=>array_map('category_payload', shop_categories(false)),
        'inventory'=>inventory_items_for_admin(150),
        'variants'=>db()->query('SELECT v.*, p.name product_name FROM product_variants v JOIN products p ON p.id=v.product_id ORDER BY v.id DESC LIMIT 150')->fetchAll(),
        'catalog_admin'=>['tree'=>catalog_tree(false),'categories'=>catalog_store_categories(false),'preview'=>catalog_scan_legacy(),'public'=>catalog_public_payload(),'undo'=>catalog_undo_meta((int)(($GLOBALS['BG_CURRENT_USER']['telegram_id']??0)))],
        'credit_topups'=>array_map('credit_topup_public',credit_topups_for_admin(100)),
        'settings'=>['payment_instructions'=>setting('payment_instructions',''), 'credit_topup_enabled'=>setting_bool('credit_topup_enabled',true), 'credit_topup_min'=>setting_int('credit_topup_min',50000), 'credit_topup_max'=>setting_int('credit_topup_max',5000000), 'credit_topup_presets'=>setting_json('credit_topup_presets',[100000,200000,500000]), 'credit_topup_methods'=>setting_json('credit_topup_methods',['card'=>true,'stars'=>true,'crypto'=>true]), 'payment_methods_enabled'=>setting_json('payment_methods_enabled', ['wallet'=>true,'card'=>true,'stars'=>false,'crypto'=>false]), 'payment_methods'=>payment_methods_public(null), 'card_accounts_text'=>card_accounts_lines(), 'stars_rate_toman'=>setting_int('stars_rate_toman', 3200), 'crypto_wallets_text'=>crypto_wallets_lines(), 'crypto_manual_rates_text'=>crypto_manual_rates_lines(), 'crypto_rate_source'=>setting('crypto_rate_source','auto'), 'crypto_rate_markup_percent'=>(float)setting('crypto_rate_markup_percent','1'), 'crypto_notify_rate_fail'=>setting_bool('crypto_notify_rate_fail', true), 'crypto_rate_refresh_interval_seconds'=>setting_int('crypto_rate_refresh_interval_seconds', 600), 'crypto_rate_cache'=>crypto_rate_cache(), 'crypto_rate_last_result'=>setting_json('crypto_rate_last_result', []), 'crypto_rate_provider_priority'=>setting('crypto_rate_provider_priority','wallex,ramzinex,nobitex'), 'theme_color'=>setting('theme_color','#1d9bf0'), 'button_colors_enabled'=>setting_bool('button_colors_enabled', true), 'button_colors'=>button_colors(), 'require_contact_auth'=>setting_bool('require_contact_auth', false), 'notify_new_user'=>setting_bool('notify_new_user', true), 'spin_referrals_per_chance'=>setting_int('spin_referrals_per_chance', 5), 'spin_rewards_text'=>spin_rewards_lines(), 'backup_last_created_at'=>setting('backup_last_created_at',''), 'backup_last_restored_at'=>setting('backup_last_restored_at',''), 'brand_name'=>setting('brand_name', app_config('BRAND_NAME', 'BlueGate')), 'support_username'=>setting('support_username', app_config('SUPPORT_USERNAME', 'BlueGateSupport')), 'start_reward'=>setting_int('start_reward',2000), 'storefront_brand_subtitle'=>setting('storefront_brand_subtitle','Digital Services'), 'storefront_hero_title'=>setting('storefront_hero_title','سرویس‌های دیجیتال، ساده و سریع'), 'storefront_hero_text'=>setting('storefront_hero_text',''), 'storefront_announcement_enabled'=>setting_bool('storefront_announcement_enabled',true), 'storefront_announcement_text'=>setting('storefront_announcement_text',''), 'storefront_star_sell_per_unit_toman'=>(float)setting('storefront_star_sell_per_unit_toman','3456'), 'storefront_star_sell_per_unit_usdt'=>(float)setting('storefront_star_sell_per_unit_usdt','0.018'), 'storefront_stars_price_basis'=>setting('storefront_stars_price_basis','toman'), 'storefront_stars_min'=>setting_int('storefront_stars_min',50), 'storefront_stars_max'=>setting_int('storefront_stars_max',10000), 'storefront_stars_step'=>setting_int('storefront_stars_step',25), 'storefront_stars_presets'=>setting_json('storefront_stars_presets',[100,500,1000,2500,5000]), 'default_base_currency'=>setting('default_base_currency', 'USDT'), 'resend_api_key'=>'', 'resend_api_key_configured'=>setting('resend_api_key','')!=='', 'resend_api_key_masked'=>swapwallet_mask_key(setting('resend_api_key','')), 'resend_from_email'=>setting('resend_from_email','onboarding@resend.dev'), 'require_email_verification'=>setting_bool('require_email_verification', true), 'vip_tier_rates'=>setting_json('vip_tier_rates', [])],
        'backups'=>blue_backup_list(),
        'coupons'=>admin_list_coupons(),
        'activity_log'=>admin_activity_log(100),
        'admin_roles'=>admin_list_roles(),
        'forecast'=>admin_revenue_forecast()
    ];
    if($role==='full')return $payload;
    $payload['settings']=[];$payload['backups']=[];$payload['activity_log']=[];$payload['admin_roles']=[];
    if($role==='orders'){ $payload['products']=[];$payload['categories']=[];$payload['inventory']=[];$payload['variants']=[];$payload['catalog_admin']=[];$payload['coupons']=[]; }
    elseif($role==='products'){ $payload['orders']=[];$payload['cleanup']=[]; }
    elseif($role==='finance'){ $payload['orders']=[];$payload['products']=[];$payload['categories']=[];$payload['inventory']=[];$payload['variants']=[];$payload['catalog_admin']=[];$payload['coupons']=[]; }
    return $payload;
}
function bool_input($v): int { return in_array(strtolower((string)$v), ['1','true','yes','on'], true) ? 1 : 0; }

$method=strtoupper((string)($_SERVER['REQUEST_METHOD']??'GET'));$input=$method==='GET'?$_GET:array_merge($_POST,request_json());$action=(string)($input['action']??'me');$initData=(string)($input['initData']??'');$authToken=api_cookie_token();if($authToken==='')$authToken=trim((string)($_SERVER['HTTP_X_WEB_TOKEN']??''));if($authToken===''&&$method!=='GET')$authToken=trim((string)($input['authToken']??''));
if($method==='POST'&&api_cookie_token()!==''&&$initData===''&&trim((string)($_SERVER['HTTP_X_WEB_TOKEN']??''))===''){$origin=trim((string)($_SERVER['HTTP_ORIGIN']??''));$originHost=strtolower((string)(parse_url($origin,PHP_URL_HOST)?:''));$host=strtolower(preg_replace('/:\d+$/','',(string)($_SERVER['HTTP_HOST']??'')));$allowed=trim((string)app_config('WEB_ALLOWED_ORIGIN',''));$originOk=$origin!==''&&(($allowed!==''&&rtrim($origin,'/')===rtrim($allowed,'/'))||($originHost!==''&&$originHost===$host));$ct=strtolower((string)($_SERVER['CONTENT_TYPE']??''));if(!$originOk||!str_starts_with($ct,'application/json'))api_out(['ok'=>false,'error'=>'CSRF_CHECK_FAILED','message'=>'درخواست امنیتی معتبر نیست.'],403);}

if ($action === 'register') {
    api_rate_limit('register','ip',5,900,900);
    $username = trim((string)($input['username'] ?? ''));
    $email = trim((string)($input['email'] ?? ''));
    $password = (string)($input['password'] ?? '');
    $firstName = trim((string)($input['first_name'] ?? ''));
    $refCode = trim((string)($input['ref_code'] ?? ''));

    if (mb_strlen($username) < 3 || mb_strlen($username) > 30 || !preg_match('/^[a-zA-Z0-9_]+$/', $username)) {
        api_out(['ok'=>false, 'error'=>'INVALID_USERNAME', 'message'=>'نام کاربری باید ۳ تا ۳۰ کاراکتر انگلیسی باشد.'], 400);
    }
    if (!empty($email) && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        api_out(['ok'=>false, 'error'=>'INVALID_EMAIL', 'message'=>'آدرس ایمیل معتبر نیست.'], 400);
    }
    if (mb_strlen($password) < 8) {
        api_out(['ok'=>false,'error'=>'INVALID_PASSWORD','message'=>'رمز عبور باید حداقل ۸ کاراکتر باشد.'],400);
    }
    $reserved=array_map('strtolower',array_merge(['admin','administrator','root','support','system'],(array)app_config('ADMIN_USERNAMES',[])));if(in_array(strtolower($username),$reserved,true))api_out(['ok'=>false,'error'=>'RESERVED_USERNAME','message'=>'این نام کاربری قابل ثبت نیست.'],400);
    if (get_user_by_web_username($username)) {
        api_out(['ok'=>false, 'error'=>'USERNAME_TAKEN', 'message'=>'این نام کاربری قبلاً ثبت شده است.'], 400);
    }
    if (!empty($email) && get_user_by_email($email)) {
        api_out(['ok'=>false, 'error'=>'EMAIL_TAKEN', 'message'=>'این ایمیل قبلاً ثبت شده است.'], 400);
    }
    $user = create_web_user($username, $password, $firstName, $refCode, $email ?: null);
    
    $requireEmailVerif = setting_bool('require_email_verification', true) && !empty($user['email']);
    if ($requireEmailVerif) {
        send_email_otp($user);
        api_out([
            'ok' => true,
            'requires_email_verification' => true,
            'user_id' => (int)$user['id'],
            'email' => $user['email'],
            'message' => 'کد تایید ۶ رقمی به ایمیل شما ارسال شد.'
        ]);
    }
    
    api_issue_session((int)$user['id'],bool_input($input['remember']??1)===1);api_out(dashboard_payload(get_user_by_id((int)$user['id'])));
}

if ($action === 'verify_email_otp') {
    $userId = (int)($input['user_id'] ?? 0);
    $otp = trim((string)($input['otp'] ?? ($input['otp_code'] ?? '')));
    api_rate_limit('verify_email_otp',(string)$userId,8,900,900);
    if ($userId <= 0 || strlen($otp) < 4) {
        api_out(['ok'=>false, 'error'=>'INVALID_OTP', 'message'=>'کد تایید وارد شده معتبر نیست.'], 400);
    }
    if (!verify_email_otp($userId, $otp)) {
        api_out(['ok'=>false, 'error'=>'OTP_VERIFICATION_FAILED', 'message'=>'کد تایید اشتباه است یا منقضی شده است.'], 400);
    }
    $user = get_user_by_id($userId);
    api_issue_session((int)$user['id'],bool_input($input['remember']??1)===1);
    notify_new_user_signup($user, '🌐 وب‌سایت (ایمیل تایید شد)');
    api_out(dashboard_payload($user)+['message'=>'ایمیل شما با موفقیت تایید شد! 🎉']);
}

if ($action === 'resend_email_otp') {
    $userId = (int)($input['user_id'] ?? 0);
    api_rate_limit('resend_email_otp',(string)$userId,5,900,900);
    $user = get_user_by_id($userId);
    if (!$user || empty($user['email'])) {
        api_out(['ok'=>false, 'error'=>'USER_NOT_FOUND', 'message'=>'کاربر یا ایمیل پیدا نشد.'], 400);
    }
    $res = send_email_otp($user);
    if (!empty($res['ok'])) {
        api_out(['ok'=>true, 'message'=>'کد تایید جدید به ایمیل شما ارسال شد.']);
    } else {
        error_log('[Email OTP resend] '.json_encode($res,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)); api_out(['ok'=>false,'error'=>'SEND_FAILED','message'=>'ارسال ایمیل ناموفق بود. کمی بعد دوباره تلاش کنید.'],500);
    }
}

if ($action === 'login') {
    $identifier = trim((string)($input['username'] ?? ($input['identifier'] ?? '')));
    $password = (string)($input['password'] ?? '');
    api_rate_limit('login',strtolower($identifier),10,900,900);

    $user = get_user_by_email_or_username($identifier);
    if (!$user || user_is_blocked($user) || empty($user['password_hash']) || !password_verify($password, $user['password_hash'])) {
        api_out(['ok'=>false, 'error'=>'INVALID_CREDENTIALS', 'message'=>'ایمیل/نام کاربری یا رمز عبور اشتباه است.'], 400);
    }
    
    $requireEmailVerif = setting_bool('require_email_verification', true) && !empty($user['email']) && empty($user['email_verified_at']);
    if ($requireEmailVerif) {
        send_email_otp($user);
        api_out([
            'ok' => false,
            'error' => 'EMAIL_VERIFICATION_REQUIRED',
            'requires_email_verification' => true,
            'user_id' => (int)$user['id'],
            'email' => $user['email'],
            'message' => 'ایمیل شما هنوز تایید نشده است. کد تایید ۶ رقمی جدید به ایمیل شما ارسال شد.'
        ], 403);
    }

    security_rate_limit_clear('login',security_client_ip().'|'.strtolower($identifier));api_issue_session((int)$user['id'],bool_input($input['remember']??1)===1);api_out(dashboard_payload($user));
}

if ($action === 'forgot_password_request') {
    $identifier=trim((string)($input['email']??($input['identifier']??'')));if($identifier==='')api_out(['ok'=>false,'error'=>'EMPTY_IDENTIFIER','message'=>'لطفاً ایمیل یا نام کاربری خود را وارد کنید.'],400);api_rate_limit('forgot_password',strtolower($identifier),5,3600,1800);
    $user=get_user_by_email_or_username($identifier);if($user&&!user_is_blocked($user)&&!empty($user['email'])){try{send_password_reset_otp($user);}catch(Throwable $e){error_log('[Password reset send] '.$e->getMessage());}}
    api_out(['ok'=>true,'message'=>'اگر حسابی با این مشخصات وجود داشته باشد، کد بازیابی به ایمیل آن ارسال می‌شود.']);
}

if ($action === 'reset_password_submit') {
    $identifier=trim((string)($input['identifier']??$input['email']??''));$otp=trim((string)($input['otp']??''));$newPassword=(string)($input['new_password']??'');api_rate_limit('reset_password',strtolower($identifier),8,900,900);
    if($identifier===''||strlen($otp)<4)api_out(['ok'=>false,'error'=>'INVALID_OTP','message'=>'کد تایید وارد شده معتبر نیست.'],400);if(mb_strlen($newPassword)<8)api_out(['ok'=>false,'error'=>'INVALID_PASSWORD','message'=>'رمز عبور جدید باید حداقل ۸ کاراکتر باشد.'],400);
    $u=get_user_by_email_or_username($identifier);if(!$u||user_is_blocked($u)||!reset_password_with_otp((int)$u['id'],$otp,$newPassword))api_out(['ok'=>false,'error'=>'RESET_FAILED','message'=>'کد تایید اشتباه است یا منقضی شده است.'],400);api_issue_session((int)$u['id'],bool_input($input['remember']??1)===1);api_out(['ok'=>true,'message'=>'رمز عبور شما با موفقیت تغییر کرد! اکنون وارد شده‌اید.']+dashboard_payload(get_user_by_id((int)$u['id'])));
}

if ($action === 'telegram_login') {
    api_rate_limit('telegram_login','ip',20,900,900);
    $authData = is_array($input['auth_data'] ?? null) ? $input['auth_data'] : [];
    $verified = verify_telegram_login_widget($authData);
    if (!$verified) {
        api_out(['ok'=>false, 'error'=>'INVALID_TELEGRAM_WIDGET_DATA', 'message'=>'تایید هویت تلگرام ناموفق بود.'], 400);
    }
    $user = create_or_update_user([
        'id' => (int)$verified['id'],
        'username' => $verified['username'] ?? null,
        'first_name' => $verified['first_name'] ?? null,
        'last_name' => $verified['last_name'] ?? null,
    ], null);
    if(user_is_blocked($user))api_out(['ok'=>false,'error'=>'ACCOUNT_BLOCKED','message'=>'این حساب مسدود شده است.'],403);api_issue_session((int)$user['id'],bool_input($input['remember']??1)===1);api_out(dashboard_payload($user));
}

if ($action === 'telegram_boot') {
    if (trim((string)$initData) === '') {
        api_out(['ok'=>false,'error'=>'TELEGRAM_INIT_DATA_MISSING','message'=>'اطلاعات ورود تلگرام دریافت نشد. Mini App را از داخل ربات باز کنید.'],401);
    }
    $tgBootUser = webapp_auth_user((string)$initData);
    api_out(dashboard_payload($tgBootUser)+['telegram_authenticated'=>true]);
}

$user = get_authenticated_user((string)$initData, (string)$authToken);

if ($action === 'telegram_link') {
    if (!$user) api_out(['ok'=>false,'error'=>'AUTH_REQUIRED','message'=>'ابتدا وارد حساب BlueGate شوید.'],401);
    api_rate_limit('telegram_link',(string)$user['id'],10,900,900);
    $authData=is_array($input['auth_data']??null)?$input['auth_data']:[];
    $verified=verify_telegram_login_widget($authData);
    if(!$verified)api_out(['ok'=>false,'error'=>'INVALID_TELEGRAM_WIDGET_DATA','message'=>'تایید هویت تلگرام ناموفق بود.'],400);
    $tid=(int)($verified['id']??0);if($tid<=0||$tid>=9000000000)api_out(['ok'=>false,'error'=>'INVALID_TELEGRAM_ID','message'=>'شناسه تلگرام معتبر نیست.'],400);
    $existing=get_user_by_tid($tid);
    if($existing&&(int)$existing['id']!==(int)$user['id'])api_out(['ok'=>false,'error'=>'TELEGRAM_ALREADY_LINKED','message'=>'این حساب تلگرام قبلاً به یک حساب BlueGate دیگر متصل شده است.'],409);
    $pdo=db();$pdo->beginTransaction();
    try{
        $q=$pdo->prepare('SELECT id,telegram_id,first_name,last_name FROM users WHERE id=? FOR UPDATE');$q->execute([(int)$user['id']]);$locked=$q->fetch();if(!$locked)throw new RuntimeException('USER_NOT_FOUND');
        $first=trim((string)($locked['first_name']??''))!==''?(string)$locked['first_name']:(string)($verified['first_name']??'');
        $last=trim((string)($locked['last_name']??''))!==''?(string)$locked['last_name']:(string)($verified['last_name']??'');
        $pdo->prepare('UPDATE users SET telegram_id=?, first_name=?, last_name=? WHERE id=?')->execute([$tid,$first,$last,(int)$user['id']]);
        $pdo->commit();
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();if(str_contains(strtolower($e->getMessage()),'duplicate'))api_out(['ok'=>false,'error'=>'TELEGRAM_ALREADY_LINKED','message'=>'این حساب تلگرام قبلاً متصل شده است.'],409);throw $e;}
    api_out(dashboard_payload(get_user_by_id((int)$user['id']))+['message'=>'تلگرام با موفقیت به حساب متصل شد.']);
}

if ($action === 'me') {
    if (!$user) {
        api_out(guest_dashboard_payload());
    } else {
        api_out(dashboard_payload($user));
    }
}

// Public guest endpoint — no auth required
if ($action === 'guest_dashboard_payload') {
    api_out(guest_dashboard_payload());
}
if ($action === 'storefront') {
    api_out([
        'ok'=>true,
        'shop_categories'=>array_map('category_payload', shop_categories(true)),
        'shop_products'=>array_map(fn($p)=>product_payload($p, true), storefront_shop_products()),
        'catalog'=>catalog_public_payload(),
        'storefront_settings'=>storefront_settings_payload(),
        'storefront_content'=>storefront_content_payload(),
        'storefront_rates'=>storefront_rates_payload(),
        'payment_methods'=>payment_methods_public($user ?: null),
        'support_username'=>setting('support_username', app_config('SUPPORT_USERNAME', 'BlueGateSupport')),
    ]);
}

if (!$user) {
    api_out(['ok'=>false, 'error'=>'AUTH_REQUIRED', 'message'=>'برای انجام این عملیات باید وارد حساب کاربری خود شوید.'], 401);
}
$GLOBALS['BG_CURRENT_USER']=$user;
function admin_action_perm(string $a): string {if(in_array($a,['admin_summary'],true))return 'dashboard';if(str_starts_with($a,'admin_catalog_')||in_array($a,['admin_add_inventory','admin_update_inventory','admin_delete_inventory','admin_hard_delete_inventory','admin_add_coupon','admin_update_coupon','admin_toggle_coupon','admin_delete_coupon'],true))return 'products';if(in_array($a,['admin_add_balance','admin_credit_topup_approve','admin_credit_topup_reject'],true))return 'finance';if(in_array($a,['admin_search_orders','admin_archive_order','admin_delete_order','admin_cleanup_orders','admin_order_status','admin_deliver_order','admin_set_service_delivery','admin_order_note'],true))return 'orders';return 'full';}
if(str_starts_with($action,'admin_'))require_admin_perm($user,admin_action_perm($action));

if ($action === 'logout') {
    if (!empty($user['id'])) {
        revoke_user_auth_token((int)$user['id']);
    }
    api_clear_session_cookie();api_out(['ok'=>true]);
}
if ($action === 'mini_enhancements') {
    $op = array_map('order_public_payload', user_orders((int)$user['id'], 30));
    api_out([
        'ok'=>true,
        'services'=>active_services_from_order_payloads($op,12),
        'wishlist_product_ids'=>safe_mini_optional(fn()=>wishlist_product_ids((int)$user['id']), []),
        'notifications'=>safe_mini_optional(fn()=>user_notifications((int)$user['id'],30), []),
        'notification_unread'=>(int)safe_mini_optional(fn()=>user_notification_unread_count((int)$user['id']), 0),
    ]);
}

if ($action === 'mini_enhancements') {
    $op = array_map('order_public_payload', user_orders((int)$user['id'], 40));
    api_out([
        'ok'=>true,
        'services'=>active_services_from_order_payloads($op,12),
        'wishlist_product_ids'=>safe_mini_optional(fn()=>wishlist_product_ids((int)$user['id']),[]),
        'notifications'=>safe_mini_optional(fn()=>user_notifications((int)$user['id'],30),[]),
        'notification_unread'=>(int)safe_mini_optional(fn()=>user_notification_unread_count((int)$user['id']),0),
    ]);
}
if ($action === 'wishlist_toggle') { try{$r=toggle_user_wishlist((int)$user['id'],(int)($input['product_id']??0));api_out(['ok'=>true,'wishlist_product_ids'=>$r['ids'],'active'=>$r['active']]);}catch(Throwable $e){api_out(['ok'=>false,'error'=>api_exception_code($e),'message'=>'تغییر علاقه‌مندی انجام نشد.'],400);} }
if ($action === 'notifications_read') { mark_user_notifications_read((int)$user['id']);api_out(['ok'=>true,'notification_unread'=>0]); }
if ($action === 'create_cart_orders') {
    $items=is_array($input['items']??null)?$input['items']:[];if(!$items||count($items)>30)api_out(['ok'=>false,'message'=>'سبد خرید معتبر نیست یا بیش از حد بزرگ است.'],400);
    $expanded=[];foreach($items as $it){$pid=(int)($it['product_id']??0);$vid=!empty($it['variant_id'])?(int)$it['variant_id']:null;$qty=max(1,min(10,(int)($it['qty']??1)));if($pid<=0)api_out(['ok'=>false,'message'=>'یکی از آیتم‌های سبد معتبر نیست.'],400);for($i=0;$i<$qty;$i++)$expanded[]=[$pid,$vid];}
    if(count($expanded)>50)api_out(['ok'=>false,'message'=>'حداکثر ۵۰ سفارش در هر ثبت سبد مجاز است.'],400);
    $pdo=db();$pdo->beginTransaction();$orders=[];try{foreach($expanded as [$pid,$vid]){$orders[]=create_storefront_order((int)$user['id'],$pid,$vid,null);} $pdo->commit();}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();api_out(['ok'=>false,'error'=>api_exception_code($e),'message'=>'یکی از آیتم‌های سبد قابل سفارش نیست؛ هیچ سفارشی ثبت نشد.'],400);}
    foreach($orders as $o){$sourceStr='Mini App 📱';$userStr=!empty($user['telegram_id'])?"<code>{$user['telegram_id']}</code>":"<code>#{$user['id']}</code>";notify_admins("🧾 سفارش جدید از {$sourceStr}\nسفارش: <code>#{$o['id']}</code>\nکاربر: {$userStr}\nمحصول: <b>".h(order_catalog_display_name($o))."</b>\nمبلغ: <b>".money($o['final_amount'])."</b>");}
    api_out(dashboard_payload(get_user_by_id((int)$user['id']))+['created_order_ids'=>array_map(fn($o)=>(int)$o['id'],$orders)]);
}
if ($action === 'renew_order') { $oid=(int)($input['order_id']??0);try{$order=create_renewal_order_from_order((int)$user['id'],$oid);$vpnCarry=normalize_delivery_type((string)($order['delivery_type']??'manual'))==='vpn'&&!empty($order['delivery_url']);notify_admins("🔄 <b>سفارش تمدید</b> از Mini App\nسفارش جدید: <code>#{$order['id']}</code>\nتمدید سفارش: <code>#{$oid}</code>\nمحصول: <b>".h(order_catalog_display_name($order))."</b>".($vpnCarry?"\n🔗 لینک ساب قبلی روی این تمدید حفظ شده است.":''));api_out(dashboard_payload(get_user_by_id((int)$user['id']))+['order'=>order_public_payload($order)]);}catch(Throwable $e){api_out(['ok'=>false,'error'=>api_exception_code($e),'message'=>'این پلن در حال حاضر قابل تمدید نیست.'],400);} }
if ($action === 'my_orders') { $op=array_map('order_public_payload', user_orders((int)$user['id'],50)); api_out(['ok'=>true, 'orders'=>$op, 'services'=>active_services_from_order_payloads($op,12), 'notifications'=>safe_mini_optional(fn()=>user_notifications((int)$user['id'],30),[]), 'notification_unread'=>(int)safe_mini_optional(fn()=>user_notification_unread_count((int)$user['id']),0)]); }
if ($action === 'get_receipt_url') {
    $oid=(int)($input['order_id']??0);$order=order_by_id($oid);
    if(!$order)api_out(['ok'=>false,'error'=>'ORDER_NOT_FOUND','message'=>'سفارش پیدا نشد.'],404);
    $owner=(int)$order['user_id']===(int)$user['id'];$admin=is_admin($user);
    if(!$owner&&!$admin)api_out(['ok'=>false,'error'=>'FORBIDDEN','message'=>'دسترسی به این رسید مجاز نیست.'],403);
    $fid=trim((string)($order['receipt_file_id']??''));if($fid==='')api_out(['ok'=>false,'error'=>'RECEIPT_NOT_FOUND','message'=>'برای این سفارش رسید تصویری ثبت نشده است.'],404);
    if(str_starts_with($fid,'uploads/')){
        $rel=ltrim($fid,'/');$full=__DIR__.'/'.$rel;$base=realpath(__DIR__.'/uploads/receipts');$real=is_file($full)?realpath($full):false;
        if(!$base||!$real||!str_starts_with($real,$base.DIRECTORY_SEPARATOR))api_out(['ok'=>false,'error'=>'RECEIPT_NOT_FOUND','message'=>'فایل رسید روی سرور پیدا نشد.'],404);
        api_out(['ok'=>true,'url'=>'/'.$rel]);
    }
    api_out(['ok'=>false,'error'=>'RECEIPT_REMOTE_UNAVAILABLE','message'=>'این رسید از طریق بات ثبت شده و پیش‌نمایش وب آن در دسترس نیست.'],409);
}
if ($action === 'service_link' || $action === 'service_viewer_ticket') {
    // v1.5: return the direct admin-provided URL only to the authenticated owner.
    // service_viewer_ticket is kept as a compatibility alias for stale v1.4 clients.
    $oid=(int)($input['order_id']??0);
    $order=order_by_id($oid);
    if(!$order || (int)$order['user_id'] !== (int)$user['id']) api_out(['ok'=>false,'error'=>'ORDER_NOT_FOUND','message'=>'سفارش پیدا نشد.'],404);
    if(normalize_order_status((string)$order['status']) !== 'delivered' || empty($order['delivery_url'])) api_out(['ok'=>false,'error'=>'SERVICE_NOT_READY','message'=>'لینک سرویس هنوز برای این سفارش فعال نشده است.'],400);
    try { $direct=validate_service_delivery_url((string)$order['delivery_url']); }
    catch(Throwable $e) { api_out(['ok'=>false,'error'=>'SERVICE_URL_INVALID','message'=>'لینک سرویس نیاز به اصلاح توسط پشتیبانی دارد.'],400); }
    api_out(['ok'=>true,'url'=>$direct,'direct_url'=>$direct,'viewer_url'=>$direct,'title'=>trim((string)($order['delivery_title']??'')) ?: 'مدیریت سرویس']);
}
if ($action === 'my_referrals') {
    $stmt = db()->prepare('SELECT id, first_name, username, created_at, referrals_count, total_earned FROM users WHERE referrer_id=? ORDER BY id DESC LIMIT 50');
    $stmt->execute([(int)$user['id']]);
    api_out(['ok' => true, 'referrals' => $stmt->fetchAll()]);
}
if ($action === 'claim_missions') { [$count, $claimed] = claim_available_missions($user); api_out(dashboard_payload(get_user_by_id((int)$user['id'])) + ['claimed'=>$claimed, 'today_count'=>$count]); }
if ($action === 'spin') {
    $uid=(int)$user['id']; $pdo=db(); $pdo->beginTransaction();
    try {
        $q=$pdo->prepare('SELECT spin_balance,first_name,username FROM users WHERE id=? FOR UPDATE'); $q->execute([$uid]); $locked=$q->fetch();
        if(!$locked || (int)$locked['spin_balance']<=0){$pdo->rollBack();api_out(['ok'=>false,'error'=>'NO_SPIN_BALANCE','message'=>'فعلاً شانس گردونه نداری.'],400);}
        $rewards=spin_rewards_public(); $reward=weighted_spin_reward(); $title=$reward['title']??'جایزه گردونه'; $amount=(int)($reward['amount']??0); $idx=0;
        foreach($rewards as $i=>$r){if(($r['title']??'')===$title && (int)($r['amount']??0)===$amount){$idx=$i;break;}}
        $u=$pdo->prepare('UPDATE users SET spin_balance=spin_balance-1 WHERE id=? AND spin_balance>0'); $u->execute([$uid]);
        if($u->rowCount()!==1) throw new RuntimeException('SPIN_BALANCE_RACE');
        $pdo->prepare('INSERT INTO spin_logs (user_id, prize_title, prize_amount) VALUES (?,?,?)')->execute([$uid,$title,$amount]);
        if($amount>0)add_balance($uid,$amount,'spin_reward',$title,null);
        $pdo->commit();
        if(!empty($reward['notify_admin'])) notify_admins("🎡 جایزه Mini App نیازمند بررسی\nکاربر: <code>".h($locked['first_name']??$locked['username']??$uid)."</code>\nجایزه: <b>".h($title)."</b>");
        api_out(dashboard_payload(get_user_by_id($uid)) + ['prize'=>['title'=>$title,'amount'=>$amount,'index'=>$idx]]);
    } catch(Throwable $e) { if($pdo->inTransaction())$pdo->rollBack(); throw $e; }
}
if ($action === 'withdraw') { api_out(['ok'=>false,'error'=>'WITHDRAWALS_DISABLED','message'=>'برداشت موجودی در BlueGate غیرفعال است؛ اعتبار فقط برای خرید سرویس قابل استفاده است.'],410); }

if ($action === 'email_change_start') {
    api_rate_limit('email_change_start',(string)$user['id'],4,900,900);$res=email_change_begin(get_user_by_id((int)$user['id'])?:$user);if(empty($res['ok']))api_out(['ok'=>false,'error'=>$res['error']??'SEND_FAILED','message'=>'ارسال کد تایید ممکن نشد. کمی بعد دوباره تلاش کنید.'],500);api_out($res);
}
if ($action === 'email_change_verify_current') {
    api_rate_limit('email_change_verify_current',(string)$user['id'],8,900,900);$otp=trim((string)($input['otp']??''));if(!preg_match('/^\d{6}$/',$otp)||!email_change_verify_current(get_user_by_id((int)$user['id'])?:$user,$otp))api_out(['ok'=>false,'error'=>'OTP_VERIFICATION_FAILED','message'=>'کد تایید ایمیل فعلی اشتباه است یا منقضی شده.'],400);api_out(['ok'=>true,'step'=>'new_email','message'=>'ایمیل فعلی تایید شد. حالا ایمیل جدید را وارد کنید.']);
}
if ($action === 'email_change_set_new') {
    api_rate_limit('email_change_set_new',(string)$user['id'],5,900,900);$res=email_change_send_new(get_user_by_id((int)$user['id'])?:$user,(string)($input['email']??''));if(empty($res['ok']))api_out($res,($res['error']??'')==='EMAIL_TAKEN'?409:400);api_out($res);
}
if ($action === 'email_change_resend_current') {
    api_rate_limit('email_change_resend_current',(string)$user['id'],4,900,900);$res=email_change_begin(get_user_by_id((int)$user['id'])?:$user);if(empty($res['ok']))api_out(['ok'=>false,'error'=>$res['error']??'SEND_FAILED','message'=>'ارسال مجدد کد ممکن نشد.'],500);api_out($res);
}
if ($action === 'email_change_resend_new') {
    api_rate_limit('email_change_resend_new',(string)$user['id'],4,900,900);$res=email_change_resend_new(get_user_by_id((int)$user['id'])?:$user);if(empty($res['ok']))api_out($res,400);api_out($res);
}
if ($action === 'email_change_verify_new') {
    api_rate_limit('email_change_verify_new',(string)$user['id'],8,900,900);$otp=trim((string)($input['otp']??''));if(!preg_match('/^\d{6}$/',$otp))api_out(['ok'=>false,'error'=>'INVALID_OTP','message'=>'کد ۶ رقمی را کامل وارد کنید.'],400);try{$fresh=email_change_verify_new(get_user_by_id((int)$user['id'])?:$user,$otp);}catch(Throwable $e){$code=api_exception_code($e,'OTP_VERIFICATION_FAILED');$msg=$code==='EMAIL_TAKEN'?'این ایمیل همین حالا روی حساب دیگری ثبت شده است.':($code==='CURRENT_EMAIL_NOT_VERIFIED'?'تایید ایمیل فعلی منقضی شده؛ فرایند را دوباره شروع کنید.':'کد تایید ایمیل جدید اشتباه است یا منقضی شده.');api_out(['ok'=>false,'error'=>$code,'message'=>$msg],$code==='EMAIL_TAKEN'?409:400);}api_out(dashboard_payload($fresh)+['message'=>'ایمیل جدید با موفقیت تایید و روی حساب ثبت شد.']);
}

if ($action === 'update_my_profile') {
    $first=trim((string)($input['first_name']??''));$last=trim((string)($input['last_name']??''));$phone=trim((string)($input['phone_number']??''));
    if($first===''||mb_strlen($first)>80)api_out(['ok'=>false,'error'=>'INVALID_NAME','message'=>'نام نمایشی را درست وارد کنید.'],400);
    if(mb_strlen($last)>80)api_out(['ok'=>false,'error'=>'INVALID_LAST_NAME','message'=>'نام خانوادگی بیش از حد طولانی است.'],400);
    if(mb_strlen($phone)>32)api_out(['ok'=>false,'error'=>'INVALID_PHONE','message'=>'شماره تماس معتبر نیست.'],400);
    if(array_key_exists('email',$input)){ $submitted=strtolower(trim((string)$input['email']));$current=strtolower(trim((string)($user['email']??'')));if($submitted!==$current)api_out(['ok'=>false,'error'=>'EMAIL_CHANGE_REQUIRES_OTP','message'=>'برای تغییر یا حذف ایمیل باید از فرایند تایید دو مرحله‌ای استفاده کنید.'],409); }
    db()->prepare('UPDATE users SET first_name=?,last_name=?,phone_number=? WHERE id=?')->execute([$first,$last?:null,$phone?:null,(int)$user['id']]);
    $fresh=get_user_by_id((int)$user['id']);api_out(dashboard_payload($fresh)+['message'=>'اطلاعات حساب ذخیره شد.']);
}
if ($action === 'change_my_password') {
    $fresh=get_user_by_id((int)$user['id']);$current=(string)($input['current_password']??'');$next=(string)($input['new_password']??'');
    if(empty($fresh['password_hash']))api_out(['ok'=>false,'error'=>'PASSWORD_NOT_AVAILABLE','message'=>'این حساب با تلگرام ساخته شده و رمز عبور وب ندارد.'],400);
    if(!password_verify($current,(string)$fresh['password_hash']))api_out(['ok'=>false,'error'=>'WRONG_PASSWORD','message'=>'رمز عبور فعلی اشتباه است.'],400);
    if(strlen($next)<8)api_out(['ok'=>false,'error'=>'WEAK_PASSWORD','message'=>'رمز جدید باید حداقل ۸ کاراکتر باشد.'],400);
    db()->prepare('UPDATE users SET password_hash=? WHERE id=?')->execute([password_hash($next,PASSWORD_DEFAULT),(int)$fresh['id']]);
    api_out(dashboard_payload(get_user_by_id((int)$fresh['id']))+['message'=>'رمز عبور با موفقیت تغییر کرد.']);
}
if ($action === 'custom_code') { $code=normalize_ref_code((string)($input['code']??'')); $min=setting_int('custom_code_min_referrals',3); if((int)$user['referrals_count']<$min) api_out(['ok'=>false,'error'=>'NOT_ENOUGH_REFERRALS','message'=>"حداقل {$min} زیرمجموعه لازم است."],400); if(strlen($code)<4||strlen($code)>20) api_out(['ok'=>false,'error'=>'INVALID_CODE','message'=>'کد باید ۴ تا ۲۰ کاراکتر باشد.'],400); $exists=get_user_by_ref($code); if($exists && (int)$exists['id'] !== (int)$user['id']) api_out(['ok'=>false,'error'=>'CODE_TAKEN','message'=>'این کد قبلاً گرفته شده.'],400); db()->prepare('UPDATE users SET ref_code=? WHERE id=?')->execute([$code,$user['id']]); api_out(dashboard_payload(get_user_by_id((int)$user['id']))); }

if ($action === 'create_order') { $productId=(int)($input['product_id']??0); $variantId=!empty($input['variant_id'])?(int)$input['variant_id']:null; $starsCount=isset($input['stars_count'])?(int)$input['stars_count']:null; try{ $order=create_storefront_order((int)$user['id'],$productId,$variantId,$starsCount); if(!empty($input['use_wallet'])) { try { $order=apply_wallet_to_order((int)$order['id'], (int)$user['id']); } catch(Throwable $we) {} } $wallet=(int)($order['wallet_amount'] ?? 0); $sourceStr = (!empty($authToken) || !empty($input['is_web'])) ? 'وب‌سایت 🌐' : 'Mini App 📱'; $userStr = !empty($user['telegram_id']) ? "<code>{$user['telegram_id']}</code>" : "<code>#{$user['id']} (".h($user['username']??$user['email']??'وب').")</code>"; notify_admins("🧾 سفارش جدید از {$sourceStr}\nسفارش: <code>#{$order['id']}</code>\nکاربر: {$userStr}\nمحصول: <b>".h(order_catalog_display_name($order))."</b>\nمبلغ قابل پرداخت: <b>".money($order['final_amount'])."</b>".($wallet>0?"\nکسر از اعتبار BlueGate: <b>".money($wallet)."</b>":"")); api_out(dashboard_payload(get_user_by_id((int)$user['id'])) + ['order'=>order_public_payload($order)]); } catch(Throwable $e){ api_out(['ok'=>false,'error'=>api_exception_code($e),'message'=>'محصول یا پلن پیدا نشد یا غیرفعال است.'],404); } }
if ($action === 'apply_wallet') { try{ $order=apply_wallet_to_order((int)($input['order_id']??0),(int)$user['id']); if(normalize_order_status($order['status'])==='payment_confirmed') notify_admins("💳 پرداخت کامل با اعتبار BlueGate\nسفارش: <code>#{$order['id']}</code>\nکاربر: <code>".h($user['username']??$user['telegram_id']??$user['id'])."</code>\nمحصول: <b>".h(order_catalog_display_name($order))."</b>"); api_out(dashboard_payload(get_user_by_id((int)$user['id'])) + ['order'=>order_public_payload($order)]); } catch(Throwable $e){ api_out(['ok'=>false,'error'=>api_exception_code($e),'message'=>'امکان استفاده از اعتبار BlueGate برای این سفارش نیست یا اعتبار کافی نیست.'],400); } }
if ($action === 'select_payment_method') { try{ $order=order_set_payment_method((int)($input['order_id']??0),(int)$user['id'],(string)($input['method']??''), is_array($input['details']??null)?$input['details']:[]); api_out(dashboard_payload(get_user_by_id((int)$user['id'])) + ['order'=>order_public_payload($order)]); } catch(Throwable $e){ api_out(['ok'=>false,'error'=>api_exception_code($e),'message'=>'روش پرداخت قابل ثبت نیست یا سفارش پیدا نشد.'],400); } }
if ($action === 'start_stars_invoice') { try{ $order=order_set_payment_method((int)($input['order_id']??0),(int)$user['id'],'stars',[]); $res=send_stars_invoice_for_order($order); if(empty($res['ok'])) api_out(['ok'=>false,'error'=>'STARS_INVOICE_FAILED','message'=>'ارسال فاکتور Stars ممکن نشد. تنظیمات بات یا تلگرام را بررسی کن.'],400); api_out(dashboard_payload(get_user_by_id((int)$user['id'])) + ['order'=>order_public_payload(order_by_id((int)$order['id'])), 'stars_invoice_sent'=>true]); } catch(Throwable $e){ api_out(['ok'=>false,'error'=>api_exception_code($e),'message'=>'امکان ساخت فاکتور Stars نیست.'],400); } }
if ($action === 'select_crypto_wallet' || $action === 'start_crypto_payment') { try{ $order=start_crypto_payment((int)($input['order_id']??0),(int)$user['id'],(int)($input['wallet_id']??0)); api_out(dashboard_payload(get_user_by_id((int)$user['id'])) + ['order'=>order_public_payload($order)]); } catch(Throwable $e){ api_out(['ok'=>false,'error'=>api_exception_code($e),'message'=>'امکان انتخاب کیف پول رمزارز نیست. نرخ/ولت را در پنل ادمین بررسی کن.'],400); } }
if ($action === 'submit_crypto_hash') { try{ $order=submit_crypto_hash((int)($input['order_id']??0),(int)$user['id'],(string)($input['tx_hash']??'')); api_out(dashboard_payload(get_user_by_id((int)$user['id'])) + ['order'=>order_public_payload($order)]); } catch(Throwable $e){ api_out(['ok'=>false,'error'=>api_exception_code($e),'message'=>'ثبت TXID انجام نشد. هش را بررسی کن.'],400); } }
if ($action === 'check_crypto_payment') { try{ $oid=(int)($input['order_id']??0);$o=order_by_id($oid);if(!$o||(int)$o['user_id']!==(int)$user['id'])throw new RuntimeException('ORDER_NOT_FOUND');crypto_verify_order($oid); api_out(dashboard_payload(get_user_by_id((int)$user['id']))); } catch(Throwable $e){ api_out(['ok'=>false,'error'=>api_exception_code($e),'message'=>'بررسی پرداخت انجام نشد؛ کمی بعد دوباره تلاش کن.'],400); } }
if ($action === 'preview_coupon') {
    api_rate_limit('preview_coupon',(string)$user['id'],30,300,300);
    try{
        $preview=preview_storefront_coupon((int)$user['id'],(string)($input['code']??''),(int)($input['product_id']??0),isset($input['variant_id'])&&$input['variant_id']!==''?(int)$input['variant_id']:null,isset($input['stars_count'])?(int)$input['stars_count']:null);
        api_out(['ok'=>true,'coupon'=>$preview]);
    }catch(Throwable $e){api_out(['ok'=>false,'error'=>api_exception_code($e),'message'=>api_exception_message($e,'کد تخفیف قابل استفاده نیست.')],400);}
}
if ($action === 'apply_coupon') { try{ $order=apply_coupon_to_order((int)($input['order_id']??0),(int)$user['id'],(string)($input['code']??'')); api_out(dashboard_payload(get_user_by_id((int)$user['id'])) + ['order'=>order_public_payload($order)]); } catch(Throwable $e){ api_out(['ok'=>false,'error'=>'INVALID_COUPON','message'=>'کد تخفیف معتبر نیست یا برای این سفارش قابل استفاده نیست.'],400); } }
if ($action === 'submit_receipt') {
    $orderId=(int)($input['order_id']??0); $note=trim((string)($input['note']??''));
    if($orderId<=0) api_out(['ok'=>false,'error'=>'ORDER_NOT_FOUND','message'=>'سفارش معتبر نیست.'],400);
    if($note==='' && empty($input['receipt_b64'])) api_out(['ok'=>false,'error'=>'EMPTY_RECEIPT','message'=>'شماره پیگیری یا تصویر رسید را وارد کن.'],400);
    if($note!=='' && mb_strlen($note)<3) api_out(['ok'=>false,'error'=>'EMPTY_RECEIPT','message'=>'توضیح رسید پرداخت را کامل‌تر بنویس.'],400);
    $fileId=null;
    if(!empty($input['receipt_b64'])){
        $raw=(string)$input['receipt_b64'];
        if(strlen($raw)>8*1024*1024) api_out(['ok'=>false,'error'=>'RECEIPT_TOO_LARGE','message'=>'حجم رسید بیشتر از حد مجاز است.'],400);
        if(!preg_match('#^data:image/(jpeg|jpg|png|webp);base64,#i',$raw)) api_out(['ok'=>false,'error'=>'INVALID_RECEIPT_TYPE','message'=>'فرمت رسید باید JPG، PNG یا WEBP باشد.'],400);
        $b64=preg_replace('#^data:image/(jpeg|jpg|png|webp);base64,#i','',$raw);$bin=base64_decode($b64,true);
        if(!$bin || strlen($bin)<=100 || strlen($bin)>5*1024*1024) api_out(['ok'=>false,'error'=>'INVALID_RECEIPT_CONTENT','message'=>'فایل رسید معتبر نیست.'],400);
        $mime=null;try{if(class_exists('finfo')){$fi=new finfo(FILEINFO_MIME_TYPE);$mime=$fi->buffer($bin);}}catch(Throwable $e){}
        if(!$mime && function_exists('getimagesizefromstring')){try{$ii=@getimagesizefromstring($bin);$mime=is_array($ii)?($ii['mime']??null):null;}catch(Throwable $e){}}
        $ext=['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp'][$mime]??null;
        if(!$ext) api_out(['ok'=>false,'error'=>'INVALID_RECEIPT_CONTENT','message'=>'محتوای فایل تصویر معتبر نیست.'],400);
        $dir=__DIR__.'/uploads/receipts/'.date('Ymd');if(!is_dir($dir)&&!@mkdir($dir,0775,true)&&!is_dir($dir))api_out(['ok'=>false,'error'=>'RECEIPT_STORAGE_FAILED','message'=>'پوشه ذخیره رسید قابل ایجاد نیست.'],500);
        $relative='uploads/receipts/'.date('Ymd').'/r_'.bin2hex(random_bytes(12)).'.'.$ext;$abs=__DIR__.'/'.$relative;
        if(@file_put_contents($abs,$bin,LOCK_EX)===false) api_out(['ok'=>false,'error'=>'RECEIPT_STORAGE_FAILED','message'=>'ذخیره تصویر رسید روی سرور انجام نشد.'],500);
        $fileId=$relative;
    }
    try{
        $order=submit_order_receipt($orderId,(int)$user['id'],$note,$fileId);
        $sourceStr=(!empty($authToken)||!empty($input['is_web']))?'وب‌سایت 🌐':'Mini App 📱';$adminText=order_admin_card($order)."\n\n📤 <b>رسید پرداخت جدید</b> از {$sourceStr}:\n".h($note?:'تصویر رسید ارسال شد');
        foreach(app_config('ADMIN_IDS',[]) as $aid){
            if($fileId){$path=__DIR__.'/'.$fileId;if(file_exists($path)){try{tg('sendPhoto',['chat_id'=>$aid,'photo'=>new CURLFile($path),'caption'=>$adminText,'parse_mode'=>'HTML']);}catch(Throwable $e){send_msg($aid,$adminText);}}else send_msg($aid,$adminText);}else send_msg($aid,$adminText);
        }
        $payload=dashboard_payload(get_user_by_id((int)$user['id']));$payload['order']=order_public_payload($order);api_out($payload);
    }catch(Throwable $e){if($fileId){@unlink(__DIR__.'/'.$fileId);}api_out(['ok'=>false,'error'=>api_exception_code($e,'ORDER_NOT_FOUND'),'message'=>'سفارش پیدا نشد یا در وضعیت قابل ارسال رسید نیست.'],400);}
}

if ($action === 'credit_topup_submit_receipt') { api_rate_limit('credit_topup_receipt',(string)$user['id'],12,900,900); $id=(int)($input['topup_id']??0);$note=trim((string)($input['note']??''));$fileId=null;if(!empty($input['receipt_b64'])){$raw=(string)$input['receipt_b64'];if(strlen($raw)>8*1024*1024)api_out(['ok'=>false,'message'=>'حجم رسید بیشتر از حد مجاز است.'],400);if(!preg_match('#^data:image/(jpeg|jpg|png|webp);base64,#i',$raw))api_out(['ok'=>false,'message'=>'فرمت رسید معتبر نیست.'],400);$b64=preg_replace('#^data:image/(jpeg|jpg|png|webp);base64,#i','',$raw);$bin=base64_decode($b64,true);if($bin&&strlen($bin)>100&&strlen($bin)<=5*1024*1024){$fi=new finfo(FILEINFO_MIME_TYPE);$mime=$fi->buffer($bin);$ext=['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp'][$mime]??null;if(!$ext)api_out(['ok'=>false,'message'=>'محتوای تصویر معتبر نیست.'],400);$dir=__DIR__.'/uploads/receipts/'.date('Ymd');if(!is_dir($dir))@mkdir($dir,0775,true);$fileId='uploads/receipts/'.date('Ymd').'/topup_'.bin2hex(random_bytes(12)).'.'.$ext;file_put_contents(__DIR__.'/'.$fileId,$bin,LOCK_EX);}}
    try{$t=submit_credit_topup_receipt($id,(int)$user['id'],$note,$fileId);notify_admins('💳 رسید شارژ اعتبار ثبت شد\\nTop-up: <code>#'.$t['id'].'</code>\\nمبلغ: <b>'.money((int)$t['amount']).'</b>');api_out(dashboard_payload(get_user_by_id((int)$user['id']))+['topup'=>credit_topup_public($t)]);}catch(Throwable $e){api_out(['ok'=>false,'error'=>api_exception_code($e),'message'=>'ثبت رسید شارژ انجام نشد.'],400);} }
if ($action === 'cancel_credit_topup') {
    api_rate_limit('credit_topup_cancel',(string)$user['id'],15,300,300);
    if(!cancel_credit_topup((int)($input['topup_id']??0),(int)$user['id']))api_out(['ok'=>false,'message'=>'این درخواست شارژ دیگر قابل لغو نیست.'],400);
    api_out(dashboard_payload(get_user_by_id((int)$user['id'])));
}
if ($action === 'credit_topup_change_method') {
    api_rate_limit('credit_topup_change_method',(string)$user['id'],12,300,300);
    try{
        $topup=replace_credit_topup_payment((int)($input['topup_id']??0),(int)$user['id']);
        api_out(dashboard_payload(get_user_by_id((int)$user['id']))+['topup'=>credit_topup_public($topup)]);
    }catch(Throwable $e){api_out(['ok'=>false,'error'=>api_exception_code($e),'message'=>api_exception_message($e,'تغییر روش پرداخت انجام نشد.')],400);}
}
if ($action === 'admin_credit_topup_approve') { require_admin($user);$t=credit_topup_credit_once((int)($input['topup_id']??0),trim((string)($input['note']??'')));if(!$t)api_out(['ok'=>false,'message'=>'درخواست شارژ پیدا نشد.'],404);log_admin_action((int)$user['telegram_id'],'credit_topup_approve','credit_topup',(int)$t['id'],money((int)$t['amount']));notify_user_event((int)$t['user_id'],'wallet','اعتبار حساب شارژ شد',money((int)$t['amount']));if(!empty($t['telegram_id']))send_msg((int)$t['telegram_id'],'✅ شارژ اعتبار شما تایید شد.\\nمبلغ: <b>'.money((int)$t['amount']).'</b>');api_out(admin_payload()); }
if ($action === 'admin_credit_topup_reject') { require_admin($user);$t=reject_credit_topup((int)($input['topup_id']??0),trim((string)($input['note']??'')));if(!$t)api_out(['ok'=>false,'message'=>'درخواست شارژ پیدا نشد.'],404);log_admin_action((int)$user['telegram_id'],'credit_topup_reject','credit_topup',(int)$t['id']);notify_user_event((int)$t['user_id'],'wallet','درخواست شارژ رد شد','درخواست #'.(int)$t['id']);if(!empty($t['telegram_id']))send_msg((int)$t['telegram_id'],'❌ درخواست شارژ اعتبار #'.$t['id'].' رد شد.');api_out(admin_payload()); }

if(in_array($action,["admin_add_product", "admin_update_product", "admin_toggle_product", "admin_delete_product", "admin_hard_delete_product", "admin_add_category", "admin_update_category", "admin_delete_category", "admin_hard_delete_category", "admin_reorder_products", "admin_reorder_categories", "admin_add_variant", "admin_update_variant", "admin_delete_variant", "admin_hard_delete_variant"],true))api_out(['ok'=>false,'error'=>'LEGACY_API_DISABLED','message'=>'مدیریت مستقیم Products/Variants قدیمی غیرفعال شده؛ از Catalog Studio استفاده کنید.'],410);
// Admin Mini Panel actions
if ($action === 'admin_summary') { require_admin($user); api_out(admin_payload()); }
if ($action === 'admin_catalog_preview') {
    require_admin($user);
    set_setting('catalog_v2_last_scan',date('Y-m-d H:i:s')); api_out(admin_payload());
}
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
if ($action === 'admin_catalog_save_category') {
    require_admin($user); try{$id=catalog_save_category($input);log_admin_action((int)$user['telegram_id'],'catalog_save_category','store_category',$id,(string)($input['title']??''));api_out(admin_payload());}catch(Throwable $e){api_out(['ok'=>false,'error'=>api_exception_code($e),'message'=>'ذخیره دسته فروشگاه ناموفق بود.'],400);}
}
if ($action === 'admin_catalog_add_service') {
    require_admin($user); try{$id=catalog_create_service($input);log_admin_action((int)$user['telegram_id'],'catalog_add_service','service',$id,(string)($input['name']??''));api_out(admin_payload());}catch(Throwable $e){api_out(['ok'=>false,'error'=>api_exception_code($e),'message'=>'ساخت سرویس ناموفق بود.'],400);}
}
if ($action === 'admin_catalog_add_group') {
    require_admin($user); try{$id=catalog_create_group($input);log_admin_action((int)$user['telegram_id'],'catalog_add_group','service_group',$id,(string)($input['name']??''));api_out(admin_payload());}catch(Throwable $e){api_out(['ok'=>false,'error'=>api_exception_code($e),'message'=>'ساخت زیرسرویس ناموفق بود.'],400);}
}
if ($action === 'admin_catalog_add_plan') {
    require_admin($user); try{$id=catalog_create_plan($input);log_admin_action((int)$user['telegram_id'],'catalog_add_plan','service_plan',$id,(string)($input['title']??''));api_out(admin_payload());}catch(Throwable $e){api_out(['ok'=>false,'error'=>api_exception_code($e),'message'=>'ساخت پلن ناموفق بود.'],400);}
}
if ($action === 'admin_catalog_save_blueprint') {
    require_admin($user);
    try{$input['_admin_tid']=(int)$user['telegram_id'];$r=catalog_save_blueprint($input);log_admin_action((int)$user['telegram_id'],'catalog_save_blueprint','service',(int)($r['service_id']??0),'wizard create/edit');api_out(admin_payload()+['catalog_result'=>$r]);}
    catch(Throwable $e){api_out(['ok'=>false,'error'=>api_exception_code($e),'message'=>api_exception_message($e,'ذخیره سرویس انجام نشد.')],400);}
}
if ($action === 'admin_catalog_undo') {
    require_admin($user);
    try{$meta=catalog_undo_meta((int)$user['telegram_id']);$r=catalog_undo_last((int)$user['telegram_id']);log_admin_action((int)$user['telegram_id'],'catalog_undo','service',(int)($r['service_id']??0),'undo last catalog change');api_out(admin_payload()+['catalog_undo_result'=>$r,'catalog_undo_meta'=>$meta]);}
    catch(Throwable $e){api_out(['ok'=>false,'error'=>api_exception_code($e),'message'=>api_exception_message($e,'بازگشت تغییر انجام نشد.')],400);}
}
if ($action === 'admin_catalog_upload_image') {
    require_admin($user);
    api_rate_limit('catalog_image_upload',(string)$user['id'],30,900,900);
    try {
        $raw=(string)($input['image_b64']??'');
        if($raw==='')api_out(['ok'=>false,'error'=>'NO_IMAGE','message'=>'تصویری انتخاب نشده است.'],400);
        if(strlen($raw)>12*1024*1024)api_out(['ok'=>false,'error'=>'IMAGE_TOO_LARGE','message'=>'حجم تصویر بیشتر از حد مجاز است.'],400);
        if(!preg_match('#^data:image/(jpeg|jpg|png|webp);base64,#i',$raw))api_out(['ok'=>false,'error'=>'INVALID_IMAGE_TYPE','message'=>'فرمت تصویر باید JPG، PNG یا WEBP باشد.'],400);
        $b64=preg_replace('#^data:image/(jpeg|jpg|png|webp);base64,#i','',$raw);
        $bin=base64_decode($b64,true);
        if($bin===false||strlen($bin)<100||strlen($bin)>6*1024*1024)api_out(['ok'=>false,'error'=>'INVALID_IMAGE','message'=>'فایل تصویر معتبر نیست یا بیش از ۶ مگابایت است.'],400);

        // Do not make catalog uploads depend on the optional fileinfo extension.
        $mime='';
        if(class_exists('finfo')){
            try{$fi=new finfo(FILEINFO_MIME_TYPE);$mime=(string)$fi->buffer($bin);}catch(Throwable $ignored){}
        }
        if($mime===''){
            $info=@getimagesizefromstring($bin);
            $mime=is_array($info)?(string)($info['mime']??''):'';
        }
        $ext=['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp'][$mime]??null;
        if(!$ext)api_out(['ok'=>false,'error'=>'INVALID_IMAGE_CONTENT','message'=>'محتوای تصویر معتبر نیست یا PHP امکان شناسایی این تصویر را ندارد.'],400);

        $baseUploads=__DIR__.'/uploads';
        $catalogRoot=$baseUploads.'/catalog';
        $dir=$catalogRoot.'/'.date('Ym');
        foreach([$baseUploads,$catalogRoot,$dir] as $d){
            if(!is_dir($d)&&!@mkdir($d,0775,true))api_out(['ok'=>false,'error'=>'UPLOAD_DIR_FAILED','message'=>'ساخت پوشه آپلود ناموفق بود. Permission مسیر public/uploads را بررسی کن.'],500);
        }
        if(!is_writable($dir))api_out(['ok'=>false,'error'=>'UPLOAD_DIR_NOT_WRITABLE','message'=>'پوشه آپلود قابل نوشتن نیست. مالک public/uploads باید www-data باشد.'],500);

        try{$token=bin2hex(random_bytes(12));}catch(Throwable $e){$token=sha1(uniqid('',true).mt_rand());}
        $relative='uploads/catalog/'.date('Ym').'/catalog_'.$token.'.'.$ext;
        $target=__DIR__.'/'.$relative;
        $written=@file_put_contents($target,$bin,LOCK_EX);
        if($written===false||$written!==strlen($bin))api_out(['ok'=>false,'error'=>'UPLOAD_WRITE_FAILED','message'=>'ذخیره تصویر روی سرور ناموفق بود. فضای دیسک و Permission پوشه uploads را بررسی کن.'],500);
        @chmod($target,0640);

        $base=rtrim((string)app_config('PUBLIC_BASE_URL',''),'/');
        $url=$base!==''?$base.'/'.$relative:'/'.$relative;
        try{log_admin_action((int)$user['telegram_id'],'catalog_upload_image','catalog_image',null,$relative);}catch(Throwable $logError){error_log('[BlueGate catalog upload log] '.$logError->getMessage());}
        api_out(['ok'=>true,'image_url'=>$url,'relative_path'=>$relative]);
    } catch(Throwable $e) {
        error_log('[BlueGate catalog upload] '.$e->getMessage().' in '.$e->getFile().':'.$e->getLine());
        api_out(['ok'=>false,'error'=>'CATALOG_UPLOAD_FAILED','message'=>'آپلود تصویر روی سرور انجام نشد. Permission پوشه uploads و افزونه‌های PHP را بررسی کن.'],500);
    }
}
if ($action === 'admin_catalog_save_service') {
    require_admin($user);
    try{$id=catalog_save_service($input);log_admin_action((int)$user['telegram_id'],'catalog_save_service','service',$id,(string)($input['name']??''));api_out(admin_payload()+['catalog_saved_id'=>$id]);}
    catch(Throwable $e){api_out(['ok'=>false,'error'=>api_exception_code($e),'message'=>api_exception_message($e,'ذخیره سرویس انجام نشد.')],400);}
}
if ($action === 'admin_catalog_save_group') {
    require_admin($user);
    try{$id=catalog_save_group($input);log_admin_action((int)$user['telegram_id'],'catalog_save_group','service_group',$id,(string)($input['name']??''));api_out(admin_payload()+['catalog_saved_id'=>$id]);}
    catch(Throwable $e){api_out(['ok'=>false,'error'=>api_exception_code($e),'message'=>api_exception_message($e,'ذخیره زیرسرویس انجام نشد.')],400);}
}
if ($action === 'admin_catalog_save_plan') {
    require_admin($user);
    try{$id=catalog_save_plan($input);log_admin_action((int)$user['telegram_id'],'catalog_save_plan','service_plan',$id,(string)($input['title']??''));api_out(admin_payload()+['catalog_saved_id'=>$id]);}
    catch(Throwable $e){api_out(['ok'=>false,'error'=>api_exception_code($e),'message'=>api_exception_message($e,'ذخیره پلن انجام نشد.')],400);}
}
if ($action === 'admin_catalog_toggle_service') {
    require_admin($user);$id=(int)($input['service_id']??0);$q=db()->prepare('SELECT * FROM services WHERE id=?');$q->execute([$id]);$s=$q->fetch();if(!$s)api_out(['ok'=>false,'message'=>'سرویس پیدا نشد.'],404);
    $active=(int)$s['is_active']?0:1;catalog_save_service(['id'=>$id,'name'=>$s['name'],'category_id'=>$s['category_id'],'description'=>$s['description'],'image_url'=>$s['image_url'],'theme'=>$s['theme'],'badge'=>$s['badge'],'is_featured'=>$s['is_featured'],'is_active'=>$active,'sort_order'=>$s['sort_order']]);log_admin_action((int)$user['telegram_id'],'catalog_toggle_service','service',$id,$active?'enabled':'disabled');api_out(admin_payload());
}
if ($action === 'admin_catalog_fast_create') {
    require_admin($user); try{$input['_admin_tid']=(int)$user['telegram_id'];$r=catalog_fast_create($input);log_admin_action((int)$user['telegram_id'],'catalog_fast_create','catalog',(int)($r['service_id']??0),(string)($input['service_name']??''));api_out(admin_payload()+['fast_create'=>$r]);}catch(Throwable $e){api_out(['ok'=>false,'error'=>api_exception_code($e),'message'=>'ساخت سریع کاتالوگ ناموفق بود.'],400);}
}
if ($action === 'admin_purchase_reward') {
    require_admin($user);
    $buyerTid = (int)($input['buyer_tid'] ?? 0);
    $baseAmount = (int)($input['base_amount'] ?? 0);
    if (!$buyerTid || !$baseAmount) api_out(['ok'=>false, 'message'=>'آیدی عددی خریدار و مبلغ پایه الزامی است.'], 400);

    $buyer = get_user_by_tid($buyerTid);
    if (!$buyer || empty($buyer['referrer_id'])) {
        api_out(['ok'=>false, 'message'=>'این خریدار پیدا نشد یا معرف ثبت‌شده ندارد.'], 404);
    }
    
    $referrer = get_user_by_id((int)$buyer['referrer_id']);
    if (!$referrer) {
        api_out(['ok'=>false, 'message'=>'معرف کاربر پیدا نشد.'], 404);
    }

    $vip = vip_info((int)$referrer['referrals_count']);
    $amount = (int)round($baseAmount * (float)$vip['multiplier']);
    
    add_balance($referrer['id'], $amount, 'purchase_reward', 'پورسانت خرید زیرمجموعه با ضریب VIP', $buyer['id']);
    
    $refName = display_name($referrer);
    $msgAdmin = "پاداش خرید با موفقیت ثبت شد.\nمعرف: {$refName}\nمبلغ نهایی: ".number_format($amount)." تومان";
    
    tg('sendMessage', [
        'chat_id' => $referrer['telegram_id'],
        'text' => "🎁 زیرمجموعه شما خرید انجام داد.\nپورسانت: <b>".number_format($amount)." تومان</b>\nسطح شما: {$vip['emoji']} {$vip['fa']}",
        'parse_mode' => 'HTML',
        'reply_markup' => json_encode(main_menu_keyboard(is_full_admin($referrer['telegram_id'])))
    ]);

    api_out(admin_payload() + ['message' => $msgAdmin, 'amount' => $amount, 'referrer' => $refName]);
}

if ($action === 'admin_save_vip_rates') {
    require_admin($user);
    $rates = is_array($input['vip_tier_rates'] ?? null) ? $input['vip_tier_rates'] : [];
    if (!empty($rates)) {
        set_setting('vip_tier_rates', $rates);
    }
    api_out(admin_payload() + ['message' => 'نرخ‌های VIP با موفقیت به روز شد.']);
}
if ($action === 'admin_broadcast') {
    require_admin($user);$text=trim((string)($input['text']??''));if($text===''&&empty($input['media_b64']))api_out(['ok'=>false,'message'=>'متن پیام یا فایل الزامی است.'],400);$fileId=null;$method='sendMessage';$field=null;
    if(!empty($input['media_b64'])){$parts=explode(',',(string)$input['media_b64']);$decoded=base64_decode(count($parts)===2?$parts[1]:$parts[0],true);if($decoded===false||strlen($decoded)>20*1024*1024)api_out(['ok'=>false,'message'=>'فایل نامعتبر یا بیش از حد بزرگ است.'],400);$filename=preg_replace('/[^a-zA-Z0-9.\-_]/','',(string)($input['filename']??'file.dat'))?:'file.dat';$tmp=sys_get_temp_dir().'/bg_bc_'.bin2hex(random_bytes(6)).'_'.$filename;file_put_contents($tmp,$decoded);$mime=mime_content_type($tmp)?:'application/octet-stream';$method=str_starts_with($mime,'image/')&&!str_contains($mime,'svg')&&!str_contains($mime,'gif')?'sendPhoto':((str_starts_with($mime,'video/')||str_contains($mime,'gif'))?'sendVideo':'sendDocument');$field=['sendPhoto'=>'photo','sendVideo'=>'video','sendDocument'=>'document'][$method];$res=tg($method,['chat_id'=>(int)$user['telegram_id'],$field=>new CURLFile($tmp,$mime,$filename),'caption'=>$text,'parse_mode'=>'HTML']);@unlink($tmp);if(empty($res['ok']))api_out(['ok'=>false,'message'=>'آپلود فایل به تلگرام شکست خورد.'],500);$msg=$res['result']??[];if($field==='photo'){$ph=$msg['photo']??[];$last=$ph?end($ph):null;$fileId=$last['file_id']??null;}else $fileId=$msg[$field]['file_id']??null;if(!$fileId)api_out(['ok'=>false,'message'=>'شناسه فایل تلگرام دریافت نشد.'],500);}
    $job=queue_broadcast_job((int)$user['telegram_id'],$text,$method,$field,$fileId);log_admin_action((int)$user['telegram_id'],'broadcast_queue','broadcast_job',(int)$job['id'],$job['total_count'].' recipients');api_out(admin_payload()+['broadcast_job'=>$job,'message'=>'ارسال همگانی در صف قرار گرفت و توسط Cron پردازش می‌شود.']);
}
if ($action === 'admin_reorder_products') { require_admin($user); $ids=is_array($input['ordered_ids']??null)?array_map('intval',$input['ordered_ids']):[]; log_admin_action((int)$user['telegram_id'],'reorder_products','products',0,count($ids).' items'); $list=admin_reorder_products($ids); api_out(['ok'=>true,'products'=>$list]); }
if ($action === 'admin_reorder_categories') { require_admin($user); $ids=is_array($input['ordered_ids']??null)?array_map('intval',$input['ordered_ids']):[]; log_admin_action((int)$user['telegram_id'],'reorder_categories','categories',0,count($ids).' items'); $list=admin_reorder_categories($ids); api_out(['ok'=>true,'categories'=>$list]); }
if ($action === 'admin_search_orders') { require_admin($user); $s=(string)($input['search']??''); $st=(string)($input['status']??'all'); $list=admin_search_orders($s,$st,80); api_out(['ok'=>true,'orders'=>array_map('order_public_payload',$list)]); }
if ($action === 'admin_set_role') { require_admin($user); if(admin_role((int)$user['telegram_id'])!=='full') api_out(['ok'=>false,'error'=>'FULL_ADMIN_ONLY','message'=>'فقط ادمین کامل می‌تواند نقش بسازد.'],403); $tid=(int)($input['telegram_id']??0); $role=(string)($input['role']??'full'); $name=(string)($input['display_name']??''); if($tid<=0) api_out(['ok'=>false,'error'=>'INVALID_TID','message'=>'Telegram ID نامعتبر.'],400); log_admin_action((int)$user['telegram_id'],'set_role','admin_role',$tid,$role); $list=admin_set_role($tid,$role,$name); api_out(['ok'=>true,'admin_roles'=>$list]); }
if ($action === 'admin_remove_role') { require_admin($user); if(admin_role((int)$user['telegram_id'])!=='full') api_out(['ok'=>false,'error'=>'FULL_ADMIN_ONLY','message'=>'فقط ادمین کامل می‌تواند نقش حذف کند.'],403); $tid=(int)($input['telegram_id']??0); log_admin_action((int)$user['telegram_id'],'remove_role','admin_role',$tid); $list=admin_remove_role($tid); api_out(['ok'=>true,'admin_roles'=>$list]); }
if ($action === 'admin_backup_create') { require_admin($user); $b=blue_backup_create(); api_out(admin_payload() + ['backup'=>$b, 'message'=>'Backup saved on server.']); }
if ($action === 'admin_backup_send_bot') { require_admin($user); $b=blue_backup_send_to_admin((int)$user['telegram_id']); api_out(admin_payload() + ['backup'=>$b, 'message'=>'Backup sent to your Telegram chat.']); }
if ($action === 'admin_backup_delete') { require_admin($user); $fn=(string)($input['filename']??''); $ok=blue_backup_delete($fn); api_out(admin_payload() + ['deleted'=>$ok, 'message'=>$ok?'Backup deleted.':'Backup not found.']); }
if ($action === 'admin_backup_restore_server') { require_admin($user); $fn=(string)($input['filename']??''); if (!empty($input['confirm']) && strtoupper((string)$input['confirm'])==='RESTORE') { $res=blue_backup_restore_from_file(blue_backup_file_path($fn), true); api_out(admin_payload() + ['restore'=>$res, 'message'=>'Backup restored.']); } api_out(['ok'=>false,'message'=>'برای restore باید confirm=RESTORE ارسال شود.'],400); }
if ($action === 'admin_save_settings') {
    require_admin($user);
    if(isset($input['brand_name'])){ $bn=trim((string)$input['brand_name']); if($bn!=='') set_setting('brand_name',$bn); }
    if(isset($input['support_username'])) set_setting('support_username', ltrim(trim((string)$input['support_username']), '@'));
    if(isset($input['start_reward'])) set_setting('start_reward', max(0,(int)$input['start_reward']));
    if(isset($input['storefront_brand_subtitle'])) set_setting('storefront_brand_subtitle', trim((string)$input['storefront_brand_subtitle']));
    if(isset($input['storefront_hero_title'])) set_setting('storefront_hero_title', trim((string)$input['storefront_hero_title']));
    if(isset($input['storefront_hero_text'])) set_setting('storefront_hero_text', trim((string)$input['storefront_hero_text']));
    if(isset($input['storefront_announcement_enabled'])) set_setting('storefront_announcement_enabled', bool_input($input['storefront_announcement_enabled'])?'1':'0');
    if(isset($input['storefront_announcement_text'])) set_setting('storefront_announcement_text', trim((string)$input['storefront_announcement_text']));
    if(isset($input['storefront_stars_price_basis'])) { $b=strtolower((string)$input['storefront_stars_price_basis']); set_setting('storefront_stars_price_basis', in_array($b,['toman','usdt'],true)?$b:'toman'); }
    if(isset($input['storefront_star_sell_per_unit_toman'])) set_setting('storefront_star_sell_per_unit_toman', (string)max(0,(float)$input['storefront_star_sell_per_unit_toman']));
    if(isset($input['storefront_star_sell_per_unit_usdt'])) set_setting('storefront_star_sell_per_unit_usdt', (string)max(0,(float)$input['storefront_star_sell_per_unit_usdt']));
    if(isset($input['storefront_stars_min'])) set_setting('storefront_stars_min', max(1,(int)$input['storefront_stars_min']));
    if(isset($input['storefront_stars_max'])) set_setting('storefront_stars_max', max(1,(int)$input['storefront_stars_max']));
    if(isset($input['storefront_stars_step'])) set_setting('storefront_stars_step', max(1,(int)$input['storefront_stars_step']));
    if(isset($input['storefront_stars_presets'])) { $v=$input['storefront_stars_presets']; if(is_string($v)) $v=array_values(array_filter(array_map('intval',preg_split('/[,\s]+/',$v)))); if(is_array($v)) set_setting('storefront_stars_presets', array_values(array_map('intval',$v))); }
    if(isset($input['theme_color'])){ $c=validate_theme_color((string)$input['theme_color']); if($c) set_setting('theme_color',$c); }
    if(isset($input['button_colors_enabled'])) set_setting('button_colors_enabled', bool_input($input['button_colors_enabled'])?'1':'0');
    if(isset($input['button_colors']) && is_array($input['button_colors'])){
        $clean=[];
        foreach(['primary','secondary','danger','success','warning'] as $k){ $c=validate_theme_color((string)($input['button_colors'][$k]??'')); if($c) $clean[$k]=$c; }
        set_setting('button_colors', array_merge(button_colors(), $clean));
    }
    if(isset($input['payment_instructions'])) set_setting('payment_instructions',(string)$input['payment_instructions']);
    if(isset($input['payment_methods_enabled']) && is_array($input['payment_methods_enabled'])) set_payment_methods_enabled($input['payment_methods_enabled']);
    if(isset($input['credit_topup_enabled'])) set_setting('credit_topup_enabled',bool_input($input['credit_topup_enabled'])?'1':'0');
    if(isset($input['credit_topup_min'])) set_setting('credit_topup_min',max(1000,(int)$input['credit_topup_min']));
    if(isset($input['credit_topup_max'])) set_setting('credit_topup_max',max(setting_int('credit_topup_min',50000),(int)$input['credit_topup_max']));
    if(isset($input['credit_topup_presets'])){$v=$input['credit_topup_presets'];if(is_string($v))$v=array_values(array_filter(array_map('intval',preg_split('/[,\s]+/',$v))));if(is_array($v))set_setting('credit_topup_presets',array_values(array_unique(array_filter(array_map('intval',$v),fn($x)=>$x>0))));}
    if(isset($input['credit_topup_methods'])&&is_array($input['credit_topup_methods']))set_setting('credit_topup_methods',['card'=>!empty($input['credit_topup_methods']['card']),'stars'=>!empty($input['credit_topup_methods']['stars']),'crypto'=>!empty($input['credit_topup_methods']['crypto'])]);
    if(isset($input['card_accounts_text']) && trim((string)$input['card_accounts_text']) !== '') set_setting('card_accounts', (string)$input['card_accounts_text']);
    if(isset($input['stars_rate_toman'])) set_setting('stars_rate_toman', max(1,(int)$input['stars_rate_toman']));
    if(isset($input['crypto_wallets_text'])) set_crypto_wallets_lines((string)$input['crypto_wallets_text']);
    if(isset($input['crypto_manual_rates_text'])) set_crypto_manual_rates_lines((string)$input['crypto_manual_rates_text']);
    if(isset($input['crypto_rate_source'])) { $src=strtolower((string)$input['crypto_rate_source']); set_setting('crypto_rate_source', in_array($src, ['auto','wallex','ramzinex','nobitex','manual'], true) ? $src : 'auto'); }
    if(isset($input['crypto_rate_markup_percent'])) set_setting('crypto_rate_markup_percent', (string)max(0,(float)$input['crypto_rate_markup_percent']));
    if(isset($input['crypto_notify_rate_fail'])) set_setting('crypto_notify_rate_fail', bool_input($input['crypto_notify_rate_fail'])?'1':'0');
    if(isset($input['crypto_rate_refresh_interval_seconds'])) set_setting('crypto_rate_refresh_interval_seconds', (string)max(60,(int)$input['crypto_rate_refresh_interval_seconds']));
    if(isset($input['crypto_rate_provider_priority'])) set_setting('crypto_rate_provider_priority', preg_replace('/[^a-z,]/', '', strtolower((string)$input['crypto_rate_provider_priority'])) ?: 'wallex,ramzinex,nobitex');
    if(isset($input['require_contact_auth'])) set_setting('require_contact_auth', bool_input($input['require_contact_auth'])?'1':'0');
    if(isset($input['notify_new_user'])) set_setting('notify_new_user', bool_input($input['notify_new_user'])?'1':'0');
    if(isset($input['resend_api_key'])&&trim((string)$input['resend_api_key'])!=='') set_setting('resend_api_key',trim((string)$input['resend_api_key']));
    if(isset($input['resend_from_email'])) set_setting('resend_from_email', trim((string)$input['resend_from_email']));
    if(isset($input['require_email_verification'])) set_setting('require_email_verification', bool_input($input['require_email_verification'])?'1':'0');
    if(isset($input['spin_referrals_per_chance'])) set_setting('spin_referrals_per_chance', max(1,(int)$input['spin_referrals_per_chance']));
    if(isset($input['spin_rewards_text'])) set_setting('spin_rewards', parse_spin_rewards_lines((string)$input['spin_rewards_text']));
    if(isset($input['default_base_currency'])) set_setting('default_base_currency', strtoupper(trim((string)$input['default_base_currency'])));
    if(isset($input['crypto_rate_source']) || isset($input['crypto_rate_provider_priority'])) {
        try { crypto_refresh_rates_from_providers(false); } catch(Throwable $e){}
    }
    refresh_usd_product_price_cache();
    api_out(admin_payload());
}

// Persist a per-user theme color choice
if ($action === 'set_user_color') {
    $c = trim((string)($input['theme_color'] ?? ''));
    if ($c === '') {
        // clear per-user color
        db()->prepare('UPDATE users SET theme_color=NULL WHERE id=?')->execute([$user['id']]);
        api_out(dashboard_payload(get_user_by_tid((int)$user['telegram_id'])));
    }
    if (!preg_match('/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/', $c)) {
        api_out(['ok'=>false,'error'=>'INVALID_COLOR','message'=>'کد رنگ معتبر نیست.'], 400);
    }
    db()->prepare('UPDATE users SET theme_color=? WHERE id=?')->execute([$c, $user['id']]);
    api_out(dashboard_payload(get_user_by_tid((int)$user['telegram_id'])));
}


if ($action === 'get_usdt_rate' || $action === 'get_crypto_rates') {
    $usdtMeta = crypto_rate_meta('USDT');
    $trxMeta  = crypto_rate_meta('TRX');
    $tonMeta  = crypto_rate_meta('TON');
    api_out([
        'ok' => true,
        'rate' => (float)$usdtMeta['rate'],
        'source' => (string)$usdtMeta['source'],
        'updated_at' => $usdtMeta['updated_at'],
        'is_live' => !empty($usdtMeta['is_live']),
        'rates' => [
            'USDT' => ['rate' => (float)$usdtMeta['rate'], 'source' => (string)$usdtMeta['source'], 'updated_at' => $usdtMeta['updated_at'], 'is_live' => !empty($usdtMeta['is_live'])],
            'TRX'  => ['rate' => (float)$trxMeta['rate'], 'source' => (string)$trxMeta['source'], 'updated_at' => $trxMeta['updated_at'], 'is_live' => !empty($trxMeta['is_live'])],
            'TON'  => ['rate' => (float)$tonMeta['rate'], 'source' => (string)$tonMeta['source'], 'updated_at' => $tonMeta['updated_at'], 'is_live' => !empty($tonMeta['is_live'])],
        ]
    ]);
}

if ($action === 'admin_refresh_crypto_rates') {
    require_admin($user);
    try {
        $result = crypto_refresh_rates_from_providers(true);
        api_out(admin_payload() + ['rate_refresh'=>$result, 'message'=>'نرخ‌ها رفرش شدند و قیمت‌های دلاری محصول‌ها هم به‌روز شد.']);
    } catch (Throwable $e) {
        api_out(admin_payload() + ['ok'=>false, 'error'=>api_exception_code($e), 'message'=>'رفرش نرخ نوبیتکس انجام نشد؛ نرخ cache یا دستی استفاده می‌شود.'], 400);
    }
}

if ($action === 'admin_add_product') {
    require_admin($user);
    $name = trim((string)($input['name'] ?? ''));
    try { $pp = price_admin_payload_from_input($input); } catch (Throwable $e) { api_out(['ok' => false, 'message' => 'قیمت معتبر نیست یا نرخ USDT برای قیمت دلاری در دسترس نیست.'], 400); }
    if ($name === '') api_out(['ok' => false, 'message' => 'نام محصول الزامی است.'], 400);
    $catId = !empty($input['category_id']) ? (int)$input['category_id'] : null;
    $parentId = !empty($input['parent_id']) ? (int)$input['parent_id'] : null;
    $ptype = trim((string)($input['product_type'] ?? 'normal')) ?: 'normal';
    $slug = trim((string)($input['slug'] ?? '')) ?: null;
    $configJson = trim((string)($input['config_json'] ?? '')) ?: null;
    $delivery = normalize_delivery_type((string)($input['delivery_type'] ?? 'manual'));
    $commissionType = in_array(($input['commission_type'] ?? 'none'), ['none', 'fixed', 'percent'], true) ? $input['commission_type'] : 'none';
    $commissionValue = max(0, (int)($input['commission_value'] ?? 0));
    db()->prepare('INSERT INTO products (category_id,parent_id,slug,product_type,config_json,name,price,price_currency,price_usd,price_rate_toman,price_rate_source,price_rate_updated_at,short_description,full_description,image_url,image_srcset,delivery_type,commission_type,commission_value,duration_days,is_featured,is_active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')->execute([
        $catId ?: null,
        $parentId ?: null,
        $slug,
        $ptype,
        $configJson,
        $name,
        $pp['price'],
        $pp['price_currency'],
        $pp['price_usd'],
        $pp['price_rate_toman'],
        $pp['price_rate_source'],
        $pp['price_rate_updated_at'],
        (string)($input['short_description'] ?? ''),
        (string)($input['full_description'] ?? ''),
        trim((string)($input['image_url'] ?? '')) ?: null,
        trim((string)($input['image_srcset'] ?? '')) ?: null,
        $delivery,
        $commissionType,
        $commissionValue,
        max(0, (int)($input['duration_days'] ?? 0)),
        !empty($input['is_featured']) ? 1 : 0,
        1
    ]);
    api_out(admin_payload());
}
if ($action === 'admin_update_product') {
    require_admin($user);
    $id = (int)($input['product_id'] ?? 0);
    if (array_key_exists('parent_id',$input)) $input['parent_id'] = !empty($input['parent_id']) ? (int)$input['parent_id'] : null;
    if (array_key_exists('category_id',$input)) $input['category_id'] = !empty($input['category_id']) ? (int)$input['category_id'] : null;
    if (!empty($input['parent_id']) && (int)$input['parent_id'] === $id) api_out(['ok'=>false,'message'=>'محصول نمی‌تواند والد خودش باشد.'],400);
    if (array_key_exists('price_currency', $input) || array_key_exists('price_usd', $input) || array_key_exists('price', $input)) {
        try { $pp = price_admin_payload_from_input($input); foreach ($pp as $k => $v) update_product_field($id, $k, $v); } catch (Throwable $e) { api_out(['ok' => false, 'message' => 'قیمت معتبر نیست یا نرخ USDT برای قیمت دلاری در دسترس نیست.'], 400); }
    }
    foreach (['category_id', 'parent_id', 'slug', 'product_type', 'config_json', 'name', 'short_description', 'full_description', 'image_url', 'image_srcset', 'delivery_type', 'commission_type', 'commission_value', 'duration_days', 'is_active', 'is_featured'] as $f) {
        if (array_key_exists($f, $input)) update_product_field($id, $f, $input[$f]);
    }
    api_out(admin_payload());
}
if ($action === 'admin_delete_product') { require_admin($user); soft_delete_product((int)($input['product_id']??0)); api_out(admin_payload()); }
if ($action === 'admin_hard_delete_product') { require_admin($user); $ok=hard_delete_product((int)($input['product_id']??0)); if(!$ok) api_out(['ok'=>false,'message'=>'این محصول سفارش دارد؛ برای حفظ سوابق فقط غیرفعال‌سازی امن است.'],400); api_out(admin_payload()); }
if ($action === 'admin_toggle_product') { require_admin($user); db()->prepare('UPDATE products SET is_active=1-is_active WHERE id=?')->execute([(int)($input['product_id']??0)]); api_out(admin_payload()); }

if ($action === 'admin_add_category') { require_admin($user); $title=trim((string)($input['title']??'')); if($title==='') api_out(['ok'=>false,'message'=>'نام دسته الزامی است.'],400); db()->prepare('INSERT INTO product_categories (title,emoji,image_url,sort_order,is_active) VALUES (?,?,?,?,1)')->execute([$title, trim((string)($input['emoji']??'🛒')) ?: '🛒', trim((string)($input['image_url']??'')) ?: null, max(0,(int)($input['sort_order']??99))]); api_out(admin_payload()); }
if ($action === 'admin_update_category') { require_admin($user); $id=(int)($input['category_id']??0); foreach(['title','emoji','image_url','sort_order','is_active'] as $f){ if(array_key_exists($f,$input)) update_category_field($id,$f,$input[$f]); } api_out(admin_payload()); }
if ($action === 'admin_delete_category') { require_admin($user); soft_delete_category((int)($input['category_id']??0)); api_out(admin_payload()); }
if ($action === 'admin_hard_delete_category') { require_admin($user); hard_delete_category((int)($input['category_id']??0)); api_out(admin_payload()); }

if ($action === 'admin_add_variant') { require_admin($user); $pid=(int)($input['product_id']??0); $title=trim((string)($input['title']??'')); try{$pp=price_admin_payload_from_input($input);}catch(Throwable $e){api_out(['ok'=>false,'message'=>'قیمت پلن معتبر نیست یا نرخ USDT برای قیمت دلاری در دسترس نیست.'],400);} if($pid<=0||$title==='') api_out(['ok'=>false,'message'=>'محصول و نام پلن الزامی است.'],400); db()->prepare('INSERT INTO product_variants (product_id,title,price,price_currency,price_usd,price_rate_toman,price_rate_source,price_rate_updated_at,duration_days,discount_percent,description,sort_order,is_active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)')->execute([$pid,$title,$pp['price'],$pp['price_currency'],$pp['price_usd'],$pp['price_rate_toman'],$pp['price_rate_source'],$pp['price_rate_updated_at'],max(0,(int)($input['duration_days']??0)),max(0.0,min(100.0,parse_float_amount($input['discount_percent']??0))),trim((string)($input['description']??'')) ?: null,max(0,(int)($input['sort_order']??99))]); api_out(admin_payload()); }
if ($action === 'admin_update_variant') { require_admin($user); $id=(int)($input['variant_id']??0); if(array_key_exists('price_currency',$input)||array_key_exists('price_usd',$input)||array_key_exists('price',$input)){ try{$pp=price_admin_payload_from_input($input); foreach($pp as $k=>$v) update_variant_field($id,$k,$v);}catch(Throwable $e){api_out(['ok'=>false,'message'=>'قیمت پلن معتبر نیست یا نرخ USDT برای قیمت دلاری در دسترس نیست.'],400);} } foreach(['title','duration_days','discount_percent','description','sort_order','is_active'] as $f){ if(array_key_exists($f,$input)) update_variant_field($id,$f,$input[$f]); } api_out(admin_payload()); }
if ($action === 'admin_delete_variant') { require_admin($user); soft_delete_variant((int)($input['variant_id']??0)); api_out(admin_payload()); }
if ($action === 'admin_hard_delete_variant') { require_admin($user); $ok=hard_delete_variant((int)($input['variant_id']??0)); if(!$ok) api_out(['ok'=>false,'message'=>'این پلن سفارش دارد؛ برای حفظ سوابق فقط غیرفعال‌سازی امن است.'],400); api_out(admin_payload()); }

if ($action === 'admin_add_inventory') { require_admin($user); $pid=(int)($input['product_id']??0); $vid=!empty($input['variant_id'])?(int)$input['variant_id']:null; $content=trim((string)($input['content']??'')); if($pid<=0||$content==='') api_out(['ok'=>false,'message'=>'محصول و محتوای انبار الزامی است.'],400); $items=array_values(array_filter(array_map('trim', preg_split('/\R/u',$content)))); $q=db()->prepare('INSERT INTO inventory_items (product_id,variant_id,content,status) VALUES (?,?,?,"available")'); foreach($items as $item){$q->execute([$pid,$vid,$item]);} api_out(admin_payload()); }
if ($action === 'admin_update_inventory') { require_admin($user); $id=(int)($input['inventory_id']??0); foreach(['product_id','variant_id','content','status'] as $f){ if(array_key_exists($f,$input)) update_inventory_field($id,$f,$input[$f]); } api_out(admin_payload()); }
if ($action === 'admin_delete_inventory') { require_admin($user); delete_available_inventory((int)($input['inventory_id']??0)); api_out(admin_payload()); }
if ($action === 'admin_hard_delete_inventory') { require_admin($user); hard_delete_inventory((int)($input['inventory_id']??0)); api_out(admin_payload()); }

if ($action === 'admin_add_coupon') {
    require_admin($user);
    $code = trim((string)($input['code'] ?? ''));
    $type = (string)($input['discount_type'] ?? 'percent');
    $value = max(0, (int)($input['discount_value'] ?? 0));
    $minAmount = max(0, (int)($input['min_order_amount'] ?? 0));
    $maxUses = max(0, (int)($input['max_uses'] ?? 0));
    $maxUsesPerUser = max(1, (int)($input['max_uses_per_user'] ?? 1));
    $catId = !empty($input['category_id']) ? (int)$input['category_id'] : null;
    $expires = (string)($input['expires_at'] ?? '');
    admin_add_coupon($code, $type, $value, $maxUses, $expires, $minAmount, $maxUsesPerUser, $catId);
    api_out(admin_payload());
}
if ($action === 'admin_toggle_coupon') { require_admin($user); $id=(int)($input['coupon_id']??0); db()->prepare('UPDATE coupons SET is_active=1-is_active WHERE id=?')->execute([$id]); api_out(admin_payload()); }
if ($action === 'admin_delete_coupon') { require_admin($user); $id=(int)($input['coupon_id']??0); db()->prepare('DELETE FROM coupons WHERE id=?')->execute([$id]); api_out(admin_payload()); }

if ($action === 'admin_archive_order') { require_admin($user); $oid=(int)($input['order_id']??0); $order=archive_order($oid); if(!$order) api_out(['ok'=>false,'message'=>'سفارش پیدا نشد.'],404); api_out(admin_payload()); }
if ($action === 'admin_delete_order') { require_admin($user); $oid=(int)($input['order_id']??0); if(!hard_delete_order($oid,true)) api_out(['ok'=>false,'message'=>'حذف کامل فقط برای سفارش‌های لغو/رد/مرجوع‌شده مجاز است.'],400); api_out(admin_payload()); }
if ($action === 'admin_cleanup_orders') { require_admin($user); $days = array_key_exists('older_days',$input) && $input['older_days'] !== '' ? max(0,(int)$input['older_days']) : null; $count=hard_delete_cleanup_orders($days); api_out(admin_payload() + ['deleted'=>$count]); }
if ($action === 'admin_order_status') { require_admin($user); $oid=(int)($input['order_id']??0); $status=(string)($input['status']??''); if(!in_array(normalize_order_status($status),['reviewing','payment_confirmed','preparing','rejected','canceled','refunded'],true)) api_out(['ok'=>false,'message'=>'وضعیت معتبر نیست.'],400); $order=update_order_status($oid,$status,order_status_fa($status),(string)($input['note']??''),true); if(!$order) api_out(['ok'=>false,'message'=>'سفارش پیدا نشد.'],404); api_out(admin_payload()); }
if ($action === 'admin_deliver_order') { require_admin($user); $oid=(int)($input['order_id']??0); $delivery=trim((string)($input['delivery']??'')); if($delivery==='') api_out(['ok'=>false,'message'=>'متن تحویل خالی است.'],400); $order=deliver_order($oid,$delivery); if(!$order) api_out(['ok'=>false,'message'=>'سفارش پیدا نشد.'],404); send_msg($order['telegram_id'], "📦 سفارش شما تحویل داده شد.\nسفارش: <code>#{$oid}</code>\nمحصول: <b>".h($order['product_name'])."</b>\n\nاطلاعات تحویل:\n<code>".h($order['delivery_text'])."</code>", main_menu_keyboard(is_full_admin($order['telegram_id']))); api_out(admin_payload()); }
if ($action === 'admin_set_service_delivery') {
    require_admin($user);
    $oid=(int)($input['order_id']??0); $rawUrl=(string)($input['delivery_url']??'');
    $title=trim((string)($input['delivery_title']??'مدیریت سرویس')); $note=trim((string)($input['delivery_note']??''));
    if($oid<=0 || trim($rawUrl)==='') api_out(['ok'=>false,'message'=>'شماره سفارش و لینک HTTPS سرویس الزامی است.'],400);
    try { $url=validate_service_delivery_url($rawUrl); }
    catch(Throwable $e){
        $code=api_exception_code($e,'SERVICE_URL_INVALID');
        $msg=str_contains($code,'HTTPS')?'لینک سرویس باید با https:// شروع شود.'
            :(str_contains($code,'HOST_BLOCKED')?'آدرس‌های localhost، شبکه خصوصی یا رزروشده برای تحویل سرویس مجاز نیستند.'
            :(str_contains($code,'PORT')?'پورت لینک سرویس معتبر نیست.'
            :'لینک سرویس معتبر نیست. آدرس HTTPS دامنه عمومی، شامل پورت‌هایی مثل :2096، مجاز است.'));
        api_out(['ok'=>false,'error'=>$code,'message'=>$msg],400);
    }
    try { $order=set_order_service_delivery($oid,$url,$title,$note,true); }
    catch(Throwable $e){
        error_log('[BlueGate service delivery #'.$oid.'] '.$e->getMessage());
        api_out(['ok'=>false,'error'=>api_exception_code($e,'SERVICE_DELIVERY_FAILED'),'message'=>'لینک معتبر است، اما ثبت/تحویل سفارش کامل نشد. دوباره تلاش کن یا وضعیت سفارش را بررسی کن.'],500);
    }
    if(!$order) api_out(['ok'=>false,'message'=>'سفارش پیدا نشد.'],404);
    if(!empty($order['telegram_id'])) send_msg((int)$order['telegram_id'], "✅ سرویس سفارش <code>#{$oid}</code> آماده شد.
برای مشاهده یا کپی لینک، وارد «سفارش‌های من» شوید.", main_menu_keyboard(is_full_admin((int)$order['telegram_id'])));
    api_out(admin_payload());
}
if ($action === 'admin_order_note') { require_admin($user); $oid=(int)($input['order_id']??0); $note=trim((string)($input['note']??'')); $order=order_by_id($oid); if(!$order) api_out(['ok'=>false,'message'=>'سفارش پیدا نشد.'],404); db()->prepare('UPDATE orders SET admin_note=? WHERE id=?')->execute([$note, $oid]); add_order_event($oid, 'note', 'یادداشت داخلی ثبت/ویرایش شد', $note, false); api_out(admin_payload()); }

if ($action === 'admin_add_balance') { require_admin($user); $tid=(int)($input['telegram_id']??0); $amount=(int)($input['amount']??0); if($tid<=0 || $amount===0) api_out(['ok'=>false,'message'=>'مبلغ و آیدی نامعتبر'],400); $u=get_user_by_tid($tid); if(!$u) api_out(['ok'=>false,'message'=>'کاربر پیدا نشد'],404); add_balance((int)$u['id'], $amount, 'admin_adjust', 'تغییر اعتبار توسط ادمین', null); api_out(admin_payload()); }
if ($action === 'admin_ban_user') { require_admin($user); $tid=(int)($input['telegram_id']??0); if($tid<=0) api_out(['ok'=>false,'message'=>'آیدی نامعتبر'],400); db()->prepare('UPDATE users SET is_banned=1,auth_token=NULL,auth_token_hash=NULL,auth_token_expires_at=NULL WHERE telegram_id=?')->execute([$tid]); api_out(admin_payload()); }

if ($action === 'delete_my_account') {
    delete_user_account((int)$user['id']);
    api_clear_session_cookie();api_out(['ok'=>true,'message'=>'دسترسی حساب و اطلاعات هویتی شما حذف شد؛ سوابق سفارش برای حسابداری به‌صورت ناشناس نگهداری می‌شود.']);
}

if ($action === 'admin_get_user') {
    $targetUserId=(int)($input['user_id']??0);$targetUser=get_user_by_id($targetUserId);if(!$targetUser)api_out(['ok'=>false,'error'=>'USER_NOT_FOUND','message'=>'کاربر یافت نشد.'],404);
    $safe=$targetUser;unset($safe['password_hash'],$safe['auth_token'],$safe['auth_token_hash'],$safe['email_verification_token']);api_out(['ok'=>true,'user'=>$safe]);
}

if ($action === 'admin_edit_user') {
    $targetUserId=(int)($input['user_id']??0);if($targetUserId<=0)api_out(['ok'=>false,'error'=>'INVALID_USER_ID','message'=>'شناسه کاربر معتبر نیست.'],400);
    admin_update_user_profile($targetUserId,$input);$updatedUser=get_user_by_id($targetUserId);$safe=$updatedUser?:[];unset($safe['password_hash'],$safe['auth_token'],$safe['auth_token_hash'],$safe['email_verification_token']);api_out(['ok'=>true,'user'=>$safe,'message'=>'اطلاعات کاربر با موفقیت بروزرسانی شد.']);
}


api_out(['ok'=>false, 'error'=>'UNKNOWN_ACTION'], 404);
