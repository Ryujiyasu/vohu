# vohu — World Build 3 submission kit

Everything needed to fill the submission form and record the demo. Every block below is written to be pasted verbatim; edit only if something sounds off in your own voice.

Repo: <https://github.com/Ryujiyasu/vohu> · Live: <https://vohu.vercel.app> · Mini App: app_7ef7c4ad41af2d289fd9312a18bb8d68

---

## The one-line version

> **Encrypted votes for verified humans — one-tap secret-ballot Mini App on World, with a cryptographic triple-binding that no prior voting system has combined.**

Use this as the tagline on the submission form, on Twitter, anywhere you have ~140 characters.

---

## The three-sentence version (30-second pitch)

> Every voting system before 2024 made a painful tradeoff: Google Forms proves nothing about who voted, Snapshot exposes every ballot on-chain, Helios and Vocdoni encrypt ballots but delegate "who counts as a voter" to email or tokens. vohu is the first voting Mini App where proof-of-personhood (World ID Orb), ballot secrecy (Paillier), and trustless tally decryption (2-of-3 threshold Paillier) are all enforced in the cryptographic layer — and every ballot is signed both by the voter's verified-human credential AND by their device's Secure Enclave key, so a forwarded nullifier alone can't cast a vote. The demo runs in your World App, in three taps, and during the hackathon four Orb-verified humans I did not invite found it, cast encrypted ballots, and triggered the trustee ceremony — the server still has no way to tell who voted for what.

---

## The three-minute pitch (spoken)

Time markers are approximate — aim to finish by 3:00 even if you compress.

**0:00 — The opening tension.**
> Privacy-preserving voting is a solved problem in cryptography. Paillier published the homomorphic cryptosystem we use in 1999. Ben Adida built Helios on top of it in 2008. Vitalik's MACI added receipt-freeness in 2019. Vocdoni has zk-SNARK census proofs running in production today. And yet every Mini App on World that lets you run a poll still shows each vote to the server operator the moment it lands. Why?

**0:30 — The missing primitive.**
> Because until 2024, none of these systems had a way to cryptographically verify that a ballot came from a distinct human being. Helios asks the organizer to trust their email list. MACI assumes one Ethereum key per person. Vocdoni uses token balance as a proxy for personhood. Every one of them punts on the question "who is a voter?" — and that's the question World ID answered with Orb-level proof-of-personhood.

**1:00 — What vohu is.**
> vohu is a Mini App that composes those three independent properties for the first time. Proof-of-personhood via World ID 4.0's single-use nullifiers. Ballot secrecy via 2048-bit Paillier encryption on the voter's device. Aggregate decryption via 2-of-3 threshold cryptography — we split the decryption key with polynomial secret sharing at proposal creation and throw away the original, so no single party, including the server, holds enough key material to decrypt any individual ballot.

**1:45 — What makes the enforcement real.**
> Every ballot must clear two cryptographic checks server-side: World ID's cloud-side proof verification, and a Secure-Enclave-backed signature over the ciphertext. An attacker who steals your nullifier can't cast a ballot because the device signature requires your phone's hardware. That combination — identity binding plus device binding — is what other systems advertise but don't actually enforce end-to-end.

**2:15 — The runtime layer.**
> Open the same URL in Chrome and you get a wall of green ciphertext with "open in World App to decrypt." That's not security theater — it's the runtime binding. Voting is an action whose content matters, not just its identity, and a ballot that's observable in real time can't be receipt-free. We close that surface by construction.

**2:45 — Close.**
> vohu ran during the hackathon. Four Orb-verified humans I did not invite found it through the World App directory, cleared the full double-auth, cast encrypted ballots, and two trustees independently triggered the tally ceremony. The server logged a count. It never saw a vote. That is the system working the way a ballot box is supposed to.

---

## Demo video script — 75 seconds

Setup: one phone with World App installed and an Orb-verified World ID; screen recording on. One laptop with Chrome for the "ciphertext in browser" shot.

