#!/bin/sh
set -e

echo "FitID startup: launching backend, frontend, and nginx"

cd /app/backend
uvicorn app.main:app --host 127.0.0.1 --port 8000 --proxy-headers > /tmp/backend.log 2>&1 &
backend_pid=$!

echo "FitID startup: backend PID=${backend_pid}"

cd /app/frontend
npm run start -- -p "${PORT:-10000}" --hostname 127.0.0.1 > /tmp/frontend.log 2>&1 &
frontend_pid=$!

echo "FitID startup: frontend PID=${frontend_pid}"

nginx -g "daemon off;" &
nginx_pid=$!

echo "FitID startup: nginx PID=${nginx_pid}"

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
