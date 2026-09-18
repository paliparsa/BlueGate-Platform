#!/usr/bin/env bash
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI="$ROOT/cli/bluegate"
[[ -x "$CLI" ]] || { echo "Missing CLI: $CLI" >&2; exit 2; }
case "${1:-}" in
  --full|--install) shift; exec "$CLI" install "$@";;
  --status) shift; exec "$CLI" status "$@";;
  --webhook) shift; exec "$CLI" webhook "$@";;
  --update) shift; exec "$CLI" update "$@";;
  --health) shift; exec "$CLI" health "$@";;
  --crypto-cron) shift; exec "$CLI" cron "$@";;
  --install-command) shift; exec "$CLI" manager-install "$@";;
  --help|-h) exec "$CLI" help;;
  "") exec "$CLI" menu;;
  *) exec "$CLI" "$@";;
esac
