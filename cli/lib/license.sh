#!/usr/bin/env bash
# Veyra licensing + Pro release client.

LICENSE_STATE_DIR="${VEYRA_LICENSE_STATE_DIR:-/etc/veyra/license}"
LICENSE_STATE_FILE="$LICENSE_STATE_DIR/state.json"
LICENSE_INSTALLATION_FILE="$LICENSE_STATE_DIR/installation-id"
LICENSE_PRO_META="$LICENSE_STATE_DIR/pro-module.json"
LICENSE_PUBLIC_KEY_FILE="$LICENSE_STATE_DIR/public.pem"
LICENSE_KEY_PIN_FILE="/etc/veyra/license-trust-root.sha256"

license_require_tools(){
  command -v curl >/dev/null 2>&1 || { fail "curl is required"; return 1; }
  command -v jq >/dev/null 2>&1 || { fail "jq is required"; return 1; }
  command -v openssl >/dev/null 2>&1 || { fail "openssl is required"; return 1; }
}
license_server(){ printf '%s' "${LICENSE_SERVER_URL:-}" | sed 's#/*$##'; }
license_domain(){
  if [[ -n "${DOMAIN:-}" ]]; then printf '%s' "$DOMAIN"; return; fi
  [[ -f "$APP_DIR/config.php" ]] && sed -nE "s#^\\\$PUBLIC_BASE_URL[[:space:]]*=[[:space:]]*'https?://([^/']+).*#\1#p" "$APP_DIR/config.php" | head -1
}
license_installation_id(){
  mkdir -p /etc/veyra "$LICENSE_STATE_DIR"; chown root:www-data /etc/veyra "$LICENSE_STATE_DIR" 2>/dev/null || true; chmod 755 /etc/veyra 2>/dev/null || true; chmod 750 "$LICENSE_STATE_DIR" 2>/dev/null || true
  if [[ ! -s "$LICENSE_INSTALLATION_FILE" ]]; then
    printf 'inst_%s\n' "$(openssl rand -hex 16)" > "$LICENSE_INSTALLATION_FILE"
  fi
  chmod 640 "$LICENSE_INSTALLATION_FILE" 2>/dev/null || true
  chown root:www-data "$LICENSE_INSTALLATION_FILE" 2>/dev/null || true
  tr -d '\r\n ' < "$LICENSE_INSTALLATION_FILE"
}
license_fingerprint(){
  local mid="" iid; iid="$(license_installation_id)"
  [[ -r /etc/machine-id ]] && mid="$(cat /etc/machine-id)"
  printf 'veyra:%s:%s' "$mid" "$iid" | sha256sum | awk '{print $1}'
}
license_nonce(){ openssl rand -hex 18; }
license_payload_base(){
  jq -nc --arg iid "$(license_installation_id)" --arg domain "$(license_domain)" --arg version "$(app_version)" --arg fp "$(license_fingerprint)" --arg nonce "$(license_nonce)" --argjson timestamp "$(date +%s)" '{installation_id:$iid,domain:$domain,app_version:$version,server_fingerprint:$fp,nonce:$nonce,timestamp:$timestamp}'
}
license_http_post(){
  local path="$1" payload="$2" server; server="$(license_server)"
  [[ -n "$server" ]] || { fail "License server URL is not configured. Run: veyra license server https://your-worker.example"; return 2; }
  curl -sS --connect-timeout 8 --max-time 25 -H 'content-type: application/json' --data "$payload" "$server$path"
}


