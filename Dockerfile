FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build:node

FROM node:24-bookworm-slim
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8787 \
    DATABASE_PATH=/app/runtime/torob.sqlite
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 gosu \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY --from=build /app/dist/client ./dist/client
COPY --from=build /app/server ./server
COPY --from=build /app/src ./src
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/scripts/seed_sqlite.py ./scripts/seed_sqlite.py
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN mkdir -p public runtime \
    && ln -s ../dist/client/data public/data \
    && chown node:node runtime
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=10s --start-period=180s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/api/health').then(r=>r.json()).then(x=>process.exit(x.ok&&x.catalogueReady?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/bin/sh", "/app/docker-entrypoint.sh"]
