# Pitch cheat sheet — vohu, face-to-face

Phone-friendly. Read from the top, pick the length you have.

---

## 10 seconds — name-drop

> **vohu is a privacy-preserving voting Mini App for World. Encrypted ballots on-device, homomorphic tally, 2-of-3 threshold decryption. Built for World Build 3.**

---

## 30 seconds — "tell me more"

> Every Mini App poll today shows every vote to the server operator. vohu doesn't. Ballots are Paillier-encrypted on your phone under the election's public key, the server aggregates the ciphertexts without ever decrypting them, and only the aggregate tally is revealed — and only after two out of three trustees cooperate. Sybil resistance comes from World ID Orb; ballot secrecy comes from the crypto; tally trust comes from the threshold. It runs in World App in three taps.

---

## 60 seconds — interested listener

> I built vohu for World Build 3. It's a private voting Mini App on World.
>
> The problem: every existing voting tool trades off one of three things. Google Forms has no Sybil resistance. Snapshot puts every vote on a public ledger forever. World App's built-in polls show every vote to the server. Helios, Vocdoni, MACI solve ballot secrecy but delegate *who counts as a human* to email or tokens.
>
> vohu is the first system where all three are enforced in the cryptographic layer. World ID Orb single-use nullifiers for Sybil. Paillier homomorphic encryption for ballot secrecy. 2-of-3 threshold decryption, so not even the server can see a tally without trustee cooperation. Plus every vote carries both a World ID proof and a Secure Enclave device signature — a stolen nullifier alone can't cast a vote.
>
> And voting is just the first surface. The underlying primitive — threshold homomorphic aggregation on verified humans — is the same one my medical-matching project niobi uses for liver transplant matching. Voting, matching, compatibility, all on the same crypto substrate. Identity is solved by World. Aggregation is the next primitive. vohu is the hello world.

---

## "Why now" — one line

> World ID 4.0 shipped April 17th with a credential registry. Identity layer is done. We're building the aggregation layer on top.

---

## Killer line — for memory

> **We don't promise not to look. We built a system that cannot look.**

Pause after delivering. Let it land.

---

## Q&A — prepared answers

**Q: Why not zk-SNARK?**
> The tally is pure addition. Paillier gives us that with a 40-year-old auditable cipher, no trusted setup, no circuit. FHE comes in at v4 for ranked-choice and weighted voting via my plat crate.

**Q: Who's your team?**
> I'm solo on vohu. I'm CTO at M2Labo in Tokyo. I also publish hyde (TPM + PQC) on crates.io and maintain argo (ZKP) and plat (FHE) — vohu composes with all three.

**Q: Is it live?**
> Yes, vohu.vercel.app. During the hackathon four Orb-verified humans I didn't invite found it, cleared the full double-auth, cast encrypted ballots, and two trustees triggered the tally ceremony. The server still can't tell who voted for what.

**Q: What's the business model?**
> Infrastructure first. Demo Day target is pilot deployments with DAOs, unions, Japanese municipalities for civic tech. Long-term: threshold aggregation primitive as a service for any Mini App that needs private collective computation.

**Q: What's next?**
> Seoul Build Week in May if we get selected. v2 distributes trustee shares to separate devices. v3 adds MACI-style receipt-free bribery resistance. v4 goes post-quantum via lattice HE.

**Q: How is this different from Helios / MACI / Vocdoni?**
> Same crypto family. Different identity layer. They all delegate "who is a voter" — email, token balance, one-Ethereum-key-per-human. vohu is the first to treat proof-of-personhood as a first-class cryptographic input rather than an operational assumption.

**Q: Isn't blockchain voting already solved?**
> For token-weighted DAO governance, sort of. For one-human-one-vote? No system did this on-chain until World ID. And even then, ballot privacy wasn't solved until you combined it with homomorphic encryption. vohu is the specific composition.

**Q: What about coercion resistance?**
> Partial today. The device signature + runtime gate blocks shoulder-surfing and credential-forwarding attacks. Full receipt-freeness in the MACI sense is v3 — key rotation so a coerced voter can silently override their own ballot.

---

## Useful numbers to drop

- **18M** Orb-verified humans on World (as of April 2026)
- **40M+** World App users
- **2048-bit** Paillier modulus, **2-of-3** threshold
- **75s** demo video, **3-minute** Loom pitch, **$5K** hackathon prize + **$200K** grant potential
- **4** organic Orb-verified voters during hackathon week, without solicitation

---

## If the conversation turns investor-shaped

> I'm not pitching a voting app. I'm pitching a thesis: threshold homomorphic aggregation on verified humans is a new category, and that category will have multiple billion-dollar applications on top. Voting is the hello world. Medical matching, compatibility, salary transparency, peer review — same primitive, different surface.
