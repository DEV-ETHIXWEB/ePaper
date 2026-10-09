# syntax=docker/dockerfile:1

# Debian rather than Alpine. better-sqlite3, sharp and @napi-rs/canvas all ship
# prebuilt binaries against glibc; on musl they are compiled from source at
# install time, which needs a toolchain and often fails on arm.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml* ./
RUN --mount=type=cache,target=/pnpm-store \
    pnpm config set store-dir /pnpm-store && pnpm install --frozen-lockfile

FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# The build runs schema.sql through better-sqlite3 for typing, so give it a
# scratch database rather than letting it touch a mounted volume.
ENV DATABASE_PATH=/tmp/build.db
RUN pnpm build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Fonts for the PDF renderer. Without these, pdfjs falls back to a default
# face and Gurmukhi pages render as boxes.
RUN apt-get update \
 && apt-get install -y --no-install-recommends fonts-noto fonts-noto-core ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# Read at runtime by the migration step, so it has to be in the image.
COPY --from=build /app/src/lib/db/schema.sql ./src/lib/db/schema.sql
# Native modules are external to the bundle and are required normally.
COPY --from=build /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=build /app/node_modules/sharp ./node_modules/sharp
COPY --from=build /app/node_modules/@napi-rs ./node_modules/@napi-rs
COPY --from=build /app/node_modules/pdfjs-dist ./node_modules/pdfjs-dist
COPY --from=build /app/node_modules/tesseract.js ./node_modules/tesseract.js
COPY --from=build /app/node_modules/tesseract.js-core ./node_modules/tesseract.js-core

# The database, the rendered pages and the Tesseract models all live here, so
# this is the one path that must be a persistent volume.
VOLUME /app/data
ENV DATABASE_PATH=/app/data/epaper.db
ENV LOCAL_STORAGE_DIR=/app/data/storage

EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
