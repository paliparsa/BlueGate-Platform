#!/usr/bin/env bash
deploy_local_source(){
  [[ -n "$LOCAL_SOURCE_ROOT" && -f "$LOCAL_SOURCE_ROOT/VERSION" ]] || return 1
  mkdir -p "$APP_DIR"
  rsync -a --delete --exclude='.git/' --exclude='config.php' --exclude='public/uploads/' --exclude='storage/' "$LOCAL_SOURCE_ROOT/" "$APP_DIR/"
}

repo_sync(){
  [[ -d "$APP_DIR/.git" ]] || { fail "No Git repository in $APP_DIR"; return 1; }
  git config --global --add safe.directory "$APP_DIR" 2>/dev/null || true
  git -C "$APP_DIR" remote set-url origin "$REPO_URL" || true
  git -C "$APP_DIR" fetch origin --prune
  if git -C "$APP_DIR" show-ref --verify --quiet refs/remotes/origin/main; then git -C "$APP_DIR" reset --hard origin/main; else git -C "$APP_DIR" pull --ff-only; fi
}

update_pipeline(){
  require_root; local started="$(date +%s)" backup="" old="$(app_version)" total=9 i=1
  exec > >(tee -a "$UPDATE_LOG") 2>&1
  local local_ver="" source_label="Git: $REPO_URL"
  if [[ -n "$LOCAL_SOURCE_ROOT" ]]; then local_ver="$(source_version)"; source_label="Local release: $LOCAL_SOURCE_ROOT (v$local_ver)"; fi
  header; echo "Safe Update"; label "Current version" "$old"; label "Update source" "$source_label"; echo
  confirm "Create backup and update BlueGate now?" yes || return 0
  step $i $total "Preflight"; ((i+=1)); health_collect; if [[ $HC_FAIL -gt 0 ]]; then step_fail; warn "Preflight has $HC_FAIL failure(s). Update can still proceed only if core tools/Git are available."; hc_cmd git && hc_cmd php && hc_cmd mysql || return 2; else step_ok; fi
  step $i $total "Backup"; ((i+=1)); backup="$(backup_create)" && step_ok || { step_fail; return 2; }
  step $i $total "Maintenance mode"; ((i+=1)); maintenance_on && step_ok || { step_fail; return 2; }
  trap 'maintenance_off' EXIT
  step $i $total "Fetch and deploy"; ((i+=1)); if [[ -n "$LOCAL_SOURCE_ROOT" ]]; then deploy_local_source; else repo_sync; fi && step_ok || { step_fail; fail "Update stopped. Backup: $backup"; return 2; }
  step $i $total "Database migrations"; ((i+=1)); run_migrations && step_ok || { step_fail; fail "Migration failed. Backup: $backup"; return 2; }
  step $i $total "Permissions"; ((i+=1)); configure_permissions && step_ok || { step_fail; return 2; }
  step $i $total "Web server & cron"; ((i+=1)); configure_nginx && configure_cron && step_ok || { step_fail; return 2; }
  step $i $total "Telegram sync"; ((i+=1)); telegram_sync_ui >/dev/null 2>&1 && telegram_set_webhook >/dev/null 2>&1 && step_ok || { step_fail; warn "Telegram sync failed; application update remains installed."; }
  step $i $total "Final health"; maintenance_off; trap - EXIT; if health_collect && [[ $HC_FAIL -eq 0 ]]; then step_ok; else step_fail; fi
  local new="$(app_version)" dur=$(( $(date +%s)-started ))
  echo; line; ok "BlueGate update completed"; label "Version" "$old → $new"; label "Backup" "$backup"; label "Health" "$HC_OK pass / $HC_WARN warn / $HC_FAIL fail"; label "Duration" "${dur}s"
  [[ $HC_FAIL -gt 0 ]] && { warn "Run: bluegate doctor"; return 2; }; return 0
}
