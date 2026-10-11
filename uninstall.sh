#!/usr/bin/env bash
set -uo pipefail
ENV_FILE="/etc/bluegate-platform.env"
APP_DIR="${APP_DIR:-/var/www/bluegate-platform}"
[[ -f "$ENV_FILE" ]] && source "$ENV_FILE"

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "Run as root: sudo bash uninstall.sh"
  exit 1
fi

echo "This removes BlueGate Platform app files, nginx site and cron only."
echo "Database and $ENV_FILE will be kept."
read -rp "Continue? [y/N] " yn || true
[[ "$yn" == "y" || "$yn" == "Y" ]] || exit 0

rm -f /etc/nginx/sites-enabled/bluegate-platform /etc/nginx/sites-available/bluegate-platform
rm -f /etc/cron.d/bluegate-platform
rm -rf "$APP_DIR"
if command -v nginx >/dev/null 2>&1; then
  nginx -t && systemctl reload nginx || true
fi
echo "Removed app files. Manager command can be removed with: rm -f /usr/local/bin/bluegate"
