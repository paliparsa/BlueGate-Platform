#!/usr/bin/env bash

_domain_resolve_ipv4(){ getent ahostsv4 "$1" 2>/dev/null | awk '{print $1}' | sort -u | paste -sd, -; }
_domain_public_ipv4(){ curl -4fsS --max-time 5 https://api.ipify.org 2>/dev/null || curl -4fsS --max-time 5 https://ifconfig.me/ip 2>/dev/null || true; }
_domain_sql_ident(){ printf '`%s`' "${1//\`/\`\`}"; }

_domain_acme_probe(){
  local d="$1" w token url body code probe="/tmp/bg-acme-probe.$$"
  w="$(acme_webroot)"; ensure_acme_webroot
  token="bluegate-$(rand_hex 8)"; body="bluegate-acme-${token}"
  printf '%s\n' "$body" > "$w/.well-known/acme-challenge/$token"
  chmod 644 "$w/.well-known/acme-challenge/$token" 2>/dev/null || true
  url="http://${d}/.well-known/acme-challenge/${token}"
  code="$(curl -LsS --max-redirs 5 -o "$probe" -w '%{http_code}' --max-time 12 "$url" 2>/dev/null || echo 000)"
  rm -f "$w/.well-known/acme-challenge/$token"
  if [[ "$code" != "200" ]] || ! grep -Fxq "$body" "$probe" 2>/dev/null; then
    rm -f "$probe"
    fail "ACME challenge is not publicly reachable (HTTP $code)."
    info "Expected URL: $url"
    info "Check DNS/proxy/firewall and port 80 before requesting a certificate."
    return 1
  fi
  rm -f "$probe"
  ok "ACME challenge is publicly reachable"
}

domain_status(){
  header; section "DOMAIN / SSL STATUS"
  label "Configured domain" "${DOMAIN:-not configured}"
  [[ -z "$DOMAIN" ]] && return 1
  local ips cert="missing" expiry="-" webhook="-" code="000" residues="-"
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
  command -v mysqldump >/dev/null 2>&1 || { fail "mysqldump is not installed"; return 1; }
  mysql_app -Nse 'SELECT 1' >/dev/null 2>&1 || { fail "Database connection failed"; return 1; }
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

domain_patch_public_metadata(){
  local d="$1" robots="$APP_DIR/public/robots.txt"
  [[ -f "$robots" ]] || return 0
  python3 - "$robots" "$d" <<'PY'
import re,sys
p,d=sys.argv[1],sys.argv[2]
s=open(p,encoding='utf-8',errors='replace').read()
line=f"Sitemap: https://{d}/sitemap.xml"
if re.search(r'^Sitemap:\s*\S+',s,flags=re.M):
    s=re.sub(r'^Sitemap:\s*\S+',line,s,flags=re.M)
else:
    s=s.rstrip()+"\n"+line+"\n"
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

# Enumerate every character/text column in real application tables. This makes
# the migration future-proof when new URL-bearing columns are added later.
domain_db_text_columns(){
  mysql_app -N -B -e "SELECT c.TABLE_NAME,c.COLUMN_NAME
    FROM information_schema.COLUMNS c
    JOIN information_schema.TABLES t
      ON t.TABLE_SCHEMA=c.TABLE_SCHEMA AND t.TABLE_NAME=c.TABLE_NAME
   WHERE c.TABLE_SCHEMA=DATABASE()
     AND t.TABLE_TYPE='BASE TABLE'
     AND c.DATA_TYPE IN ('char','varchar','tinytext','text','mediumtext','longtext')
   ORDER BY c.TABLE_NAME,c.ORDINAL_POSITION" 2>/dev/null
}

domain_db_scan(){
  local needle="$1" total=0 t c n ti ci
  [[ -n "$needle" ]] || { echo 0; return 0; }
  while IFS=$'\t' read -r t c; do
    [[ -n "$t" && -n "$c" ]] || continue
    ti="$(_domain_sql_ident "$t")"; ci="$(_domain_sql_ident "$c")"
    n="$(mysql_app -N -B -e "SELECT COUNT(*) FROM ${ti} WHERE ${ci} IS NOT NULL AND INSTR(${ci}, '${needle}')>0" 2>/dev/null || echo 0)"
    [[ "$n" =~ ^[0-9]+$ ]] || n=0
    if (( n > 0 )); then printf '%s\t%s\t%s\n' "$t" "$c" "$n" >&2; total=$((total+n)); fi
  done < <(domain_db_text_columns)
  echo "$total"
}

domain_db_migrate_urls(){
  local old="$1" new="$2" total=0 t c n ti ci sql
  while IFS=$'\t' read -r t c; do
    [[ -n "$t" && -n "$c" ]] || continue
    ti="$(_domain_sql_ident "$t")"; ci="$(_domain_sql_ident "$c")"
    sql="UPDATE ${ti} SET ${ci}=REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(${ci},
      'https://${old}/uploads/','/uploads/'),
      'http://${old}/uploads/','/uploads/'),
      'https:\\\\/\\\\/${old}\\\\/uploads\\\\/','\\\\/uploads\\\\/'),
      'http:\\\\/\\\\/${old}\\\\/uploads\\\\/','\\\\/uploads\\\\/'),
      'https://${old}','https://${new}'),
      'http://${old}','https://${new}')
      WHERE ${ci} IS NOT NULL AND INSTR(${ci}, '${old}')>0;
      SELECT ROW_COUNT();"
    n="$(mysql_app -N -B -e "$sql" 2>/dev/null | tail -n1 || echo 0)"
    [[ "$n" =~ ^[0-9]+$ ]] || n=0
    total=$((total+n))
  done < <(domain_db_text_columns)
  echo "$total"
}

