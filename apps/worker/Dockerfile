FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @pharma-shopper/shared build && \
    pnpm --filter @pharma-shopper/db build && \
    pnpm --filter @pharma-shopper/wa-client build && \
    pnpm --filter @pharma-shopper/ai build && \
    pnpm --filter @pharma-shopper/worker build

FROM base AS runner
COPY --from=build /app/apps/worker/dist ./apps/worker/dist
COPY --from=build /app/apps/worker/package.json ./apps/worker/
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/packages/db/dist ./packages/db/dist
COPY --from=build /app/packages/db/package.json ./packages/db/
COPY --from=build /app/packages/wa-client/dist ./packages/wa-client/dist
COPY --from=build /app/packages/wa-client/package.json ./packages/wa-client/
COPY --from=build /app/packages/ai/dist ./packages/ai/dist
COPY --from=build /app/packages/ai/package.json ./packages/ai/
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/pnpm-workspace.yaml ./
WORKDIR /app/apps/worker
CMD ["node", "dist/main.js"]
