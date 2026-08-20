#!/usr/bin/env bash
# BlueGate Platform installer / manager
# Default repo: https://github.com/paliparsa/BlueGate-Platform

set -uo pipefail

PROJECT_NAME="BlueGate Platform"
APP_NAME="bluegate-platform"
DEFAULT_REPO_URL="https://github.com/paliparsa/BlueGate-Platform.git"
DEFAULT_APP_DIR="/var/www/${APP_NAME}"
ENV_FILE="/etc/bluegate-platform.env"
LOG_FILE="/var/log/bluegate-platform-install.log"
REMOTE_INSTALL_URL="https://raw.githubusercontent.com/paliparsa/BlueGate-Platform/main/install.sh"
MANAGER_CMD="bluegate"
CRON_FILE="/etc/cron.d/bluegate-platform"
NGINX_SITE="bluegate-platform"

# Defaults. Saved env values override these after source.
DOMAIN="${DOMAIN:-}"
BOT_TOKEN="${BOT_TOKEN:-}"
BOT_USERNAME="${BOT_USERNAME:-}"
ADMIN_IDS="${ADMIN_IDS:-}"
SUPPORT_USERNAME="${SUPPORT_USERNAME:-BlueGateSupport}"
REPO_URL="${REPO_URL:-$DEFAULT_REPO_URL}"
APP_DIR="${APP_DIR:-$DEFAULT_APP_DIR}"
DB_NAME="${DB_NAME:-bluegate_platform}"
DB_USER="${DB_USER:-bluegate_user}"
DB_PASS="${DB_PASS:-}"
WEBHOOK_SECRET="${WEBHOOK_SECRET:-}"
THEME_COLOR="${THEME_COLOR:-#1d9bf0}"
BRAND_NAME="${BRAND_NAME:-BlueGate}"
FORCE_JOIN_CHANNEL="${FORCE_JOIN_CHANNEL:-}"
ENABLE_SSL="${ENABLE_SSL:-yes}"
SSL_EMAIL="${SSL_EMAIL:-}"
RESEND_API_KEY="${RESEND_API_KEY:-}"
RESEND_FROM_EMAIL="${RESEND_FROM_EMAIL:-onboarding@resend.dev}"

[[ -f "$ENV_FILE" ]] && source "$ENV_FILE"

if [[ ${EUID:-$(id -u)} -eq 0 ]]; then
  touch "$LOG_FILE" 2>/dev/null || true
  chmod 600 "$LOG_FILE" 2>/dev/null || true
  exec > >(tee -a "$LOG_FILE") 2>&1
fi

line() { printf '%*s\n' "${COLUMNS:-74}" '' | tr ' ' '-'; }
info() { echo "[INFO] $*"; }
ok() { echo "[OK] $*"; }
warn() { echo "[WARN] $*"; }
fail() { echo "[ERROR] $*"; }
pause() { echo; read -rp "Press Enter to return to menu..." _ || true; }

require_root() {
  if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
    echo "Run as root. Example: sudo ${MANAGER_CMD}"
    exit 1
  fi
}

rand_hex() {
  openssl rand -hex "${1:-16}" 2>/dev/null || date +%s%N | sha256sum | cut -c1-$(( ${1:-16} * 2 ))
}

ask_value() {
  local var="$1" prompt="$2" default="${3:-}" secret="${4:-no}" current value
  current="${!var:-}"
  [[ -z "$current" && -n "$default" ]] && current="$default"
  if [[ "$secret" == "yes" && -n "$current" ]]; then
    read -rp "$prompt [saved, Enter=keep]: " value || true
    [[ -n "$value" ]] && printf -v "$var" '%s' "$value" || printf -v "$var" '%s' "$current"
    return
  fi
  if [[ -n "$current" ]]; then
    read -rp "$prompt [$current]: " value || true
    printf -v "$var" '%s' "${value:-$current}"
  else
    while true; do
      read -rp "$prompt: " value || true
      [[ -n "$value" ]] && { printf -v "$var" '%s' "$value"; break; }
      echo "This value is required."
    done
  fi
}

ask_optional() {
  local var="$1" prompt="$2" current value
  current="${!var:-}"
  if [[ -n "$current" ]]; then
    read -rp "$prompt [$current, Enter=keep, -=disable]: " value || true
    [[ "$value" == "-" ]] && printf -v "$var" '%s' "" || printf -v "$var" '%s' "${value:-$current}"
  else
    read -rp "$prompt [optional, Enter=disable]: " value || true
    printf -v "$var" '%s' "$value"
  fi
}

