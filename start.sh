#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "Threadmate — Starting..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Backend ──────────────────────────────────────────────────────────────
echo ""
echo "📦 Installing backend dependencies..."
cd "$ROOT/backend"

if ! command -v python3 &>/dev/null; then
  echo "❌ python3 not found. Please install Python 3.10+"
  exit 1
fi

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi

source .venv/bin/activate
pip install -q -r requirements.txt

if [ ! -f ".env" ] && [ -f ".env.example" ]; then
  cp .env.example .env
  echo "📝 Created .env from .env.example (add ZHIPU_API_KEY for real AI)"
fi

echo "🚀 Starting FastAPI backend on http://localhost:8000 ..."
uvicorn main:app --host "::" --port 8000 --reload &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

# ── Frontend ─────────────────────────────────────────────────────────────
echo ""
echo "📦 Installing frontend dependencies..."
cd "$ROOT/frontend"

if ! command -v node &>/dev/null; then
  echo "❌ node not found. Please install Node.js 18+"
  exit 1
fi

npm install --silent

echo "🚀 Starting Next.js frontend on http://localhost:3000 ..."
npm run dev &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"

# ── Open browser ─────────────────────────────────────────────────────────
sleep 4
if command -v open &>/dev/null; then
  open http://localhost:3000
elif command -v xdg-open &>/dev/null; then
  xdg-open http://localhost:3000
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Threadmate is running!"
echo "   Frontend → http://localhost:3000"
echo "   Backend  → http://localhost:8000"
echo "   API docs → http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop both servers."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Keep running
wait $BACKEND_PID $FRONTEND_PID
