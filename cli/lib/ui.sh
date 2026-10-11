#!/usr/bin/env bash
# Terminal-safe BlueGate UI. ASCII-first by design so broken locales/fonts never render ???.
C_RESET='\033[0m'; C_BOLD='\033[1m'; C_DIM='\033[2m'
C_BLUE='\033[38;5;39m'; C_CYAN='\033[38;5;45m'; C_GREEN='\033[38;5;42m'
C_YELLOW='\033[38;5;214m'; C_RED='\033[38;5;203m'; C_GRAY='\033[38;5;245m'; C_WHITE='\033[38;5;255m'
if [[ ! -t 1 || "${NO_COLOR:-0}" == "1" || "${TERM:-}" == "dumb" ]]; then
  C_RESET=''; C_BOLD=''; C_DIM=''; C_BLUE=''; C_CYAN=''; C_GREEN=''; C_YELLOW=''; C_RED=''; C_GRAY=''; C_WHITE=''
fi

UI_OK='[OK]'; UI_FAIL='[FAIL]'; UI_WARN='[WARN]'; UI_INFO='[INFO]'; UI_DOT='*'; UI_LINE='-'; UI_SEP='|'; UI_ARROW='->'

ui_width(){
  local w="${COLUMNS:-}"
  if [[ ! "$w" =~ ^[0-9]+$ ]] && command -v tput >/dev/null 2>&1; then w="$(tput cols 2>/dev/null || true)"; fi
  [[ "$w" =~ ^[0-9]+$ ]] || w=78
  (( w < 64 )) && w=64
  (( w > 100 )) && w=100
  echo "$w"
}
ui_repeat(){ local ch="$1" n="$2"; printf '%*s' "$n" '' | tr ' ' "$ch"; }
line(){ local w; w="$(ui_width)"; ui_repeat '-' "$w"; printf '\n'; }
heavy_line(){ local w; w="$(ui_width)"; ui_repeat '=' "$w"; printf '\n'; }
ui_rule(){ local title="${1:-}" w left; w="$(ui_width)"; if [[ -z "$title" ]]; then line; return; fi; left=$((w-${#title}-5)); ((left<4)) && left=4; printf "%b-- %s %b" "$C_GRAY" "$title" "$C_RESET"; ui_repeat '-' "$left"; printf '\n'; }

header(){
  clear 2>/dev/null || true
  local w ver dom title meta pad
  w="$(ui_width)"; ver="$(app_version)"; dom="${DOMAIN:-domain not configured}"
  title=" BLUEGATE PLATFORM"; meta="CLI ${CLI_VERSION}"
  printf "%b+" "$C_BLUE"; ui_repeat '=' $((w-2)); printf "+%b\n" "$C_RESET"
  pad=$((w-3-${#title}-${#meta})); ((pad<1)) && pad=1
  printf "%b|%b%b%s%b%*s%b%s%b |\n" "$C_BLUE" "$C_RESET" "$C_BOLD$C_WHITE" "$title" "$C_RESET" "$pad" '' "$C_GRAY" "$meta" "$C_RESET"
  local detail dpad
  detail="  Version ${ver}  ${UI_SEP}  Domain: ${dom}"
  dpad=$((w-2-${#detail})); ((dpad<0)) && dpad=0
  printf "%b|%b%s%*s%b|%b\n" "$C_BLUE" "$C_RESET$C_GRAY" "$detail" "$dpad" '' "$C_BLUE" "$C_RESET"
  printf "%b+" "$C_BLUE"; ui_repeat '=' $((w-2)); printf "+%b\n" "$C_RESET"
}
section(){ printf "\n%b%s%b\n" "$C_BOLD$C_CYAN" "${1:-}" "$C_RESET"; ui_rule; }
info(){ printf "%b%-6s%b %s\n" "$C_BLUE" "$UI_INFO" "$C_RESET" "$*"; }
ok(){ printf "%b%-6s%b %s\n" "$C_GREEN" "$UI_OK" "$C_RESET" "$*"; }
warn(){ printf "%b%-6s%b %s\n" "$C_YELLOW" "$UI_WARN" "$C_RESET" "$*"; }
fail(){ printf "%b%-6s%b %s\n" "$C_RED" "$UI_FAIL" "$C_RESET" "$*" >&2; }
label(){ printf "  %b%-24s%b %s\n" "$C_GRAY" "$1" "$C_RESET" "$2"; }
menu_item(){ printf "  %b%2s%b  %-24s %s\n" "$C_CYAN$C_BOLD" "$1" "$C_RESET" "$2" "${3:-}"; }
step(){ printf "%b[%s/%s]%b %-44s " "$C_BLUE$C_BOLD" "$1" "$2" "$C_RESET" "$3"; }
step_ok(){ printf "%b%s%b\n" "$C_GREEN" "$UI_OK" "$C_RESET"; }
step_fail(){ printf "%b%s%b\n" "$C_RED" "$UI_FAIL" "$C_RESET"; }
pause(){ echo; read -rp "Press Enter to return... " _ || true; }
status_dot(){ local state="$1"; case "$state" in ok) printf "%b%s%b" "$C_GREEN" "$UI_OK" "$C_RESET";; warn) printf "%b%s%b" "$C_YELLOW" "$UI_WARN" "$C_RESET";; *) printf "%b%s%b" "$C_RED" "$UI_FAIL" "$C_RESET";; esac; }

ui_badge(){ local state="$1" text="$2"; case "$state" in ok) printf "%b[ %s ]%b" "$C_GREEN$C_BOLD" "$text" "$C_RESET";; warn) printf "%b[ %s ]%b" "$C_YELLOW$C_BOLD" "$text" "$C_RESET";; fail) printf "%b[ %s ]%b" "$C_RED$C_BOLD" "$text" "$C_RESET";; *) printf "%b[ %s ]%b" "$C_GRAY$C_BOLD" "$text" "$C_RESET";; esac; }
wizard_step(){ local no="$1" title="$2" detail="${3:-}"; printf "\n%bStep %s%b  %b%s%b\n" "$C_BLUE$C_BOLD" "$no" "$C_RESET" "$C_BOLD" "$title" "$C_RESET"; [[ -n "$detail" ]] && printf "  %b%s%b\n" "$C_GRAY" "$detail" "$C_RESET"; }
summary_row(){ local label="$1" value="$2" state="${3:-}"; printf "  %-22s " "$label"; [[ -n "$state" ]] && { ui_badge "$state" "$state"; printf "  "; }; printf "%s\n" "$value"; }
