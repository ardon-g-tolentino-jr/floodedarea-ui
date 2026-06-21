# ── Stage 1: build ──
# Vite bakes VITE_* env into the bundle at build time, so the Google client id and
# (optional) API base are passed as build args and written to a high-priority
# .env.production.local so they deterministically override .env.production.
FROM node:20-alpine AS builder
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

ARG VITE_API_URL=/api
ARG VITE_GOOGLE_CLIENT_ID=
RUN printf 'VITE_API_URL=%s\nVITE_GOOGLE_CLIENT_ID=%s\n' "$VITE_API_URL" "$VITE_GOOGLE_CLIENT_ID" > .env.production.local \
 && npm run build

# ── Stage 2: runtime ──
# nginx serves the static bundle and reverse-proxies /api → the backend, mirroring the
# Vite dev proxy (which strips the /api prefix). API_UPSTREAM is substituted into the
# config at container start by the official nginx entrypoint (envsubst on /templates).
FROM nginx:alpine
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=builder /build/dist /usr/share/nginx/html
ENV API_UPSTREAM=http://api:8083
EXPOSE 80
