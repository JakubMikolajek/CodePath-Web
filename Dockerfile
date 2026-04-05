FROM node:22-bookworm-slim AS base

WORKDIR /app

COPY . .

RUN npm install

FROM base AS api-build
RUN npm run --workspace apps/api build

FROM node:22-bookworm-slim AS api-runtime
WORKDIR /app
COPY --from=api-build /app /app
EXPOSE 3001
CMD ["npm", "run", "--workspace", "apps/api", "start:prod"]

FROM base AS web-build
RUN npm run --workspace apps/web build -- --webpack

FROM node:22-bookworm-slim AS web-runtime
WORKDIR /app
COPY --from=web-build /app /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
EXPOSE 3000
CMD ["npm", "run", "--workspace", "apps/web", "start", "--", "-H", "0.0.0.0", "-p", "3000"]
