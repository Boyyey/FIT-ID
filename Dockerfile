# Root Dockerfile for Render deployment of the full FIT-ID project
# Builds the frontend and backend, then starts both in one container.

################################################################
# Frontend build stage
################################################################
FROM node:22-alpine AS frontend-builder

WORKDIR /frontend

COPY frontend/package.json ./
RUN npm install

COPY frontend/ .
ENV NEXTAUTH_URL=http://localhost:3000
ENV NEXTAUTH_SECRET=placeholder-nextauth-secret
ENV GOOGLE_CLIENT_ID=placeholder-google-client-id
ENV GOOGLE_CLIENT_SECRET=placeholder-google-client-secret
ENV NEXT_PUBLIC_API_BASE=/api/v1
RUN npm run build

################################################################
# Backend build stage
################################################################
FROM python:3.12-slim AS backend-builder

WORKDIR /backend
ENV PYTHONUNBUFFERED=1

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app

################################################################
# Final runtime image
################################################################
FROM python:3.12-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1
ENV PORT=10000

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    gnupg \
    dirmngr \
    nginx \
    libglib2.0-0 \
    libsm6 \
    libxrender1 \
    libxext6 \
    libx11-6 \
    libxcb1 \
    libgl1 \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY --from=backend-builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=backend-builder /usr/local/bin /usr/local/bin
COPY --from=backend-builder /backend/app ./backend/app

COPY --from=frontend-builder /frontend/.next ./frontend/.next
COPY --from=frontend-builder /frontend/public ./frontend/public
COPY --from=frontend-builder /frontend/package.json ./frontend/package.json
COPY --from=frontend-builder /frontend/node_modules ./frontend/node_modules
COPY --from=frontend-builder /frontend/next.config.js ./frontend/next.config.js
COPY --from=frontend-builder /frontend/next-env.d.ts ./frontend/next-env.d.ts

COPY nginx.conf /etc/nginx/nginx.conf

WORKDIR /app
EXPOSE 80

CMD bash -lc "cd /app/backend && uvicorn app.main:app --host 127.0.0.1 --port 8000 --proxy-headers & cd /app/frontend && npm run start -- -p ${PORT} --hostname 127.0.0.1 & nginx -g 'daemon off;'"