save_env() {
  umask 077
  {
    echo "# BlueGate Platform manager state - generated automatically"
    for var in DOMAIN BOT_TOKEN BOT_USERNAME ADMIN_IDS SUPPORT_USERNAME REPO_URL APP_DIR DB_NAME DB_USER DB_PASS WEBHOOK_SECRET THEME_COLOR BRAND_NAME FORCE_JOIN_CHANNEL ENABLE_SSL SSL_EMAIL RESEND_API_KEY RESEND_FROM_EMAIL; do
      printf '%s=%q\n' "$var" "${!var:-}"
    done
  } > "$ENV_FILE"
  ok "Settings saved: $ENV_FILE"
}

php_escape() {
  printf "%s" "$1" | sed "s/\\\\/\\\\\\\\/g; s/'/\\\\'/g"
}

sql_escape() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\'/\'\'}"
  printf "%s" "$s"
}

admin_array_php() {
  echo "$ADMIN_IDS" | awk -F, '{c=0; for(i=1;i<=NF;i++){gsub(/ /,"",$i); if($i ~ /^[0-9]+$/){printf "%s%s", (c++?",":""), $i}}}' | sed 's/^/[/' | sed 's/$/]/'
}

validate_db_identifier() {
  [[ "$1" =~ ^[A-Za-z0-9_]+$ ]]
}

validate_domain() {
  [[ "$1" =~ ^[A-Za-z0-9.-]+$ ]] && [[ "$1" != .* ]] && [[ "$1" != *. ]] && [[ "$1" == *.* ]]
}

try_extract_php_config() {
  local cfg="$APP_DIR/config.php"
  [[ -f "$cfg" ]] || return 0
  extract_string() {
    local key="$1"
    grep -E "^\\\$$key[[:space:]]*=" "$cfg" | head -n1 | sed -E "s/^\\\$$key[[:space:]]*=[[:space:]]*'([^']*)'.*/\\1/"
  }
  [[ -z "$BOT_TOKEN" ]] && BOT_TOKEN="$(extract_string BOT_TOKEN)"
  [[ -z "$BOT_USERNAME" ]] && BOT_USERNAME="$(extract_string BOT_USERNAME)"
  [[ -z "$SUPPORT_USERNAME" ]] && SUPPORT_USERNAME="$(extract_string SUPPORT_USERNAME)"
  [[ -z "$DB_NAME" ]] && DB_NAME="$(extract_string DB_NAME)"
  [[ -z "$DB_USER" ]] && DB_USER="$(extract_string DB_USER)"
  [[ -z "$DB_PASS" ]] && DB_PASS="$(extract_string DB_PASS)"
  [[ -z "$WEBHOOK_SECRET" ]] && WEBHOOK_SECRET="$(extract_string WEBHOOK_SECRET)"
  [[ -z "$THEME_COLOR" ]] && THEME_COLOR="$(extract_string DEFAULT_THEME_COLOR)"
  [[ -z "$BRAND_NAME" ]] && BRAND_NAME="$(extract_string BRAND_NAME)"
  [[ -z "$FORCE_JOIN_CHANNEL" ]] && FORCE_JOIN_CHANNEL="$(extract_string FORCE_JOIN_CHANNEL)"
  local val
  val="$(grep -E '^\$PUBLIC_BASE_URL[[:space:]]*=' "$cfg" | head -n1 | sed -E "s#^\\\$PUBLIC_BASE_URL[[:space:]]*=[[:space:]]*'https?://([^']*)'.*#\\1#")"
  [[ -z "$DOMAIN" && -n "$val" ]] && DOMAIN="$val"
}

