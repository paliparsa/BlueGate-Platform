#!/usr/bin/env bash
C_RESET='\033[0m'; C_BOLD='\033[1m'; C_BLUE='\033[38;5;39m'; C_GREEN='\033[38;5;42m'; C_YELLOW='\033[38;5;214m'; C_RED='\033[38;5;203m'; C_GRAY='\033[38;5;245m'
if [[ ! -t 1 || "${NO_COLOR:-0}" == "1" ]]; then C_RESET=''; C_BOLD=''; C_BLUE=''; C_GREEN=''; C_YELLOW=''; C_RED=''; C_GRAY=''; fi
line(){ printf '%*s\n' "${COLUMNS:-76}" '' | tr ' ' '─'; }
header(){ clear 2>/dev/null || true; printf "%b\n" "${C_BLUE}${C_BOLD}BlueGate Platform${C_RESET}  ${C_GRAY}CLI ${CLI_VERSION}${C_RESET}"; printf "%b\n" "${C_GRAY}$(app_version) · ${DOMAIN:-domain not configured}${C_RESET}"; line; }
info(){ printf "%bℹ%b %s\n" "$C_BLUE" "$C_RESET" "$*"; }
ok(){ printf "%b✓%b %s\n" "$C_GREEN" "$C_RESET" "$*"; }
warn(){ printf "%b⚠%b %s\n" "$C_YELLOW" "$C_RESET" "$*"; }
fail(){ printf "%b✗%b %s\n" "$C_RED" "$C_RESET" "$*" >&2; }
label(){ printf "%b%-22s%b %s\n" "$C_GRAY" "$1" "$C_RESET" "$2"; }
step(){ printf "%b[%s/%s]%b %s ... " "$C_BLUE" "$1" "$2" "$C_RESET" "$3"; }
step_ok(){ printf "%b✓%b\n" "$C_GREEN" "$C_RESET"; }
step_fail(){ printf "%bFAILED%b\n" "$C_RED" "$C_RESET"; }
pause(){ echo; read -rp "Press Enter to return..." _ || true; }
status_dot(){ local state="$1"; case "$state" in ok) printf "%b●%b" "$C_GREEN" "$C_RESET";; warn) printf "%b●%b" "$C_YELLOW" "$C_RESET";; *) printf "%b●%b" "$C_RED" "$C_RESET";; esac; }
