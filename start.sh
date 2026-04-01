#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

print_header() {
  printf '%s\n' "============================================"
  printf '%s\n' "          DECK - Game Server Launcher"
  printf '%s\n' "============================================"
  printf '\n'
}

fail() {
  printf '\n%s\n' "ERROR: $1" >&2
  exit 1
}

kill_port() {
  local port="$1"
  local pids
  pids="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)"
  if [[ -n "${pids}" ]]; then
    # shellcheck disable=SC2086
    kill -9 ${pids} >/dev/null 2>&1 || true
  fi
}

run_step() {
  local label="$1"
  shift
  printf '%s\n' "${label}"
  ( "$@" ) || fail "${label} failed"
  printf '%s\n\n' "   done."
}

open_terminal_tab() {
  local title="$1"
  local working_dir="$2"
  local cmd="$3"

  if command -v osascript >/dev/null 2>&1; then
    osascript >/dev/null <<OSA
tell application "Terminal"
  activate
  try
    set newTab to do script "cd $(printf '%q' "$working_dir") && echo '========== $title ==========' && echo && $cmd"
  on error
    do script "cd $(printf '%q' "$working_dir") && echo '========== $title ==========' && echo && $cmd"
  end try
end tell
OSA
  else
    printf '%s\n' "osascript not found; starting in current terminal: $title"
    (cd "$working_dir" && eval "$cmd") &
  fi
}

main() {
  print_header

  printf '%s\n' "[1/5] Clearing ports 3000 and 8787..."
  kill_port 3000
  kill_port 8787
  printf '%s\n\n' "   Ports cleared."

  run_step "[2/5] Installing frontend dependencies..." bash -lc "cd \"$ROOT_DIR\" && npm install"
  run_step "[3/5] Installing worker dependencies..." bash -lc "cd \"$ROOT_DIR/worker\" && npm install"

  printf '%s\n' "[4/5] Starting Cloudflare Worker (port 8787)..."
  open_terminal_tab "DECK WORKER (port 8787)" "$ROOT_DIR/worker" "npx wrangler dev"

  sleep 3

  printf '%s\n' "[5/5] Starting Next.js frontend (port 3000)..."
  open_terminal_tab "DECK FRONTEND (port 3000)" "$ROOT_DIR" "npx next dev"

  printf '\n%s\n' "   Waiting for frontend to start..."
  sleep 5

  printf '\n%s\n' "   Opening browser..."
  open "http://localhost:3000" >/dev/null 2>&1 || true

  printf '\n%s\n' "============================================"
  printf '%s\n' "   Deck is running!"
  printf '\n%s\n' "   Frontend : http://localhost:3000"
  printf '%s\n'   "   Worker   : http://localhost:8787"
  printf '\n%s\n' "   Each server is started in Terminal."
  printf '%s\n' "============================================"
}

main "$@"
