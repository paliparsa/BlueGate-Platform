<?php
// BlueGate Platform config
// Copy this file to config.php and fill values.

$BOT_TOKEN = 'PUT_TELEGRAM_BOT_TOKEN_HERE';
$BOT_USERNAME = 'YourBotUsername'; // without @
$ADMIN_IDS = [123456789]; // numeric Telegram IDs
$SUPPORT_USERNAME = 'BlueGateSupport'; // without @
$TIMEZONE = 'Europe/Istanbul';

// Public URLs after installation
$PUBLIC_BASE_URL = 'https://your-domain.com'; // no trailing slash
$WEBHOOK_SECRET = 'change-this-random-string';
$TELEGRAM_WEBHOOK_SECRET = 'change-this-second-random-string'; // Telegram secret_token header only
$SWAPWALLET_CALLBACK_SECRET = 'change-this-third-random-string'; // SwapWallet callback URL only
$MINIAPP_URL = 'https://your-domain.com/miniapp/';
$WEB_ALLOWED_ORIGIN = ''; // optional: only needed if the storefront is hosted on another origin

// MySQL / MariaDB
$DB_HOST = 'localhost';
$DB_NAME = 'bluegate_platform';
$DB_USER = 'bluegate_user';
$DB_PASS = 'change-this-db-password';

// Rewards in Toman
$START_REWARD = 2000;
$MIN_WITHDRAW = 50000;
$PURCHASE_REWARD = 10000;

// Daily missions
$MISSION_1_TARGET = 1;
$MISSION_1_REWARD = 3000;
$MISSION_2_TARGET = 3;
$MISSION_2_REWARD = 10000;
$MISSION_3_TARGET = 5;
$MISSION_3_REWARD = 25000;

// Lucky wheel
$SPIN_REFERRALS_PER_CHANCE = 5;
$SPIN_REWARDS = [
    ['title' => '💰 ۳,۰۰۰ تومان اعتبار کیف پول',  'amount' => 3000,  'weight' => 35],
    ['title' => '💰 ۵,۰۰۰ تومان اعتبار کیف پول',  'amount' => 5000,  'weight' => 30],
    ['title' => '💰 ۱۰,۰۰۰ تومان اعتبار کیف پول', 'amount' => 10000, 'weight' => 18],
    ['title' => '💰 ۲۰,۰۰۰ تومان اعتبار کیف پول', 'amount' => 20000, 'weight' => 7],
    ['title' => '🎁 سرویس تست هدیه',              'amount' => 0,     'weight' => 10, 'notify_admin' => true],
];

$CUSTOM_CODE_MIN_REFERRALS = 3;

// Optional forced join channel. Example: @BllueGate ; leave empty to disable.
$FORCE_JOIN_CHANNEL = '';

// Mini App theme defaults. Admin can change from bot panel.
$DEFAULT_THEME_COLOR = '#1d9bf0';
$BRAND_NAME = 'BlueGate';

// Shop payment text shown under invoices. You can also edit it from admin panel.
$PAYMENT_INSTRUCTIONS = 'شماره کارت/اطلاعات پرداخت را اینجا بنویسید. بعد از پرداخت، کاربر رسید را از دکمه ارسال رسید می‌فرستد.';

// Payment methods defaults. Admin can edit them later from Mini App admin settings.
$CARD_ACCOUNTS = [
    ['title' => 'کارت اصلی BlueGate', 'card' => '6037-0000-0000-0000', 'owner' => 'نام صاحب کارت', 'sheba' => 'IR000000000000000000000000'],
];
$STARS_RATE_TOMAN = 3200; // value of 1 Telegram Star in Toman for invoice conversion.

// Crypto payments - optional. Admin can configure wallets/rates inside Mini App.
$CRYPTO_RATE_SOURCE = 'auto'; // auto = Wallex -> Ramzinex -> Nobitex -> manual/cache; or wallex/ramzinex/nobitex/manual
$CRYPTO_RATE_MARKUP_PERCENT = 1; // safety/fee markup percent
$CRYPTO_RATE_PROVIDER_PRIORITY = 'wallex,ramzinex,nobitex';
$CRYPTO_RATE_REFRESH_INTERVAL_SECONDS = 600; // cron should refresh live rates every 10 minutes
$CRYPTO_MANUAL_RATES = ['USDT' => 0, 'TRX' => 0, 'TON' => 0];
$TRONSCAN_API_KEY = ''; // optional, recommended for higher Tronscan API limits
$TONCENTER_API_KEY = ''; // optional, recommended for TON checks

