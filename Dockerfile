# ── Minimal production runner (Relies on Host Pre-build) ─────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Tells audit-logger.ts to use console.log instead of appendFileSync
ENV RUNNING_IN_DOCKER=true
# Required: standalone server must bind to 0.0.0.0, not just 127.0.0.1,
# otherwise cloudflared cannot reach it via Docker internal network
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy the pre-built files from the native Windows host 'npm run build'
COPY --chown=nextjs:nodejs .next/standalone ./
COPY --chown=nextjs:nodejs .next/static ./.next/static
# public/ is empty in this project; line kept for future static assets
# COPY --chown=nextjs:nodejs public ./public

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=5 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]