collect_settings() {
  clear
  echo "$PROJECT_NAME setup wizard"
  line
  try_extract_php_config
  [[ -z "$DB_PASS" ]] && DB_PASS="$(rand_hex 16)"
  [[ -z "$WEBHOOK_SECRET" ]] && WEBHOOK_SECRET="$(rand_hex 20)"

  ask_value DOMAIN "Domain without https (example: shop.example.com)"
  ask_value BOT_TOKEN "Telegram bot token" "" yes
  ask_value BOT_USERNAME "Bot username without @"
  ask_value ADMIN_IDS "Admin Telegram numeric IDs, comma separated"
  ask_value SUPPORT_USERNAME "Support username without @" "BlueGateSupport"
  ask_value REPO_URL "GitHub repository URL" "$DEFAULT_REPO_URL"
  ask_value APP_DIR "Install directory" "$DEFAULT_APP_DIR"
  ask_value DB_NAME "Database name" "bluegate_platform"
  ask_value DB_USER "Database user" "bluegate_user"
  ask_value DB_PASS "Database password" "" yes
  ask_value WEBHOOK_SECRET "Webhook secret" "" yes
  ask_value BRAND_NAME "Brand name" "BlueGate"
  ask_value THEME_COLOR "Default theme color" "#1d9bf0"
  ask_optional FORCE_JOIN_CHANNEL "Force-join channel (example: @BlueGate)"
  ask_optional RESEND_API_KEY "Resend API key for email verification"
  ask_optional RESEND_FROM_EMAIL "Resend sender email"
  ask_value ENABLE_SSL "Enable SSL with Certbot? yes/no" "yes"
  if [[ "${ENABLE_SSL,,}" == "yes" || "${ENABLE_SSL,,}" == "y" ]]; then
    ask_optional SSL_EMAIL "Let's Encrypt email (blank = admin@domain)"
  fi

  if ! validate_domain "$DOMAIN"; then
    fail "Domain must be a hostname only, for example test.example.com"
    return 1
  fi
  if ! validate_db_identifier "$DB_NAME" || ! validate_db_identifier "$DB_USER"; then
    fail "DB name and DB user may contain only letters, numbers and underscore."
    return 1
  fi
  save_env
}

install_manager_command() {
  require_root
  cat > "/usr/local/bin/${MANAGER_CMD}" <<'CLI'
#!/usr/bin/env bash
set -uo pipefail
ENV_FILE="/etc/bluegate-platform.env"
APP_DIR="/var/www/bluegate-platform"
REMOTE_INSTALL_URL="https://raw.githubusercontent.com/paliparsa/BlueGate-Platform/main/install.sh"
[[ -f "$ENV_FILE" ]] && source "$ENV_FILE"
if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  exec sudo -E "$0" "$@"
fi
if [[ -f "$APP_DIR/install.sh" ]]; then
  exec bash "$APP_DIR/install.sh" "$@"
fi
if command -v curl >/dev/null 2>&1; then
  tmp="$(mktemp)"
  curl -fsSL "$REMOTE_INSTALL_URL" -o "$tmp" || exit 1
  exec bash "$tmp" "$@"
fi
echo "BlueGate Platform is not installed and curl is unavailable."
exit 1
CLI
  chmod +x "/usr/local/bin/${MANAGER_CMD}"
  ok "Manager installed: ${MANAGER_CMD}"
}

run_step() {
  local title="$1" fn="$2"
  echo
  line
  info "$title"
  line
  if "$fn"; then
    ok "$title finished"
    return 0
  fi
  local code=$?
  fail "$title failed with exit code $code"
  echo "Log: $LOG_FILE"
  return "$code"
}

step_packages() {
  require_root
  export DEBIAN_FRONTEND=noninteractive
  export NEEDRESTART_MODE=a
  apt-get update -y || return 1
  apt-get install -y nginx mariadb-server git curl unzip openssl ca-certificates \
    php-fpm php-cli php-mysql php-curl php-mbstring php-xml \
    certbot python3-certbot-nginx || return 1
  systemctl enable --now nginx mariadb || return 1
}

step_repo() {
  require_root
  [[ -n "$REPO_URL" ]] || { fail "REPO_URL is empty."; return 1; }
  [[ -n "$APP_DIR" ]] || { fail "APP_DIR is empty."; return 1; }
  mkdir -p "$(dirname "$APP_DIR")" || return 1
  git config --global --add safe.directory "$APP_DIR" 2>/dev/null || true

  if [[ -d "$APP_DIR/.git" ]]; then
    info "Updating repository in $APP_DIR"
    git -C "$APP_DIR" remote set-url origin "$REPO_URL" || true
    git -C "$APP_DIR" fetch origin --prune || return 1
    if git -C "$APP_DIR" show-ref --verify --quiet refs/remotes/origin/main; then
      git -C "$APP_DIR" reset --hard origin/main || return 1
    else
      git -C "$APP_DIR" pull --ff-only || return 1
    fi
  else
    info "Cloning $REPO_URL into $APP_DIR"
    rm -rf "$APP_DIR"
    git clone "$REPO_URL" "$APP_DIR" || return 1
  fi
  chmod +x "$APP_DIR/install.sh" "$APP_DIR/update.sh" "$APP_DIR/uninstall.sh" 2>/dev/null || true
}

