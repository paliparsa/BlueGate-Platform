<?php
if (!ob_start('ob_gzhandler')) { ob_start(); }
require_once __DIR__ . '/../app/bootstrap.php';
try {
    if (!setting('schema_migrated_v3') || !setting('schema_merged_storefront_v1') || !setting('schema_service_viewer_v1')) { migrate(); set_setting('schema_migrated_v3', '1'); set_setting('schema_merged_storefront_v1', '1'); set_setting('schema_service_viewer_v1', '1'); }
} catch (Throwable $e) {}
header('Content-Type: application/json; charset=utf-8');
header('Vary: Accept-Encoding');
$requestOrigin = trim((string)($_SERVER['HTTP_ORIGIN'] ?? ''));
$allowedOrigin = trim((string)app_config('WEB_ALLOWED_ORIGIN', ''));
if ($requestOrigin !== '') {
    $originHost = strtolower((string)(parse_url($requestOrigin, PHP_URL_HOST) ?: ''));
    $requestHost = strtolower(preg_replace('/:\d+$/', '', (string)($_SERVER['HTTP_HOST'] ?? '')));
    if (($allowedOrigin !== '' && rtrim($requestOrigin, '/') === rtrim($allowedOrigin, '/')) || ($originHost !== '' && $originHost === $requestHost)) {
        header('Access-Control-Allow-Origin: '.$requestOrigin);
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
function get_authenticated_user(string $initData, ?string $authToken = null): array|false {
    if (!empty($initData)) {
        $validated = verify_webapp_init_data($initData);
        if ($validated && !empty($validated['user'])) {
            $tgUser = json_decode($validated['user'], true);
            if ($tgUser && !empty($tgUser['id'])) {
                $user = create_or_update_user($tgUser, null);
                if (is_joined_channel((int)$tgUser['id'])) try_reward_referrer($user);
                $fullUser = get_user_by_tid((int)$tgUser['id']);
                if ($fullUser) {
                    if (empty($fullUser['auth_token'])) {
                        $token = issue_user_auth_token((int)$fullUser['id']);
                        $fullUser['auth_token'] = $token;
                    }
                    return $fullUser;
                }
            }
        }
    }
    if (!empty($authToken)) {
        $user = get_user_by_token($authToken);
        if ($user) {
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

    $products = array_map(fn($p)=>product_payload($p, true), shop_products(null, true));
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
        'min_withdraw' => setting_int('min_withdraw', 50000),
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
            'total_withdrawn' => 0,
            'referrals_count' => 0,
            'today_referrals' => 0,
            'spin_balance' => 0,
            'is_guest' => true,
            'vip' => vip_info(0)
        ],
        'missions' => [],
        'leaderboard' => array_map(function($r){ return ['name'=>strip_tags(display_name($r)), 'referrals'=>(int)$r['referrals_count'], 'earned'=>(int)$r['total_earned']]; }, top_users(10)),
        'transactions' => [],
        'withdrawals' => [],
        'shop_categories' => array_map('category_payload', shop_categories(true)),
        'shop_products' => $products,
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
            'sort_order' => (int)($v['sort_order'] ?? 0),
            'is_active' => (int)($v['is_active'] ?? 1)
        ];
    }, product_variants((int)$p['id'], $activeVariants));

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
    return ['id'=>(int)$user['id'], 'telegram_id'=>(int)$user['telegram_id'], 'username'=>$user['username'], 'first_name'=>$user['first_name'], 'last_name'=>$user['last_name'] ?? null, 'email'=>$user['email'] ?? null, 'phone_number'=>$user['phone_number'] ?? null, 'phone_verified_at'=>$user['phone_verified_at'] ?? null, 'ref_code'=>$user['ref_code'], 'referral_link'=>referral_link($user), 'balance'=>(int)$user['balance'], 'total_earned'=>(int)$user['total_earned'], 'total_withdrawn'=>(int)$user['total_withdrawn'], 'referrals_count'=>(int)$user['referrals_count'], 'today_referrals'=>$today, 'spin_balance'=>(int)$user['spin_balance'], 'vip'=>$vip, 'customer'=>$customer, 'theme_color'=>$user['theme_color'] ?? null];
}
function dashboard_payload(array $user): array {
    $missions = []; $today = date('Y-m-d'); $todayCount = today_referrals((int)$user['id']);
    foreach (mission_rows() as $m) $missions[] = ['target'=>(int)$m['target'], 'reward'=>(int)$m['reward'], 'done'=>$todayCount >= (int)$m['target'], 'claimed'=>is_mission_claimed((int)$user['id'], $today, (int)$m['target'])];
    $tx = db()->prepare('SELECT type, amount, description, created_at FROM transactions WHERE user_id=? ORDER BY id DESC LIMIT 15'); $tx->execute([$user['id']]);
    $wd = db()->prepare('SELECT amount, status, created_at FROM withdrawals WHERE user_id=? ORDER BY id DESC LIMIT 10'); $wd->execute([$user['id']]);
    $products = array_map(fn($p)=>product_payload($p, true), shop_products(null, true));
    return ['ok'=>true, 'bot_username'=>app_config('BOT_USERNAME',''), 'brand'=>setting('brand_name', app_config('BRAND_NAME', 'BlueGate')), 'theme_color'=>setting('theme_color', app_config('DEFAULT_THEME_COLOR', '#1d9bf0')), 'button_colors_enabled'=>setting_bool('button_colors_enabled', true), 'button_colors'=>button_colors(), 'require_contact_auth'=>setting_bool('require_contact_auth', false), 'notify_new_user'=>setting_bool('notify_new_user', true), 'start_reward'=>setting_int('start_reward', 2000), 'min_withdraw'=>setting_int('min_withdraw', 50000), 'spin_every'=>setting_int('spin_referrals_per_chance', 5), 'spin_rewards'=>spin_rewards_public(), 'support_username'=>setting('support_username', app_config('SUPPORT_USERNAME', 'BlueGateSupport')), 'custom_code_min'=>setting_int('custom_code_min_referrals', 3), 'is_admin'=>is_admin($user), 'user'=>user_payload($user), 'missions'=>$missions, 'leaderboard'=>array_map(function($r){ return ['name'=>strip_tags(display_name($r)), 'referrals'=>(int)$r['referrals_count'], 'earned'=>(int)$r['total_earned']]; }, top_users(10)), 'transactions'=>$tx->fetchAll(), 'withdrawals'=>$wd->fetchAll(), 'shop_categories'=>array_map('category_payload', shop_categories(true)), 'shop_products'=>$products, 'orders'=>array_map('order_public_payload', user_orders((int)$user['id'], 20)), 'payment_methods'=>payment_methods_public($user), 'payment_instructions'=>setting('payment_instructions', 'لطفاً پرداخت را انجام دهید و رسید را ارسال کنید.'), 'storefront_settings'=>storefront_settings_payload(), 'storefront_content'=>storefront_content_payload(), 'storefront_rates'=>storefront_rates_payload(), 'achievements'=>user_achievements($user)];
}
function require_admin(array $user): void { if (!is_admin($user)) api_out(['ok'=>false,'error'=>'ADMIN_ONLY','message'=>'دسترسی ادمین لازم است.'], 403); }
function admin_payload(): array {
    return ['ok'=>true,
        'report'=>sales_report(),
        'cleanup'=>['all'=>cleanup_orders_count(), 'older_7'=>cleanup_orders_count(7), 'older_30'=>cleanup_orders_count(30), 'archived'=>archived_orders_count()],
        'orders'=>array_map(fn($o)=>order_public_payload($o, true), admin_orders(null, 80)),
        'products'=>array_map(fn($p)=>product_payload($p, false), shop_products(null, false)),
        'categories'=>array_map('category_payload', shop_categories(false)),
        'inventory'=>inventory_items_for_admin(150),
        'variants'=>db()->query('SELECT v.*, p.name product_name FROM product_variants v JOIN products p ON p.id=v.product_id ORDER BY v.id DESC LIMIT 150')->fetchAll(),
        'settings'=>['payment_instructions'=>setting('payment_instructions',''), 'payment_methods_enabled'=>setting_json('payment_methods_enabled', ['wallet'=>true,'card'=>true,'stars'=>false,'crypto'=>false]), 'payment_methods'=>payment_methods_public(null), 'card_accounts_text'=>card_accounts_lines(), 'stars_rate_toman'=>setting_int('stars_rate_toman', 3200), 'crypto_wallets_text'=>crypto_wallets_lines(), 'crypto_manual_rates_text'=>crypto_manual_rates_lines(), 'crypto_rate_source'=>setting('crypto_rate_source','auto'), 'crypto_rate_markup_percent'=>(float)setting('crypto_rate_markup_percent','1'), 'crypto_notify_rate_fail'=>setting_bool('crypto_notify_rate_fail', true), 'crypto_rate_refresh_interval_seconds'=>setting_int('crypto_rate_refresh_interval_seconds', 600), 'crypto_rate_cache'=>crypto_rate_cache(), 'crypto_rate_last_result'=>setting_json('crypto_rate_last_result', []), 'crypto_rate_provider_priority'=>setting('crypto_rate_provider_priority','wallex,ramzinex,nobitex'), 'theme_color'=>setting('theme_color','#1d9bf0'), 'button_colors_enabled'=>setting_bool('button_colors_enabled', true), 'button_colors'=>button_colors(), 'require_contact_auth'=>setting_bool('require_contact_auth', false), 'notify_new_user'=>setting_bool('notify_new_user', true), 'spin_referrals_per_chance'=>setting_int('spin_referrals_per_chance', 5), 'spin_rewards_text'=>spin_rewards_lines(), 'backup_last_created_at'=>setting('backup_last_created_at',''), 'backup_last_restored_at'=>setting('backup_last_restored_at',''), 'brand_name'=>setting('brand_name', app_config('BRAND_NAME', 'BlueGate')), 'support_username'=>setting('support_username', app_config('SUPPORT_USERNAME', 'BlueGateSupport')), 'min_withdraw'=>setting_int('min_withdraw',50000), 'start_reward'=>setting_int('start_reward',2000), 'storefront_brand_subtitle'=>setting('storefront_brand_subtitle','Digital Services'), 'storefront_hero_title'=>setting('storefront_hero_title','سرویس‌های دیجیتال، ساده و سریع'), 'storefront_hero_text'=>setting('storefront_hero_text',''), 'storefront_announcement_enabled'=>setting_bool('storefront_announcement_enabled',true), 'storefront_announcement_text'=>setting('storefront_announcement_text',''), 'storefront_star_sell_per_unit_toman'=>(float)setting('storefront_star_sell_per_unit_toman','3456'), 'storefront_star_sell_per_unit_usdt'=>(float)setting('storefront_star_sell_per_unit_usdt','0.018'), 'storefront_stars_price_basis'=>setting('storefront_stars_price_basis','toman'), 'storefront_stars_min'=>setting_int('storefront_stars_min',50), 'storefront_stars_max'=>setting_int('storefront_stars_max',10000), 'storefront_stars_step'=>setting_int('storefront_stars_step',25), 'storefront_stars_presets'=>setting_json('storefront_stars_presets',[100,500,1000,2500,5000]), 'default_base_currency'=>setting('default_base_currency', 'USDT'), 'resend_api_key'=>setting('resend_api_key',''), 'resend_from_email'=>setting('resend_from_email','onboarding@resend.dev'), 'require_email_verification'=>setting_bool('require_email_verification', true), 'vip_tier_rates'=>setting_json('vip_tier_rates', [])],
        'backups'=>blue_backup_list(),
        'withdrawals'=>admin_list_withdrawals('all'),
        'coupons'=>admin_list_coupons(),
        'activity_log'=>admin_activity_log(100),
        'admin_roles'=>admin_list_roles(),
        'forecast'=>admin_revenue_forecast()
    ];
}
function bool_input($v): int { return in_array(strtolower((string)$v), ['1','true','yes','on'], true) ? 1 : 0; }

