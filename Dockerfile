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

# Prisma: schema + migrations + CLI + engines (needed for `prisma migrate deploy` at startup)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
# prisma.config.ts does `import dotenv from 'dotenv'`; the CLI needs it at
# config-load time, so include it even though it's only a devDependency.
COPY --from=builder /app/node_modules/dotenv ./node_modules/dotenv
# Create a symlink to the Prisma CLI instead of copying the .bin shim.
# The shim resolves its WASM engines via __dirname; a copied file lands in
# .bin/ (no sibling wasm), while a symlink keeps __dirname at prisma/build/
# where prisma_schema_build_bg.wasm and schema_engine_bg.wasm live.
RUN mkdir -p ./node_modules/.bin \
 && ln -sf ../prisma/build/index.js ./node_modules/.bin/prisma

COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/ > /dev/null 2>&1 || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
