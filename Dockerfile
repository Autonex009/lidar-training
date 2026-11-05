# Runs the LiDAR training portal with SQLite + local point-cloud caches on a persistent volume.
# Build context = repository root (project-configs/ must be present next to app/).
FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /srv
COPY project-configs ./project-configs
COPY app ./app

WORKDIR /srv/app
# Dev dependencies stay installed: prisma CLI and tsx are needed at runtime for migrate/seed.
RUN npm ci
# Build needs a DATABASE_URL for Prisma client generation only; no database is touched.
RUN DATABASE_URL="file:/tmp/build.db" AUTH_SECRET="build-only" AUTH_TRUST_HOST=true npm run build

ENV NODE_ENV=production \
    DATABASE_URL="file:/data/portal.db" \
    ASSETS_DIR="/data/assets" \
    AUTH_TRUST_HOST=true \
    PORT=3000
VOLUME ["/data"]
EXPOSE 3000
CMD ["sh", "./start.sh"]