| t | What you do | What you say |
|---|---|---|
| 0:00 | Chrome open to `https://vohu.vercel.app` | "This is vohu, a privacy-preserving voting Mini App for World." |
| 0:03 | Point at Dashboard tiles — "Public / Identity / Identity + Runtime" | "Every ballot has to clear three bindings. Only the first can be satisfied in Chrome." |
| 0:10 | Open `/vote` in Chrome — shows ObfuscatedScreen | "This is what the server sends Chrome. Green ciphertext. No ballot content is in the HTML." |
| 0:18 | Switch to phone, open vohu from World App Mini App directory | "Same URL, in World App." |
| 0:22 | `/login` → tap Verify with World ID → Orb prompt confirms | "World ID 4.0 Orb verification, single-use nullifier." |
| 0:30 | `/vote` — ballot renders with three options | "The ballot only exists inside the World App runtime, on this device, right now." |
| 0:38 | Tap option → Cast encrypted vote | "Paillier-encrypt on-device with the election's public key. The server never sees plaintext." |
| 0:45 | Brief signature prompt (device signs) | "Secure Enclave signs the ciphertext. Forwarded nullifier alone won't cast a vote." |
| 0:52 | `/result` shows "N verified humans voted · tally encrypted" | "Ballot counts but tally is encrypted. Two of three trustees must cooperate." |
| 0:58 | Tap 'Show server view' — scrolling ciphertext | "This is everything the server has: ciphertext vectors, no plaintexts, ever." |
| 1:05 | Tap a trustee approve link from `/trustee?...&i=2` | "Each trustee signs a partial decryption of the aggregate. Shoup-style." |
| 1:12 | Back to `/result` — tally revealed | "Threshold crossed. Aggregate decrypted. Individual ballots still encrypted — permanently." |
| 1:15 | End frame: "vohu · encrypted votes for verified humans · github.com/Ryujiyasu/vohu" | "vohu. Submitted for World Build 3." |

Record once clean, cut once for pace. Don't over-narrate the crypto — the image of Chrome showing ciphertext and World App showing the ballot does most of the work.

---

## Submission form copy

### Title

```
vohu — encrypted votes for verified humans
```

### Tagline (≤140 chars)

```
Privacy-preserving voting Mini App: World ID Orb + Paillier homomorphic encryption + 2-of-3 threshold decryption. One human, one secret vote.
```

### Short description (≤280 chars)

```
vohu is the first Mini App on World where ballot secrecy, aggregate privacy, and proof-of-personhood are all enforced in the cryptographic layer. Ballots are Paillier-encrypted on-device; only the aggregate is decrypted, and only with 2-of-3 trustee cooperation.
```

### Long description (submission form body)

```
The problem. Snapshot and Tally put every ballot on a public ledger forever. World App's built-in Polls show every vote to the server. Google Forms doesn't even check for bots. Existing on-chain voting systems (Helios, Vocdoni, MACI) encrypt ballots but all rely on an external "who is a human" assumption — email, token balance, or one-Ethereum-key-per-person — that World ID 4.0 Orb finally makes unnecessary.

vohu. A three-tap voting Mini App that layers four independent security properties:
  1. Sybil resistance via World ID 4.0 Orb — single-use nullifiers per (human × action), verified server-side via verifyCloudProof.
  2. Ballot confidentiality via 2048-bit Paillier encryption on the voter's device; the server stores only ciphertexts.
  3. Homomorphic tally — aggregate computed by multiplying ciphertexts; individual ballots never decrypted.
  4. Threshold decryption with 2-of-3 trustees — the Paillier private key is split at proposal creation via polynomial secret sharing (Damgård-Jurik / Shoup-style partial decryption + Lagrange combine). No single party holds enough key material to decrypt any ciphertext alone, including the server.

Triple binding at submission time. Every ballot must carry both a World ID proof AND a Secure-Enclave-backed device signature over the ciphertext. A stolen nullifier alone cannot cast a vote.

Runtime gating. /vote and /result only render their content inside the World App runtime — Chrome or Safari see a wall of ciphertext. This is the runtime binding that login systems don't need but voting systems do: the content of the choice is the value being protected.

Chat-scoped proposals. Via XMTP, an organiser can snapshot an existing group's member list at creation time and scope the proposal to those addresses. Voters prove membership with a signed attribution.

Time-phased voting. Proposals close at an operator-set timestamp. Before close, voters can revise their ballot; after close, the aggregate is frozen so trustee approvals accumulate cleanly instead of being invalidated by each new ballot.

Device-bound receipts. After each vote, the device signs a canonical receipt payload. The voter can later prove to themselves that they voted — but a copy of the receipt bytes is useless to anyone who can't re-sign a fresh challenge on the same device.

Self-hostable. docker compose up brings up the full stack (Next.js + Redis + Upstash-HTTP bridge). hyde provides a TPM-backed drop-in replacement for the mobile Secure-Enclave signing path on self-host deployments.

Real-world use during the hackathon. Four Orb-verified humans I did not invite found vohu via the World App Mini App directory, cleared the double-auth, cast encrypted ballots, and at least two trustees independently triggered the tally ceremony. The server still has no way to tell who voted for what.

Stack: Next.js 16 App Router, Turbopack, Tailwind v4. @worldcoin/minikit-js 1.11 (Mini App path) + @worldcoin/idkit v4 (Chrome IDKit path). paillier-bigint 3.4 for the 2048-bit cryptosystem; threshold math hand-written in lib/threshold-paillier.ts. @xmtp/browser-sdk 7 for chat scoping. viem 2 for Ethereum signature verification. Upstash Redis via Vercel Marketplace. Published on crates.io as part of the hyde ecosystem.

Roadmap. v2 (Seoul Build Week, May 2026): distributed trustee shares on separate devices, NIZK per partial, MACI-style receipt-free bribery resistance, lattice-based HE for ranked-choice and quadratic voting via the plat crate. Academic writeup of the v1→v3 trajectory is planned.
```

