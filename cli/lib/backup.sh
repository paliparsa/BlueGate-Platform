#!/usr/bin/env bash
backup_create(){
  require_root; [[ -d "$APP_DIR" ]] || { fail "App not installed"; return 1; }
  local id="$(slug_now)-v$(app_version)" dir="$BACKUP_ROOT/backup-$id"
  mkdir -p "$dir"
  info "Creating backup: $dir" >&2
  if [[ -n "$DB_PASS" ]] && command -v mysqldump >/dev/null 2>&1; then
    MYSQL_PWD="$DB_PASS" mysqldump --single-transaction --routines --triggers -u"$DB_USER" "$DB_NAME" | gzip -c > "$dir/database.sql.gz" || { rm -rf "$dir"; return 1; }
  else warn "Database credentials unavailable; DB dump skipped"; fi
  tar -C "$APP_DIR" --exclude='./storage/backups' --exclude='./.git' -czf "$dir/files.tar.gz" . || { rm -rf "$dir"; return 1; }
  cp -a "$ENV_FILE" "$dir/environment.env" 2>/dev/null || true
  { echo "version=$(app_version)"; echo "created_at=$(now)"; echo "app_dir=$APP_DIR"; } > "$dir/meta"
  ln -sfn "$dir" "$BACKUP_ROOT/latest"
  backup_prune
  echo "$dir"
}
backup_prune(){
  local keep="${BACKUP_KEEP:-5}"; [[ "$keep" =~ ^[0-9]+$ ]] || keep=5
  mapfile -t dirs < <(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -name 'backup-*' -printf '%T@ %p\n' 2>/dev/null | sort -nr | awk '{print $2}')
  local i; for ((i=keep;i<${#dirs[@]};i++)); do rm -rf "${dirs[$i]}"; done
}
backup_list(){
  find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -name 'backup-*' -printf '%TY-%Tm-%Td %TH:%TM  %f\n' 2>/dev/null | sort -r || true
}
backup_restore(){
  require_root; local target="${1:-}"; [[ -z "$target" ]] && { backup_list; read -rp "Backup folder name: " target; }
  [[ "$target" = /* ]] || target="$BACKUP_ROOT/$target"
  [[ -d "$target" && -f "$target/files.tar.gz" ]] || { fail "Backup not found: $target"; return 1; }
  confirm "Restore files and database from $(basename "$target")?" no || return 0
  local safety; safety="$(backup_create)" || { fail "Safety backup failed"; return 1; }; info "Safety backup: $safety"
  maintenance_on
  local tmp; tmp="$(mktemp -d)"; tar -xzf "$target/files.tar.gz" -C "$tmp" || { maintenance_off; rm -rf "$tmp"; return 1; }
  rsync -a --delete --exclude='public/uploads/' --exclude='storage/backups/' "$tmp/" "$APP_DIR/" || { maintenance_off; rm -rf "$tmp"; return 1; }
  rm -rf "$tmp"
  if [[ -f "$target/database.sql.gz" ]]; then gunzip -c "$target/database.sql.gz" | mysql_app || { maintenance_off; return 1; }; fi
  configure_permissions || true; configure_nginx || true; maintenance_off; ok "Restore completed"
}