step_config() {
  require_root
  [[ -d "$APP_DIR" ]] || { fail "Project directory missing. Run repository step first."; return 1; }
  [[ -n "$DOMAIN" && -n "$BOT_TOKEN" && -n "$BOT_USERNAME" && -n "$ADMIN_IDS" ]] || { fail "Missing required settings. Run setup wizard."; return 1; }
  validate_db_identifier "$DB_NAME" || { fail "Invalid DB_NAME"; return 1; }
  validate_db_identifier "$DB_USER" || { fail "Invalid DB_USER"; return 1; }
  [[ -n "$DB_PASS" ]] || DB_PASS="$(rand_hex 16)"
  [[ -n "$WEBHOOK_SECRET" ]] || WEBHOOK_SECRET="$(rand_hex 20)"

  local admin_array public_base mini_url
  admin_array="$(admin_array_php)"
  [[ "$admin_array" == "[]" ]] && { fail "ADMIN_IDS must contain at least one numeric Telegram ID."; return 1; }
  public_base="https://${DOMAIN}"
  mini_url="https://${DOMAIN}/miniapp/"

  cat > "$APP_DIR/config.php" <<PHP
<?php
// Generated by BlueGate Platform installer. Keep this file private.
\$BOT_TOKEN = '$(php_escape "$BOT_TOKEN")';
\$BOT_USERNAME = '$(php_escape "$BOT_USERNAME")';
\$ADMIN_IDS = ${admin_array};
\$SUPPORT_USERNAME = '$(php_escape "$SUPPORT_USERNAME")';
\$TIMEZONE = 'Europe/Istanbul';

\$PUBLIC_BASE_URL = '$(php_escape "$public_base")';
\$WEBHOOK_SECRET = '$(php_escape "$WEBHOOK_SECRET")';
\$MINIAPP_URL = '$(php_escape "$mini_url")';
\$WEB_ALLOWED_ORIGIN = '';

\$DB_HOST = 'localhost';
\$DB_NAME = '$(php_escape "$DB_NAME")';
\$DB_USER = '$(php_escape "$DB_USER")';
\$DB_PASS = '$(php_escape "$DB_PASS")';

\$START_REWARD = 2000;
\$MIN_WITHDRAW = 50000;
\$PURCHASE_REWARD = 10000;
\$MISSION_1_TARGET = 1;
\$MISSION_1_REWARD = 3000;
\$MISSION_2_TARGET = 3;
\$MISSION_2_REWARD = 10000;
\$MISSION_3_TARGET = 5;
\$MISSION_3_REWARD = 25000;
\$SPIN_REFERRALS_PER_CHANCE = 5;
\$SPIN_REWARDS = [
    ['title' => '💰 ۳,۰۰۰ تومان اعتبار کیف پول',  'amount' => 3000,  'weight' => 35],
    ['title' => '💰 ۵,۰۰۰ تومان اعتبار کیف پول',  'amount' => 5000,  'weight' => 30],
    ['title' => '💰 ۱۰,۰۰۰ تومان اعتبار کیف پول', 'amount' => 10000, 'weight' => 18],
    ['title' => '💰 ۲۰,۰۰۰ تومان اعتبار کیف پول', 'amount' => 20000, 'weight' => 7],
    ['title' => '🎁 سرویس تست هدیه',              'amount' => 0,     'weight' => 10, 'notify_admin' => true],
];
\$CUSTOM_CODE_MIN_REFERRALS = 3;
\$FORCE_JOIN_CHANNEL = '$(php_escape "$FORCE_JOIN_CHANNEL")';
\$DEFAULT_THEME_COLOR = '$(php_escape "$THEME_COLOR")';
\$BRAND_NAME = '$(php_escape "$BRAND_NAME")';

\$PAYMENT_INSTRUCTIONS = 'اطلاعات پرداخت را از پنل مدیریت تنظیم کنید. بعد از پرداخت، کاربر می‌تواند رسید را ارسال کند.';
\$CARD_ACCOUNTS = [];
\$STARS_RATE_TOMAN = 3200;

\$CRYPTO_RATE_SOURCE = 'auto';
\$CRYPTO_RATE_MARKUP_PERCENT = 1;
\$CRYPTO_RATE_PROVIDER_PRIORITY = 'wallex,ramzinex,nobitex';
\$CRYPTO_RATE_REFRESH_INTERVAL_SECONDS = 600;
\$CRYPTO_MANUAL_RATES = ['USDT'=>0,'TRX'=>0,'TON'=>0];
\$TRONSCAN_API_KEY = '';
\$TONCENTER_API_KEY = '';

\$RESEND_API_KEY = '$(php_escape "$RESEND_API_KEY")';
\$RESEND_FROM_EMAIL = '$(php_escape "${RESEND_FROM_EMAIL:-onboarding@resend.dev}")';
PHP

  php -l "$APP_DIR/config.php" || return 1
  chown root:www-data "$APP_DIR/config.php" || return 1
  chmod 640 "$APP_DIR/config.php" || return 1
  save_env
}

