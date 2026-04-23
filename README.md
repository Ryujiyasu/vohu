<div align="center">

![vohu — encrypted votes for verified humans](./public/og-image.png)

# vohu

**Encrypted votes for verified humans.**

A privacy-preserving voting Mini App for World. World ID guarantees one person, one vote. hyde encrypts the ballot end-to-end. Nobody — not even the organizer — can see who voted for what.

</div>

---

## Why vohu

Existing voting tools give you one or the other:

- **Sybil resistance** — but the server sees every vote (e.g. World App's Polls).
- **Ballot secrecy** — but anyone can spin up a thousand accounts.

vohu gives you both in one tap:

```
World ID 4.0  (passkeys)   →  "this is a verified human, and it's you"
  hyde        (ML-KEM-768) →  "and the ballot is sealed on this device"
```

> Passkeys guard the front door. hyde guards the ballot box.

## Stack

| Layer | What | Where |
|---|---|---|
| Identity | World ID 4.0 (Orb verification, single-use nullifiers) | [`@worldcoin/minikit-js`](https://www.npmjs.com/package/@worldcoin/minikit-js) |
| Ballot encryption | ML-KEM-768 (post-quantum) via hyde's software backend | [`hyde`](https://gitlab.com/Ryujiyasu/hyde) compiled to WASM |
| Presence / UV | janus person-binding layer | [`janus`](https://gitlab.com/Ryujiyasu/janus) |
| UI | Next.js 16 (App Router) + Tailwind | this repo |

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

To test as a Mini App inside World App, expose the dev server via a stable
HTTPS URL (ngrok static domain, Cloudflare Tunnel, or a Vercel preview
deployment) and set that URL as the **App URL** in the World Developer Portal.

## Routes

- `/` — World ID sign-in entry point.
- `/vote` — cast an encrypted ballot.
- `/result/[proposalId]` — aggregate result page (with ciphertext preview).
- `/hyde-probe` — sanity check that hyde-wasm loads and roundtrips in the browser.
- `/api/vote` — ciphertext ingest endpoint (nullifier-deduplicated).

## prome gating

When vohu is opened in **any browser other than World App**, the ballot and
result pages render as an obfuscated, civic-stamp-green wall of ciphertext
with a prompt to open the app in World App. This demonstrates the app's core
premise — *the ballot is invisible to anything that isn't a verified human* —
without requiring the reader to install anything.

## License

MIT.