domain_db_normalize_current_uploads(){
  local d="$1" total=0 t c n ti ci sql
  while IFS=$'\t' read -r t c; do
    [[ -n "$t" && -n "$c" ]] || continue
    ti="$(_domain_sql_ident "$t")"; ci="$(_domain_sql_ident "$c")"
    sql="UPDATE ${ti} SET ${ci}=REPLACE(REPLACE(REPLACE(REPLACE(${ci},
      'https://${d}/uploads/','/uploads/'),
      'http://${d}/uploads/','/uploads/'),
      'https:\\/\\/${d}\\/uploads\\/','\\/uploads\\/'),
      'http:\\/\\/${d}\\/uploads\\/','\\/uploads\\/')
      WHERE ${ci} IS NOT NULL AND (
        INSTR(${ci},'https://${d}/uploads/')>0 OR INSTR(${ci},'http://${d}/uploads/')>0 OR
        INSTR(${ci},'https:\\/\\/${d}\\/uploads\\/')>0 OR INSTR(${ci},'http:\\/\\/${d}\\/uploads\\/')>0
      );
      SELECT ROW_COUNT();"
    n="$(mysql_app -N -B -e "$sql" 2>/dev/null | tail -n1 || echo 0)"
    [[ "$n" =~ ^[0-9]+$ ]] || n=0
    total=$((total+n))
  done < <(domain_db_text_columns)
  echo "$total"
}

domain_db_media_integrity(){
  local old="$1" new="$2" tmp="/tmp/bg-media-values.$$" t c ti ci
  : > "$tmp"
  while IFS=$'\t' read -r t c; do
    [[ -n "$t" && -n "$c" ]] || continue
    ti="$(_domain_sql_ident "$t")"; ci="$(_domain_sql_ident "$c")"
    mysql_app -N -B -e "SELECT ${ci} FROM ${ti} WHERE ${ci} IS NOT NULL AND INSTR(${ci},'uploads/')>0 LIMIT 5000" 2>/dev/null >> "$tmp" || true
  done < <(domain_db_text_columns)
  python3 - "$tmp" "$APP_DIR/public" "$old" "$new" <<'PY'
import os,re,sys,urllib.parse
p,root,old,new=sys.argv[1:]
text=open(p,encoding='utf-8',errors='ignore').read()
# Match root-relative and absolute internal upload references, including JSON text.
pat=re.compile(r'(?:(?:https?:)?(?:\\?/\\?/)?(?:'+re.escape(old)+r'|'+re.escape(new)+r'))?\\?/uploads\\?/[A-Za-z0-9_./%+@=,~:-]+',re.I)
paths=set()
for raw in pat.findall(text):
    s=raw.replace('\\/','/')
    i=s.lower().find('/uploads/')
    if i<0: continue
    rel=urllib.parse.unquote(s[i+1:]).split('?',1)[0].split('#',1)[0]
    rel=rel.rstrip('.,;:)]}')
    if '..' in rel.split('/'): continue
    paths.add(rel)
missing=[]
for rel in sorted(paths):
    if not os.path.isfile(os.path.join(root,rel)):
        missing.append(rel)
print(f"{len(paths)}\t{len(missing)}")
for x in missing[:20]: print(x,file=sys.stderr)
PY
  rm -f "$tmp"
}

