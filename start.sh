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
echo "FitID: starting frontend at 127.0.0.1:${port}"
echo "FitID: frontend directory listing:"
ls -la /app/frontend/ | head -10
echo "FitID: .next directory check:"
ls -la /app/frontend/.next/ 2>/dev/null | head -5 || echo "ERROR: .next directory missing!"
export PORT="${port}"
echo "FitID: running npm run start with PORT=$PORT"
npm run start 2>&1 &
frontend_pid=$!
echo "FitID startup: frontend PID=${frontend_pid}"

echo "FitID: waiting for frontend to bind to port ${port}..."
sleep 8

echo "FitID: starting nginx"
nginx -g "daemon off;" 2>&1 &
nginx_pid=$!
echo "FitID startup: nginx PID=${nginx_pid}"

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
