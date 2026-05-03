# ── Stage 1: Install dependencies ────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ── Stage 2: Production runner ────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 mcpuser
# Copy dependencies and TypeScript source
COPY --from=deps --chown=mcpuser:nodejs /app/node_modules ./node_modules
COPY --chown=mcpuser:nodejs src ./src
# tsconfig.json is needed by tsx at runtime for path resolution
COPY --chown=mcpuser:nodejs tsconfig.json ./
COPY --chown=mcpuser:nodejs package*.json ./
USER mcpuser
# Port 3100 is intentionally NOT published to the host in docker-compose.yml
# (internal Docker network only — only next-app can reach it)
EXPOSE 3100
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3100/health | grep -q '"ok":true' || exit 1
# Use tsx from local node_modules (avoids global install, version-pinned via package-lock.json)
CMD ["node_modules/.bin/tsx", "src/index.ts"]
