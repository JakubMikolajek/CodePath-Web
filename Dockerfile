FROM oven/bun:1.3.5 AS base

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY . .

RUN bun install

FROM base AS api-build
RUN bun run --cwd apps/api build

FROM oven/bun:1.3.5 AS api-runtime
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends git openssh-client ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=api-build /app /app
EXPOSE 3001
CMD ["bun", "run", "--cwd", "apps/api", "start:prod"]

FROM base AS web-build
ARG INTERNAL_API_BASE_URL=http://codepath-web-api:3001
ENV INTERNAL_API_BASE_URL=${INTERNAL_API_BASE_URL}
RUN bun run --cwd apps/web build -- --webpack

FROM oven/bun:1.3.5 AS web-runtime
WORKDIR /app
COPY --from=web-build /app /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
EXPOSE 3000
CMD ["bun", "run", "--cwd", "apps/web", "start", "--", "-H", "0.0.0.0", "-p", "3000"]
