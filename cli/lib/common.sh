#!/usr/bin/env bash
# Shared runtime for BlueGate CLI.
set -uo pipefail

PROJECT_NAME="BlueGate Platform"
CLI_VERSION="2.0.1"
APP_NAME="bluegate-platform"
DEFAULT_REPO_URL="https://github.com/paliparsa/BlueGate-Platform.git"
DEFAULT_APP_DIR="/var/www/${APP_NAME}"
ENV_FILE="${BLUEGATE_ENV_FILE:-/etc/bluegate-platform.env}"
LOG_DIR="${BLUEGATE_LOG_DIR:-/var/log/bluegate-platform}"
CLI_LOG="${LOG_DIR}/cli.log"
UPDATE_LOG="${LOG_DIR}/update.log"
BACKUP_ROOT="${BLUEGATE_BACKUP_ROOT:-/var/backups/bluegate-platform}"
CRON_FILE="/etc/cron.d/bluegate-platform"
NGINX_SITE="bluegate-platform"
MANAGER_CMD="bluegate"

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
TELEGRAM_WEBHOOK_SECRET="${TELEGRAM_WEBHOOK_SECRET:-}"
SWAPWALLET_CALLBACK_SECRET="${SWAPWALLET_CALLBACK_SECRET:-}"
THEME_COLOR="${THEME_COLOR:-#1d9bf0}"
BRAND_NAME="${BRAND_NAME:-BlueGate}"
FORCE_JOIN_CHANNEL="${FORCE_JOIN_CHANNEL:-}"
ENABLE_SSL="${ENABLE_SSL:-yes}"
SSL_EMAIL="${SSL_EMAIL:-}"
RESEND_API_KEY="${RESEND_API_KEY:-}"
RESEND_FROM_EMAIL="${RESEND_FROM_EMAIL:-onboarding@resend.dev}"
BACKUP_KEEP="${BACKUP_KEEP:-5}"
DB_BACKUP_DAYS="${DB_BACKUP_DAYS:-14}"

[[ -f "$ENV_FILE" ]] && source "$ENV_FILE"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_CANON="$(readlink -f "$APP_DIR" 2>/dev/null || echo "$APP_DIR")"
SOURCE_CANON="$(readlink -f "$SOURCE_ROOT" 2>/dev/null || echo "$SOURCE_ROOT")"
if [[ -f "$SOURCE_ROOT/VERSION" && "$SOURCE_CANON" != "$APP_CANON" ]]; then
  LOCAL_SOURCE_ROOT="$SOURCE_ROOT"
else
  LOCAL_SOURCE_ROOT=""
fi

mkdir_logs(){
  if [[ ${EUID:-$(id -u)} -eq 0 ]]; then
    mkdir -p "$LOG_DIR" "$BACKUP_ROOT" 2>/dev/null || true
    touch "$CLI_LOG" "$UPDATE_LOG" 2>/dev/null || true
    chmod 750 "$LOG_DIR" "$BACKUP_ROOT" 2>/dev/null || true
    chmod 640 "$CLI_LOG" "$UPDATE_LOG" 2>/dev/null || true
  fi
}
mkdir_logs

require_root(){
  if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
    if command -v sudo >/dev/null 2>&1; then exec sudo -E "$0" "$@"; fi
    echo "Run as root: sudo bluegate $*" >&2; exit 2
  fi
}