$input = array_merge($_GET, $_POST, request_json());
$action = $input['action'] ?? ($_GET['action'] ?? 'me');
$initData = $input['initData'] ?? ($_GET['initData'] ?? '');
$authToken = $input['authToken'] ?? ($_GET['authToken'] ?? ($_SERVER['HTTP_X_WEB_TOKEN'] ?? ''));

if ($action === 'register') {
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
    if (mb_strlen($password) < 6) {
        api_out(['ok'=>false, 'error'=>'INVALID_PASSWORD', 'message'=>'رمز عبور باید حداقل ۶ کاراکتر باشد.'], 400);
    }
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
    
    api_out(dashboard_payload($user) + ['auth_token' => $user['auth_token']]);
}

if ($action === 'verify_email_otp') {
    $userId = (int)($input['user_id'] ?? 0);
    $otp = trim((string)($input['otp'] ?? ($input['otp_code'] ?? '')));
    if ($userId <= 0 || strlen($otp) < 4) {
        api_out(['ok'=>false, 'error'=>'INVALID_OTP', 'message'=>'کد تایید وارد شده معتبر نیست.'], 400);
    }
    if (!verify_email_otp($userId, $otp)) {
        api_out(['ok'=>false, 'error'=>'OTP_VERIFICATION_FAILED', 'message'=>'کد تایید اشتباه است یا منقضی شده است.'], 400);
    }
    $user = get_user_by_id($userId);
    $token = issue_user_auth_token((int)$user['id']);
    $user['auth_token'] = $token;
    notify_new_user_signup($user, '🌐 وب‌سایت (ایمیل تایید شد)');
    api_out(dashboard_payload($user) + ['auth_token' => $token, 'message' => 'ایمیل شما با موفقیت تایید شد! 🎉']);
}

