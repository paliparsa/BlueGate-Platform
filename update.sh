#!/usr/bin/env bash
set -uo pipefail
ENV_FILE="/etc/bluegate-platform.env"
APP_DIR="${APP_DIR:-/var/www/bluegate-platform}"
[[ -f "$ENV_FILE" ]] && source "$ENV_FILE"

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "Run as root: sudo bash update.sh or sudo bluegate --update"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/install.sh" ]]; then
  exec bash "$SCRIPT_DIR/install.sh" --update
elif [[ -f "$APP_DIR/install.sh" ]]; then
  exec bash "$APP_DIR/install.sh" --update
fi

echo "Cannot find install.sh. Run: sudo bluegate"
exit 1