step_database() {
  require_root
  validate_db_identifier "$DB_NAME" || { fail "Invalid DB_NAME"; return 1; }
  validate_db_identifier "$DB_USER" || { fail "Invalid DB_USER"; return 1; }
  systemctl start mariadb || return 1
  local pass_escaped
  pass_escaped="$(sql_escape "$DB_PASS")"
  mysql <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${pass_escaped}';
ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${pass_escaped}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL
}

step_permissions() {
  require_root
  [[ -d "$APP_DIR" ]] || return 1
  chown -R root:www-data "$APP_DIR" || return 1
  find "$APP_DIR" -type d -exec chmod 750 {} \;
  find "$APP_DIR" -type f -exec chmod 640 {} \;
  chmod +x "$APP_DIR/install.sh" "$APP_DIR/update.sh" "$APP_DIR/uninstall.sh" 2>/dev/null || true

  mkdir -p "$APP_DIR/public/uploads" "$APP_DIR/storage/backups" "$APP_DIR/storage/cache"
  chown -R www-data:www-data "$APP_DIR/public/uploads" "$APP_DIR/storage"
  find "$APP_DIR/public/uploads" "$APP_DIR/storage" -type d -exec chmod 750 {} \;
  find "$APP_DIR/public/uploads" "$APP_DIR/storage" -type f -exec chmod 640 {} \; 2>/dev/null || true
  [[ -f "$APP_DIR/config.php" ]] && { chown root:www-data "$APP_DIR/config.php"; chmod 640 "$APP_DIR/config.php"; }
}

find_php_sock() {
  find /run/php -name 'php*-fpm.sock' 2>/dev/null | sort -V | tail -n1
}

step_nginx() {
  require_root
  [[ -d "$APP_DIR/public" ]] || { fail "Public directory missing: $APP_DIR/public"; return 1; }
  validate_domain "$DOMAIN" || { fail "Invalid DOMAIN: $DOMAIN"; return 1; }
  local php_sock nginx_conf
  php_sock="$(find_php_sock)"
  [[ -n "$php_sock" ]] || { fail "PHP-FPM socket not found."; return 1; }
  nginx_conf="/etc/nginx/sites-available/${NGINX_SITE}"

  cat > "$nginx_conf" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    root ${APP_DIR}/public;
    index index.php index.html;
    client_max_body_size 20M;

    location / {
        try_files \$uri \$uri/ /index.php?\$query_string;
    }

    # Migration endpoint is CLI-only after installation.
    location = /install.php { deny all; }

    location ~ \.php$ {
        try_files \$uri =404;
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:${php_sock};
    }

    location ~ /\. { deny all; }
}
NGINX

  ln -sfn "$nginx_conf" "/etc/nginx/sites-enabled/${NGINX_SITE}" || return 1
  rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
  nginx -t || return 1
  systemctl reload nginx || return 1
}

step_ssl() {
  require_root
  if [[ "${ENABLE_SSL,,}" != "yes" && "${ENABLE_SSL,,}" != "y" ]]; then
    warn "SSL skipped (ENABLE_SSL=$ENABLE_SSL). Telegram Mini App/Webhook require HTTPS."
    return 0
  fi
  [[ -n "$DOMAIN" ]] || { fail "DOMAIN is empty"; return 1; }
  local email
  email="${SSL_EMAIL:-admin@${DOMAIN}}"
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$email" --redirect
}

step_migrate() {
  require_root
  [[ -f "$APP_DIR/public/install.php" ]] || { fail "Missing $APP_DIR/public/install.php"; return 1; }
  runuser -u www-data -- php "$APP_DIR/public/install.php" || return 1
}

