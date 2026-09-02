#!/usr/bin/env bash
tg_api(){ local method="$1"; shift; [[ -n "$BOT_TOKEN" ]] || return 2; curl -fsS --max-time 15 "https://api.telegram.org/bot${BOT_TOKEN}/${method}" "$@"; }
telegram_set_webhook(){
  [[ -n "$BOT_TOKEN" && -n "$DOMAIN" && -n "$WEBHOOK_SECRET" ]] || { fail "Telegram/domain config incomplete"; return 1; }
  local res; res="$(tg_api setWebhook --data-urlencode "url=https://${DOMAIN}/bot.php?secret=${WEBHOOK_SECRET}" --data-urlencode 'allowed_updates=["message","callback_query","pre_checkout_query"]')" || return 1
  echo "$res" | grep -q '"ok":true' || { echo "$res"; return 1; }
  ok "Telegram webhook refreshed"
}
telegram_sync_ui(){
  local a b
  a="$(tg_api setChatMenuButton --data-urlencode 'menu_button={"type":"commands"}')" || return 1
  b="$(tg_api setMyCommands --data-urlencode 'commands=[{"command":"start","description":"باز کردن BlueGate"},{"command":"shop","description":"خرید سریع"},{"command":"orders","description":"سفارش‌های من"},{"command":"services","description":"سرویس‌های من"},{"command":"support","description":"پشتیبانی"}]')" || return 1
  echo "$a$b" | grep -q '"ok":true'
}
telegram_health_text(){
  [[ -n "$BOT_TOKEN" ]] || { echo "not configured"; return 1; }
  local me wh; me="$(tg_api getMe 2>/dev/null)" || { echo "API unreachable"; return 1; }; wh="$(tg_api getWebhookInfo 2>/dev/null)" || true
  local user url pending err err_date now age suffix=""
  if command -v jq >/dev/null 2>&1; then
    user="$(printf '%s' "$me" | jq -r '.result.username // empty' 2>/dev/null)"
    url="$(printf '%s' "$wh" | jq -r '.result.url // empty' 2>/dev/null)"
    pending="$(printf '%s' "$wh" | jq -r '.result.pending_update_count // 0' 2>/dev/null)"
    err="$(printf '%s' "$wh" | jq -r '.result.last_error_message // empty' 2>/dev/null)"
    err_date="$(printf '%s' "$wh" | jq -r '.result.last_error_date // 0' 2>/dev/null)"
  else
    user="$(echo "$me" | sed -n 's/.*"username":"\([^"]*\)".*/\1/p')"
    url="$(echo "$wh" | sed -n 's/.*"url":"\([^"]*\)".*/\1/p')"
    pending="$(echo "$wh" | sed -n 's/.*"pending_update_count":\([0-9]*\).*/\1/p')"; pending="${pending:-0}"
    err="$(echo "$wh" | sed -n 's/.*"last_error_message":"\([^"]*\)".*/\1/p')"
    err_date="$(echo "$wh" | sed -n 's/.*"last_error_date":\([0-9]*\).*/\1/p')"; err_date="${err_date:-0}"
  fi
  now="$(date +%s)"; age=$(( now - ${err_date:-0} ))
  if [[ -n "$err" && ( "${pending:-0}" -gt 0 || "$age" -lt 900 ) ]]; then suffix=" | error=$err"; fi
  echo "@${user:-unknown} | pending=${pending:-0} | webhook=${url:-none}${suffix}"
  [[ -n "$url" ]]
}