if ($action === 'resend_email_otp') {
    $userId = (int)($input['user_id'] ?? 0);
    $user = get_user_by_id($userId);
    if (!$user || empty($user['email'])) {
        api_out(['ok'=>false, 'error'=>'USER_NOT_FOUND', 'message'=>'کاربر یا ایمیل پیدا نشد.'], 400);
    }
    $res = send_email_otp($user);
    if (!empty($res['ok'])) {
        api_out(['ok'=>true, 'message'=>'کد تایید جدید به ایمیل شما ارسال شد.']);
    } else {
        api_out(['ok'=>false, 'error'=>'SEND_FAILED', 'message'=>$res['message'] ?? 'ارسال ایمیل ناموفق بود.'], 500);
    }
}

if ($action === 'login') {
    $identifier = trim((string)($input['username'] ?? ($input['identifier'] ?? '')));
    $password = (string)($input['password'] ?? '');

    $user = get_user_by_email_or_username($identifier);
    if (!$user || empty($user['password_hash']) || !password_verify($password, $user['password_hash'])) {
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

    $token = issue_user_auth_token((int)$user['id']);
    $user['auth_token'] = $token;
    api_out(dashboard_payload($user) + ['auth_token' => $token]);
}

if ($action === 'forgot_password_request') {
    $identifier = trim((string)($input['email'] ?? ($input['identifier'] ?? '')));
    if ($identifier === '') {
        api_out(['ok'=>false, 'error'=>'EMPTY_IDENTIFIER', 'message'=>'لطفاً ایمیل یا نام کاربری خود را وارد کنید.'], 400);
    }
    $user = get_user_by_email_or_username($identifier);
    if (!$user || empty($user['email'])) {
        api_out(['ok'=>false, 'error'=>'USER_NOT_FOUND', 'message'=>'حسابی با این اطلاعات یا ایمیل پیدا نشد.'], 404);
    }
    $res = send_password_reset_otp($user);
    if (!empty($res['ok'])) {
        api_out([
            'ok' => true,
            'user_id' => (int)$user['id'],
            'email' => $user['email'],
            'message' => 'کد ۶ رقمی بازیابی رمز عبور به ایمیل شما ارسال شد.'
        ]);
    } else {
        api_out(['ok'=>false, 'error'=>'SEND_FAILED', 'message'=>$res['message'] ?? 'ارسال ایمیل بازیابی ناموفق بود.'], 500);
    }
}

if ($action === 'reset_password_submit') {
    $userId = (int)($input['user_id'] ?? 0);
    $otp = trim((string)($input['otp'] ?? ''));
    $newPassword = (string)($input['new_password'] ?? '');

    if ($userId <= 0 || strlen($otp) < 4) {
        api_out(['ok'=>false, 'error'=>'INVALID_OTP', 'message'=>'کد تایید وارد شده معتبر نیست.'], 400);
    }
    if (mb_strlen($newPassword) < 6) {
        api_out(['ok'=>false, 'error'=>'INVALID_PASSWORD', 'message'=>'رمز عبور جدید باید حداقل ۶ کاراکتر باشد.'], 400);
    }
    if (!reset_password_with_otp($userId, $otp, $newPassword)) {
        api_out(['ok'=>false, 'error'=>'RESET_FAILED', 'message'=>'کد تایید اشتباه است یا منقضی شده است.'], 400);
    }
    $user = get_user_by_id($userId);
    $token = issue_user_auth_token((int)$user['id']);
    api_out(['ok'=>true, 'message'=>'رمز عبور شما با موفقیت تغییر کرد! اکنون وارد شده‌اید.', 'auth_token'=>$token] + dashboard_payload($user));
}

if ($action === 'telegram_login') {
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
    $token = issue_user_auth_token((int)$user['id']);
    $user['auth_token'] = $token;
    api_out(dashboard_payload($user) + ['auth_token' => $token]);
}

$user = get_authenticated_user((string)$initData, (string)$authToken);

if ($action === 'me') {
    if (!$user) {
        api_out(guest_dashboard_payload());
    } else {
        $token = $user['auth_token'] ?? issue_user_auth_token((int)$user['id']);
        api_out(dashboard_payload($user) + ['auth_token' => $token]);
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
        'shop_products'=>array_map(fn($p)=>product_payload($p, true), shop_products(null, true)),
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

if ($action === 'logout') {
    if (!empty($user['id'])) {
        db()->prepare('UPDATE users SET auth_token=NULL WHERE id=?')->execute([(int)$user['id']]);
    }
    api_out(['ok'=>true]);
}
if ($action === 'my_orders') { api_out(['ok'=>true, 'orders'=>array_map('order_public_payload', user_orders((int)$user['id'], 50))]); }
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
if ($action === 'spin') { $user=get_user_by_id((int)$user['id']); if ((int)$user['spin_balance']<=0) api_out(['ok'=>false,'error'=>'NO_SPIN_BALANCE','message'=>'فعلاً شانس گردونه نداری.'],400); $rewards=spin_rewards_public(); $reward=weighted_spin_reward(); $title=$reward['title']??'جایزه گردونه'; $amount=(int)($reward['amount']??0); $idx=0; foreach($rewards as $i=>$r){ if(($r['title']??'')===$title && (int)($r['amount']??0)===$amount){ $idx=$i; break; } } db()->prepare('UPDATE users SET spin_balance=spin_balance-1 WHERE id=? AND spin_balance>0')->execute([$user['id']]); db()->prepare('INSERT INTO spin_logs (user_id, prize_title, prize_amount) VALUES (?,?,?)')->execute([$user['id'],$title,$amount]); if($amount>0)add_balance($user['id'],$amount,'spin_reward',$title,null); if(!empty($reward['notify_admin'])) notify_admins("🎡 جایزه Mini App نیازمند بررسی\nکاربر: <code>".h($user['first_name']??$user['username']??$user['id'])."</code>\nجایزه: <b>".h($title)."</b>"); api_out(dashboard_payload(get_user_by_id((int)$user['id'])) + ['prize'=>['title'=>$title,'amount'=>$amount,'index'=>$idx]]); }
if ($action === 'withdraw') { $user=get_user_by_id((int)$user['id']); $card=trim((string)($input['card_info']??'')); if(mb_strlen($card)<8) api_out(['ok'=>false,'error'=>'INVALID_CARD_INFO','message'=>'اطلاعات کارت/شبا کامل نیست.'],400); $min=setting_int('min_withdraw',50000); if((int)$user['balance']<$min) api_out(['ok'=>false,'error'=>'LOW_BALANCE','message'=>'موجودی به حداقل برداشت نمی‌رسد.'],400); $pending=db()->prepare('SELECT COUNT(*) c FROM withdrawals WHERE user_id=? AND status="pending"'); $pending->execute([$user['id']]); if((int)$pending->fetch()['c']>0) api_out(['ok'=>false,'error'=>'PENDING_WITHDRAWAL','message'=>'یک برداشت در انتظار دارید.'],400); $amount=(int)$user['balance']; db()->prepare('INSERT INTO withdrawals (user_id, amount, card_info) VALUES (?,?,?)')->execute([$user['id'],$amount,$card]); db()->prepare('UPDATE users SET balance=0 WHERE id=?')->execute([$user['id']]); notify_admins("🏧 برداشت جدید\nکاربر: <code>".h($user['first_name']??$user['username']??$user['id'])."</code>\nمبلغ: <b>".money($amount)."</b>\nاطلاعات:\n".h($card)); api_out(dashboard_payload(get_user_by_id((int)$user['id'])) + ['withdraw_amount'=>$amount]); }
if ($action === 'custom_code') { $code=normalize_ref_code((string)($input['code']??'')); $min=setting_int('custom_code_min_referrals',3); if((int)$user['referrals_count']<$min) api_out(['ok'=>false,'error'=>'NOT_ENOUGH_REFERRALS','message'=>"حداقل {$min} زیرمجموعه لازم است."],400); if(strlen($code)<4||strlen($code)>20) api_out(['ok'=>false,'error'=>'INVALID_CODE','message'=>'کد باید ۴ تا ۲۰ کاراکتر باشد.'],400); $exists=get_user_by_ref($code); if($exists && (int)$exists['id'] !== (int)$user['id']) api_out(['ok'=>false,'error'=>'CODE_TAKEN','message'=>'این کد قبلاً گرفته شده.'],400); db()->prepare('UPDATE users SET ref_code=? WHERE id=?')->execute([$code,$user['id']]); api_out(dashboard_payload(get_user_by_id((int)$user['id']))); }

if ($action === 'create_order') { $productId=(int)($input['product_id']??0); $variantId=!empty($input['variant_id'])?(int)$input['variant_id']:null; $starsCount=isset($input['stars_count'])?(int)$input['stars_count']:null; try{ $order=create_storefront_order((int)$user['id'],$productId,$variantId,$starsCount); if(!empty($input['use_wallet'])) { try { $order=apply_wallet_to_order((int)$order['id'], (int)$user['id']); } catch(Throwable $we) {} } $wallet=(int)($order['wallet_amount'] ?? 0); $sourceStr = (!empty($authToken) || !empty($input['is_web'])) ? 'وب‌سایت 🌐' : 'Mini App 📱'; $userStr = !empty($user['telegram_id']) ? "<code>{$user['telegram_id']}</code>" : "<code>#{$user['id']} (".h($user['username']??$user['email']??'وب').")</code>"; notify_admins("🧾 سفارش جدید از {$sourceStr}\nسفارش: <code>#{$order['id']}</code>\nکاربر: {$userStr}\nمحصول: <b>".h($order['product_name'].(!empty($order['variant_title'])?' - '.$order['variant_title']:''))."</b>\nمبلغ قابل پرداخت: <b>".money($order['final_amount'])."</b>".($wallet>0?"\nپرداخت از کیف پول: <b>".money($wallet)."</b>":"")); api_out(dashboard_payload(get_user_by_id((int)$user['id'])) + ['order'=>order_public_payload($order)]); } catch(Throwable $e){ api_out(['ok'=>false,'error'=>$e->getMessage(),'message'=>'محصول یا پلن پیدا نشد یا غیرفعال است.'],404); } }
if ($action === 'apply_wallet') { try{ $order=apply_wallet_to_order((int)($input['order_id']??0),(int)$user['id']); if(normalize_order_status($order['status'])==='payment_confirmed') notify_admins("💰 پرداخت کامل با کیف پول\nسفارش: <code>#{$order['id']}</code>\nکاربر: <code>".h($user['username']??$user['telegram_id']??$user['id'])."</code>\nمحصول: <b>".h($order['product_name'].(!empty($order['variant_title'])?' - '.$order['variant_title']:''))."</b>"); api_out(dashboard_payload(get_user_by_id((int)$user['id'])) + ['order'=>order_public_payload($order)]); } catch(Throwable $e){ api_out(['ok'=>false,'error'=>$e->getMessage(),'message'=>'امکان استفاده از کیف پول برای این سفارش نیست یا موجودی کافی نیست.'],400); } }
if ($action === 'select_payment_method') { try{ $order=order_set_payment_method((int)($input['order_id']??0),(int)$user['id'],(string)($input['method']??''), is_array($input['details']??null)?$input['details']:[]); api_out(dashboard_payload(get_user_by_id((int)$user['id'])) + ['order'=>order_public_payload($order)]); } catch(Throwable $e){ api_out(['ok'=>false,'error'=>$e->getMessage(),'message'=>'روش پرداخت قابل ثبت نیست یا سفارش پیدا نشد.'],400); } }
if ($action === 'start_stars_invoice') { try{ $order=order_set_payment_method((int)($input['order_id']??0),(int)$user['id'],'stars',[]); $res=send_stars_invoice_for_order($order); if(empty($res['ok'])) api_out(['ok'=>false,'error'=>'STARS_INVOICE_FAILED','message'=>'ارسال فاکتور Stars ممکن نشد. تنظیمات بات یا تلگرام را بررسی کن.'],400); api_out(dashboard_payload(get_user_by_id((int)$user['id'])) + ['order'=>order_public_payload(order_by_id((int)$order['id'])), 'stars_invoice_sent'=>true]); } catch(Throwable $e){ api_out(['ok'=>false,'error'=>$e->getMessage(),'message'=>'امکان ساخت فاکتور Stars نیست.'],400); } }
if ($action === 'select_crypto_wallet' || $action === 'start_crypto_payment') { try{ $order=start_crypto_payment((int)($input['order_id']??0),(int)$user['id'],(int)($input['wallet_id']??0)); api_out(dashboard_payload(get_user_by_id((int)$user['id'])) + ['order'=>order_public_payload($order)]); } catch(Throwable $e){ api_out(['ok'=>false,'error'=>$e->getMessage(),'message'=>'امکان انتخاب کیف پول رمزارز نیست. نرخ/ولت را در پنل ادمین بررسی کن.'],400); } }
if ($action === 'submit_crypto_hash') { try{ $order=submit_crypto_hash((int)($input['order_id']??0),(int)$user['id'],(string)($input['tx_hash']??'')); api_out(dashboard_payload(get_user_by_id((int)$user['id'])) + ['order'=>order_public_payload($order)]); } catch(Throwable $e){ api_out(['ok'=>false,'error'=>$e->getMessage(),'message'=>'ثبت TXID انجام نشد. هش را بررسی کن.'],400); } }
if ($action === 'check_crypto_payment') { try{ crypto_verify_order((int)($input['order_id']??0)); api_out(dashboard_payload(get_user_by_id((int)$user['id']))); } catch(Throwable $e){ api_out(['ok'=>false,'error'=>$e->getMessage(),'message'=>'بررسی پرداخت انجام نشد؛ کمی بعد دوباره تلاش کن.'],400); } }
if ($action === 'apply_coupon') { try{ $order=apply_coupon_to_order((int)($input['order_id']??0),(int)$user['id'],(string)($input['code']??'')); api_out(dashboard_payload(get_user_by_id((int)$user['id'])) + ['order'=>order_public_payload($order)]); } catch(Throwable $e){ api_out(['ok'=>false,'error'=>'INVALID_COUPON','message'=>'کد تخفیف معتبر نیست یا برای این سفارش قابل استفاده نیست.'],400); } }
if ($action === 'submit_receipt') { $orderId=(int)($input['order_id']??0); $note=trim((string)($input['note']??'')); if(mb_strlen($note)<3) api_out(['ok'=>false,'error'=>'EMPTY_RECEIPT','message'=>'توضیح رسید پرداخت را کامل‌تر بنویس.'],400); $fileId = null; if (!empty($input['receipt_b64'])) { $raw=(string)$input['receipt_b64']; if (strlen($raw) > 8*1024*1024) api_out(['ok'=>false,'error'=>'RECEIPT_TOO_LARGE','message'=>'حجم رسید بیشتر از حد مجاز است.'],400); if (!preg_match('#^data:image/(jpeg|jpg|png|webp);base64,#i',$raw,$mm)) api_out(['ok'=>false,'error'=>'INVALID_RECEIPT_TYPE','message'=>'فرمت رسید باید JPG، PNG یا WEBP باشد.'],400); $b64=preg_replace('#^data:image/(jpeg|jpg|png|webp);base64,#i','',$raw); $bin=base64_decode($b64,true); if ($bin && strlen($bin)>100 && strlen($bin)<=5*1024*1024) { $fi=new finfo(FILEINFO_MIME_TYPE); $mime=$fi->buffer($bin); $ext=['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp'][$mime]??null; if(!$ext) api_out(['ok'=>false,'error'=>'INVALID_RECEIPT_CONTENT','message'=>'محتوای فایل تصویر معتبر نیست.'],400); $dir=__DIR__.'/uploads/receipts/'.date('Ymd'); if(!is_dir($dir)) @mkdir($dir,0775,true); $relative='uploads/receipts/'.date('Ymd').'/r_'.bin2hex(random_bytes(12)).'.'.$ext; file_put_contents(__DIR__.'/'.$relative,$bin,LOCK_EX); $fileId=$relative; } } try{ $order=submit_order_receipt($orderId,(int)$user['id'],$note,$fileId); $sourceStr = (!empty($authToken) || !empty($input['is_web'])) ? 'وب‌سایت 🌐' : 'Mini App 📱'; $adminText = order_admin_card($order)."\n\nرسید/توضیح پرداخت از {$sourceStr}:\n".h($note); foreach (app_config('ADMIN_IDS', []) as $aid) { if ($fileId) { if (str_starts_with($fileId, 'uploads/')) { $path = __DIR__ . '/' . $fileId; if (file_exists($path)) { tg('sendPhoto', ['chat_id' => $aid, 'photo' => new CURLFile($path), 'caption' => $adminText, 'parse_mode' => 'HTML']); } else { send_msg($aid, $adminText); } } else { tg('sendPhoto', ['chat_id' => $aid, 'photo' => $fileId, 'caption' => $adminText, 'parse_mode' => 'HTML']); } } else { send_msg($aid, $adminText); } } api_out(dashboard_payload(get_user_by_id((int)$user['id'])) + ['order'=>order_public_payload($order)]); } catch(Throwable $e){ api_out(['ok'=>false,'error'=>'ORDER_NOT_FOUND','message'=>'سفارش پیدا نشد یا قابل پرداخت نیست.'],400); } }
if ($action === 'customer_order_note') { $orderId=(int)($input['order_id']??0); $note=trim((string)($input['note']??'')); if(mb_strlen($note)<2) api_out(['ok'=>false,'error'=>'EMPTY_NOTE','message'=>'یادداشت را کامل‌تر بنویس.'],400); try{ $order=update_order_customer_note($orderId,(int)$user['id'],$note); $sourceStr = (!empty($authToken) || !empty($input['is_web'])) ? 'وب‌سایت 🌐' : 'Mini App 📱'; notify_admins("📝 یادداشت مشتری از {$sourceStr} برای سفارش <code>#{$orderId}</code>\nکاربر: <code>".h($user['username']??$user['telegram_id']??$user['id'])."</code>\n\n".h($note)); api_out(dashboard_payload(get_user_by_id((int)$user['id'])) + ['order'=>order_public_payload($order)]); } catch(Throwable $e){ api_out(['ok'=>false,'error'=>'ORDER_NOT_FOUND','message'=>'سفارش پیدا نشد.'],400); } }
if ($action === 'cancel_order') { $orderId=(int)($input['order_id']??0); $order=order_by_id($orderId); if(!$order || (int)$order['user_id'] !== (int)$user['id'] || normalize_order_status($order['status']) !== 'pending_payment') api_out(['ok'=>false,'error'=>'ORDER_LOCKED','message'=>'امکان لغو این سفارش نیست.'],400); cancel_order($orderId,'لغو از وب‌سایت/Mini App'); api_out(dashboard_payload(get_user_by_id((int)$user['id']))); }
if ($action === 'hide_order') { $orderId=(int)($input['order_id']??0); if(!hide_user_order($orderId,(int)$user['id'])) api_out(['ok'=>false,'error'=>'ORDER_LOCKED','message'=>'فقط سفارش‌های لغوشده، ردشده یا مرجوع‌شده قابل حذف از لیست هستند.'],400); api_out(dashboard_payload(get_user_by_id((int)$user['id']))); }
if ($action === 'clear_canceled_orders') { $count=hide_user_cleanup_orders((int)$user['id']); api_out(dashboard_payload(get_user_by_id((int)$user['id'])) + ['cleared'=>$count]); }

// Admin Mini Panel actions
if ($action === 'admin_summary') { require_admin($user); api_out(admin_payload()); }
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
        'reply_markup' => json_encode(main_menu_keyboard(is_admin($referrer['telegram_id'])))
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
    require_admin($user); 
    $text = trim((string)($input['text'] ?? '')); 
    if ($text === '' && empty($input['media_b64'])) api_out(['ok'=>false, 'message'=>'متن پیام یا فایل الزامی است.'], 400); 
    
    $ids = db()->query('SELECT telegram_id FROM users')->fetchAll(PDO::FETCH_COLUMN); 
    
    $adminTid = $user['telegram_id'];
    $fileId = null;
    $method = 'sendMessage';
    $field = 'text';

    if (!empty($input['media_b64'])) {
        $parts = explode(',', $input['media_b64']);
        $b64 = count($parts) === 2 ? $parts[1] : $parts[0];
        $decoded = base64_decode($b64);
        if ($decoded) {
            $filename = !empty($input['filename']) ? preg_replace('/[^a-zA-Z0-9.\-_]/', '', $input['filename']) : 'file.dat';
            if (!$filename) $filename = 'media.file';
            
            $tmpPath = sys_get_temp_dir() . '/' . uniqid('bc_') . '_' . $filename;
            file_put_contents($tmpPath, $decoded);
            
            $mime = mime_content_type($tmpPath) ?: 'application/octet-stream';
            $method = 'sendDocument';
            $field = 'document';
            if (strpos($mime, 'image/') === 0 && strpos($mime, 'svg') === false && strpos($mime, 'gif') === false) {
                $method = 'sendPhoto';
                $field = 'photo';
            } elseif (strpos($mime, 'video/') === 0 || strpos($mime, 'gif') !== false) {
                $method = 'sendVideo';
                $field = 'video';
            }

            $token = app_config('BOT_TOKEN');
            $url = "https://api.telegram.org/bot{$token}/{$method}";
            
            $postFields = [
                'chat_id' => $adminTid,
                $field => new CURLFile($tmpPath, $mime, $filename),
                'parse_mode' => 'HTML'
            ];
            if ($text !== '') $postFields['caption'] = $text;

            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => $postFields
            ]);
            $res = curl_exec($ch);
            curl_close($ch);
            
            @unlink($tmpPath); // Delete immediately
            
            $resData = json_decode($res ?: '{}', true);
            if (!empty($resData['ok']) && !empty($resData['result']['message_id'])) {
                $msg = $resData['result'];
                if (isset($msg['photo'])) {
                    $fileId = end($msg['photo'])['file_id'];
                    $method = 'sendPhoto';
                    $field = 'photo';
                } elseif (isset($msg['video'])) {
                    $fileId = $msg['video']['file_id'];
                    $method = 'sendVideo';
                    $field = 'video';
                } elseif (isset($msg['document'])) {
                    $fileId = $msg['document']['file_id'];
                    $method = 'sendDocument';
                    $field = 'document';
                }
                
                // Admin already got the message + file, so remove admin from target list
                $ids = array_filter($ids, fn($id) => $id != $adminTid);
            } else {
                api_out(['ok'=>false, 'message'=>'آپلود فایل به تلگرام شکست خورد.'], 500);
            }
        } else {
            api_out(['ok'=>false, 'message'=>'فایل نامعتبر است.'], 400);
        }
    }

    $count = count($ids) + ($fileId ? 1 : 0);
    
    $response = admin_payload();
    $response['ok'] = true;
    $response['message'] = "ارسال پیام همگانی به {$count} نفر شروع شد.";
    
    ignore_user_abort(true);
    set_time_limit(0);
    
    if (function_exists('fastcgi_finish_request')) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        session_write_close();
        fastcgi_finish_request();
    } else {
        header('Content-Type: application/json; charset=utf-8');
        header('Connection: close');
        ob_start();
        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $size = ob_get_length();
        header("Content-Length: $size");
        ob_end_flush();
        @ob_flush();
        flush();
        session_write_close();
    }
    
    foreach ($ids as $tid) { 
        if ($fileId) {
            $data = ['chat_id'=>$tid, $field=>$fileId, 'parse_mode'=>'HTML'];
            if ($text !== '') $data['caption'] = $text;
            tg($method, $data);
        } else {
            tg('sendMessage', ['chat_id'=>$tid, 'text'=>$text, 'parse_mode'=>'HTML', 'disable_web_page_preview'=>true]); 
        }
        usleep(45000); 
    } 
    exit;
}
if ($action === 'get_receipt_url') { $orderId=(int)($input['order_id']??0); $order=order_by_id($orderId); if(!$order) api_out(['ok'=>false,'error'=>'ORDER_NOT_FOUND','message'=>'سفارش پیدا نشد.'],404); if (!is_admin((int)$user['telegram_id']) && (int)$order['user_id'] !== (int)$user['id']) { api_out(['ok'=>false,'error'=>'FORBIDDEN','message'=>'دسترسی ندارید.'],403); } $fid=trim((string)($order['receipt_file_id']??'')); if($fid==='') api_out(['ok'=>false,'error'=>'NO_RECEIPT_IMAGE','message'=>'این سفارش رسید عکس ندارد.'],400); if (str_starts_with($fid, 'uploads/') || str_starts_with($fid, 'http')) { $url = str_starts_with($fid, 'http') ? $fid : public_url_for_path($fid); } else { $url=telegram_file_to_public_url($fid,'receipts'); } if(!$url) api_out(['ok'=>false,'error'=>'FILE_FETCH_FAILED','message'=>'دریافت فایل رسید ناموفق بود.'],500); api_out(['ok'=>true,'url'=>$url]); }
if ($action === 'my_referrals') { $refList=user_referrals_list((int)$user['id']); api_out(['ok'=>true,'referrals'=>$refList]); }
if ($action === 'admin_customer_view') { require_admin($user); $uid=(int)($input['user_id']??0); if(!$uid) api_out(['ok'=>false,'error'=>'USER_ID_REQUIRED','message'=>'user_id الزامی است.'],400); try{ $cv=admin_customer_view($uid); api_out(['ok'=>true]+$cv); }catch(Throwable $e){ api_out(['ok'=>false,'error'=>$e->getMessage(),'message'=>'کاربر پیدا نشد.'],404); } }
if ($action === 'admin_withdraw_action') { require_admin($user); $wid=(int)($input['withdrawal_id']??0); $act=(string)($input['action_type']??$input['act']??''); try{ $list=admin_act_withdrawal($wid,$act); api_out(['ok'=>true,'withdrawals'=>$list]); }catch(Throwable $e){ api_out(['ok'=>false,'error'=>$e->getMessage(),'message'=>$e->getMessage()],400); } }
if ($action === 'admin_add_coupon') { require_admin($user); try{ $list=admin_add_coupon((string)($input['code']??''),(string)($input['type']??'percent'),(int)($input['value']??0),(int)($input['max_uses']??0),(string)($input['expires_at']??'')); api_out(['ok'=>true,'coupons'=>$list]); }catch(Throwable $e){ api_out(['ok'=>false,'error'=>$e->getMessage(),'message'=>$e->getMessage()==='CODE_TAKEN'?'این کد قبلاً استفاده شده.':'خطا در ساخت کد تخفیف.'],400); } }
if ($action === 'admin_update_coupon') { require_admin($user); $cid=(int)($input['coupon_id']??0); $fields=[]; foreach(['code','type','value','max_uses','is_active','expires_at'] as $f){ if(array_key_exists($f,$input)) $fields[$f]=$input[$f]; } try{ $list=admin_update_coupon($cid,$fields); api_out(['ok'=>true,'coupons'=>$list]); }catch(Throwable $e){ api_out(['ok'=>false,'error'=>$e->getMessage(),'message'=>'خطا در ویرایش کد تخفیف.'],400); } }
if ($action === 'admin_delete_coupon') { require_admin($user); $cid=(int)($input['coupon_id']??0); log_admin_action((int)$user['telegram_id'],'delete_coupon','coupon',$cid); try{ $list=admin_delete_coupon($cid); api_out(['ok'=>true,'coupons'=>$list]); }catch(Throwable $e){ api_out(['ok'=>false,'error'=>$e->getMessage(),'message'=>'خطا در حذف کد تخفیف.'],400); } }
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
    if(isset($input['min_withdraw'])) set_setting('min_withdraw', max(0,(int)$input['min_withdraw']));
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
    if(isset($input['resend_api_key'])) set_setting('resend_api_key', trim((string)$input['resend_api_key']));
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
        api_out(admin_payload() + ['ok'=>false, 'error'=>$e->getMessage(), 'message'=>'رفرش نرخ نوبیتکس انجام نشد؛ نرخ cache یا دستی استفاده می‌شود.'], 400);
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
if ($action === 'admin_deliver_order') { require_admin($user); $oid=(int)($input['order_id']??0); $delivery=trim((string)($input['delivery']??'')); if($delivery==='') api_out(['ok'=>false,'message'=>'متن تحویل خالی است.'],400); $order=deliver_order($oid,$delivery); if(!$order) api_out(['ok'=>false,'message'=>'سفارش پیدا نشد.'],404); send_msg($order['telegram_id'], "📦 سفارش شما تحویل داده شد.\nسفارش: <code>#{$oid}</code>\nمحصول: <b>".h($order['product_name'])."</b>\n\nاطلاعات تحویل:\n<code>".h($order['delivery_text'])."</code>", main_menu_keyboard(is_admin($order['telegram_id']))); api_out(admin_payload()); }
if ($action === 'admin_set_service_delivery') {
    require_admin($user);
    $oid=(int)($input['order_id']??0); $url=trim((string)($input['delivery_url']??''));
    $title=trim((string)($input['delivery_title']??'مدیریت سرویس')); $note=trim((string)($input['delivery_note']??''));
    if($oid<=0 || $url==='') api_out(['ok'=>false,'message'=>'شماره سفارش و لینک HTTPS سرویس الزامی است.'],400);
    try { $order=set_order_service_delivery($oid,$url,$title,$note,true); }
    catch(Throwable $e){ $code=$e->getMessage(); $msg=str_contains($code,'HTTPS')?'لینک سرویس باید با https:// شروع شود.':(str_contains($code,'HOST_BLOCKED')?'آدرس‌های localhost، شبکه خصوصی یا رزروشده برای تحویل سرویس مجاز نیستند.':'لینک سرویس معتبر نیست.'); api_out(['ok'=>false,'error'=>$code,'message'=>$msg],400); }
    if(!$order) api_out(['ok'=>false,'message'=>'سفارش پیدا نشد.'],404);
    if(!empty($order['telegram_id'])) send_msg((int)$order['telegram_id'], "✅ سرویس سفارش <code>#{$oid}</code> آماده شد.\nبرای مشاهده یا کپی لینک، وارد «سفارش‌های من» شوید.", main_menu_keyboard(is_admin((int)$order['telegram_id'])));
    api_out(admin_payload());
}
if ($action === 'admin_order_note') { require_admin($user); $oid=(int)($input['order_id']??0); $note=trim((string)($input['note']??'')); $order=order_by_id($oid); if(!$order) api_out(['ok'=>false,'message'=>'سفارش پیدا نشد.'],404); db()->prepare('UPDATE orders SET admin_note=? WHERE id=?')->execute([$note, $oid]); add_order_event($oid, 'note', 'یادداشت داخلی ثبت/ویرایش شد', $note, false); api_out(admin_payload()); }

