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

# Paquets partagés compilés en JS : l'API les charge à l'exécution
RUN pnpm --filter @erp/types --filter @erp/utils run build

WORKDIR /app/apps/api
RUN pnpm exec prisma generate
RUN pnpm run build

# Dossier autonome : dépendances de prod de l'API + paquets partagés copiés
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
RUN pnpm --filter api deploy --prod --legacy /out \
 && cp -r apps/api/dist /out/dist \
 && cp -r apps/api/prisma /out/prisma \
 && cd /out && pnpm exec prisma generate

# ── Étape 3 : production ──────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

COPY --from=builder /out ./

USER nestjs

EXPOSE 3001
ENV NODE_ENV=production PORT=3001

# Migrations auto au démarrage (idempotent, sûr en rolling deploy)
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