app_version(){ if [[ -f "$APP_DIR/VERSION" ]]; then tr -d '\r\n ' < "$APP_DIR/VERSION"; elif [[ -f "$SOURCE_ROOT/VERSION" ]]; then tr -d '\r\n ' < "$SOURCE_ROOT/VERSION"; else echo "not-installed"; fi; }
source_version(){ [[ -f "$SOURCE_ROOT/VERSION" ]] && tr -d '\r\n ' < "$SOURCE_ROOT/VERSION" || echo "unknown"; }
now(){ date '+%Y-%m-%d %H:%M:%S'; }
slug_now(){ date '+%Y%m%d-%H%M%S'; }
rand_hex(){ openssl rand -hex "${1:-16}" 2>/dev/null || date +%s%N | sha256sum | cut -c1-$(( ${1:-16} * 2 )); }
mask_secret(){ local v="${1:-}"; [[ -z "$v" ]] && { echo "—"; return; }; [[ ${#v} -lt 9 ]] && { echo "••••"; return; }; echo "${v:0:4}…${v: -4}"; }
validate_db_identifier(){ [[ "$1" =~ ^[A-Za-z0-9_]+$ ]]; }
validate_domain(){ [[ "$1" =~ ^[A-Za-z0-9.-]+$ ]] && [[ "$1" == *.* ]] && [[ "$1" != .* ]] && [[ "$1" != *. ]]; }
php_escape(){ printf "%s" "$1" | sed "s/\\\\/\\\\\\\\/g; s/'/\\\\'/g"; }
sql_escape(){ local s="$1"; s="${s//\\/\\\\}"; s="${s//\'/\'\'}"; printf "%s" "$s"; }
admin_array_php(){ echo "$ADMIN_IDS" | awk -F, '{c=0; for(i=1;i<=NF;i++){gsub(/ /,"",$i); if($i ~ /^[0-9]+$/){printf "%s%s", (c++?",":""), $i}}}' | sed 's/^/[/' | sed 's/$/]/'; }

save_env(){
  umask 077
  mkdir -p "$(dirname "$ENV_FILE")"
  {
    echo "# BlueGate Platform CLI state - generated automatically"
    for var in DOMAIN BOT_TOKEN BOT_USERNAME ADMIN_IDS SUPPORT_USERNAME REPO_URL APP_DIR DB_NAME DB_USER DB_PASS WEBHOOK_SECRET TELEGRAM_WEBHOOK_SECRET SWAPWALLET_CALLBACK_SECRET THEME_COLOR BRAND_NAME FORCE_JOIN_CHANNEL ENABLE_SSL SSL_EMAIL RESEND_API_KEY RESEND_FROM_EMAIL BACKUP_KEEP DB_BACKUP_DAYS; do
      printf '%s=%q\n' "$var" "${!var:-}"
    done
  } > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
}

try_extract_php_config(){
  local cfg="$APP_DIR/config.php"; [[ -f "$cfg" ]] || return 0
  extract_string(){ local key="$1"; grep -E "^\\\$$key[[:space:]]*=" "$cfg" | head -n1 | sed -E "s/^\\\$$key[[:space:]]*=[[:space:]]*'([^']*)'.*/\\1/"; }
  [[ -z "$BOT_TOKEN" ]] && BOT_TOKEN="$(extract_string BOT_TOKEN)"
  [[ -z "$BOT_USERNAME" ]] && BOT_USERNAME="$(extract_string BOT_USERNAME)"
  [[ -z "$SUPPORT_USERNAME" ]] && SUPPORT_USERNAME="$(extract_string SUPPORT_USERNAME)"
  [[ -z "$DB_NAME" ]] && DB_NAME="$(extract_string DB_NAME)"
  [[ -z "$DB_USER" ]] && DB_USER="$(extract_string DB_USER)"
  [[ -z "$DB_PASS" ]] && DB_PASS="$(extract_string DB_PASS)"
  [[ -z "$WEBHOOK_SECRET" ]] && WEBHOOK_SECRET="$(extract_string WEBHOOK_SECRET)"
  [[ -z "$TELEGRAM_WEBHOOK_SECRET" ]] && TELEGRAM_WEBHOOK_SECRET="$(extract_string TELEGRAM_WEBHOOK_SECRET)"
  [[ -z "$SWAPWALLET_CALLBACK_SECRET" ]] && SWAPWALLET_CALLBACK_SECRET="$(extract_string SWAPWALLET_CALLBACK_SECRET)"
  local val; val="$(grep -E '^\$PUBLIC_BASE_URL[[:space:]]*=' "$cfg" | head -n1 | sed -E "s#^\\\$PUBLIC_BASE_URL[[:space:]]*=[[:space:]]*'https?://([^']*)'.*#\\1#")"
  [[ -z "$DOMAIN" && -n "$val" ]] && DOMAIN="$val"
}

mysql_app(){ MYSQL_PWD="$DB_PASS" mysql --protocol=socket -u"$DB_USER" "$DB_NAME" "$@"; }
mysql_root(){ mysql "$@"; }
maintenance_file(){ echo "$APP_DIR/public/.maintenance"; }
maintenance_on(){ mkdir -p "$APP_DIR/public"; cat > "$(maintenance_file)" <<EOF
BlueGate is being updated. Please try again in a moment.
EOF
}
maintenance_off(){ rm -f "$(maintenance_file)"; }

confirm(){ local prompt="${1:-Continue?}" default="${2:-no}" ans; if [[ "${YES:-0}" == "1" ]]; then return 0; fi; if [[ "$default" == "yes" ]]; then read -rp "$prompt [Y/n] " ans || true; [[ -z "$ans" || "$ans" =~ ^[Yy]$ ]]; else read -rp "$prompt [y/N] " ans || true; [[ "$ans" =~ ^[Yy]$ ]]; fi; }