if ($action === 'admin_add_balance') { require_admin($user); $tid=(int)($input['telegram_id']??0); $amount=(int)($input['amount']??0); if($tid<=0 || $amount===0) api_out(['ok'=>false,'message'=>'مبلغ و آیدی نامعتبر'],400); $u=get_user_by_tid($tid); if(!$u) api_out(['ok'=>false,'message'=>'کاربر پیدا نشد'],404); add_balance((int)$u['id'], $amount, 'admin_adjust', 'تغییر موجودی توسط ادمین', null); api_out(admin_payload()); }
if ($action === 'admin_ban_user') { require_admin($user); $tid=(int)($input['telegram_id']??0); if($tid<=0) api_out(['ok'=>false,'message'=>'آیدی نامعتبر'],400); db()->prepare('UPDATE users SET is_banned=1 WHERE telegram_id=?')->execute([$tid]); api_out(admin_payload()); }

if ($action === 'delete_my_account') {
    $webToken = $_SERVER['HTTP_X_WEB_TOKEN'] ?? (isset($_SERVER['HTTP_AUTHORIZATION']) ? str_replace('Bearer ', '', $_SERVER['HTTP_AUTHORIZATION']) : null);
    $initData = (string)($input['initData'] ?? '');
    $user = get_authenticated_user($initData, $webToken);
    if (!$user) {
        api_out(['ok'=>false, 'error'=>'UNAUTHORIZED', 'message'=>'نشست شما منقضی شده است.'], 401);
    }
    delete_user_account((int)$user['id']);
    api_out(['ok'=>true, 'message'=>'حساب کاربری شما و اطلاعات مرتبط با موفقیت به طور کامل حذف شد.']);
}

