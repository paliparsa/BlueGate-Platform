#!/usr/bin/env bash
HC_OK=0; HC_WARN=0; HC_FAIL=0; HC_LINES=()
hc_add(){ local st="$1" name="$2" detail="$3"; HC_LINES+=("$st|$name|$detail"); case "$st" in ok) ((HC_OK+=1));; warn) ((HC_WARN+=1));; fail) ((HC_FAIL+=1));; esac; }
hc_cmd(){ command -v "$1" >/dev/null 2>&1; }
hc_service(){ systemctl is-active --quiet "$1" 2>/dev/null; }
file_age_sec(){ local f="$1"; [[ -f "$f" ]] || { echo 999999999; return; }; echo $(( $(date +%s) - $(stat -c %Y "$f") )); }

health_collect(){
  HC_OK=0; HC_WARN=0; HC_FAIL=0; HC_LINES=()
  local free_kb phpv ext missing="" diskp
  diskp="$(df -P "$APP_DIR" 2>/dev/null | awk 'NR==2{gsub(/%/,"",$5);print $5}')"; diskp="${diskp:-100}"
  [[ "$diskp" -lt 90 ]] && hc_add ok "Disk" "${diskp}% used" || [[ "$diskp" -lt 96 ]] && hc_add warn "Disk" "${diskp}% used" || hc_add fail "Disk" "${diskp}% used"
  phpv="$(php -r 'echo PHP_VERSION;' 2>/dev/null || true)"; [[ -n "$phpv" ]] && hc_add ok "PHP" "$phpv" || hc_add fail "PHP" "not found"
  for ext in pdo_mysql curl mbstring json; do php -m 2>/dev/null | grep -qi "^${ext}$" || missing+="$ext "; done
  [[ -z "$missing" ]] && hc_add ok "PHP extensions" "required extensions loaded" || hc_add fail "PHP extensions" "missing: $missing"
  hc_service nginx && hc_add ok "nginx" "active" || hc_add fail "nginx" "inactive"
  hc_service mariadb && hc_add ok "MariaDB" "active" || hc_add fail "MariaDB" "inactive"
  [[ -f "$APP_DIR/config.php" ]] && hc_add ok "Config" "present, mode $(stat -c %a "$APP_DIR/config.php" 2>/dev/null)" || hc_add fail "Config" "missing"
  [[ -d "$APP_DIR/public/uploads" && -w "$APP_DIR/public/uploads" ]] && hc_add ok "Uploads" "writable" || hc_add fail "Uploads" "not writable"
  [[ -d "$APP_DIR/storage" && -w "$APP_DIR/storage" ]] && hc_add ok "Storage" "writable" || hc_add fail "Storage" "not writable"
  if [[ -n "$DB_PASS" ]] && mysql_app -Nse 'SELECT 1' >/dev/null 2>&1; then
    hc_add ok "Database" "connected"
    local tables; tables="$(mysql_app -Nse 'SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE()' 2>/dev/null || echo 0)"
    [[ "$tables" -gt 5 ]] && hc_add ok "DB schema" "$tables tables" || hc_add warn "DB schema" "only $tables tables; migration may be required"
  else hc_add fail "Database" "connection failed"; fi
  if [[ -n "$DOMAIN" ]]; then
    local url code; if [[ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]]; then url="https://${DOMAIN}/api.php?action=storefront"; code="$(curl -ksS -o /tmp/bg-health.$$ -w '%{http_code}' --max-time 12 --resolve "${DOMAIN}:443:127.0.0.1" "$url" 2>/dev/null || echo 000)"; else url="http://127.0.0.1/api.php?action=storefront"; code="$(curl -sS -o /tmp/bg-health.$$ -w '%{http_code}' --max-time 12 -H "Host: ${DOMAIN}" "$url" 2>/dev/null || echo 000)"; fi
    if [[ "$code" == 200 ]] && grep -Eq '"ok"[[:space:]]*:[[:space:]]*true' /tmp/bg-health.$$ 2>/dev/null; then hc_add ok "Store API" "HTTP 200"; else hc_add fail "Store API" "HTTP $code"; fi; rm -f /tmp/bg-health.$$
    [[ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]] && hc_add ok "TLS" "certificate present" || hc_add warn "TLS" "certificate missing"
  else hc_add warn "Domain" "not configured"; fi
  if [[ -n "$BOT_TOKEN" ]]; then local tg; tg="$(telegram_health_text 2>/dev/null)"; [[ $? -eq 0 ]] && hc_add ok "Telegram" "$tg" || hc_add warn "Telegram" "$tg"; else hc_add warn "Telegram" "not configured"; fi
  [[ -f "$CRON_FILE" ]] && hc_add ok "Cron config" "installed" || hc_add warn "Cron config" "missing"
  local age; age="$(file_age_sec "$APP_DIR/storage/cache/cron-payments.last")"; [[ "$age" -lt 300 ]] && hc_add ok "Payment cron" "last success ${age}s ago" || hc_add warn "Payment cron" "no recent success marker"
  age="$(file_age_sec "$APP_DIR/storage/cache/cron-rates.last")"; [[ "$age" -lt 1800 ]] && hc_add ok "Rates cron" "last success ${age}s ago" || hc_add warn "Rates cron" "no recent success marker"
  [[ ! -e "$APP_DIR/public/install.php" || -f "/etc/nginx/sites-enabled/${NGINX_SITE}" ]] && hc_add ok "Installer exposure" "blocked by nginx" || hc_add warn "Installer exposure" "verify web server rule"
  local mode; mode="$(stat -c %a "$APP_DIR/config.php" 2>/dev/null || echo 000)"; [[ "$mode" =~ ^(600|640)$ ]] && hc_add ok "Config permissions" "$mode" || hc_add warn "Config permissions" "$mode (recommended 640)"
  [[ "$(maintenance_file)" != "" && ! -f "$(maintenance_file)" ]] && hc_add ok "Maintenance" "off" || hc_add warn "Maintenance" "enabled"
}