license_fix_trust_runtime_permissions(){
  # v2.1.2 migration: if an older install has public.pem/state.json but no trust-root,
  # bootstrap it only after the current HTTPS License Control returns the exact same key.
  if [[ ! -s "$LICENSE_KEY_PIN_FILE" && -s "$LICENSE_PUBLIC_KEY_FILE" ]]; then
    local remote cached_pin remote_pin
    remote="$(license_fetch_public_key 2>/dev/null || true)"
    if [[ -n "$remote" ]]; then
      cached_pin="$(tr -d '[:space:]' < "$LICENSE_PUBLIC_KEY_FILE" | sha256sum | awk '{print $1}')"
      remote_pin="$(printf '%s' "$remote" | tr -d '[:space:]' | sha256sum | awk '{print $1}')"
      if [[ "$cached_pin" == "$remote_pin" ]]; then
        mkdir -p /etc/veyra
        printf '%s\n' "$cached_pin" > "$LICENSE_KEY_PIN_FILE"
      else
        warn "License trust bootstrap refused: cached and remote public keys differ."
        return 1
      fi
    fi
  fi
  [[ -e "$LICENSE_KEY_PIN_FILE" ]] || return 0
  command -v chattr >/dev/null 2>&1 && chattr -i "$LICENSE_KEY_PIN_FILE" 2>/dev/null || true
  chown root:www-data "$LICENSE_KEY_PIN_FILE" 2>/dev/null || true
  chmod 440 "$LICENSE_KEY_PIN_FILE" 2>/dev/null || true
  command -v chattr >/dev/null 2>&1 && chattr +i "$LICENSE_KEY_PIN_FILE" 2>/dev/null || true
}

license_assert_cached_public_key_trusted(){
  [[ -s "$LICENSE_PUBLIC_KEY_FILE" && -s "$LICENSE_KEY_PIN_FILE" ]] || return 1
  local expected actual; expected="$(tr -d '\r\n ' < "$LICENSE_KEY_PIN_FILE")"; actual="$(tr -d '[:space:]' < "$LICENSE_PUBLIC_KEY_FILE" | sha256sum | awk '{print $1}')"
  [[ "$expected" == "$actual" ]]
}

