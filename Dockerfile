# vohu — self-hosted container image.
#
# Three-stage build:
#   1. deps   — pnpm-install with a pinned lockfile, no dev dep install at this layer
#   2. build  — compile Next.js, Turbopack, tailwind etc.; emit .next/standalone
#   3. run    — minimal runtime image with the standalone output + vendor/hyde-wasm
#
# The resulting image runs `node server.js` inside a non-root user and
# listens on $PORT (default 3000). Paired with docker-compose.yml (which
# supplies a real Redis) or a managed Upstash DB.

# -----------------------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10 --activate
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Public envs get baked into the client bundle at build time. Supply them
# via --build-arg in docker-compose / CI.
ARG NEXT_PUBLIC_APP_ID
ARG NEXT_PUBLIC_ACTION_ID
ARG NEXT_PUBLIC_RP_ID
ENV NEXT_PUBLIC_APP_ID=$NEXT_PUBLIC_APP_ID
ENV NEXT_PUBLIC_ACTION_ID=$NEXT_PUBLIC_ACTION_ID
ENV NEXT_PUBLIC_RP_ID=$NEXT_PUBLIC_RP_ID

RUN pnpm build

# -----------------------------------------------------------------------------
FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -S vohu && adduser -S -G vohu vohu

# Next.js standalone bundle: includes only the modules actually reachable
# from the app, with a generated server.js entry.
COPY --from=build --chown=vohu:vohu /app/.next/standalone ./
COPY --from=build --chown=vohu:vohu /app/.next/static ./.next/static
COPY --from=build --chown=vohu:vohu /app/public ./public
COPY --from=build --chown=vohu:vohu /app/vendor ./vendor

USER vohu
EXPOSE 3000
CMD ["node", "server.js"]