health_render(){
  health_collect
  if [[ "${JSON_OUTPUT:-0}" == 1 ]]; then
    printf '{"ok":%s,"summary":{"pass":%d,"warn":%d,"fail":%d},"checks":[' "$([[ $HC_FAIL -eq 0 ]] && echo true || echo false)" "$HC_OK" "$HC_WARN" "$HC_FAIL"
    local first=1 l st name detail; for l in "${HC_LINES[@]}"; do IFS='|' read -r st name detail <<<"$l"; [[ $first -eq 0 ]] && printf ','; first=0; printf '{"status":"%s","name":"%s","detail":"%s"}' "$(printf %s "$st" | sed 's/"/\\"/g')" "$(printf %s "$name" | sed 's/"/\\"/g')" "$(printf %s "$detail" | sed 's/"/\\"/g')"; done; printf ']}\n'
  else
    header; printf "%bHealth Check%b\n\n" "$C_BOLD" "$C_RESET"
    local l st name detail; for l in "${HC_LINES[@]}"; do IFS='|' read -r st name detail <<<"$l"; printf "  "; status_dot "$st"; printf " %-22s %s\n" "$name" "$detail"; done
    echo; line; printf "PASS %d   WARN %d   FAIL %d\n" "$HC_OK" "$HC_WARN" "$HC_FAIL"
  fi
  [[ $HC_FAIL -gt 0 ]] && return 2; [[ $HC_WARN -gt 0 ]] && return 1; return 0
}

doctor(){
  health_collect; header; echo "BlueGate Doctor"; echo
  local issues=0 l st name detail
  for l in "${HC_LINES[@]}"; do IFS='|' read -r st name detail <<<"$l"; [[ "$st" == ok ]] && continue; ((issues+=1)); warn "$name — $detail"; done
  [[ $issues -eq 0 ]] && { ok "No actionable problems found."; return 0; }
  echo
  confirm "Run safe automatic repairs (permissions, cron, nginx, migrations, webhook)?" no || return 1
  configure_permissions || true; configure_cron || true; run_migrations || true; configure_nginx || true; telegram_set_webhook || true
  echo; health_render
}
