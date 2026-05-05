# syntax=docker/dockerfile:1.7
# Altaris Web — Next.js 16 standalone build
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# CI'dan inject edilen versiyon (build-images.yml — github.run_number ile auto-bump).
# next.config.ts ALTARIS_VERSION env'i NEXT_PUBLIC_BUILD_VERSION'a yansıtır →
# dashboard badge + homepage + katalog hep aynı kaynaktan beslenir.
ARG ALTARIS_VERSION=
ENV ALTARIS_VERSION=$ALTARIS_VERSION
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:22-alpine AS runtime
RUN addgroup -S altaris && adduser -S altaris -G altaris
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=altaris:altaris /app/.next/standalone ./
COPY --from=build --chown=altaris:altaris /app/.next/static     ./.next/static
COPY --from=build --chown=altaris:altaris /app/public           ./public
USER altaris
EXPOSE 3000
HEALTHCHECK --interval=20s --timeout=3s --start-period=15s --retries=3 \
    CMD wget -q -O- http://localhost:3000/api/health || exit 1
CMD ["node", "server.js"]
