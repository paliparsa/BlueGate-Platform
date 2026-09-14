#!/usr/bin/env bash

_domain_resolve_ipv4(){ getent ahostsv4 "$1" 2>/dev/null | awk '{print $1}' | sort -u | paste -sd, -; }
_domain_public_ipv4(){ curl -4fsS --max-time 5 https://api.ipify.org 2>/dev/null || curl -4fsS --max-time 5 https://ifconfig.me/ip 2>/dev/null || true; }

_domain_acme_probe(){
  local d="$1" w token url body code
  w="$(acme_webroot)"; ensure_acme_webroot
  token="bluegate-$(rand_hex 8)"; body="bluegate-acme-${token}"
  printf '%s\n' "$body" > "$w/.well-known/acme-challenge/$token"
  chmod 644 "$w/.well-known/acme-challenge/$token" 2>/dev/null || true
  url="http://${d}/.well-known/acme-challenge/${token}"
  code="$(curl -LsS --max-redirs 5 -o /tmp/bg-acme-probe.$$ -w '%{http_code}' --max-time 12 "$url" 2>/dev/null || echo 000)"
  rm -f "$w/.well-known/acme-challenge/$token"
  if [[ "$code" != "200" ]] || ! grep -Fxq "$body" /tmp/bg-acme-probe.$$ 2>/dev/null; then
    rm -f /tmp/bg-acme-probe.$$
    fail "ACME challenge is not publicly reachable (HTTP $code)."
    info "Expected URL: $url"
    info "Check DNS/proxy/firewall and port 80 before requesting a certificate."
    return 1
  fi
  rm -f /tmp/bg-acme-probe.$$
  ok "ACME challenge is publicly reachable"
}

domain_status(){
  header; section "DOMAIN / SSL STATUS"
  label "Configured domain" "${DOMAIN:-not configured}"
  [[ -z "$DOMAIN" ]] && return 1
  local ips cert="missing" expiry="-" webhook="-" code="000"
  ips="$(_domain_resolve_ipv4 "$DOMAIN")"; [[ -n "$ips" ]] || ips="unresolved"
  if [[ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]]; then
    cert="present"; expiry="$(openssl x509 -enddate -noout -in "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" 2>/dev/null | cut -d= -f2-)"
  fi
  code="$(curl -ksS -o /dev/null -w '%{http_code}' --max-time 8 "https://${DOMAIN}/" 2>/dev/null || echo 000)"
  if [[ -n "$BOT_TOKEN" ]] && command -v jq >/dev/null 2>&1; then webhook="$(tg_api getWebhookInfo 2>/dev/null | jq -r '.result.url // "-"' 2>/dev/null || echo -)"; fi
  label "DNS IPv4" "$ips"; label "SSL certificate" "$cert"; label "SSL expiry" "$expiry"; label "HTTPS response" "HTTP $code"; label "Telegram webhook" "$webhook"
}

domain_preflight(){
  local d="$1" ips pub
  validate_domain "$d" || { fail "Invalid domain: $d"; return 1; }
  ips="$(_domain_resolve_ipv4 "$d")"
  [[ -n "$ips" ]] || { fail "$d does not resolve to an IPv4 address yet."; return 1; }
  ok "DNS resolves: $ips"
  pub="$(_domain_public_ipv4)"
  if [[ -n "$pub" && ",$ips," != *",$pub,"* ]]; then
    warn "DNS does not directly resolve to this server public IPv4 ($pub)."
    info "This may be normal behind Cloudflare/proxy; the ACME reachability test is authoritative."
  elif [[ -n "$pub" ]]; then ok "DNS points to this server ($pub)"; fi
  command -v certbot >/dev/null 2>&1 || { fail "certbot is not installed"; return 1; }
  command -v nginx >/dev/null 2>&1 || { fail "nginx is not installed"; return 1; }
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
  local d="$1" conf="/etc/nginx/sites-available/${NGINX_SITE}" marker="# BlueGate temporary ACME host: ${d}" acme
  [[ -f "$conf" ]] || { fail "nginx site config missing: $conf"; return 1; }
  acme="$(acme_webroot)"; ensure_acme_webroot
  grep -Fq "$marker" "$conf" 2>/dev/null && return 0
  cat >> "$conf" <<EOF_NGINX

${marker}
server {
    listen 80;
    listen [::]:80;
    server_name ${d};
    location ^~ /.well-known/acme-challenge/ {
        root ${acme};
        default_type text/plain;
        allow all;
        try_files \$uri =404;
    }
    location / { return 404; }
}
EOF_NGINX
  nginx -t || return 1
  systemctl reload nginx
}

domain_issue_ssl(){
  local d="$1" email="${SSL_EMAIL:-admin@$1}" acme
  acme="$(acme_webroot)"; ensure_acme_webroot
  _domain_acme_probe "$d" || return 1
  certbot certonly --webroot -w "$acme" -d "$d" --non-interactive --agree-tos -m "$email" --keep-until-expiring || return 1
  [[ -f "/etc/letsencrypt/live/${d}/fullchain.pem" && -f "/etc/letsencrypt/live/${d}/privkey.pem" ]] || { fail "Certificate files were not created"; return 1; }
}

domain_verify(){
  local d="$1" code wh tmp="/tmp/bg-domain-verify.$$"
  code="$(curl -ksS -o "$tmp" -w '%{http_code}' --max-time 12 --resolve "${d}:443:127.0.0.1" "https://${d}/api.php?action=storefront" 2>/dev/null || echo 000)"
  if [[ "$code" != "200" ]] || ! grep -Eq '"ok"[[:space:]]*:[[:space:]]*true' "$tmp" 2>/dev/null; then rm -f "$tmp"; fail "New HTTPS/API verification failed (HTTP $code)"; return 1; fi
  rm -f "$tmp"
  if [[ -n "$BOT_TOKEN" ]]; then
    wh="$(tg_api getWebhookInfo 2>/dev/null | (command -v jq >/dev/null 2>&1 && jq -r '.result.url // empty' || cat) 2>/dev/null || true)"
    [[ "$wh" == "https://${d}/bot.php?secret=${WEBHOOK_SECRET}" ]] || { fail "Telegram webhook did not switch to the new domain"; return 1; }
  fi
}

domain_change(){
  require_root; try_extract_php_config
  local new="${1:-}" old="$DOMAIN" tx nginx_conf old_webhook="" i=1 total=9
  [[ -n "$old" ]] || { fail "Current domain is not configured."; return 1; }
  [[ -n "$new" ]] || read -rp "New domain (without https): " new
  new="${new#http://}"; new="${new#https://}"; new="${new%%/*}"
  [[ "$new" != "$old" ]] || { info "Domain is already $old"; return 0; }
  header; section "DOMAIN MIGRATION"; label "Current" "$old"; label "New" "$new"; echo
  confirm "Switch BlueGate from $old to $new?" no || return 1

  step $i $total "Validate domain and DNS"; ((i+=1));
  if domain_preflight "$new" >/tmp/bg-domain-preflight.$$ 2>&1; then step_ok; cat /tmp/bg-domain-preflight.$$; else step_fail; cat /tmp/bg-domain-preflight.$$; rm -f /tmp/bg-domain-preflight.$$; return 1; fi
  rm -f /tmp/bg-domain-preflight.$$

  tx="/var/backups/bluegate-domain-$(slug_now)"; mkdir -p "$tx"; chmod 700 "$tx"
  cp -a "$ENV_FILE" "$tx/env" 2>/dev/null || true
  cp -a "$APP_DIR/config.php" "$tx/config.php" 2>/dev/null || true
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
    if [[ -n "$old_webhook" && -n "$BOT_TOKEN" ]]; then
      local rb_args=(--data-urlencode "url=$old_webhook" --data-urlencode 'allowed_updates=["message","callback_query","pre_checkout_query"]')
      [[ -n "$TELEGRAM_WEBHOOK_SECRET" ]] && rb_args+=(--data-urlencode "secret_token=$TELEGRAM_WEBHOOK_SECRET")
      tg_api setWebhook "${rb_args[@]}" >/dev/null 2>&1 || true
    fi
    fail "Previous domain configuration restored."
  }

  step $i $total "Prepare isolated ACME challenge"; ((i+=1)); domain_prepare_challenge_nginx "$new" >/dev/null 2>&1 && step_ok || { step_fail; _domain_rollback; return 1; }
  step $i $total "Verify public ACME reachability"; ((i+=1)); _domain_acme_probe "$new" >/tmp/bg-acme.$$ 2>&1 && { step_ok; cat /tmp/bg-acme.$$; } || { step_fail; cat /tmp/bg-acme.$$; rm -f /tmp/bg-acme.$$; _domain_rollback; return 1; }; rm -f /tmp/bg-acme.$$
  step $i $total "Request Let's Encrypt certificate"; ((i+=1)); certbot certonly --webroot -w "$(acme_webroot)" -d "$new" --non-interactive --agree-tos -m "${SSL_EMAIL:-admin@$new}" --keep-until-expiring >/tmp/bg-certbot.$$ 2>&1 && step_ok || { step_fail; tail -n 30 /tmp/bg-certbot.$$; rm -f /tmp/bg-certbot.$$; _domain_rollback; return 1; }; rm -f /tmp/bg-certbot.$$

  step $i $total "Update BlueGate configuration"; ((i+=1));
  DOMAIN="$new"; save_env && domain_patch_php_config "$new" && step_ok || { step_fail; DOMAIN="$old"; _domain_rollback; return 1; }

  step $i $total "Activate HTTPS nginx configuration"; ((i+=1)); configure_nginx >/dev/null 2>&1 && step_ok || { step_fail; _domain_rollback; return 1; }
  step $i $total "Refresh Telegram webhook"; ((i+=1)); if [[ -n "$BOT_TOKEN" ]]; then telegram_set_webhook >/dev/null 2>&1 && step_ok || { step_fail; _domain_rollback; return 1; }; else step_ok; fi
  step $i $total "Sync Telegram commands"; ((i+=1)); if [[ -n "$BOT_TOKEN" ]]; then telegram_sync_ui >/dev/null 2>&1 && step_ok || { step_fail; warn "Bot command sync failed; migration can continue."; }; else step_ok; fi
  step $i $total "Verify HTTPS, API and webhook"; ((i+=1)); domain_verify "$new" && step_ok || { step_fail; _domain_rollback; return 1; }

  echo; ok "Domain migration completed successfully"
  label "Domain" "$old $UI_ARROW $new"
  label "Rollback backup" "$tx"
}

domain_ssl_repair(){
  require_root; [[ -n "$DOMAIN" ]] || { fail "Domain not configured"; return 1; }
  header; section "SSL REPAIR"
  domain_preflight "$DOMAIN" || return 1
  configure_nginx || return 1
  domain_issue_ssl "$DOMAIN" || return 1
  configure_nginx || return 1
  ok "SSL is ready for $DOMAIN"
}

domain_menu(){
  while true; do
    header; section "DOMAIN / SSL MANAGER"
    menu_item 1 "Status" "DNS, HTTPS, certificate, webhook"
    menu_item 2 "Change domain" "Safe migration + rollback"
    menu_item 3 "Repair / renew SSL" "ACME test + Let's Encrypt"
    menu_item 4 "Refresh webhook" "Telegram setWebhook"
    menu_item 0 "Back"
    echo; ui_rule; read -rp "Choose: " c || true
    case "$c" in 1) domain_status; pause;; 2) domain_change; pause;; 3) domain_ssl_repair; pause;; 4) telegram_set_webhook; pause;; 0) return 0;; *) warn "Unknown option"; sleep 1;; esac
  done
}
