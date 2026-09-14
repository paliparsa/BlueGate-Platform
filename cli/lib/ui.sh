#!/usr/bin/env bash
C_RESET='\033[0m'; C_BOLD='\033[1m'; C_BLUE='\033[38;5;39m'; C_GREEN='\033[38;5;42m'; C_YELLOW='\033[38;5;214m'; C_RED='\033[38;5;203m'; C_GRAY='\033[38;5;245m'
if [[ ! -t 1 || "${NO_COLOR:-0}" == "1" ]]; then C_RESET=''; C_BOLD=''; C_BLUE=''; C_GREEN=''; C_YELLOW=''; C_RED=''; C_GRAY=''; fi

ui_unicode_supported(){
  [[ "${ASCII_UI:-0}" != "1" ]] || return 1
  local loc="${LC_ALL:-${LC_CTYPE:-${LANG:-}}}"
  [[ "$loc" =~ [Uu][Tt][Ff]-?8 ]] || return 1
  command -v locale >/dev/null 2>&1 || return 0
  locale charmap 2>/dev/null | grep -qi '^UTF-8$'
}
if ui_unicode_supported; then
  UI_OK='✓'; UI_FAIL='✗'; UI_WARN='⚠'; UI_INFO='ℹ'; UI_DOT='●'; UI_LINE='─'; UI_SEP='·'; UI_ARROW='→'
else
  UI_OK='[OK]'; UI_FAIL='[FAIL]'; UI_WARN='[WARN]'; UI_INFO='[INFO]'; UI_DOT='*'; UI_LINE='-'; UI_SEP='|'; UI_ARROW='->'
fi
ui_width(){ local w="${COLUMNS:-76}"; [[ "$w" =~ ^[0-9]+$ ]] || w=76; (( w < 48 )) && w=48; (( w > 110 )) && w=110; echo "$w"; }
line(){ local w; w="$(ui_width)"; printf '%*s\n' "$w" '' | tr ' ' "$UI_LINE"; }
header(){ clear 2>/dev/null || true; printf "%b\n" "${C_BLUE}${C_BOLD}BlueGate Platform${C_RESET}  ${C_GRAY}CLI ${CLI_VERSION}${C_RESET}"; printf "%b\n" "${C_GRAY}$(app_version) ${UI_SEP} ${DOMAIN:-domain not configured}${C_RESET}"; line; }
info(){ printf "%b%s%b %s\n" "$C_BLUE" "$UI_INFO" "$C_RESET" "$*"; }
ok(){ printf "%b%s%b %s\n" "$C_GREEN" "$UI_OK" "$C_RESET" "$*"; }
warn(){ printf "%b%s%b %s\n" "$C_YELLOW" "$UI_WARN" "$C_RESET" "$*"; }
fail(){ printf "%b%s%b %s\n" "$C_RED" "$UI_FAIL" "$C_RESET" "$*" >&2; }
label(){ printf "%b%-22s%b %s\n" "$C_GRAY" "$1" "$C_RESET" "$2"; }
step(){ printf "%b[%s/%s]%b %s ... " "$C_BLUE" "$1" "$2" "$C_RESET" "$3"; }
step_ok(){ printf "%b%s%b\n" "$C_GREEN" "$UI_OK" "$C_RESET"; }
step_fail(){ printf "%b%s%b\n" "$C_RED" "$UI_FAIL" "$C_RESET"; }
pause(){ echo; read -rp "Press Enter to return..." _ || true; }
status_dot(){ local state="$1"; case "$state" in ok) printf "%b%s%b" "$C_GREEN" "$UI_DOT" "$C_RESET";; warn) printf "%b%s%b" "$C_YELLOW" "$UI_DOT" "$C_RESET";; *) printf "%b%s%b" "$C_RED" "$UI_DOT" "$C_RESET";; esac; }
