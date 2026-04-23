<div align="center">

![vohu — encrypted votes for verified humans](./public/og-image.png)

# vohu

**Encrypted votes for verified humans.**

A privacy-preserving voting Mini App for [World](https://world.org).
World ID guarantees one person, one vote.
Each ballot is encrypted on-device with an additive homomorphic cipher.
The server aggregates ciphertexts homomorphically — only the tally is ever
decrypted.

[Built for World Build 3, April 2026](https://worldbuildlabs.com) · [Live](https://vohu.vercel.app) · [Open in World App](https://world.org/mini-app?app_id=app_7ef7c4ad41af2d289fd9312a18bb8d68)

</div>

---

## The problem

Existing voting tools are stuck at a fork in the road:

| Tool | Sybil-resistant? | Ballot secret? | Tally trust-minimized? |
|---|---|---|---|
| Google Forms, SurveyMonkey, company HR polls | ❌ one person can vote a thousand times | ❌ the admin sees every vote | ❌ |
| On-chain DAO votes (Snapshot, Tally) | 🟡 by token, not by human | ❌ every vote on a public ledger forever | ❌ |
| World App's built-in Polls | ✅ World ID = one human | ❌ the server sees every vote | ❌ |
| **vohu** | ✅ **World ID 4.0 Orb + single-use nullifiers** | ✅ **Paillier ciphertext-only at rest** | ✅ **threshold Paillier — t-of-N trustees jointly decrypt the aggregate, no single party holds the full key** |

vohu is the first Mini App on World that gives you all three.

## How it feels

```
┌───────────────────────────┐     ┌───────────────────────────┐
│                           │     │                           │
│  🔒 Verify with World ID  │ →   │  ✓ HUMAN VERIFIED         │
│                           │     │                           │
│  Orb-level, anonymous     │     │  Should the World         │
│                           │     │  ecosystem prioritize     │
└───────────────────────────┘     │  privacy primitives?      │
                                  │                           │
                                  │  ○ Yes                    │
                                  │  ● Mixed                  │
                                  │  ○ No                     │
                                  │                           │
                                  │  [Cast encrypted vote]    │
                                  └───────────────────────────┘
                                                ↓
                                  ┌───────────────────────────┐
                                  │                           │
                                  │  Should the World …?      │
                                  │  7 verified humans voted  │
                                  │                           │
                                  │  Yes    ████████░░  4     │
                                  │  Mixed  ████░░░░░░  2     │
                                  │  No     ██░░░░░░░░  1     │
                                  │                           │
                                  │  ↓ Show what server sees  │
                                  │                           │
                                  │  🔒 [abc123…, def456…, …] │
                                  │  🔒 […]                   │
                                  └───────────────────────────┘
```

Three taps: verify, vote, reveal aggregate.

## How it works

```
┌──────────────────────────────────────────────────────────────┐
│  World App (WebView)                                         │
│  ┌────────────────────────────┐                              │
│  │ React / Next.js 16         │                              │
│  │                            │                              │
│  │  1. MiniKit.verify()       │  ──── Orb single-use ────→   │
│  │     └─ nullifier_hash      │        nullifier             │
│  │                            │                              │
│  │  2. GET /api/proposal      │  ←───  Paillier public key   │
│  │     └─ fetch pk            │                              │
│  │                            │                              │
│  │  3. Paillier.encrypt(vec)  │  ──── ciphertext vector ──→  │
│  │     └─ vec = [1,0,0]       │                              │
│  │       for 3-option ballot  │                              │
│  │                            │                              │
│  │  4. POST /api/vote         │                              │
│  │     { nullifier,           │                              │
│  │       ciphertextVec }      │                              │
│  └────────────────────────────┘                              │
└──────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
┌──────────────────────────────────────────────────────────────┐
│  Server (Next.js Route Handler)                              │
│  ┌────────────────────────────┐                              │
│  │  · reject if nullifier     │  ←── Sybil resistance        │
│  │    already seen            │                              │
│  │                            │                              │
│  │  · store ciphertextVec     │  ←── confidentiality         │
│  │    — never decrypted       │                              │
│  │                            │                              │
│  │  · GET /api/tally          │                              │
│  │    = homomorphic ∏         │  ←── additive HE             │
│  │    = AWAIT t-of-N trustees │       server cannot decrypt  │
│  │    = combine partials      │       alone                  │
│  │      → aggregate plaintext │                              │
│  └────────────────────────────┘                              │
│                                                              │
│  Trustees (2-of-3): each holds a polynomial share of λ.      │
│  Each signs a partial decryption of the aggregate            │
│  via POST /api/trustee/approve. Server combines the          │
│  partials via Lagrange interpolation — the aggregate's       │
│  plaintext falls out of the composition; the private key     │
│  is never reconstructed as a single object anywhere.         │
│                                                              │
│  Storage: Upstash Redis (Tokyo hnd1).                        │
└──────────────────────────────────────────────────────────────┘
```

### Four independent security properties

1. **Sybil resistance** — World ID 4.0 issues *single-use* nullifiers, one per (human × action). Re-submitting with the same nullifier is rejected server-side.
2. **Ballot confidentiality** — each ballot is a Paillier-encrypted vector. The server stores only ciphertexts and never computes a plaintext for any individual ballot.
3. **Homomorphic tally** — the aggregate is computed by multiplying ciphertexts (Paillier's homomorphic add). Only the sum ciphertext per option is decrypted; individual ballots stay encrypted forever.
4. **Threshold decryption (t-of-N trustees)** — the Paillier private key is split at proposal creation via polynomial secret sharing. The original λ is discarded; each of the N trustees holds a single share. Recovering the aggregate plaintext requires at least t trustees to each submit a partial decryption, which the server combines via Lagrange interpolation. **No single party — including the server — holds enough key material to decrypt any ciphertext alone.**

> Passkeys guard the front door.
> Paillier guards the ballot box.
> t-of-N trustees hold the keys to the box.

### Why Paillier, not a full FHE engine

For a 3-option secret ballot, aggregation is pure addition. Paillier's additive homomorphism gives us the "compute on encrypted data" property at a fraction of the engineering and runtime cost of a fully homomorphic cipher. Swapping in true FHE (e.g. [`tfhe-rs`](https://github.com/zama-ai/tfhe-rs)) becomes meaningful only when the tally logic grows beyond addition — e.g. ranked-choice, approval voting, or weighted delegation. That's v2.

### Trust assumption (v1, explicitly)

v1 ships with **threshold Paillier, t=2 of N=3 trustees** (`lib/threshold-paillier.ts`). At proposal creation time the key-generation routine splits λ via polynomial secret sharing and immediately discards the original λ, μ, and polynomial coefficients. The surviving state is:

- `threshold-public` — `{ n, g, threshold, totalParties, combiningTheta, delta }`, served to voters for encryption.
- `share:1`, `share:2`, `share:3` — the three trustee shares.

v1's **demo simplification** is that all three shares are co-located in the same Upstash Redis instance (not distributed to separate trustees). This is called out in code and in the UI — the server retrieves the requested share when a trustee hits `POST /api/trustee/approve` and computes the partial decryption on their behalf. The underlying cryptographic scheme is identical to production (Shoup-style partial decryption + Lagrange combine); only the key distribution path differs.

v2 distributes each share to a distinct trustee device; partial decryption happens client-side; the server never sees any share.

### Why Paillier, not a full FHE engine

For a 3-option secret ballot, aggregation is pure addition. Paillier's additive homomorphism gives us the "compute on encrypted data" property at a fraction of the engineering and runtime cost of a fully homomorphic cipher. Swapping in true FHE (e.g. [`tfhe-rs`](https://github.com/zama-ai/tfhe-rs)) becomes meaningful only when the tally logic grows beyond addition — e.g. ranked-choice, approval voting, or weighted delegation. That's v2 via the [`plat`](https://gitlab.com/Ryujiyasu/plat) crate.

## prome — "ciphertext outside, ballot inside"

When vohu is opened in **Chrome, Safari, or any browser that isn't World App**, `/vote` and `/result/*` deliberately render as a wall of civic-stamp-green ciphertext with a prompt to open the app in World App.

This demonstrates the thesis — *the ballot is invisible to anything that isn't a verified human* — without requiring the reader to install anything. It's also the cleanest possible judge-facing demo: same URL, two devices, two completely different experiences.

See [`lib/prome.ts`](./lib/prome.ts) and [`components/ObfuscatedScreen.tsx`](./components/ObfuscatedScreen.tsx).

## Stack

| Layer | What | Where |
|---|---|---|
| Identity | World ID 4.0: Orb verification, single-use nullifiers | [`@worldcoin/minikit-js`](https://www.npmjs.com/package/@worldcoin/minikit-js) (1.11) |
| Ballot encryption | Paillier additive HE (2048-bit) | [`paillier-bigint`](https://www.npmjs.com/package/paillier-bigint) (3.4) |
| Persistence | Upstash Redis via Vercel Marketplace | [`@upstash/redis`](https://www.npmjs.com/package/@upstash/redis) |
| UI | Next.js 16 App Router, Tailwind v4, Turbopack | this repo |
| Deployment | Vercel | [vohu.vercel.app](https://vohu.vercel.app) |

## Routes

| Route | Purpose |
|---|---|
| `/` | World ID sign-in entry. Shows the verify button. |
| `/vote` | Present a ballot; Paillier-encrypt and submit. |
| `/result/[proposalId]` | Aggregate result. Shows trustee-approval progress, or decrypted tally once t-of-N approvals are in. |
| `/trustee?p=<id>&i=<index>` | Trustee-facing approval screen. Contributes one partial decryption. |
| `/hyde-probe` | Sanity check that hyde-wasm loads and roundtrips in the browser (v2 preflight). |
| `GET /api/proposal?proposalId=…` | Proposal metadata + Paillier public key + threshold params. |
| `POST /api/vote` | Ciphertext-only ingest, nullifier-deduplicated. |
| `GET /api/tally?proposalId=…` | Homomorphic aggregate + combine of submitted partials. Returns `revealed: false` until threshold trustees approve. |
| `POST /api/trustee/approve` | One trustee submits their partial decryption of the current aggregate. |

## Running locally

```bash
pnpm install
pnpm dev
# open http://localhost:3000
```

Required environment variables (`.env.local`):

```bash
NEXT_PUBLIC_APP_ID=app_xxxxxxxxxxxxx
NEXT_PUBLIC_ACTION_ID=rp_xxxxxxxxxxxxx

# Optional — if unset, the store falls back to an in-memory Map (dev-only).
# vohu supports both Upstash-native and Vercel-KV naming.
KV_REST_API_URL=https://<your-upstash>.upstash.io
KV_REST_API_TOKEN=...

# Required for server-side WorldID operations (v2 uses this for signed
# attestations).
WORLDCOIN_SIGNER_ADDRESS=0x...
WORLDCOIN_SIGNER_PRIVATE_KEY=0x...
```

To test the Mini App flow inside World App, expose the dev server via a stable
HTTPS URL (ngrok static domain or a Vercel preview deployment) and set that
URL as the **App URL** in the World Developer Portal.

## Project layout

```
vohu/
├── app/
│   ├── page.tsx                       · / — verify entry
│   ├── vote/page.tsx                  · /vote (Paillier encrypt)
│   ├── result/[proposalId]/page.tsx   · /result/:id (aggregate + trustee-approval state)
│   ├── trustee/page.tsx               · /trustee (trustee partial-decrypt UI)
│   ├── api/
│   │   ├── proposal/route.ts          · GET proposal + pub key + threshold params
│   │   ├── vote/route.ts              · POST ciphertextVec, dedup nullifier
│   │   ├── tally/route.ts             · GET homomorphic aggregate + combine partials if t reached
│   │   └── trustee/approve/route.ts   · POST one trustee's partial decryption
│   ├── hyde-probe/page.tsx            · hyde-wasm preflight
│   ├── providers.tsx                  · MiniKit bootstrap
│   └── layout.tsx                     · metadata + OG card
├── components/
│   └── ObfuscatedScreen.tsx           · prome gating UI
├── lib/
│   ├── tally.ts                       · Paillier primitives (encrypt / agg / types)
│   ├── threshold-paillier.ts          · Shamir share λ + partialDecrypt + Lagrange combine
│   ├── keys.ts                        · per-proposal threshold keygen + persistence
│   ├── partials.ts                    · per-trustee partial-decryption store
│   ├── proposal.ts                    · proposal registry (v1: single demo)
│   ├── store.ts                       · Redis-backed ballot store
│   ├── hyde.ts                        · hyde-wasm wrapper (for /hyde-probe)
│   └── prome.ts                       · World App detection + obfuscate
├── scripts/
│   ├── tally-test.mjs                 · end-to-end threshold tally correctness check
│   ├── threshold-paillier-test.mjs    · pure-math unit tests
│   ├── clear-proposal.mjs             · Redis cleanup when schema changes
│   └── inspect-redis.mjs              · dump keys / partials for diagnostics
├── vendor/hyde-wasm/                  · pre-built hyde-wasm artifacts (vendored)
└── public/
    ├── icon.png                       · app icon (civic seal)
    └── og-image.png                   · Open Graph / Twitter card
```

## Threat model (v1)

| Adversary | What they can do | What they cannot do |
|---|---|---|
| Curious server operator | See the stream of ciphertexts + nullifiers, enforce deduplication, observe that a vote happened | Decrypt any ciphertext — the server does not hold the tally private key; t trustees must cooperate |
| Malicious server operator (v1 demo co-location only) | Read the co-located trustee shares out of Redis | Compromise a production deployment where shares live on distinct trustee devices (v2 roadmap) |
| Colluding t−1 trustees | See their own shares and the partial decryptions of the other trustees | Recover the aggregate plaintext — the threshold polynomial requires at least t partials |
| Network observer | See TLS-wrapped ciphertext going to the server | See plaintexts |
| AI scraping crawler | Fetch SSR HTML | See the ballot content (obfuscated by prome) |
| Future quantum adversary | Break Paillier (RSA-like assumption, vulnerable to Shor's algorithm) | — |

Known v1 limits, called out explicitly:

- **Share distribution is co-located** (demo). All three trustee shares live in the same Upstash Redis instance. The cryptographic scheme is threshold Paillier, but the operational deployment model is single-operator. v2 distributes shares to N distinct trustee devices at proposal creation.
- **Malicious-trustee verifiability**: a trustee could submit a garbage partial decryption; the server cannot detect this yet. v2 adds zero-knowledge proofs per partial (verification keys published at keygen time).
- **Post-quantum**: Paillier is RSA-class and therefore NOT post-quantum. A quantum-equipped adversary with a future archive of ciphertexts could decrypt today's ballots. Mitigation: short proposal lifetimes + v2 migration to lattice-based HE via `plat`.
- **Proposal registry**: v1 ships with a single hard-coded demo proposal. Dynamic proposals are v2.
- **Non-transferable receipts**: receipts are not cryptographically device-bound yet. v2 adds hyde+MiniKit `signMessage` composition.

## What's next

- **Distributed share delivery + verifiable partial decryption** — each trustee's share lives on their own device (TPM / paper key / USB); partials include zero-knowledge proofs so the combine step can detect a misbehaving trustee.
- **Post-quantum homomorphic tally** — migrate from Paillier to a lattice-based HE primitive (BGV / BFV / TFHE) once the tally surface expands beyond addition. See the [`plat`](https://gitlab.com/Ryujiyasu/plat) crate.
- **Non-transferable receipts** — combine hyde's ML-KEM-768 ciphertext with a MiniKit `signMessage` challenge so a receipt is bound to the Secure Enclave of the device that cast the vote. A coerced user can hand over the ciphertext; the coercer's device will never decrypt it. See `/hyde-probe`.
- **FHE-side tally** — replace mock-decrypt aggregation with a homomorphic tally served from a trusted FHE worker.
- **Proposal registry** — create and publish proposals without rebuilding the client.
- **XMTP group scoping** — restrict a poll's eligible voters to members of a specific World Chat group, using XMTP MLS group membership as the scoping layer. The "chat-scoped governance vote" use case.
- **[`hyde-webauthn`](https://gitlab.com/Ryujiyasu/hyde-webauthn)** companion — same crypto ecosystem, exposed as a Linux FIDO2/WebAuthn authenticator so Linux users can use Google and other WebAuthn sites without a security key.

## Related repos

- [`hyde`](https://gitlab.com/Ryujiyasu/hyde) — TPM-bound PQC primitives (ML-KEM-768, AES-GCM), published on [crates.io](https://crates.io/crates/hyde). Used by `/hyde-probe` and planned for v2 non-transferable receipts.
- [`janus`](https://gitlab.com/Ryujiyasu/janus) — cross-platform person-binding trait layer (presence assertion via biometrics / PIN / FIDO2).
- [`hyde-webauthn`](https://gitlab.com/Ryujiyasu/hyde-webauthn) — virtual FIDO2 authenticator for Linux.
- [`argo`](https://gitlab.com/Ryujiyasu/argo) — zero-knowledge proof crate (vohu's future proof layer).
- [`plat`](https://gitlab.com/Ryujiyasu/plat) — FHE / GPU-accelerated private computation (vohu's future tally layer).

## Credits

Built by [Ryuji Yasukochi](https://github.com/Ryujiyasu) (CTO, [M2Labo](https://m2labo.co.jp)) during the World Build 3 online hackathon, April 2026.

Thanks to the Tools for Humanity team for World ID 4.0 and the MiniKit SDK, and to the privacy research community whose decades of work on secret ballots (Helios, Civitas, selene) and homomorphic encryption (Paillier, Gentry, Zama) is what makes a project like this buildable in a weekend.

## License

MIT. See [LICENSE](./LICENSE).