domain_create_tx_backup(){
  local tx="$1" nginx_conf="$2" old_webhook="$3"
  mkdir -p "$tx"; chmod 700 "$tx"
  cp -a "$ENV_FILE" "$tx/env" 2>/dev/null || true
  cp -a "$APP_DIR/config.php" "$tx/config.php" 2>/dev/null || true
  cp -a "$APP_DIR/public/robots.txt" "$tx/robots.txt" 2>/dev/null || true
  cp -a "$nginx_conf" "$tx/nginx.conf" 2>/dev/null || true
  printf '%s' "$old_webhook" > "$tx/webhook.url"
  MYSQL_PWD="$DB_PASS" mysqldump --protocol=socket -u"$DB_USER" --single-transaction --quick --skip-lock-tables "$DB_NAME" 2>"$tx/mysqldump.err" | gzip -1 > "$tx/database.sql.gz" || return 1
  [[ -s "$tx/database.sql.gz" ]] || return 1
  cat > "$tx/manifest.txt" <<EOF_MANIFEST
created_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
old_domain=${DOMAIN}
database=${DB_NAME}
app_dir=${APP_DIR}
EOF_MANIFEST
}

domain_restore_tx_database(){
  local tx="$1"
  [[ -s "$tx/database.sql.gz" ]] || return 1
  gzip -dc "$tx/database.sql.gz" | MYSQL_PWD="$DB_PASS" mysql --protocol=socket -u"$DB_USER" "$DB_NAME"
}

domain_scan_runtime_files(){
  local needle="$1"
  grep -RIl --exclude-dir=uploads --exclude-dir=.git --exclude='*.log' -- "$needle" "$APP_DIR/public" "$APP_DIR/config.php" 2>/dev/null | head -n 30 || true
}

domain_verify_endpoint(){
  local d="$1" path="$2" old="$3" tmp="/tmp/bg-endpoint.$$" code
  code="$(curl -ksS -L -o "$tmp" -w '%{http_code}' --max-time 15 --resolve "${d}:443:127.0.0.1" "https://${d}${path}" 2>/dev/null || echo 000)"
  if [[ ! "$code" =~ ^2[0-9][0-9]$ ]]; then rm -f "$tmp"; fail "${path} returned HTTP $code"; return 1; fi
  if [[ -n "$old" ]] && grep -Fq "$old" "$tmp" 2>/dev/null; then rm -f "$tmp"; fail "${path} still exposes the old domain"; return 1; fi
  rm -f "$tmp"
}

domain_verify(){
  local d="$1" old="${2:-}" wh residues media files missing
  domain_verify_endpoint "$d" "/" "$old" || return 1
  domain_verify_endpoint "$d" "/miniapp/" "$old" || return 1
  domain_verify_endpoint "$d" "/api.php?action=storefront" "$old" || return 1

  if [[ -n "$old" ]]; then
    residues="$(domain_db_scan "$old" 2>/tmp/bg-db-residue.$$)"
    if [[ "${residues:-0}" != "0" ]]; then
      fail "Database still contains ${residues} old-domain reference(s)."
      cat /tmp/bg-db-residue.$$ 2>/dev/null | head -n 20
      rm -f /tmp/bg-db-residue.$$
      return 1
    fi
    rm -f /tmp/bg-db-residue.$$
  fi

  media="$(domain_db_media_integrity "$old" "$d" 2>/tmp/bg-media-missing.$$)"
  files="${media%%$'\t'*}"; missing="${media##*$'\t'}"
  [[ "$files" =~ ^[0-9]+$ ]] || files=0; [[ "$missing" =~ ^[0-9]+$ ]] || missing=0
  if (( missing > 0 )); then
    warn "$missing referenced upload file(s) are missing on disk (pre-existing broken media)."
    sed -n '1,10p' /tmp/bg-media-missing.$$ 2>/dev/null || true
  else
    ok "Uploaded media references verified ($files file(s))"
  fi
  rm -f /tmp/bg-media-missing.$$

  if [[ -n "$BOT_TOKEN" ]]; then
    wh="$(tg_api getWebhookInfo 2>/dev/null | (command -v jq >/dev/null 2>&1 && jq -r '.result.url // empty' || cat) 2>/dev/null || true)"
    [[ "$wh" == "https://${d}/bot.php?secret=${WEBHOOK_SECRET}" ]] || { fail "Telegram webhook did not switch to the new domain"; return 1; }
  fi
}

