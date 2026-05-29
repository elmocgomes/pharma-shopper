FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

FROM base AS build
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/api/tsconfig.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/shared/tsconfig.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY packages/db/tsconfig.json ./packages/db/
COPY packages/wa-client/package.json ./packages/wa-client/
COPY packages/wa-client/tsconfig.json ./packages/wa-client/
RUN pnpm install --frozen-lockfile
COPY packages/shared/src ./packages/shared/src
COPY packages/db/src ./packages/db/src
COPY packages/wa-client/src ./packages/wa-client/src
COPY apps/api/src ./apps/api/src
RUN pnpm --filter @pharma-shopper/shared build && \
    pnpm --filter @pharma-shopper/db build && \
    pnpm --filter @pharma-shopper/wa-client build && \
    pnpm --filter @pharma-shopper/api build

FROM base AS runner
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/packages/db/dist ./packages/db/dist
COPY --from=build /app/packages/db/package.json ./packages/db/
COPY --from=build /app/packages/wa-client/dist ./packages/wa-client/dist
COPY --from=build /app/packages/wa-client/package.json ./packages/wa-client/
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/pnpm-workspace.yaml ./
WORKDIR /app/apps/api
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "dist/main.js"]
