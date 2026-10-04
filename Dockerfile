# syntax=docker/dockerfile:1

# ---- Stage 1: build the React frontend ----
FROM node:22-bookworm-slim AS frontend-build
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- Stage 2: runtime (Express API + built UI, SQLite on a volume) ----
FROM node:22-bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend
ENV NODE_ENV=production \
    PORT=4000 \
    DATABASE_URL=file:/data/app.db

# Dependency files first for layer caching (prisma CLI is needed at start to create the schema)
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npx prisma generate

COPY --from=frontend-build /build/dist /app/frontend/dist

# Non-root user; /data holds the SQLite file
RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME /data
EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Create/upgrade the schema, seed sample events on first run, then start (exec so SIGTERM reaches node)
CMD ["sh", "-c", "npx prisma db push --skip-generate && node prisma/seed.js && exec node src/server.js"]
