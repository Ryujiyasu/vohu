# Self-host deployment

vohu is designed to run on Vercel (its reference deployment), but nothing in the code is Vercel-specific. This document covers the self-hosted path via Docker Compose.

Two deployment profiles:

- **Solo operator (v1 default)** — one host runs the Next.js app + a local Redis. All threshold trustee shares live on the same host. Fastest to stand up; not a production trust model. This is the profile `docker-compose.yml` implements.
- **Distributed trustees (v2 target)** — each of the N trustee shares lives on a distinct host. Partial decryption is performed client-side at each trustee and submitted via the same `POST /api/trustee/approve` API. The web service becomes a coordinator rather than a key holder. See the v2 roadmap in [../README.md](../README.md#versioned-roadmap).

This guide covers the solo-operator profile. Moving to distributed trustees is additive: the cryptography is identical, only share distribution changes.

## Prerequisites

- Docker 24+ with `docker compose` (Compose v2 syntax)
- A World Developer Portal app (https://developer.worldcoin.org)
  - `NEXT_PUBLIC_APP_ID` — e.g. `app_xxxxxxxxxxxxxxxx`
  - `NEXT_PUBLIC_ACTION_ID` — an Incognito Action identifier (dashes only; underscores are rejected by the portal)
  - `NEXT_PUBLIC_RP_ID` — visible on the **World ID 4.0** tab after enabling v4 (`rp_xxxxxxxxxxxxxxxx`)
  - `WORLDCOIN_SIGNER_PRIVATE_KEY` — the ECDSA signing key for RP signatures (shown once under **Reset signer key** on the same tab)

## Quick start

```bash
cp .env.example .env
$EDITOR .env                            # fill in the five Developer Portal values
docker compose up --build -d
docker compose logs -f web              # watch the Next.js boot
```

Browse to <http://localhost:3000>. The Dashboard should render with all tiles locked. Clicking **Login** inside World App triggers MiniKit; from Chrome it fetches `/api/rp-signature` and opens the IDKit QR widget.

Smoke-test the API layer without MiniKit:

```bash
curl -sf "http://localhost:3000/api/proposal?proposalId=demo-2026-04" | jq .
```

## What the compose stack does

```
┌──────────┐  HTTP     ┌──────────────┐  Redis    ┌─────────┐
│   web    │ ────────▶ │  redis-http  │ ────────▶ │  redis  │
│ next.js  │  (port 80)│ (Upstash-API │ (port     │ (7-     │
│ Node 22  │           │  bridge)     │  6379)    │  alpine)│
└──────────┘           └──────────────┘           └─────────┘
      ▲                                                │
      │   docker volume `redis-data`  ◀────────────────┘
      │   persists ballots, partials, shares
  host:3000
```

- **`web`** — the Next.js app, built from the repo's [Dockerfile](../Dockerfile). Runs as a non-root user, listens on `$PORT` (default 3000), and serves every route — including the API handlers — from the same Node process. The `.next/standalone` output keeps the image under ~250 MB.
- **`redis-http`** — [hiett/serverless-redis-http](https://github.com/hiett/serverless-redis-http), a tiny Go service that exposes an Upstash-compatible REST API in front of a plain Redis. `lib/store.ts` only speaks Upstash REST, so this bridge avoids any code changes when running a local Redis.
- **`redis`** — `redis:7-alpine` with AOF persistence + periodic snapshots. Stores proposals, ballots, Paillier threshold shares, and trustee partials.

## Trust model of the self-hosted profile

Keep in mind what a solo operator can and cannot see:

| Role | Can read | Cannot compute |
|---|---|---|
| Operator of this host | Every ciphertext, every nullifier, the co-located trustee shares | The private λ (it was destroyed at keygen and never reconstructed as a single object); individual ballot plaintexts — decryption still requires combining t partials |
| Network observer on port 3000 | TLS-wrapped traffic (terminate TLS at a reverse proxy — see below) | Plaintexts, even with a key to Redis |

The threshold cryptography still holds — a malicious operator who reads all three shares can only recover the aggregate plaintext (which is public after a vote closes) — but they can skip the t-of-N cooperation step. For deployments where that matters (public elections, high-stakes governance), move to the distributed-trustees profile.

## Putting TLS in front

The compose stack binds `0.0.0.0:3000` but does no TLS. In any public deployment, terminate TLS at a reverse proxy and forward to `web:3000`. Two common shapes:

- **Caddy** — drop a `Caddyfile` next to `docker-compose.yml`, add a `caddy` service, expose `:443`, and declare `vohu.example.com { reverse_proxy web:3000 }`. Caddy handles the ACME dance.
- **Cloudflare Tunnel** — no open ports on your host; `cloudflared` connects outbound to Cloudflare and routes `vohu.example.com` to `http://web:3000`.

World App's MiniKit requires a stable HTTPS URL with valid certs. HTTP-only deployments work for API smoke tests but will not complete the Mini App runtime handshake.

## Rotating keys

- **Paillier threshold keypair** is per-proposal. Discard the Redis keys for a proposal (`proposal:<id>:*`) to force fresh keygen on next access.
- **RP signing key** rotates via the Developer Portal **Reset signer key** button. Update `.env` and `docker compose up -d --no-deps web` to re-bake the public envs.

## Common troubleshooting

- **`/login` in Chrome shows "request not found"** — the IDKit bridge couldn't look up the request World App scanned. Check `NEXT_PUBLIC_RP_ID` matches the Developer Portal RP ID exactly, and that `WORLDCOIN_SIGNER_PRIVATE_KEY` is the key whose public half is registered there.
- **`/api/proposal` returns 500 with a Redis error** — the `web` container couldn't reach `redis-http:80`. Confirm the service is healthy: `docker compose ps` and `docker compose logs redis-http`.
- **Static assets 404** — `/public` and `/.next/static` are both copied into the runtime image but must not be excluded by `.dockerignore`. The provided `.dockerignore` only drops build artefacts.

## Production hardening checklist

- [ ] Replace `hiett/serverless-redis-http` + local Redis with a managed Upstash or Redis Enterprise instance with TLS and ACLs.
- [ ] Move trustee shares out of the primary Redis to per-trustee devices (v2).
- [ ] Put the compose stack behind a reverse proxy with TLS, HSTS, and rate limits on `/api/vote` and `/api/rp-signature`.
- [ ] Pin image digests (`redis@sha256:…`) for supply-chain reproducibility.
- [ ] Back up the Redis volume with a tool that preserves AOF consistency (e.g. `redis-cli --rdb` before snapshotting the disk).
- [ ] Monitor nullifier dedup 409s and trustee-approve error rates; they are the first signals of replay attempts or a broken partial-decryption pipeline.
