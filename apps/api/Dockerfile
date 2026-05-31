# ── Étape 1 : deps ────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

RUN npm install -g pnpm@11

COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY packages/config/package.json ./packages/config/

RUN pnpm install --frozen-lockfile --filter api --filter @erp/types --filter @erp/utils --filter @erp/config

# ── Étape 2 : build ───────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm@11

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules

COPY apps/api ./apps/api
COPY packages/types ./packages/types
COPY packages/utils ./packages/utils
COPY packages/config ./packages/config

WORKDIR /app/apps/api
RUN pnpm exec prisma generate
RUN pnpm run build

# ── Étape 3 : production ──────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Dépendances de production seulement (pas de pnpm global nécessaire en prod)
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./dist
# Client Prisma généré (engines + runtime)
COPY --from=builder /app/apps/api/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
# Schéma Prisma pour les migrations
COPY apps/api/prisma ./prisma

USER nestjs

EXPOSE 3001
ENV NODE_ENV=production PORT=3001

# Migrations auto au démarrage (idempotent, sûr en rolling deploy)
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
