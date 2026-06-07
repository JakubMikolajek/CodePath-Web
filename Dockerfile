FROM oven/bun:1.3.13 AS base

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

FROM base AS pruner

COPY . .

RUN bunx turbo prune web api --docker

FROM base AS installer

COPY --from=pruner /app/out/json/ ./

RUN bun install

COPY --from=pruner /app/out/full/ ./

FROM installer AS builder

ARG INTERNAL_API_BASE_URL=http://codepath-web-api:3001

ENV INTERNAL_API_BASE_URL=${INTERNAL_API_BASE_URL}

RUN bunx turbo run build

FROM builder AS api-build

FROM builder AS web-build

FROM oven/bun:1.3.13 AS api-runtime

WORKDIR /app

ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends git openssh-client ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=installer /app ./
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/codepath-common/dist ./packages/codepath-common/dist

EXPOSE 3001

CMD ["bun", "apps/api/dist/main.js"]

FROM oven/bun:1.3.13 AS web-runtime

WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

EXPOSE 3000

CMD ["bun", "apps/web/server.js"]