step_webhook() {
  require_root
  if [[ "${ENABLE_SSL,,}" != "yes" && "${ENABLE_SSL,,}" != "y" ]]; then
    warn "Webhook skipped because SSL is disabled."
    return 0
  fi
  local res
  res="$(curl -fsS "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
    --data-urlencode "url=https://${DOMAIN}/bot.php?secret=${WEBHOOK_SECRET}" \
    --data-urlencode 'allowed_updates=["message","callback_query","pre_checkout_query"]')" || return 1
  echo "Telegram response: $res"
  echo "$res" | grep -q '"ok":true' || return 1
}

step_crypto_cron() {
  require_root
  [[ -f "$APP_DIR/public/cron_crypto.php" ]] || { fail "Missing cron_crypto.php"; return 1; }
  cat > "$CRON_FILE" <<CRON
# BlueGate Platform crypto jobs
* * * * * www-data php ${APP_DIR}/public/cron_crypto.php --check-payments >/dev/null 2>&1
*/10 * * * * www-data php ${APP_DIR}/public/cron_crypto.php --refresh-rates >/dev/null 2>&1
CRON
  chmod 644 "$CRON_FILE"
}

step_healthcheck() {
  require_root
  php -l "$APP_DIR/public/api.php" || return 1
  php -l "$APP_DIR/public/bot.php" || return 1
  php -l "$APP_DIR/app/bootstrap.php" || return 1
  if [[ "${ENABLE_SSL,,}" == "yes" || "${ENABLE_SSL,,}" == "y" ]]; then
    curl -fsS --max-time 15 "https://${DOMAIN}/api.php?action=storefront" >/tmp/bluegate-health.json || return 1
  else
    curl -fsS --max-time 15 -H "Host: ${DOMAIN}" "http://127.0.0.1/api.php?action=storefront" >/tmp/bluegate-health.json || return 1
  fi
  grep -q '"ok"' /tmp/bluegate-health.json || { cat /tmp/bluegate-health.json; return 1; }
  rm -f /tmp/bluegate-health.json
}

step_update() {
  require_root
  [[ -d "$APP_DIR/.git" ]] || { fail "No Git repository in $APP_DIR"; return 1; }
  git config --global --add safe.directory "$APP_DIR" 2>/dev/null || true
  git -C "$APP_DIR" remote set-url origin "$REPO_URL" || true
  git -C "$APP_DIR" fetch origin --prune || return 1
  if git -C "$APP_DIR" show-ref --verify --quiet refs/remotes/origin/main; then
    git -C "$APP_DIR" reset --hard origin/main || return 1
  else
    git -C "$APP_DIR" pull --ff-only || return 1
  fi
  step_permissions || return 1
  step_migrate || return 1
  nginx -t && systemctl reload nginx || return 1
  ok "Updated to latest GitHub version."
}

step_status() {
  echo "$PROJECT_NAME status"
  line
  echo "App dir:      $APP_DIR"
  echo "Repo URL:     $REPO_URL"
  echo "Domain:       ${DOMAIN:-not set}"
  echo "Storefront:   ${DOMAIN:+https://${DOMAIN}/}"
  echo "Portal:       ${DOMAIN:+https://${DOMAIN}/portal/}"
  echo "Mini App:     ${DOMAIN:+https://${DOMAIN}/miniapp/}"
  echo "Env file:     $ENV_FILE"
  echo "Log file:     $LOG_FILE"
  echo "Manager:      $(command -v "$MANAGER_CMD" || echo not-installed)"
  echo
  [[ -d "$APP_DIR/.git" ]] && echo "Git repo:     OK" || echo "Git repo:     missing"
  [[ -f "$APP_DIR/config.php" ]] && { echo "Config:       OK"; php -l "$APP_DIR/config.php"; } || echo "Config:       missing"
  systemctl is-active --quiet nginx && echo "nginx:        active" || echo "nginx:        inactive"
  systemctl is-active --quiet mariadb && echo "mariadb:      active" || echo "mariadb:      inactive"
  nginx -t || true
}

step_uninstall_files() {
  require_root
  echo "This removes app files, nginx site and cron. Database and $ENV_FILE are kept."
  read -rp "Continue? [y/N] " yn || true
  [[ "$yn" == "y" || "$yn" == "Y" ]] || return 0
  rm -f "/etc/nginx/sites-enabled/${NGINX_SITE}" "/etc/nginx/sites-available/${NGINX_SITE}" "$CRON_FILE"
  rm -rf "$APP_DIR"
  nginx -t && systemctl reload nginx || true
  ok "App files removed. Database and env kept."
}

