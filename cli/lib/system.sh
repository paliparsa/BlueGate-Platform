#!/usr/bin/env bash
install_packages(){
  require_root
  export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a
  command -v apt-get >/dev/null 2>&1 || { fail "Installer currently supports Debian/Ubuntu apt hosts."; return 1; }
  apt-get update -y
  apt-get install -y nginx mariadb-server git curl unzip openssl ca-certificates rsync jq \
    php-fpm php-cli php-mysql php-curl php-mbstring php-xml php-zip \
    certbot python3-certbot-nginx
  systemctl enable --now nginx mariadb
}

find_php_sock(){ find /run/php -name 'php*-fpm.sock' 2>/dev/null | sort -V | tail -n1; }

configure_permissions(){
  [[ -d "$APP_DIR" ]] || { fail "App directory missing: $APP_DIR"; return 1; }
  chown -R root:www-data "$APP_DIR"
  find "$APP_DIR" -type d -exec chmod 750 {} +
  find "$APP_DIR" -type f -exec chmod 640 {} +
  find "$APP_DIR" -maxdepth 2 -type f \( -name '*.sh' -o -path '*/cli/bluegate' \) -exec chmod 750 {} + 2>/dev/null || true
  mkdir -p "$APP_DIR/public/uploads" "$APP_DIR/storage/backups" "$APP_DIR/storage/cache"
  chown -R www-data:www-data "$APP_DIR/public/uploads" "$APP_DIR/storage"
  find "$APP_DIR/public/uploads" "$APP_DIR/storage" -type d -exec chmod 750 {} +
  find "$APP_DIR/public/uploads" "$APP_DIR/storage" -type f -exec chmod 640 {} + 2>/dev/null || true
  [[ -f "$APP_DIR/config.php" ]] && { chown root:www-data "$APP_DIR/config.php"; chmod 640 "$APP_DIR/config.php"; }
}

configure_nginx(){
  validate_domain "$DOMAIN" || { fail "Invalid DOMAIN: $DOMAIN"; return 1; }
  local sock conf cert_dir ssl=0 ssl_extra=""
  sock="$(find_php_sock)"; [[ -n "$sock" ]] || { fail "PHP-FPM socket not found"; return 1; }
  conf="/etc/nginx/sites-available/${NGINX_SITE}"; cert_dir="/etc/letsencrypt/live/${DOMAIN}"
  [[ -f "$cert_dir/fullchain.pem" && -f "$cert_dir/privkey.pem" ]] && ssl=1
  [[ -f /etc/letsencrypt/options-ssl-nginx.conf ]] && ssl_extra+=$'\n    include /etc/letsencrypt/options-ssl-nginx.conf;'
  [[ -f /etc/letsencrypt/ssl-dhparams.pem ]] && ssl_extra+=$'\n    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;'
  if [[ $ssl -eq 1 ]]; then
    cat > "$conf" <<EOF
server { listen 80; listen [::]:80; server_name ${DOMAIN}; return 301 https://\$host\$request_uri; }
server {
    listen 443 ssl; listen [::]:443 ssl; server_name ${DOMAIN};
    ssl_certificate ${cert_dir}/fullchain.pem; ssl_certificate_key ${cert_dir}/privkey.pem;${ssl_extra}
    root ${APP_DIR}/public; index index.php index.html; client_max_body_size 20M;
    gzip on; gzip_vary on; gzip_comp_level 5; gzip_min_length 512;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;
    if (-f \$document_root/.maintenance) { return 503; }
    error_page 503 /maintenance.html;
    location = /maintenance.html { internal; }
    location = /web/sw.js { try_files \$uri =404; expires -1; add_header Cache-Control "no-cache, must-revalidate, max-age=0"; access_log off; }
    location ~* \.(?:css|js|png|jpe?g|gif|webp|svg|ico|woff2?)$ { try_files \$uri =404; expires 30d; add_header Cache-Control "public, max-age=2592000, immutable"; access_log off; }
    location / { try_files \$uri \$uri/ /index.php?\$query_string; }
    location = /install.php { deny all; }
    location ~ \.php$ { include snippets/fastcgi-php.conf; fastcgi_pass unix:${sock}; }
    location ~ /\. { deny all; }
    location ~* ^/(?:config\.php|schema\.sql|cli/|storage/) { deny all; }
}
EOF
  else
    cat > "$conf" <<EOF
server {
    listen 80; listen [::]:80; server_name ${DOMAIN};
    root ${APP_DIR}/public; index index.php index.html; client_max_body_size 20M;
    gzip on; gzip_vary on; gzip_comp_level 5; gzip_min_length 512;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;
    if (-f \$document_root/.maintenance) { return 503; }
    error_page 503 /maintenance.html;
    location = /maintenance.html { internal; }
    location = /web/sw.js { try_files \$uri =404; expires -1; add_header Cache-Control "no-cache, must-revalidate, max-age=0"; access_log off; }
    location ~* \.(?:css|js|png|jpe?g|gif|webp|svg|ico|woff2?)$ { try_files \$uri =404; expires 30d; add_header Cache-Control "public, max-age=2592000, immutable"; access_log off; }
    location / { try_files \$uri \$uri/ /index.php?\$query_string; }
    location = /install.php { deny all; }
    location ~ \.php$ { include snippets/fastcgi-php.conf; fastcgi_pass unix:${sock}; }
    location ~ /\. { deny all; }
    location ~* ^/(?:config\.php|schema\.sql|cli/|storage/) { deny all; }
}
EOF
  fi
  ln -sfn "$conf" "/etc/nginx/sites-enabled/${NGINX_SITE}"
  rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
  nginx -t && systemctl reload nginx
}

configure_ssl(){
  [[ "${ENABLE_SSL,,}" =~ ^(yes|y|true|1)$ ]] || { warn "SSL disabled"; return 0; }
  validate_domain "$DOMAIN" || return 1
  local email="${SSL_EMAIL:-admin@${DOMAIN}}"
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$email" --redirect
}

configure_cron(){
  [[ -f "$APP_DIR/public/cron_crypto.php" ]] || { fail "cron_crypto.php missing"; return 1; }
  mkdir -p "$APP_DIR/storage/cache"
  cat > "$CRON_FILE" <<EOF
# BlueGate Platform scheduled jobs
* * * * * www-data sh -c 'php ${APP_DIR}/public/cron_crypto.php --check-payments >/dev/null 2>&1 && date +\\%s > ${APP_DIR}/storage/cache/cron-payments.last'
*/10 * * * * www-data sh -c 'php ${APP_DIR}/public/cron_crypto.php --refresh-rates >/dev/null 2>&1 && date +\\%s > ${APP_DIR}/storage/cache/cron-rates.last'
EOF
  chmod 644 "$CRON_FILE"
}

install_manager_command(){
  cat > "/usr/local/bin/${MANAGER_CMD}" <<EOF
#!/usr/bin/env bash
set -u
ENV_FILE="${ENV_FILE}"
APP_DIR="${DEFAULT_APP_DIR}"
[[ -f "\$ENV_FILE" ]] && source "\$ENV_FILE"
if [[ \${EUID:-\$(id -u)} -ne 0 ]]; then exec sudo -E "\$0" "\$@"; fi
if [[ -x "\$APP_DIR/cli/bluegate" ]]; then exec "\$APP_DIR/cli/bluegate" "\$@"; fi
echo "BlueGate CLI not found in \$APP_DIR. Run the installer again." >&2
exit 2
EOF
  chmod 755 "/usr/local/bin/${MANAGER_CMD}"
}
