<?php
if (!file_exists(__DIR__ . '/../config.php')) {
    http_response_code(500);
    exit('Missing config.php. Copy config.example.php to config.php first.');
}
require_once __DIR__ . '/../config.php';

if (!empty($TIMEZONE)) date_default_timezone_set($TIMEZONE);

function app_config(string $key, $default = null) {
    return $GLOBALS[$key] ?? $default;
}

function derived_secret(string $purpose,string $explicitKey): string {
    $explicit=trim((string)app_config($explicitKey,''));if($explicit!=='')return $explicit;
    $master=trim((string)app_config('WEBHOOK_SECRET',''));if($master==='')return '';
    return hash_hmac('sha256',$purpose,$master);
}
function telegram_webhook_secret(): string { return derived_secret('telegram-webhook','TELEGRAM_WEBHOOK_SECRET'); }
function swapwallet_callback_secret(): string { return derived_secret('swapwallet-callback','SWAPWALLET_CALLBACK_SECRET'); }

function db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $host = app_config('DB_HOST', 'localhost');
        $name = app_config('DB_NAME');
        $user = app_config('DB_USER');
        $pass = app_config('DB_PASS');
        $dsn = "mysql:host={$host};dbname={$name};charset=utf8mb4";
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    }
    return $pdo;
}

function run_sql_file(string $path): void {
    if (!file_exists($path)) return;
    $sql = file_get_contents($path);
    foreach (array_filter(array_map('trim', explode(';', $sql))) as $stmt) {
        if ($stmt !== '') {
            try {
                db()->exec($stmt);
            } catch (Throwable $e) {}
        }
    }
}

function table_exists(string $table): bool {
    $dbName = app_config('DB_NAME');
    $q = db()->prepare('SELECT COUNT(*) c FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME=?');
    $q->execute([$dbName, $table]);
    return (int)$q->fetch()['c'] > 0;
}

function column_exists(string $table, string $column): bool {
    $dbName = app_config('DB_NAME');
    $q = db()->prepare('SELECT COUNT(*) c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?');
    $q->execute([$dbName, $table, $column]);
    return (int)$q->fetch()['c'] > 0;
}

function add_column_if_missing(string $table, string $column, string $definition): void {
    if (table_exists($table) && !column_exists($table, $column)) {
        db()->exec("ALTER TABLE {$table} ADD COLUMN {$column} {$definition}");
    }
}

function seed_setting(string $key, $value): void {
    $stored = is_string($value) ? $value : json_encode($value, JSON_UNESCAPED_UNICODE);
    $q = db()->prepare('INSERT IGNORE INTO settings (setting_key, setting_value) VALUES (?, ?)');
    $q->execute([$key, $stored]);
}