### Tech stack tags

```
world-id, worldcoin, miniapp, paillier, homomorphic-encryption, threshold-cryptography, zero-knowledge, xmtp, privacy-voting, proof-of-personhood, next.js, typescript, vercel, redis, rust, tpm, fhe
```

### Category / track

Whichever the submission form offers for "privacy / identity / developer tools / consumer Mini Apps" — pick the one that best matches. If multiple are allowed, include all.

### Demo video link

`<paste the YouTube / Loom / Vimeo URL once the 75-second recording is uploaded>`

### Repo / live / docs links

```
GitHub:       https://github.com/Ryujiyasu/vohu
Live app:     https://vohu.vercel.app
Open in World App: https://world.org/mini-app?app_id=app_7ef7c4ad41af2d289fd9312a18bb8d68
README (JP):  https://github.com/Ryujiyasu/vohu/blob/main/README.ja.md
Deploy guide: https://github.com/Ryujiyasu/vohu/blob/main/docs/deploy.md
hyde crate:   https://crates.io/crates/hyde
```

### Team

```
Ryuji Yasukochi — CTO, M2Labo (Tokyo). Cryptography, TPM, post-quantum, privacy engineering. Built vohu, hyde, janus, hyde-webauthn, argo, plat as a connected ecosystem of "physical-to-blockchain" primitives.
```

---

## Frequently-anticipated judge questions

**"Isn't this just Helios with a different login method?"**
No. Helios in 2008 explicitly scoped out coercion resistance and ran on email accounts. vohu adds (a) cryptographic proof-of-personhood replacing the email trust assumption entirely, (b) Secure-Enclave-backed per-ballot device signatures that Helios doesn't have, and (c) a runtime binding that closes the screen-sharing coercion channel Helios leaves open. The homomorphic tally math is from the same family; the surrounding security architecture is not.

**"Why Paillier and not zk-SNARK?"**
The tally is pure addition; Paillier gives us that in a 40-year-old auditable cryptosystem with no trusted setup, no circuit, and no SNARK prover on-device. Moving to SNARKs or FHE only pays off when the tally grows beyond addition — ranked-choice, quadratic, weighted delegation. That's the v2/v3 roadmap via the `plat` crate.

**"Why trust the server with the threshold shares in v1?"**
Don't. v1 ships with the cryptographic scheme fully implemented but with all three shares co-located in the same Redis instance for demo reproducibility; this is called out in code comments, the README threat model, and the Trust Assumption section. v2 distributes shares to distinct trustee devices at proposal creation. The underlying scheme is the same.

**"Isn't prome defeated by setting window.WorldApp in devtools?"**
Yes. prome is a runtime-gated UX layer, not a cryptographic primitive. The cryptographic bindings (verifyCloudProof and device signature) are what block a devtools-hack ballot from being recorded. prome's job is to make ballot content invisible to bots, crawlers, over-the-shoulder observers, and AI scrapers by default. The README says so explicitly.

**"What happens if World ID 4.0 changes signer key format / managed mode breaks?"**
The Mini App path (MiniKit.verify) is decoupled from the IDKit RP-signature flow; MiniKit uses direct Mini-App-to-World-App IPC and keeps working through signer key rotations. The IDKit Chrome path temporarily went down during vohu's hackathon development when we rotated the key — we documented the issue and kept the Mini App path as the primary demo flow.

**"Why the hyde dependency if you use MiniKit signMessage in v1?"**
hyde is the v2 TPM-backed signer for self-host deployments; in v1 it's a preflight (/hyde-probe) validating the WASM build. The receipt wire format is already designed so that swapping MiniKit's Secure-Enclave signer for a hyde TPM signer is a drop-in — same canonical message, same verification path (viem.verifyMessage). hyde shipped an ML-DSA (FIPS 204) signing API during this hackathon precisely so that path is ready to use on desktop submissions.

---

## Assets to include in the submission

- [x] `public/og-image.png` — Twitter/LinkedIn share card. Already shipped.
- [x] `public/icon.png` + `apple-icon.png` — app icon.
- [x] `docs/screenshots/organic-usage-2026-04-24.png` — the "4 strangers voted" moment.
- [ ] Demo video (75 s, MP4 or YouTube unlisted). To record using the script above.
- [ ] Optional: an architecture diagram PNG for the long-description body. ASCII version already in README.
- [ ] Optional: a still-frame of the Chrome-vs-World-App side-by-side for the submission form header image.