domain_url_scan(){
  require_root; try_extract_php_config
  local needle="${1:-$DOMAIN}" total media files missing
  [[ -n "$needle" ]] || { fail "No domain to scan."; return 1; }
  header; section "DOMAIN REFERENCE SCAN"; label "Needle" "$needle"; echo
  total="$(domain_db_scan "$needle" 2>/tmp/bg-db-scan.$$)"
  label "Database references" "$total"
  if [[ -s /tmp/bg-db-scan.$$ ]]; then sed 's/^/  /' /tmp/bg-db-scan.$$; fi
  rm -f /tmp/bg-db-scan.$$
  echo
  section "RUNTIME FILE REFERENCES"
  local refs; refs="$(domain_scan_runtime_files "$needle")"
  if [[ -n "$refs" ]]; then printf '%s\n' "$refs" | sed 's/^/  /'; else ok "No matching references in runtime files"; fi
  echo
  media="$(domain_db_media_integrity "$needle" "$DOMAIN" 2>/tmp/bg-media-scan.$$)"; files="${media%%$'\t'*}"; missing="${media##*$'\t'}"
  label "Referenced upload files" "${files:-0}"
  label "Missing upload files" "${missing:-0}"
  [[ -s /tmp/bg-media-scan.$$ ]] && sed -n '1,20p' /tmp/bg-media-scan.$$ | sed 's/^/  /'
  rm -f /tmp/bg-media-scan.$$
}

