#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "============================================"
echo "          FUNDECK - Game Server Launcher"
echo "============================================"
echo ""

# ─── Kill anything on ports 3000 / 8787 ───────────
echo "[1/4] Clearing ports and stale state..."
for port in 3000 8787; do
  pids="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    kill -9 $pids 2>/dev/null || true
    echo "   Killed process(es) on port $port"
  fi
done
rm -rf "$ROOT_DIR/worker/.wrangler/state" 2>/dev/null || true
echo "   Ports and state cleared."
echo ""

# ─── Install dependencies ─────────────────────────
echo "[2/4] Installing dependencies..."
cd "$ROOT_DIR"
npm install --silent
cd "$ROOT_DIR/worker"
npm install --silent
echo "   Dependencies installed."
echo ""

# ─── Start worker in background ───────────────────
echo "[3/4] Starting Cloudflare Worker on port 8787..."
cd "$ROOT_DIR/worker"
ENVIRONMENT=development npx wrangler dev --config wrangler.toml --ip 0.0.0.0 --port 8787 2>&1 | sed 's/^/   [worker] /' &
WORKER_PID=$!
echo "   Worker started (PID $WORKER_PID)"
echo ""

sleep 3

# ─── Start frontend ───────────────────────────────
echo "[4/4] Starting Next.js frontend on port 3000..."
echo ""

sleep 2 && open "http://localhost:3000" 2>/dev/null &

cd "$ROOT_DIR"
echo "============================================"
echo "   FunDeck is running!"
echo ""
echo "   Frontend : http://localhost:3000"
echo "   Worker   : http://localhost:8787"
echo ""
echo "   Press Ctrl+C to stop both servers."
echo "============================================"
echo ""

cleanup() {
  echo ""
  echo "Shutting down..."
  kill $WORKER_PID 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

npx next dev --port 3000 2>&1 | sed 's/^/   [frontend] /'
