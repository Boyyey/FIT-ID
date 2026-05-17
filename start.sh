#!/bin/sh
set -e

export NODE_ENV=production

echo "FitID startup: launching backend, frontend, and nginx"

cd /app/backend
echo "FitID: starting backend at 127.0.0.1:8000"
uvicorn app.main:app --host 127.0.0.1 --port 8000 --proxy-headers 2>&1 &
backend_pid=$!
echo "FitID startup: backend PID=${backend_pid}"

sleep 2

cd /app/frontend
port="${PORT:-10000}"
echo "========== FitID Frontend Diagnostics =========="
echo "Current directory: $(pwd)"
echo "PORT environment variable: ${port}"
echo ""
echo "Node and npm versions:"
node --version
npm --version
echo ""
echo "Frontend directory contents:"
ls -la /app/frontend/ 2>/dev/null | head -15
echo ""
echo ".next build directory check:"
if [ -d /app/frontend/.next ]; then
  echo "✓ .next directory EXISTS"
  ls -la /app/frontend/.next/ | head -10
else
  echo "✗ ERROR: .next directory MISSING!"
  exit 1
fi
echo ""
echo ""
echo "node_modules check:"
if [ -d /app/frontend/node_modules ]; then
  echo "✓ node_modules already present, skipping npm ci"
else
  echo "✗ ERROR: node_modules MISSING!"
  exit 1
fi
echo ""
echo "Checking for 'next' binary:"
which next || echo "  'next' not in PATH, trying npx..."
echo ""
echo "========== Starting Next.js Frontend =========="
export PORT="${port}"
echo "Launching: npx next start -p ${port} --hostname 0.0.0.0"
npx next start -p "${port}" --hostname 0.0.0.0 2>&1 &
frontend_pid=$!
echo "Frontend PID: ${frontend_pid}"
echo ""
echo "Waiting 10 seconds for frontend to bind to port ${port}..."
sleep 10

echo "========== Starting nginx =========="
echo "nginx.conf contents (first 30 lines):"
head -30 /etc/nginx/nginx.conf
echo ""
echo "Launching nginx..."
nginx -g "daemon off;" 2>&1 &
nginx_pid=$!
echo "nginx PID: ${nginx_pid}"
echo "nginx startup complete"
echo ""

echo "FitID: all processes started, monitoring..."

while :; do
  if ! kill -0 "$backend_pid" 2>/dev/null; then
    echo "FitID startup: backend process exited"
    break
  fi
  if ! kill -0 "$frontend_pid" 2>/dev/null; then
    echo "FitID startup: frontend process exited"
    break
  fi
  if ! kill -0 "$nginx_pid" 2>/dev/null; then
    echo "FitID startup: nginx process exited"
    break
  fi
  sleep 1
done

printf 'FitID startup: process exited, shutting down\n'
kill "$backend_pid" "$frontend_pid" "$nginx_pid" 2>/dev/null || true
exit 1
