# ============================================================
# backend/Dockerfile — QK7 DataHub Gateway (Express 5)
# Multi-stage: builder (frontend + deps) → runner (production)
# ============================================================

# ─── Stage 1: Build frontend Vite → backend/public ───
FROM node:20-alpine AS frontend-builder
WORKDIR /build/frontend

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci || npm install

COPY frontend/ ./
RUN npm run build
# vite.config.ts xuất ra ../backend/public
# → kiểm tra: /build/backend/public/index.html tồn tại sau bước này

# ─── Stage 2: Cài backend production deps ───
FROM node:20-alpine AS backend-deps
WORKDIR /build/backend

COPY backend/package.json backend/package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

# ─── Stage 3: Runtime ───
FROM node:20-alpine AS runner

# Tạo non-root user (2026 standard)[reference:1]
RUN addgroup -S qk7 && adduser -S qk7 -G qk7

WORKDIR /app

# Copy node_modules production
COPY --from=backend-deps /build/backend/node_modules ./node_modules

# Copy source backend (loại trừ .env, node_modules, uploads)
COPY backend/server.js backend/swagger.js backend/pdf-parser.js ./
COPY backend/setup-passwords.js ./
COPY backend/src/ ./src/

# Copy frontend build vào public/
COPY --from=frontend-builder /build/backend/public ./public/

# Tạo thư mục uploads (sẽ mount volume)
RUN mkdir -p /app/uploads && chown -R qk7:qk7 /app

USER qk7

EXPOSE 8000

# Healthcheck chuẩn production[reference:2]
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8000/api/health || exit 1

CMD ["node", "server.js"]