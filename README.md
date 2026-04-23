<div align="center">

![vohu — encrypted votes for verified humans](./public/og-image.png)

# vohu

**Encrypted votes for verified humans.**

A privacy-preserving voting Mini App for [World](https://world.org).
World ID guarantees one person, one vote.
hyde encrypts the ballot end-to-end on your device.
Nobody — not even the organizer — can see who voted for what.

[Built for World Build 3, 2026](https://worldbuildlabs.com) · [Live demo](https://vohu.vercel.app) · [Open in World App](https://world.org/mini-app?app_id=app_7ef7c4ad41af2d289fd9312a18bb8d68)

</div>

---

## The problem

Existing voting tools are stuck at a fork in the road:

| Tool | Sybil-resistant? | Ballot secret? |
|---|---|---|
| Google Forms, SurveyMonkey, company HR polls | ❌ one person can vote a thousand times | ❌ the admin sees every vote |
| On-chain DAO votes (Snapshot, Tally) | 🟡 by token, not by human | ❌ every vote on a public ledger forever |
| World App's built-in "Polls" | ✅ World ID = one human | ❌ the server sees every vote |
| **vohu** | ✅ **World ID 4.0 + Orb + single-use nullifiers** | ✅ **hyde ML-KEM-768 end-to-end** |

vohu is the first Mini App on World that gives you both.

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
                                  │  ○ Yes — foundational     │
                                  │  ● Mixed — case by case   │
                                  │  ○ No — growth first      │
                                  │                           │
                                  │  [Cast encrypted vote]    │
                                  └───────────────────────────┘
                                                ↓
                                  ┌───────────────────────────┐
                                  │                           │
                                  │  Encrypted ballots        │
                                  │  3 verified humans voted  │
                                  │                           │
                                  │  🔒 gAAAAABkS6… (opaque)   │
                                  │  🔒 gAAAAABkT1… (opaque)  │
                                  │  🔒 gAAAAABkU8… (opaque)  │
                                  │                           │
                                  │  [Reveal aggregate ▸]     │
                                  └───────────────────────────┘
```

Three taps: verify, vote, reveal.

## How it works

```
┌──────────────────────────────────────────────────────────────┐
│  World App (WebView)                                         │
│  ┌────────────────────────────┐                              │
│  │ React / Next.js 16         │                              │
│  │                            │                              │
│  │  1. MiniKit.verify()       │  ──── Orb single-use ────→   │
│  │     └─ nullifier_hash      │        nullifier            │
│  │                            │                              │
│  │  2. hyde-wasm.protect()    │ ◄───  ML-KEM-768 ciphertext │
│  │     └─ ML-KEM-768 PQC      │        (post-quantum)        │
│  │                            │                              │
│  │  3. POST /api/vote         │  ──── ciphertext ────→       │
│  │     { nullifier,           │                              │
│  │       ciphertext }         │                              │
│  └────────────────────────────┘                              │
└──────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
┌──────────────────────────────────────────────────────────────┐
│  Server                                                      │
│  ┌────────────────────────────┐                              │
│  │ Next.js API route          │                              │
│  │                            │                              │
│  │  · reject if nullifier     │  ←── Sybil resistance        │
│  │    already seen            │                              │
│  │                            │                              │
│  │  · store ciphertext only   │  ←── confidentiality         │
│  │    (never sees plaintext)  │                              │
│  └────────────────────────────┘                              │
└──────────────────────────────────────────────────────────────┘
```

**Three independent security properties:**

1. **Sybil resistance** — World ID 4.0 issues *single-use* nullifiers, one per (human × action). Re-submitting with the same nullifier is rejected server-side.
2. **Ballot secrecy** — each ballot is encrypted with ML-KEM-768 (post-quantum KEM) *before* it leaves the device. The server stores ciphertext only and cannot decrypt it.
3. **Post-quantum** — the ballot secret survives a future quantum adversary. Passkeys use ECDSA/P-256 which does not.

> Passkeys guard the front door.  
> hyde guards the ballot box.

## prome — "ciphertext outside, ballot inside"

When vohu is opened in **Chrome, Safari, or any browser that isn't World App**, the `/vote` and `/result/*` pages deliberately render as a wall of civic-stamp-green ciphertext with a prompt to open in World App.

This demonstrates the app's thesis — *the ballot is invisible to anything that isn't a verified human* — without requiring the reader to install anything. It's also the cleanest possible demo for judges: same URL, two devices, two completely different experiences.

See [`lib/prome.ts`](./lib/prome.ts) and [`components/ObfuscatedScreen.tsx`](./components/ObfuscatedScreen.tsx).

## Stack

| Layer | Why | Where |
|---|---|---|
| Identity | World ID 4.0: Orb verification, single-use nullifiers | [`@worldcoin/minikit-js`](https://www.npmjs.com/package/@worldcoin/minikit-js) (1.11) |
| Post-quantum encryption | ML-KEM-768 via hyde's software backend, compiled to WASM | [`hyde`](https://gitlab.com/Ryujiyasu/hyde) (this author's OSS) |
| Person-binding | Trait-based presence/verification abstraction shared with hyde | [`janus`](https://gitlab.com/Ryujiyasu/janus) (this author's OSS) |
| UI | Next.js 16 App Router, Tailwind v4, Turbopack | this repo |
| Deployment | Vercel | this repo |

## Routes

| Route | Purpose |
|---|---|
| `/` | World ID sign-in entry point. Shows the verify button. |
| `/vote` | Present a ballot; encrypt and submit a ballot. |
| `/result/[proposalId]` | Aggregate result page with a ciphertext preview. |
| `/hyde-probe` | Sanity check that hyde-wasm loads and roundtrips in the browser. |
| `/api/vote` | Ciphertext-only ingest endpoint. Nullifier-deduplicated. |

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
WORLDCOIN_SIGNER_ADDRESS=0x...
WORLDCOIN_SIGNER_PRIVATE_KEY=0x...
```

To test the Mini App flow inside World App, expose the dev server via a stable
HTTPS URL (ngrok static domain, Cloudflare Tunnel, or a Vercel preview
deployment) and set that URL as the **App URL** in the World Developer Portal.

## Project layout

```
vohu/
├── app/
│   ├── page.tsx                 · / — verify entry
│   ├── vote/page.tsx            · /vote
│   ├── result/[proposalId]/     · /result/:id
│   ├── api/vote/route.ts        · POST ciphertext / GET aggregate
│   ├── hyde-probe/page.tsx      · hyde-wasm preflight
│   ├── providers.tsx            · MiniKit bootstrap
│   └── layout.tsx               · metadata + OG card
├── components/
│   └── ObfuscatedScreen.tsx     · prome gating UI
├── lib/
│   ├── hyde.ts                  · hyde-wasm wrapper
│   └── prome.ts                 · MiniKit-installed detection + obfuscate
├── vendor/hyde-wasm/            · pre-built hyde-wasm (pinned into the repo)
└── public/
    ├── icon.png                 · app icon (mitsudomoe / civic seal)
    └── og-image.png             · Open Graph / Twitter card
```

## Threat model (v1)

| Adversary | What they can do | What they cannot do |
|---|---|---|
| Curious server operator | See the stream of ciphertexts + nullifiers, enforce deduplication, observe that a vote happened | See any plaintext ballot |
| Network observer | See TLS-wrapped ciphertext going to the server | See plaintexts; link ballots to identities beyond what the nullifier reveals |
| AI scraping crawler | Fetch the app's SSR HTML | See the ballot content (obfuscated by prome) |
| Coercer demanding a receipt | Ask the user to show their vote | Verify the receipt corresponds to a real vote (v2: TPM/Secure-Enclave-bound receipt) |
| Future quantum adversary | Break ECDSA/P-256 | Break ML-KEM-768 — that's the point |

Known v1 limits:

- The in-memory `/api/vote` store is ephemeral and resets on server restart. Intentional for the demo; production would use a durable store with the same ciphertext-only invariant.
- The ballot description, option set, and encryption public key are currently fixed per build. A production deployment would load these from a proposal-registry the RP trusts.
- Non-transferable receipts (hyde + MiniKit `signMessage` composition) are on the roadmap; v1 receipts are ciphertext only.

## What's next

- **Non-transferable receipts** — combine hyde's ML-KEM-768 ciphertext with a MiniKit `signMessage` challenge so the receipt is bound to the Secure Enclave of the device that cast the vote. A coerced user can hand over the ciphertext; the coercer's device will never decrypt it.
- **FHE-side tally** — replace the client-side "mock decrypt" aggregation with a homomorphic tally served from a trusted FHE worker (the [`plat`](https://gitlab.com/Ryujiyasu/plat) crate).
- **Proposal registry** — a Mini App operator can create and publish proposals without rebuilding the client.
- **[`hyde-webauthn`](https://gitlab.com/Ryujiyasu/hyde-webauthn)** companion — same crypto stack, exposed as a Linux FIDO2/WebAuthn authenticator so users on Linux can use Google and other WebAuthn sites without buying a security key.

## Related repos

- [`hyde`](https://gitlab.com/Ryujiyasu/hyde) — TPM-bound PQC primitives (ML-KEM-768, AES-GCM), published on [crates.io](https://crates.io/crates/hyde). vohu uses its `hyde-software` backend compiled to WASM.
- [`janus`](https://gitlab.com/Ryujiyasu/janus) — cross-platform person-binding trait layer (presence assertion via biometrics / PIN / FIDO2).
- [`hyde-webauthn`](https://gitlab.com/Ryujiyasu/hyde-webauthn) — virtual FIDO2 authenticator for Linux, built on hyde + janus. Lets any Linux machine be a passkey for Google without buying a YubiKey.
- [`argo`](https://gitlab.com/Ryujiyasu/argo) — zero-knowledge proof crate (vohu's future proof layer).
- [`plat`](https://gitlab.com/Ryujiyasu/plat) — FHE / GPU-accelerated private computation (vohu's future tally layer).

## Credits

Built by [Ryuji Yasukochi](https://github.com/Ryujiyasu) (CTO, [M2Labo](https://m2labo.co.jp)) during the World Build 3 online hackathon, April 2026.

Thanks to the Tools for Humanity team for World ID 4.0 and the MiniKit SDK,
to the passkey-rs maintainers at 1Password for making a hackable
authenticator library, and to the privacy research community whose
decades of work on secret ballots, coercion resistance, and post-quantum
KEMs is what makes a project like this buildable in a weekend.

## License

MIT. See [LICENSE](./LICENSE).