if ($action === 'admin_get_user') {
    $webToken = $_SERVER['HTTP_X_WEB_TOKEN'] ?? (isset($_SERVER['HTTP_AUTHORIZATION']) ? str_replace('Bearer ', '', $_SERVER['HTTP_AUTHORIZATION']) : null);
    $initData = (string)($input['initData'] ?? '');
    $authUser = get_authenticated_user($initData, $webToken);
    if (!$authUser || !is_admin((int)($authUser['telegram_id'] ?? 0))) {
        api_out(['ok'=>false, 'error'=>'ADMIN_ONLY', 'message'=>'دسترسی غیرمجاز.'], 403);
    }
    $targetUserId = (int)($input['user_id'] ?? 0);
    $targetUser = get_user_by_id($targetUserId);
    if (!$targetUser) api_out(['ok'=>false, 'error'=>'USER_NOT_FOUND', 'message'=>'کاربر یافت نشد.'], 404);
    api_out(['ok'=>true, 'user'=>$targetUser]);
}

if ($action === 'admin_edit_user') {
    $webToken = $_SERVER['HTTP_X_WEB_TOKEN'] ?? (isset($_SERVER['HTTP_AUTHORIZATION']) ? str_replace('Bearer ', '', $_SERVER['HTTP_AUTHORIZATION']) : null);
    $initData = (string)($input['initData'] ?? '');
    $authUser = get_authenticated_user($initData, $webToken);
    if (!$authUser || !is_admin((int)($authUser['telegram_id'] ?? 0))) {
        api_out(['ok'=>false, 'error'=>'ADMIN_ONLY', 'message'=>'دسترسی غیرمجاز.'], 403);
    }
    $targetUserId = (int)($input['user_id'] ?? 0);
    if ($targetUserId <= 0) {
        api_out(['ok'=>false, 'error'=>'INVALID_USER_ID', 'message'=>'شناسه کاربر معتبر نیست.'], 400);
    }
    admin_update_user_profile($targetUserId, $input);
    $updatedUser = get_user_by_id($targetUserId);
    api_out(['ok'=>true, 'user'=>$updatedUser, 'message'=>'اطلاعات کاربر با موفقیت بروزرسانی شد.']);
}

api_out(['ok'=>false, 'error'=>'UNKNOWN_ACTION'], 404);
