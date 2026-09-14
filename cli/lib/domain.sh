#!/usr/bin/env bash

_domain_resolve_ipv4(){ getent ahostsv4 "$1" 2>/dev/null | awk '{print $1}' | sort -u | paste -sd, -; }
_domain_public_ipv4(){ curl -4fsS --max-time 5 https://api.ipify.org 2>/dev/null || curl -4fsS --max-time 5 https://ifconfig.me/ip 2>/dev/null || true; }

domain_status(){
  header; echo "Domain / SSL Status"; echo
  label "Configured domain" "${DOMAIN:-not configured}"
  [[ -z "$DOMAIN" ]] && return 1
  local ips cert="missing" expiry="-" webhook="-" code="000"
  ips="$(_domain_resolve_ipv4 "$DOMAIN")"; [[ -n "$ips" ]] || ips="unresolved"
  if [[ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]]; then
    cert="present"; expiry="$(openssl x509 -enddate -noout -in "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" 2>/dev/null | cut -d= -f2-)"
  fi
  code="$(curl -ksS -o /dev/null -w '%{http_code}' --max-time 8 "https://${DOMAIN}/" 2>/dev/null || echo 000)"
  if [[ -n "$BOT_TOKEN" ]] && command -v jq >/dev/null 2>&1; then webhook="$(tg_api getWebhookInfo 2>/dev/null | jq -r '.result.url // "-"' 2>/dev/null || echo -)"; fi
  label "DNS IPv4" "$ips"; label "SSL" "$cert"; label "SSL expiry" "$expiry"; label "HTTPS" "HTTP $code"; label "Webhook" "$webhook"
}

domain_preflight(){
  local d="$1" ips pub
  validate_domain "$d" || { fail "Invalid domain: $d"; return 1; }
  ips="$(_domain_resolve_ipv4 "$d")"
  [[ -n "$ips" ]] || { fail "$d does not resolve to an IPv4 address yet."; return 1; }
  ok "DNS resolves: $ips"
  pub="$(_domain_public_ipv4)"
  if [[ -n "$pub" && ",$ips," != *",$pub,"* ]]; then
    warn "DNS does not directly resolve to this server public IPv4 ($pub). This can be normal behind Cloudflare/proxy; certificate validation will decide."
  elif [[ -n "$pub" ]]; then ok "DNS points to this server ($pub)"; fi
  command -v certbot >/dev/null 2>&1 || { fail "certbot is not installed"; return 1; }
  command -v nginx >/dev/null 2>&1 || { fail "nginx is not installed"; return 1; }
  return 0
}

domain_patch_php_config(){
  local d="$1" cfg="$APP_DIR/config.php"
  [[ -f "$cfg" ]] || { fail "Config missing: $cfg"; return 1; }
  python3 - "$cfg" "$d" <<'PY'
import re,sys
p,d=sys.argv[1],sys.argv[2]
s=open(p,encoding='utf-8').read()
def sub(key,val,s):
    pat=rf"^\${re.escape(key)}\s*=\s*'[^']*';"
    rep=f"${key} = '{val}';"
    ns,n=re.subn(pat,rep,s,flags=re.M)
    if n!=1: raise SystemExit(f"Could not patch ${key}")
    return ns
s=sub('PUBLIC_BASE_URL',f'https://{d}',s)
s=sub('MINIAPP_URL',f'https://{d}/miniapp/',s)
open(p,'w',encoding='utf-8').write(s)
PY
}

domain_prepare_challenge_nginx(){
  local d="$1" conf="/etc/nginx/sites-available/${NGINX_SITE}" marker="# BlueGate temporary ACME host: ${d}"
  [[ -f "$conf" ]] || { fail "nginx site config missing: $conf"; return 1; }
  grep -Fq "$marker" "$conf" 2>/dev/null && return 0
  cat >> "$conf" <<EOF

${marker}
server {
    listen 80; listen [::]:80; server_name ${d};
    root ${APP_DIR}/public;
    location ^~ /.well-known/acme-challenge/ { try_files \$uri =404; }
    location / { return 404; }
}
EOF
  nginx -t && systemctl reload nginx
}

domain_issue_ssl(){
  local d="$1" email="${SSL_EMAIL:-admin@$1}"
  mkdir -p "$APP_DIR/public/.well-known/acme-challenge"
  certbot certonly --webroot -w "$APP_DIR/public" -d "$d" --non-interactive --agree-tos -m "$email" --keep-until-expiring
  [[ -f "/etc/letsencrypt/live/${d}/fullchain.pem" && -f "/etc/letsencrypt/live/${d}/privkey.pem" ]]
}

domain_verify(){
  local d="$1" code wh
  code="$(curl -ksS -o /tmp/bg-domain-verify.$$ -w '%{http_code}' --max-time 12 --resolve "${d}:443:127.0.0.1" "https://${d}/api.php?action=storefront" 2>/dev/null || echo 000)"
  if [[ "$code" != "200" ]] || ! grep -Eq '"ok"[[:space:]]*:[[:space:]]*true' /tmp/bg-domain-verify.$$ 2>/dev/null; then rm -f /tmp/bg-domain-verify.$$; fail "New HTTPS/API verification failed (HTTP $code)"; return 1; fi
  rm -f /tmp/bg-domain-verify.$$
  if [[ -n "$BOT_TOKEN" ]]; then
    wh="$(tg_api getWebhookInfo 2>/dev/null | (command -v jq >/dev/null 2>&1 && jq -r '.result.url // empty' || cat) 2>/dev/null || true)"
    [[ "$wh" == "https://${d}/bot.php?secret=${WEBHOOK_SECRET}" ]] || { fail "Telegram webhook did not switch to the new domain"; return 1; }
  fi
  return 0
}

domain_change(){
  require_root; try_extract_php_config
  local new="${1:-}" old="$DOMAIN" tx backup nginx_conf old_webhook="" i=1 total=9
  [[ -n "$old" ]] || { fail "Current domain is not configured."; return 1; }
  [[ -n "$new" ]] || read -rp "New domain (without https): " new
  new="${new#http://}"; new="${new#https://}"; new="${new%%/*}"
  [[ "$new" != "$old" ]] || { info "Domain is already $old"; return 0; }
  header; echo "Domain Migration"; echo; label "Current" "$old"; label "New" "$new"; echo
  confirm "Switch BlueGate from $old to $new?" no || return 1
  step $i $total "Validating domain and DNS"; ((i+=1)); domain_preflight "$new" >/tmp/bg-domain-preflight.$$ 2>&1 && step_ok || { step_fail; cat /tmp/bg-domain-preflight.$$; rm -f /tmp/bg-domain-preflight.$$; return 1; }; cat /tmp/bg-domain-preflight.$$; rm -f /tmp/bg-domain-preflight.$$

  tx="/var/backups/bluegate-domain-$(slug_now)"; mkdir -p "$tx"; chmod 700 "$tx"
  cp -a "$ENV_FILE" "$tx/env" 2>/dev/null || true; cp -a "$APP_DIR/config.php" "$tx/config.php" 2>/dev/null || true
  nginx_conf="/etc/nginx/sites-available/${NGINX_SITE}"; cp -a "$nginx_conf" "$tx/nginx.conf" 2>/dev/null || true
  if [[ -n "$BOT_TOKEN" ]] && command -v jq >/dev/null 2>&1; then old_webhook="$(tg_api getWebhookInfo 2>/dev/null | jq -r '.result.url // empty' 2>/dev/null || true)"; fi
  printf '%s' "$old_webhook" > "$tx/webhook.url"

  _domain_rollback(){
    warn "Migration failed. Restoring previous configuration..."
    [[ -f "$tx/env" ]] && cp -a "$tx/env" "$ENV_FILE"
    [[ -f "$tx/config.php" ]] && cp -a "$tx/config.php" "$APP_DIR/config.php"
    [[ -f "$tx/nginx.conf" ]] && cp -a "$tx/nginx.conf" "$nginx_conf"
    DOMAIN="$old"; source "$ENV_FILE" 2>/dev/null || true
    nginx -t >/dev/null 2>&1 && systemctl reload nginx || true
    if [[ -n "$old_webhook" && -n "$BOT_TOKEN" ]]; then local rb_args=(--data-urlencode "url=$old_webhook" --data-urlencode 'allowed_updates=["message","callback_query","pre_checkout_query"]'); [[ -n "$TELEGRAM_WEBHOOK_SECRET" ]] && rb_args+=(--data-urlencode "secret_token=$TELEGRAM_WEBHOOK_SECRET"); tg_api setWebhook "${rb_args[@]}" >/dev/null 2>&1 || true; fi
    fail "Domain migration rolled back. Backup: $tx"
  }

  step $i $total "Backing up current configuration"; ((i+=1)); step_ok
  step $i $total "Preparing ACME challenge without taking old domain offline"; ((i+=1)); domain_prepare_challenge_nginx "$new" >/dev/null 2>&1 && step_ok || { step_fail; _domain_rollback; return 1; }
  step $i $total "Requesting SSL certificate"; ((i+=1)); domain_issue_ssl "$new" >/tmp/bg-certbot.$$ 2>&1 && step_ok || { step_fail; tail -n 30 /tmp/bg-certbot.$$; rm -f /tmp/bg-certbot.$$; _domain_rollback; return 1; }; rm -f /tmp/bg-certbot.$$
  step $i $total "Activating HTTPS nginx config"; ((i+=1)); configure_nginx >/dev/null 2>&1 && step_ok || { step_fail; _domain_rollback; return 1; }
  step $i $total "Updating BlueGate URLs"; ((i+=1)); domain_patch_php_config "$new" && { DOMAIN="$new"; save_env; configure_permissions >/dev/null 2>&1 || true; step_ok; } || { step_fail; _domain_rollback; return 1; }
  step $i $total "Refreshing Telegram webhook"; ((i+=1)); if [[ -n "$BOT_TOKEN" ]]; then telegram_set_webhook >/dev/null 2>&1 && step_ok || { step_fail; _domain_rollback; return 1; }; else step_ok; fi
  step $i $total "Syncing Telegram UI"; ((i+=1)); if [[ -n "$BOT_TOKEN" ]]; then telegram_sync_ui >/dev/null 2>&1 && step_ok || { step_fail; warn "Bot UI sync failed; domain migration can still continue."; }; else step_ok; fi
  step $i $total "Verifying HTTPS, API and webhook"; ((i+=1)); domain_verify "$new" && step_ok || { step_fail; _domain_rollback; return 1; }
  echo; ok "Domain migration completed successfully"; label "Domain" "$old ${UI_ARROW:-"->"} $new"; label "Rollback backup" "$tx"
}

domain_ssl_repair(){ require_root; [[ -n "$DOMAIN" ]] || { fail "Domain not configured"; return 1; }; domain_preflight "$DOMAIN" || return 1; configure_nginx || return 1; domain_issue_ssl "$DOMAIN" || return 1; configure_nginx || return 1; ok "SSL repaired for $DOMAIN"; }

domain_menu(){
  while true; do header; echo "Domain / SSL Manager"; echo; echo "  1) Status"; echo "  2) Change domain"; echo "  3) Repair / renew SSL"; echo "  4) Refresh Telegram webhook"; echo "  0) Back"; line; read -rp "Choose: " c || true; case "$c" in 1) domain_status; pause;; 2) domain_change; pause;; 3) domain_ssl_repair; pause;; 4) telegram_set_webhook; pause;; 0) return 0;; esac; done
}
