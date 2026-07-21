# ---------- Base: Node 22 (project requires >=22.12 <23) ----------
FROM node:22-alpine AS base

# libc6-compat: required by some native deps (e.g. sharp / prisma engines) on alpine
RUN apk add --no-cache libc6-compat

# ---------- Deps: install production dependencies for the standalone runtime ----------
FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma

# Install ALL deps (dev included) so `prisma generate` and `next build` work.
# Prisma CLI hooks run via the `postinstall` script (prisma generate).
RUN npm ci --no-audit --no-fund

# ---------- Builder: build the Next.js standalone output ----------
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# Build (script already runs `prisma generate` first)
RUN npm run build

# ---------- Runner: minimal production image ----------
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Standalone server output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma: schema + migrations + full CLI dependency closure.
# Copy the COMPLETE node_modules from the builder so `prisma migrate deploy`
# has every transitive dependency it needs (prisma, @prisma/*, effect, dotenv,
# ...). This also replaces the standalone server's node_modules with the full
# tree (a strict superset), so the app keeps working too.
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/node_modules ./node_modules

COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/ > /dev/null 2>&1 || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