license_b64url_decode_file(){
  local s="$1" out="$2"; s="${s//-/+}"; s="${s//_/\/}"; while (( ${#s} % 4 )); do s+="="; done; printf '%s' "$s" | base64 -d > "$out" 2>/dev/null
}
license_verify_release_signature(){
  local sha="$1" version="$2" sig="$3" pub="$4" tmp msg
  [[ -n "$sha" && -n "$version" && -n "$sig" && -n "$pub" ]] || return 1
  tmp="$(mktemp -d /tmp/veyra-sig.XXXXXX)" || return 1
  printf '%s\n' "$pub" > "$tmp/pub.pem"
  msg="VYR-PRO-PKG:v1:${sha,,}:$version"; printf '%s' "$msg" > "$tmp/msg"
  license_b64url_decode_file "$sig" "$tmp/sig" || { rm -rf "$tmp"; return 1; }
  openssl pkeyutl -verify -pubin -inkey "$tmp/pub.pem" -rawin -in "$tmp/msg" -sigfile "$tmp/sig" >/dev/null 2>&1
  local rc=$?; rm -rf "$tmp"; return $rc
}

license_fetch_public_key(){
  local server out; server="$(license_server)"; [[ -n "$server" ]] || return 2
  out="$(curl -fsS --connect-timeout 8 --max-time 20 "$server/api/v1/public-key")" || return 1
  jq -er '.public_key_pem' <<<"$out"
}
license_write_state(){
  local response="$1" pub="$2" server pin existing; server="$(license_server)"
  mkdir -p /etc/veyra "$LICENSE_STATE_DIR"; chown root:www-data /etc/veyra "$LICENSE_STATE_DIR" 2>/dev/null || true; chmod 755 /etc/veyra 2>/dev/null || true; chmod 750 "$LICENSE_STATE_DIR"
  pin="$(printf '%s' "$pub" | tr -d '[:space:]' | sha256sum | awk '{print $1}')"
  if [[ -s "$LICENSE_KEY_PIN_FILE" ]]; then
    existing="$(tr -d '\r\n ' < "$LICENSE_KEY_PIN_FILE")"
    [[ "$existing" == "$pin" ]] || { fail "License signing trust root changed. Refusing key rotation."; return 1; }
  else
    printf '%s\n' "$pin" > "$LICENSE_KEY_PIN_FILE"
  fi
  license_fix_trust_runtime_permissions
  printf '%s\n' "$pub" > "$LICENSE_PUBLIC_KEY_FILE"; chmod 440 "$LICENSE_PUBLIC_KEY_FILE"; chown root:www-data "$LICENSE_PUBLIC_KEY_FILE" 2>/dev/null || true
  jq -n --arg token "$(jq -r '.token' <<<"$response")" --argjson claims "$(jq -c '.claims' <<<"$response")" --arg server "$server" --arg updated "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '{token:$token,claims:$claims,server_url:$server,updated_at:$updated}' > "$LICENSE_STATE_FILE.tmp"
  chmod 600 "$LICENSE_STATE_FILE.tmp" && mv "$LICENSE_STATE_FILE.tmp" "$LICENSE_STATE_FILE"
  chown root:www-data "$LICENSE_STATE_FILE" 2>/dev/null || true; chmod 640 "$LICENSE_STATE_FILE" 2>/dev/null || true
}
license_local_claims(){ [[ -f "$LICENSE_STATE_FILE" ]] && jq -c '.claims // {}' "$LICENSE_STATE_FILE" 2>/dev/null || echo '{"license_id":"","edition":"none","plan":"none","features":[]}'; }
license_local_token(){ [[ -f "$LICENSE_STATE_FILE" ]] && jq -r '.token // empty' "$LICENSE_STATE_FILE" 2>/dev/null || true; }
license_is_pro_local(){ [[ "$(license_local_claims | jq -r '.edition // "none"')" == pro ]]; }
license_is_active_local(){ [[ -n "$(license_local_token)" && "$(license_local_claims | jq -r '.license_id // empty')" != "" ]]; }

license_set_server(){
  require_root; local url="${1:-}"; [[ -n "$url" ]] || { fail "Usage: veyra license server https://license.example.com"; return 2; }
  [[ "$url" =~ ^https:// ]] || { fail "License Control URL must use HTTPS."; return 2; }
  LICENSE_SERVER_URL="${url%/}"; save_env; generate_config >/dev/null 2>&1 || true
  ok "License server saved: $LICENSE_SERVER_URL"
  curl -fsS --connect-timeout 8 --max-time 15 "$LICENSE_SERVER_URL/api/v1/health" | jq . || warn "Saved, but health check failed."
}
license_use_free(){
  fail "Local Free mode was removed. Free licenses are issued by the Veyra Telegram License Bot and activated with: veyra license activate KEY"
  return 2
}
license_activate(){
  require_root; license_require_tools || return 1
  local key="${1:-}" payload resp pub
  [[ -n "$key" ]] || { read -rsp "Veyra Free/Pro license key: " key; echo; }
  [[ -n "$key" ]] || { fail "License key is required."; return 2; }
  payload="$(license_payload_base | jq --arg key "$key" '. + {license_key:$key}')"
  if ! resp="$(license_http_post /api/v1/license/activate "$payload" 2>/dev/null)"; then fail "Activation request failed."; return 1; fi
  if [[ "$(jq -r '.ok // false' <<<"$resp")" != true ]]; then fail "Activation denied: $(jq -r '.error // "unknown"' <<<"$resp")"; return 1; fi
  pub="$(license_fetch_public_key)" || { fail "Could not download signing public key."; return 1; }
  license_write_state "$resp" "$pub"
  ok "Veyra $(jq -r '.claims.edition | ascii_upcase' <<<"$resp") activated for $(jq -r '.claims.domain' <<<"$resp")."
  label "License" "$(jq -r '.claims.license_id' <<<"$resp")"
  label "Refresh after" "$(date -d @$(jq -r '.claims.refresh_after' <<<"$resp") '+%Y-%m-%d %H:%M:%S' 2>/dev/null || jq -r '.claims.refresh_after' <<<"$resp")"
}
license_refresh(){
  require_root; license_require_tools || return 1
  local quiet=0; [[ "${1:-}" == "--quiet" ]] && quiet=1
  local token claims edition payload resp pub
  token="$(license_local_token)"; claims="$(license_local_claims)"; edition="$(jq -r '.edition // "none"' <<<"$claims")"
  if [[ -z "$token" ]]; then
    [[ $quiet -eq 1 ]] || fail "Veyra is not activated. Get a Free or Pro key from the Veyra License Bot, then run: veyra license activate KEY"
    return 2
  fi
  payload="$(jq -nc --arg token "$token" --arg version "$(app_version)" --arg domain "$(license_domain)" --arg fp "$(license_fingerprint)" --arg nonce "$(license_nonce)" --argjson timestamp "$(date +%s)" '{token:$token,app_version:$version,domain:$domain,server_fingerprint:$fp,nonce:$nonce,timestamp:$timestamp}')"
  if ! resp="$(license_http_post /api/v1/license/refresh "$payload" 2>/dev/null)"; then
    [[ $quiet -eq 1 ]] || warn "License server unreachable; signed local grace token remains in use."
    return 0
  fi
  if [[ "$(jq -r '.ok // false' <<<"$resp")" != true ]]; then
    [[ $quiet -eq 1 ]] || fail "Refresh denied: $(jq -r '.error // "unknown"' <<<"$resp")"
    return 1
  fi
  pub="$(license_fetch_public_key 2>/dev/null)" || pub="$(cat "$LICENSE_PUBLIC_KEY_FILE" 2>/dev/null || true)"
  [[ -n "$pub" ]] || return 1
  license_write_state "$resp" "$pub"
  [[ $quiet -eq 1 ]] || ok "License refreshed."
}
license_deactivate(){
  require_root; local token payload resp; token="$(license_local_token)"; [[ -n "$token" ]] || { rm -f "$LICENSE_STATE_FILE"; ok "Already unlicensed."; return 0; }
  payload="$(jq -nc --arg token "$token" --arg domain "$(license_domain)" --arg fp "$(license_fingerprint)" --arg nonce "$(license_nonce)" --argjson timestamp "$(date +%s)" '{token:$token,domain:$domain,server_fingerprint:$fp,nonce:$nonce,timestamp:$timestamp}')"
  resp="$(license_http_post /api/v1/license/deactivate "$payload" 2>/dev/null || true)"
  rm -f "$LICENSE_STATE_FILE"; ok "Local entitlement removed; Veyra is now UNLICENSED until another Free/Pro key is activated."
}
license_status(){
  require_root; license_refresh --quiet >/dev/null 2>&1 || true
  header; echo "License Status"; echo
  local c edition status reason
  c="$(license_local_claims)"; edition="$(jq -r '.edition // "none"' <<<"$c")"
  [[ -f "$LICENSE_STATE_FILE" && -n "$(license_local_token)" ]] && status="signed local entitlement" || status="UNLICENSED"
  label "Edition" "${edition^^}"; label "State" "$status"; label "License server" "$(license_server | sed 's/^$/not configured/')"; label "Installation" "$(license_installation_id)"; label "Domain" "$(license_domain)"; label "License ID" "$(jq -r '.license_id // ""' <<<"$c" | sed 's/^$/not activated/')"
  label "Features" "$(jq -r '(.features // []) | join(", ")' <<<"$c")"
  local exp; exp="$(jq -r '.expires_at // empty' <<<"$c")"; [[ -n "$exp" ]] && label "Expires" "$(date -d @$exp '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "$exp")"
  [[ -f "$LICENSE_PRO_META" ]] && label "Pro module" "$(jq -r '.version // "installed"' "$LICENSE_PRO_META")" || label "Pro module" "not installed"
}

core_release_query(){
  license_require_tools || return 1
  local token payload resp
  token="$(license_local_token)"; [[ -n "$token" ]] || { fail "Veyra is not activated."; return 2; }
  payload="$(jq -nc --arg token "$token" --arg domain "$(license_domain)" --arg fp "$(license_fingerprint)" --arg installed "$(app_version)" --arg nonce "$(license_nonce)" --argjson timestamp "$(date +%s)" '{token:$token,domain:$domain,server_fingerprint:$fp,installed_version:$installed,app_version:$installed,channel:"stable",nonce:$nonce,timestamp:$timestamp}')"
  resp="$(license_http_post /api/v1/core/latest "$payload" 2>/dev/null)" || { fail "Could not query Veyra Core releases."; return 1; }
  [[ "$(jq -r '.ok // false' <<<"$resp")" == true ]] || { fail "Core release access denied: $(jq -r '.error // "unknown"' <<<"$resp")"; return 1; }
  printf '%s' "$resp"
}
core_check(){
  require_root; license_refresh --quiet || true
  local resp version notes
  resp="$(core_release_query)" || return $?
  version="$(jq -r '.release.version // empty' <<<"$resp")"
  if [[ -z "$version" ]]; then ok "Veyra Core $(app_version) is up to date."; return 0; fi
  header; echo "Veyra Core Update"; echo; label "Current" "$(app_version)"; label "Available" "$version"; notes="$(jq -r '.release.notes // empty' <<<"$resp")"; [[ -n "$notes" ]] && { echo; echo "$notes"; }
}
core_update(){
  require_root; license_refresh --quiet || true
  local resp url sha version tmp zip unpack root old_local rc=1
  resp="$(core_release_query)" || return $?
  url="$(jq -r '.release.download_url // empty' <<<"$resp")"; sha="$(jq -r '.release.sha256 // empty' <<<"$resp")"; version="$(jq -r '.release.version // empty' <<<"$resp")"; release_sig="$(jq -r '.release.package_signature // empty' <<<"$resp")"
  [[ -n "$url" && -n "$sha" && -n "$version" ]] || { ok "Veyra Core $(app_version) is already up to date."; return 0; }
  confirm "Update Veyra Core $(app_version) -> $version using the signed License Control release?" yes || return 0
  tmp="$(mktemp -d /tmp/veyra-core.XXXXXX)"; zip="$tmp/core.zip"; unpack="$tmp/unpack"; mkdir -p "$unpack"
  curl -fL --retry 3 --connect-timeout 10 --max-time 240 "$url" -o "$zip" || { rm -rf "$tmp"; fail "Core download failed."; return 1; }
  [[ "$(sha256sum "$zip" | awk '{print $1}')" == "$sha" ]] || { rm -rf "$tmp"; fail "Core package checksum mismatch."; return 1; }
  if unzip -Z1 "$zip" | grep -Eq '(^/|(^|/)\.\.(/|$))'; then rm -rf "$tmp"; fail "Unsafe Core archive path detected."; return 1; fi
  if command -v zipinfo >/dev/null 2>&1 && zipinfo -l "$zip" | awk '$1 ~ /^l/ {found=1} END{exit found?0:1}'; then rm -rf "$tmp"; fail "Symlinks are not allowed in Core archives."; return 1; fi
  local unpacked_bytes; unpacked_bytes="$(unzip -l "$zip" | awk 'END{print $1+0}')"; if [[ "$unpacked_bytes" =~ ^[0-9]+$ ]] && (( unpacked_bytes > 1073741824 )); then rm -rf "$tmp"; fail "Core archive expands beyond the 1GB safety limit."; return 1; fi
  unzip -q "$zip" -d "$unpack" || { rm -rf "$tmp"; fail "Core archive is invalid."; return 1; }
  root="$(find "$unpack" -maxdepth 2 -type f -name VERSION -printf '%h\n' | head -1)"; [[ -n "$root" && -f "$root/install.sh" && -d "$root/cli" && -d "$root/app" ]] || { rm -rf "$tmp"; fail "This is not a valid Veyra Core package."; return 1; }
  [[ "$(tr -d '[:space:]' < "$root/VERSION")" == "$version" ]] || { rm -rf "$tmp"; fail "Published Core version does not match package VERSION."; return 1; }
  old_local="${LOCAL_SOURCE_ROOT:-}"; LOCAL_SOURCE_ROOT="$root"
  if update_pipeline; then rc=0; else rc=$?; fi
  LOCAL_SOURCE_ROOT="$old_local"; rm -rf "$tmp"
  return $rc
}
core_cmd(){
  case "${1:-check}" in check|status) core_check;; update|install) core_update;; *) echo "Usage: veyra core [check|update]";; esac
}

pro_install(){
  require_root; license_require_tools || return 1; license_refresh --quiet || true
  license_is_pro_local || { fail "A Veyra Pro license is required. Run: veyra license activate"; return 2; }
  local token payload resp url sha tmp zip dir manifest version release_sig pub
  token="$(license_local_token)"
  local installed=""; [[ -f "$LICENSE_PRO_META" ]] && installed="$(jq -r ' .version // empty' "$LICENSE_PRO_META" 2>/dev/null | xargs)"
  payload="$(jq -nc --arg token "$token" --arg domain "$(license_domain)" --arg fp "$(license_fingerprint)" --arg core "$(app_version)" --arg installed "$installed" --arg nonce "$(license_nonce)" --argjson timestamp "$(date +%s)" '{token:$token,domain:$domain,server_fingerprint:$fp,core_version:$core,installed_version:$installed,channel:"stable",nonce:$nonce,timestamp:$timestamp}')"
  resp="$(license_http_post /api/v1/releases/latest "$payload" 2>/dev/null)" || { fail "Could not query Pro releases."; return 1; }
  [[ "$(jq -r '.ok // false' <<<"$resp")" == true ]] || { fail "Release access denied: $(jq -r '.error // "unknown"' <<<"$resp")"; return 1; }
  url="$(jq -r '.release.download_url // empty' <<<"$resp")"; sha="$(jq -r '.release.sha256 // empty' <<<"$resp")"; version="$(jq -r '.release.version // empty' <<<"$resp")"; release_sig="$(jq -r '.release.package_signature // empty' <<<"$resp")"
  if [[ -z "$url" || -z "$sha" ]]; then
    if [[ -f "$LICENSE_PRO_META" ]]; then ok "Pro module is already up to date."; return 0; fi
    fail "No compatible active Pro release is published in License Control."; return 1
  fi
  tmp="$(mktemp -d /tmp/veyra-pro.XXXXXX)"; zip="$tmp/pro.zip"; dir="$tmp/unpack"; mkdir -p "$dir"
  curl -fL --connect-timeout 10 --max-time 180 "$url" -o "$zip" || { rm -rf "$tmp"; fail "Pro download failed."; return 1; }
  [[ "$(sha256sum "$zip" | awk '{print $1}')" == "$sha" ]] || { rm -rf "$tmp"; fail "Pro package checksum mismatch."; return 1; }
  license_assert_cached_public_key_trusted || { rm -rf "$tmp"; fail "Cached License Control public key does not match the root trust pin."; return 1; }
  pub="$(cat "$LICENSE_PUBLIC_KEY_FILE" 2>/dev/null || true)"; [[ -n "$release_sig" && -n "$pub" ]] || { rm -rf "$tmp"; fail "Pro release signature is missing."; return 1; }
  license_verify_release_signature "$sha" "$version" "$release_sig" "$pub" || { rm -rf "$tmp"; fail "Pro release Ed25519 signature verification failed."; return 1; }
  # Block path traversal, symlinks and oversized expansion before extraction.
  if unzip -Z1 "$zip" | grep -Eq '(^/|(^|/)\.\.(/|$))'; then rm -rf "$tmp"; fail "Unsafe Pro archive path detected."; return 1; fi
  if command -v zipinfo >/dev/null 2>&1 && zipinfo -l "$zip" | awk '$1 ~ /^l/ {found=1} END{exit found?0:1}'; then rm -rf "$tmp"; fail "Symlinks are not allowed in Pro archives."; return 1; fi
  local unpacked_bytes; unpacked_bytes="$(unzip -l "$zip" | awk 'END{print $1+0}')"
  if [[ "$unpacked_bytes" =~ ^[0-9]+$ ]] && (( unpacked_bytes > 536870912 )); then rm -rf "$tmp"; fail "Pro archive expands beyond the 512MB safety limit."; return 1; fi
  unzip -q "$zip" -d "$dir" || { rm -rf "$tmp"; fail "Pro archive is invalid."; return 1; }
  [[ -f "$dir/veyra-pro.json" && -d "$dir/payload" ]] || { rm -rf "$tmp"; fail "This is not a Veyra Pro module package."; return 1; }
  manifest="$dir/veyra-pro.json"
  [[ "$(jq -r '.product // empty' "$manifest")" == "veyra-pro" ]] || { rm -rf "$tmp"; fail "Pro manifest product mismatch."; return 1; }
  local manifest_version; manifest_version="$(jq -r '.version // empty' "$manifest")"
  [[ -z "$version" || -z "$manifest_version" || "$version" == "$manifest_version" ]] || { rm -rf "$tmp"; fail "Pro manifest version does not match the published release."; return 1; }
  local min_core; min_core="$(jq -r '.min_core_version // empty' "$manifest")"
  if [[ -n "$min_core" ]] && command -v dpkg >/dev/null 2>&1 && ! dpkg --compare-versions "$(app_version)" ge "$min_core"; then rm -rf "$tmp"; fail "Pro module requires Veyra Core >= $min_core."; return 1; fi
  if find "$dir/payload" -type l | grep -q .; then rm -rf "$tmp"; fail "Symlinks are not allowed in Pro payloads."; return 1; fi
  # v2.1: each private module carries an integrity.json containing per-file SHA-256 values.
  local ihash="" module_count=0 integrity_map='{}'
  for md in "$dir"/payload/modules/pro-*; do
    [[ -d "$md" ]] || continue; module_count=$((module_count+1)); [[ -f "$md/integrity.json" ]] || { rm -rf "$tmp"; fail "Pro module integrity manifest missing: $(basename "$md")"; return 1; }
    while IFS=$'\t' read -r rel fsha; do
      [[ -n "$rel" && "$rel" != /* && "$rel" != *..* && "$rel" != *\\* ]] || { rm -rf "$tmp"; fail "Unsafe Pro integrity path."; return 1; }
      [[ -f "$md/$rel" && ! -L "$md/$rel" ]] || { rm -rf "$tmp"; fail "Pro integrity file missing: $rel"; return 1; }
      [[ "$(sha256sum "$md/$rel" | awk '{print $1}')" == "$fsha" ]] || { rm -rf "$tmp"; fail "Pro file integrity mismatch: $rel"; return 1; }
    done < <(jq -r '.files|to_entries[]|[.key,.value]|@tsv' "$md/integrity.json")
    local _slug _mh; _slug="$(basename "$md")"; _mh="$(sha256sum "$md/integrity.json" | awk '{print $1}')"; integrity_map="$(jq -c --arg s "$_slug" --arg h "$_mh" '. + {($s):$h}' <<<"$integrity_map")"
    if [[ "$_slug" == "pro-core" ]]; then ihash="$_mh"; fi
  done
  (( module_count > 0 )) || { rm -rf "$tmp"; fail "No Pro modules found."; return 1; }
  [[ -n "$ihash" ]] || { rm -rf "$tmp"; fail "Pro Core integrity manifest missing."; return 1; }
  mkdir -p "$APP_DIR/modules"; rsync -a --delete "$dir/payload/modules/pro-core/" "$APP_DIR/modules/pro-core/"
  [[ -d "$dir/payload/modules/pro-web" ]] && rsync -a --delete "$dir/payload/modules/pro-web/" "$APP_DIR/modules/pro-web/"
  jq -n --arg version "${version:-$(jq -r '.version // "unknown"' "$manifest")}" --arg sha "$sha" --arg ihash "$ihash" --argjson imap "$integrity_map" --arg installed "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '{version:$version,package_sha256:$sha,integrity_sha256:$ihash,module_integrity:$imap,installed_at:$installed}' > "$LICENSE_PRO_META"
  chmod 640 "$LICENSE_PRO_META"; chown root:www-data "$LICENSE_PRO_META" 2>/dev/null || true
  configure_permissions || true; configure_nginx || true; rm -rf "$tmp"
  ok "Veyra Pro module ${version:-} installed securely."
}
pro_status(){
  license_status
  echo
  if [[ -f "$LICENSE_PRO_META" ]]; then cat "$LICENSE_PRO_META" | jq .; else warn "Pro module is not installed."; fi
}
pro_remove(){
  require_root; confirm "Remove installed Veyra Pro module files? User/database data will be kept." no || return 1
  rm -rf "$APP_DIR/modules/pro-web" "$APP_DIR/modules/pro-core"; rm -f "$LICENSE_PRO_META"; configure_nginx || true; ok "Pro module removed. Your signed license remains active; Pro features require reinstalling the module."
}
license_cmd(){
  local a="${1:-status}"; shift || true
  case "$a" in
    status) license_status;; sync) license_refresh --quiet;; server) license_set_server "${1:-}";; activate) license_activate "${1:-}";; refresh) license_refresh "${1:-}";; free|use-free) license_use_free;; deactivate) license_deactivate;;
    *) echo "Usage: veyra license [status|sync|server URL|activate [KEY]|refresh|deactivate]";;
  esac
}
pro_cmd(){
  case "${1:-status}" in install|update) pro_install;; status) pro_status;; remove) pro_remove;; *) echo "Usage: veyra pro [status|install|update|remove]";; esac
}