function migrate(): void {
    run_sql_file(__DIR__ . '/../schema.sql');

    // v3.0.2 catalog editor parity: allow an optional image on every purchasable plan.
    add_column_if_missing('service_plans', 'image_url', 'VARCHAR(1000) NULL AFTER description');

    // v2.2 security-critical tables are also ensured explicitly so an older install
    // cannot silently lose rate limiting or queued broadcasts if a prior schema step failed.
    db()->exec('CREATE TABLE IF NOT EXISTS rate_limits (
        rate_key CHAR(64) PRIMARY KEY, bucket VARCHAR(64) NOT NULL, hits INT NOT NULL DEFAULT 0,
        window_started_at DATETIME NOT NULL, blocked_until DATETIME NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX(bucket), INDEX(blocked_until)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
    db()->exec('CREATE TABLE IF NOT EXISTS broadcast_jobs (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, admin_telegram_id BIGINT NOT NULL,
        text LONGTEXT NULL, telegram_method VARCHAR(32) NOT NULL DEFAULT \'sendMessage\', media_field VARCHAR(32) NULL,
        telegram_file_id VARCHAR(512) NULL, status VARCHAR(24) NOT NULL DEFAULT \'queued\',
        total_count INT NOT NULL DEFAULT 0, sent_count INT NOT NULL DEFAULT 0, failed_count INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, started_at DATETIME NULL, finished_at DATETIME NULL,
        INDEX(status), INDEX(created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
    db()->exec('CREATE TABLE IF NOT EXISTS broadcast_job_recipients (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, job_id BIGINT UNSIGNED NOT NULL, telegram_id BIGINT NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT \'queued\', attempts INT NOT NULL DEFAULT 0, last_error VARCHAR(500) NULL, sent_at DATETIME NULL,
        UNIQUE KEY uq_broadcast_recipient (job_id,telegram_id), INDEX(job_id,status),
        CONSTRAINT fk_broadcast_recipient_job FOREIGN KEY (job_id) REFERENCES broadcast_jobs(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
    db()->exec('CREATE TABLE IF NOT EXISTS email_change_requests (
        user_id BIGINT UNSIGNED PRIMARY KEY, old_email VARCHAR(255) NULL, pending_email VARCHAR(255) NULL,
        old_otp_hash VARCHAR(255) NULL, old_otp_expires_at DATETIME NULL, old_verified_at DATETIME NULL,
        new_otp_hash VARCHAR(255) NULL, new_otp_expires_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX(old_otp_expires_at), INDEX(new_otp_expires_at),
        CONSTRAINT fk_email_change_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');


    db()->exec('CREATE TABLE IF NOT EXISTS user_wishlists (
        user_id BIGINT UNSIGNED NOT NULL, product_id BIGINT UNSIGNED NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id,product_id), INDEX(product_id),
        CONSTRAINT fk_wishlist_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_wishlist_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
    db()->exec('CREATE TABLE IF NOT EXISTS user_notifications (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL, type VARCHAR(32) NOT NULL DEFAULT \'info\',
        title VARCHAR(255) NOT NULL, body VARCHAR(1000) NULL, order_id BIGINT UNSIGNED NULL, is_read TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX(user_id,is_read), INDEX(created_at),
        CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_notification_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');

    db()->exec('CREATE TABLE IF NOT EXISTS credit_topups (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL, amount BIGINT NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT \'pending_payment\', payment_method VARCHAR(32) NULL, payment_details LONGTEXT NULL,
        receipt_file_id VARCHAR(255) NULL, crypto_wallet_id BIGINT UNSIGNED NULL, crypto_amount DECIMAL(24,8) NULL,
        crypto_asset VARCHAR(32) NULL, crypto_network VARCHAR(32) NULL, tx_hash VARCHAR(255) NULL,
        stars_amount INT NOT NULL DEFAULT 0, stars_charge_id VARCHAR(255) NULL, stars_provider_charge_id VARCHAR(255) NULL,
        admin_note TEXT NULL, credited_at DATETIME NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX(user_id), INDEX(status), INDEX(payment_method), INDEX(created_at),
        UNIQUE KEY uq_credit_topups_stars_charge (stars_charge_id), UNIQUE KEY uq_credit_topups_tx_hash (tx_hash),
        CONSTRAINT fk_credit_topup_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');

    // Safe upgrade path from older BlueGate ReferralWallet versions.
    add_column_if_missing('users', 'last_name', 'VARCHAR(255) NULL AFTER first_name');
    add_column_if_missing('users', 'ref_rewarded', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER referrer_id');
    add_column_if_missing('users', 'spin_balance', 'INT NOT NULL DEFAULT 0 AFTER referrals_count');
    add_column_if_missing('users', 'step_payload', 'TEXT NULL AFTER step');
    add_column_if_missing('users', 'theme_color', 'VARCHAR(16) NULL AFTER step_payload');
    add_column_if_missing('users', 'phone_number', 'VARCHAR(64) NULL AFTER theme_color');
    add_column_if_missing('users', 'phone_verified_at', 'DATETIME NULL AFTER phone_number');
    add_column_if_missing('users', 'is_banned', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER phone_verified_at');
    add_column_if_missing('users', 'deleted_at', 'DATETIME NULL AFTER is_banned');
    add_column_if_missing('users', 'start_notified', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER deleted_at');
    add_column_if_missing('users', 'password_hash', 'VARCHAR(255) NULL AFTER start_notified');
    add_column_if_missing('users', 'auth_token', 'VARCHAR(128) NULL AFTER password_hash');
    add_column_if_missing('users', 'auth_token_hash', 'CHAR(64) NULL AFTER auth_token');
    add_column_if_missing('users', 'auth_token_expires_at', 'DATETIME NULL AFTER auth_token_hash');
    add_column_if_missing('users', 'web_username', 'VARCHAR(128) NULL AFTER auth_token_expires_at');
    add_column_if_missing('users', 'email', 'VARCHAR(255) NULL AFTER web_username');
    add_column_if_missing('users', 'email_verified_at', 'DATETIME NULL AFTER email');
    add_column_if_missing('users', 'email_verification_token', 'VARCHAR(64) NULL AFTER email_verified_at');
    add_column_if_missing('users', 'email_verification_expires_at', 'DATETIME NULL AFTER email_verification_token');
    try { db()->exec('CREATE INDEX idx_users_auth_token_hash ON users(auth_token_hash)'); } catch (Throwable $e) {}
    try { db()->exec('CREATE INDEX idx_users_auth_token_expires ON users(auth_token_expires_at)'); } catch (Throwable $e) {}
    try { db()->exec('CREATE INDEX idx_users_is_banned ON users(is_banned)'); } catch (Throwable $e) {}
    try { db()->exec('ALTER TABLE users MODIFY COLUMN telegram_id BIGINT NULL'); } catch (Throwable $e) {}
    try { db()->exec('ALTER TABLE transactions MODIFY COLUMN type VARCHAR(64) NOT NULL'); } catch (Throwable $e) {}
    try { db()->exec("UPDATE users u SET ref_rewarded=1 WHERE referrer_id IS NOT NULL AND EXISTS (SELECT 1 FROM transactions t WHERE t.type='ref_start' AND t.related_user_id=u.id)"); } catch (Throwable $e) {}
    try { db()->exec('INSERT IGNORE INTO referrals (referrer_id, referred_id, reward_amount, created_at) SELECT referrer_id, id, 0, created_at FROM users WHERE referrer_id IS NOT NULL'); } catch (Throwable $e) {}

    seed_setting('start_reward', app_config('START_REWARD', 2000));
    seed_setting('purchase_reward', app_config('PURCHASE_REWARD', 10000));
    seed_setting('mission_1_target', app_config('MISSION_1_TARGET', 1));
    seed_setting('mission_1_reward', app_config('MISSION_1_REWARD', 3000));
    seed_setting('mission_2_target', app_config('MISSION_2_TARGET', 3));
    seed_setting('mission_2_reward', app_config('MISSION_2_REWARD', 10000));
    seed_setting('mission_3_target', app_config('MISSION_3_TARGET', 5));
    seed_setting('mission_3_reward', app_config('MISSION_3_REWARD', 25000));
    seed_setting('spin_referrals_per_chance', app_config('SPIN_REFERRALS_PER_CHANCE', 5));
    seed_setting('spin_rewards', app_config('SPIN_REWARDS', []));
    seed_setting('custom_code_min_referrals', app_config('CUSTOM_CODE_MIN_REFERRALS', 3));
    seed_setting('theme_color', app_config('DEFAULT_THEME_COLOR', '#1d9bf0'));
    seed_setting('button_colors_enabled', '1');
    seed_setting('button_colors', ['primary'=>'#1d9bf0','secondary'=>'#2563eb','danger'=>'#ef4444','success'=>'#22c55e','warning'=>'#f59e0b']);
    seed_setting('require_contact_auth', '0');
    seed_setting('notify_new_user', '1');
    seed_setting('brand_name', app_config('BRAND_NAME', 'BlueGate'));
    seed_setting('resend_api_key', app_config('RESEND_API_KEY', ''));
    seed_setting('resend_from_email', app_config('RESEND_FROM_EMAIL', 'onboarding@resend.dev'));
    seed_setting('require_email_verification', '1');
    seed_setting('auth_token_ttl_hours', app_config('AUTH_TOKEN_TTL_HOURS', 168));
    seed_setting('payment_instructions', app_config('PAYMENT_INSTRUCTIONS', 'لطفاً یکی از روش‌های پرداخت فعال را انتخاب کن. پرداخت کارت‌به‌کارت با ارسال رسید بررسی می‌شود.'));
    seed_setting('payment_methods_enabled', ['wallet'=>true,'card'=>true,'stars'=>false,'crypto'=>false]);
    seed_setting('card_accounts', app_config('CARD_ACCOUNTS', []));
    seed_setting('stars_rate_toman', app_config('STARS_RATE_TOMAN', 3200));
    seed_setting('crypto_rate_source', app_config('CRYPTO_RATE_SOURCE', 'auto')); // auto = Wallex -> Ramzinex -> Nobitex -> manual/cache
    seed_setting('crypto_manual_rates', app_config('CRYPTO_MANUAL_RATES', ['USDT'=>0,'TRX'=>0,'TON'=>0]));
    seed_setting('crypto_rate_markup_percent', app_config('CRYPTO_RATE_MARKUP_PERCENT', 1));
    seed_setting('crypto_notify_rate_fail', '1');
    seed_setting('crypto_rate_refresh_interval_seconds', app_config('CRYPTO_RATE_REFRESH_INTERVAL_SECONDS', 600));
    seed_setting('crypto_rate_provider_priority', app_config('CRYPTO_RATE_PROVIDER_PRIORITY', 'wallex,ramzinex,nobitex'));
    seed_setting('crypto_rate_last_result', []);
    seed_setting('swapwallet_api_key', app_config('SWAPPAY_API_KEY', ''));
    seed_setting('swapwallet_application', app_config('SWAPPAY_APPLICATION', ''));
    seed_setting('swapwallet_username', app_config('SWAPPAY_USERNAME', app_config('SWAPPAY_APPLICATION', '')));
    seed_setting('swapwallet_base_url', app_config('SWAPPAY_BASE_URL', 'https://swapwallet.app/api'));
    seed_setting('swapwallet_auto_token', app_config('SWAPPAY_AUTO_CONVERSION_TOKEN', 'USDT'));
    seed_setting('swapwallet_usdt_rate_toman', app_config('SWAPPAY_USDT_RATE_TOMAN', 0));
    if (!setting('security_token_hash_migrated_v220', '')) {
        try { db()->exec('UPDATE users SET auth_token=NULL, auth_token_hash=NULL, auth_token_expires_at=NULL'); } catch (Throwable $e) {}
        set_setting('security_token_hash_migrated_v220', date('Y-m-d H:i:s'));
    }
    seed_setting('swapwallet_rate_markup_percent', app_config('SWAPPAY_RATE_MARKUP_PERCENT', 1));
    seed_setting('swapwallet_ttl_minutes', app_config('SWAPPAY_TTL_MINUTES', 30));
    seed_setting('swapwallet_notify_fail', '1');
    seed_setting('swapwallet_api_version', 'v2_temporary_wallet');
    seed_setting('swapwallet_strict_v2', '1');
    seed_setting('order_expiry_minutes', '20');
    seed_payment_methods();
    seed_setting('delivery_template_account', "📩 اطلاعات اکانت شما\n\n{delivery}\n\n⚠️ لطفاً رمز را تغییر ندهید مگر ادمین گفته باشد.");
    seed_setting('delivery_template_vpn', "🔐 سرویس VPN شما آماده شد\n\n{delivery}\n\nاگر نیاز به راهنما داشتی، به پشتیبانی پیام بده.");
    seed_setting('delivery_template_code', "🎟 کد/لایسنس شما آماده شد\n\n{delivery}");
    seed_setting('delivery_template_manual', "📦 سفارش شما آماده شد\n\n{delivery}");
    seed_setting('storefront_brand_subtitle', 'Digital Services');
    seed_setting('storefront_hero_title', 'سرویس‌های دیجیتال، ساده و سریع');
    seed_setting('storefront_hero_text', 'VPN، تلگرام استارز و تلگرام پرمیوم با قیمت شفاف و سفارش مستقیم.');
    seed_setting('storefront_announcement_enabled', '1');
    seed_setting('storefront_announcement_text', 'سرویس موردنظرت رو انتخاب کن؛ سفارش داخل حساب BlueGate ثبت و پیگیری می‌شود.');
    seed_setting('storefront_footer_text', 'سرویس‌های دیجیتال با پشتیبانی واقعی.');
    seed_setting('storefront_stars_price_basis', 'toman');
    seed_setting('storefront_star_sell_per_unit_usdt', '0.018');
    seed_setting('storefront_star_sell_per_unit_toman', '3456');
    seed_setting('storefront_stars_min', '50');
    seed_setting('storefront_stars_max', '10000');
    seed_setting('storefront_stars_step', '25');
    seed_setting('storefront_stars_presets', [100,500,1000,2500,5000]);
    seed_setting('storefront_smart_rounding_enabled', '1');
    seed_setting('storefront_round_small', '5000');
    seed_setting('storefront_round_medium', '10000');
    seed_setting('storefront_round_large', '20000');
    seed_setting('storefront_fallback_usdt_toman', '192000');
    seed_setting('storefront_show_reviews', '1');
    seed_setting('storefront_show_tutorials', '0');
    seed_setting('storefront_show_comparison', '1');
    seed_setting('catalog_v2_storefront_enabled', '0');
    seed_setting('catalog_v2_applied_at', '');
    seed_setting('credit_topup_enabled', '1');
    seed_setting('credit_topup_min', '50000');
    seed_setting('credit_topup_max', '5000000');
    seed_setting('credit_topup_presets', [100000,200000,500000]);
    seed_setting('credit_topup_methods', ['card'=>true,'stars'=>true,'crypto'=>true]);

    // Safe Commerce Plus upgrade columns. These commands are idempotent and keep older installs intact.
    add_column_if_missing('product_categories', 'image_url', 'VARCHAR(1024) NULL AFTER emoji');
    add_column_if_missing('products', 'parent_id', 'BIGINT UNSIGNED NULL AFTER category_id');
    add_column_if_missing('products', 'slug', 'VARCHAR(128) NULL AFTER parent_id');
    try { db()->exec('CREATE INDEX idx_products_parent ON products(parent_id)'); } catch (Throwable $e) {}
    add_column_if_missing('products', 'product_type', "VARCHAR(32) NOT NULL DEFAULT 'normal' AFTER slug");
    add_column_if_missing('products', 'config_json', 'LONGTEXT NULL AFTER product_type');
    try { db()->exec('CREATE UNIQUE INDEX uq_products_slug ON products(slug)'); } catch (Throwable $e) {}
    add_column_if_missing('products', 'image_url', 'VARCHAR(1024) NULL AFTER full_description');
    add_column_if_missing('products', 'image_srcset', 'VARCHAR(2048) NULL AFTER image_url');
    add_column_if_missing('products', 'price_currency', "VARCHAR(8) NOT NULL DEFAULT 'IRT' AFTER price");
    add_column_if_missing('products', 'price_usd', 'DECIMAL(14,4) NULL AFTER price_currency');
    add_column_if_missing('products', 'price_rate_toman', 'DECIMAL(24,6) NULL AFTER price_usd');
    add_column_if_missing('products', 'price_rate_source', 'VARCHAR(32) NULL AFTER price_rate_toman');
    add_column_if_missing('products', 'price_rate_updated_at', 'DATETIME NULL AFTER price_rate_source');
    add_column_if_missing('product_variants', 'price_currency', "VARCHAR(8) NOT NULL DEFAULT 'IRT' AFTER price");
    add_column_if_missing('product_variants', 'price_usd', 'DECIMAL(14,4) NULL AFTER price_currency');
    add_column_if_missing('product_variants', 'price_rate_toman', 'DECIMAL(24,6) NULL AFTER price_usd');
    add_column_if_missing('product_variants', 'price_rate_source', 'VARCHAR(32) NULL AFTER price_rate_toman');
    add_column_if_missing('product_variants', 'price_rate_updated_at', 'DATETIME NULL AFTER price_rate_source');
    add_column_if_missing('product_variants', 'discount_percent', 'DECIMAL(5,2) NOT NULL DEFAULT 0.00 AFTER duration_days');
    add_column_if_missing('product_variants', 'description', 'TEXT NULL AFTER discount_percent');
    try { db()->exec("ALTER TABLE product_variants MODIFY COLUMN discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00"); } catch (Throwable $e) {}
    add_column_if_missing('products', 'is_featured', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active');
    add_column_if_missing('products', 'sort_order', 'INT NOT NULL DEFAULT 0 AFTER is_featured');
    add_column_if_missing('service_groups', 'is_archived', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active');
    add_column_if_missing('service_plans', 'is_archived', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active');
    add_column_if_missing('orders', 'variant_id', 'BIGINT UNSIGNED NULL AFTER product_id');
    add_column_if_missing('orders', 'catalog_service_id', 'BIGINT UNSIGNED NULL AFTER product_id');
    add_column_if_missing('orders', 'catalog_group_id', 'BIGINT UNSIGNED NULL AFTER catalog_service_id');
    add_column_if_missing('orders', 'catalog_plan_id', 'BIGINT UNSIGNED NULL AFTER catalog_group_id');
    add_column_if_missing('orders', 'service_name_snapshot', 'VARCHAR(255) NULL AFTER catalog_plan_id');
    add_column_if_missing('orders', 'group_name_snapshot', 'VARCHAR(255) NULL AFTER service_name_snapshot');
    add_column_if_missing('orders', 'plan_name_snapshot', 'VARCHAR(255) NULL AFTER group_name_snapshot');
    add_column_if_missing('orders', 'price_currency', "VARCHAR(8) NOT NULL DEFAULT 'IRT' AFTER final_amount");
    add_column_if_missing('orders', 'price_usd', 'DECIMAL(14,4) NULL AFTER price_currency');
    add_column_if_missing('orders', 'usd_rate_toman', 'DECIMAL(24,6) NULL AFTER price_usd');
    add_column_if_missing('orders', 'usd_rate_source', 'VARCHAR(32) NULL AFTER usd_rate_toman');
    add_column_if_missing('orders', 'usd_rate_updated_at', 'DATETIME NULL AFTER usd_rate_source');
    add_column_if_missing('orders', 'delivery_url', 'TEXT NULL AFTER delivery_text');
    add_column_if_missing('orders', 'delivery_title', 'VARCHAR(120) NULL AFTER delivery_url');
    add_column_if_missing('orders', 'expires_at', 'DATETIME NULL AFTER delivery_title');
    add_column_if_missing('orders', 'payment_expires_at', 'DATETIME NULL AFTER expires_at');
    add_column_if_missing('orders', 'renewal_of_order_id', 'BIGINT UNSIGNED NULL AFTER payment_expires_at');
    add_column_if_missing('orders', 'is_renewal', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER renewal_of_order_id');
    add_column_if_missing('orders', 'delivered_inventory_id', 'BIGINT UNSIGNED NULL AFTER delivery_text');
    add_column_if_missing('orders', 'customer_note', 'TEXT NULL AFTER payment_note');
    add_column_if_missing('orders', 'review_started_at', 'DATETIME NULL AFTER receipt_file_id');
    add_column_if_missing('orders', 'paid_at', 'DATETIME NULL AFTER review_started_at');
    add_column_if_missing('orders', 'prepared_at', 'DATETIME NULL AFTER paid_at');
    add_column_if_missing('orders', 'delivered_at', 'DATETIME NULL AFTER prepared_at');
    add_column_if_missing('orders', 'rejected_at', 'DATETIME NULL AFTER delivered_at');
    add_column_if_missing('orders', 'canceled_at', 'DATETIME NULL AFTER rejected_at');
    add_column_if_missing('orders', 'user_hidden', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER admin_note');
    add_column_if_missing('orders', 'archived_at', 'DATETIME NULL AFTER user_hidden');
    add_column_if_missing('orders', 'wallet_amount', 'BIGINT NOT NULL DEFAULT 0 AFTER discount_amount');
    add_column_if_missing('orders', 'payment_method', 'VARCHAR(32) NULL AFTER final_amount');
    add_column_if_missing('orders', 'payment_details', 'TEXT NULL AFTER payment_method');
    add_column_if_missing('orders', 'stars_amount', 'INT NOT NULL DEFAULT 0 AFTER payment_details');
    add_column_if_missing('orders', 'stars_charge_id', 'VARCHAR(255) NULL AFTER stars_amount');
    add_column_if_missing('orders', 'stars_provider_charge_id', 'VARCHAR(255) NULL AFTER stars_charge_id');
    try { db()->exec('ALTER TABLE orders ADD UNIQUE KEY uq_orders_stars_charge (stars_charge_id)'); } catch (Throwable $e) {}
    add_column_if_missing('orders', 'crypto_amount', 'DECIMAL(24,8) NULL AFTER stars_amount');
    add_column_if_missing('orders', 'crypto_asset', 'VARCHAR(32) NULL AFTER crypto_amount');
    add_column_if_missing('orders', 'crypto_network', 'VARCHAR(32) NULL AFTER crypto_asset');
    add_column_if_missing('crypto_payment_checks', 'rate_source', 'VARCHAR(32) NULL AFTER rate_updated_at');
    add_column_if_missing('swapwallet_invoices', 'request_url', 'TEXT NULL AFTER payment_links_json');
    add_column_if_missing('swapwallet_invoices', 'request_body', 'LONGTEXT NULL AFTER request_url');
    add_column_if_missing('swapwallet_invoices', 'api_version', 'VARCHAR(64) NULL AFTER request_body');
    add_column_if_missing('swapwallet_invoices', 'callback_raw', 'LONGTEXT NULL AFTER raw_response');
    add_column_if_missing('coupons', 'min_order_amount', 'BIGINT NOT NULL DEFAULT 0 AFTER value');
    add_column_if_missing('coupons', 'max_uses_per_user', 'INT NOT NULL DEFAULT 1 AFTER max_uses');
    add_column_if_missing('coupons', 'category_id', 'BIGINT UNSIGNED NULL AFTER max_uses_per_user');
    seed_setting('vip_tier_rates', [
        'bronze'  => ['name'=>'Bronze',  'fa'=>'برنز',    'emoji'=>'🥉', 'min_ref'=>0,   'multiplier'=>1.00],
        'silver'  => ['name'=>'Silver',  'fa'=>'سیلور',  'emoji'=>'🥈', 'min_ref'=>10,  'multiplier'=>1.10],
        'gold'    => ['name'=>'Gold',    'fa'=>'گلد',    'emoji'=>'🥇', 'min_ref'=>50,  'multiplier'=>1.25],
        'diamond' => ['name'=>'Diamond', 'fa'=>'دایموند', 'emoji'=>'💎', 'min_ref'=>100, 'multiplier'=>1.50],
    ]);

    // Batch 3 — flash sale, activity log, admin roles
    add_column_if_missing('products', 'flash_sale_start', 'DATETIME NULL AFTER is_featured');
    add_column_if_missing('products', 'flash_sale_end', 'DATETIME NULL AFTER flash_sale_start');
    add_column_if_missing('products', 'flash_sale_discount', 'INT NOT NULL DEFAULT 0 AFTER flash_sale_end');
    if (!table_exists('admin_activity_log')) {
        db()->exec('CREATE TABLE IF NOT EXISTS admin_activity_log (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            admin_telegram_id BIGINT NOT NULL,
            action VARCHAR(128) NOT NULL,
            entity_type VARCHAR(64) NULL,
            entity_id BIGINT NULL,
            details TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX(admin_telegram_id),
            INDEX(created_at),
            INDEX(entity_type)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
    }
    if (!table_exists('admin_roles')) {
        db()->exec('CREATE TABLE IF NOT EXISTS admin_roles (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            telegram_id BIGINT NOT NULL UNIQUE,
            role VARCHAR(32) NOT NULL DEFAULT \'full\',
            display_name VARCHAR(128) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX(telegram_id),
            INDEX(role)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
    }

    seed_shop_categories();

    seed_bluegate_storefront_catalog();
}

function setting(string $key, $default = null) {
    $q = db()->prepare('SELECT setting_value FROM settings WHERE setting_key=?');
    $q->execute([$key]);
    $row = $q->fetch();
    return $row ? $row['setting_value'] : $default;
}
function setting_int(string $key, int $default = 0): int { return (int)setting($key, $default); }
function setting_json(string $key, array $default = []): array {
    $value = setting($key, null);
    if ($value === null || $value === '') return $default;
    $decoded = json_decode($value, true);
    return is_array($decoded) ? $decoded : $default;
}
function set_setting(string $key, $value): void {
    $stored = is_string($value) ? $value : json_encode($value, JSON_UNESCAPED_UNICODE);
    $q = db()->prepare('INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)');
    $q->execute([$key, $stored]);
}


function seed_payment_methods(): void {
    if (!table_exists('payment_methods')) return;
    $defaults = [
        ['wallet','اعتبار BlueGate','wallet',1, ['description'=>'پرداخت از اعتبار حساب BlueGate'], 1],
        ['card','کارت به کارت','card',1, ['description'=>'پرداخت دستی با ارسال رسید'], 2],
        ['stars','Telegram Stars','stars',0, ['description'=>'پرداخت مستقیم با استار تلگرام'], 3],
        ['crypto','پرداخت رمزارز','crypto',0, ['description'=>'پرداخت با کیف پول دستی و بررسی TXID'], 4],
    ];
    $q = db()->prepare('INSERT IGNORE INTO payment_methods (method_key,title,method_type,is_active,settings_json,sort_order) VALUES (?,?,?,?,?,?)');
    foreach ($defaults as $m) $q->execute([$m[0],$m[1],$m[2],$m[3],json_encode($m[4], JSON_UNESCAPED_UNICODE),$m[5]]);
}
function payment_enabled(string $method): bool {
    $enabled = setting_json('payment_methods_enabled', ['wallet'=>true,'card'=>true,'stars'=>false,'crypto'=>false]);
    if (array_key_exists($method, $enabled)) return (bool)$enabled[$method];
    try {
        if (table_exists('payment_methods')) {
            $q=db()->prepare('SELECT is_active FROM payment_methods WHERE method_key=?');
            $q->execute([$method]); $row=$q->fetch();
            if ($row) return (int)$row['is_active']===1;
        }
    } catch (Throwable $e) {}
    return false;
}
function parse_card_accounts($raw=null): array {
    if ($raw === null) $raw = setting('card_accounts', '');
    if (is_array($raw)) $arr = $raw; else {
        $decoded = json_decode((string)$raw, true);
        if (is_array($decoded)) $arr = $decoded; else {
            $arr=[];
            foreach (preg_split('/\R/u', (string)$raw) as $line) {
                $line=trim($line); if ($line==='') continue;
                $p=array_map('trim', explode('|', $line));
                $arr[]=['title'=>$p[0]??'کارت','card'=>$p[1]??'','owner'=>$p[2]??'','sheba'=>$p[3]??''];
            }
        }
    }
    $out=[]; $i=1;
    foreach ($arr as $c) {
        if (!is_array($c)) continue;
        $card=trim((string)($c['card'] ?? ''));
        $owner=trim((string)($c['owner'] ?? ''));
        $title=trim((string)($c['title'] ?? ('کارت '.$i)));
        $sheba=trim((string)($c['sheba'] ?? ''));
        if ($card==='' && $owner==='' && $sheba==='') continue;
        $out[]=['id'=>$i,'title'=>$title ?: ('کارت '.$i),'card'=>$card,'owner'=>$owner,'sheba'=>$sheba]; $i++;
    }
    return $out;
}
function card_accounts_lines(): string {
    $lines=[];
    foreach (parse_card_accounts() as $c) $lines[] = ($c['title'] ?? 'کارت').'|'.($c['card'] ?? '').'|'.($c['owner'] ?? '').'|'.($c['sheba'] ?? '');
    return implode("\n", $lines);
}
function payment_methods_public(?array $user=null): array {
    $cards=parse_card_accounts();
    $rate=max(1, setting_int('stars_rate_toman', 3200));
    return [
        'wallet'=>['enabled'=>payment_enabled('wallet'), 'title'=>'اعتبار BlueGate', 'balance'=>$user?(int)($user['balance']??0):0],
        'card'=>['enabled'=>payment_enabled('card'), 'title'=>'کارت به کارت', 'accounts'=>$cards, 'instructions'=>setting('payment_instructions','')],
        'stars'=>['enabled'=>payment_enabled('stars'), 'title'=>'Telegram Stars', 'rate_toman'=>$rate],
        'crypto'=>['enabled'=>payment_enabled('crypto'), 'title'=>'رمزارز', 'gateway'=>'manual_txid', 'wallets'=>crypto_wallets_public(null), 'rate_source'=>setting('crypto_rate_source','auto'), 'markup_percent'=>(float)setting('crypto_rate_markup_percent','1'), 'rate_cache'=>crypto_rate_cache()],
    ];
}


function crypto_manual_rates(): array {
    $raw = setting('crypto_manual_rates', '');
    $out = [];
    $decoded = json_decode((string)$raw, true);
    if (is_array($decoded)) {
        foreach ($decoded as $asset=>$rate) $out[strtoupper((string)$asset)] = (float)$rate;
        return $out;
    }
    foreach (preg_split('/\R/u', (string)$raw) as $line) {
        $line = trim($line); if ($line === '') continue;
        $p = array_map('trim', explode('|', $line));
        if (!empty($p[0])) $out[strtoupper($p[0])] = (float)($p[1] ?? 0);
    }
    return $out;
}
function crypto_manual_rates_lines(): string {
    $rates = crypto_manual_rates();
    if (!$rates) $rates = ['USDT'=>0,'TRX'=>0,'TON'=>0];
    $lines=[]; foreach($rates as $asset=>$rate) $lines[] = strtoupper($asset).'|'.$rate;
    return implode("\n", $lines);
}
function set_crypto_manual_rates_lines(string $text): void {
    $out=[];
    foreach (preg_split('/\R/u', $text) as $line) {
        $line=trim($line); if($line==='') continue;
        $p=array_map('trim', explode('|', $line));
        if(!empty($p[0])) $out[strtoupper($p[0])] = max(0, (float)($p[1] ?? 0));
    }
    set_setting('crypto_manual_rates', $out);
}
function crypto_wallets(bool $activeOnly=true): array {
    if (!table_exists('crypto_wallets')) return [];
    $sql='SELECT * FROM crypto_wallets'.($activeOnly?' WHERE is_active=1':'').' ORDER BY sort_order ASC, id ASC';
    return db()->query($sql)->fetchAll();
}
function crypto_wallet_by_id(int $id): ?array {
    if (!table_exists('crypto_wallets')) return null;
    $q=db()->prepare('SELECT * FROM crypto_wallets WHERE id=?'); $q->execute([$id]);
    $w=$q->fetch(); return $w ?: null;
}
function crypto_wallets_lines(): string {
    $lines=[];
    foreach (crypto_wallets(false) as $w) {
        $lines[] = ($w['title'] ?: ($w['asset'].' '.$w['network'])).'|'.$w['network'].'|'.$w['asset'].'|'.$w['address'].'|'.($w['rate_symbol'] ?: $w['asset']).'|'.(int)$w['is_active'].'|'.(int)$w['sort_order'];
    }
    return implode("\n", $lines);
}
function set_crypto_wallets_lines(string $text): void {
    if (!table_exists('crypto_wallets')) return;
    $rows=[];
    foreach (preg_split('/\R/u', $text) as $line) {
        $line=trim($line); if ($line==='') continue;
        $p=array_map('trim', explode('|', $line));
        $title=trim((string)($p[0] ?? 'Crypto')) ?: 'Crypto';
        $network=strtoupper(trim((string)($p[1] ?? 'TRC20')) ?: 'TRC20');
        $asset=strtoupper(trim((string)($p[2] ?? 'USDT')) ?: 'USDT');
        $address=trim((string)($p[3] ?? ''));
        if ($address==='') continue;
        $rate=strtoupper(trim((string)($p[4] ?? $asset)) ?: $asset);
        $active = !isset($p[5]) || !in_array(strtolower((string)$p[5]), ['0','false','off','no'], true);
        $sort=(int)($p[6] ?? 99);
        $rows[] = [$title,$network,$asset,$address,$rate,$active?1:0,$sort];
    }
    // Safety: an empty value can happen if a broken/old admin UI submits before builders are initialized.
    // Do not wipe all wallet rows silently; admins can disable wallets one-by-one from the UI.
    if (!$rows) return;
    db()->beginTransaction();
    try {
        db()->exec('UPDATE crypto_wallets SET is_active=0');
        $find=db()->prepare('SELECT id FROM crypto_wallets WHERE UPPER(network)=? AND UPPER(asset)=? AND address=? LIMIT 1');
        $upd=db()->prepare('UPDATE crypto_wallets SET title=?, rate_symbol=?, is_active=?, sort_order=? WHERE id=?');
        $ins=db()->prepare('INSERT INTO crypto_wallets (title,network,asset,address,rate_symbol,is_active,sort_order) VALUES (?,?,?,?,?,?,?)');
        foreach ($rows as [$title,$network,$asset,$address,$rate,$active,$sort]) {
            $find->execute([$network,$asset,$address]);
            $row=$find->fetch();
            if ($row) $upd->execute([$title,$rate,$active,$sort,(int)$row['id']]);
            else $ins->execute([$title,$network,$asset,$address,$rate,$active,$sort]);
        }
        db()->commit();
    } catch (Throwable $e) {
        if (db()->inTransaction()) db()->rollBack();
        throw $e;
    }
}
function crypto_rate_meta(string $asset): array {
    $asset = strtoupper($asset ?: 'USDT');
    $cache = crypto_rate_cache();
    $manual = crypto_manual_rates();
    $row = $cache[$asset] ?? null;
    if (is_array($row) && (float)($row['rate'] ?? 0) > 0) {
        return [
            'asset'=>$asset,
            'rate'=>(float)$row['rate'],
            'source'=>(string)($row['source'] ?? 'provider_cache'),
            'updated_at'=>$row['updated_at'] ?? null,
            'is_live'=>in_array((string)($row['source'] ?? ''), ['wallex','ramzinex','nobitex'], true),
        ];
    }
    if (isset($cache[$asset]) && is_numeric($cache[$asset]) && (float)$cache[$asset] > 0) {
        return ['asset'=>$asset,'rate'=>(float)$cache[$asset],'source'=>'cache','updated_at'=>null,'is_live'=>false];
    }
    return ['asset'=>$asset,'rate'=>(float)($manual[$asset] ?? 0),'source'=>'manual','updated_at'=>null,'is_live'=>false];
}
function crypto_wallet_payload(array $w, ?int $tomanAmount=null): array {
    $symbol = strtoupper((string)($w['rate_symbol'] ?: $w['asset']));
    $meta = crypto_rate_meta($symbol);
    $rate = (float)$meta['rate'];
    $amount = null;
    if ($tomanAmount !== null && $rate > 0) {
        $markup = max(0, (float)setting('crypto_rate_markup_percent', '1')) / 100;
        $amount = round(($tomanAmount / $rate) * (1 + $markup), 6);
    }
    return [
        'id'=>(int)$w['id'], 'title'=>$w['title'], 'network'=>strtoupper($w['network']), 'asset'=>strtoupper($w['asset']), 'address'=>$w['address'],
        'rate_symbol'=>$symbol, 'is_active'=>(int)$w['is_active'], 'sort_order'=>(int)$w['sort_order'],
        'rate_toman'=>$rate, 'rate_source'=>$meta['source'], 'rate_updated_at'=>$meta['updated_at'], 'estimated_amount'=>$amount,
    ];
}
function crypto_wallets_public(?int $tomanAmount=null): array {
    return array_map(fn($w)=>crypto_wallet_payload($w, $tomanAmount), crypto_wallets(true));
}
function http_json_get(string $url, array $headers=[]): array {
    return crypto_http_json_request('GET', $url, null, $headers);
}
function http_json_post(string $url, array $payload=[], array $headers=[]): array {
    $headers[] = 'Content-Type: application/json';
    return crypto_http_json_request('POST', $url, json_encode($payload, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES), $headers);
}
function crypto_http_json_request(string $method, string $url, ?string $body=null, array $headers=[]): array {
    $ch=curl_init($url);
    curl_setopt_array($ch,[
        CURLOPT_RETURNTRANSFER=>true,
        CURLOPT_CONNECTTIMEOUT=>4,
        CURLOPT_TIMEOUT=>10,
        CURLOPT_FOLLOWLOCATION=>true,
        CURLOPT_SSL_VERIFYPEER=>true,
        CURLOPT_SSL_VERIFYHOST=>2,
        CURLOPT_USERAGENT=>'BlueReferral/1.0 RateFetcher',
        CURLOPT_IPRESOLVE=>CURL_IPRESOLVE_V4,
    ]);
    if (strtoupper($method) !== 'GET') {
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, strtoupper($method));
        if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    }
    if ($headers) curl_setopt($ch, CURLOPT_HTTPHEADER, array_values(array_unique($headers)));
    $resp=curl_exec($ch);
    $err=curl_error($ch);
    $errno=(int)curl_errno($ch);
    $code=(int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($resp===false) throw new RuntimeException('HTTP_CURL_'.$errno.($err?': '.$err:''));
    if ($code>=400 || $code===0) throw new RuntimeException('HTTP_'.$code.': '.substr((string)$resp,0,160));
    $j=json_decode((string)$resp, true);
    if(!is_array($j)) throw new RuntimeException('JSON_FAILED: '.substr((string)$resp,0,120));
    return $j;
}
function crypto_rate_cache(): array {
    $raw = setting('crypto_rate_cache', '');
    $d = json_decode((string)$raw, true);
    return is_array($d) ? $d : [];
}
function set_crypto_rate_cache(array $cache): void { set_setting('crypto_rate_cache', $cache); }
function crypto_num($v): float {
    if (is_int($v) || is_float($v)) return (float)$v;
    if (!is_string($v)) return 0.0;
    $v = trim(str_replace([',',' '], '', $v));
    if ($v === '') return 0.0;
    return is_numeric($v) ? (float)$v : 0.0;
}
function crypto_market_price_from_row(array $row): float {
    $paths = [
        ['stats','lastPrice'], ['stats','askPrice'], ['stats','bidPrice'],
        ['lastPrice'], ['last_trade_price'], ['lastTradePrice'], ['last_price'], ['last'], ['latest'], ['price'], ['close'],
        ['sell'], ['buy'], ['ask'], ['bid'], ['bestSell'], ['bestBuy'], ['amount'],
    ];
    foreach ($paths as $path) {
        $cur = $row;
        foreach ($path as $k) {
            if (!is_array($cur) || !array_key_exists($k, $cur)) { $cur = null; break; }
            $cur = $cur[$k];
        }
        $n = crypto_num($cur);
        if ($n > 0) return $n;
    }
    return 0.0;
}
function crypto_collect_market_rows(array $data): array {
    $rows = [];
    $getString = function($val) {
        if (is_string($val) || is_numeric($val)) return (string)$val;
        if (is_array($val)) {
            return (string)($val['en'] ?? $val['symbol'] ?? $val['code'] ?? reset($val) ?: '');
        }
        return '';
    };
    $walk = function($node, $key=null) use (&$walk, &$rows, $getString) {
        if (!is_array($node)) return;
        $isAssoc = array_keys($node) !== range(0, count($node)-1);
        $symbol = strtoupper($getString($node['symbol'] ?? $node['market'] ?? $node['pair'] ?? $node['pair_symbol'] ?? ($isAssoc ? (string)$key : '')));
        $base = strtoupper($getString($node['baseAsset'] ?? $node['base_asset'] ?? $node['baseCurrency'] ?? $node['base_currency'] ?? $node['base_currency_symbol'] ?? $node['srcCurrency'] ?? $node['currency1'] ?? ''));
        $quote = strtoupper($getString($node['quoteAsset'] ?? $node['quote_asset'] ?? $node['quoteCurrency'] ?? $node['quote_currency'] ?? $node['quote_currency_symbol'] ?? $node['dstCurrency'] ?? $node['currency2'] ?? ''));
        $urlName = strtolower((string)($node['url_name'] ?? $node['url'] ?? $node['web_link'] ?? ''));

        if (($base === '' || $quote === '') && preg_match('/^([A-Z0-9]{2,12})(TMN|IRT|IRR|RLS|USDT)$/', $symbol, $m)) { $base=$m[1]; $quote=$m[2]; }
        if (($base === '' || $quote === '') && preg_match('/^([A-Z0-9]{2,12})[-_\/](TMN|IRT|IRR|RLS|USDT)$/', $symbol, $m)) { $base=$m[1]; $quote=$m[2]; }
        
        $price = crypto_market_price_from_row($node);
        if ($base !== '' && $quote !== '' && $price > 0) {
            $rows[] = ['base'=>$base,'quote'=>$quote,'symbol'=>$symbol,'price'=>$price,'row'=>$node];
            // Alias map Ramzinex / Wallex GRAM -> TON
            if ($base === 'GRAM' || str_contains($urlName, 'toncoin') || str_contains($urlName, 'ton')) {
                $rows[] = ['base'=>'TON','quote'=>$quote,'symbol'=>$symbol,'price'=>$price,'row'=>$node];
            }
        }
        foreach ($node as $k=>$v) if (is_array($v)) $walk($v, $k);
    };
    $walk($data);
    return $rows;
}
function crypto_asset_aliases(string $asset): array {
    $asset = strtoupper(trim($asset));
    if ($asset === 'TON' || $asset === 'TONCOIN' || $asset === 'GRAM') {
        return ['TON', 'GRAM', 'TONCOIN'];
    }
    if ($asset === 'USDT' || $asset === 'TETHER') {
        return ['USDT', 'TETHER'];
    }
    if ($asset === 'TRX' || $asset === 'TRON') {
        return ['TRX', 'TRON'];
    }
    return [$asset];
}
function crypto_price_from_rows(array $rows, string $base, array $quotes=['TMN','IRT','IRR','RLS','USDT']): ?array {
    $bases = crypto_asset_aliases($base);
    foreach ($quotes as $quote) {
        foreach ($bases as $b) {
            foreach ($rows as $r) {
                if (($r['base'] ?? '') === $b && ($r['quote'] ?? '') === $quote) {
                    $price = (float)$r['price'];
                    if (in_array($quote, ['RLS','IRR'], true)) $price /= 10;
                    return ['price'=>$price, 'quote'=>$quote, 'symbol'=>$r['symbol'] ?? ($b.$quote)];
                }
            }
        }
    }
    return null;
}
function crypto_asset_rate_from_rows(array $rows, string $asset): float {
    $asset = strtoupper($asset ?: 'USDT');
    if ($asset==='IRT' || $asset==='TOMAN' || $asset==='TMN') return 1.0;
    $direct = crypto_price_from_rows($rows, $asset, ['TMN','IRT','RLS','IRR']);
    if ($direct && (float)$direct['price'] > 0) return (float)$direct['price'];
    if ($asset === 'USDT') throw new RuntimeException('USDT_TOMAN_MARKET_NOT_FOUND');
    $assetUsd = crypto_price_from_rows($rows, $asset, ['USDT']);
    $usdtTmn = crypto_price_from_rows($rows, 'USDT', ['TMN','IRT','RLS','IRR']);
    if ($assetUsd && $usdtTmn && (float)$assetUsd['price'] > 0 && (float)$usdtTmn['price'] > 0) return (float)$assetUsd['price'] * (float)$usdtTmn['price'];
    throw new RuntimeException('MARKET_NOT_FOUND_'.$asset);
}
function wallex_rate_toman_live(string $asset): float {
    static $rows = null;
    if ($rows === null) {
        try {
            $j = http_json_get('https://api.wallex.ir/v1/markets');
            $rows = crypto_collect_market_rows($j);
        } catch (Throwable $e) {}
        if (!$rows) {
            try {
                $j = http_json_get('https://api.wallex.ir/v1/currencies/stats');
                $rows = crypto_collect_market_rows($j);
            } catch (Throwable $e) {}
        }
        if (!$rows) throw new RuntimeException('WALLEX_NO_MARKETS');
    }
    try { return crypto_asset_rate_from_rows($rows, $asset); }
    catch (Throwable $e) { throw new RuntimeException('WALLEX_'.$e->getMessage()); }
}
function ramzinex_rate_toman_live(string $asset): float {
    static $rows = null;
    if ($rows === null) {
        $j = http_json_get('https://publicapi.ramzinex.com/exchange/api/v1.0/exchange/pairs');
        $rows = crypto_collect_market_rows($j);
        if (!$rows) throw new RuntimeException('RAMZINEX_NO_MARKETS');
    }
    try { return crypto_asset_rate_from_rows($rows, $asset); }
    catch (Throwable $e) { throw new RuntimeException('RAMZINEX_'.$e->getMessage()); }
}
function nobitex_rate_toman_live(string $asset): float {
    $asset = strtoupper($asset ?: 'USDT');
    if ($asset==='IRT' || $asset==='TOMAN' || $asset==='TMN') return 1.0;

    $aliases = crypto_asset_aliases($asset);
    
    $tryOrderbook = function(string $a, string $quote) {
        $aLower = strtolower($a);
        $qLower = strtolower($quote);
        $urls = [
            "https://api.nobitex.ir/v2/orderbook/{$a}{$quote}",
            "https://api.nobitex.ir/v2/orderbook/{$aLower}-{$qLower}",
            "https://api.nobitex.ir/v2/orderbook?symbol={$a}{$quote}"
        ];
        foreach ($urls as $url) {
            try {
                $j = http_json_get($url);
                if (is_array($j) && (!empty($j['lastTradePrice']) || !empty($j['asks']) || !empty($j['bids']))) {
                    $p = 0.0;
                    if (!empty($j['lastTradePrice'])) $p = crypto_num($j['lastTradePrice']);
                    elseif (!empty($j['asks'][0][0])) $p = crypto_num($j['asks'][0][0]);
                    elseif (!empty($j['bids'][0][0])) $p = crypto_num($j['bids'][0][0]);
                    
                    if ($p > 0) {
                        return in_array($quote, ['RLS','IRR'], true) ? $p / 10 : $p;
                    }
                }
            } catch (Throwable $e) {}
        }
        return 0.0;
    };

    foreach ($aliases as $alias) {
        foreach (['IRT','TMN','RLS'] as $q) {
            $p = $tryOrderbook($alias, $q);
            if ($p > 0) return $p;
        }
    }

    try {
        foreach ($aliases as $alias) {
            $j = http_json_post('https://api.nobitex.ir/market/stats', ['srcCurrency'=>strtolower($alias), 'dstCurrency'=>'rls']);
            $rows = crypto_collect_market_rows($j);
            $direct = crypto_price_from_rows($rows, $alias, ['RLS','IRR','IRT','TMN']);
            if ($direct && (float)$direct['price'] > 0) return (float)$direct['price'];
            $stats = $j['stats'] ?? [];
            foreach ($stats as $k=>$r) {
                if (is_array($r) && str_contains(strtoupper((string)$k), $alias) && crypto_market_price_from_row($r) > 0) {
                    return crypto_market_price_from_row($r) / 10;
                }
            }
        }
    } catch(Throwable $e) {}

    throw new RuntimeException('NOBITEX_RATE_FAILED_'.$asset);
}
function crypto_rate_provider_order(): array {
    $source = strtolower(trim((string)setting('crypto_rate_source','auto')));
    $all = ['wallex','ramzinex','nobitex'];
    if ($source === 'manual') return [];
    if (in_array($source, $all, true)) return array_values(array_unique(array_merge([$source], array_values(array_diff($all, [$source])))));
    $priority = strtolower((string)setting('crypto_rate_provider_priority','wallex,ramzinex,nobitex'));
    $out=[];
    foreach (preg_split('/[,\s]+/', $priority) as $p) if(in_array($p,$all,true)) $out[]=$p;
    return $out ? array_values(array_unique($out)) : $all;
}
function crypto_rate_from_provider(string $provider, string $asset): float {
    return match ($provider) {
        'wallex' => wallex_rate_toman_live($asset),
        'ramzinex' => ramzinex_rate_toman_live($asset),
        'nobitex' => nobitex_rate_toman_live($asset),
        default => throw new RuntimeException('UNKNOWN_PROVIDER_'.$provider),
    };
}
function crypto_rate_toman(string $asset, bool $notify=true): float {
    // Fast path only. Never fetch external APIs from Mini App / bot webhook.
    $asset = strtoupper($asset ?: 'USDT');
    if ($asset === 'IRT' || $asset === 'TOMAN' || $asset === 'TMN') return 1.0;
    $manual = crypto_manual_rates();
    $source = strtolower((string)setting('crypto_rate_source','auto'));
    if ($source !== 'manual') {
        $cache = crypto_rate_cache();
        $row = $cache[$asset] ?? null;
        if (is_array($row) && (float)($row['rate'] ?? 0) > 0) return (float)$row['rate'];
        if (isset($cache[$asset]) && is_numeric($cache[$asset]) && (float)$cache[$asset] > 0) return (float)$cache[$asset];
    }
    return (float)($manual[$asset] ?? 0);
}
function crypto_refresh_rates_from_providers(bool $notify=true): array {
    $assets = ['USDT','TRX','TON'];
    foreach (array_keys(crypto_manual_rates()) as $manualAsset) { $assets[] = strtoupper((string)$manualAsset); }
    foreach (crypto_wallets(false) as $w) $assets[] = strtoupper((string)($w['rate_symbol'] ?: $w['asset'] ?: 'USDT'));
    $assets = array_values(array_unique(array_filter($assets)));
    $cache = crypto_rate_cache();
    $providers = crypto_rate_provider_order();
    $source = strtolower((string)setting('crypto_rate_source','auto'));
    $manual = crypto_manual_rates();
    $updated = 0; $failed = []; $attempts = [];
    if ($source === 'manual') {
        $res = ['updated'=>0,'failed'=>[],'providers'=>[],'source'=>'manual','manual'=>array_keys($manual),'cache'=>$cache,'message'=>'rate_source_manual'];
        set_setting('crypto_rate_last_result', $res);
        return $res;
    }
    foreach ($assets as $asset) {
        if (in_array($asset, ['IRT','TOMAN','TMN'], true)) continue;
        $attempts[$asset] = [];
        foreach ($providers as $provider) {
            try {
                $rate = crypto_rate_from_provider($provider, $asset);
                if ($rate > 0) {
                    $cache[$asset] = ['rate'=>$rate,'updated_at'=>date('c'),'source'=>$provider,'provider'=>$provider,'is_live'=>true];
                    $updated++;
                    $attempts[$asset][] = ['provider'=>$provider,'ok'=>true,'rate'=>$rate];
                    continue 2;
                }
                $attempts[$asset][] = ['provider'=>$provider,'ok'=>false,'error'=>'ZERO_RATE'];
            } catch (Throwable $e) {
                $attempts[$asset][] = ['provider'=>$provider,'ok'=>false,'error'=>$e->getMessage()];
            }
        }
        $hasCache = isset($cache[$asset]) && ((is_array($cache[$asset]) && (float)($cache[$asset]['rate'] ?? 0)>0) || (is_numeric($cache[$asset]) && (float)$cache[$asset]>0));
        $hasManual = isset($manual[$asset]) && (float)$manual[$asset] > 0;
        $failed[$asset] = $hasCache ? 'USING_LAST_CACHE' : ($hasManual ? 'USING_MANUAL_RATE' : 'NO_PROVIDER_RATE');
    }
    set_crypto_rate_cache($cache);
    $usdProductPricesUpdated = refresh_usd_product_price_cache();
    $result = ['updated'=>$updated,'failed'=>$failed,'providers'=>$providers,'source'=>$source ?: 'auto','attempts'=>$attempts,'cache'=>$cache,'usd_product_prices_updated'=>$usdProductPricesUpdated];
    set_setting('crypto_rate_last_result', $result);
    if ($failed && $notify && setting_bool('crypto_notify_rate_fail', true)) {
        $key='crypto_rate_last_fail_alert'; $last=(int)setting($key, 0);
        if(time()-$last>1800){ notify_admins("⚠️ دریافت نرخ برای برخی ارزها ناموفق بود و نرخ دستی/cache استفاده می‌شود.\nProviderها: ".h(implode(' → ', $providers))."\n".h(implode(', ', array_keys($failed)))); set_setting($key, (string)time()); }
    }
    return $result;
}
function crypto_refresh_rates_from_nobitex(bool $notify=true): array {
    // Backward-compatible name used by older admin/cron code. It now uses all configured providers.
    return crypto_refresh_rates_from_providers($notify);
}
function get_crypto_check_by_order(int $orderId): ?array {
    if(!table_exists('crypto_payment_checks')) return null;
    $q=db()->prepare('SELECT c.*, w.title wallet_title FROM crypto_payment_checks c LEFT JOIN crypto_wallets w ON w.id=c.wallet_id WHERE c.order_id=?');
    $q->execute([$orderId]); $r=$q->fetch(); return $r ?: null;
}
function crypto_check_payload(?array $c): ?array {
    if(!$c) return null;
    return [
        'id'=>(int)$c['id'],'order_id'=>(int)$c['order_id'],'wallet_id'=>(int)$c['wallet_id'],'wallet_title'=>$c['wallet_title'] ?? null,
        'network'=>$c['network'],'asset'=>$c['asset'],'address'=>$c['address'],'expected_amount'=>(float)$c['expected_amount'],
        'rate_toman'=>isset($c['rate_toman'])?(float)$c['rate_toman']:null,'rate_updated_at'=>$c['rate_updated_at'] ?? null,'rate_source'=>$c['rate_source'] ?? null,
        'tx_hash'=>$c['tx_hash'],'status'=>$c['status'],'check_count'=>(int)$c['check_count'],'last_checked_at'=>$c['last_checked_at'],'confirmed_at'=>$c['confirmed_at'],'fail_reason'=>$c['fail_reason']
    ];
}
function start_crypto_payment(int $orderId, int $userId, int $walletId): array {
    if(!payment_enabled('crypto')) throw new RuntimeException('CRYPTO_DISABLED');
    $order=order_by_id($orderId); if(!$order || (int)$order['user_id']!==$userId) throw new RuntimeException('ORDER_NOT_FOUND');
    if(!in_array(normalize_order_status($order['status']), ['pending_payment','rejected'], true)) throw new RuntimeException('ORDER_LOCKED');
    $wallet=crypto_wallet_by_id($walletId); if(!$wallet || (int)$wallet['is_active']!==1) throw new RuntimeException('WALLET_NOT_FOUND');
    $rate=crypto_rate_toman((string)($wallet['rate_symbol'] ?: $wallet['asset']));
    if($rate<=0) throw new RuntimeException('CRYPTO_RATE_NOT_AVAILABLE');
    $markup=max(0,(float)setting('crypto_rate_markup_percent','1'))/100;
    $expected=round(((int)$order['final_amount']/$rate)*(1+$markup), 6);
    $meta=crypto_rate_meta((string)($wallet['rate_symbol'] ?: $wallet['asset']));
    $details=['wallet_id'=>$walletId,'network'=>$wallet['network'],'asset'=>$wallet['asset'],'address'=>$wallet['address'],'expected_amount'=>$expected,'rate_toman'=>$rate,'rate_source'=>$meta['source'],'rate_updated_at'=>$meta['updated_at'],'markup_percent'=>(float)setting('crypto_rate_markup_percent','1'),'fee_note'=>'کارمزد صرافی/شبکه با پرداخت‌کننده است. مبلغ درج‌شده باید دقیقاً به کیف پول مقصد برسد.'];
    db()->prepare('UPDATE orders SET payment_method="crypto", payment_details=?, crypto_amount=?, crypto_asset=?, crypto_network=? WHERE id=?')->execute([json_encode($details,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),(string)$expected,$wallet['asset'],$wallet['network'],$orderId]);
    db()->prepare('INSERT INTO crypto_payment_checks (order_id,wallet_id,network,asset,address,expected_amount,rate_toman,rate_updated_at,rate_source,status) VALUES (?,?,?,?,?,?,?,?,?,"waiting_hash") ON DUPLICATE KEY UPDATE wallet_id=VALUES(wallet_id),network=VALUES(network),asset=VALUES(asset),address=VALUES(address),expected_amount=VALUES(expected_amount),rate_toman=VALUES(rate_toman),rate_updated_at=VALUES(rate_updated_at),rate_source=VALUES(rate_source),status="waiting_hash",tx_hash=NULL,fail_reason=NULL,raw_response=NULL')->execute([$orderId,$walletId,$wallet['network'],$wallet['asset'],$wallet['address'],(string)$expected,(string)$rate, date('Y-m-d H:i:s'), (string)$meta['source']]);
    add_order_event($orderId, 'pending_payment', 'پرداخت رمزارز انتخاب شد', strtoupper($wallet['asset']).' / '.strtoupper($wallet['network']).' / مقدار: '.$expected, true);
    return order_by_id($orderId);
}
function submit_crypto_hash(int $orderId, int $userId, string $txHash): array {
    $txHash=trim($txHash); if($txHash==='') throw new RuntimeException('TX_HASH_EMPTY');
    $order=order_by_id($orderId); if(!$order || (int)$order['user_id']!==$userId) throw new RuntimeException('ORDER_NOT_FOUND');
    if(($order['payment_method'] ?? '') !== 'crypto') throw new RuntimeException('CRYPTO_NOT_SELECTED');
    $check=get_crypto_check_by_order($orderId); if(!$check) throw new RuntimeException('CRYPTO_CHECK_NOT_FOUND');
    try { db()->prepare('UPDATE crypto_payment_checks SET tx_hash=?, status="pending", fail_reason=NULL WHERE order_id=?')->execute([$txHash,$orderId]); }
    catch(Throwable $e){ throw new RuntimeException('TX_HASH_ALREADY_USED'); }
    add_order_event($orderId, 'pending_payment', 'هش پرداخت رمزارز ثبت شد', $txHash, true);
    notify_admins("🪙 هش پرداخت رمزارز ثبت شد\nسفارش: <code>#{$orderId}</code>\nTXID: <code>".h($txHash)."</code>");
    // Verification is intentionally deferred to cron so user/bot requests stay fast.
    return order_by_id($orderId);
}
function crypto_verify_order(int $orderId): ?array {
    $check=get_crypto_check_by_order($orderId); if(!$check || empty($check['tx_hash'])) return $check;
    if($check['status']==='confirmed') return $check;
    $ok=false; $reason=''; $raw=[];
    try{
        $network=strtoupper($check['network']);
        if(in_array($network,['TRC20','TRON','TRX'],true)) { [$ok,$reason,$raw]=verify_tron_payment($check); }
        elseif($network==='TON') { [$ok,$reason,$raw]=verify_ton_payment($check); }
        else { $reason='این شبکه هنوز بررسی خودکار ندارد و نیاز به تایید دستی ادمین دارد.'; }
    } catch(Throwable $e){ $reason=$e->getMessage(); $raw=['exception'=>$reason]; }
    db()->prepare('UPDATE crypto_payment_checks SET check_count=check_count+1,last_checked_at=NOW(),raw_response=?,fail_reason=?,status=? WHERE id=?')->execute([json_encode($raw,JSON_UNESCAPED_UNICODE),$reason,$ok?'confirmed':'pending',(int)$check['id']]);
    if($ok){
        db()->prepare('UPDATE crypto_payment_checks SET confirmed_at=NOW() WHERE id=?')->execute([(int)$check['id']]);
        $paid=mark_order_paid((int)$check['order_id']);
        add_order_event((int)$check['order_id'], 'payment_confirmed', 'پرداخت رمزارز تایید شد', strtoupper($check['asset']).' / TXID: '.$check['tx_hash'], true);
        if($paid){ send_msg((int)$paid['telegram_id'], "✅ پرداخت رمزارز سفارش <code>#{$paid['id']}</code> تایید شد.\nسفارش شما برای آماده‌سازی ثبت شد.", main_menu_keyboard(is_full_admin($paid['telegram_id']))); notify_admins("✅ پرداخت رمزارز تایید شد\nسفارش: <code>#{$paid['id']}</code>\nکاربر: <code>{$paid['telegram_id']}</code>\nTXID: <code>".h($check['tx_hash'])."</code>"); }
    }
    return get_crypto_check_by_order($orderId);
}
function verify_tron_payment(array $check): array {
    $key=app_config('TRONSCAN_API_KEY',''); $headers=$key?['TRON-PRO-API-KEY: '.$key]:[];
    $tx=urlencode((string)$check['tx_hash']);
    $j=http_json_get("https://apilist.tronscanapi.com/api/transaction-info?hash={$tx}", $headers);
    if(empty($j['confirmed']) && (($j['contractRet'] ?? '') !== 'SUCCESS')) return [false,'تراکنش هنوز تایید قطعی نشده یا موفق نیست.',$j];
    $asset=strtoupper($check['asset']); $to=strtolower($check['address']); $need=(float)$check['expected_amount'];
    $transfers=[];
    foreach(['trc20TransferInfo','tokenTransferInfo','transfersAllList'] as $k) if(!empty($j[$k]) && is_array($j[$k])) $transfers=array_merge($transfers, $j[$k]);
    foreach($transfers as $t){
        $sym=strtoupper((string)($t['symbol'] ?? $t['tokenAbbr'] ?? $t['tokenName'] ?? $asset));
        $toAddr=strtolower((string)($t['to_address'] ?? $t['toAddress'] ?? $t['to'] ?? ''));
        $dec=(int)($t['decimals'] ?? $t['tokenDecimal'] ?? 6);
        $amtRaw=(string)($t['amount_str'] ?? $t['amount'] ?? $t['quant'] ?? '0');
        $amt=(float)$amtRaw; if($amt>100000 && $dec>0) $amt=$amt/(10**$dec);
        if($toAddr===$to && ($sym===$asset || ($asset==='USDT' && str_contains($sym,'USDT'))) && $amt + 0.000001 >= $need) return [true,'confirmed',$j];
    }
    // native TRX fallback
    if($asset==='TRX'){
        $contract=$j['contractData'] ?? [];
        $toAddr=strtolower((string)($contract['to_address'] ?? $contract['to'] ?? ''));
        $amt=((float)($contract['amount'] ?? 0))/1000000;
        if($toAddr===$to && $amt+0.000001>=$need) return [true,'confirmed',$j];
    }
    return [false,'مبلغ/آدرس/توکن تراکنش با سفارش تطابق ندارد.',$j];
}
function verify_ton_payment(array $check): array {
    $addr=urlencode((string)$check['address']); $hash=(string)$check['tx_hash']; $key=app_config('TONCENTER_API_KEY','');
    $url="https://toncenter.com/api/v3/transactions?account={$addr}&limit=25&sort=desc".($key?'&api_key='.urlencode($key):'');
    $j=http_json_get($url);
    $list=$j['transactions'] ?? $j['result'] ?? [];
    $need=(float)$check['expected_amount'];
    foreach($list as $tx){
        $h=(string)($tx['hash'] ?? $tx['transaction_id']['hash'] ?? '');
        if($h==='' || !hash_equals(strtolower($h), strtolower($hash))) continue;
        $val=0;
        if(isset($tx['in_msg']['value'])) $val=((float)$tx['in_msg']['value'])/1000000000;
        if(isset($tx['in_msg']['decoded_body']['amount'])) $val=max($val, ((float)$tx['in_msg']['decoded_body']['amount'])/1000000000);
        if($val+0.000001 >= $need) return [true,'confirmed',$j];
        return [false,'مبلغ تراکنش TON کمتر از مقدار سفارش است.',$j];
    }
    return [false,'تراکنش TON در آخرین تراکنش‌های این آدرس پیدا نشد.',$j];
}
function crypto_check_pending_all(int $limit=20): array {
    if(!table_exists('crypto_payment_checks')) return ['checked'=>0,'confirmed'=>0];
    $q=db()->prepare('SELECT order_id FROM crypto_payment_checks WHERE status IN ("pending","waiting_hash") AND tx_hash IS NOT NULL ORDER BY last_checked_at IS NULL DESC, last_checked_at ASC LIMIT ?');
    $q->bindValue(1,$limit,PDO::PARAM_INT); $q->execute(); $ids=$q->fetchAll(PDO::FETCH_COLUMN);
    $checked=0; $confirmed=0;
    foreach($ids as $oid){ $checked++; $before=get_crypto_check_by_order((int)$oid); $after=crypto_verify_order((int)$oid); if(($before['status']??'')!=='confirmed' && ($after['status']??'')==='confirmed') $confirmed++; }
    return ['checked'=>$checked,'confirmed'=>$confirmed];
}

function set_payment_methods_enabled(array $input): void {
    $current=setting_json('payment_methods_enabled', ['wallet'=>true,'card'=>true,'stars'=>false,'crypto'=>false]);
    foreach (['wallet','card','stars','crypto'] as $m) if (array_key_exists($m,$input)) $current[$m]=(bool)$input[$m];
    set_setting('payment_methods_enabled', $current);
    if (table_exists('payment_methods')) {
        $q=db()->prepare('UPDATE payment_methods SET is_active=? WHERE method_key=?');
        foreach (['wallet','card','stars','crypto'] as $m) $q->execute([!empty($current[$m])?1:0,$m]);
    }
}
function order_set_payment_method(int $orderId, int $userId, string $method, array $details=[]): array {
    $method = preg_replace('/[^a-z0-9_]/i','', $method);
    if ($method !== '' && $method !== 'none' && !in_array($method, ['wallet','card','stars','crypto'], true)) throw new RuntimeException('PAYMENT_METHOD_INVALID');
    if ($method !== '' && $method !== 'none' && !payment_enabled($method)) throw new RuntimeException('PAYMENT_METHOD_DISABLED');
    $order=order_by_id($orderId);
    if (!$order || (int)$order['user_id'] !== $userId) throw new RuntimeException('ORDER_NOT_FOUND');
    if (!in_array(normalize_order_status($order['status']), ['pending_payment','rejected'], true)) throw new RuntimeException('ORDER_LOCKED');
    $stars=0;
    if ($method==='stars') $stars = max(1, (int)ceil((int)$order['final_amount'] / max(1, setting_int('stars_rate_toman', 3200))));
    $cleanMethod = ($method === 'none' ? '' : $method);
    db()->prepare('UPDATE orders SET payment_method=?, payment_details=?, stars_amount=? WHERE id=?')->execute([$cleanMethod, json_encode($details, JSON_UNESCAPED_UNICODE), $stars, $orderId]);
    add_order_event($orderId, normalize_order_status($order['status']), 'روش پرداخت تغییر کرد', payment_method_fa($cleanMethod), true);
    return order_by_id($orderId);
}
function payment_method_fa(?string $m): string {
    return ['wallet'=>'اعتبار BlueGate','card'=>'کارت به کارت','stars'=>'Telegram Stars','crypto'=>'رمزارز'][$m ?: ''] ?? 'انتخاب نشده';
}
function order_catalog_display_name(array $order): string {
    $parts = array_values(array_filter([
        trim((string)($order['service_name_snapshot'] ?? '')),
        trim((string)($order['group_name_snapshot'] ?? '')),
        trim((string)($order['plan_name_snapshot'] ?? '')),
    ], static fn($v) => $v !== ''));
    if ($parts) return implode(' - ', $parts);
    return trim((string)($order['product_name'] ?? '').(!empty($order['variant_title']) ? ' - '.$order['variant_title'] : ''));
}
function send_stars_invoice_for_order(array $order): array {
    if (!payment_enabled('stars')) throw new RuntimeException('STARS_DISABLED');
    $amountStars = (int)($order['stars_amount'] ?? 0);
    if ($amountStars <= 0) $amountStars = max(1, (int)ceil((int)$order['final_amount'] / max(1, setting_int('stars_rate_toman', 3200))));
    $payload = 'order_'.$order['id'].'_stars_'.$amountStars;
    $name = order_catalog_display_name($order);
    return tg('sendInvoice', [
        'chat_id'=>(int)$order['telegram_id'],
        'title'=>'پرداخت سفارش #'.$order['id'],
        'description'=>'پرداخت '.$name.' با Telegram Stars',
        'payload'=>$payload,
        'provider_token'=>'',
        'currency'=>'XTR',
        'prices'=>json_encode([['label'=>'Order #'.$order['id'], 'amount'=>$amountStars]], JSON_UNESCAPED_UNICODE),
        'start_parameter'=>'blue_ref_order_'.$order['id'],
    ]);
}
function stars_required_for_order(array $order): int {
    $stored=(int)($order['stars_amount']??0);if($stored>0)return $stored;
    return max(1,(int)ceil((int)$order['final_amount']/max(1,setting_int('stars_rate_toman',3200))));
}
function validate_stars_precheckout(array $q): array|false {
    $payload=(string)($q['invoice_payload']??'');if(!preg_match('/^order_(\d+)_stars_(\d+)$/',$payload,$m))return false;
    $order=order_by_id((int)$m[1]);if(!$order)return false;$fromId=(int)($q['from']['id']??0);$payloadStars=(int)$m[2];$required=stars_required_for_order($order);
    if($fromId<=0||(int)$order['telegram_id']!==$fromId)return false;
    if($payloadStars!==$required||strtoupper((string)($q['currency']??''))!=='XTR'||(int)($q['total_amount']??0)!==$required)return false;
    if(!in_array(normalize_order_status((string)$order['status']),['pending_payment','receipt_submitted','reviewing'],true))return false;
    return $order;
}
function confirm_stars_payment(string $payload,array $payment=[],int $chatId=0): ?array {
    if(!preg_match('/^order_(\d+)_stars_(\d+)$/',$payload,$m))return null;$orderId=(int)$m[1];$payloadStars=(int)$m[2];
    $currency=strtoupper((string)($payment['currency']??''));$total=(int)($payment['total_amount']??0);$charge=trim((string)($payment['telegram_payment_charge_id']??''));$provider=trim((string)($payment['provider_payment_charge_id']??''));if($currency!=='XTR'||$charge==='')return null;
    $pdo=db();$pdo->beginTransaction();try{$q=$pdo->prepare('SELECT * FROM orders WHERE id=? FOR UPDATE');$q->execute([$orderId]);$order=$q->fetch();if(!$order||($chatId>0&&(int)$order['telegram_id']!==$chatId)){$pdo->rollBack();return null;}$required=stars_required_for_order($order);if($payloadStars!==$required||$total!==$required){$pdo->rollBack();return null;}
        $status=normalize_order_status((string)$order['status']);if(in_array($status,['payment_confirmed','preparing','delivered'],true)){if(!empty($order['stars_charge_id'])&&!hash_equals((string)$order['stars_charge_id'],$charge)){$pdo->rollBack();error_log('[Stars payment] second charge for paid order '.$orderId);return null;}$pdo->commit();return $order;}if(!in_array($status,['pending_payment','receipt_submitted','reviewing'],true)){$pdo->rollBack();return null;}
        $dup=$pdo->prepare('SELECT id FROM orders WHERE stars_charge_id=? AND id<>? LIMIT 1');$dup->execute([$charge,$orderId]);if($dup->fetch()){$pdo->rollBack();return null;}
        $pdo->prepare('UPDATE orders SET payment_method="stars",stars_amount=?,stars_charge_id=?,stars_provider_charge_id=?,payment_details=? WHERE id=?')->execute([$required,$charge,$provider?:null,json_encode($payment,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),$orderId]);
        $paid=mark_order_paid($orderId);if(!$paid)throw new RuntimeException('ORDER_PAYMENT_STATE_INVALID');$pdo->commit();return order_by_id($orderId);
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();error_log('[Stars payment] '.$e->getMessage());return null;}
}



function swapwallet_username(): string {
    $u = trim((string)setting('swapwallet_username',''));
    if ($u === '') $u = trim((string)setting('swapwallet_application','')); // backward compatibility
    return ltrim($u, '@');
}
function swapwallet_configured(): bool {
    return trim((string)setting('swapwallet_api_key','')) !== '' && swapwallet_username() !== '' && swapwallet_rate_toman() > 0;
}
function swapwallet_base_url(): string { return rtrim((string)setting('swapwallet_base_url','https://swapwallet.app/api'), '/'); }
function swapwallet_api_key(): string { return trim((string)setting('swapwallet_api_key','')); }
function swapwallet_application(): string { return swapwallet_username(); } // old name kept for compatibility
function swapwallet_rate_toman(): float {
    // Manual-only rate. This keeps panel loading fast and independent from external APIs.
    return max(0, (float)setting('swapwallet_usdt_rate_toman', 0));
}
function swapwallet_amount_usd(int $toman): float {
    $rate = swapwallet_rate_toman();
    if ($rate <= 0) throw new RuntimeException('SWAPWALLET_RATE_REQUIRED');
    $markup = max(0, (float)setting('swapwallet_rate_markup_percent','1')) / 100;
    return round(($toman / $rate) * (1 + $markup), 2);
}
function http_json_request(string $method, string $url, array $payload=null, array $headers=[]): array {
    $ch = curl_init($url);
    $baseHeaders = ['Accept: application/json'];
    if ($payload !== null) $baseHeaders[] = 'Content-Type: application/json';
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_CONNECTTIMEOUT => 2,
        CURLOPT_TIMEOUT => 6,
        CURLOPT_CUSTOMREQUEST => strtoupper($method),
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);
    if ($payload !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    curl_setopt($ch, CURLOPT_HTTPHEADER, array_merge($baseHeaders, $headers));
    $body = curl_exec($ch);
    $err = curl_error($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($body === false) throw new RuntimeException('HTTP_FAILED CURL '.($err ?: 'unknown'));
    $j = json_decode($body ?: '{}', true);
    if (!is_array($j)) {
        throw new RuntimeException('JSON_FAILED HTTP '.$code.' BODY '.mb_substr((string)$body,0,500));
    }
    if ($code >= 400) {
        $msg = $j['message'] ?? $j['error'] ?? $j['detail'] ?? ($j['errorMessage'] ?? ('HTTP '.$code));
        $shortBody = mb_substr(json_encode($j, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES), 0, 500);
        throw new RuntimeException('HTTP_FAILED '.$code.' '.$msg.' BODY '.$shortBody);
    }
    return $j;
}
function swapwallet_headers(): array {
    $key = swapwallet_api_key();
    // Official SwapPay examples use exactly this authorization scheme.
    return [
        'Authorization: Apikey '.$key,
    ];
}
function swapwallet_mask_key(string $key): string {
    $key = trim($key);
    if ($key === '') return '';
    return mb_substr($key, 0, 4).'…'.mb_substr($key, -4);
}
function swapwallet_is_404_error(string $err): bool { return str_contains($err, 'HTTP_FAILED 404') || stripos($err, 'Not Found') !== false; }
function swapwallet_pretty_fail_reason(array $attempts): string {
    $last = $attempts ? end($attempts) : [];
    $err = (string)($last['error'] ?? 'UNKNOWN_SWAPWALLET_ERROR');
    $all404 = $attempts && count(array_filter($attempts, fn($a)=>swapwallet_is_404_error((string)($a['error'] ?? '')))) === count($attempts);
    if ($all404) {
        return 'SWAPWALLET_USERNAME_NOT_FOUND_OR_SWAPPAY_INACTIVE: مقدار SwapWallet Username/Slug پیدا نشد یا SwapPay برای این حساب فعال نیست. مقدار عددی، شماره کاربری، شماره موبایل یا ایمیل معمولاً معتبر نیست. مقدار دقیق {username} را باید از پنل/پشتیبانی SwapWallet بگیری.';
    }
    if (str_contains($err, 'HTTP_FAILED 401') || str_contains($err, 'HTTP_FAILED 403')) return 'SWAPWALLET_API_KEY_REJECTED: API Key رد شد یا دسترسی SwapPay ندارد.';
    return $err;
}
function swapwallet_collect_arrays(array $node, array &$out, int $depth=0): void {
    if ($depth > 4) return;
    $out[] = $node;
    foreach ($node as $v) if (is_array($v)) swapwallet_collect_arrays($v, $out, $depth+1);
}
function swapwallet_invoice_result(array $response): array {
    $candidates = [];
    swapwallet_collect_arrays($response, $candidates);
    foreach ($candidates as $c) {
        foreach (['id','_id','invoiceId','invoice_id','swapPayId','uuid','hash','invoiceHash','invoice_hash','walletId','wallet_id'] as $k) {
            if (!empty($c[$k])) return $c;
        }
        if (!empty($c['paymentLinks']) || !empty($c['payment_links']) || !empty($c['links']) || !empty($c['url'])) return $c;
    }
    return $response;
}
function swapwallet_extract_invoice_id(array $result): string {
    foreach (['id','_id','invoiceId','invoice_id','swapPayId','uuid','hash','invoiceHash','invoice_hash','walletId','wallet_id','temporaryWalletId','temporary_wallet_id'] as $k) {
        if (!empty($result[$k])) return (string)$result[$k];
    }
    throw new RuntimeException('SWAPWALLET_INVOICE_ID_MISSING');
}
function swapwallet_extract_payment_links(array $result): array {
    $links = $result['paymentLinks'] ?? $result['payment_links'] ?? $result['links'] ?? $result['urls'] ?? [];
    if (is_array($links)) {
        $normalized = [];
        foreach ($links as $k=>$v) {
            if (is_array($v)) {
                if (!isset($v['type']) && is_string($k)) $v['type'] = $k;
                $normalized[] = $v;
            } elseif (is_string($v) && $v !== '') {
                $normalized[] = ['type'=>is_string($k)?$k:'WEBSITE','url'=>$v];
            }
        }
        return $normalized;
    }
    return [];
}
function swapwallet_best_payment_url(array $links, array $result=[]): string {
    foreach (['paymentUrl','payment_url','payUrl','pay_url','url','link','paymentLink','payment_link','redirectUrl','redirect_url','webAppUrl','webapp_url','telegramWebAppUrl','telegram_webapp_url'] as $k) {
        if (!empty($result[$k]) && is_string($result[$k])) return (string)$result[$k];
    }
    foreach (['TELEGRAM_WEBAPP','TELEGRAM_BOT','WEBSITE','WEB','DEFAULT'] as $type) {
        foreach ($links as $l) if (is_array($l) && strtoupper((string)($l['type'] ?? $l['name'] ?? '')) === $type) {
            foreach (['url','link','href','paymentUrl','payment_url'] as $uk) if (!empty($l[$uk])) return (string)$l[$uk];
        }
    }
    foreach ($links as $l) if (is_array($l)) foreach (['url','link','href','paymentUrl','payment_url'] as $uk) if (!empty($l[$uk])) return (string)$l[$uk];
    return '';
}
function swapwallet_status_from_result(array $result, string $default='ACTIVE'): string {
    foreach (['status','state','invoiceStatus','invoice_status','paymentStatus','payment_status'] as $k) {
        if (!empty($result[$k])) return strtoupper((string)$result[$k]);
    }
    return strtoupper($default ?: 'ACTIVE');
}
function swapwallet_callback_url(int $orderId=0): string {
    $base = rtrim((string)app_config('PUBLIC_BASE_URL', ''), '/');
    if ($base === '') $base = rtrim((string)app_config('MINIAPP_URL', ''), '/');
    if (str_ends_with($base, '/miniapp')) $base = substr($base, 0, -8);
    if ($base === '') return '';
    $secret = swapwallet_callback_secret();
    return $base . '/swapwallet_callback.php' . ($secret ? ('?secret='.rawurlencode($secret)) : '') . ($orderId ? ((strpos($base,'?')===false && !$secret)?'?':'&').'order_id='.$orderId : '');
}
function get_swapwallet_invoice_by_order(int $orderId): ?array {
    if (!table_exists('swapwallet_invoices')) return null;
    $q=db()->prepare('SELECT * FROM swapwallet_invoices WHERE order_id=?'); $q->execute([$orderId]); $r=$q->fetch(); return $r ?: null;
}
function swapwallet_invoice_payload(?array $inv): ?array {
    if (!$inv) return null;
    return [
        'id'=>(int)$inv['id'], 'order_id'=>(int)$inv['order_id'], 'invoice_id'=>$inv['invoice_id'], 'status'=>$inv['status'],
        'amount_usd'=>(float)$inv['amount_usd'], 'token'=>$inv['token'], 'payment_url'=>$inv['payment_url'],
        'check_count'=>(int)$inv['check_count'], 'last_checked_at'=>$inv['last_checked_at'], 'paid_at'=>$inv['paid_at'], 'fail_reason'=>$inv['fail_reason'], 'api_version'=>$inv['api_version'] ?? null
    ];
}
function swapwallet_payment_keyboard(string $url, int $orderId): string {
    return json_markup(['inline_keyboard'=>[
        [['text'=>'🪙 باز کردن صفحه پرداخت SwapWallet', 'url'=>$url]],
        [['text'=>'🔄 بررسی پرداخت', 'callback_data'=>'order_check_crypto_'.$orderId]],
    ]]);
}
function notify_user_swapwallet_link(array $order, ?array $invoice=null): void {
    $invoice = $invoice ?: get_swapwallet_invoice_by_order((int)$order['id']);
    if (!$invoice || empty($invoice['payment_url'])) return;
    $text = "🪙 لینک پرداخت SwapWallet سفارش <code>#{$order['id']}</code> آماده شد.\n".
        "مبلغ: <b>".h($invoice['amount_usd']).' '.h($invoice['token'])."</b>\n\n".
        "برای پرداخت روی دکمه زیر بزن. بعد از پرداخت، سفارش خودکار تایید می‌شود.";
    $res = tg('sendMessage', [
        'chat_id'=>(int)$order['telegram_id'],
        'text'=>$text,
        'parse_mode'=>'HTML',
        'disable_web_page_preview'=>true,
        'reply_markup'=>swapwallet_payment_keyboard((string)$invoice['payment_url'], (int)$order['id']),
    ]);
    if (empty($res['ok'])) error_log('[BlueReferral SwapWallet] send payment link failed: '.json_encode($res, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES));
}
function swapwallet_invoice_payloads(array $order, float $amountUsd, string $token, int $ttl): array {
    $name = order_catalog_display_name($order);
    $custom = ['order_id'=>(int)$order['id'], 'telegram_id'=>(int)$order['telegram_id'], 'cartId'=>'blue-ref-'.(int)$order['id']];
    $cb = swapwallet_callback_url((int)$order['id']);
    $returnUrl = miniapp_url(false);
    $description = 'BlueReferral order #'.(int)$order['id'].' - '.$name;
    $base = [
        'amount'=>['number'=>(string)$amountUsd, 'unit'=>'USD'],
        'autoConversionToken'=>$token,
        'ttl'=>$ttl,
        'description'=>$description,
        'userId'=>(string)$order['telegram_id'],
        'userEmail'=>'user'.(int)$order['telegram_id'].'@telegram.local',
        'externalId'=>'blue_ref_order_'.(int)$order['id'],
        'returnUrl'=>$returnUrl,
        'customData'=>json_encode($custom, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),
    ];
    if ($cb !== '') $base['callbackUrl'] = $cb;

    $objectCustom = $base;
    $objectCustom['customData'] = $custom;

    $snakeCase = [
        'amount'=>['number'=>(string)$amountUsd, 'unit'=>'USD'],
        'auto_conversion_token'=>$token,
        'ttl'=>$ttl,
        'description'=>$description,
        'user_id'=>(string)$order['telegram_id'],
        'user_email'=>'user'.(int)$order['telegram_id'].'@telegram.local',
        'external_id'=>'blue_ref_order_'.(int)$order['id'],
        'return_url'=>$returnUrl,
        'custom_data'=>$custom,
    ];
    if ($cb !== '') $snakeCase['callback_url'] = $cb;

    return [
        ['version'=>'v2_temporary_wallet', 'payload'=>$base],
        ['version'=>'v2_temporary_wallet_object_custom', 'payload'=>$objectCustom],
        ['version'=>'v2_temporary_wallet_snake_case', 'payload'=>$snakeCase],
    ];
}
function swapwallet_create_url(string $version): string {
    $base = swapwallet_base_url();
    $username = rawurlencode(swapwallet_username());
    return $base.'/v2/payment/'.$username.'/invoices/temporary-wallet';
}
function swapwallet_status_urls(string $invoiceId): array {
    $base = swapwallet_base_url();
    $username = rawurlencode(swapwallet_username());
    $id = rawurlencode($invoiceId);
    return [
        $base.'/v2/payment/'.$username.'/invoices/'.$id,
        $base.'/v2/payment/'.$username.'/invoices?invoiceId='.$id,
    ];
}
function swapwallet_allowed_tokens_url(): string { return swapwallet_base_url().'/v1/payment/invoice/allowed-tokens'; }
function swapwallet_test_connection(): array {
    $out = [
        'configured'=>swapwallet_configured(),
        'base_url'=>swapwallet_base_url(),
        'username'=>swapwallet_username(),
        'api_key_masked'=>swapwallet_mask_key(swapwallet_api_key()),
        'create_url'=>swapwallet_create_url('v2_temporary_wallet'),
        'allowed_tokens_url'=>swapwallet_allowed_tokens_url(),
    ];
    try {
        $res = http_json_request('GET', swapwallet_allowed_tokens_url(), null, swapwallet_headers());
        $out['allowed_tokens_ok'] = true;
        $out['allowed_tokens_sample'] = array_slice($res, 0, 5);
    } catch (Throwable $e) {
        $out['allowed_tokens_ok'] = false;
        $out['allowed_tokens_error'] = $e->getMessage();
    }
    return $out;
}
function start_swapwallet_invoice(int $orderId, int $userId): array {
    if (!payment_enabled('crypto')) throw new RuntimeException('SWAPWALLET_DISABLED');
    if (!swapwallet_configured()) throw new RuntimeException('SWAPWALLET_NOT_CONFIGURED_OR_RATE_MISSING');
    $order=order_by_id($orderId); if(!$order || (int)$order['user_id']!==$userId) throw new RuntimeException('ORDER_NOT_FOUND');
    if(!in_array(normalize_order_status($order['status']), ['pending_payment','rejected'], true)) throw new RuntimeException('ORDER_LOCKED');
    $amountUsd = swapwallet_amount_usd((int)$order['final_amount']);
    if ($amountUsd <= 0) throw new RuntimeException('SWAPWALLET_AMOUNT_INVALID');
    $token = strtoupper((string)setting('swapwallet_auto_token','USDT')) ?: 'USDT';
    $ttl = max(5, setting_int('swapwallet_ttl_minutes', 30)) * 60;
    $attempts = [];
    foreach (swapwallet_invoice_payloads($order, $amountUsd, $token, $ttl) as $attempt) {
        $version = $attempt['version'];
        $payload = $attempt['payload'];
        $url = swapwallet_create_url($version);
        try {
            $response = http_json_request('POST', $url, $payload, swapwallet_headers());
            $result = swapwallet_invoice_result($response);
            if (!is_array($result)) throw new RuntimeException('SWAPWALLET_BAD_RESPONSE');
            $invoiceId = swapwallet_extract_invoice_id($result);
            $links = swapwallet_extract_payment_links($result);
            $paymentUrl = swapwallet_best_payment_url($links, $result);
            $status = swapwallet_status_from_result($result, 'ACTIVE');
            db()->prepare('INSERT INTO swapwallet_invoices (order_id,invoice_id,amount_usd,token,status,payment_url,payment_links_json,request_url,request_body,api_version,raw_response) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE invoice_id=VALUES(invoice_id),amount_usd=VALUES(amount_usd),token=VALUES(token),status=VALUES(status),payment_url=VALUES(payment_url),payment_links_json=VALUES(payment_links_json),request_url=VALUES(request_url),request_body=VALUES(request_body),api_version=VALUES(api_version),raw_response=VALUES(raw_response),fail_reason=NULL')->execute([$orderId,$invoiceId,(string)$amountUsd,$token,$status,$paymentUrl,json_encode($links,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),$url,json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),$version,json_encode($response,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);
            $details=['gateway'=>'swapwallet','invoice_id'=>$invoiceId,'amount_usd'=>$amountUsd,'token'=>$token,'payment_url'=>$paymentUrl,'rate_toman'=>swapwallet_rate_toman(),'markup_percent'=>(float)setting('swapwallet_rate_markup_percent','1'),'api_version'=>$version];
            db()->prepare('UPDATE orders SET payment_method="crypto", payment_details=?, crypto_amount=?, crypto_asset=?, crypto_network=? WHERE id=?')->execute([json_encode($details,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),(string)$amountUsd,$token,'SWAPWALLET',$orderId]);
            add_order_event($orderId, 'pending_payment', 'لینک پرداخت SwapWallet ساخته شد', $amountUsd.' USD / '.$token, true);
            $updated = order_by_id($orderId);
            notify_user_swapwallet_link($updated, get_swapwallet_invoice_by_order($orderId));
            return $updated;
        } catch (Throwable $e) {
            $attempts[] = ['version'=>$version,'url'=>$url,'error'=>$e->getMessage(),'payload'=>$payload];
        }
    }
    $primaryFail = $attempts[0] ?? ['error'=>'UNKNOWN_SWAPWALLET_ERROR'];
    $failText = swapwallet_pretty_fail_reason($attempts);
    error_log('[BlueReferral SwapWallet] create invoice failed order='.$orderId.' error='.$failText);
    try {
        db()->prepare('INSERT INTO swapwallet_invoices (order_id,invoice_id,amount_usd,token,status,payment_url,fail_reason,request_url,request_body,api_version,raw_response) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE amount_usd=VALUES(amount_usd),token=VALUES(token),status=VALUES(status),fail_reason=VALUES(fail_reason),request_url=VALUES(request_url),request_body=VALUES(request_body),api_version=VALUES(api_version),raw_response=VALUES(raw_response)')
            ->execute([$orderId,'failed_'.$orderId.'_'.time(),(string)$amountUsd,$token,'FAILED','',$failText,(string)($primaryFail['url'] ?? ''),json_encode($primaryFail['payload'] ?? [],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),(string)($primaryFail['version'] ?? 'unknown'),json_encode(['attempts'=>$attempts,'diagnostic'=>swapwallet_test_connection()],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);
    } catch (Throwable $ignored) {}
    throw new RuntimeException($failText);
}
function swapwallet_refresh_invoice(int $orderId): ?array {
    $inv = get_swapwallet_invoice_by_order($orderId); if (!$inv) return null;
    if (strtoupper((string)$inv['status']) === 'PAID') return $inv;
    if (!swapwallet_configured()) { db()->prepare('UPDATE swapwallet_invoices SET fail_reason=? WHERE id=?')->execute(['SwapWallet API یا نرخ دستی تنظیم نشده است.', (int)$inv['id']]); return get_swapwallet_invoice_by_order($orderId); }
    if (str_starts_with((string)$inv['invoice_id'], 'failed_')) return $inv;
    $errors=[];
    foreach (swapwallet_status_urls((string)$inv['invoice_id']) as $url) {
        try {
            $response = http_json_request('GET', $url, null, swapwallet_headers());
            $result = swapwallet_invoice_result($response); if (!is_array($result)) $result=[];
            $status = swapwallet_status_from_result($result, $inv['status'] ?? 'ACTIVE');
            $links = swapwallet_extract_payment_links($result);
            $paymentUrl = swapwallet_best_payment_url($links, $result) ?: (string)$inv['payment_url'];
            db()->prepare('UPDATE swapwallet_invoices SET status=?, payment_url=?, request_url=?, raw_response=?, check_count=check_count+1, last_checked_at=NOW(), fail_reason=NULL WHERE id=?')->execute([$status,$paymentUrl,$url,json_encode($response,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),(int)$inv['id']]);
            if ($status === 'PAID' || $status === 'PAID_CONFIRMED' || $status === 'COMPLETED') {
                db()->prepare('UPDATE swapwallet_invoices SET status="PAID", paid_at=NOW() WHERE id=?')->execute([(int)$inv['id']]);
                $paid=mark_order_paid($orderId);
                if($paid){
                    send_msg((int)$paid['telegram_id'], "✅ پرداخت سواپ‌ولت سفارش <code>#{$paid['id']}</code> تایید شد.\nسفارش شما برای آماده‌سازی ثبت شد.", main_menu_keyboard(is_full_admin($paid['telegram_id'])));
                    notify_admins("✅ پرداخت SwapWallet تایید شد\nسفارش: <code>#{$paid['id']}</code>\nکاربر: <code>{$paid['telegram_id']}</code>\nInvoice: <code>".h($inv['invoice_id'])."</code>");
                }
            }
            return get_swapwallet_invoice_by_order($orderId);
        } catch (Throwable $e) { $errors[]=['url'=>$url,'error'=>$e->getMessage()]; }
    }
    $msg = end($errors)['error'] ?? 'SWAPWALLET_STATUS_FAILED';
    db()->prepare('UPDATE swapwallet_invoices SET check_count=check_count+1,last_checked_at=NOW(),fail_reason=?,raw_response=? WHERE id=?')->execute([$msg,json_encode(['attempts'=>$errors],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),(int)$inv['id']]);
    if (setting_bool('swapwallet_notify_fail', true)) {
        $key='swapwallet_last_fail_alert_'.$orderId; $last=(int)setting($key, 0);
        if (time()-$last > 1800) { notify_admins("⚠️ بررسی پرداخت SwapWallet ناموفق بود\nسفارش: <code>#{$orderId}</code>\nخطا: <code>".h($msg)."</code>"); set_setting($key, (string)time()); }
    }
    return get_swapwallet_invoice_by_order($orderId);
}
function swapwallet_check_pending_all(int $limit=25): array {
    if (!table_exists('swapwallet_invoices')) return ['checked'=>0,'confirmed'=>0];
    if (!swapwallet_configured()) return ['checked'=>0,'confirmed'=>0,'skipped'=>'not_configured'];
    $q=db()->prepare('SELECT order_id,status FROM swapwallet_invoices WHERE status IN ("ACTIVE","PENDING","WAITING","CREATED") ORDER BY last_checked_at IS NULL DESC, last_checked_at ASC LIMIT ?');
    $q->bindValue(1,$limit,PDO::PARAM_INT); $q->execute(); $rows=$q->fetchAll();
    $checked=0; $confirmed=0;
    foreach ($rows as $r) { $checked++; $after=swapwallet_refresh_invoice((int)$r['order_id']); if (strtoupper((string)($r['status'] ?? '')) !== 'PAID' && strtoupper((string)($after['status'] ?? '')) === 'PAID') $confirmed++; }
    return ['checked'=>$checked,'confirmed'=>$confirmed];
}
function tg(string $method, array $data = []) {
    $token = app_config('BOT_TOKEN');
    $url = "https://api.telegram.org/bot{$token}/{$method}";
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $data,
        CURLOPT_TIMEOUT => 20,
    ]);
    $res = curl_exec($ch);
    $err = curl_error($ch);
    curl_close($ch);
    if ($res === false) return ['ok' => false, 'description' => $err];
    return json_decode($res ?: '{}', true);
}

function h($value): string { return htmlspecialchars((string)$value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function money($amount): string { $a = (int)$amount; if ($a === 0) return 'رایگان'; return number_format($a) . ' تومان'; }
function security_client_ip(): string { return trim((string)($_SERVER['REMOTE_ADDR'] ?? 'unknown')) ?: 'unknown'; }
function security_rate_limit(string $bucket, string $identity, int $maxHits, int $windowSeconds, int $blockSeconds=0): array {
    if (!table_exists('rate_limits')) return ['allowed'=>true,'retry_after'=>0];
    $maxHits=max(1,$maxHits);$windowSeconds=max(1,$windowSeconds);$blockSeconds=max(0,$blockSeconds);
    $key=hash('sha256',$bucket.'|'.$identity);$pdo=db();$own=!$pdo->inTransaction();if($own)$pdo->beginTransaction();
    try{
        $q=$pdo->prepare('SELECT * FROM rate_limits WHERE rate_key=? FOR UPDATE');$q->execute([$key]);$r=$q->fetch();$now=time();
        if($r && !empty($r['blocked_until']) && strtotime($r['blocked_until'])>$now){$retry=max(1,strtotime($r['blocked_until'])-$now);if($own)$pdo->commit();return ['allowed'=>false,'retry_after'=>$retry];}
        $start=$r?strtotime((string)$r['window_started_at']):0;$hits=(int)($r['hits']??0);
        if(!$r || !$start || $start+$windowSeconds<=$now){$hits=1;$start=$now;$blocked=null;}
        else{$hits++;$blocked=($hits>$maxHits && $blockSeconds>0)?date('Y-m-d H:i:s',$now+$blockSeconds):null;}
        if(!$r)$pdo->prepare('INSERT INTO rate_limits (rate_key,bucket,hits,window_started_at,blocked_until) VALUES (?,?,?,?,?)')->execute([$key,$bucket,$hits,date('Y-m-d H:i:s',$start),$blocked]);
        else $pdo->prepare('UPDATE rate_limits SET bucket=?,hits=?,window_started_at=?,blocked_until=? WHERE rate_key=?')->execute([$bucket,$hits,date('Y-m-d H:i:s',$start),$blocked,$key]);
        $allowed=$hits<=$maxHits && !$blocked;$retry=$allowed?0:max(1,($blocked?strtotime($blocked):($start+$windowSeconds))-$now);if($own)$pdo->commit();return ['allowed'=>$allowed,'retry_after'=>$retry];
    }catch(Throwable $e){if($own&&$pdo->inTransaction())$pdo->rollBack();error_log('[Security RateLimit] '.$e->getMessage());return ['allowed'=>true,'retry_after'=>0];}
}
function security_rate_limit_clear(string $bucket,string $identity): void { if(!table_exists('rate_limits'))return;try{db()->prepare('DELETE FROM rate_limits WHERE rate_key=?')->execute([hash('sha256',$bucket.'|'.$identity)]);}catch(Throwable $e){} }
function user_is_blocked(array $u): bool { return !empty($u['is_banned']) || !empty($u['deleted_at']); }
function is_full_admin($userOrId): bool {
    $id=is_array($userOrId)?(int)($userOrId['telegram_id']??0):(int)$userOrId;if($id<=0)return false;
    if(in_array($id,array_map('intval',app_config('ADMIN_IDS',[])),true))return true;
    if(table_exists('admin_roles')){try{$q=db()->prepare('SELECT role FROM admin_roles WHERE telegram_id=? LIMIT 1');$q->execute([$id]);$r=$q->fetch();return $r&&($r['role']??'none')==='full';}catch(Throwable $e){}}
    return false;
}
function is_admin($userOrId): bool {
    $id=is_array($userOrId)?(int)($userOrId['telegram_id']??0):(int)$userOrId;
    if($id<=0)return false;
    $admins=array_map('intval',app_config('ADMIN_IDS',[]));
    if(in_array($id,$admins,true))return true;
    if(table_exists('admin_roles')){try{$q=db()->prepare('SELECT role FROM admin_roles WHERE telegram_id=? LIMIT 1');$q->execute([$id]);$r=$q->fetch();return $r && ($r['role']??'none')!=='none';}catch(Throwable $e){}}
    return false;
}
function display_name(array $u): string {
    if (!empty($u['username'])) return '@' . $u['username'];
    if (!empty($u['first_name'])) return h($u['first_name']);
    return '<code>' . h($u['telegram_id'] ?? '') . '</code>';
}
function normalize_ref_code(string $code): string {
    $code = trim($code);
    $code = preg_replace('/[^A-Za-z0-9_]/', '', $code);
    return strtolower($code);
}
function random_ref(): string {
    do {
        $code = strtolower(substr(bin2hex(random_bytes(5)), 0, 8));
        $q = db()->prepare('SELECT id FROM users WHERE ref_code=?');
        $q->execute([$code]);
    } while ($q->fetch());
    return $code;
}
function get_user_by_tid($telegram_id) {
    $q = db()->prepare('SELECT * FROM users WHERE telegram_id=?');
    $q->execute([(int)$telegram_id]);
    return $q->fetch();
}
function get_user_by_id($id) {
    $q = db()->prepare('SELECT * FROM users WHERE id=?');
    $q->execute([(int)$id]);
    return $q->fetch();
}
function get_user_by_ref($code) {
    $code = normalize_ref_code((string)$code);
    if ($code === '') return false;
    $q = db()->prepare('SELECT * FROM users WHERE LOWER(ref_code)=?');
    $q->execute([$code]);
    return $q->fetch();
}
function generate_auth_token(): string { return bin2hex(random_bytes(32)); }
function auth_token_hash(string $token): string { return hash('sha256',$token); }
function get_user_by_token(?string $token): array|false {
    if (empty($token) || strlen($token) < 32) return false;
    $hash=auth_token_hash($token);
    $q=db()->prepare('SELECT * FROM users WHERE auth_token_hash=? AND auth_token_expires_at>NOW() AND is_banned=0 AND deleted_at IS NULL');
    $q->execute([$hash]);return $q->fetch()?:false;
}
function get_user_by_web_username(string $username): array|false {
    $username = strtolower(trim($username));
    if ($username === '') return false;
    $q = db()->prepare('SELECT * FROM users WHERE LOWER(web_username)=? OR (username IS NOT NULL AND LOWER(username)=?)');
    $q->execute([$username, $username]);
    return $q->fetch() ?: false;
}
function get_user_by_email(string $email): array|false {
    $clean = strtolower(trim($email));
    if ($clean === '') return false;
    $q = db()->prepare('SELECT * FROM users WHERE LOWER(email)=?');
    $q->execute([$clean]);
    return $q->fetch() ?: false;
}
function get_user_by_email_or_username(string $identifier): array|false {
    $clean = strtolower(trim($identifier));
    if ($clean === '') return false;
    $q = db()->prepare('SELECT * FROM users WHERE (email IS NOT NULL AND LOWER(email)=?) OR (web_username IS NOT NULL AND LOWER(web_username)=?) OR (username IS NOT NULL AND LOWER(username)=?)');
    $q->execute([$clean, $clean, $clean]);
    return $q->fetch() ?: false;
}
function issue_user_auth_token(int $userId): string {
    $token=generate_auth_token();$ttl=max(1,setting_int('auth_token_ttl_hours',168));$exp=date('Y-m-d H:i:s',time()+$ttl*3600);
    db()->prepare('UPDATE users SET auth_token=NULL,auth_token_hash=?,auth_token_expires_at=? WHERE id=? AND is_banned=0 AND deleted_at IS NULL')->execute([auth_token_hash($token),$exp,$userId]);
    return $token;
}
function revoke_user_auth_token(int $userId): void { db()->prepare('UPDATE users SET auth_token=NULL,auth_token_hash=NULL,auth_token_expires_at=NULL WHERE id=?')->execute([$userId]); }
function verify_telegram_login_widget(array $authData): array|false {
    $token = app_config('BOT_TOKEN');
    if (empty($authData['hash']) || empty($authData['id']) || empty($authData['auth_date'])) return false;
    if (time() - (int)$authData['auth_date'] > 86400) return false;
    $hash = $authData['hash'];
    unset($authData['hash']);
    ksort($authData);
    $dataCheckArr = [];
    foreach ($authData as $key => $val) {
        $dataCheckArr[] = $key . '=' . $val;
    }
    $dataCheckString = implode("\n", $dataCheckArr);
    $secretKey = hash('sha256', $token, true);
    $calculatedHash = hash_hmac('sha256', $dataCheckString, $secretKey);
    if (!hash_equals($calculatedHash, $hash)) return false;
    return $authData;
}
function create_web_user(string $username, string $password, ?string $firstName = null, ?string $refCode = null, ?string $email = null): array {
    $cleanUsername = strtolower(trim($username));
    $cleanEmail = !empty($email) ? strtolower(trim($email)) : null;
    $hash = password_hash($password, PASSWORD_DEFAULT);
    
    $requireVerif = setting_bool('require_email_verification', true) && !empty($cleanEmail);
    $token = null;
    $firstName = trim($firstName ?: $cleanUsername);
    
    $referrerId = null;
    if ($refCode) {
        $referrer = get_user_by_ref($refCode);
        if ($referrer) $referrerId = (int)$referrer['id'];
    }
    
    $newRefCode = random_ref();
    $stmt = db()->prepare('INSERT INTO users (telegram_id, web_username, username, email, password_hash, auth_token, first_name, ref_code, referrer_id) VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([$cleanUsername, $cleanUsername, $cleanEmail, $hash, $token, $firstName, $newRefCode, $referrerId]);
    $userId = (int)db()->lastInsertId();
    
    $syntheticTid = 9000000000 + $userId;
    db()->prepare('UPDATE users SET telegram_id=? WHERE id=?')->execute([$syntheticTid, $userId]);
    
    $user = get_user_by_id($userId);
    if ($referrerId) {
        try_reward_referrer($user);
    }
    notify_new_user_signup($user, '🌐 وب‌سایت');
    return $user;
}

function send_email_via_resend(string $to, string $subject, string $htmlContent): array {
    $apiKey = setting('resend_api_key', app_config('RESEND_API_KEY', ''));
    $fromEmail = setting('resend_from_email', app_config('RESEND_FROM_EMAIL', 'onboarding@resend.dev'));
    
    if (empty($apiKey)) {
        return ['ok' => false, 'error' => 'NO_API_KEY', 'message' => 'کلید Resend API تنظیم نشده است. لطفاً کلید API را در پنل ادمین یا تنظیمات وارد کنید.'];
    }
    
    $payload = json_encode([
        'from' => $fromEmail,
        'to' => [$to],
        'subject' => $subject,
        'html' => $htmlContent
    ], JSON_UNESCAPED_UNICODE);
    
    $ch = curl_init('https://api.resend.com/emails');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $apiKey,
            'Content-Type: application/json'
        ],
        CURLOPT_TIMEOUT => 10
    ]);
    
    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    
    if ($err) {
        error_log("Resend cURL Error: " . $err);
        return ['ok' => false, 'error' => 'CURL_ERROR', 'message' => $err];
    }
    
    $json = json_decode($resp, true);
    if ($code >= 200 && $code < 300) {
        return ['ok' => true, 'id' => $json['id'] ?? null];
    }
    
    $msg = is_array($json) && !empty($json['message']) ? $json['message'] : (string)$resp;
    error_log("Resend API Error [HTTP {$code}]: " . $msg);
    return ['ok' => false, 'error' => 'RESEND_ERROR', 'message' => $msg];
}

function send_email_otp(array $user): array {
    if (empty($user['email'])) {
        return ['ok' => false, 'error' => 'NO_EMAIL', 'message' => 'آدرس ایمیل وارد نشده است.'];
    }
    
    $otp = (string)random_int(100000, 999999);
    $expiresAt = date('Y-m-d H:i:s', time() + 900);
    
    db()->prepare('UPDATE users SET email_verification_token=?, email_verification_expires_at=? WHERE id=?')
        ->execute([password_hash($otp, PASSWORD_DEFAULT), $expiresAt, (int)$user['id']]);
        
    $brand = setting('brand_name', app_config('BRAND_NAME', 'BlueGate'));
    $subject = "کد تایید حساب کاربری {$brand}";
    
    $html = '
    <div style="font-family: Tahoma, Arial, sans-serif; direction: rtl; text-align: right; background-color: #08111f; color: #ffffff; padding: 30px; border-radius: 16px; max-width: 500px; margin: 0 auto; border: 1px solid #1d9bf044;">
        <h2 style="color: #1d9bf0; margin-bottom: 20px;">' . htmlspecialchars($brand) . '</h2>
        <p style="font-size: 16px; margin-bottom: 10px;">سلام ' . htmlspecialchars($user['first_name'] ?: $user['username'] ?: 'کاربر گرامی') . ' 👋</p>
        <p style="font-size: 14px; color: #9fb0c8; line-height: 1.6;">برای تایید آدرس ایمیل خود در سامانه، کد ۶ رقمی زیر را وارد کنید:</p>
        <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 34px; font-weight: 900; letter-spacing: 8px; color: #1d9bf0; background: #ffffff10; padding: 12px 24px; border-radius: 14px; border: 1px solid #1d9bf055; display: inline-block;">' . $otp . '</span>
        </div>
        <p style="font-size: 12px; color: #9fb0c8; border-top: 1px solid #ffffff10; padding-top: 15px;">این کد تا ۱۵ دقیقه معتبر است. اگر شما این درخواست را نداده‌اید، نیازی به انجام کاری نیست.</p>
    </div>
    ';
    
    return send_email_via_resend($user['email'], $subject, $html);
}

function verify_email_otp(int $userId, string $otp): bool {
    $user = get_user_by_id($userId);
    if (!$user || empty($user['email_verification_token'])) return false;
    
    if (!password_verify(trim((string)$otp), (string)$user['email_verification_token'])) return false;
    
    if (!empty($user['email_verification_expires_at']) && strtotime($user['email_verification_expires_at']) < time()) {
        return false;
    }
    
    db()->prepare('UPDATE users SET email_verified_at=NOW(), email_verification_token=NULL, email_verification_expires_at=NULL WHERE id=?')
        ->execute([$userId]);
        
    return true;
}

function mask_email_address(string $email): string {
    $email=trim($email);if($email==='')return '';
    [$local,$domain]=array_pad(explode('@',$email,2),2,'');
    if($domain==='')return $email;
    $shown=mb_substr($local,0,min(2,max(1,mb_strlen($local))));
    return $shown.str_repeat('•',max(3,min(8,mb_strlen($local)-mb_strlen($shown)))).'@'.$domain;
}

function send_email_change_otp(array $user,string $targetEmail,string $otp,string $phase): array {
    $brand=setting('brand_name',app_config('BRAND_NAME','BlueGate'));
    $isOld=$phase==='old';
    $subject=$isOld?"تایید تغییر ایمیل {$brand}":"تایید ایمیل جدید {$brand}";
    $title=$isOld?'تایید مالکیت ایمیل فعلی':'تایید ایمیل جدید';
    $body=$isOld?'برای شروع تغییر ایمیل حساب، ابتدا مالکیت ایمیل فعلی را تایید کنید.':'برای ثبت ایمیل جدید روی حساب BlueGate، کد زیر را وارد کنید.';
    $html='<div style="font-family:Tahoma,Arial,sans-serif;direction:rtl;text-align:right;background:#08111f;color:#fff;padding:30px;border-radius:16px;max-width:500px;margin:0 auto;border:1px solid #1d9bf044">'
        .'<h2 style="color:#1d9bf0;margin:0 0 18px">'.htmlspecialchars($brand).'</h2>'
        .'<h3 style="margin:0 0 10px">'.htmlspecialchars($title).'</h3>'
        .'<p style="font-size:15px;color:#b8c7da;line-height:1.8">'.htmlspecialchars($body).'</p>'
        .'<div style="text-align:center;margin:28px 0"><span style="font-size:34px;font-weight:900;letter-spacing:8px;color:#52c9ff;background:#ffffff10;padding:12px 24px;border-radius:14px;border:1px solid #52c9ff55;display:inline-block">'.htmlspecialchars($otp).'</span></div>'
        .'<p style="font-size:13px;color:#8fa2bb;border-top:1px solid #ffffff10;padding-top:15px">این کد ۱۵ دقیقه معتبر است. اگر این درخواست از طرف شما نبوده، کد را در اختیار هیچ‌کس قرار ندهید.</p></div>';
    return send_email_via_resend($targetEmail,$subject,$html);
}

function email_change_request(int $userId): ?array {
    $q=db()->prepare('SELECT * FROM email_change_requests WHERE user_id=? LIMIT 1');$q->execute([$userId]);$r=$q->fetch();return $r?:null;
}

function email_change_begin(array $user): array {
    $uid=(int)$user['id'];$old=strtolower(trim((string)($user['email']??'')));
    if($old===''){
        db()->prepare('INSERT INTO email_change_requests (user_id,old_email,old_verified_at,created_at) VALUES (?,NULL,NOW(),NOW()) ON DUPLICATE KEY UPDATE old_email=NULL,pending_email=NULL,old_otp_hash=NULL,old_otp_expires_at=NULL,old_verified_at=NOW(),new_otp_hash=NULL,new_otp_expires_at=NULL,created_at=NOW()')->execute([$uid]);
        return ['ok'=>true,'step'=>'new_email','has_current_email'=>false,'message'=>'برای این حساب هنوز ایمیلی ثبت نشده است. ایمیل جدید را وارد کنید.'];
    }
    $otp=(string)random_int(100000,999999);$send=send_email_change_otp($user,$old,$otp,'old');
    if(empty($send['ok']))return $send;
    $expires=date('Y-m-d H:i:s',time()+900);
    db()->prepare('INSERT INTO email_change_requests (user_id,old_email,old_otp_hash,old_otp_expires_at,old_verified_at,pending_email,new_otp_hash,new_otp_expires_at,created_at) VALUES (?,?,?,?,NULL,NULL,NULL,NULL,NOW()) ON DUPLICATE KEY UPDATE old_email=VALUES(old_email),old_otp_hash=VALUES(old_otp_hash),old_otp_expires_at=VALUES(old_otp_expires_at),old_verified_at=NULL,pending_email=NULL,new_otp_hash=NULL,new_otp_expires_at=NULL,created_at=NOW()')->execute([$uid,$old,password_hash($otp,PASSWORD_DEFAULT),$expires]);
    return ['ok'=>true,'step'=>'current_otp','has_current_email'=>true,'masked_email'=>mask_email_address($old),'message'=>'کد تایید به ایمیل فعلی ارسال شد.'];
}

function email_change_verify_current(array $user,string $otp): bool {
    $r=email_change_request((int)$user['id']);$current=strtolower(trim((string)($user['email']??'')));
    if(!$r||$current===''||strtolower((string)($r['old_email']??''))!==$current||empty($r['old_otp_hash']))return false;
    if(!empty($r['old_otp_expires_at'])&&strtotime((string)$r['old_otp_expires_at'])<time())return false;
    if(!password_verify(trim($otp),(string)$r['old_otp_hash']))return false;
    db()->prepare('UPDATE email_change_requests SET old_verified_at=NOW(),old_otp_hash=NULL,old_otp_expires_at=NULL WHERE user_id=?')->execute([(int)$user['id']]);
    return true;
}

function email_change_send_new(array $user,string $newEmail): array {
    $uid=(int)$user['id'];$newEmail=strtolower(trim($newEmail));$old=strtolower(trim((string)($user['email']??'')));
    if(!filter_var($newEmail,FILTER_VALIDATE_EMAIL))return ['ok'=>false,'error'=>'INVALID_EMAIL','message'=>'ایمیل جدید معتبر نیست.'];
    if($newEmail===$old)return ['ok'=>false,'error'=>'SAME_EMAIL','message'=>'ایمیل جدید با ایمیل فعلی یکسان است.'];
    $q=db()->prepare('SELECT id FROM users WHERE LOWER(email)=? AND id<>? LIMIT 1');$q->execute([$newEmail,$uid]);if($q->fetch())return ['ok'=>false,'error'=>'EMAIL_TAKEN','message'=>'این ایمیل روی حساب دیگری ثبت شده است.'];
    $r=email_change_request($uid);
    if($old!==''){
        if(!$r||strtolower((string)($r['old_email']??''))!==$old||empty($r['old_verified_at'])||strtotime((string)$r['old_verified_at'])<time()-900)return ['ok'=>false,'error'=>'CURRENT_EMAIL_NOT_VERIFIED','message'=>'ابتدا ایمیل فعلی را با کد تایید کنید.'];
    }elseif(!$r){
        db()->prepare('INSERT INTO email_change_requests (user_id,old_email,old_verified_at,created_at) VALUES (?,NULL,NOW(),NOW())')->execute([$uid]);
    }
    $otp=(string)random_int(100000,999999);$send=send_email_change_otp($user,$newEmail,$otp,'new');if(empty($send['ok']))return $send;
    $expires=date('Y-m-d H:i:s',time()+900);
    db()->prepare('UPDATE email_change_requests SET pending_email=?,new_otp_hash=?,new_otp_expires_at=? WHERE user_id=?')->execute([$newEmail,password_hash($otp,PASSWORD_DEFAULT),$expires,$uid]);
    return ['ok'=>true,'step'=>'new_otp','masked_email'=>mask_email_address($newEmail),'message'=>'کد تایید به ایمیل جدید ارسال شد.'];
}

function email_change_resend_new(array $user): array {
    $r=email_change_request((int)$user['id']);$pending=strtolower(trim((string)($r['pending_email']??'')));if($pending==='')return ['ok'=>false,'error'=>'NO_PENDING_EMAIL','message'=>'ابتدا ایمیل جدید را وارد کنید.'];
    return email_change_send_new($user,$pending);
}

function email_change_verify_new(array $user,string $otp): array {
    $uid=(int)$user['id'];$pdo=db();$pdo->beginTransaction();
    try{
        $q=$pdo->prepare('SELECT * FROM email_change_requests WHERE user_id=? FOR UPDATE');$q->execute([$uid]);$r=$q->fetch();
        if(!$r||empty($r['pending_email'])||empty($r['new_otp_hash']))throw new RuntimeException('OTP_VERIFICATION_FAILED');
        if(!empty($r['new_otp_expires_at'])&&strtotime((string)$r['new_otp_expires_at'])<time())throw new RuntimeException('OTP_VERIFICATION_FAILED');
        if(!password_verify(trim($otp),(string)$r['new_otp_hash']))throw new RuntimeException('OTP_VERIFICATION_FAILED');
        $pending=strtolower(trim((string)$r['pending_email']));$old=strtolower(trim((string)($user['email']??'')));
        if($old!==''&&(empty($r['old_verified_at'])||strtolower((string)($r['old_email']??''))!==$old||strtotime((string)$r['old_verified_at'])<time()-900))throw new RuntimeException('CURRENT_EMAIL_NOT_VERIFIED');
        $dupe=$pdo->prepare('SELECT id FROM users WHERE LOWER(email)=? AND id<>? LIMIT 1 FOR UPDATE');$dupe->execute([$pending,$uid]);if($dupe->fetch())throw new RuntimeException('EMAIL_TAKEN');
        $pdo->prepare('UPDATE users SET email=?,email_verified_at=NOW(),email_verification_token=NULL,email_verification_expires_at=NULL WHERE id=?')->execute([$pending,$uid]);
        $pdo->prepare('DELETE FROM email_change_requests WHERE user_id=?')->execute([$uid]);$pdo->commit();
        if($old!==''&&$old!==$pending){
            $brand=setting('brand_name',app_config('BRAND_NAME','BlueGate'));$html='<div style="font-family:Tahoma,Arial,sans-serif;direction:rtl;background:#08111f;color:#fff;padding:26px;border-radius:16px"><h2 style="color:#1d9bf0">'.htmlspecialchars($brand).'</h2><p style="line-height:1.9">ایمیل حساب شما با موفقیت به <b>'.htmlspecialchars(mask_email_address($pending)).'</b> تغییر کرد. اگر این تغییر توسط شما انجام نشده، فوراً با پشتیبانی تماس بگیرید.</p></div>';try{send_email_via_resend($old,"اعلان تغییر ایمیل {$brand}",$html);}catch(Throwable $e){}
        }
        return get_user_by_id($uid)?:$user;
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}

function send_password_reset_otp(array $user): array {
    if (empty($user['email'])) {
        return ['ok' => false, 'error' => 'NO_EMAIL', 'message' => 'آدرس ایمیل برای این حساب ثبت نشده است.'];
    }
    
    $otp = (string)random_int(100000, 999999);
    $expiresAt = date('Y-m-d H:i:s', time() + 900);
    
    db()->prepare('UPDATE users SET email_verification_token=?, email_verification_expires_at=? WHERE id=?')
        ->execute([password_hash($otp, PASSWORD_DEFAULT), $expiresAt, (int)$user['id']]);
        
    $brand = setting('brand_name', app_config('BRAND_NAME', 'BlueGate'));
    $subject = "کد بازیابی رمز عبور {$brand}";
    
    $html = '
    <div style="font-family: Tahoma, Arial, sans-serif; direction: rtl; text-align: right; background-color: #08111f; color: #ffffff; padding: 30px; border-radius: 16px; max-width: 500px; margin: 0 auto; border: 1px solid #1d9bf044;">
        <h2 style="color: #1d9bf0; margin-bottom: 20px;">' . htmlspecialchars($brand) . '</h2>
        <p style="font-size: 16px; margin-bottom: 10px;">سلام ' . htmlspecialchars($user['first_name'] ?: $user['web_username'] ?: 'کاربر گرامی') . ' 👋</p>
        <p style="font-size: 14px; color: #9fb0c8; line-height: 1.6;">درخواست بازیابی رمز عبور ثبت شده است. کد ۶ رقمی زیر را وارد کنید:</p>
        <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 34px; font-weight: 900; letter-spacing: 8px; color: #f59e0b; background: #ffffff10; padding: 12px 24px; border-radius: 14px; border: 1px solid #f59e0b55; display: inline-block;">' . $otp . '</span>
        </div>
        <p style="font-size: 12px; color: #9fb0c8; border-top: 1px solid #ffffff10; padding-top: 15px;">این کد تا ۱۵ دقیقه معتبر است. اگر شما این درخواست را نداده‌اید، رمز عبور شما تغییر نخواهد کرد.</p>
    </div>
    ';
    
    return send_email_via_resend($user['email'], $subject, $html);
}

function reset_password_with_otp(int $userId, string $otp, string $newPassword): bool {
    $user = get_user_by_id($userId);
    if (!$user || empty($user['email_verification_token'])) return false;
    
    if (!password_verify(trim((string)$otp), (string)$user['email_verification_token'])) return false;
    if (!empty($user['email_verification_expires_at']) && strtotime($user['email_verification_expires_at']) < time()) return false;
    
    $hash = password_hash($newPassword, PASSWORD_BCRYPT);
    db()->prepare('UPDATE users SET password_hash=?, email_verified_at=COALESCE(email_verified_at, NOW()), email_verification_token=NULL, email_verification_expires_at=NULL, auth_token=NULL, auth_token_hash=NULL, auth_token_expires_at=NULL WHERE id=?')
        ->execute([$hash, $userId]);
        
    return true;
}

function delete_user_account(int $userId): bool {
    $user = get_user_by_id($userId);
    if (!$user) return false;
    db()->prepare('DELETE FROM email_change_requests WHERE user_id=?')->execute([$userId]);
    db()->prepare('UPDATE users SET email=NULL,web_username=NULL,password_hash=NULL,auth_token=NULL,auth_token_hash=NULL,auth_token_expires_at=NULL,phone_number=NULL,phone_verified_at=NULL,email_verification_token=NULL,email_verification_expires_at=NULL,first_name="حساب حذف شده",last_name="",username=NULL,balance=0 WHERE id=?')->execute([$userId]);
    return true;
}

function admin_update_user_profile(int $userId, array $data): bool {
    $user = get_user_by_id($userId);
    if (!$user) return false;
    
    $fields = [];
    $params = [];
    
    if (isset($data['first_name'])) { $fields[] = 'first_name=?'; $params[] = trim((string)$data['first_name']); }
    if (isset($data['last_name'])) { $fields[] = 'last_name=?'; $params[] = trim((string)$data['last_name']); }
    if (array_key_exists('email', $data)) { $fields[] = 'email=?'; $params[] = !empty($data['email']) ? strtolower(trim((string)$data['email'])) : null; }
    if (array_key_exists('phone', $data)) { $fields[] = 'phone_number=?'; $params[] = !empty($data['phone']) ? trim((string)$data['phone']) : null; }
    if (array_key_exists('web_username', $data)) { $fields[] = 'web_username=?'; $params[] = !empty($data['web_username']) ? strtolower(trim((string)$data['web_username'])) : null; }
    if (isset($data['balance'])) { $fields[] = 'balance=?'; $params[] = (float)$data['balance']; }
    
    if (empty($fields)) return true;
    
    $params[] = $userId;
    $sql = 'UPDATE users SET ' . implode(', ', $fields) . ' WHERE id=?';
    db()->prepare($sql)->execute($params);
    return true;
}
function create_or_update_user(array $from, ?string $ref = null) {
    $tid = (int)$from['id'];
    $user = get_user_by_tid($tid);
    if ($user) {
        db()->prepare('UPDATE users SET username=?, first_name=?, last_name=? WHERE telegram_id=?')
            ->execute([$from['username'] ?? null, $from['first_name'] ?? null, $from['last_name'] ?? null, $tid]);
        return get_user_by_tid($tid);
    }
    $referrerId = null;
    if ($ref) {
        $referrer = get_user_by_ref($ref);
        if ($referrer && (int)$referrer['telegram_id'] !== $tid) $referrerId = (int)$referrer['id'];
    }
    db()->prepare('INSERT INTO users (telegram_id, username, first_name, last_name, ref_code, referrer_id) VALUES (?,?,?,?,?,?)')
        ->execute([$tid, $from['username'] ?? null, $from['first_name'] ?? null, $from['last_name'] ?? null, random_ref(), $referrerId]);
    
    $newUser = get_user_by_tid($tid);
    if ($newUser) {
        notify_new_user_signup($newUser, '📱 Mini App / تلگرام');
    }
    return $newUser;
}
function set_step($telegram_id, ?string $step, ?string $payload = null): void {
    db()->prepare('UPDATE users SET step=?, step_payload=? WHERE telegram_id=?')->execute([$step, $payload, (int)$telegram_id]);
}
function clear_step($telegram_id): void { set_step($telegram_id, null, null); }
function add_balance($user_id, $amount, string $type, string $desc='', $related_user_id=null): void {
    $amount = (int)$amount;
    db()->prepare('UPDATE users SET balance=balance+?, total_earned=total_earned+GREATEST(?,0) WHERE id=?')->execute([$amount, $amount, $user_id]);
    db()->prepare('INSERT INTO transactions (user_id,type,amount,description,related_user_id) VALUES (?,?,?,?,?)')->execute([$user_id, $type, $amount, $desc, $related_user_id]);
}
function referral_link(array $user): string {
    $bot = app_config('BOT_USERNAME', '');
    return "https://t.me/{$bot}?start=ref_{$user['ref_code']}";
}
function vip_info(int $referrals): array {
    $rates = setting_json('vip_tier_rates', [
        'bronze'  => ['name'=>'Bronze',  'fa'=>'برنز',    'emoji'=>'🥉', 'min_ref'=>0,   'multiplier'=>1.00],
        'silver'  => ['name'=>'Silver',  'fa'=>'سیلور',  'emoji'=>'🥈', 'min_ref'=>10,  'multiplier'=>1.10],
        'gold'    => ['name'=>'Gold',    'fa'=>'گلد',    'emoji'=>'🥇', 'min_ref'=>50,  'multiplier'=>1.25],
        'diamond' => ['name'=>'Diamond', 'fa'=>'دایموند', 'emoji'=>'💎', 'min_ref'=>100, 'multiplier'=>1.50],
    ]);
    $d = $rates['diamond'] ?? ['name'=>'Diamond', 'fa'=>'دایموند', 'emoji'=>'💎', 'min_ref'=>100, 'multiplier'=>1.50];
    $g = $rates['gold'] ?? ['name'=>'Gold', 'fa'=>'گلد', 'emoji'=>'🥇', 'min_ref'=>50, 'multiplier'=>1.25];
    $s = $rates['silver'] ?? ['name'=>'Silver', 'fa'=>'سیلور', 'emoji'=>'🥈', 'min_ref'=>10, 'multiplier'=>1.10];
    $b = $rates['bronze'] ?? ['name'=>'Bronze', 'fa'=>'برنز', 'emoji'=>'🥉', 'min_ref'=>0, 'multiplier'=>1.00];

    if ($referrals >= (int)($d['min_ref'] ?? 100)) return ['name'=>$d['name']??'Diamond', 'fa'=>$d['fa']??'دایموند', 'emoji'=>$d['emoji']??'💎', 'min_ref'=>(int)($d['min_ref']??100), 'next'=>null, 'next_name'=>null, 'next_fa'=>null, 'next_emoji'=>null, 'multiplier'=>(float)($d['multiplier']??1.5)];
    if ($referrals >= (int)($g['min_ref'] ?? 50))  return ['name'=>$g['name']??'Gold', 'fa'=>$g['fa']??'گلد', 'emoji'=>$g['emoji']??'🥇', 'min_ref'=>(int)($g['min_ref']??50), 'next'=>(int)($d['min_ref']??100), 'next_name'=>$d['name']??'Diamond', 'next_fa'=>$d['fa']??'دایموند', 'next_emoji'=>$d['emoji']??'💎', 'multiplier'=>(float)($g['multiplier']??1.25)];
    if ($referrals >= (int)($s['min_ref'] ?? 10))  return ['name'=>$s['name']??'Silver', 'fa'=>$s['fa']??'سیلور', 'emoji'=>$s['emoji']??'🥈', 'min_ref'=>(int)($s['min_ref']??10), 'next'=>(int)($g['min_ref']??50), 'next_name'=>$g['name']??'Gold', 'next_fa'=>$g['fa']??'گلد', 'next_emoji'=>$g['emoji']??'🥇', 'multiplier'=>(float)($s['multiplier']??1.1)];
    return ['name'=>$b['name']??'Bronze', 'fa'=>$b['fa']??'برنز', 'emoji'=>$b['emoji']??'🥉', 'min_ref'=>(int)($b['min_ref']??0), 'next'=>(int)($s['min_ref']??10), 'next_name'=>$s['name']??'Silver', 'next_fa'=>$s['fa']??'سیلور', 'next_emoji'=>$s['emoji']??'🥈', 'multiplier'=>(float)($b['multiplier']??1.0)];
}
function vip_line(array $user): string {
    $vip = vip_info((int)$user['referrals_count']);
    $line = "{$vip['emoji']} سطح: <b>{$vip['fa']}</b> | ضریب خرید: <b>×{$vip['multiplier']}</b>";
    if ($vip['next']) {
        $left = max(0, $vip['next'] - (int)$user['referrals_count']);
        $line .= "\nبرای سطح بعدی: <b>{$left}</b> دعوت دیگر";
    } else {
        $line .= "\nشما بالاترین سطح همکاری را دارید 🔥";
    }
    return $line;
}
function today_referrals(int $user_id): int {
    $today = date('Y-m-d');
    $q = db()->prepare('SELECT COUNT(*) c FROM referrals WHERE referrer_id=? AND DATE(created_at)=?');
    $q->execute([$user_id, $today]);
    return (int)($q->fetch()['c'] ?? 0);
}
function mission_rows(): array {
    return [
        ['target'=>setting_int('mission_1_target', 1), 'reward'=>setting_int('mission_1_reward', 3000)],
        ['target'=>setting_int('mission_2_target', 3), 'reward'=>setting_int('mission_2_reward', 10000)],
        ['target'=>setting_int('mission_3_target', 5), 'reward'=>setting_int('mission_3_reward', 25000)],
    ];
}
function is_mission_claimed(int $user_id, string $date, int $target): bool {
    $q = db()->prepare('SELECT id FROM mission_claims WHERE user_id=? AND mission_date=? AND target_count=?');
    $q->execute([$user_id, $date, $target]);
    return (bool)$q->fetch();
}
function claim_available_missions(array $user): array {
    $todayCount = today_referrals((int)$user['id']);
    $date = date('Y-m-d');
    $claimed = [];
    foreach (mission_rows() as $m) {
        $target = (int)$m['target']; $reward = (int)$m['reward'];
        if ($target <= 0 || $reward <= 0 || $todayCount < $target) continue;
        if (is_mission_claimed((int)$user['id'], $date, $target)) continue;
        $q=db()->prepare('INSERT IGNORE INTO mission_claims (user_id, mission_date, target_count, reward_amount) VALUES (?,?,?,?)');$q->execute([$user['id'],$date,$target,$reward]);
        if($q->rowCount()===1){add_balance($user['id'],$reward,'mission_reward',"پاداش مأموریت روزانه {$target} دعوت",null);$claimed[]=$m;}
    }
    return [$todayCount, $claimed];
}
function top_users(int $limit=10): array {
    $q = db()->prepare('SELECT * FROM users WHERE referrals_count>0 ORDER BY referrals_count DESC, total_earned DESC LIMIT ?');
    $q->bindValue(1, $limit, PDO::PARAM_INT);
    $q->execute();
    return $q->fetchAll();
}
function weighted_spin_reward(): array {
    $rewards = setting_json('spin_rewards', app_config('SPIN_REWARDS', []));
    if (!$rewards) return ['title'=>'💰 ۵,۰۰۰ تومان اعتبار کیف پول', 'amount'=>5000, 'weight'=>1];
    $sum = 0;
    foreach ($rewards as $r) $sum += max(1, (int)($r['weight'] ?? 1));
    $pick = random_int(1, max(1, $sum));
    $cursor = 0;
    foreach ($rewards as $r) {
        $cursor += max(1, (int)($r['weight'] ?? 1));
        if ($pick <= $cursor) return $r;
    }
    return $rewards[0];
}
function is_joined_channel(int $telegram_id): bool {
    if ($telegram_id <= 0 || $telegram_id > 8000000000) return true;
    $channel = app_config('FORCE_JOIN_CHANNEL', '');
    if (empty($channel)) return true;
    $res = tg('getChatMember', ['chat_id'=>$channel, 'user_id'=>$telegram_id]);
    if (empty($res['ok'])) return false;
    $status = $res['result']['status'] ?? 'left';
    return !in_array($status, ['left', 'kicked'], true);
}
function notify_admins(string $text): void {
    $ids=array_map('intval',app_config('ADMIN_IDS',[]));
    if(table_exists('admin_roles')){try{$dbAdmins=db()->query("SELECT telegram_id FROM admin_roles WHERE role<>'none' AND telegram_id>0 AND telegram_id<9000000000")->fetchAll(PDO::FETCH_COLUMN);foreach($dbAdmins as $aid){$aid=(int)$aid;if($aid>0&&!in_array($aid,$ids,true))$ids[]=$aid;}}catch(Throwable $e){error_log('[Notify Admin lookup] '.$e->getMessage());}}
    foreach ($ids as $aid) {
        if ($aid > 0) {
            try {
                send_msg($aid, $text);
            } catch (Throwable $e) {
                error_log('[Notify Admin Error] ' . $e->getMessage());
            }
        }
    }
}
function notify_new_user_signup(array $user, string $sourceStr = '🌐 وب‌سایت'): void {
    
    $uid = (int)($user['id'] ?? 0);
    $uname = !empty($user['username']) ? '@' . h($user['username']) : (!empty($user['web_username']) ? h($user['web_username']) : 'ثبت نشده');
    $name = trim(h(($user['first_name'] ?? '') . ' ' . ($user['last_name'] ?? '')));
    if ($name === '') $name = 'مشتری بدون نام';
    
    $email = !empty($user['email']) ? h($user['email']) : 'ثبت نشده';
    $tgId = !empty($user['telegram_id']) && (int)$user['telegram_id'] < 9000000000 ? "<code>{$user['telegram_id']}</code>" : 'کاربر وب‌سایت';
    
    $refStr = 'بدون معرف';
    if (!empty($user['referrer_id'])) {
        $refUser = get_user_by_id((int)$user['referrer_id']);
        if ($refUser) {
            $refName = $refUser['username'] ? '@'.$refUser['username'] : ($refUser['first_name'] ?? 'معرف');
            $refStr = '#' . $refUser['id'] . ' (' . h($refName) . ')';
        }
    }
    
    $reward = money(setting_int('start_reward', 2000));
    $date = date('Y-m-d H:i');
    
    $msg = "🆕 <b>ثبت‌نام کاربر جدید از {$sourceStr}</b>\n\n"
         . "🆔 <b>شناسه کاربر:</b> <code>#{$uid}</code>\n"
         . "👤 <b>نام کاربری:</b> {$uname}\n"
         . "📛 <b>نام مشتری:</b> {$name}\n"
         . "📧 <b>ایمیل:</b> {$email}\n"
         . "📲 <b>تلگرام آیدی:</b> {$tgId}\n"
         . "🔗 <b>معرف:</b> {$refStr}\n"
         . "📅 <b>تاریخ ثبت‌نام:</b> <code>{$date}</code>\n"
         . "🎁 <b>هدیه اعتبار:</b> {$reward}";
         
    try {
        notify_admins($msg);
    } catch (Throwable $e) {
        error_log('[Notify Signup Error] ' . $e->getMessage());
    }
}
function try_reward_referrer(array $user): void {
    if(empty($user['referrer_id'])||(int)($user['ref_rewarded']??0)===1||user_is_blocked($user))return;
    if(!is_joined_channel((int)$user['telegram_id']))return;
    $pdo=db();$pdo->beginTransaction();$notify=null;
    try{
        $q=$pdo->prepare('SELECT * FROM users WHERE id=? FOR UPDATE');$q->execute([(int)$user['id']]);$locked=$q->fetch();
        if(!$locked||empty($locked['referrer_id'])||(int)$locked['ref_rewarded']===1){$pdo->commit();return;}
        $refId=(int)$locked['referrer_id'];$q=$pdo->prepare('SELECT * FROM users WHERE id=? FOR UPDATE');$q->execute([$refId]);$ref=$q->fetch();if(!$ref||user_is_blocked($ref)){$pdo->commit();return;}
        $reward=setting_int('start_reward',2000);
        $u=$pdo->prepare('UPDATE users SET ref_rewarded=1 WHERE id=? AND ref_rewarded=0');$u->execute([(int)$locked['id']]);if($u->rowCount()!==1){$pdo->commit();return;}
        $pdo->prepare('INSERT IGNORE INTO referrals (referrer_id,referred_id,reward_amount) VALUES (?,?,?)')->execute([$refId,(int)$locked['id'],$reward]);
        $pdo->prepare('UPDATE users SET referrals_count=referrals_count+1 WHERE id=?')->execute([$refId]);
        if($reward>0)add_balance($refId,$reward,'ref_start','پاداش استارت زیرمجموعه جدید',(int)$locked['id']);
        $q=$pdo->prepare('SELECT * FROM users WHERE id=?');$q->execute([$refId]);$ref=$q->fetch();$spinEvery=max(1,setting_int('spin_referrals_per_chance',5));$spin=false;
        if(((int)$ref['referrals_count']%$spinEvery)===0){$pdo->prepare('UPDATE users SET spin_balance=spin_balance+1 WHERE id=?')->execute([$refId]);$spin=true;}
        $pdo->commit();$notify=[$ref,$reward,$spin];
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
    if($notify){[$ref,$reward,$spin]=$notify;$spinText=$spin?"
🎡 یک شانس گردونه هم گرفتی!":'';send_msg((int)$ref['telegram_id'],'🎉 یک کاربر جدید با لینک دعوت شما وارد شد.'.($reward>0?"
💰 پاداش: <b>".money($reward).'</b>':'').$spinText,main_menu_keyboard(is_full_admin((int)$ref['telegram_id'])));}
}

function send_msg($chat_id, string $text, ?string $replyMarkup = null, array $extra = []): void {
    $data = array_merge([
        'chat_id' => $chat_id,
        'text' => $text,
        'parse_mode' => 'HTML',
        'disable_web_page_preview' => true,
    ], $extra);
    if ($replyMarkup !== null) $data['reply_markup'] = $replyMarkup;
    tg('sendMessage', $data);
}
function edit_msg($chat_id, $message_id, string $text, ?string $replyMarkup = null): void {
    $data = [
        'chat_id' => $chat_id,
        'message_id' => $message_id,
        'text' => $text,
        'parse_mode' => 'HTML',
        'disable_web_page_preview' => true,
    ];
    if ($replyMarkup !== null) $data['reply_markup'] = $replyMarkup;
    tg('editMessageText', $data);
}
function answer_cb($callback_id, string $text = ''): void {
    tg('answerCallbackQuery', ['callback_query_id'=>$callback_id, 'text'=>$text, 'show_alert'=>false]);
}
function json_markup(array $data): string { return json_encode($data, JSON_UNESCAPED_UNICODE); }
function keyboard_markup(array $rows, bool $resize=true, bool $oneTime=false): string {
    return json_markup(['keyboard'=>$rows, 'resize_keyboard'=>$resize, 'one_time_keyboard'=>$oneTime, 'is_persistent'=>true]);
}
function main_menu_keyboard(bool $admin=false): string {
    // Keep actions attached to the message instead of creating a persistent
    // WebApp reply keyboard above Telegram's composer.
    return miniapp_inline_keyboard($admin);
}
function miniapp_url(bool $admin=false): string {
    $mini = trim((string)app_config('MINIAPP_URL', ''));
    if ($mini === '') return '';
    if (!$admin) return $mini;
    // Append admin=1 safely. Some installs set MINIAPP_URL with an existing ?v=... query.
    $sep = str_contains($mini, '?') ? '&' : '?';
    return $mini . $sep . 'admin=1&mode=admin';
}
function miniapp_inline_keyboard(bool $admin=false): string {
    $mini = miniapp_url($admin);
    $rows = [];
    if ($mini) {
        $rows[] = [['text'=>$admin ? '🧑‍💼 باز کردن پنل BlueGate' : '🚀 باز کردن BlueGate', 'web_app'=>['url'=>$mini]]];
    }
    $rows[] = [
        ['text'=>'📦 سفارش‌های من', 'callback_data'=>'u_orders'],
        ['text'=>'💬 پشتیبانی', 'callback_data'=>'u_support'],
    ];
    return json_markup(['inline_keyboard'=>$rows]);
}
function contact_request_keyboard(): string {
    return keyboard_markup([[['text'=>'📱 ارسال شماره موبایل', 'request_contact'=>true]]], true, true);
}
function back_main_keyboard(): string { return json_markup(['inline_keyboard'=>[[['text'=>'🔙 بازگشت به منوی اصلی', 'callback_data'=>'main']]]]); }

function shop_back_keyboard(): string {
    return json_markup(['inline_keyboard'=>[[['text'=>'🛒 فروشگاه', 'callback_data'=>'u_shop'], ['text'=>'🔙 منوی اصلی', 'callback_data'=>'main']]]]);
}
function order_user_keyboard(array $order): string {
    $status = normalize_order_status($order['status'] ?? '');
    $rows = [];
    if ($status === 'pending_payment') {
        $payRows=[];
        if (payment_enabled('wallet')) $payRows[]=['text'=>'💰 پرداخت از کیف پول', 'callback_data'=>'order_pay_wallet_'.$order['id']];
        if (payment_enabled('card')) $payRows[]=['text'=>'💳 کارت به کارت', 'callback_data'=>'order_pay_card_'.$order['id']];
        if ($payRows) $rows[]=$payRows;
        if (payment_enabled('stars')) $rows[] = [['text'=>'⭐ پرداخت با Telegram Stars', 'callback_data'=>'order_pay_stars_'.$order['id']]];
        if (payment_enabled('crypto')) $rows[] = [['text'=>'🪙 پرداخت رمزارز', 'callback_data'=>'order_pay_crypto_'.$order['id']]];
        if (($order['payment_method'] ?? '') === 'crypto') $rows[] = [['text'=>'🔄 بررسی پرداخت رمزارز', 'callback_data'=>'order_check_crypto_'.$order['id']]];
        $rows[] = [['text'=>'📤 ارسال رسید پرداخت', 'callback_data'=>'order_receipt_'.$order['id']]];
        $rows[] = [['text'=>'🎟 ثبت کد تخفیف', 'callback_data'=>'order_coupon_'.$order['id']], ['text'=>'❌ لغو سفارش', 'callback_data'=>'order_cancel_'.$order['id']]];
    } elseif ($status === 'rejected') {
        if (payment_enabled('card')) $rows[] = [['text'=>'💳 کارت به کارت', 'callback_data'=>'order_pay_card_'.$order['id']]];
        if (payment_enabled('crypto')) $rows[] = [['text'=>'🪙 پرداخت رمزارز', 'callback_data'=>'order_pay_crypto_'.$order['id']]];
        if (($order['payment_method'] ?? '') === 'crypto') $rows[] = [['text'=>'🔄 بررسی پرداخت رمزارز', 'callback_data'=>'order_check_crypto_'.$order['id']]];
        $rows[] = [['text'=>'📤 ارسال مجدد رسید', 'callback_data'=>'order_receipt_'.$order['id']]];
    }
    $rows[] = [['text'=>'📝 یادداشت سفارش / اطلاعات اکانت', 'callback_data'=>'order_note_'.$order['id']], ['text'=>'🧾 تایم‌لاین سفارش', 'callback_data'=>'order_timeline_'.$order['id']]];
    if (is_cleanup_order_status($status)) {
        $rows[] = [['text'=>'🗑 حذف از لیست من', 'callback_data'=>'order_hide_'.$order['id']]];
    }
    $rows[] = [['text'=>'🧾 سفارش‌های من', 'callback_data'=>'u_orders'], ['text'=>'🛒 فروشگاه', 'callback_data'=>'u_shop']];
    $rows[] = [['text'=>'🔙 منوی اصلی', 'callback_data'=>'main']];
    return json_markup(['inline_keyboard'=>$rows]);
}
function admin_shop_keyboard(): string {
    $mini = app_config('MINIAPP_URL', '');
    $rows = [
        [['text'=>'➕ محصول مرحله‌ای', 'callback_data'=>'adm_add_product'], ['text'=>'📦 مدیریت محصولات', 'callback_data'=>'adm_products']],
        [['text'=>'➕ دسته مرحله‌ای', 'callback_data'=>'adm_add_category'], ['text'=>'📂 مدیریت دسته‌بندی‌ها', 'callback_data'=>'adm_categories']],
        [['text'=>'➕ پلن مرحله‌ای', 'callback_data'=>'adm_add_variant_manual'], ['text'=>'🧩 مدیریت پلن‌ها', 'callback_data'=>'adm_variants']],
        [['text'=>'➕ انبار مرحله‌ای', 'callback_data'=>'adm_add_inventory'], ['text'=>'📥 مدیریت انبار دستی', 'callback_data'=>'adm_inventory']],
        [['text'=>'🧾 سفارش‌ها', 'callback_data'=>'adm_orders'], ['text'=>'🔎 جستجوی سفارش', 'callback_data'=>'adm_order_search']],
        [['text'=>'🧹 پاکسازی لغو/رد شده‌ها', 'callback_data'=>'adm_cleanup_orders']],
        [['text'=>'🎟 کدهای تخفیف', 'callback_data'=>'adm_coupons'], ['text'=>'📊 گزارش فروش', 'callback_data'=>'adm_sales_report']],
        [['text'=>'💳 متن پرداخت', 'callback_data'=>'adm_payment']],
    ];
    if ($mini) $rows[] = [['text'=>'🧑‍💼 Mini Panel ادمین', 'web_app'=>['url'=>$mini.'?admin=1']]];
    $rows[] = [['text'=>'🔙 پنل ادمین', 'callback_data'=>'adm_home']];
    return json_markup(['inline_keyboard'=>$rows]);
}
function admin_order_keyboard(int $orderId): string {
    return json_markup(['inline_keyboard'=>[
        [['text'=>'👀 شروع بررسی', 'callback_data'=>'ord_review_'.$orderId], ['text'=>'✅ تایید پرداخت', 'callback_data'=>'ord_paid_'.$orderId]],
        [['text'=>'📦 آماده‌سازی', 'callback_data'=>'ord_prepare_'.$orderId], ['text'=>'⚡️ تحویل از انبار', 'callback_data'=>'ord_auto_deliver_'.$orderId]],
        [['text'=>'📩 تحویل دستی', 'callback_data'=>'ord_deliver_'.$orderId], ['text'=>'📝 یادداشت داخلی', 'callback_data'=>'ord_note_'.$orderId]],
        [['text'=>'🧾 تایم‌لاین', 'callback_data'=>'ord_timeline_'.$orderId], ['text'=>'❌ رد سفارش', 'callback_data'=>'ord_reject_'.$orderId]],
        [['text'=>'📦 آرشیو', 'callback_data'=>'ord_archive_'.$orderId], ['text'=>'🗑 حذف کامل', 'callback_data'=>'ord_delete_'.$orderId]],
        [['text'=>'🧾 سفارش‌ها', 'callback_data'=>'adm_orders'], ['text'=>'🛒 فروشگاه ادمین', 'callback_data'=>'adm_shop']],
    ]]);
}
function show_shop_home(int $chat_id, $message_id=null): void {
    $cats = (function_exists('catalog_enabled') && catalog_enabled()) ? catalog_store_categories(true) : shop_categories(true);
    $rows = [];
    foreach ($cats as $c) {
        $callbackId = isset($c['legacy_category_id']) ? (int)$c['legacy_category_id'] : (int)$c['id'];
        if ($callbackId <= 0) continue;
        $rows[] = [['text'=>trim(($c['emoji'] ?: '🛒').' '.$c['title']), 'callback_data'=>'shop_cat_'.$callbackId]];
    }
    $rows[] = [['text'=>'⭐ محصولات ویژه', 'callback_data'=>'shop_featured'], ['text'=>'📦 همه محصولات', 'callback_data'=>'shop_cat_0']];
    $rows[] = [['text'=>'🧾 سفارش‌های من', 'callback_data'=>'u_orders'], ['text'=>'🔙 منوی اصلی', 'callback_data'=>'main']];
    $txt = "🛒 <b>فروشگاه</b>\n\nمحصول را انتخاب کن؛ اگر محصول پلن داشته باشد، قبل از سفارش پلن را انتخاب می‌کنی. وضعیت سفارش هم مرحله‌به‌مرحله نمایش داده می‌شود.";
    send_or_edit($chat_id, $message_id, $txt, json_markup(['inline_keyboard'=>$rows]));
}
function show_shop_category(int $chat_id, $message_id, int $categoryId=0, bool $featured=false): void {
    $products = function_exists('storefront_shop_products') ? storefront_shop_products() : shop_products(null, true);
    if ($categoryId) $products = array_values(array_filter($products, fn($p)=>(int)($p['category_id'] ?? 0) === $categoryId));
    // Telegram shop is flat: when a Service has visible Groups, list the Groups instead of a non-purchasable container row.
    $products = array_values(array_filter($products, fn($p)=>(int)($p['child_count'] ?? 0) === 0));
    if ($featured) $products = array_values(array_filter($products, fn($p)=>(int)($p['is_featured'] ?? 0) === 1));
    $rows = [];
    foreach ($products as $p) {
        $display = !empty($p['parent_name']) ? $p['parent_name'].' → '.$p['name'] : $p['name'];
        $label = '📦 '.$display.' — '.product_price_label($p);
        $variantCount = array_key_exists('__catalog_variant_ids', $p) ? count((array)$p['__catalog_variant_ids']) : (int)($p['variant_count'] ?? 0);
        if ($variantCount > 0) $label .= ' | '.$variantCount.' پلن';
        $rows[] = [['text'=>$label, 'callback_data'=>'shop_prod_'.$p['id']]];
    }
    if (!$rows) $rows[] = [['text'=>'فعلاً محصولی نیست', 'callback_data'=>'u_shop']];
    $rows[] = [['text'=>'🔙 دسته‌بندی‌ها', 'callback_data'=>'u_shop'], ['text'=>'🔙 منوی اصلی', 'callback_data'=>'main']];
    $title = $featured ? 'محصولات ویژه' : ($categoryId ? 'محصولات این دسته' : 'همه محصولات');
    send_or_edit($chat_id, $message_id, "🛒 <b>{$title}</b>\n\nبرای دیدن جزئیات روی محصول بزن.", json_markup(['inline_keyboard'=>$rows]));
}
function show_shop_product(int $chat_id, $message_id, int $productId): void {
    $p = null;
    if (function_exists('storefront_shop_products')) {
        foreach (storefront_shop_products() as $candidate) if ((int)$candidate['id'] === $productId && (int)($candidate['child_count'] ?? 0) === 0) { $p=$candidate; break; }
    }
    if (!$p) $p = shop_product($productId);
    if (!$p || (int)$p['is_active'] !== 1 || (int)($p['child_count'] ?? 0) > 0) { send_or_edit($chat_id, $message_id, 'محصول پیدا نشد یا غیرفعال است.', shop_back_keyboard()); return; }
    if (array_key_exists('__catalog_variant_ids', $p)) {
        $variants=[];
        foreach ((array)$p['__catalog_variant_ids'] as $vid) { $v=product_variant((int)$vid); if($v && (int)($v['is_active']??0)===1)$variants[]=$v; }
    } else $variants = product_variants($productId, true);
    $priceLine = count($variants) ? product_price_label($p) : money((int)$p['price']);
    $displayName = !empty($p['parent_name']) ? $p['parent_name'].' → '.$p['name'] : $p['name'];
    $txt = "📦 <b>".h($displayName)."</b>\n\n".
        "قیمت: <b>{$priceLine}</b>\n".
        "دسته: ".h(trim(($p['category_emoji'] ?? '').' '.($p['category_title'] ?? 'عمومی')))."\n".
        "نوع تحویل: <b>".delivery_type_fa($p['delivery_type'])."</b>\n".
        "موجودی آماده: <b>".inventory_count((int)$p['id'])."</b>\n".
        "پورسانت معرف: <b>".product_commission_text($p)."</b>\n\n".
        h($p['full_description'] ?: $p['short_description'] ?: '');
    $rows = [];
    if ($variants) {
        foreach ($variants as $v) {
            $actualPid=(int)($v['product_id'] ?? $p['id']);
            $rows[] = [['text'=>'🧩 '.$v['title'].' — '.money(variant_current_price_toman($v)), 'callback_data'=>'shop_buyv_'.$actualPid.'_'.$v['id']]];
        }
    } else {
        $rows[] = [['text'=>'🛒 ثبت سفارش', 'callback_data'=>'shop_buy_'.$p['id']]];
    }
    $rows[] = [['text'=>'🔙 محصولات', 'callback_data'=>'shop_cat_'.(int)($p['category_id'] ?? 0)], ['text'=>'🔙 منوی اصلی', 'callback_data'=>'main']];
    send_or_edit($chat_id, $message_id, $txt, json_markup(['inline_keyboard'=>$rows]));
}
function show_user_orders(int $chat_id, $message_id, int $userId): void {
    $orders = user_orders($userId, 15);
    $rows = [];
    $txt = "🧾 <b>سفارش‌های من</b>\n\n";
    if (!$orders) $txt .= "فعلاً سفارش فعالی در لیستت نیست.";
    foreach ($orders as $o) {
        $name = order_catalog_display_name($o);
        $txt .= order_status_emoji($o['status'])." <code>#{$o['id']}</code> | <b>".h($name)."</b> | ".money($o['final_amount'])."\n";
        $row = [['text'=>order_status_emoji($o['status']).' سفارش #'.$o['id'], 'callback_data'=>'order_view_'.$o['id']]];
        if (is_cleanup_order_status($o['status'])) $row[] = ['text'=>'🗑 حذف از لیست', 'callback_data'=>'order_hide_'.$o['id']];
        $rows[] = $row;
    }
    $rows[] = [['text'=>'🧹 پاکسازی لغو/رد شده‌های من', 'callback_data'=>'order_clear_canceled']];
    $rows[] = [['text'=>'🛒 فروشگاه', 'callback_data'=>'u_shop'], ['text'=>'🔙 منوی اصلی', 'callback_data'=>'main']];
    send_or_edit($chat_id, $message_id, $txt, json_markup(['inline_keyboard'=>$rows]));
}
function show_order_invoice(int $chat_id, $message_id, array $order): void {
    $name = order_catalog_display_name($order);
    $txt = "🧾 <b>فاکتور سفارش #{$order['id']}</b>\n\n".
        "محصول: <b>".h($name)."</b>\n".
        "مبلغ: <b>".money($order['amount'])."</b>\n";
    if ((int)$order['discount_amount'] > 0) $txt .= "تخفیف: <b>".money($order['discount_amount'])."</b>\n";
    $txt .= "مبلغ نهایی: <b>".money($order['final_amount'])."</b>\n".
        "وضعیت: <b>".order_status_emoji($order['status']).' '.order_status_fa($order['status'])."</b>\n".
        "نوع تحویل: <b>".delivery_type_fa($order['delivery_type'])."</b>\n";
    if (!empty($order['expires_at'])) $txt .= "انقضا/مدت: <code>".h($order['expires_at'])."</code>\n";
    if (!empty($order['customer_note'])) $txt .= "\n📝 یادداشت شما:\n".h($order['customer_note'])."\n";
    if (!empty($order['delivery_text']) && normalize_order_status($order['status']) === 'delivered') $txt .= "\nاطلاعات تحویل:\n<code>".h($order['delivery_text'])."</code>\n";
    if (($order['payment_method'] ?? '') === 'crypto') { $cc = get_crypto_check_by_order((int)$order['id']); if ($cc) { $txt .= "
🪙 <b>پرداخت رمزارز</b>
".'شبکه/ارز: <b>'.h($cc['network']).' / '.h($cc['asset'])."</b>
".'مبلغ: <b>'.h($cc['expected_amount']).' '.h($cc['asset'])."</b>
".'آدرس ولت:
<code>'.h($cc['address'])."</code>
"; if (!empty($cc['tx_hash'])) $txt .= "TXID:
<code>".h($cc['tx_hash'])."</code>
"; if (!empty($cc['fail_reason'])) $txt .= "وضعیت/خطا: <code>".h($cc['fail_reason'])."</code>
"; } }
    $timeline = order_timeline_text((int)$order['id'], true);
    if ($timeline) $txt .= "\n🧾 <b>تایم‌لاین</b>\n{$timeline}\n";
    if (in_array(normalize_order_status($order['status']), ['pending_payment','rejected'], true)) $txt .= "\n💳 <b>راهنمای پرداخت</b>\n".h(setting('payment_instructions', 'لطفاً پرداخت را انجام دهید و رسید را ارسال کنید.'));
    send_or_edit($chat_id, $message_id, $txt, order_user_keyboard($order));
}
function order_admin_card(array $order): string {
    $name = order_catalog_display_name($order);
    $cust = customer_stats((int)$order['user_id']);
    $renew = !empty($order['is_renewal']) ? "🔄 <b>تمدید سفارش</b>".(!empty($order['renewal_of_order_id'])?" #".(int)$order['renewal_of_order_id']:"")."\n" : '';
    return "🧾 <b>سفارش #{$order['id']}</b>\n".$renew.
        "کاربر: @".h($order['username'] ?: 'بدون یوزرنیم')." | <code>{$order['telegram_id']}</code>\n".
        "سطح مشتری: {$cust['tier']['emoji']} {$cust['tier']['fa']} | خرید موفق: <b>{$cust['orders_count']}</b> | ".money($cust['total_spent'])."\n".
        "محصول: <b>".h($name)."</b>\n".
        "مبلغ نهایی: <b>".money($order['final_amount'])."</b>\n".
        "وضعیت: <b>".order_status_emoji($order['status']).' '.order_status_fa($order['status'])."</b>\n".
        "نوع تحویل: <b>".delivery_type_fa($order['delivery_type'])."</b>";
}
function show_admin_shop_home(int $chat_id, $message_id=null): void {
    $p = db()->query('SELECT COUNT(*) c FROM products')->fetch();
    $active = db()->query('SELECT COUNT(*) c FROM products WHERE is_active=1')->fetch();
    $pending = db()->query('SELECT COUNT(*) c FROM orders WHERE status IN ("pending_payment","receipt_submitted","reviewing")')->fetch();
    $ready = db()->query('SELECT COUNT(*) c FROM orders WHERE status IN ("payment_confirmed","preparing")')->fetch();
    $inv = db()->query('SELECT COUNT(*) c FROM inventory_items WHERE status="available"')->fetch();
    $txt = "🛒 <b>مدیریت فروشگاه</b>\n\n".
        "محصولات: <b>{$p['c']}</b> | فعال: <b>{$active['c']}</b>\n".
        "سفارش‌های در انتظار بررسی: <b>{$pending['c']}</b>\n".
        "آماده تحویل: <b>{$ready['c']}</b>\n".
        "موجودی آماده انبار: <b>{$inv['c']}</b>";
    send_or_edit($chat_id, $message_id, $txt, admin_shop_keyboard());
}
function show_admin_products(int $chat_id, $message_id=null): void {
    $rows = shop_products(null, false);
    if (!$rows) { send_or_edit($chat_id, $message_id, 'هنوز محصولی ثبت نشده.', admin_shop_keyboard()); return; }
    $txt = "📦 <b>مدیریت محصولات</b>\nهر محصول را جدا مدیریت کن؛ می‌توانی غیرفعال، ویرایش یا حذف کامل کنی.\n\n";
    $kb=[];
    foreach ($rows as $p) {
        $status = (int)$p['is_active'] ? '✅' : '⛔️';
        $txt .= "{$status} <code>#{$p['id']}</code> <b>".h($p['name'])."</b> | ".product_price_label($p)."\n";
        $kb[] = [['text'=>$status.' #'.$p['id'].' '.$p['name'], 'callback_data'=>'prod_manage_'.$p['id']]];
    }
    $kb[] = [['text'=>'➕ افزودن محصول مرحله‌ای', 'callback_data'=>'adm_add_product']];
    $kb[] = [['text'=>'🔙 فروشگاه ادمین', 'callback_data'=>'adm_shop']];
    send_or_edit($chat_id, $message_id, $txt, json_markup(['inline_keyboard'=>$kb]));
}
function show_admin_categories(int $chat_id, $message_id=null): void {
    $rows = shop_categories(false);
    $txt = "📂 <b>مدیریت دسته‌بندی‌ها</b>\n\n";
    $kb=[];
    foreach ($rows as $c) {
        $status=(int)$c['is_active']?'✅':'⛔️';
        $txt .= "{$status} <code>#{$c['id']}</code> ".h(($c['emoji']?:'🛒').' '.$c['title'])."\n";
        $kb[] = [['text'=>$status.' #'.$c['id'].' '.trim(($c['emoji']?:'🛒').' '.$c['title']), 'callback_data'=>'cat_manage_'.$c['id']]];
    }
    if (!$rows) $txt .= 'دسته‌ای نداریم.';
    $kb[] = [['text'=>'➕ افزودن دسته مرحله‌ای', 'callback_data'=>'adm_add_category']];
    $kb[] = [['text'=>'🔙 فروشگاه ادمین', 'callback_data'=>'adm_shop']];
    send_or_edit($chat_id, $message_id, $txt, json_markup(['inline_keyboard'=>$kb]));
}
function show_admin_coupons(int $chat_id, $message_id=null): void {
    $rows = db()->query('SELECT * FROM coupons ORDER BY id DESC LIMIT 30')->fetchAll();
    $txt = "🎟 <b>کدهای تخفیف</b>\n\n";
    if (!$rows) $txt .= "هنوز کدی ثبت نشده.";
    foreach ($rows as $c) {
        $value = $c['type'] === 'percent' ? ((int)$c['value']).'٪' : money((int)$c['value']);
        $txt .= "<code>".h($c['code'])."</code> | {$value} | استفاده: {$c['used_count']}/".((int)$c['max_uses'] ?: '∞')." | ".((int)$c['is_active']?'فعال':'غیرفعال')."\n";
    }
    send_or_edit($chat_id, $message_id, $txt, json_markup(['inline_keyboard'=>[
        [['text'=>'➕ افزودن کد تخفیف', 'callback_data'=>'adm_add_coupon']],
        [['text'=>'🔙 فروشگاه ادمین', 'callback_data'=>'adm_shop']],
    ]]));
}
function show_admin_order_filters(int $chat_id, $message_id=null): void {
    $cleanup = cleanup_orders_count();
    $archived = archived_orders_count();
    $txt = "🧾 <b>مدیریت سفارش‌ها</b>\n\nکدام سفارش‌ها را می‌خواهی ببینی؟\n\n🧹 قابل پاکسازی: <b>{$cleanup}</b> سفارش\n📦 آرشیوشده: <b>{$archived}</b> سفارش";
    send_or_edit($chat_id, $message_id, $txt, json_markup(['inline_keyboard'=>[
        [['text'=>'⏳ در انتظار پرداخت', 'callback_data'=>'adm_orders_pending_payment'], ['text'=>'📤 رسید ارسال شده', 'callback_data'=>'adm_orders_receipt_submitted']],
        [['text'=>'👀 در حال بررسی', 'callback_data'=>'adm_orders_reviewing'], ['text'=>'✅ تایید پرداخت', 'callback_data'=>'adm_orders_payment_confirmed']],
        [['text'=>'📦 آماده‌سازی', 'callback_data'=>'adm_orders_preparing'], ['text'=>'📩 تحویل‌شده', 'callback_data'=>'adm_orders_delivered']],
        [['text'=>'❌ رد/لغو شده', 'callback_data'=>'adm_orders_rejected'], ['text'=>'📋 همه', 'callback_data'=>'adm_orders_all']],
        [['text'=>'📦 آرشیوشده‌ها', 'callback_data'=>'adm_orders_archived'], ['text'=>'🧹 پاکسازی لغو/رد شده‌ها', 'callback_data'=>'adm_cleanup_orders']],
        [['text'=>'🔎 جستجوی سفارش', 'callback_data'=>'adm_order_search'], ['text'=>'🔙 فروشگاه ادمین', 'callback_data'=>'adm_shop']],
    ]]));
}
function show_admin_order(int $chat_id, $message_id, int $orderId): void {
    $order = order_by_id($orderId);
    if (!$order) { send_or_edit($chat_id, $message_id, 'سفارش پیدا نشد.', admin_shop_keyboard()); return; }
    $txt = order_admin_card($order);
    if (!empty($order['payment_note'])) $txt .= "\n\nرسید/توضیح پرداخت:\n".h($order['payment_note']);
    if (!empty($order['customer_note'])) $txt .= "\n\n📝 یادداشت مشتری / اطلاعات لازم:\n".h($order['customer_note']);
    if (!empty($order['receipt_file_id'])) $txt .= "\n\n🖼 رسید عکس دارد و قبلاً برای ادمین ارسال شده است.";
    if (!empty($order['admin_note'])) $txt .= "\n\n📝 یادداشت داخلی:\n".h($order['admin_note']);
    if (!empty($order['delivery_text'])) $txt .= "\n\nاطلاعات تحویل:\n<code>".h($order['delivery_text'])."</code>";
    $timeline = order_timeline_text($orderId, false);
    if ($timeline) $txt .= "\n\n🧾 <b>تایم‌لاین</b>\n{$timeline}";
    send_or_edit($chat_id, $message_id, $txt, admin_order_keyboard($orderId));
}
function show_admin_orders(int $chat_id, $message_id, string $filter='all'): void {
    $map = [
        'pending_payment'=>'pending_payment','pending_review'=>'receipt_submitted','receipt_submitted'=>'receipt_submitted','reviewing'=>'reviewing',
        'paid'=>'payment_confirmed','payment_confirmed'=>'payment_confirmed','preparing'=>'preparing','delivered'=>'delivered',
        'rejected'=>['rejected','canceled','refunded'],'canceled'=>'canceled'
    ];
    $archived = $filter === 'archived';
    $status = $map[$filter] ?? null;
    $orders = admin_orders($status, 20, '', $archived);
    $rows=[]; $txt="🧾 <b>سفارش‌ها</b>\n\n";
    if (!$orders) $txt .= 'سفارشی در این بخش نیست.';
    foreach($orders as $o){
        $name=order_catalog_display_name($o);
        $txt .= order_status_emoji($o['status'])." <code>#{$o['id']}</code> | @".h($o['username'] ?: '---')." | ".h($name)." | ".money($o['final_amount'])."\n";
        $row=[['text'=>'#'.$o['id'].' '.order_status_fa($o['status']), 'callback_data'=>'ord_view_'.$o['id']]];
        if (is_cleanup_order_status($o['status'])) $row[]=['text'=>'🗑 حذف', 'callback_data'=>'ord_delete_'.$o['id']];
        $rows[]=$row;
    }
    if ($filter === 'rejected') $rows[] = [['text'=>'🧹 حذف همه رد/لغو شده‌ها', 'callback_data'=>'adm_cleanup_orders']];
    $rows[]=[['text'=>'🔙 فیلتر سفارش‌ها','callback_data'=>'adm_orders'], ['text'=>'🛒 فروشگاه ادمین','callback_data'=>'adm_shop']];
    send_or_edit($chat_id,$message_id,$txt,json_markup(['inline_keyboard'=>$rows]));
}
function show_admin_inventory(int $chat_id, $message_id=null): void {
    $rows = inventory_items_for_admin(60);
    $txt = "📥 <b>مدیریت انبار دستی</b>\n\n";
    $kb=[];
    foreach ($rows as $i) {
        $content = mb_substr((string)$i['content'],0,28);
        $txt .= "<code>#{$i['id']}</code> ".h($i['product_name']).(!empty($i['variant_title'])?' / '.h($i['variant_title']):'')." | <b>".h($i['status'])."</b> | ".h($content)."\n";
        $kb[] = [['text'=>'#'.$i['id'].' '.mb_substr($i['product_name'],0,18).' | '.$i['status'], 'callback_data'=>'inv_manage_'.$i['id']]];
    }
    if (!$rows) $txt .= 'انبار خالی است.';
    $kb[] = [['text'=>'➕ افزودن انبار مرحله‌ای', 'callback_data'=>'adm_add_inventory']];
    $kb[] = [['text'=>'🔙 فروشگاه ادمین', 'callback_data'=>'adm_shop']];
    send_or_edit($chat_id, $message_id, $txt, json_markup(['inline_keyboard'=>$kb]));
}
function show_admin_variants(int $chat_id, $message_id=null): void {
    $rows = db()->query('SELECT v.*, p.name product_name FROM product_variants v JOIN products p ON p.id=v.product_id ORDER BY v.id DESC LIMIT 80')->fetchAll();
    $txt = "🧩 <b>مدیریت پلن‌ها</b>\n\n";
    $kb=[];
    foreach ($rows as $v) {
        $status=(int)$v['is_active']?'✅':'⛔️';
        $txt .= "{$status} <code>#{$v['id']}</code> ".h($v['product_name'])." | ".h($v['title'])." | ".money($v['price'])."\n";
        $kb[] = [['text'=>$status.' #'.$v['id'].' '.$v['product_name'].' / '.$v['title'], 'callback_data'=>'variant_manage_'.$v['id']]];
    }
    if (!$rows) $txt .= 'پلنی نداریم.';
    $kb[] = [['text'=>'➕ افزودن پلن مرحله‌ای', 'callback_data'=>'adm_add_variant_manual']];
    $kb[] = [['text'=>'🔙 فروشگاه ادمین', 'callback_data'=>'adm_shop']];
    send_or_edit($chat_id, $message_id, $txt, json_markup(['inline_keyboard'=>$kb]));
}
function show_sales_report(int $chat_id, $message_id=null): void {
    $r=sales_report();
    $txt="📊 <b>گزارش فروش</b>\n\n".
        "امروز: <b>{$r['today']['c']}</b> سفارش | ".money($r['today']['s'])."\n".
        "این ماه: <b>{$r['month']['c']}</b> سفارش | ".money($r['month']['s'])."\n".
        "سفارش‌های نیازمند اقدام: <b>{$r['pending']}</b>\n\n".
        "🏆 <b>محصولات پرفروش</b>\n";
    foreach ($r['top'] as $t) $txt .= "• ".h($t['name'])." — {$t['c']} سفارش | ".money($t['s'])."\n";
    if (!$r['top']) $txt .= "هنوز فروش تحویل‌شده‌ای ثبت نشده.";
    send_or_edit($chat_id, $message_id, $txt, admin_shop_keyboard());
}
function admin_keyboard(): string {
    $rows = [
        [['text'=>'🛒 مدیریت فروشگاه'], ['text'=>'📈 آمار کل']],
        [['text'=>'💳 تغییر اعتبار']],
        [['text'=>'🎁 پاداش خرید'], ['text'=>'⚙️ تنظیمات پاداش‌ها']],
        [['text'=>'💾 بکاپ'], ['text'=>'🎨 تنظیم رنگ‌ها']],
        [['text'=>'📢 پیام همگانی']],
        [['text'=>'🏆 لیدربورد ادمین'], ['text'=>'🏠 صفحه اول']],
    ];
    return keyboard_markup($rows);
}
function force_join_keyboard(): string {
    $channel = ltrim((string)app_config('FORCE_JOIN_CHANNEL', ''), '@');
    return json_markup(['inline_keyboard'=>[
        [['text'=>'عضویت در کانال', 'url'=>"https://t.me/{$channel}"]],
        [['text'=>'✅ عضو شدم', 'callback_data'=>'check_join']],
    ]]);
}
function main_text(array $user): string {
    $brand = h(setting('brand_name', app_config('BRAND_NAME', 'BlueGate')));
    return "💙 <b>{$brand}</b>\n\nسلام! 👋\nبرای استفاده از فروشگاه، سفارش‌ها و اعتبار BlueGate، مینی اپلیکیشن اختصاصی را باز کنید.\nاز دکمه‌های زیر می‌تونی BlueGate رو باز کنی، سفارش‌هات رو ببینی یا با پشتیبانی در ارتباط باشی 👇\n\n" . vip_line($user);
}
function validate_theme_color(string $color): ?string {
    $color = trim($color);
    if (preg_match('/^#[0-9a-fA-F]{6}$/', $color)) return strtolower($color);
    $map = ['blue'=>'#1d9bf0','purple'=>'#8b5cf6','green'=>'#22c55e','red'=>'#ef4444','orange'=>'#f97316','pink'=>'#ec4899','cyan'=>'#06b6d4'];
    return $map[strtolower($color)] ?? null;
}



function seed_shop_categories(): void {
    if (!table_exists('product_categories')) return;
    $count = (int)db()->query('SELECT COUNT(*) c FROM product_categories')->fetch()['c'];
    if ($count > 0) return;
    $rows = [
        ['🤖', 'هوش مصنوعی'], ['🎵', 'موزیک'], ['🎬', 'یوتیوب و استریم'],
        ['🎨', 'طراحی'], ['🎮', 'گیم'], ['🔐', 'VPN'], ['⭐', 'تلگرام']
    ];
    $q = db()->prepare('INSERT INTO product_categories (emoji,title,sort_order) VALUES (?,?,?)');
    foreach ($rows as $i => $r) $q->execute([$r[0], $r[1], $i + 1]);
}

function delivery_type_fa(string $type): string {
    return [
        'manual'=>'تحویل دستی', 'account'=>'اکانت / ایمیل و پسورد', 'vpn'=>'لینک ساب VPN',
        'code'=>'کد / گیفت / لایسنس', 'file'=>'فایل یا متن آماده'
    ][$type] ?? 'تحویل دستی';
}
function normalize_delivery_type(string $type): string {
    $t = strtolower(trim($type));
    $map = ['manual'=>'manual','دستی'=>'manual','account'=>'account','اکانت'=>'account','email'=>'account','vpn'=>'vpn','وپن'=>'vpn','sub'=>'vpn','code'=>'code','کد'=>'code','gift'=>'code','file'=>'file','فایل'=>'file'];
    return $map[$t] ?? 'manual';
}
function normalize_order_status(string $status): string {
    $map = [
        'pending_review'=>'receipt_submitted', 'paid'=>'payment_confirmed',
        'pending'=>'pending_payment', 'review'=>'reviewing'
    ];
    return $map[$status] ?? $status;
}
function order_status_fa(string $status): string {
    $status = normalize_order_status($status);
    return [
        'pending_payment'=>'در انتظار پرداخت',
        'receipt_submitted'=>'رسید ارسال شده',
        'reviewing'=>'در حال بررسی',
        'payment_confirmed'=>'پرداخت تایید شد',
        'preparing'=>'در حال آماده‌سازی',
        'delivered'=>'تحویل داده شده',
        'rejected'=>'رد شده',
        'canceled'=>'لغو شده',
        'refunded'=>'مرجوع / برگشت‌خورده'
    ][$status] ?? $status;
}
function order_status_emoji(string $status): string {
    $status = normalize_order_status($status);
    return [
        'pending_payment'=>'🕓','receipt_submitted'=>'📤','reviewing'=>'👀','payment_confirmed'=>'✅','preparing'=>'📦',
        'delivered'=>'📩','rejected'=>'❌','canceled'=>'🚫','refunded'=>'↩️'
    ][$status] ?? '•';
}
function normalize_coupon_code(string $code): string { return strtoupper(preg_replace('/[^A-Za-z0-9_\-]/', '', trim($code))); }

function shop_categories(bool $activeOnly=true): array {
    $sql = 'SELECT * FROM product_categories'.($activeOnly?' WHERE is_active=1':'').' ORDER BY sort_order ASC, id ASC';
    return db()->query($sql)->fetchAll();
}
function shop_products(?int $categoryId=null, bool $activeOnly=true): array {
    $where=[]; $params=[];
    if ($activeOnly) $where[]='p.is_active=1';
    if ($categoryId) { $where[]='p.category_id=?'; $params[]=$categoryId; }
    $sql='SELECT p.*, c.title category_title, c.emoji category_emoji,
        (SELECT COUNT(*) FROM product_variants v WHERE v.product_id=p.id AND v.is_active=1) variant_count,
        (SELECT COUNT(*) FROM products ch WHERE ch.parent_id=p.id AND ch.is_active=1) child_count,
        (SELECT name FROM products pp WHERE pp.id=p.parent_id LIMIT 1) parent_name,
        (SELECT MIN(v.price) FROM product_variants v WHERE v.product_id=p.id AND v.is_active=1) min_variant_price,
        (SELECT COUNT(*) FROM inventory_items i WHERE i.product_id=p.id AND i.status="available") inventory_available
        FROM products p LEFT JOIN product_categories c ON c.id=p.category_id';
    if ($where) $sql .= ' WHERE '.implode(' AND ', $where);
    $sql .= ' ORDER BY p.is_featured DESC, p.id DESC LIMIT 100';
    $q=db()->prepare($sql); $q->execute($params); return $q->fetchAll();
}
function shop_product(int $id) {
    $q=db()->prepare('SELECT p.*, c.title category_title, c.emoji category_emoji,
        (SELECT COUNT(*) FROM product_variants v WHERE v.product_id=p.id AND v.is_active=1) variant_count,
        (SELECT COUNT(*) FROM products ch WHERE ch.parent_id=p.id AND ch.is_active=1) child_count,
        (SELECT name FROM products pp WHERE pp.id=p.parent_id LIMIT 1) parent_name,
        (SELECT MIN(v.price) FROM product_variants v WHERE v.product_id=p.id AND v.is_active=1) min_variant_price,
        (SELECT COUNT(*) FROM inventory_items i WHERE i.product_id=p.id AND i.status="available") inventory_available
        FROM products p LEFT JOIN product_categories c ON c.id=p.category_id WHERE p.id=?');
    $q->execute([$id]); return $q->fetch();
}
function product_variants(int $productId, bool $activeOnly=true): array {
    $sql='SELECT v.*, sp.image_url plan_image_url, sp.delivery_type plan_delivery_type, sp.commission_type plan_commission_type, sp.commission_value plan_commission_value FROM product_variants v LEFT JOIN service_plans sp ON sp.legacy_variant_id=v.id WHERE v.product_id=?'.($activeOnly?' AND v.is_active=1':'').' ORDER BY v.sort_order ASC, v.id ASC';
    $q=db()->prepare($sql); $q->execute([$productId]); return $q->fetchAll();
}
function product_variant(int $variantId) {
    $q=db()->prepare('SELECT v.*, p.name product_name, COALESCE(sp.delivery_type,p.delivery_type) delivery_type, COALESCE(sp.commission_type,p.commission_type) commission_type, COALESCE(sp.commission_value,p.commission_value) commission_value, sp.image_url plan_image_url FROM product_variants v JOIN products p ON p.id=v.product_id LEFT JOIN service_plans sp ON sp.legacy_variant_id=v.id WHERE v.id=?');
    $q->execute([$variantId]); return $q->fetch();
}
function find_or_create_category(string $title, string $emoji='🛒'): int {
    $title=trim($title); if ($title==='') $title='عمومی';
    if (ctype_digit($title)) return (int)$title;
    $q=db()->prepare('SELECT id FROM product_categories WHERE title=? LIMIT 1'); $q->execute([$title]); $row=$q->fetch();
    if ($row) return (int)$row['id'];
    db()->prepare('INSERT INTO product_categories (title,emoji,sort_order) VALUES (?,?,99)')->execute([$title,$emoji]);
    return (int)db()->lastInsertId();
}
function normalize_price_currency($currency): string {
    $c = strtoupper(trim((string)$currency));
    if (in_array($c, ['USD','USDT','$'], true)) return 'USD';
    if ($c === 'STARS') return 'STARS';
    if ($c === 'FREE') return 'FREE';
    return 'IRT';
}
function decimal_price($value): float {
    if (is_int($value) || is_float($value)) return max(0.0, (float)$value);
    $v = trim(str_replace([',',' '], '', (string)$value));
    $v = str_replace(['٫','٬'], ['.',''], $v);
    return is_numeric($v) ? max(0.0, (float)$v) : 0.0;
}
function usd_toman_rate_meta(): array {
    $meta = crypto_rate_meta('USDT');
    $rate = (float)($meta['rate'] ?? 0);
    return ['rate'=>$rate, 'source'=>(string)($meta['source'] ?? 'manual'), 'updated_at'=>$meta['updated_at'] ?? null, 'is_live'=>!empty($meta['is_live'])];
}
function usd_to_toman(float $usd): int {
    $meta = usd_toman_rate_meta();
    $rate = (float)$meta['rate'];
    return $usd > 0 && $rate > 0 ? (int)round($usd * $rate) : 0;
}
function price_runtime_meta(array $row, string $prefix=''): array {
    $currency = normalize_price_currency($row[$prefix.'price_currency'] ?? 'IRT');
    $storedToman = max(0, (int)($row[$prefix.'price'] ?? 0));
    $usd = decimal_price($row[$prefix.'price_usd'] ?? 0);
    $discount = max(0.0, min(100.0, (float)($row[$prefix.'discount_percent'] ?? 0)));
    
    if ($discount > 0) {
        $usd = $usd * (1 - $discount / 100);
    }
    
    if ($currency === 'FREE') {
        return ['currency'=>'FREE','usd'=>0,'toman'=>0,'rate_toman'=>null,'rate_source'=>null,'rate_updated_at'=>null,'dynamic'=>false,'label'=>'رایگان'];
    }
    if ($currency === 'STARS') {
        $rate = (float)setting_int('stars_rate_toman', 3200);
        $toman = (int)round($usd * $rate);
        return ['currency'=>'STARS','usd'=>$usd,'toman'=>$toman,'rate_toman'=>$rate,'rate_source'=>'settings','rate_updated_at'=>date('Y-m-d H:i:s'),'dynamic'=>true,'label'=>number_format($usd, 2).' ⭐️'];
    }
    
    $rateMeta = usd_toman_rate_meta();
    $rate = (float)$rateMeta['rate'];
    if ($currency === 'USD' && $usd > 0 && $rate > 0) {
        $toman = (int)round($usd * $rate);
        return ['currency'=>'USD','usd'=>$usd,'toman'=>$toman,'rate_toman'=>$rate,'rate_source'=>$rateMeta['source'],'rate_updated_at'=>$rateMeta['updated_at'],'dynamic'=>true,'label'=>money($toman)];
    }
    
    if ($discount > 0) {
        $storedToman = (int)round($storedToman * (1 - $discount / 100));
    }
    return ['currency'=>'IRT','usd'=>null,'toman'=>$storedToman,'rate_toman'=>null,'rate_source'=>null,'rate_updated_at'=>null,'dynamic'=>false,'label'=>money($storedToman)];
}
function product_current_price_toman(array $p): int { return (int)price_runtime_meta($p)['toman']; }
function variant_current_price_toman(array $v): int { return (int)price_runtime_meta($v)['toman']; }
function price_admin_payload_from_input(array $input): array {
    $currency = normalize_price_currency($input['price_currency'] ?? 'IRT');
    if ($currency === 'FREE') {
        return ['price'=>0,'price_currency'=>'FREE','price_usd'=>0,'price_rate_toman'=>null,'price_rate_source'=>null,'price_rate_updated_at'=>null];
    }
    if ($currency === 'STARS') {
        $stars = decimal_price($input['price_usd'] ?? $input['price'] ?? 0);
        if ($stars <= 0) throw new RuntimeException('INVALID_STARS_PRICE');
        $rate = (float)setting_int('stars_rate_toman', 3200);
        $toman = (int)round($stars * $rate);
        return ['price'=>$toman,'price_currency'=>'STARS','price_usd'=>$stars,'price_rate_toman'=>$rate,'price_rate_source'=>'settings','price_rate_updated_at'=>date('Y-m-d H:i:s')];
    }
    if ($currency === 'USD') {
        $usd = decimal_price($input['price_usd'] ?? $input['price'] ?? 0);
        if ($usd <= 0) throw new RuntimeException('INVALID_USD_PRICE');
        $meta = usd_toman_rate_meta();
        $toman = usd_to_toman($usd);
        if ($toman <= 0) throw new RuntimeException('USD_RATE_NOT_AVAILABLE');
        return ['price'=>$toman,'price_currency'=>'USD','price_usd'=>$usd,'price_rate_toman'=>(float)$meta['rate'],'price_rate_source'=>(string)$meta['source'],'price_rate_updated_at'=>date('Y-m-d H:i:s')];
    }
    $toman = parse_amount($input['price'] ?? 0);
    if ($toman <= 0) throw new RuntimeException('INVALID_TOMAN_PRICE');
    return ['price'=>$toman,'price_currency'=>'IRT','price_usd'=>null,'price_rate_toman'=>null,'price_rate_source'=>null,'price_rate_updated_at'=>null];
}
function refresh_usd_product_price_cache(): int {
    $meta = usd_toman_rate_meta();
    $rate = (float)$meta['rate'];
    if ($rate <= 0) return 0;
    $count = 0;
    try {
        $q = db()->prepare('UPDATE products SET price=ROUND(price_usd * ?), price_rate_toman=?, price_rate_source=?, price_rate_updated_at=NOW() WHERE price_currency="USD" AND price_usd IS NOT NULL AND price_usd>0');
        $q->execute([$rate,$rate,(string)$meta['source']]); $count += $q->rowCount();
    } catch (Throwable $e) {}
    try {
        $q = db()->prepare('UPDATE product_variants SET price=ROUND(price_usd * ?), price_rate_toman=?, price_rate_source=?, price_rate_updated_at=NOW() WHERE price_currency="USD" AND price_usd IS NOT NULL AND price_usd>0');
        $q->execute([$rate,$rate,(string)$meta['source']]); $count += $q->rowCount();
    } catch (Throwable $e) {}
    return $count;
}
function price_meta_public(array $row): array {
    $m = price_runtime_meta($row);
    return ['currency'=>$m['currency'], 'usd'=>$m['usd'], 'toman'=>$m['toman'], 'rate_toman'=>$m['rate_toman'], 'rate_source'=>$m['rate_source'], 'rate_updated_at'=>$m['rate_updated_at'], 'dynamic'=>$m['dynamic'], 'label'=>$m['label']];
}
function product_price_label(array $p): string {
    $prices=[];
    if (array_key_exists('__catalog_variant_ids', $p)) {
        try {
            foreach ((array)$p['__catalog_variant_ids'] as $vid) {
                $v=product_variant((int)$vid);
                if ($v && (int)($v['is_active'] ?? 1) === 1) $prices[] = variant_current_price_toman($v);
            }
        } catch (Throwable $e) {}
    } else {
        $vc=(int)($p['variant_count'] ?? 0);
        if ($vc > 0) {
            try { foreach (product_variants((int)$p['id'], true) as $v) $prices[] = variant_current_price_toman($v); } catch (Throwable $e) {}
        }
    }
    $prices = array_values(array_filter($prices, fn($x)=>$x>=0));
    if ($prices) return 'از '.money(min($prices));
    return price_runtime_meta($p)['label'];
}
function product_commission_text(array $p): string {
    if (($p['commission_type'] ?? 'none') === 'percent') return ((int)$p['commission_value']).'٪';
    if (($p['commission_type'] ?? 'none') === 'fixed') return money((int)$p['commission_value']);
    return 'بدون پورسانت';
}
function add_order_event(int $orderId, string $status, string $title, string $note='', bool $public=true): void {
    try {
        db()->prepare('INSERT INTO order_events (order_id,status,title,note,is_public) VALUES (?,?,?,?,?)')->execute([$orderId, normalize_order_status($status), $title, $note, $public ? 1 : 0]);
    } catch (Throwable $e) {}
}
function order_timeline(int $orderId, bool $publicOnly=true): array {
    $sql='SELECT * FROM order_events WHERE order_id=?'.($publicOnly?' AND is_public=1':'').' ORDER BY id ASC';
    $q=db()->prepare($sql); $q->execute([$orderId]); return $q->fetchAll();
}
function order_timeline_text(int $orderId, bool $publicOnly=true): string {
    $events = order_timeline($orderId, $publicOnly);
    if (!$events) return '';
    $out = '';
    foreach ($events as $e) {
        $out .= order_status_emoji($e['status']).' '.h($e['title']).' — <code>'.h(date('Y-m-d H:i', strtotime($e['created_at'])))."</code>\n";
        if (!$publicOnly && !empty($e['note'])) $out .= '   '.h($e['note'])."\n";
    }
    return trim($out);
}
function cancel_expired_orders(): int {
    if (!table_exists('orders')) return 0;
    try {
        $expiryMinutes = setting_int('order_expiry_minutes', 20);
        $q = db()->prepare('SELECT id, user_id FROM orders WHERE status = "pending_payment" AND ((payment_expires_at IS NOT NULL AND payment_expires_at <= NOW()) OR (payment_expires_at IS NULL AND created_at <= DATE_SUB(NOW(), INTERVAL ? MINUTE)))');
        $q->execute([$expiryMinutes]);
        $expired = $q->fetchAll();
        $count = 0;
        foreach ($expired as $row) {
            $oid = (int)$row['id'];
            $u = db()->prepare('UPDATE orders SET status="canceled", canceled_at=NOW(), admin_note=CONCAT(COALESCE(admin_note,""), "\nانقضای خودکار مهلت پرداخت") WHERE id=? AND status="pending_payment"');
            $u->execute([$oid]);
            if ($u->rowCount() !== 1) continue; // another request already changed this order
            // Any wallet amount reserved/charged for a now-expired order must be returned exactly once.
            refund_wallet_for_order($oid, 'بازگشت کیف پول سفارش منقضی‌شده');
            if (table_exists('inventory_items')) {
                db()->prepare('UPDATE inventory_items SET status="available", order_id=NULL, reserved_at=NULL WHERE order_id=? AND status="reserved"')->execute([$oid]);
            }
            add_order_event($oid, 'canceled', 'مهلت پرداخت به پایان رسید', 'لغو خودکار به دلیل انقضای مهلت پرداخت', true);
            $count++;
        }
        return $count;
    } catch (Throwable $e) {
        error_log('[BlueReferral Expire] Error: '.$e->getMessage());
        return 0;
    }
}
function create_shop_order(int $userId, int $productId, ?int $variantId=null): array {
    cancel_expired_orders();
    $p = shop_product($productId);
    if (!$p || (int)$p['is_active'] !== 1) throw new RuntimeException('PRODUCT_NOT_FOUND');
    if (in_array(strtolower((string)($p['product_type'] ?? 'normal')), ['service_group','group','container'], true)) throw new RuntimeException('PRODUCT_IS_CONTAINER');
    $variant = null;
    if ($variantId) {
        $variant = product_variant($variantId);
        if (!$variant || (int)$variant['product_id'] !== $productId || (int)$variant['is_active'] !== 1) throw new RuntimeException('VARIANT_NOT_FOUND');
    } else {
        $variants = product_variants($productId, true);
        if (count($variants) > 0) throw new RuntimeException('VARIANT_REQUIRED');
    }
    $priceRow = $variant ?: $p;
    $priceMeta = price_runtime_meta($priceRow);
    $amount = (int)$priceMeta['toman'];
    if ($amount <= 0) throw new RuntimeException('PRICE_NOT_AVAILABLE');
    $duration = $variant ? (int)$variant['duration_days'] : (int)($p['duration_days'] ?? 0);
    $expiresAt = $duration > 0 ? date('Y-m-d H:i:s', time() + $duration * 86400) : null;
    $paymentExpiresAt = date('Y-m-d H:i:s', time() + setting_int('order_expiry_minutes', 20) * 60);
    db()->prepare('INSERT INTO orders (user_id, product_id, variant_id, amount, final_amount, price_currency, price_usd, usd_rate_toman, usd_rate_source, usd_rate_updated_at, status, expires_at, payment_expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')->execute([$userId,$productId,$variantId,$amount,$amount,$priceMeta['currency'],$priceMeta['usd'],$priceMeta['rate_toman'],$priceMeta['rate_source'],$priceMeta['rate_updated_at'] ? date('Y-m-d H:i:s', strtotime($priceMeta['rate_updated_at'])) : ($priceMeta['currency']==='USD'?date('Y-m-d H:i:s'):null),'pending_payment',$expiresAt,$paymentExpiresAt]);
    $orderId = (int)db()->lastInsertId();
    if (function_exists('catalog_order_snapshot')) { try { catalog_order_snapshot($orderId, $productId, $variantId); } catch (Throwable $e) {} }
    add_order_event($orderId, 'pending_payment', 'سفارش ثبت شد', 'در انتظار پرداخت مشتری');
    return order_by_id($orderId);
}
function order_by_id(int $id) {
    cancel_expired_orders();
    $q=db()->prepare('SELECT o.*, p.name product_name,
        COALESCE(sp.delivery_type,p.delivery_type) delivery_type,
        COALESCE(sp.commission_type,p.commission_type) commission_type,
        COALESCE(sp.commission_value,p.commission_value) commission_value,
        p.short_description, p.full_description, COALESCE(sp.image_url,p.image_url) image_url, p.duration_days product_duration_days,
        p.price_currency product_price_currency, p.price_usd product_price_usd, p.price_rate_toman product_price_rate_toman, p.price_rate_source product_price_rate_source, p.price_rate_updated_at product_price_rate_updated_at,
        v.title variant_title, v.price variant_price, v.price_currency variant_price_currency, v.price_usd variant_price_usd, v.price_rate_toman variant_price_rate_toman, v.price_rate_source variant_price_rate_source, v.price_rate_updated_at variant_price_rate_updated_at, v.duration_days variant_duration_days, v.discount_percent variant_discount_percent,
        u.telegram_id, u.username, u.first_name, u.referrer_id
        FROM orders o
        JOIN products p ON p.id=o.product_id
        LEFT JOIN product_variants v ON v.id=o.variant_id
        LEFT JOIN service_plans sp ON sp.id=o.catalog_plan_id
        JOIN users u ON u.id=o.user_id
        WHERE o.id=?');
    $q->execute([$id]); return $q->fetch();
}
function user_orders(int $userId, int $limit=10, bool $includeHidden=false): array {
    cancel_expired_orders();
    $sql='SELECT o.*, p.name product_name, COALESCE(sp.delivery_type,p.delivery_type) delivery_type, COALESCE(sp.image_url,p.image_url) image_url, v.title variant_title, v.discount_percent variant_discount_percent
        FROM orders o JOIN products p ON p.id=o.product_id LEFT JOIN product_variants v ON v.id=o.variant_id LEFT JOIN service_plans sp ON sp.id=o.catalog_plan_id
        WHERE o.user_id=?'.($includeHidden?'':' AND o.user_hidden=0').' ORDER BY o.id DESC LIMIT ?';
    $q=db()->prepare($sql);
    $q->bindValue(1,$userId,PDO::PARAM_INT); $q->bindValue(2,$limit,PDO::PARAM_INT); $q->execute(); return $q->fetchAll();
}
function admin_orders($status=null, int $limit=20, string $search='', bool $archived=false): array {
    cancel_expired_orders();
    $sql='SELECT o.*, p.name product_name, COALESCE(sp.delivery_type,p.delivery_type) delivery_type, COALESCE(sp.image_url,p.image_url) image_url, v.title variant_title, v.discount_percent variant_discount_percent, u.telegram_id, u.username
        FROM orders o JOIN products p ON p.id=o.product_id LEFT JOIN product_variants v ON v.id=o.variant_id LEFT JOIN service_plans sp ON sp.id=o.catalog_plan_id JOIN users u ON u.id=o.user_id';
    $where=[]; $params=[];
    $where[] = $archived ? 'o.archived_at IS NOT NULL' : 'o.archived_at IS NULL';
    if ($status) {
        $statuses = is_array($status) ? $status : [$status];
        $statuses = array_map('normalize_order_status', $statuses);
        $where[] = 'o.status IN ('.implode(',', array_fill(0, count($statuses), '?')).')';
        $params = array_merge($params, $statuses);
    }
    if ($search !== '') {
        if (ctype_digit($search)) { $where[]='(o.id=? OR u.telegram_id=?)'; $params[]=(int)$search; $params[]=(int)$search; }
        else { $where[]='(u.username LIKE ? OR p.name LIKE ? OR v.title LIKE ?)'; $like='%'.$search.'%'; $params[]=$like; $params[]=$like; $params[]=$like; }
    }
    if ($where) $sql.=' WHERE '.implode(' AND ', $where);
    $sql.=' ORDER BY o.id DESC LIMIT '.(int)$limit;
    $q=db()->prepare($sql); $q->execute($params); return $q->fetchAll();
}
function coupon_by_code(string $code) {
    $code=normalize_coupon_code($code); if ($code==='') return false;
    $q=db()->prepare('SELECT * FROM coupons WHERE code=?'); $q->execute([$code]); return $q->fetch();
}
function calculate_coupon_discount(array|false $coupon, int $amount, int $userId = 0, ?int $productId = null): int {
    if (!$coupon || !is_array($coupon)) throw new RuntimeException('کد تخفیف وارد شده معتبر نیست.');
    if (!(int)$coupon['is_active']) throw new RuntimeException('این کد تخفیف غیرفعال شده است.');
    if ((int)$coupon['max_uses'] > 0 && (int)$coupon['used_count'] >= (int)$coupon['max_uses']) throw new RuntimeException('ظرفیت استفاده از این کد تخفیف به پایان رسیده است.');
    if (!empty($coupon['expires_at']) && strtotime($coupon['expires_at']) < time()) throw new RuntimeException('این کد تخفیف منقضی شده است.');
    
    // Minimum spend threshold check
    $minAmount = (int)($coupon['min_order_amount'] ?? 0);
    if ($minAmount > 0 && $amount < $minAmount) {
        throw new RuntimeException('حداقل مبلغ سفارش برای استفاده از این کد تخفیف ' . number_format($minAmount) . ' تومان است.');
    }

    // Per-user usage limit check
    $maxPerUser = (int)($coupon['max_uses_per_user'] ?? 1);
    if ($userId > 0 && $maxPerUser > 0) {
        $q = db()->prepare('SELECT COUNT(*) c FROM orders WHERE user_id=? AND LOWER(coupon_code)=LOWER(?) AND status NOT IN ("canceled","rejected")');
        $q->execute([$userId, $coupon['code']]);
        $userUses = (int)($q->fetch()['c'] ?? 0);
        if ($userUses >= $maxPerUser) {
            throw new RuntimeException('شما قبلاً از این کد تخفیف استفاده کرده‌اید (سقف استفاده برای هر کاربر ' . $maxPerUser . ' بار).');
        }
    }

    // Category scoping check
    if (!empty($coupon['category_id']) && (int)$coupon['category_id'] > 0 && $productId > 0) {
        $pq = db()->prepare('SELECT category_id FROM products WHERE id=?');
        $pq->execute([$productId]);
        $prod = $pq->fetch();
        if (!$prod || (int)($prod['category_id'] ?? 0) !== (int)$coupon['category_id']) {
            throw new RuntimeException('این کد تخفیف برای محصولات این دسته‌بندی قابل استفاده نیست.');
        }
    }

    if (($coupon['type'] ?? '') === 'fixed' || ($coupon['type'] ?? '') === 'toman') return min($amount, max(0, (int)$coupon['value']));
    return min($amount, (int)floor($amount * max(0, (int)$coupon['value']) / 100));
}


function increment_coupon_use(int $couponId): void {
    db()->prepare('UPDATE coupons SET used_count=used_count+1 WHERE id=?')->execute([$couponId]);
}

function order_payable_base(array $order, int $discountAmount = null): int {
    $discount = $discountAmount === null ? (int)($order['discount_amount'] ?? 0) : $discountAmount;
    return max(0, (int)$order['amount'] - $discount);
}
function wallet_transaction(int $userId, int $amount, string $type, string $description, ?int $relatedUserId=null): void {
    db()->prepare('INSERT INTO transactions (user_id,type,amount,description,related_user_id) VALUES (?,?,?,?,?)')->execute([$userId,$type,$amount,$description,$relatedUserId]);
}


/* ===== v2.7 Credit Center / top-up flow ===== */
function credit_topup_config(): array {
    $methods=setting_json('credit_topup_methods',['card'=>true,'stars'=>true,'crypto'=>true]);
    foreach(['card','stars','crypto'] as $k) $methods[$k]=!empty($methods[$k]) && payment_enabled($k);
    $presets=setting_json('credit_topup_presets',[100000,200000,500000]);
    $presets=array_values(array_unique(array_filter(array_map('intval',$presets),fn($x)=>$x>0)));
    sort($presets);
    return ['enabled'=>setting_bool('credit_topup_enabled',true),'min'=>max(1000,setting_int('credit_topup_min',50000)),'max'=>max(1000,setting_int('credit_topup_max',5000000)),'presets'=>$presets,'methods'=>$methods];
}
function credit_topup_by_id(int $id): ?array { $q=db()->prepare('SELECT t.*,u.telegram_id,u.username,u.first_name,u.email FROM credit_topups t JOIN users u ON u.id=t.user_id WHERE t.id=?');$q->execute([$id]);$r=$q->fetch();return $r?:null; }
function credit_topups_for_user(int $uid,int $limit=20): array { $q=db()->prepare('SELECT * FROM credit_topups WHERE user_id=? ORDER BY id DESC LIMIT '.max(1,min(100,$limit)));$q->execute([$uid]);return $q->fetchAll()?:[]; }
function credit_topups_for_admin(int $limit=80): array { return db()->query('SELECT t.*,u.telegram_id,u.username,u.first_name FROM credit_topups t JOIN users u ON u.id=t.user_id ORDER BY t.id DESC LIMIT '.max(1,min(200,$limit)))->fetchAll()?:[]; }
function credit_topup_status_fa(string $s): string { return ['pending_payment'=>'در انتظار پرداخت','receipt_submitted'=>'در انتظار بررسی','reviewing'=>'در حال بررسی','payment_confirmed'=>'شارژ شد','rejected'=>'رد شده','canceled'=>'لغو شده'][$s]??$s; }
function credit_topup_public(array $t): array {
    $details=json_decode((string)($t['payment_details']??''),true);if(!is_array($details))$details=[];
    return ['id'=>(int)$t['id'],'amount'=>(int)$t['amount'],'status'=>(string)$t['status'],'status_fa'=>credit_topup_status_fa((string)$t['status']),'payment_method'=>$t['payment_method']??null,'payment_method_fa'=>payment_method_fa($t['payment_method']??null),'payment_details'=>$details,'receipt_file_id'=>$t['receipt_file_id']??null,'crypto_wallet_id'=>(int)($t['crypto_wallet_id']??0),'crypto_amount'=>isset($t['crypto_amount'])?(float)$t['crypto_amount']:null,'crypto_asset'=>$t['crypto_asset']??null,'crypto_network'=>$t['crypto_network']??null,'tx_hash'=>$t['tx_hash']??null,'stars_amount'=>(int)($t['stars_amount']??0),'credited_at'=>$t['credited_at']??null,'created_at'=>$t['created_at']??null,'username'=>$t['username']??null,'first_name'=>$t['first_name']??null,'telegram_id'=>isset($t['telegram_id'])?(int)$t['telegram_id']:null];
}
function credit_topup_validate_amount(int $amount): int { $c=credit_topup_config();if(!$c['enabled'])throw new RuntimeException('TOPUP_DISABLED');if($amount<$c['min'])throw new RuntimeException('TOPUP_BELOW_MIN');if($amount>$c['max'])throw new RuntimeException('TOPUP_ABOVE_MAX');return $amount; }
function create_credit_topup(int $uid,int $amount): array { $amount=credit_topup_validate_amount($amount);db()->prepare('INSERT INTO credit_topups (user_id,amount,status) VALUES (?,? ,"pending_payment")')->execute([$uid,$amount]);return credit_topup_by_id((int)db()->lastInsertId()); }
function credit_topup_method_allowed(string $m): bool { $c=credit_topup_config();return in_array($m,['card','stars','crypto'],true)&&!empty($c['methods'][$m]); }
function set_credit_topup_method(int $id,int $uid,string $method,array $details=[]): array {
    $t=credit_topup_by_id($id);if(!$t||(int)$t['user_id']!==$uid)throw new RuntimeException('TOPUP_NOT_FOUND');if(!in_array($t['status'],['pending_payment','rejected'],true))throw new RuntimeException('TOPUP_LOCKED');$method=strtolower(trim($method));if(!credit_topup_method_allowed($method))throw new RuntimeException('TOPUP_METHOD_DISABLED');
    $payload=[];$stars=0;
    if($method==='card'){$payload=['instructions'=>setting('payment_instructions',''),'accounts'=>parse_card_accounts()];}
    elseif($method==='stars'){$stars=max(1,(int)ceil((int)$t['amount']/max(1,setting_int('stars_rate_toman',3200))));$payload=['stars_amount'=>$stars];}
    elseif($method==='crypto'){
        $wid=(int)($details['wallet_id']??0);$w=crypto_wallet_by_id($wid);if(!$w||(int)$w['is_active']!==1)throw new RuntimeException('WALLET_NOT_FOUND');$rate=crypto_rate_toman((string)($w['rate_symbol']?:$w['asset']));if($rate<=0)throw new RuntimeException('CRYPTO_RATE_NOT_AVAILABLE');$markup=max(0,(float)setting('crypto_rate_markup_percent','1'))/100;$expected=round(((int)$t['amount']/$rate)*(1+$markup),6);$meta=crypto_rate_meta((string)($w['rate_symbol']?:$w['asset']));$payload=['wallet_id'=>$wid,'network'=>$w['network'],'asset'=>$w['asset'],'address'=>$w['address'],'expected_amount'=>$expected,'rate_toman'=>$rate,'rate_source'=>$meta['source'],'rate_updated_at'=>$meta['updated_at'],'fee_note'=>'کارمزد شبکه با پرداخت‌کننده است. مبلغ درج‌شده باید کامل به مقصد برسد.'];
        db()->prepare('UPDATE credit_topups SET crypto_wallet_id=?,crypto_amount=?,crypto_asset=?,crypto_network=?,tx_hash=NULL WHERE id=?')->execute([$wid,(string)$expected,$w['asset'],$w['network'],$id]);
    }
    db()->prepare('UPDATE credit_topups SET status="pending_payment",payment_method=?,payment_details=?,stars_amount=? WHERE id=?')->execute([$method,json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),$stars,$id]);return credit_topup_by_id($id);
}
function submit_credit_topup_receipt(int $id,int $uid,string $note='',?string $fileId=null): array { $t=credit_topup_by_id($id);if(!$t||(int)$t['user_id']!==$uid)throw new RuntimeException('TOPUP_NOT_FOUND');if(($t['payment_method']??'')!=='card'||!in_array($t['status'],['pending_payment','rejected'],true))throw new RuntimeException('TOPUP_LOCKED');$d=json_decode((string)($t['payment_details']??''),true);if(!is_array($d))$d=[];$d['note']=trim($note);db()->prepare('UPDATE credit_topups SET status="receipt_submitted",payment_details=?,receipt_file_id=? WHERE id=?')->execute([json_encode($d,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),$fileId,$id]);return credit_topup_by_id($id); }
function submit_credit_topup_crypto_hash(int $id,int $uid,string $hash): array { $hash=trim($hash);if($hash==='')throw new RuntimeException('TX_HASH_EMPTY');$t=credit_topup_by_id($id);if(!$t||(int)$t['user_id']!==$uid)throw new RuntimeException('TOPUP_NOT_FOUND');if(($t['payment_method']??'')!=='crypto'||!in_array($t['status'],['pending_payment','rejected'],true))throw new RuntimeException('TOPUP_LOCKED');try{db()->prepare('UPDATE credit_topups SET tx_hash=?,status="receipt_submitted" WHERE id=?')->execute([$hash,$id]);}catch(Throwable $e){throw new RuntimeException('TX_HASH_ALREADY_USED');}return credit_topup_by_id($id); }
function credit_topup_credit_once(int $id,string $adminNote=''): ?array {
    $pdo=db();$pdo->beginTransaction();try{$q=$pdo->prepare('SELECT * FROM credit_topups WHERE id=? FOR UPDATE');$q->execute([$id]);$t=$q->fetch();if(!$t){$pdo->rollBack();return null;}if(!empty($t['credited_at'])){$pdo->commit();return credit_topup_by_id($id);}if(!in_array($t['status'],['receipt_submitted','reviewing','pending_payment'],true))throw new RuntimeException('TOPUP_STATE_INVALID');$uid=(int)$t['user_id'];$q=$pdo->prepare('SELECT id FROM users WHERE id=? FOR UPDATE');$q->execute([$uid]);if(!$q->fetch())throw new RuntimeException('USER_NOT_FOUND');$pdo->prepare('UPDATE users SET balance=balance+? WHERE id=?')->execute([(int)$t['amount'],$uid]);$pdo->prepare('INSERT INTO transactions (user_id,type,amount,description) VALUES (?,"credit_topup",?,?)')->execute([$uid,(int)$t['amount'],'شارژ اعتبار #'.$id]);$pdo->prepare('UPDATE credit_topups SET status="payment_confirmed",credited_at=NOW(),admin_note=? WHERE id=? AND credited_at IS NULL')->execute([$adminNote?:null,$id]);$pdo->commit();return credit_topup_by_id($id);}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}
function reject_credit_topup(int $id,string $note=''): ?array { $t=credit_topup_by_id($id);if(!$t)return null;if(!empty($t['credited_at']))throw new RuntimeException('TOPUP_ALREADY_CREDITED');db()->prepare('UPDATE credit_topups SET status="rejected",admin_note=? WHERE id=?')->execute([$note?:null,$id]);return credit_topup_by_id($id); }
function cancel_credit_topup(int $id,int $uid): bool {
    $pdo=db();$pdo->beginTransaction();
    try{
        $q=$pdo->prepare('SELECT * FROM credit_topups WHERE id=? FOR UPDATE');$q->execute([$id]);$t=$q->fetch();
        if(!$t||(int)$t['user_id']!==$uid||!empty($t['credited_at'])||!in_array((string)$t['status'],['pending_payment','receipt_submitted','reviewing','rejected'],true)){$pdo->rollBack();return false;}
        $u=$pdo->prepare('UPDATE credit_topups SET status="canceled" WHERE id=? AND credited_at IS NULL');$u->execute([$id]);
        $ok=$u->rowCount()===1;$pdo->commit();return $ok;
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}
function replace_credit_topup_payment(int $id,int $uid): array {
    $pdo=db();$pdo->beginTransaction();
    try{
        $q=$pdo->prepare('SELECT * FROM credit_topups WHERE id=? FOR UPDATE');$q->execute([$id]);$t=$q->fetch();
        if(!$t||(int)$t['user_id']!==$uid)throw new RuntimeException('TOPUP_NOT_FOUND');
        if(!empty($t['credited_at'])||!in_array((string)$t['status'],['pending_payment','receipt_submitted','reviewing','rejected'],true))throw new RuntimeException('TOPUP_LOCKED');
        $amount=credit_topup_validate_amount((int)$t['amount']);
        $pdo->prepare('UPDATE credit_topups SET status="canceled" WHERE id=? AND credited_at IS NULL')->execute([$id]);
        $pdo->prepare('INSERT INTO credit_topups (user_id,amount,status) VALUES (?,?,"pending_payment")')->execute([$uid,$amount]);
        $newId=(int)$pdo->lastInsertId();
        $pdo->commit();
        $fresh=credit_topup_by_id($newId);if(!$fresh)throw new RuntimeException('TOPUP_CREATE_FAILED');return $fresh;
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}
function send_stars_invoice_for_topup(array $t): array { if(!credit_topup_method_allowed('stars'))throw new RuntimeException('STARS_DISABLED');$stars=(int)($t['stars_amount']??0);if($stars<=0)$stars=max(1,(int)ceil((int)$t['amount']/max(1,setting_int('stars_rate_toman',3200))));$payload='topup_'.$t['id'].'_stars_'.$stars;return tg('sendInvoice',['chat_id'=>(int)$t['telegram_id'],'title'=>'شارژ اعتبار BlueGate','description'=>'افزایش اعتبار حساب به مبلغ '.money((int)$t['amount']),'payload'=>$payload,'provider_token'=>'','currency'=>'XTR','prices'=>json_encode([['label'=>'Credit top-up #'.$t['id'],'amount'=>$stars]],JSON_UNESCAPED_UNICODE),'start_parameter'=>'bluegate_topup_'.$t['id']]); }
function validate_topup_stars_precheckout(array $q): array|false { $p=(string)($q['invoice_payload']??'');if(!preg_match('/^topup_(\d+)_stars_(\d+)$/',$p,$m))return false;$t=credit_topup_by_id((int)$m[1]);if(!$t)return false;$required=max(1,(int)ceil((int)$t['amount']/max(1,setting_int('stars_rate_toman',3200))));if((int)($q['from']['id']??0)!==(int)$t['telegram_id']||(int)$m[2]!==$required||(int)($q['total_amount']??0)!==$required||strtoupper((string)($q['currency']??''))!=='XTR')return false;if(!in_array($t['status'],['pending_payment','receipt_submitted','reviewing'],true))return false;return $t; }
function confirm_topup_stars_payment(string $payload,array $payment,int $chatId=0): ?array { if(!preg_match('/^topup_(\d+)_stars_(\d+)$/',$payload,$m))return null;$id=(int)$m[1];$charge=trim((string)($payment['telegram_payment_charge_id']??''));$provider=trim((string)($payment['provider_payment_charge_id']??''));$total=(int)($payment['total_amount']??0);if($charge===''||strtoupper((string)($payment['currency']??''))!=='XTR')return null;$pdo=db();$pdo->beginTransaction();try{$q=$pdo->prepare('SELECT t.*,u.telegram_id FROM credit_topups t JOIN users u ON u.id=t.user_id WHERE t.id=? FOR UPDATE');$q->execute([$id]);$t=$q->fetch();if(!$t||($chatId>0&&(int)$t['telegram_id']!==$chatId)){$pdo->rollBack();return null;}if(!in_array((string)$t['status'],['pending_payment','receipt_submitted','reviewing'],true)||(string)($t['payment_method']??'')!=='stars'){$pdo->rollBack();return null;}$required=max(1,(int)ceil((int)$t['amount']/max(1,setting_int('stars_rate_toman',3200))));if((int)$m[2]!==$required||$total!==$required){$pdo->rollBack();return null;}if(!empty($t['credited_at'])){$pdo->commit();return credit_topup_by_id($id);}$dup=$pdo->prepare('SELECT id FROM credit_topups WHERE stars_charge_id=? AND id<>? LIMIT 1');$dup->execute([$charge,$id]);if($dup->fetch()){$pdo->rollBack();return null;}$dup2=$pdo->prepare('SELECT id FROM orders WHERE stars_charge_id=? LIMIT 1');$dup2->execute([$charge]);if($dup2->fetch()){$pdo->rollBack();return null;}$pdo->prepare('UPDATE credit_topups SET payment_method="stars",stars_amount=?,stars_charge_id=?,stars_provider_charge_id=?,payment_details=?,status="reviewing" WHERE id=?')->execute([$required,$charge,$provider?:null,json_encode($payment,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),$id]);$pdo->commit();return credit_topup_credit_once($id,'تایید خودکار Telegram Stars');}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();error_log('[Stars topup] '.$e->getMessage());return null;} }
function apply_wallet_to_order(int $orderId, int $userId): array {
    $pdo=db();$pdo->beginTransaction();try{
        $q=$pdo->prepare('SELECT * FROM orders WHERE id=? FOR UPDATE');$q->execute([$orderId]);$order=$q->fetch();if(!$order||(int)$order['user_id']!==$userId)throw new RuntimeException('ORDER_NOT_FOUND');
        $status=normalize_order_status((string)$order['status']);if(!in_array($status,['pending_payment','rejected'],true))throw new RuntimeException('ORDER_LOCKED');
        $q=$pdo->prepare('SELECT * FROM users WHERE id=? FOR UPDATE');$q->execute([$userId]);$user=$q->fetch();$balance=(int)($user['balance']??0);if($balance<=0)throw new RuntimeException('NO_WALLET_BALANCE');
        $base=order_payable_base($order);$already=(int)($order['wallet_amount']??0);$remaining=max(0,$base-$already);if($remaining<=0){$pdo->commit();return $order;}$use=min($balance,$remaining);
        $u=$pdo->prepare('UPDATE users SET balance=balance-? WHERE id=? AND balance>=?');$u->execute([$use,$userId,$use]);if($u->rowCount()!==1)throw new RuntimeException('NO_WALLET_BALANCE');wallet_transaction($userId,-$use,'wallet_payment','پرداخت از کیف پول برای سفارش #'.$orderId,null);
        $newWallet=$already+$use;$newFinal=max(0,$base-$newWallet);$sql='UPDATE orders SET wallet_amount=?,final_amount=?,payment_method=COALESCE(payment_method,"wallet")';$params=[$newWallet,$newFinal];if($newFinal===0)$sql.=',status="payment_confirmed",paid_at=COALESCE(paid_at,NOW())';$sql.=' WHERE id=?';$params[]=$orderId;$pdo->prepare($sql)->execute($params);
        add_order_event($orderId,$newFinal===0?'payment_confirmed':$status,'پرداخت از کیف پول ثبت شد','مبلغ استفاده‌شده: '.money($use),true);$pdo->commit();return order_by_id($orderId);
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}

function refund_wallet_for_order(int $orderId,string $reason='بازگشت وجه کیف پول'): void {
    $pdo=db();$own=!$pdo->inTransaction();if($own)$pdo->beginTransaction();try{$q=$pdo->prepare('SELECT * FROM orders WHERE id=? FOR UPDATE');$q->execute([$orderId]);$order=$q->fetch();if(!$order){if($own)$pdo->commit();return;}$wallet=(int)($order['wallet_amount']??0);if($wallet<=0){if($own)$pdo->commit();return;}$userId=(int)$order['user_id'];$q=$pdo->prepare('SELECT id FROM users WHERE id=? FOR UPDATE');$q->execute([$userId]);if(!$q->fetch())throw new RuntimeException('USER_NOT_FOUND');$base=order_payable_base($order);$u=$pdo->prepare('UPDATE orders SET wallet_amount=0,final_amount=? WHERE id=? AND wallet_amount=?');$u->execute([$base,$orderId,$wallet]);if($u->rowCount()!==1){if($own)$pdo->commit();return;}$pdo->prepare('UPDATE users SET balance=balance+? WHERE id=?')->execute([$wallet,$userId]);wallet_transaction($userId,$wallet,'wallet_refund',$reason.' سفارش #'.$orderId,null);add_order_event($orderId,normalize_order_status((string)$order['status']),'اعتبار BlueGate برگشت داده شد',money($wallet),true);if($own)$pdo->commit();}catch(Throwable $e){if($own&&$pdo->inTransaction())$pdo->rollBack();throw $e;}
}


function apply_coupon_to_order(int $orderId, int $userId, string $code): array {
    $code=normalize_coupon_code($code);$pdo=db();$pdo->beginTransaction();try{
        $q=$pdo->prepare('SELECT * FROM orders WHERE id=? FOR UPDATE');$q->execute([$orderId]);$order=$q->fetch();if(!$order||(int)$order['user_id']!==$userId)throw new RuntimeException('ORDER_NOT_FOUND');if(normalize_order_status((string)$order['status'])!=='pending_payment')throw new RuntimeException('ORDER_LOCKED');
        if(!empty($order['coupon_code'])){if(strtolower((string)$order['coupon_code'])===strtolower($code)){$pdo->commit();return order_by_id($orderId);}throw new RuntimeException('برای این سفارش قبلاً کد تخفیف ثبت شده است.');}
        $q=$pdo->prepare('SELECT * FROM coupons WHERE code=? FOR UPDATE');$q->execute([$code]);$coupon=$q->fetch();$discount=calculate_coupon_discount($coupon,(int)$order['amount'],$userId,(int)($order['product_id']??0));
        $base=max(0,(int)$order['amount']-$discount);$wallet=(int)($order['wallet_amount']??0);if($wallet>$base){$refund=$wallet-$base;$pdo->prepare('UPDATE users SET balance=balance+? WHERE id=?')->execute([$refund,$userId]);wallet_transaction($userId,$refund,'wallet_refund','اصلاح پرداخت کیف پول بعد از کد تخفیف سفارش #'.$orderId,null);$wallet=$base;add_order_event($orderId,'pending_payment','بخشی از کیف پول برگشت خورد',money($refund),true);}
        $final=max(0,$base-$wallet);$sql='UPDATE orders SET coupon_code=?,discount_amount=?,wallet_amount=?,final_amount=?';$params=[$coupon['code'],$discount,$wallet,$final];if($final===0)$sql.=',status="payment_confirmed",paid_at=COALESCE(paid_at,NOW())';$sql.=' WHERE id=?';$params[]=$orderId;$pdo->prepare($sql)->execute($params);
        $inc=$pdo->prepare('UPDATE coupons SET used_count=used_count+1 WHERE id=? AND (max_uses=0 OR used_count<max_uses)');$inc->execute([(int)$coupon['id']]);if($inc->rowCount()!==1)throw new RuntimeException('ظرفیت استفاده از این کد تخفیف به پایان رسیده است.');
        add_order_event($orderId,$final===0?'payment_confirmed':'pending_payment','کد تخفیف اعمال شد',$coupon['code'].' / '.money($discount));$pdo->commit();return order_by_id($orderId);
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}

function update_order_status(int $orderId, string $status, string $title='', string $note='', bool $public=true): ?array {
    $status = normalize_order_status($status);
    if (in_array($status, ['rejected','canceled','refunded'], true)) refund_wallet_for_order($orderId, 'بازگشت خودکار کیف پول');
    $timeCol = ['receipt_submitted'=>'review_started_at','reviewing'=>'review_started_at','payment_confirmed'=>'paid_at','preparing'=>'prepared_at','delivered'=>'delivered_at','rejected'=>'rejected_at','canceled'=>'canceled_at'][$status] ?? null;
    $sql='UPDATE orders SET status=?'; $params=[$status];
    if ($timeCol) { $sql .= ", {$timeCol}=NOW()"; }
    $sql .= ' WHERE id=?'; $params[]=$orderId;
    db()->prepare($sql)->execute($params);
    add_order_event($orderId, $status, $title ?: order_status_fa($status), $note, $public);
    if($public){$fresh=order_by_id($orderId);if($fresh)notify_user_event((int)$fresh['user_id'],'order_status',$title ?: order_status_fa($status),$note ?: order_catalog_display_name($fresh),$orderId);}
    return order_by_id($orderId);
}
function submit_order_receipt(int $orderId, int $userId, string $note='', ?string $fileId=null): array {
    $order=order_by_id($orderId);
    if (!$order || (int)$order['user_id'] !== $userId) throw new RuntimeException('ORDER_NOT_FOUND');
    if (!in_array(normalize_order_status($order['status']), ['pending_payment','rejected'], true)) throw new RuntimeException('ORDER_LOCKED');
    db()->prepare('UPDATE orders SET status="receipt_submitted", payment_note=?, receipt_file_id=?, review_started_at=NOW() WHERE id=?')->execute([$note,$fileId,$orderId]);
    add_order_event($orderId, 'receipt_submitted', 'رسید پرداخت ارسال شد', $note ?: 'عکس رسید ارسال شد');
    return order_by_id($orderId);
}
function update_order_customer_note(int $orderId, int $userId, string $note): array {
    $order=order_by_id($orderId);
    if (!$order || (int)$order['user_id'] !== $userId) throw new RuntimeException('ORDER_NOT_FOUND');
    $note = trim($note);
    if ($note === '') throw new RuntimeException('EMPTY_NOTE');
    db()->prepare('UPDATE orders SET customer_note=? WHERE id=?')->execute([$note,$orderId]);
    add_order_event($orderId, 'customer_note', 'یادداشت مشتری ثبت شد', $note, false);
    return order_by_id($orderId);
}
function reject_order(int $orderId, string $note=''): ?array {
    $order=order_by_id($orderId); if (!$order) return null;
    refund_wallet_for_order($orderId, 'بازگشت کیف پول سفارش رد شده');
    db()->prepare('UPDATE orders SET status="rejected", admin_note=?, rejected_at=NOW() WHERE id=?')->execute([$note,$orderId]);
    add_order_event($orderId, 'rejected', 'سفارش رد شد', $note, true);
    return order_by_id($orderId);
}
function cancel_order(int $orderId, string $note=''): ?array {
    $order=order_by_id($orderId); if (!$order) return null;
    update_order_status($orderId, 'canceled', 'سفارش لغو شد', $note, true);
    return order_by_id($orderId);
}
function cleanup_order_statuses(): array { return ['rejected','canceled','refunded']; }
function is_cleanup_order_status(string $status): bool { return in_array(normalize_order_status($status), cleanup_order_statuses(), true); }
function hide_user_order(int $orderId, int $userId): bool {
    $order = order_by_id($orderId);
    if (!$order || (int)$order['user_id'] !== $userId || !is_cleanup_order_status((string)$order['status'])) return false;
    db()->prepare('UPDATE orders SET user_hidden=1 WHERE id=?')->execute([$orderId]);
    return true;
}
function hide_user_cleanup_orders(int $userId): int {
    $statuses = cleanup_order_statuses();
    $q = db()->prepare('UPDATE orders SET user_hidden=1 WHERE user_id=? AND user_hidden=0 AND status IN ('.implode(',', array_fill(0, count($statuses), '?')).')');
    $q->execute(array_merge([$userId], $statuses));
    return $q->rowCount();
}
function archive_order(int $orderId): ?array {
    $order = order_by_id($orderId); if (!$order) return null;
    db()->prepare('UPDATE orders SET archived_at=COALESCE(archived_at,NOW()) WHERE id=?')->execute([$orderId]);
    add_order_event($orderId, $order['status'], 'سفارش آرشیو شد', '', false);
    return order_by_id($orderId);
}
function cleanup_orders_count(?int $olderDays=null): int {
    $statuses = cleanup_order_statuses();
    $params = $statuses;
    $sql = 'SELECT COUNT(*) c FROM orders WHERE status IN ('.implode(',', array_fill(0, count($statuses), '?')).')';
    if ($olderDays !== null) { $sql .= ' AND created_at < DATE_SUB(NOW(), INTERVAL ? DAY)'; $params[] = $olderDays; }
    $q=db()->prepare($sql); $q->execute($params); return (int)$q->fetch()['c'];
}
function archived_orders_count(): int { $r=db()->query('SELECT COUNT(*) c FROM orders WHERE archived_at IS NOT NULL')->fetch(); return (int)($r['c'] ?? 0); }
function hard_delete_order(int $orderId, bool $cleanupOnly=true): bool {
    $order = order_by_id($orderId);
    if (!$order) return false;
    if ($cleanupOnly && !is_cleanup_order_status((string)$order['status'])) return false;
    db()->prepare('UPDATE inventory_items SET order_id=NULL WHERE order_id=?')->execute([$orderId]);
    db()->prepare('DELETE FROM orders WHERE id=?')->execute([$orderId]);
    return true;
}
function hard_delete_cleanup_orders(?int $olderDays=null): int {
    $statuses = cleanup_order_statuses();
    $params = $statuses;
    $sql = 'SELECT id FROM orders WHERE status IN ('.implode(',', array_fill(0, count($statuses), '?')).')';
    if ($olderDays !== null) { $sql .= ' AND created_at < DATE_SUB(NOW(), INTERVAL ? DAY)'; $params[] = $olderDays; }
    $q=db()->prepare($sql); $q->execute($params); $ids=$q->fetchAll(PDO::FETCH_COLUMN);
    $count=0; foreach($ids as $id) if(hard_delete_order((int)$id, true)) $count++;
    return $count;
}
function mark_order_paid(int $orderId): ?array {
    $order=order_by_id($orderId);if(!$order)return null;$status=normalize_order_status((string)$order['status']);
    if(in_array($status,['payment_confirmed','preparing','delivered'],true))return $order;
    if(!in_array($status,['pending_payment','receipt_submitted','reviewing'],true))return null;
    // Accept legacy aliases only when they normalize to an allowed unpaid state.
    $q=db()->prepare('UPDATE orders SET status="payment_confirmed",paid_at=COALESCE(paid_at,NOW()) WHERE id=? AND status IN ("pending_payment","pending","receipt_submitted","pending_review","reviewing","review")');$q->execute([$orderId]);
    if($q->rowCount()===1){add_order_event($orderId,'payment_confirmed','پرداخت تایید شد','',true);return order_by_id($orderId);}
    $fresh=order_by_id($orderId);if($fresh&&in_array(normalize_order_status((string)$fresh['status']),['payment_confirmed','preparing','delivered'],true))return $fresh;
    return null;
}
function mark_order_preparing(int $orderId): ?array {
    return update_order_status($orderId, 'preparing', 'سفارش در حال آماده‌سازی است', '', true);
}
function reserve_inventory_for_order(array $order) {
    $params=[(int)$order['product_id']];
    $variantSql='';
    if (!empty($order['variant_id'])) { $variantSql=' AND (variant_id=? OR variant_id IS NULL)'; $params[]=(int)$order['variant_id']; }
    $sql='SELECT * FROM inventory_items WHERE product_id=?'.$variantSql.' AND status="available" ORDER BY variant_id DESC, id ASC LIMIT 1 FOR UPDATE';
    $pdo=db(); $pdo->beginTransaction();
    try {
        $q=$pdo->prepare($sql); $q->execute($params); $item=$q->fetch();
        if (!$item) { $pdo->commit(); return false; }
        $pdo->prepare('UPDATE inventory_items SET status="delivered", order_id=?, delivered_at=NOW() WHERE id=?')->execute([(int)$order['id'], (int)$item['id']]);
        $pdo->prepare('UPDATE orders SET delivered_inventory_id=? WHERE id=?')->execute([(int)$item['id'], (int)$order['id']]);
        $pdo->commit(); return $item;
    } catch (Throwable $e) { $pdo->rollBack(); throw $e; }
}
function delivery_template_for_order(array $order, string $rawDelivery): string {
    $type = normalize_delivery_type((string)($order['delivery_type'] ?? 'manual'));
    $template = setting('delivery_template_'.$type, setting('delivery_template_manual', "📦 سفارش شما آماده شد\n\n{delivery}"));
    $product = order_catalog_display_name($order);
    return strtr($template, [
        '{delivery}'=>$rawDelivery,
        '{product}'=>$product,
        '{order_id}'=>'#'.($order['id'] ?? ''),
        '{expires_at}'=>!empty($order['expires_at']) ? $order['expires_at'] : '',
    ]);
}
function deliver_order(int $orderId, string $deliveryText): ?array {
    $pdo=db();
    $pdo->beginTransaction();
    $notifyRef=null;
    try {
        // Serialize delivery so the same order cannot pay referral commission twice.
        $lock=$pdo->prepare('SELECT id,status,referrer_id,referrer_reward_amount,user_id,final_amount FROM orders WHERE id=? FOR UPDATE');
        $lock->execute([$orderId]);
        $locked=$lock->fetch();
        if(!$locked){$pdo->commit();return null;}
        if(normalize_order_status((string)$locked['status'])==='delivered'){$pdo->commit();return order_by_id($orderId);}

        $order=order_by_id($orderId);
        if(!$order)throw new RuntimeException('ORDER_NOT_FOUND');
        $formatted=delivery_template_for_order($order,$deliveryText);
        $reward=(int)($locked['referrer_reward_amount']??0);

        if(!empty($locked['referrer_id'])&&$reward===0){
            $rq=$pdo->prepare('SELECT * FROM users WHERE id=? FOR UPDATE');
            $rq->execute([(int)$locked['referrer_id']]);
            $ref=$rq->fetch();
            if($ref&&!user_is_blocked($ref)){
                $base=(($order['commission_type']??'none')==='percent')
                    ? (int)floor((int)$locked['final_amount']*(int)($order['commission_value']??0)/100)
                    : ((($order['commission_type']??'none')==='fixed')?(int)($order['commission_value']??0):0);
                if($base>0){
                    $vip=vip_info((int)$ref['referrals_count']);
                    $reward=(int)round($base*(float)$vip['multiplier']);
                    if($reward>0){
                        add_balance((int)$ref['id'],$reward,'shop_commission','پورسانت سفارش #'.$orderId,(int)$locked['user_id']);
                        $notifyRef=['telegram_id'=>(int)$ref['telegram_id'],'reward'=>$reward];
                    }
                }
            }
        }

        $u=$pdo->prepare('UPDATE orders SET status="delivered",delivery_text=?,referrer_reward_amount=?,delivered_at=NOW() WHERE id=? AND status<>"delivered"');
        $u->execute([$formatted,$reward,$orderId]);
        if($u->rowCount()!==1)throw new RuntimeException('ORDER_DELIVERY_RACE');
        add_order_event($orderId,'delivered','سفارش تحویل داده شد','تحویل دستی/نیمه‌اتوماتیک انجام شد',true);
        $pdo->commit();
    } catch(Throwable $e) {
        if($pdo->inTransaction())$pdo->rollBack();
        throw $e;
    }

    $deliveredFresh=order_by_id($orderId);if($deliveredFresh)notify_user_event((int)$deliveredFresh['user_id'],'delivered','سفارش تحویل داده شد',order_catalog_display_name($deliveredFresh),$orderId);

    if($notifyRef){
        try {
            send_msg((int)$notifyRef['telegram_id'],"🎁 زیرمجموعه شما خرید انجام داد و سفارش تحویل شد.\nپورسانت: <b>".money((int)$notifyRef['reward'])."</b>\nسفارش: <code>#{$orderId}</code>",main_menu_keyboard(is_full_admin((int)$notifyRef['telegram_id'])));
        } catch(Throwable $e) { error_log('[Referral commission notify] '.$e->getMessage()); }
    }
    return order_by_id($orderId);
}
function auto_deliver_order(int $orderId): ?array {
    $order=order_by_id($orderId); if (!$order) return null;
    $item = reserve_inventory_for_order($order);
    if (!$item) return null;
    return deliver_order($orderId, (string)$item['content']);
}
function inventory_count(int $productId, ?int $variantId=null): int {
    if ($variantId) { $q=db()->prepare('SELECT COUNT(*) c FROM inventory_items WHERE product_id=? AND (variant_id=? OR variant_id IS NULL) AND status="available"'); $q->execute([$productId,$variantId]); }
    else { $q=db()->prepare('SELECT COUNT(*) c FROM inventory_items WHERE product_id=? AND status="available"'); $q->execute([$productId]); }
    return (int)$q->fetch()['c'];
}

function refresh_crypto_order_amount_if_open(int $orderId): ?array {
    $order = order_by_id($orderId);
    if (!$order || ($order['payment_method'] ?? '') !== 'crypto') return $order;
    if (!in_array(normalize_order_status($order['status']), ['pending_payment','rejected'], true)) return $order;
    $check = get_crypto_check_by_order($orderId);
    if (!$check || !empty($check['tx_hash']) || !in_array((string)$check['status'], ['waiting_hash','pending'], true)) return $order;
    if ((string)$check['status'] === 'pending') return $order;
    $wallet = crypto_wallet_by_id((int)$check['wallet_id']);
    if (!$wallet || !(int)$wallet['is_active']) return $order;
    $rate = crypto_rate_toman((string)($wallet['rate_symbol'] ?: $wallet['asset']), false);
    if ($rate <= 0) return $order;
    $markup = max(0, (float)setting('crypto_rate_markup_percent','1')) / 100;
    $expected = round(((int)$order['final_amount'] / $rate) * (1 + $markup), 6);
    $meta = crypto_rate_meta((string)($wallet['rate_symbol'] ?: $wallet['asset']));
    $details = json_decode((string)($order['payment_details'] ?? '{}'), true);
    if (!is_array($details)) $details = [];
    $details = array_merge($details, [
        'wallet_id'=>(int)$wallet['id'], 'network'=>$wallet['network'], 'asset'=>$wallet['asset'], 'address'=>$wallet['address'],
        'expected_amount'=>$expected, 'rate_toman'=>$rate, 'rate_source'=>$meta['source'], 'rate_updated_at'=>$meta['updated_at'],
        'markup_percent'=>(float)setting('crypto_rate_markup_percent','1'), 'fee_note'=>'کارمزد صرافی/شبکه با پرداخت‌کننده است. مبلغ درج‌شده باید دقیقاً به کیف پول مقصد برسد.'
    ]);
    db()->prepare('UPDATE orders SET payment_details=?, crypto_amount=?, crypto_asset=?, crypto_network=? WHERE id=?')
        ->execute([json_encode($details, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES), (string)$expected, $wallet['asset'], $wallet['network'], $orderId]);
    db()->prepare('UPDATE crypto_payment_checks SET expected_amount=?, rate_toman=?, rate_updated_at=NOW(), rate_source=? WHERE order_id=? AND (tx_hash IS NULL OR tx_hash="")')
        ->execute([(string)$expected, (string)$rate, (string)$meta['source'], $orderId]);
    return order_by_id($orderId);
}


function validate_service_delivery_url(string $url): string {
    // Subscription URLs frequently use non-standard HTTPS ports (for example :2096).
    // Normalize harmless pasted whitespace first, then validate scheme/host/port explicitly.
    $url = preg_replace('/[\x{200B}-\x{200D}\x{FEFF}]/u', '', trim($url));
    if ($url === '' || strlen($url) > 4096 || preg_match('/[\r\n\x00]/', $url)) throw new RuntimeException('SERVICE_URL_INVALID');
    $parts = @parse_url($url);
    if (!is_array($parts) || strtolower((string)($parts['scheme'] ?? '')) !== 'https' || empty($parts['host'])) {
        throw new RuntimeException('SERVICE_URL_HTTPS_REQUIRED');
    }
    if (!empty($parts['user']) || !empty($parts['pass'])) throw new RuntimeException('SERVICE_URL_USERINFO_BLOCKED');
    if (isset($parts['port'])) {
        $port=(int)$parts['port'];
        if($port < 1 || $port > 65535) throw new RuntimeException('SERVICE_URL_INVALID_PORT');
    }
    $host = strtolower(rtrim((string)$parts['host'], '.'));
    if ($host === 'localhost' || str_ends_with($host, '.local') || str_ends_with($host, '.internal')) {
        throw new RuntimeException('SERVICE_URL_HOST_BLOCKED');
    }
    if (filter_var($host, FILTER_VALIDATE_IP)) {
        if (filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
            throw new RuntimeException('SERVICE_URL_HOST_BLOCKED');
        }
    } elseif (!preg_match('/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i', $host)) {
        throw new RuntimeException('SERVICE_URL_HOST_INVALID');
    }
    return $url;
}

function set_order_service_delivery(int $orderId, string $url, string $title='', string $note='', bool $markDelivered=true): ?array {
    $order = order_by_id($orderId);
    if (!$order) return null;
    $url = validate_service_delivery_url($url);
    $title = trim($title) ?: 'مدیریت سرویس';
    if (mb_strlen($title) > 120) $title = mb_substr($title, 0, 120);
    db()->prepare('UPDATE orders SET delivery_url=?, delivery_title=? WHERE id=?')->execute([$url, $title, $orderId]);
    if ($markDelivered) {
        $fresh = order_by_id($orderId);
        if ($fresh && normalize_order_status((string)$fresh['status']) !== 'delivered') {
            $note = trim($note) ?: 'سرویس شما آماده است. از جزئیات سفارش می‌توانید لینک سرویس را باز یا کپی کنید.';
            deliver_order($orderId, $note);
        }
    }
    add_order_event($orderId, 'delivered', 'لینک سرویس ثبت شد', 'لینک مستقیم تحویل برای مشتری فعال شد', true);
    return order_by_id($orderId);
}

function create_renewal_order_from_order(int $userId, int $oldOrderId): array {
    $old=order_by_id($oldOrderId);
    if(!$old || (int)$old['user_id'] !== $userId) throw new RuntimeException('ORDER_NOT_FOUND');
    if(normalize_order_status((string)$old['status']) !== 'delivered') throw new RuntimeException('ORDER_NOT_RENEWABLE');
    $order=create_storefront_order($userId,(int)$old['product_id'],!empty($old['variant_id'])?(int)$old['variant_id']:null,null);
    $carryUrl=null;$carryTitle=null;
    if(normalize_delivery_type((string)($old['delivery_type']??'manual'))==='vpn' && !empty($old['delivery_url'])){
        try{$carryUrl=validate_service_delivery_url((string)$old['delivery_url']);}catch(Throwable $e){$carryUrl=null;}
        $carryTitle=trim((string)($old['delivery_title']??'')) ?: 'مدیریت سرویس';
    }
    db()->prepare('UPDATE orders SET is_renewal=1, renewal_of_order_id=?, delivery_url=COALESCE(?,delivery_url), delivery_title=COALESCE(?,delivery_title) WHERE id=?')
        ->execute([$oldOrderId,$carryUrl,$carryTitle,(int)$order['id']]);
    add_order_event((int)$order['id'],'pending_payment','سفارش تمدید ثبت شد','تمدید سفارش #'.$oldOrderId,true);
    return order_by_id((int)$order['id']);
}

function wishlist_product_ids(int $userId): array {
    if (!table_exists('user_wishlists')) return [];
    $q=db()->prepare('SELECT product_id FROM user_wishlists WHERE user_id=? ORDER BY created_at DESC');$q->execute([$userId]);
    return array_map('intval',$q->fetchAll(PDO::FETCH_COLUMN)?:[]);
}
function toggle_user_wishlist(int $userId,int $productId): array {
    $p=shop_product($productId);if(!$p||(int)($p['is_active']??0)!==1)throw new RuntimeException('PRODUCT_NOT_FOUND');
    $q=db()->prepare('SELECT 1 FROM user_wishlists WHERE user_id=? AND product_id=?');$q->execute([$userId,$productId]);
    if($q->fetchColumn()){db()->prepare('DELETE FROM user_wishlists WHERE user_id=? AND product_id=?')->execute([$userId,$productId]);$active=false;}
    else{db()->prepare('INSERT IGNORE INTO user_wishlists (user_id,product_id) VALUES (?,?)')->execute([$userId,$productId]);$active=true;}
    return ['active'=>$active,'ids'=>wishlist_product_ids($userId)];
}
function notify_user_event(int $userId,string $type,string $title,string $body='',?int $orderId=null): void {
    if($userId<=0||!table_exists('user_notifications'))return;
    try{db()->prepare('INSERT INTO user_notifications (user_id,type,title,body,order_id) VALUES (?,?,?,?,?)')->execute([$userId,mb_substr($type,0,32),mb_substr($title,0,255),mb_substr($body,0,1000),$orderId]);}catch(Throwable $e){}
}
function user_notifications(int $userId,int $limit=30): array {
    if(!table_exists('user_notifications'))return [];$limit=max(1,min(100,$limit));
    $q=db()->prepare('SELECT id,type,title,body,order_id,is_read,created_at FROM user_notifications WHERE user_id=? ORDER BY id DESC LIMIT '.$limit);$q->execute([$userId]);
    return array_map(function($r){$r['id']=(int)$r['id'];$r['order_id']=$r['order_id']!==null?(int)$r['order_id']:null;$r['is_read']=(int)$r['is_read'];return $r;},$q->fetchAll()?:[]);
}
function mark_user_notifications_read(int $userId): void {if(table_exists('user_notifications'))db()->prepare('UPDATE user_notifications SET is_read=1 WHERE user_id=? AND is_read=0')->execute([$userId]);}
function user_notification_unread_count(int $userId): int {if(!table_exists('user_notifications'))return 0;$q=db()->prepare('SELECT COUNT(*) FROM user_notifications WHERE user_id=? AND is_read=0');$q->execute([$userId]);return (int)$q->fetchColumn();}
function user_active_services(int $userId,int $limit=12): array {
    $rows=user_orders($userId,80,true);$seen=[];$out=[];$now=time();
    foreach($rows as $o){if(normalize_order_status((string)$o['status'])!=='delivered')continue;if(!empty($o['expires_at'])&&strtotime((string)$o['expires_at'])<$now)continue;
        $key=!empty($o['catalog_plan_id'])?'p'.(int)$o['catalog_plan_id']:'l'.(int)$o['product_id'].'v'.(int)($o['variant_id']??0);if(isset($seen[$key]))continue;$seen[$key]=1;
        $x=order_public_payload($o);$x['renewable']=1;$out[]=$x;if(count($out)>=$limit)break;
    }return $out;
}
function order_public_payload(array $o, bool $is_admin = false): array {
    if (!empty($o['id']) && ($o['payment_method'] ?? '') === 'crypto') { $o = refresh_crypto_order_amount_if_open((int)$o['id']) ?: $o; }
    $name = order_catalog_display_name($o);
    $status = normalize_order_status($o['status']);
    $pmtExpiresAt = $o['payment_expires_at'] ?? null;
    if (!$pmtExpiresAt && $status === 'pending_payment') {
        $pmtExpiresAt = !empty($o['created_at']) ? date('Y-m-d H:i:s', strtotime($o['created_at']) + setting_int('order_expiry_minutes', 20) * 60) : date('Y-m-d H:i:s', time() + setting_int('order_expiry_minutes', 20) * 60);
    }
    $pmtRemainingSec = 0;
    if ($status === 'pending_payment') {
        $rem = $pmtExpiresAt ? (strtotime($pmtExpiresAt) - time()) : 0;
        $pmtRemainingSec = max(0, $rem > 0 ? $rem : setting_int('order_expiry_minutes', 20) * 60);
        if (!$o['payment_expires_at'] && $pmtExpiresAt) {
            $pmtExpiresAt = date('Y-m-d H:i:s', time() + $pmtRemainingSec);
        }
    }

    $payload = [
        'id'=>(int)$o['id'], 'product_name'=>$o['product_name'], 'variant_title'=>$o['variant_title'] ?? null, 'display_name'=>$name,
        'catalog_service_id'=>isset($o['catalog_service_id']) && $o['catalog_service_id'] !== null ? (int)$o['catalog_service_id'] : null,
        'catalog_group_id'=>isset($o['catalog_group_id']) && $o['catalog_group_id'] !== null ? (int)$o['catalog_group_id'] : null,
        'catalog_plan_id'=>isset($o['catalog_plan_id']) && $o['catalog_plan_id'] !== null ? (int)$o['catalog_plan_id'] : null,
        'service_name_snapshot'=>$o['service_name_snapshot'] ?? null,
        'group_name_snapshot'=>$o['group_name_snapshot'] ?? null,
        'plan_name_snapshot'=>$o['plan_name_snapshot'] ?? null,
        'image_url'=>$o['image_url'] ?? null, 'amount'=>(int)$o['amount'], 'discount_amount'=>(int)$o['discount_amount'],
        'variant_discount_percent'=>(int)($o['variant_discount_percent'] ?? 0),
        'wallet_amount'=>(int)($o['wallet_amount'] ?? 0), 'final_amount'=>(int)$o['final_amount'], 'coupon_code'=>$o['coupon_code'],
        'price_currency'=>normalize_price_currency($o['price_currency'] ?? 'IRT'), 'price_usd'=>isset($o['price_usd']) && $o['price_usd'] !== null ? (float)$o['price_usd'] : null, 'usd_rate_toman'=>isset($o['usd_rate_toman']) && $o['usd_rate_toman'] !== null ? (float)$o['usd_rate_toman'] : null, 'usd_rate_source'=>$o['usd_rate_source'] ?? null, 'usd_rate_updated_at'=>$o['usd_rate_updated_at'] ?? null,
        'payment_method'=>$o['payment_method'] ?? null, 'payment_method_fa'=>payment_method_fa($o['payment_method'] ?? null), 'payment_details'=>$o['payment_details'] ?? null, 'stars_amount'=>(int)($o['stars_amount'] ?? 0),
        'crypto_amount'=>isset($o['crypto_amount'])?(float)$o['crypto_amount']:null, 'crypto_asset'=>$o['crypto_asset'] ?? null, 'crypto_network'=>$o['crypto_network'] ?? null, 'crypto_check'=>crypto_check_payload(get_crypto_check_by_order((int)$o['id'])), 'crypto_fee_notice'=>'این مبلغ باید دقیقاً به کیف پول مقصد برسد؛ کارمزد صرافی/شبکه بر عهده شماست.', 'swapwallet_invoice'=>null,
        'status'=>$status, 'status_fa'=>order_status_fa($o['status']),
        'is_renewal'=>(int)($o['is_renewal'] ?? 0), 'renewal_of_order_id'=>!empty($o['renewal_of_order_id'])?(int)$o['renewal_of_order_id']:null,
        'payment_note'=>$o['payment_note'] ?? null, 'customer_note'=>$o['customer_note'] ?? null, 'receipt_file_id'=>$o['receipt_file_id'] ?? null, 'receipt_url'=>!empty($o['receipt_file_id'])?('/'.ltrim((string)$o['receipt_file_id'],'/')):null,
        'user_id'=>(int)($o['user_id'] ?? 0), 'telegram_id'=>isset($o['telegram_id'])?(int)$o['telegram_id']:null, 'username'=>$o['username'] ?? null, 'first_name'=>$o['first_name'] ?? null,
        'delivery_type'=>$o['delivery_type'], 'delivery_type_fa'=>delivery_type_fa($o['delivery_type']), 'delivery_text'=>$o['delivery_text'],
        'has_service_delivery'=>($status === 'delivered' && !empty($o['delivery_url'])),
        'has_service_viewer'=>($status === 'delivered' && !empty($o['delivery_url'])), // compatibility with v1.4 clients
        'service_title'=>trim((string)($o['delivery_title'] ?? '')) ?: 'مدیریت سرویس',
        'service_url'=>($status === 'delivered' && !empty($o['delivery_url'])) ? (string)$o['delivery_url'] : null,
        'expires_at'=>$o['expires_at'] ?? null,
        'payment_expires_at'=>$pmtExpiresAt,
        'payment_remaining_seconds'=>$pmtRemainingSec,
        'timeline'=>array_map(function($e){ return ['status'=>$e['status'], 'title'=>$e['title'], 'note'=>$e['note'], 'created_at'=>$e['created_at']]; }, order_timeline((int)$o['id'], true)),
        'user_hidden'=>(int)($o['user_hidden'] ?? 0), 'archived_at'=>$o['archived_at'] ?? null, 'created_at'=>$o['created_at']
    ];
    if ($is_admin) {
        $payload['admin_note'] = $o['admin_note'] ?? null;
        $payload['delivery_url'] = $o['delivery_url'] ?? null;
        $payload['delivery_title'] = $o['delivery_title'] ?? null;
    }
    return $payload;
}
function customer_stats(int $userId): array {
    $q=db()->prepare('SELECT COUNT(*) orders_count, COALESCE(SUM(final_amount),0) total_spent FROM orders WHERE user_id=? AND status="delivered"');
    $q->execute([$userId]); $row=$q->fetch() ?: ['orders_count'=>0,'total_spent'=>0];
    $spent=(int)$row['total_spent'];
    if ($spent >= 10000000) $tier=['name'=>'Diamond','fa'=>'دایموند','emoji'=>'💎'];
    elseif ($spent >= 5000000) $tier=['name'=>'Gold','fa'=>'گلد','emoji'=>'🥇'];
    elseif ($spent >= 1000000) $tier=['name'=>'Silver','fa'=>'سیلور','emoji'=>'🥈'];
    else $tier=['name'=>'Bronze','fa'=>'برنز','emoji'=>'🥉'];
    return ['orders_count'=>(int)$row['orders_count'], 'total_spent'=>$spent, 'tier'=>$tier];
}
function sales_report(): array {
    $today=db()->query('SELECT COUNT(*) c, COALESCE(SUM(final_amount),0) s FROM orders WHERE DATE(created_at)=CURDATE() AND status IN ("payment_confirmed","preparing","delivered")')->fetch();
    $month=db()->query('SELECT COUNT(*) c, COALESCE(SUM(final_amount),0) s FROM orders WHERE YEAR(created_at)=YEAR(CURDATE()) AND MONTH(created_at)=MONTH(CURDATE()) AND status IN ("payment_confirmed","preparing","delivered")')->fetch();
    $pending=db()->query('SELECT COUNT(*) c FROM orders WHERE status IN ("receipt_submitted","reviewing","payment_confirmed","preparing")')->fetch();
    $top=db()->query('SELECT p.name, COUNT(*) c, COALESCE(SUM(o.final_amount),0) s FROM orders o JOIN products p ON p.id=o.product_id WHERE o.status="delivered" GROUP BY p.id ORDER BY s DESC LIMIT 5')->fetchAll();
    return ['today'=>$today,'month'=>$month,'pending'=>(int)$pending['c'],'top'=>$top];
}

/* ===== Customer 360, referrals and coupon admin helpers ===== */
function user_referrals_list(int $userId): array {
    $q=db()->prepare('SELECT u.id, u.telegram_id, u.username, u.first_name, u.created_at, r.reward_amount, r.created_at AS joined_at,
        (SELECT COUNT(*) FROM orders o WHERE o.user_id=u.id AND o.status="delivered") AS orders_count,
        (SELECT COALESCE(SUM(final_amount),0) FROM orders o WHERE o.user_id=u.id AND o.status="delivered") AS total_spent
        FROM referrals r JOIN users u ON u.id=r.referred_id WHERE r.referrer_id=? ORDER BY r.created_at DESC LIMIT 100');
    $q->execute([$userId]); return $q->fetchAll();
}
function admin_customer_view(int $userId): array {
    $u=get_user_by_id($userId); if(!$u) throw new RuntimeException('USER_NOT_FOUND');
    $orders=admin_orders(null,100,'',false);
    $userOrders=array_values(array_filter($orders, fn($o)=>(int)$o['user_id']===$userId));
    $spent=array_reduce($userOrders, fn($s,$o)=>$s+(int)(($o['status']==='delivered')?$o['final_amount']:0), 0);
    $txQ=db()->prepare('SELECT * FROM transactions WHERE user_id=? ORDER BY id DESC LIMIT 30'); $txQ->execute([$userId]);
    return ['user'=>['id'=>(int)$u['id'],'telegram_id'=>(int)$u['telegram_id'],'username'=>$u['username'],'first_name'=>$u['first_name'],'balance'=>(int)$u['balance'],'total_earned'=>(int)$u['total_earned'],'referrals_count'=>(int)$u['referrals_count'],'phone_number'=>$u['phone_number'],'created_at'=>$u['created_at']], 'customer_stats'=>customer_stats($userId), 'orders'=>array_map('order_public_payload',$userOrders), 'transactions'=>$txQ->fetchAll(), 'total_spent'=>$spent];
}

function admin_list_coupons(): array {
    return db()->query('SELECT * FROM coupons ORDER BY id DESC LIMIT 200')->fetchAll();
}
function admin_add_coupon(string $code, string $type, int $value, int $maxUses, string $expiresAt='', int $minOrderAmount=0, int $maxUsesPerUser=1, ?int $categoryId=null): array {
    $code=normalize_coupon_code($code); if($code==='') throw new RuntimeException('INVALID_CODE');
    if(!in_array($type,['percent','fixed'],true)) $type='percent';
    if($value<0) $value=0;
    $exists=coupon_by_code($code); if($exists) throw new RuntimeException('CODE_TAKEN');
    $exp=$expiresAt&&strtotime($expiresAt)?date('Y-m-d H:i:s',strtotime($expiresAt)):null;
    db()->prepare('INSERT INTO coupons (code,type,value,min_order_amount,max_uses,max_uses_per_user,category_id,used_count,is_active,expires_at) VALUES (?,?,?,?,?,?,?,0,1,?)')
        ->execute([$code,$type,$value,max(0,$minOrderAmount),max(0,$maxUses),max(1,$maxUsesPerUser),$categoryId?:null,$exp]);
    return admin_list_coupons();
}
function admin_update_coupon(int $couponId, array $fields): array {
    $sets=[];$params=[];
    foreach(['code','type','value','max_uses','is_active'] as $f){ if(array_key_exists($f,$fields)){$sets[]=$f.'=?';$params[]=($f==='is_active')?(int)(bool)$fields[$f]:$fields[$f];} }
    if(array_key_exists('expires_at',$fields)){$exp=$fields['expires_at']&&strtotime($fields['expires_at'])?date('Y-m-d H:i:s',strtotime($fields['expires_at'])):null;$sets[]='expires_at=?';$params[]=$exp;}
    if(!$sets) return admin_list_coupons();
    $params[]=$couponId;
    db()->prepare('UPDATE coupons SET '.implode(',',$sets).' WHERE id=?')->execute($params);
    return admin_list_coupons();
}
function admin_delete_coupon(int $couponId): array {
    db()->prepare('DELETE FROM coupons WHERE id=?')->execute([$couponId]);
    return admin_list_coupons();
}

/* ===== Batch 3 backend: activity log, admin roles, flash sale, achievements, reorder, advanced search ===== */
function admin_role(int $telegramId): string {
    if(in_array($telegramId,array_map('intval',app_config('ADMIN_IDS',[])),true))return 'full';
    if(!table_exists('admin_roles'))return 'none';$q=db()->prepare('SELECT role FROM admin_roles WHERE telegram_id=?');$q->execute([$telegramId]);$r=$q->fetch();return $r?((string)$r['role']):'none';
}
function admin_can(int $telegramId, string $perm): bool {
    $role=admin_role($telegramId);if($role==='full')return true;if($role==='none')return false;
    $map=['orders'=>['dashboard','orders'],'products'=>['dashboard','products','catalog','inventory','coupons'],'finance'=>['dashboard','finance']];return in_array($perm,$map[$role]??[],true);
}
function log_admin_action(int $adminTid, string $action, string $entityType='', int $entityId=0, string $details=''): void {
    try{ db()->prepare('INSERT INTO admin_activity_log (admin_telegram_id,action,entity_type,entity_id,details) VALUES (?,?,?,?,?)')->execute([$adminTid,$action,$entityType?:null,$entityId?:null,$details?:null]); }catch(Throwable $e){}
}
function admin_activity_log(int $limit=100): array {
    return db()->prepare('SELECT * FROM admin_activity_log ORDER BY id DESC LIMIT '.(int)$limit)->fetchAll() ?: [];
}
function admin_list_roles(): array {
    return db()->query('SELECT * FROM admin_roles ORDER BY id DESC')->fetchAll() ?: [];
}
function admin_set_role(int $telegramId, string $role, string $displayName=''): array {
    if(!in_array($role,['full','orders','products','finance','none'],true)) $role='full';
    db()->prepare('INSERT INTO admin_roles (telegram_id,role,display_name) VALUES (?,?,?) ON DUPLICATE KEY UPDATE role=VALUES(role),display_name=VALUES(display_name)')->execute([$telegramId,$role,$displayName?:null]);
    return admin_list_roles();
}
function admin_remove_role(int $telegramId): array {
    db()->prepare('DELETE FROM admin_roles WHERE telegram_id=?')->execute([$telegramId]);
    return admin_list_roles();
}
function queue_broadcast_job(int $adminTid,string $text,string $method='sendMessage',?string $field=null,?string $fileId=null): array {
    $pdo=db();$pdo->beginTransaction();try{$ids=$pdo->query('SELECT telegram_id FROM users WHERE telegram_id IS NOT NULL AND telegram_id>0 AND telegram_id<9000000000 AND is_banned=0 AND deleted_at IS NULL')->fetchAll(PDO::FETCH_COLUMN);$ids=array_values(array_unique(array_map('intval',$ids)));$q=$pdo->prepare('INSERT INTO broadcast_jobs (admin_telegram_id,text,telegram_method,media_field,telegram_file_id,total_count) VALUES (?,?,?,?,?,?)');$q->execute([$adminTid,$text,$method,$field,$fileId,count($ids)]);$jobId=(int)$pdo->lastInsertId();$ins=$pdo->prepare('INSERT IGNORE INTO broadcast_job_recipients (job_id,telegram_id) VALUES (?,?)');foreach($ids as $tid)if($tid>0)$ins->execute([$jobId,$tid]);$pdo->commit();return ['id'=>$jobId,'total_count'=>count($ids),'status'=>'queued'];}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}
function process_broadcast_jobs(int $limit=40): array {
    if(!table_exists('broadcast_jobs')||!table_exists('broadcast_job_recipients'))return ['processed'=>0,'sent'=>0,'failed'=>0];
    $limit=max(1,min(100,$limit));$pdo=db();$locked=false;
    try{
        $l=$pdo->query("SELECT GET_LOCK('bluegate_broadcast_worker',0) l")->fetch();$locked=!empty($l['l']);
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
        if($locked){try{$pdo->query("SELECT RELEASE_LOCK('bluegate_broadcast_worker')");}catch(Throwable $e){}}
    }
}
function admin_reorder_products(array $orderedIds): array {
    foreach($orderedIds as $i=>$id){ db()->prepare('UPDATE products SET sort_order=? WHERE id=?')->execute([(int)$i+1,(int)$id]); }
    return shop_products(null,false);
}
function admin_reorder_categories(array $orderedIds): array {
    foreach($orderedIds as $i=>$id){ db()->prepare('UPDATE product_categories SET sort_order=? WHERE id=?')->execute([(int)$i+1,(int)$id]); }
    return shop_categories(false);
}
function admin_search_orders(string $search, string $status='all', int $limit=80): array {
    $sql='SELECT o.*, p.name product_name, p.delivery_type, p.image_url, v.title variant_title, u.telegram_id, u.username, u.first_name
        FROM orders o JOIN products p ON p.id=o.product_id LEFT JOIN product_variants v ON v.id=o.variant_id JOIN users u ON u.id=o.user_id';
    $where=['o.archived_at IS NULL'];$params=[];
    if($status!=='all'&&$status!==''){ $where[]='o.status=?';$params[]=normalize_order_status($status); }
    if($search!==''){
        if(ctype_digit($search)){ $where[]='(o.id=? OR u.telegram_id=?)';$params[]=(int)$search;$params[]=(int)$search; }
        else { $where[]='(u.username LIKE ? OR u.first_name LIKE ? OR p.name LIKE ? OR v.title LIKE ?)';$like='%'.$search.'%';$params[]=$like;$params[]=$like;$params[]=$like;$params[]=$like; }
    }
    $sql.=' WHERE '.implode(' AND ',$where).' ORDER BY o.id DESC LIMIT '.(int)$limit;
    $q=db()->prepare($sql);$q->execute($params);return $q->fetchAll();
}
function user_achievements(array $user): array {
    $ref=(int)$user['referrals_count'];$earned=(int)$user['total_earned'];$spent=(int)($user['customer']['total_spent']??0);
    $ordersQ=db()->prepare('SELECT COUNT(*) c FROM orders WHERE user_id=? AND status="delivered"');$ordersQ->execute([$user['id']]);$orders=(int)$ordersQ->fetch()['c'];
    $spinQ=db()->prepare('SELECT COUNT(*) c FROM spin_logs WHERE user_id=?');$spinQ->execute([$user['id']]);$spins=(int)$spinQ->fetch()['c'];
    $defs=[
        ['key'=>'first_order','title'=>'اولین خرید','emoji'=>'🛒','cond'=>$orders>=1],
        ['key'=>'ten_orders','title'=>'۱۰ سفارش','emoji'=>'🧾','cond'=>$orders>=10],
        ['key'=>'first_ref','title'=>'اولین دعوت','emoji'=>'👋','cond'=>$ref>=1],
        ['key'=>'ten_refs','title'=>'۱۰ زیرمجموعه','emoji'=>'👥','cond'=>$ref>=10],
        ['key'=>'fifty_refs','title'=>'۵۰ زیرمجموعه','emoji'=>'🌟','cond'=>$ref>=50],
        ['key'=>'earn_100k','title'=>'۱۰۰ هزار درآمد','emoji'=>'💰','cond'=>$earned>=100000],
        ['key'=>'earn_1m','title'=>'۱ میلیون درآمد','emoji'=>'💎','cond'=>$earned>=1000000],
        ['key'=>'first_spin','title'=>'اولین چرخش','emoji'=>'🎡','cond'=>$spins>=1],
        ['key'=>'gold_tier','title'=>'مشتری گلد','emoji'=>'🥇','cond'=>$spent>=5000000],
    ];
    return array_map(fn($a)=>array_merge($a,['earned'=>(bool)$a['cond']]),$defs);
}
function admin_revenue_forecast(): array {
    $last30=db()->query('SELECT COALESCE(SUM(final_amount),0) s, COUNT(*) c FROM orders WHERE created_at >= DATE_SUB(NOW(),INTERVAL 30 DAY) AND status IN ("payment_confirmed","preparing","delivered")')->fetch();
    $prev30=db()->query('SELECT COALESCE(SUM(final_amount),0) s FROM orders WHERE created_at >= DATE_SUB(NOW(),INTERVAL 60 DAY) AND created_at < DATE_SUB(NOW(),INTERVAL 30 DAY) AND status IN ("payment_confirmed","preparing","delivered")')->fetch();
    $dailyAvg=(int)($last30['s']/30);
    $forecast=$dailyAvg*30;
    $change=$prev30['s']>0?round((($last30['s']-$prev30['s'])/$prev30['s'])*100,1):0;
    return ['last30_sum'=>(int)$last30['s'],'last30_count'=>(int)$last30['c'],'daily_avg'=>$dailyAvg,'forecast'=>$forecast,'change_percent'=>$change];
}


// Admin Shop UX v2 helpers: image upload, delete-safe management and step-by-step wizards.
function parse_amount($value): int { return max(0, (int)preg_replace('/\D+/', '', (string)$value)); }
function parse_float_amount($value): float {
    $val = str_replace(',', '.', trim((string)$value));
    return max(0.0, (float)preg_replace('/[^0-9.]/', '', $val));
}
function step_payload_array(array $user): array {
    $raw = (string)($user['step_payload'] ?? '');
    $d = json_decode($raw, true);
    return is_array($d) ? $d : [];
}
function set_step_payload(int $telegram_id, string $step, array $payload): void { set_step($telegram_id, $step, json_encode($payload, JSON_UNESCAPED_UNICODE)); }
function shop_cancel_keyboard(): string { return json_markup(['inline_keyboard'=>[[['text'=>'❌ لغو و بازگشت', 'callback_data'=>'adm_shop']]]]); }
function public_base_url(): string { return rtrim((string)app_config('PUBLIC_BASE_URL',''), '/'); }
function public_url_for_path(string $relative): string { return public_base_url() . '/' . ltrim($relative, '/'); }
function telegram_file_to_public_url(string $fileId, string $folder='shop'): ?string {
    $info = tg('getFile', ['file_id'=>$fileId]);
    if (empty($info['ok']) || empty($info['result']['file_path'])) return null;
    $filePath = $info['result']['file_path'];
    $ext = pathinfo($filePath, PATHINFO_EXTENSION) ?: 'jpg';
    $safe = preg_replace('/[^A-Za-z0-9_\-]/', '', substr($fileId, 0, 28));
    $dir = __DIR__ . '/../public/uploads/' . trim($folder, '/') . '/' . date('Ymd');
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    $relative = 'uploads/' . trim($folder, '/') . '/' . date('Ymd') . '/' . $safe . '.' . $ext;
    $dest = __DIR__ . '/../public/' . $relative;
    $url = 'https://api.telegram.org/file/bot' . app_config('BOT_TOKEN') . '/' . $filePath;
    $bin = @file_get_contents($url);
    if ($bin === false || strlen($bin) < 10) return null;
    file_put_contents($dest, $bin);
    return public_url_for_path($relative);
}
function image_url_from_message(array $message, string $folder='shop'): ?string {
    $text = trim((string)($message['text'] ?? $message['caption'] ?? ''));
    if ($text !== '' && preg_match('/^https?:\/\//i', $text)) return $text;
    if (!empty($message['photo']) && is_array($message['photo'])) { $last = end($message['photo']); if (!empty($last['file_id'])) return telegram_file_to_public_url((string)$last['file_id'], $folder); }
    if (!empty($message['document']['file_id']) && str_starts_with((string)($message['document']['mime_type'] ?? ''), 'image/')) return telegram_file_to_public_url((string)$message['document']['file_id'], $folder);
    return null;
}
function product_rows_keyboard(string $prefix, bool $includeInactive=false): array {
    $products = shop_products(null, !$includeInactive);
    $rows=[];
    foreach ($products as $p) $rows[] = [['text'=>'#'.$p['id'].' - '.$p['name'], 'callback_data'=>$prefix.$p['id']]];
    if (!$rows) $rows[] = [['text'=>'محصولی نیست', 'callback_data'=>'adm_shop']];
    return $rows;
}
function category_rows_keyboard(string $prefix): array {
    $rows=[];
    foreach (shop_categories(true) as $c) $rows[] = [['text'=>trim(($c['emoji']?:'🛒').' '.$c['title']), 'callback_data'=>$prefix.$c['id']]];
    $rows[] = [['text'=>'بدون دسته‌بندی', 'callback_data'=>$prefix.'0']];
    return $rows;
}
function variant_rows_keyboard(int $productId, string $prefix): array {
    $rows=[];
    foreach (product_variants($productId, true) as $v) $rows[] = [['text'=>'#'.$v['id'].' - '.$v['title'].' | '.price_runtime_meta($v)['label'], 'callback_data'=>$prefix.$v['id']]];
    $rows[] = [['text'=>'بدون پلن / برای کل محصول', 'callback_data'=>$prefix.'0']];
    return $rows;
}
function soft_delete_product(int $productId): void { db()->prepare('UPDATE products SET is_active=0 WHERE id=?')->execute([$productId]); }
function soft_delete_category(int $categoryId): void { db()->prepare('UPDATE product_categories SET is_active=0 WHERE id=?')->execute([$categoryId]); }
function delete_available_inventory(int $inventoryId): bool { $q=db()->prepare('DELETE FROM inventory_items WHERE id=? AND status="available"'); $q->execute([$inventoryId]); return $q->rowCount() > 0; }
function soft_delete_variant(int $variantId): void { db()->prepare('UPDATE product_variants SET is_active=0 WHERE id=?')->execute([$variantId]); }
function set_product_image(int $productId, ?string $url): void { db()->prepare('UPDATE products SET image_url=? WHERE id=?')->execute([$url, $productId]); }
function set_category_image(int $categoryId, ?string $url): void { db()->prepare('UPDATE product_categories SET image_url=? WHERE id=?')->execute([$url, $categoryId]); }
function create_product_from_wizard(array $p): int {
    $commission = $p['commission_type'] ?? 'none'; if (!in_array($commission, ['none','fixed','percent'], true)) $commission='none';
    $pp = price_admin_payload_from_input($p);
    db()->prepare('INSERT INTO products (category_id,name,price,price_currency,price_usd,price_rate_toman,price_rate_source,price_rate_updated_at,short_description,full_description,image_url,delivery_type,commission_type,commission_value,duration_days,is_featured) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
        ->execute([!empty($p['category_id'])?(int)$p['category_id']:null, $p['name'] ?? '', $pp['price'], $pp['price_currency'], $pp['price_usd'], $pp['price_rate_toman'], $pp['price_rate_source'], $pp['price_rate_updated_at'], $p['short_description'] ?? '', $p['full_description'] ?? ($p['short_description'] ?? ''), $p['image_url'] ?? null, normalize_delivery_type($p['delivery_type'] ?? 'manual'), $commission, (int)($p['commission_value'] ?? 0), (int)($p['duration_days'] ?? 0), !empty($p['is_featured'])?1:0]);
    return (int)db()->lastInsertId();
}
function create_category_from_wizard(array $p): int {
    db()->prepare('INSERT INTO product_categories (emoji,title,image_url,sort_order,is_active) VALUES (?,?,?,?,1)')->execute([$p['emoji'] ?? '🛒', $p['title'] ?? 'دسته جدید', $p['image_url'] ?? null, 99]);
    return (int)db()->lastInsertId();
}
function inventory_items_for_admin(int $limit=80): array {
    $q=db()->prepare('SELECT i.*, p.name product_name, v.title variant_title FROM inventory_items i JOIN products p ON p.id=i.product_id LEFT JOIN product_variants v ON v.id=i.variant_id ORDER BY i.id DESC LIMIT ?');
    $q->bindValue(1, $limit, PDO::PARAM_INT); $q->execute(); return $q->fetchAll();
}


function setting_bool(string $key, bool $default=false): bool {
    $v = setting($key, $default ? '1' : '0');
    return in_array(strtolower((string)$v), ['1','true','yes','on'], true);
}
function button_colors(): array {
    return array_merge(['primary'=>'#1d9bf0','secondary'=>'#2563eb','danger'=>'#ef4444','success'=>'#22c55e','warning'=>'#f59e0b'], setting_json('button_colors', []));
}
function hard_delete_product(int $productId): bool {
    $q=db()->prepare('SELECT COUNT(*) c FROM orders WHERE product_id=?'); $q->execute([$productId]);
    if ((int)$q->fetch()['c'] > 0) return false;
    db()->prepare('DELETE FROM inventory_items WHERE product_id=?')->execute([$productId]);
    db()->prepare('DELETE FROM product_variants WHERE product_id=?')->execute([$productId]);
    db()->prepare('UPDATE products SET parent_id=NULL WHERE parent_id=?')->execute([$productId]);
    $d=db()->prepare('DELETE FROM products WHERE id=?'); $d->execute([$productId]);
    return $d->rowCount() > 0;
}
function hard_delete_category(int $categoryId): bool {
    db()->prepare('UPDATE products SET category_id=NULL WHERE category_id=?')->execute([$categoryId]);
    $d=db()->prepare('DELETE FROM product_categories WHERE id=?'); $d->execute([$categoryId]);
    return $d->rowCount() > 0;
}
function hard_delete_variant(int $variantId): bool {
    $q=db()->prepare('SELECT COUNT(*) c FROM orders WHERE variant_id=?'); $q->execute([$variantId]);
    if ((int)$q->fetch()['c'] > 0) return false;
    db()->prepare('UPDATE inventory_items SET variant_id=NULL WHERE variant_id=?')->execute([$variantId]);
    $d=db()->prepare('DELETE FROM product_variants WHERE id=?'); $d->execute([$variantId]);
    return $d->rowCount() > 0;
}
function hard_delete_inventory(int $inventoryId): bool {
    $d=db()->prepare('DELETE FROM inventory_items WHERE id=?'); $d->execute([$inventoryId]);
    return $d->rowCount() > 0;
}
function update_product_field(int $id, string $field, $value): bool {
    $allowed=['category_id','parent_id','slug','product_type','config_json','name','price','price_currency','price_usd','price_rate_toman','price_rate_source','price_rate_updated_at','short_description','full_description','image_url','image_srcset','delivery_type','commission_type','commission_value','duration_days','is_active','is_featured','flash_sale_start','flash_sale_end','flash_sale_discount'];
    if (!in_array($field,$allowed,true)) return false;
    if ($field==='price_usd') $value=decimal_price($value); elseif (in_array($field,['price','commission_value','duration_days','is_active','is_featured','flash_sale_discount'],true)) $value=(int)parse_amount($value); if ($field==='price_currency') $value=normalize_price_currency($value);
    if (in_array($field,['flash_sale_start','flash_sale_end'],true)) $value = (trim((string)$value)==='' || $value===null) ? null : date('Y-m-d H:i:s', strtotime((string)$value));
    if ($field==='category_id') $value = ((int)$value > 0) ? (int)$value : null;
    if ($field==='delivery_type') $value=normalize_delivery_type((string)$value);
    if ($field==='commission_type' && !in_array($value,['none','fixed','percent'],true)) $value='none';
    $q=db()->prepare("UPDATE products SET {$field}=? WHERE id=?"); $q->execute([$value,$id]); return true;
}
function update_category_field(int $id, string $field, $value): bool {
    $allowed=['title','emoji','image_url','sort_order','is_active']; if(!in_array($field,$allowed,true)) return false;
    if (in_array($field,['sort_order','is_active'],true)) $value=(int)parse_amount($value);
    $q=db()->prepare("UPDATE product_categories SET {$field}=? WHERE id=?"); $q->execute([$value,$id]); return true;
}
function update_variant_field(int $id, string $field, $value): bool {
    $allowed=['title','price','price_currency','price_usd','price_rate_toman','price_rate_source','price_rate_updated_at','duration_days','discount_percent','description','sort_order','is_active']; if(!in_array($field,$allowed,true)) return false;
    if ($field==='discount_percent') $value=max(0.0, min(100.0, parse_float_amount($value))); elseif ($field==='price_usd') $value=decimal_price($value); elseif (in_array($field,['price','duration_days','sort_order','is_active'],true)) $value=(int)parse_amount($value); if ($field==='price_currency') $value=normalize_price_currency($value);
    $q=db()->prepare("UPDATE product_variants SET {$field}=? WHERE id=?"); $q->execute([$value,$id]); return true;
}
function update_inventory_field(int $id, string $field, $value): bool {
    $allowed=['product_id','variant_id','content','status']; if(!in_array($field,$allowed,true)) return false;
    if (in_array($field,['product_id','variant_id'],true)) $value=((int)$value>0)?(int)$value:null;
    if ($field==='status' && !in_array($value,['available','reserved','delivered','disabled'],true)) $value='available';
    $q=db()->prepare("UPDATE inventory_items SET {$field}=? WHERE id=?"); $q->execute([$value,$id]); return true;
}


// Stable Admin Backup/Restore helpers. Backups are server-side .json.gz files under storage/backups.
function blue_backup_tables(): array {
    $preferred = [
        'settings','users','referrals','transactions','withdrawals','mission_claims','spin_logs','payment_methods',
        'product_categories','products','coupons','product_variants','store_categories','services','service_groups','service_plans','inventory_items','orders','order_events',
        'crypto_wallets','crypto_payment_checks','swapwallet_invoices'
    ];
    $existing = [];
    foreach ($preferred as $t) if (table_exists($t)) $existing[] = $t;
    try {
        $dbName = app_config('DB_NAME');
        $q = db()->prepare('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=? ORDER BY TABLE_NAME');
        $q->execute([$dbName]);
        foreach ($q->fetchAll(PDO::FETCH_COLUMN) as $t) {
            if (!in_array($t, $existing, true)) $existing[] = $t;
        }
    } catch (Throwable $e) {}
    return $existing;
}
function blue_backup_dir(): string {
    $dir = __DIR__ . '/../storage/backups';
    if (!is_dir($dir)) @mkdir($dir, 0750, true);
    if (!is_dir($dir) || !is_writable($dir)) throw new RuntimeException('BACKUP_DIR_NOT_WRITABLE');
    return $dir;
}
function blue_backup_safe_filename(string $name): string {
    $base = basename($name);
    if (!preg_match('/^blue-referral-backup-[0-9]{8}-[0-9]{6}(-before-restore)?\.json\.gz$/', $base)) throw new RuntimeException('INVALID_BACKUP_FILENAME');
    return $base;
}
function blue_backup_file_path(string $name): string {
    return blue_backup_dir() . '/' . blue_backup_safe_filename($name);
}
function blue_backup_token(string $filename, ?int $expires=null): string {
    $filename = blue_backup_safe_filename($filename);
    $expires = $expires ?: (time() + 86400);
    $secret = (string)app_config('BOT_TOKEN','') . '|' . (string)app_config('WEBHOOK_SECRET','blue-ref');
    $sig = hash_hmac('sha256', $filename.'|'.$expires, $secret);
    return rtrim(strtr(base64_encode($expires.':'.$sig), '+/', '-_'), '=');
}
function blue_backup_verify_token(string $filename, string $token): bool {
    try { $filename = blue_backup_safe_filename($filename); } catch (Throwable $e) { return false; }
    $raw = base64_decode(strtr($token, '-_', '+/'), true);
    if (!$raw || !str_contains($raw, ':')) return false;
    [$expires, $sig] = explode(':', $raw, 2);
    if ((int)$expires < time()) return false;
    $secret = (string)app_config('BOT_TOKEN','') . '|' . (string)app_config('WEBHOOK_SECRET','blue-ref');
    $calc = hash_hmac('sha256', $filename.'|'.(int)$expires, $secret);
    return hash_equals($calc, $sig);
}
function blue_backup_download_url(string $filename): string {
    $base = public_base_url();
    if ($base === '') $base = rtrim((string)app_config('MINIAPP_URL',''), '/');
    $base = preg_replace('#/miniapp/?$#', '', $base ?: '');
    $token = blue_backup_token($filename);
    return rtrim($base, '/') . '/backup_download.php?file=' . rawurlencode($filename) . '&token=' . rawurlencode($token);
}
function blue_backup_table_columns(string $table): array {
    $q = db()->query('SHOW COLUMNS FROM `'.str_replace('`','``',$table).'`');
    return array_map(fn($r)=>(string)$r['Field'], $q->fetchAll());
}
function blue_backup_create(string $suffix=''): array {
    $suffix = preg_replace('/[^A-Za-z0-9_-]/', '', $suffix);
    $filename = 'blue-referral-backup-' . date('Ymd-His') . ($suffix ? '-' . $suffix : '') . '.json.gz';
    $payload = [
        'format'=>'blue_referral_backup',
        'version'=>2,
        'created_at'=>date('c'),
        'app'=>'BlueReferral',
        'db_name'=>app_config('DB_NAME'),
        'tables'=>[],
    ];
    $totalRows = 0;
    foreach (blue_backup_tables() as $table) {
        $columns = blue_backup_table_columns($table);
        $rows = db()->query('SELECT * FROM `'.str_replace('`','``',$table).'`')->fetchAll(PDO::FETCH_ASSOC);
        $payload['tables'][$table] = ['columns'=>$columns, 'rows'=>$rows, 'count'=>count($rows)];
        $totalRows += count($rows);
    }
    $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) throw new RuntimeException('BACKUP_JSON_FAILED');
    $gz = gzencode($json, 6);
    if ($gz === false) throw new RuntimeException('BACKUP_GZIP_FAILED');
    $path = blue_backup_dir() . '/' . $filename;
    if (file_put_contents($path, $gz, LOCK_EX) === false) throw new RuntimeException('BACKUP_WRITE_FAILED');
    @chmod($path, 0640);
    set_setting('backup_last_created_at', date('Y-m-d H:i:s'));
    set_setting('backup_last_filename', $filename);
    set_setting('backup_last_size', (string)filesize($path));
    return ['filename'=>$filename, 'path'=>$path, 'size'=>filesize($path), 'rows'=>$totalRows, 'tables'=>count($payload['tables']), 'download_url'=>blue_backup_download_url($filename)];
}
function blue_backup_list(): array {
    $dir = blue_backup_dir();
    $files = glob($dir . '/blue-referral-backup-*.json.gz') ?: [];
    usort($files, fn($a,$b)=>filemtime($b)<=>filemtime($a));
    $out = [];
    foreach ($files as $path) {
        $name = basename($path);
        try { blue_backup_safe_filename($name); } catch (Throwable $e) { continue; }
        $out[] = ['filename'=>$name, 'size'=>filesize($path), 'created_at'=>date('Y-m-d H:i:s', filemtime($path)), 'download_url'=>blue_backup_download_url($name)];
    }
    return $out;
}
function blue_backup_delete(string $filename): bool {
    $path = blue_backup_file_path($filename);
    if (!is_file($path)) return false;
    return @unlink($path);
}
function blue_backup_load_payload_from_file(string $path): array {
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
function blue_backup_restore_from_file(string $path, bool $makeSafetyBackup=true): array {
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
function send_document_file($chat_id, string $path, string $caption=''): array {
    if (!is_file($path)) return ['ok'=>false,'description'=>'FILE_NOT_FOUND'];
    return tg('sendDocument', [
        'chat_id'=>$chat_id,
        'document'=>new CURLFile($path, 'application/gzip', basename($path)),
        'caption'=>$caption,
        'parse_mode'=>'HTML',
    ]);
}
function blue_backup_send_to_admin(int $telegram_id): array {
    if(!is_full_admin($telegram_id))throw new RuntimeException('ADMIN_ONLY');
    $b = blue_backup_create();
    $res = send_document_file($telegram_id, $b['path'], "💾 <b>BlueReferral backup</b>\nFile: <code>{$b['filename']}</code>\nRows: <b>{$b['rows']}</b>\nTables: <b>{$b['tables']}</b>");
    if (empty($res['ok'])) throw new RuntimeException('TELEGRAM_SEND_BACKUP_FAILED: '.($res['description'] ?? 'unknown'));
    return $b + ['telegram_sent'=>true];
}
function telegram_download_file(string $fileId, string $dest): bool {
    $info = tg('getFile', ['file_id'=>$fileId]);
    if (empty($info['ok']) || empty($info['result']['file_path'])) return false;
    $token = app_config('BOT_TOKEN');
    $url = 'https://api.telegram.org/file/bot'.$token.'/'.$info['result']['file_path'];
    $in = @fopen($url, 'rb');
    if (!$in) return false;
    $out = @fopen($dest, 'wb');
    if (!$out) { @fclose($in); return false; }
    stream_copy_to_stream($in, $out);
    fclose($in); fclose($out);
    return is_file($dest) && filesize($dest) > 0;
}


function verify_webapp_init_data(string $initData): array|false {
    $token = app_config('BOT_TOKEN');
    parse_str($initData, $data);
    if (empty($data['hash'])) return false;
    $hash = $data['hash'];
    unset($data['hash']);
    ksort($data);
    $pairs = [];
    foreach ($data as $k => $v) $pairs[] = $k . '=' . $v;
    $checkString = implode("\n", $pairs);
    $secretKey = hash_hmac('sha256', $token, 'WebAppData', true);
    $calculated = hash_hmac('sha256', $checkString, $secretKey);
    if (!hash_equals($calculated, $hash)) return false;
    if (!empty($data['auth_date']) && time() - (int)$data['auth_date'] > 86400) return false;
    return $data;
}

require_once __DIR__ . '/catalog.php';
require_once __DIR__ . '/storefront.php';
