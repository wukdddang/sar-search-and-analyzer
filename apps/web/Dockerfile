# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────
# Sentinel Web (Next.js 15, pnpm monorepo) — production image
# Outputs a Next.js standalone server on port 3333.
#
# Build from the repo root:
#   docker build -f apps/web/Dockerfile -t sentinel/web:latest .
# ─────────────────────────────────────────────────────────────

ARG NODE_VERSION=22-alpine

# ── 1. builder ───────────────────────────────────────────────
# Single builder stage avoids pnpm symlink breakage when copying
# node_modules between stages.
FROM node:${NODE_VERSION} AS builder
RUN corepack enable \
 && corepack prepare pnpm@9.15.0 --activate
WORKDIR /repo

# Deps manifests first (good cache hit when only app code changes)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/package.json

RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --filter @sentinel/web... --frozen-lockfile

# Now copy source and build
COPY apps/web ./apps/web

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @sentinel/web build \
 && mkdir -p /repo/apps/web/public

# ── 2. runner ────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3333 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# next.config.mjs has `output: 'standalone'` — copy the minimal runtime.
# The standalone output includes its own `node_modules` with only what's needed.
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/static      ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/public            ./apps/web/public

USER nextjs
EXPOSE 3333

CMD ["node", "apps/web/server.js"]