full_install() {
  run_step "Install/repair BlueGate manager command" install_manager_command || { pause; return 1; }
  collect_settings || { pause; return 1; }
  run_step "Install system packages" step_packages || { pause; return 1; }
  run_step "Clone/update BlueGate Platform repository" step_repo || { pause; return 1; }
  run_step "Generate config.php" step_config || { pause; return 1; }
  run_step "Create/update database" step_database || { pause; return 1; }
  run_step "Set secure file permissions" step_permissions || { pause; return 1; }
  run_step "Configure nginx" step_nginx || { pause; return 1; }
  run_step "Request SSL certificate" step_ssl || { pause; return 1; }
  run_step "Run database migrations / seed" step_migrate || { pause; return 1; }
  run_step "Set Telegram webhook" step_webhook || { pause; return 1; }
  run_step "Install crypto cron" step_crypto_cron || { pause; return 1; }
  run_step "Health check" step_healthcheck || { pause; return 1; }
  echo
  ok "$PROJECT_NAME installed successfully"
  echo "Storefront: https://${DOMAIN}/"
  echo "Portal:     https://${DOMAIN}/portal/"
  echo "Mini App:   https://${DOMAIN}/miniapp/"
  echo "Manager:    sudo ${MANAGER_CMD}"
  pause
}

menu() {
  require_root
  while true; do
    clear
    echo "$PROJECT_NAME Installer / Manager"
    line
    echo "1) Full install / reinstall"
    echo "2) Setup wizard"
    echo "3) Install/repair system packages"
    echo "4) Clone/update GitHub repository"
    echo "5) Generate/repair config.php"
    echo "6) Create/update database"
    echo "7) Set secure permissions"
    echo "8) Configure nginx"
    echo "9) Request/repair SSL"
    echo "10) Run database migrations"
    echo "11) Set Telegram webhook"
    echo "12) Install/repair manager command"
    echo "13) Update project from GitHub"
    echo "14) Status / diagnostics"
    echo "15) Install/repair crypto cron"
    echo "16) Health check"
    echo "17) Remove app files only"
    echo "0) Exit"
    line
    echo "After install: sudo ${MANAGER_CMD}"
    echo "Log: $LOG_FILE"
    line
    read -rp "Choose: " choice || true
    case "$choice" in
      1) full_install ;;
      2) collect_settings; pause ;;
      3) run_step "Install system packages" step_packages; pause ;;
      4) run_step "Clone/update repository" step_repo; pause ;;
      5) run_step "Generate config.php" step_config; pause ;;
      6) run_step "Create/update database" step_database; pause ;;
      7) run_step "Set secure permissions" step_permissions; pause ;;
      8) run_step "Configure nginx" step_nginx; pause ;;
      9) run_step "Request/repair SSL" step_ssl; pause ;;
      10) run_step "Run database migrations" step_migrate; pause ;;
      11) run_step "Set Telegram webhook" step_webhook; pause ;;
      12) run_step "Install/repair manager command" install_manager_command; pause ;;
      13) run_step "Update project from GitHub" step_update; pause ;;
      14) step_status; pause ;;
      15) run_step "Install/repair crypto cron" step_crypto_cron; pause ;;
      16) run_step "Health check" step_healthcheck; pause ;;
      17) step_uninstall_files; pause ;;
      0) exit 0 ;;
      *) echo "Invalid option"; sleep 1 ;;
    esac
  done
}

case "${1:-}" in
  --full|--install) require_root; full_install ;;
  --status) require_root; step_status ;;
  --webhook) require_root; run_step "Set Telegram webhook" step_webhook ;;
  --update) require_root; run_step "Update project from GitHub" step_update ;;
  --install-command) require_root; run_step "Install/repair manager command" install_manager_command ;;
  --crypto-cron) require_root; run_step "Install/repair crypto cron" step_crypto_cron ;;
  --health) require_root; run_step "Health check" step_healthcheck ;;
  --help|-h)
    echo "Usage: sudo bash install.sh [--full|--status|--webhook|--update|--health]"
    echo "Default: interactive menu. After installation run: sudo ${MANAGER_CMD}"
    ;;
  *) menu ;;
esac