domain_change(){
  require_root; try_extract_php_config
  local new="${1:-}" mode="${2:-}" old="$DOMAIN" tx nginx_conf old_webhook="" i=1 total=16 changed=0 before=0 normalized=0 media files missing runtime_refs same_domain=0 residue_domain
  [[ -n "$old" ]] || { fail "Current domain is not configured."; return 1; }

  # --force with no domain means: re-run the complete migration/repair flow on
  # the currently configured domain. This is useful after a partial/manual
  # migration where DB media URLs, nginx, SSL or Telegram still need repair.
  if [[ "$new" == "--force" || "$new" == "--repair" ]]; then
    mode="--force"; new="$old"
  fi
  [[ -n "$new" ]] || read -rp "New domain (without https): " new
  new="${new#http://}"; new="${new#https://}"; new="${new%%/*}"

  if [[ "$new" == "$old" ]]; then
    same_domain=1
    residue_domain=""
    if [[ "$mode" != "--force" && "$mode" != "--repair" ]]; then
      warn "Domain is already $old"
      confirm "Re-run the full repair migration on the current domain?" no || return 0
    fi
  else
    residue_domain="$old"
  fi

  header
  if (( same_domain )); then section "CURRENT DOMAIN REPAIR MIGRATION"; else section "FULL DOMAIN MIGRATION"; fi
  label "Current domain" "$old"; label "Target domain" "$new"
  echo
  info "This migrates SSL, nginx, application config, Telegram webhook, database URLs and uploaded-media references."
  info "Internal uploads are normalized to /uploads/... so future domain changes do not break them."
  echo
  confirm "Start full domain migration?" no || return 1

  step $i $total "Validate domain, DNS and database"; ((i+=1))
  if domain_preflight "$new" >/tmp/bg-domain-preflight.$$ 2>&1; then step_ok; cat /tmp/bg-domain-preflight.$$; else step_fail; cat /tmp/bg-domain-preflight.$$; rm -f /tmp/bg-domain-preflight.$$; return 1; fi
  rm -f /tmp/bg-domain-preflight.$$

  step $i $total "Scan domain/media references"; ((i+=1))
  before="$(domain_db_scan "$old" 2>/tmp/bg-domain-before.$$)"; step_ok
  if (( same_domain )); then
    label "Current-domain DB references" "${before:-0}"
    info "Only internal upload URLs will be normalized; legitimate current-domain URLs stay unchanged."
  else
    label "Old-domain DB references" "${before:-0}"
  fi
  [[ -s /tmp/bg-domain-before.$$ ]] && sed -n '1,20p' /tmp/bg-domain-before.$$ | sed 's/^/  /'
  rm -f /tmp/bg-domain-before.$$

  nginx_conf="/etc/nginx/sites-available/${NGINX_SITE}"
  if [[ -n "$BOT_TOKEN" ]] && command -v jq >/dev/null 2>&1; then old_webhook="$(tg_api getWebhookInfo 2>/dev/null | jq -r '.result.url // empty' 2>/dev/null || true)"; fi
  tx="/var/backups/bluegate-domain-$(slug_now)"

  step $i $total "Create rollback backup (database + config)"; ((i+=1))
  if domain_create_tx_backup "$tx" "$nginx_conf" "$old_webhook"; then step_ok; else step_fail; fail "Could not create a complete rollback backup."; return 1; fi

  _domain_rollback(){
    warn "Migration failed. Restoring database and previous configuration..."
    maintenance_on
    domain_restore_tx_database "$tx" >/dev/null 2>&1 || warn "Database rollback failed; backup remains at $tx/database.sql.gz"
    [[ -f "$tx/env" ]] && cp -a "$tx/env" "$ENV_FILE"
    [[ -f "$tx/config.php" ]] && cp -a "$tx/config.php" "$APP_DIR/config.php"
    [[ -f "$tx/robots.txt" ]] && cp -a "$tx/robots.txt" "$APP_DIR/public/robots.txt"
    [[ -f "$tx/nginx.conf" ]] && cp -a "$tx/nginx.conf" "$nginx_conf"
    DOMAIN="$old"; source "$ENV_FILE" 2>/dev/null || true
    nginx -t >/dev/null 2>&1 && systemctl reload nginx || true
    if [[ -n "$old_webhook" && -n "$BOT_TOKEN" ]]; then
      local rb_args=(--data-urlencode "url=$old_webhook" --data-urlencode 'allowed_updates=["message","callback_query","pre_checkout_query"]')
      [[ -n "$TELEGRAM_WEBHOOK_SECRET" ]] && rb_args+=(--data-urlencode "secret_token=$TELEGRAM_WEBHOOK_SECRET")
      tg_api setWebhook "${rb_args[@]}" >/dev/null 2>&1 || true
    fi
    maintenance_off
    fail "Previous domain and database state restored."
    label "Rollback backup" "$tx"
  }

  step $i $total "Prepare ACME challenge route"; ((i+=1))
  if (( same_domain )); then
    # Never append a second server{} for the same host. Regenerate the normal
    # site config, which already contains the ACME exception before dot-file deny.
    DOMAIN="$new"
    configure_nginx >/dev/null 2>&1 && step_ok || { step_fail; DOMAIN="$old"; _domain_rollback; return 1; }
  else
    domain_prepare_challenge_nginx "$new" >/dev/null 2>&1 && step_ok || { step_fail; _domain_rollback; return 1; }
  fi

  step $i $total "Verify public ACME reachability"; ((i+=1))
  _domain_acme_probe "$new" >/tmp/bg-acme.$$ 2>&1 && { step_ok; cat /tmp/bg-acme.$$; } || { step_fail; cat /tmp/bg-acme.$$; rm -f /tmp/bg-acme.$$; _domain_rollback; return 1; }; rm -f /tmp/bg-acme.$$

  step $i $total "Request Let's Encrypt certificate"; ((i+=1))
  certbot certonly --webroot -w "$(acme_webroot)" -d "$new" --non-interactive --agree-tos -m "${SSL_EMAIL:-admin@$new}" --keep-until-expiring >/tmp/bg-certbot.$$ 2>&1 && step_ok || { step_fail; tail -n 30 /tmp/bg-certbot.$$; rm -f /tmp/bg-certbot.$$; _domain_rollback; return 1; }; rm -f /tmp/bg-certbot.$$

  step $i $total "Enable maintenance mode"; ((i+=1)); maintenance_on; step_ok

  step $i $total "Update BlueGate application configuration"; ((i+=1))
  DOMAIN="$new"; if save_env && domain_patch_php_config "$new" && domain_patch_public_metadata "$new"; then step_ok; else step_fail; DOMAIN="$old"; _domain_rollback; return 1; fi

  step $i $total "Migrate database URLs and media references"; ((i+=1))
  if (( same_domain )); then
    changed=0
  else
    changed="$(domain_db_migrate_urls "$old" "$new")"
  fi
  normalized="$(domain_db_normalize_current_uploads "$new")"
  if [[ "$changed" =~ ^[0-9]+$ && "$normalized" =~ ^[0-9]+$ ]]; then step_ok; label "Rows changed" "$changed"; label "Current-domain uploads normalized" "$normalized"; else step_fail; _domain_rollback; return 1; fi

  step $i $total "Verify uploaded files on disk"; ((i+=1))
  media="$(domain_db_media_integrity "$old" "$new" 2>/tmp/bg-media-missing.$$)"; files="${media%%$'\t'*}"; missing="${media##*$'\t'}"
  [[ "$files" =~ ^[0-9]+$ ]] || files=0; [[ "$missing" =~ ^[0-9]+$ ]] || missing=0
  if (( missing > 0 )); then step_ok; warn "$missing missing upload file(s) were already referenced in the database."; sed -n '1,10p' /tmp/bg-media-missing.$$ | sed 's/^/  /'; else step_ok; ok "Media integrity OK ($files referenced upload file(s))"; fi
  rm -f /tmp/bg-media-missing.$$

  step $i $total "Activate HTTPS nginx configuration"; ((i+=1))
  configure_nginx >/dev/null 2>&1 && step_ok || { step_fail; _domain_rollback; return 1; }

  step $i $total "Refresh Telegram webhook"; ((i+=1))
  if [[ -n "$BOT_TOKEN" ]]; then telegram_set_webhook >/dev/null 2>&1 && step_ok || { step_fail; _domain_rollback; return 1; }; else step_ok; fi

  step $i $total "Sync Telegram commands and Mini App entry"; ((i+=1))
  if [[ -n "$BOT_TOKEN" ]]; then telegram_sync_ui >/dev/null 2>&1 && step_ok || { step_fail; warn "Telegram UI sync failed; migration continues because webhook is valid."; }; else step_ok; fi

  # Verification must run with the application online. Keeping maintenance
  # enabled here makes nginx return 503 for /, /miniapp/ and API endpoints,
  # causing a false migration failure even when SSL/nginx are healthy.
  step $i $total "Disable maintenance before live verification"; ((i+=1)); maintenance_off; step_ok

  step $i $total "Verify website, Mini App, Store API and webhook"; ((i+=1))
  domain_verify "$new" "$residue_domain" && step_ok || { step_fail; _domain_rollback; return 1; }

  step $i $total "Scan migration residue and finalize"; ((i+=1))
  if (( same_domain )); then
    # The current domain is expected to exist in config/metadata. Treating it as
    # residue would create a false failure. Verify instead that absolute internal
    # upload URLs were normalized out of the database.
    local absolute_uploads
    absolute_uploads="$(domain_db_scan "https://${new}/uploads/" 2>/tmp/bg-current-upload-residue.$$)"
    if [[ "${absolute_uploads:-0}" != "0" ]]; then
      step_ok; warn "${absolute_uploads} current-domain /uploads reference(s) remain (possibly escaped/custom JSON)."
      sed -n '1,20p' /tmp/bg-current-upload-residue.$$ | sed 's/^/  /'
    else
      step_ok; ok "No absolute current-domain upload URLs remain in database"
    fi
    rm -f /tmp/bg-current-upload-residue.$$
  else
    runtime_refs="$(domain_scan_runtime_files "$old")"
    if [[ -n "$runtime_refs" ]]; then
      step_ok; warn "Old domain remains in non-database runtime files. Review these references:"
      printf '%s\n' "$runtime_refs" | sed 's/^/  /'
    else step_ok; ok "No old-domain references remain in runtime files"; fi
  fi

  if (( same_domain )); then
    echo; ok "Current domain repair migration completed successfully"
    label "Domain" "$new"
  else
    echo; ok "Full domain migration completed successfully"
    label "Domain" "$old $UI_ARROW $new"
  fi
  label "Database URL rows changed" "$changed"
  label "Rollback backup" "$tx"
  echo
  info "Local uploaded media now uses /uploads/... references and is no longer tied to the domain."
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
    menu_item 1 "Full Domain Migration" "Change domain + SSL + nginx + DB/media + Telegram + verification"
    menu_item 2 "Re-run Current Domain Migration" "Repair everything on the already-configured domain"
    menu_item 3 "Domain Status" "DNS, HTTPS, certificate, webhook"
    menu_item 4 "Scan Domain References" "Find DB/media/runtime references before migrating"
    menu_item 5 "Repair / Renew SSL" "ACME test + Let's Encrypt"
    menu_item 6 "Refresh Telegram Webhook" "Telegram setWebhook"
    menu_item 0 "Back"
    echo; ui_rule; read -rp "Choose: " c || true
    case "$c" in
      1) domain_change; pause;;
      2) domain_change --force; pause;;
      3) domain_status; pause;;
      4) domain_url_scan; pause;;
      5) domain_ssl_repair; pause;;
      6) telegram_set_webhook; pause;;
      0) return 0;;
      *) warn "Unknown option"; sleep 1;;
    esac
  done
}
