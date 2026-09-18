CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  telegram_id BIGINT NULL UNIQUE,
  username VARCHAR(255) NULL,
  web_username VARCHAR(128) NULL UNIQUE,
  email VARCHAR(255) NULL UNIQUE,
  email_verified_at DATETIME NULL,
  email_verification_token VARCHAR(64) NULL,
  email_verification_expires_at DATETIME NULL,
  password_hash VARCHAR(255) NULL,
  auth_token VARCHAR(128) NULL, /* deprecated: v2.2 stores only a SHA-256 hash */
  auth_token_hash CHAR(64) NULL,
  auth_token_expires_at DATETIME NULL,
  first_name VARCHAR(255) NULL,
  last_name VARCHAR(255) NULL,
  ref_code VARCHAR(32) NOT NULL UNIQUE,
  referrer_id BIGINT UNSIGNED NULL,
  ref_rewarded TINYINT(1) NOT NULL DEFAULT 0,
  balance BIGINT NOT NULL DEFAULT 0,
  total_earned BIGINT NOT NULL DEFAULT 0,
  total_withdrawn BIGINT NOT NULL DEFAULT 0,
  referrals_count INT NOT NULL DEFAULT 0,
  spin_balance INT NOT NULL DEFAULT 0,
  step VARCHAR(128) NULL,
  step_payload TEXT NULL,
  theme_color VARCHAR(16) NULL,
  phone_number VARCHAR(64) NULL,
  phone_verified_at DATETIME NULL,
  welcome_version_seen INT NOT NULL DEFAULT 0,
  is_banned TINYINT(1) NOT NULL DEFAULT 0,
  deleted_at DATETIME NULL,
  start_notified TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX(referrer_id),
  INDEX(auth_token),
  INDEX(auth_token_hash),
  INDEX(auth_token_expires_at),
  INDEX(is_banned),
  CONSTRAINT fk_users_referrer FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_change_requests (
  user_id BIGINT UNSIGNED PRIMARY KEY,
  old_email VARCHAR(255) NULL,
  pending_email VARCHAR(255) NULL,
  old_otp_hash VARCHAR(255) NULL,
  old_otp_expires_at DATETIME NULL,
  old_verified_at DATETIME NULL,
  new_otp_hash VARCHAR(255) NULL,
  new_otp_expires_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX(old_otp_expires_at),
  INDEX(new_otp_expires_at),
  CONSTRAINT fk_email_change_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS referrals (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  referrer_id BIGINT UNSIGNED NOT NULL,
  referred_id BIGINT UNSIGNED NOT NULL UNIQUE,
  reward_amount BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX(referrer_id),
  INDEX(referred_id),
  CONSTRAINT fk_referrals_referrer FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_referrals_referred FOREIGN KEY (referred_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS transactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  type VARCHAR(64) NOT NULL,
  amount BIGINT NOT NULL,
  description TEXT NULL,
  related_user_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX(user_id),
  INDEX(type),
  CONSTRAINT fk_transactions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS withdrawals (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  amount BIGINT NOT NULL,
  card_info VARCHAR(255) NOT NULL,
  status ENUM('pending','paid','rejected') NOT NULL DEFAULT 'pending',
  admin_note TEXT NULL,
  user_hidden TINYINT(1) NOT NULL DEFAULT 0,
  archived_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX(user_id),
  INDEX(status),
  CONSTRAINT fk_withdrawals_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mission_claims (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  mission_date DATE NOT NULL,
  target_count INT NOT NULL,
  reward_amount BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_user_date_target (user_id, mission_date, target_count),
  CONSTRAINT fk_mission_claims_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS spin_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  prize_title VARCHAR(255) NOT NULL,
  prize_amount BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX(user_id),
  CONSTRAINT fk_spin_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS settings (
  setting_key VARCHAR(64) PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS rate_limits (
  rate_key CHAR(64) PRIMARY KEY,
  bucket VARCHAR(64) NOT NULL,
  hits INT NOT NULL DEFAULT 0,
  window_started_at DATETIME NOT NULL,
  blocked_until DATETIME NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX(bucket),
  INDEX(blocked_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS broadcast_jobs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  admin_telegram_id BIGINT NOT NULL,
  text LONGTEXT NULL,
  telegram_method VARCHAR(32) NOT NULL DEFAULT 'sendMessage',
  media_field VARCHAR(32) NULL,
  telegram_file_id VARCHAR(512) NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'queued',
  total_count INT NOT NULL DEFAULT 0,
  sent_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME NULL,
  finished_at DATETIME NULL,
  INDEX(status), INDEX(created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS broadcast_job_recipients (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  job_id BIGINT UNSIGNED NOT NULL,
  telegram_id BIGINT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'queued',
  attempts INT NOT NULL DEFAULT 0,
  last_error VARCHAR(500) NULL,
  sent_at DATETIME NULL,
  UNIQUE KEY uq_broadcast_recipient (job_id, telegram_id),
  INDEX(job_id,status),
  CONSTRAINT fk_broadcast_recipient_job FOREIGN KEY (job_id) REFERENCES broadcast_jobs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;




-- Payment methods engine: card accounts, internal wallet and Telegram Stars base settings.
CREATE TABLE IF NOT EXISTS payment_methods (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  method_key VARCHAR(64) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  method_type VARCHAR(32) NOT NULL DEFAULT 'manual',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  settings_json TEXT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX(is_active),
  INDEX(sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



CREATE TABLE IF NOT EXISTS product_categories (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  emoji VARCHAR(16) NULL,
  image_url VARCHAR(1024) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX(is_active),
  INDEX(sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id BIGINT UNSIGNED NULL,
  parent_id BIGINT UNSIGNED NULL,
  name VARCHAR(255) NOT NULL,
  price BIGINT NOT NULL DEFAULT 0,
  price_currency VARCHAR(8) NOT NULL DEFAULT 'IRT',
  price_usd DECIMAL(14,4) NULL,
  price_rate_toman DECIMAL(24,6) NULL,
  price_rate_source VARCHAR(32) NULL,
  price_rate_updated_at DATETIME NULL,
  short_description VARCHAR(500) NULL,
  full_description TEXT NULL,
  delivery_type VARCHAR(32) NOT NULL DEFAULT 'manual',
  commission_type VARCHAR(16) NOT NULL DEFAULT 'none',
  commission_value BIGINT NOT NULL DEFAULT 0,
  duration_days INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX(category_id),
  INDEX(parent_id),
  INDEX(is_active),
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES product_categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS coupons (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(64) NOT NULL UNIQUE,
  type VARCHAR(16) NOT NULL DEFAULT 'percent',
  value BIGINT NOT NULL DEFAULT 0,
  min_order_amount BIGINT NOT NULL DEFAULT 0,
  max_uses INT NOT NULL DEFAULT 0,
  max_uses_per_user INT NOT NULL DEFAULT 1,
  category_id BIGINT UNSIGNED NULL,
  used_count INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  expires_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX(is_active),
  INDEX(code),
  INDEX(category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  catalog_service_id BIGINT UNSIGNED NULL,
  catalog_group_id BIGINT UNSIGNED NULL,
  catalog_plan_id BIGINT UNSIGNED NULL,
  service_name_snapshot VARCHAR(255) NULL,
  group_name_snapshot VARCHAR(255) NULL,
  plan_name_snapshot VARCHAR(255) NULL,
  amount BIGINT NOT NULL DEFAULT 0,
  discount_amount BIGINT NOT NULL DEFAULT 0,
  wallet_amount BIGINT NOT NULL DEFAULT 0,
  final_amount BIGINT NOT NULL DEFAULT 0,
  price_currency VARCHAR(8) NOT NULL DEFAULT 'IRT',
  price_usd DECIMAL(14,4) NULL,
  usd_rate_toman DECIMAL(24,6) NULL,
  usd_rate_source VARCHAR(32) NULL,
  usd_rate_updated_at DATETIME NULL,
  payment_method VARCHAR(32) NULL,
  payment_details TEXT NULL,
  stars_amount INT NOT NULL DEFAULT 0,
  stars_charge_id VARCHAR(255) NULL,
  stars_provider_charge_id VARCHAR(255) NULL,
  coupon_code VARCHAR(64) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending_payment',
  renewal_of_order_id BIGINT UNSIGNED NULL,
  is_renewal TINYINT(1) NOT NULL DEFAULT 0,
  user_service_id BIGINT UNSIGNED NULL,
  service_action VARCHAR(32) NULL,
  service_action_json LONGTEXT NULL,
  payment_note TEXT NULL,
  receipt_file_id VARCHAR(255) NULL,
  delivery_text TEXT NULL,
  delivery_url TEXT NULL,
  delivery_title VARCHAR(120) NULL,
  referrer_reward_amount BIGINT NOT NULL DEFAULT 0,
  admin_note TEXT NULL,
  user_hidden TINYINT(1) NOT NULL DEFAULT 0,
  archived_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX(user_id),
  INDEX(product_id),
  UNIQUE KEY uq_orders_stars_charge (stars_charge_id),
  INDEX(status),
  INDEX(renewal_of_order_id),
  INDEX(is_renewal),
  INDEX(user_hidden),
  INDEX(archived_at),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_orders_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Commerce Plus upgrade: product variants, inventory, order timeline, product media and richer order lifecycle.
CREATE TABLE IF NOT EXISTS product_variants (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  price BIGINT NOT NULL DEFAULT 0,
  price_currency VARCHAR(8) NOT NULL DEFAULT 'IRT',
  price_usd DECIMAL(14,4) NULL,
  price_rate_toman DECIMAL(24,6) NULL,
  price_rate_source VARCHAR(32) NULL,
  price_rate_updated_at DATETIME NULL,
  duration_days INT NOT NULL DEFAULT 0,
  discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  description TEXT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX(product_id),
  INDEX(is_active),
  CONSTRAINT fk_product_variants_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Catalog v2: normalized store hierarchy. Legacy product tables stay intact for compatibility.
CREATE TABLE IF NOT EXISTS store_categories (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  legacy_category_id BIGINT UNSIGNED NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(128) NOT NULL,
  emoji VARCHAR(16) NULL,
  image_url VARCHAR(1024) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX(is_active), INDEX(sort_order), UNIQUE KEY uq_store_categories_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS services (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id BIGINT UNSIGNED NULL,
  legacy_product_id BIGINT UNSIGNED NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(128) NOT NULL,
  description TEXT NULL,
  image_url VARCHAR(1024) NULL,
  theme VARCHAR(64) NULL,
  badge VARCHAR(128) NULL,
  config_json LONGTEXT NULL,
  is_featured TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX(category_id), INDEX(is_active), INDEX(sort_order), UNIQUE KEY uq_services_slug (slug),
  CONSTRAINT fk_services_store_category FOREIGN KEY (category_id) REFERENCES store_categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS service_groups (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  service_id BIGINT UNSIGNED NOT NULL,
  legacy_product_id BIGINT UNSIGNED NULL,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(128) NOT NULL,
  description TEXT NULL,
  image_url VARCHAR(1024) NULL,
  config_json LONGTEXT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_archived TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX(service_id), INDEX(legacy_product_id), INDEX(is_default), INDEX(is_active),
  UNIQUE KEY uq_service_group_slug (service_id,slug),
  CONSTRAINT fk_service_groups_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS service_plans (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  group_id BIGINT UNSIGNED NOT NULL,
  legacy_product_id BIGINT UNSIGNED NULL,
  legacy_variant_id BIGINT UNSIGNED NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  price BIGINT NOT NULL DEFAULT 0,
  price_currency VARCHAR(8) NOT NULL DEFAULT 'IRT',
  price_usd DECIMAL(14,4) NULL,
  price_rate_toman DECIMAL(24,6) NULL,
  price_rate_source VARCHAR(32) NULL,
  price_rate_updated_at DATETIME NULL,
  duration_days INT NOT NULL DEFAULT 0,
  extra_traffic_price_per_gb BIGINT NOT NULL DEFAULT 0,
  extra_day_price BIGINT NOT NULL DEFAULT 0,
  addon_min_gb INT NOT NULL DEFAULT 1,
  addon_max_gb INT NOT NULL DEFAULT 500,
  addon_min_days INT NOT NULL DEFAULT 1,
  addon_max_days INT NOT NULL DEFAULT 365,
  discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  description TEXT NULL,
  image_url VARCHAR(1000) NULL,
  delivery_type VARCHAR(32) NOT NULL DEFAULT 'manual',
  commission_type VARCHAR(16) NOT NULL DEFAULT 'none',
  commission_value BIGINT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_archived TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX(group_id), INDEX(legacy_product_id), INDEX(is_active), INDEX(sort_order),
  CONSTRAINT fk_service_plans_group FOREIGN KEY (group_id) REFERENCES service_groups(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  variant_id BIGINT UNSIGNED NULL,
  content TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'available',
  order_id BIGINT UNSIGNED NULL,
  reserved_at DATETIME NULL,
  delivered_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX(product_id),
  INDEX(variant_id),
  INDEX(status),
  CONSTRAINT fk_inventory_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  status VARCHAR(32) NOT NULL,
  title VARCHAR(255) NOT NULL,
  note TEXT NULL,
  is_public TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX(order_id),
  INDEX(status),
  CONSTRAINT fk_order_events_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Crypto payment wallets and automatic transaction checks.
CREATE TABLE IF NOT EXISTS crypto_wallets (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  network VARCHAR(32) NOT NULL,
  asset VARCHAR(32) NOT NULL,
  address VARCHAR(255) NOT NULL,
  rate_symbol VARCHAR(32) NULL,
  min_confirmations INT NOT NULL DEFAULT 1,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX(is_active),
  INDEX(network),
  INDEX(asset)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS crypto_payment_checks (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  wallet_id BIGINT UNSIGNED NOT NULL,
  network VARCHAR(32) NOT NULL,
  asset VARCHAR(32) NOT NULL,
  address VARCHAR(255) NOT NULL,
  expected_amount DECIMAL(24,8) NOT NULL DEFAULT 0,
  rate_toman DECIMAL(24,6) NULL,
  rate_updated_at DATETIME NULL,
  rate_source VARCHAR(32) NULL,
  tx_hash VARCHAR(255) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'waiting_hash',
  check_count INT NOT NULL DEFAULT 0,
  last_checked_at DATETIME NULL,
  confirmed_at DATETIME NULL,
  raw_response LONGTEXT NULL,
  fail_reason VARCHAR(500) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_crypto_order (order_id),
  UNIQUE KEY uniq_crypto_hash (tx_hash),
  INDEX(status),
  INDEX(wallet_id),
  CONSTRAINT fk_crypto_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_crypto_wallet FOREIGN KEY (wallet_id) REFERENCES crypto_wallets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- SwapWallet / SwapPay invoice payments. This replaces direct TXID crypto checks for new crypto payments.
CREATE TABLE IF NOT EXISTS swapwallet_invoices (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL UNIQUE,
  invoice_id VARCHAR(255) NOT NULL UNIQUE,
  amount_usd DECIMAL(18,6) NOT NULL DEFAULT 0,
  token VARCHAR(32) NOT NULL DEFAULT 'USDT',
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  payment_url TEXT NULL,
  payment_links_json LONGTEXT NULL,
  request_url TEXT NULL,
  request_body LONGTEXT NULL,
  api_version VARCHAR(64) NULL,
  raw_response LONGTEXT NULL,
  callback_raw LONGTEXT NULL,
  check_count INT NOT NULL DEFAULT 0,
  last_checked_at DATETIME NULL,
  paid_at DATETIME NULL,
  fail_reason VARCHAR(500) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX(status),
  INDEX(order_id),
  CONSTRAINT fk_swapwallet_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- v2.7.0 Credit Center: auditable account top-ups. Wallet/credit itself remains non-withdrawable.
CREATE TABLE IF NOT EXISTS credit_topups (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  amount BIGINT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending_payment',
  payment_method VARCHAR(32) NULL,
  payment_details LONGTEXT NULL,
  receipt_file_id VARCHAR(255) NULL,
  crypto_wallet_id BIGINT UNSIGNED NULL,
  crypto_amount DECIMAL(24,8) NULL,
  crypto_asset VARCHAR(32) NULL,
  crypto_network VARCHAR(32) NULL,
  tx_hash VARCHAR(255) NULL,
  stars_amount INT NOT NULL DEFAULT 0,
  stars_charge_id VARCHAR(255) NULL,
  stars_provider_charge_id VARCHAR(255) NULL,
  admin_note TEXT NULL,
  credited_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX(user_id), INDEX(status), INDEX(payment_method), INDEX(created_at),
  UNIQUE KEY uq_credit_topups_stars_charge (stars_charge_id),
  UNIQUE KEY uq_credit_topups_tx_hash (tx_hash),
  CONSTRAINT fk_credit_topup_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS user_wishlists (
  user_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, product_id),
  INDEX(product_id),
  CONSTRAINT fk_wishlist_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_wishlist_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  type VARCHAR(32) NOT NULL DEFAULT 'info',
  title VARCHAR(255) NOT NULL,
  body VARCHAR(1000) NULL,
  order_id BIGINT UNSIGNED NULL,
  action_type VARCHAR(32) NULL,
  action_value VARCHAR(255) NULL,
  campaign_id BIGINT UNSIGNED NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX(user_id,is_read),
  INDEX(created_at),
  INDEX(campaign_id),
  CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_notification_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notification_campaigns (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  admin_telegram_id BIGINT NULL,
  type VARCHAR(32) NOT NULL DEFAULT 'info',
  title VARCHAR(255) NOT NULL,
  body VARCHAR(1000) NULL,
  action_type VARCHAR(32) NULL,
  action_value VARCHAR(255) NULL,
  audience VARCHAR(32) NOT NULL DEFAULT 'all',
  recipient_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX(created_at),
  INDEX(audience)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- BlueGate Phase 1: Service Engine Foundation
CREATE TABLE IF NOT EXISTS service_providers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  driver VARCHAR(64) NOT NULL,
  base_url VARCHAR(1024) NULL,
  auth_type VARCHAR(32) NOT NULL DEFAULT 'none',
  username VARCHAR(255) NULL,
  secret_encrypted LONGTEXT NULL,
  api_token_encrypted LONGTEXT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'disabled',
  priority INT NOT NULL DEFAULT 100,
  weight INT NOT NULL DEFAULT 100,
  max_clients INT NULL,
  metadata_json LONGTEXT NULL,
  last_health_status VARCHAR(32) NULL,
  last_health_message VARCHAR(500) NULL,
  last_health_latency_ms INT NULL,
  last_health_check DATETIME NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX(driver), INDEX(status), INDEX(is_active), INDEX(priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS service_provider_settings (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  provider_id BIGINT UNSIGNED NOT NULL,
  setting_key VARCHAR(128) NOT NULL,
  setting_value LONGTEXT NULL,
  is_secret TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_provider_setting (provider_id, setting_key),
  CONSTRAINT fk_provider_settings_provider FOREIGN KEY (provider_id) REFERENCES service_providers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS service_plan_provider_map (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  service_plan_id BIGINT UNSIGNED NOT NULL,
  provider_id BIGINT UNSIGNED NOT NULL,
  remote_target_id VARCHAR(255) NULL,
  remote_target_name VARCHAR(255) NULL,
  provisioning_mode VARCHAR(32) NOT NULL DEFAULT 'single',
  priority INT NOT NULL DEFAULT 100,
  weight INT NOT NULL DEFAULT 100,
  config_json LONGTEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_plan_provider_target (service_plan_id, provider_id, remote_target_id),
  INDEX(provider_id), INDEX(priority), INDEX(is_active),
  CONSTRAINT fk_plan_provider_plan FOREIGN KEY (service_plan_id) REFERENCES service_plans(id) ON DELETE CASCADE,
  CONSTRAINT fk_plan_provider_provider FOREIGN KEY (provider_id) REFERENCES service_providers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_services (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NULL,
  service_plan_id BIGINT UNSIGNED NULL,
  service_type VARCHAR(64) NOT NULL DEFAULT 'managed',
  display_name VARCHAR(255) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  traffic_limit_bytes BIGINT UNSIGNED NULL,
  traffic_used_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
  started_at DATETIME NULL,
  expires_at DATETIME NULL,
  subscription_token CHAR(64) NULL UNIQUE,
  last_sync_at DATETIME NULL,
  metadata_json LONGTEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX(user_id), INDEX(order_id), INDEX(status), INDEX(expires_at),
  CONSTRAINT fk_user_services_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_services_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  CONSTRAINT fk_user_services_plan FOREIGN KEY (service_plan_id) REFERENCES service_plans(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS service_instances (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_service_id BIGINT UNSIGNED NOT NULL,
  provider_id BIGINT UNSIGNED NOT NULL,
  external_client_id VARCHAR(255) NULL,
  external_username VARCHAR(255) NULL,
  remote_target_id VARCHAR(255) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  subscription_url TEXT NULL,
  config_encrypted LONGTEXT NULL,
  traffic_limit_bytes BIGINT UNSIGNED NULL,
  traffic_used_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
  expires_at DATETIME NULL,
  last_sync_at DATETIME NULL,
  metadata_json LONGTEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX(user_service_id), INDEX(provider_id), INDEX(status),
  UNIQUE KEY uq_provider_external_client (provider_id, external_client_id),
  CONSTRAINT fk_service_instances_service FOREIGN KEY (user_service_id) REFERENCES user_services(id) ON DELETE CASCADE,
  CONSTRAINT fk_service_instances_provider FOREIGN KEY (provider_id) REFERENCES service_providers(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS service_instance_targets (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  service_instance_id BIGINT UNSIGNED NOT NULL,
  remote_target_id VARCHAR(255) NOT NULL,
  remote_target_name VARCHAR(255) NULL,
  target_type VARCHAR(32) NOT NULL DEFAULT 'inbound',
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  metadata_json LONGTEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_instance_target (service_instance_id, remote_target_id),
  INDEX(remote_target_id), INDEX(status),
  CONSTRAINT fk_instance_targets_instance FOREIGN KEY (service_instance_id) REFERENCES service_instances(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS service_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_service_id BIGINT UNSIGNED NOT NULL,
  service_instance_id BIGINT UNSIGNED NULL,
  event_type VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  details_json LONGTEXT NULL,
  actor_type VARCHAR(32) NOT NULL DEFAULT 'system',
  actor_id BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX(user_service_id), INDEX(service_instance_id), INDEX(event_type), INDEX(created_at),
  CONSTRAINT fk_service_events_service FOREIGN KEY (user_service_id) REFERENCES user_services(id) ON DELETE CASCADE,
  CONSTRAINT fk_service_events_instance FOREIGN KEY (service_instance_id) REFERENCES service_instances(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS service_usage_snapshots (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_service_id BIGINT UNSIGNED NOT NULL,
  service_instance_id BIGINT UNSIGNED NOT NULL,
  traffic_used_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
  traffic_limit_bytes BIGINT UNSIGNED NULL,
  remaining_bytes BIGINT UNSIGNED NULL,
  expires_at DATETIME NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  raw_json LONGTEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX(user_service_id,created_at), INDEX(service_instance_id,created_at),
  CONSTRAINT fk_usage_service FOREIGN KEY (user_service_id) REFERENCES user_services(id) ON DELETE CASCADE,
  CONSTRAINT fk_usage_instance FOREIGN KEY (service_instance_id) REFERENCES service_instances(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS provisioning_jobs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  idempotency_key VARCHAR(191) NOT NULL UNIQUE,
  job_type VARCHAR(64) NOT NULL,
  user_service_id BIGINT UNSIGNED NULL,
  service_instance_id BIGINT UNSIGNED NULL,
  provider_id BIGINT UNSIGNED NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'queued',
  attempt_count INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  available_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  locked_at DATETIME NULL,
  locked_by VARCHAR(128) NULL,
  request_json LONGTEXT NULL,
  result_json LONGTEXT NULL,
  last_error_code VARCHAR(128) NULL,
  last_error_message VARCHAR(1000) NULL,
  completed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX(status,available_at), INDEX(provider_id), INDEX(user_service_id),
  CONSTRAINT fk_jobs_service FOREIGN KEY (user_service_id) REFERENCES user_services(id) ON DELETE SET NULL,
  CONSTRAINT fk_jobs_instance FOREIGN KEY (service_instance_id) REFERENCES service_instances(id) ON DELETE SET NULL,
  CONSTRAINT fk_jobs_provider FOREIGN KEY (provider_id) REFERENCES service_providers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS provider_health_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  provider_id BIGINT UNSIGNED NOT NULL,
  health_status VARCHAR(32) NOT NULL,
  latency_ms INT NULL,
  message VARCHAR(500) NULL,
  details_json LONGTEXT NULL,
  checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX(provider_id,checked_at), INDEX(health_status),
  CONSTRAINT fk_provider_health_provider FOREIGN KEY (provider_id) REFERENCES service_providers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- BlueGate Phase 5: monitoring + automation
CREATE TABLE IF NOT EXISTS monitoring_settings (
  id TINYINT UNSIGNED PRIMARY KEY DEFAULT 1,
  service_sync_enabled TINYINT(1) NOT NULL DEFAULT 1,
  provider_health_enabled TINYINT(1) NOT NULL DEFAULT 1,
  expire_suspend_enabled TINYINT(1) NOT NULL DEFAULT 1,
  telegram_alerts_enabled TINYINT(1) NOT NULL DEFAULT 1,
  usage_thresholds VARCHAR(64) NOT NULL DEFAULT '80,90,100',
  expiry_days VARCHAR(64) NOT NULL DEFAULT '3,1,0',
  provider_degraded_latency_ms INT NOT NULL DEFAULT 2000,
  service_batch_size INT NOT NULL DEFAULT 100,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT IGNORE INTO monitoring_settings (id) VALUES (1);

CREATE TABLE IF NOT EXISTS service_alert_states (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_service_id BIGINT UNSIGNED NOT NULL,
  alert_key VARCHAR(96) NOT NULL,
  cycle_key VARCHAR(191) NOT NULL,
  last_value VARCHAR(191) NULL,
  sent_at DATETIME NOT NULL,
  resolved_at DATETIME NULL,
  metadata_json LONGTEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_service_alert_key (user_service_id,alert_key),
  INDEX(sent_at), INDEX(resolved_at),
  CONSTRAINT fk_service_alert_service FOREIGN KEY (user_service_id) REFERENCES user_services(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS provider_incidents (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  provider_id BIGINT UNSIGNED NOT NULL,
  incident_type VARCHAR(64) NOT NULL DEFAULT 'availability',
  severity VARCHAR(32) NOT NULL DEFAULT 'warning',
  status VARCHAR(32) NOT NULL DEFAULT 'open',
  title VARCHAR(255) NOT NULL,
  message VARCHAR(1000) NULL,
  opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME NULL,
  occurrence_count INT NOT NULL DEFAULT 1,
  metadata_json LONGTEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX(provider_id,status), INDEX(opened_at), INDEX(resolved_at),
  CONSTRAINT fk_provider_incident_provider FOREIGN KEY (provider_id) REFERENCES service_providers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS monitoring_runs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  run_type VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'running',
  scanned_count INT NOT NULL DEFAULT 0,
  success_count INT NOT NULL DEFAULT 0,
  warning_count INT NOT NULL DEFAULT 0,
  error_count INT NOT NULL DEFAULT 0,
  details_json LONGTEXT NULL,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX(run_type,started_at), INDEX(status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- BlueGate Phase 6: routing + failover
CREATE TABLE IF NOT EXISTS routing_settings (
  id TINYINT UNSIGNED PRIMARY KEY DEFAULT 1,
  strategy VARCHAR(32) NOT NULL DEFAULT 'priority_weighted',
  allow_degraded TINYINT(1) NOT NULL DEFAULT 1,
  capacity_reserve INT NOT NULL DEFAULT 0,
  circuit_failure_threshold INT NOT NULL DEFAULT 3,
  circuit_open_seconds INT NOT NULL DEFAULT 300,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT IGNORE INTO routing_settings (id) VALUES (1);

CREATE TABLE IF NOT EXISTS provider_route_state (
  provider_id BIGINT UNSIGNED PRIMARY KEY,
  consecutive_failures INT NOT NULL DEFAULT 0,
  circuit_state VARCHAR(32) NOT NULL DEFAULT 'closed',
  open_until DATETIME NULL,
  last_failure_at DATETIME NULL,
  last_success_at DATETIME NULL,
  last_error VARCHAR(1000) NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX(circuit_state), INDEX(open_until),
  CONSTRAINT fk_route_state_provider FOREIGN KEY (provider_id) REFERENCES service_providers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS routing_decisions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NULL,
  user_service_id BIGINT UNSIGNED NULL,
  job_id BIGINT UNSIGNED NULL,
  service_plan_id BIGINT UNSIGNED NULL,
  strategy VARCHAR(32) NOT NULL,
  selected_map_id BIGINT UNSIGNED NULL,
  selected_provider_id BIGINT UNSIGNED NULL,
  selected_target_id VARCHAR(255) NULL,
  decision_json LONGTEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX(order_id), INDEX(user_service_id), INDEX(job_id), INDEX(selected_provider_id), INDEX(created_at),
  CONSTRAINT fk_route_decision_service FOREIGN KEY (user_service_id) REFERENCES user_services(id) ON DELETE SET NULL,
  CONSTRAINT fk_route_decision_job FOREIGN KEY (job_id) REFERENCES provisioning_jobs(id) ON DELETE SET NULL,
  CONSTRAINT fk_route_decision_plan FOREIGN KEY (service_plan_id) REFERENCES service_plans(id) ON DELETE SET NULL,
  CONSTRAINT fk_route_decision_provider FOREIGN KEY (selected_provider_id) REFERENCES service_providers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS routing_attempts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  routing_decision_id BIGINT UNSIGNED NULL,
  job_id BIGINT UNSIGNED NULL,
  map_id BIGINT UNSIGNED NULL,
  provider_id BIGINT UNSIGNED NULL,
  remote_target_id VARCHAR(255) NULL,
  outcome VARCHAR(32) NOT NULL,
  error_message VARCHAR(1000) NULL,
  latency_ms INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX(routing_decision_id), INDEX(job_id), INDEX(provider_id), INDEX(outcome), INDEX(created_at),
  CONSTRAINT fk_route_attempt_decision FOREIGN KEY (routing_decision_id) REFERENCES routing_decisions(id) ON DELETE CASCADE,
  CONSTRAINT fk_route_attempt_job FOREIGN KEY (job_id) REFERENCES provisioning_jobs(id) ON DELETE SET NULL,
  CONSTRAINT fk_route_attempt_provider FOREIGN KEY (provider_id) REFERENCES service_providers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- BlueGate Phase 10: Advanced Features (Phase 9 intentionally skipped)
CREATE TABLE IF NOT EXISTS trial_settings (
  id TINYINT UNSIGNED PRIMARY KEY DEFAULT 1,
  enabled TINYINT(1) NOT NULL DEFAULT 0,
  service_plan_id BIGINT UNSIGNED NULL,
  traffic_limit_bytes BIGINT UNSIGNED NOT NULL DEFAULT 1073741824,
  duration_minutes INT NOT NULL DEFAULT 120,
  max_per_user INT NOT NULL DEFAULT 1,
  cooldown_days INT NOT NULL DEFAULT 30,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT IGNORE INTO trial_settings (id) VALUES (1);

CREATE TABLE IF NOT EXISTS trial_requests (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  service_plan_id BIGINT UNSIGNED NULL,
  user_service_id BIGINT UNSIGNED NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'requested',
  reason VARCHAR(255) NULL,
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  provisioned_at DATETIME NULL,
  expires_at DATETIME NULL,
  metadata_json LONGTEXT NULL,
  INDEX(user_id,status), INDEX(requested_at),
  CONSTRAINT fk_trial_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_trial_service FOREIGN KEY (user_service_id) REFERENCES user_services(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS support_tickets (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  user_service_id BIGINT UNSIGNED NULL,
  order_id BIGINT UNSIGNED NULL,
  category VARCHAR(64) NOT NULL DEFAULT 'other',
  priority VARCHAR(16) NOT NULL DEFAULT 'normal',
  status VARCHAR(32) NOT NULL DEFAULT 'open',
  subject VARCHAR(255) NOT NULL,
  last_message_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX(user_id,status), INDEX(status,priority), INDEX(last_message_at),
  CONSTRAINT fk_ticket_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_ticket_service FOREIGN KEY (user_service_id) REFERENCES user_services(id) ON DELETE SET NULL,
  CONSTRAINT fk_ticket_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS support_messages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket_id BIGINT UNSIGNED NOT NULL,
  sender_type VARCHAR(16) NOT NULL,
  sender_id BIGINT NULL,
  body TEXT NOT NULL,
  attachment_url TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX(ticket_id,created_at),
  CONSTRAINT fk_support_message_ticket FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS provider_economics (
  provider_id BIGINT UNSIGNED PRIMARY KEY,
  monthly_cost DECIMAL(16,2) NOT NULL DEFAULT 0,
  cost_currency VARCHAR(8) NOT NULL DEFAULT 'USD',
  bandwidth_cost_per_gb DECIMAL(16,6) NOT NULL DEFAULT 0,
  maintenance_mode TINYINT(1) NOT NULL DEFAULT 0,
  maintenance_message VARCHAR(500) NULL,
  soft_capacity_percent INT NOT NULL DEFAULT 90,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_provider_economics_provider FOREIGN KEY (provider_id) REFERENCES service_providers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
