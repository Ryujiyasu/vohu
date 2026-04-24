# Threshold Homomorphic Aggregation on Proof-of-Personhood

*A primitive for ballots, matching, and medical compatibility — with vohu and niobi as the first two applications.*

Ryuji Yasukochi (M2Labo) · April 2026 · arXiv preprint, target submission 2026-05-15

> **Status**: working draft; do not circulate outside Ryuji + immediate collaborators until arXiv submission. Written post-World-Build-3 kickoff (2026-04-23) and after niobi / vohu reached shipping state. Pre-submission read required.

---

## Abstract

Existing privacy-preserving voting and matching systems — Helios, Vocdoni, MACI for ballots; centralised organ-donor registries for medical compatibility — share a structural gap: every one of them delegates the question *"who counts as a participant?"* to an external trust assumption (email accounts, token balance, one-Ethereum-key-per-human, hospital-issued identifiers). World ID 4.0, launched 17 April 2026 with a credential issuer registry, is the first deployed system in which that question can be answered cryptographically, at scale (18M Orb-verified humans), for arbitrary verified attributes.

We argue that the next system-level problem is no longer identity but *aggregation*: given a pool of verified-human credentials, how do you compute a collective answer — a sum, a match, an intersection — without any single party ever seeing an individual input? We formalise this as **threshold homomorphic aggregation on verified humans**, describe its necessary components (device-bound encryption, homomorphic aggregation, threshold decryption, zero-knowledge proof of well-formedness, proof-of-personhood gating), and present two concrete applications on the same primitive:

- **vohu** — a privacy-preserving voting Mini App for the World platform. Paillier-encrypted ballots, homomorphic tally, 2-of-3 threshold decryption, device-bound receipts, runtime-gated to World App's Mini App sandbox. Shipped and deployed at `vohu.vercel.app` during World Build 3 (April 2026); organic usage by unsolicited Orb-verified humans confirmed the full pipeline.
- **niobi** — a privacy-preserving liver transplant matching system. Per-hospital data encrypted under TPM-sealed keys, compatibility scores computed under fully homomorphic encryption, zero-knowledge proofs of pairwise match, and quantum annealing over the aggregated encrypted pool to find the global maximum matching. Submitted to NEDO Challenge Q-2.

The two applications are surface one and surface two of the same substrate. We identify the *aggregation paradox* as the design principle that both resolve — individual data held by individuals is a personal risk; aggregated data readable by an operator is a collective risk; cryptographic aggregation without plaintext reconstitution is the only answer that holds up to a maximally hostile adversary with the full server dataset.

We conclude with a roadmap for the primitive's maturation (distributed key generation, post-quantum migration via lattice-based HE, MACI-style receipt-free bribery resistance) and a discussion of why the credential-registry era makes this primitive structurally necessary rather than merely useful.

---

## 1. Introduction: the aggregation paradox

Collective truth needs collective data. Every democratic vote, every medical-registry optimisation, every epidemiological study begins with the same step: gather contributions from many individuals into one place, then compute a function over them. The function is what we want; the gathering is what we tolerate to get it.

We argue that this ordering — **gather, then compute** — is the root cause of a class of problems that currently limits the real-world deployment of privacy-sensitive collective computation. Gathering creates what security literature calls a honeypot: a concentration of value that every attacker, every subpoena, every compromised administrator, and every future AI-training pipeline will eventually target. Data that was a personal risk when held by individuals becomes a collective risk the moment it is concentrated.

The asymmetry is what we call the *aggregation paradox*:

- **Individual data, held by individuals.** Leakage harms one person. The exposure is recoverable (rotate keys, change passwords, accept the loss). Market value of the stolen data is low because it represents one person. Society is organised to tolerate this risk.
- **Aggregated data, readable by an operator.** Leakage harms many people. The exposure is often unrecoverable (a diagnosis cannot be un-leaked). Market value is high, so attacks are economically justified. Society has no good answer.

The mature cryptographic response is known: encrypt each contribution on the contributor's device; compute over ciphertexts using homomorphic encryption; decrypt only the aggregate, and only with distributed consent from a threshold of key holders. What has changed in 2024–2026 is that *the identity layer required to make this response deployable at human scale* has arrived. World ID 4.0, shipped 17 April 2026, converts this from theoretical cryptography into infrastructure: 18 million Orb-verified humans, a credential issuer registry that admits arbitrary signed attributes (government ID today, health and education on the roadmap), and a distribution channel (World App, 40M+ users) already integrated by Tinder, Zoom, DocuSign, and others within its first week.

**Identity is solved. Aggregation is the next primitive.**

This paper describes that primitive — *threshold homomorphic aggregation on verified humans* — formalises its components, presents two concrete applications on the same substrate (vohu for voting, niobi for medical matching), and argues that its maturation is both structurally necessary for the credential-registry era and empirically validated by the two deployments we report.

### 1.1 Contributions

1. **The aggregation paradox** as a design principle, and the demonstration that it is resolved not by policy but by cryptographic construction.
2. **A formal definition** of threshold homomorphic aggregation on verified humans, with component-level security goals (§3).
3. **vohu**: the first privacy-preserving voting Mini App on a proof-of-personhood substrate, with server-side cryptographic enforcement of identity × device × runtime bindings (§4). Shipped; organic usage observed.
4. **niobi**: a privacy-preserving liver transplant matching system that combines the same cryptographic substrate with quantum-annealing optimisation, demonstrating that the primitive generalises beyond voting (§5). Empirical results vs classical greedy matching: +17.5–22.3 % match rate at the hardware-simulated optimum.
5. **A systematisation** of what matching, compatibility, coordination, and voting share once they are rephrased as aggregation on verified-human credentials (§6).

---

## 2. Background

### 2.1 Homomorphic encryption for aggregation

Paillier [Pai99], additive-only; ElGamal under an exponent, multiplicatively; BFV / BGV / CKKS [FV12, BGV12, CKKS17] for richer functions on ciphertexts; tfhe-rs [Zam23] as a production-grade FHE library. The common property: ciphertexts combine (⊕, ⊗, some algebra) in a way that corresponds to a combination of plaintexts without decryption.

### 2.2 Threshold cryptosystems

Shamir [Sha79] secret sharing; threshold RSA / DSA / Paillier [Sho00, DJ01]; distributed key generation [Ped91]. The property: *t* of *n* holders must cooperate to decrypt or sign.

### 2.3 Proof-of-personhood

World ID 4.0 [TfH26], Humanity Protocol, BrightID. World ID is the only system at time of writing with (a) orb-level biometric uniqueness, (b) a deployed credential registry [TfH26b], (c) tens of millions of verified humans, and (d) a Mini App distribution channel.

### 2.4 Electronic voting

Benaloh [Ben87], Cramer-Gennaro-Schoenmakers [CGS97], Helios [Adi08], Juels-Catalano-Jakobsson [JCJ05], Vocdoni / DAVINCI [Voc24], MACI [But19].

### 2.5 Trusted execution environments

TPM 2.0 [TCG19], Intel TDX [Int22], AMD SEV-SNP [AMD20], Apple Secure Enclave [App22]. hyde [Yas26a] as an open-source unifying abstraction, with ML-KEM-768 [NIST24] and ML-DSA [NIST24b] integrated.

---

## 3. The primitive: threshold homomorphic aggregation on verified humans

### 3.1 Setup

A set $U = \\{u_1, \dots, u_k\\}$ of Orb-verified humans, each in possession of a World ID credential and a device with a hardware-bound signing key. A trustee set $T = \\{t_1, \dots, t_n\\}$ with threshold $t$, and a homomorphic public key $\mathsf{pk}$ whose corresponding private key has been split by Shamir-style secret sharing among $T$.

### 3.2 Contribution phase

Each $u_i \in U$ computes:

- $c_i = \mathsf{Enc}_\mathsf{pk}(m_i; r_i)$ — homomorphic ciphertext of their contribution $m_i$
- $\pi_i$ — zero-knowledge proof that $c_i$ is well-formed (e.g. $m_i \in \\{0,1\\}^k$ for single-choice voting, $m_i$ within valid medical-attribute range for matching)
- $\sigma_{\mathsf{dev},i} = \mathsf{Sign}_\mathsf{devkey}(c_i \parallel \mathsf{nullifier}_i \parallel \mathsf{action\_id})$ — device signature binding the ciphertext to this device
- $\mathsf{nullifier}_i$ — World ID single-use nullifier for the action

The tuple $(c_i, \pi_i, \sigma_{\mathsf{dev},i}, \mathsf{nullifier}_i)$ is submitted to the aggregator.

### 3.3 Aggregation phase

The aggregator verifies $\pi_i$, $\sigma_{\mathsf{dev},i}$, the World ID proof (via cloud verification), and dedup on $\mathsf{nullifier}_i$. Only after all four pass is $c_i$ incorporated into the running aggregate $C = \bigoplus_i c_i$ (the homomorphic combine operation).

### 3.4 Reveal phase

Trustees $t_{j_1}, \dots, t_{j_t}$ each compute a partial decryption $d_{j_\ell} = \mathsf{PartDec}_{\mathsf{share}_{j_\ell}}(C)$ bound to $H(C)$ (the current aggregate digest; if a new contribution arrives, the aggregate changes and partials are re-required). The aggregator combines partials via Lagrange interpolation to recover $\mathsf{Dec}(C) = f(m_1, \dots, m_k)$ for the homomorphic operation $f$.

### 3.5 Security goals

- **G1 (Sybil resistance).** A human can contribute at most once per action. Enforced by World ID nullifiers + server-side `verifyCloudProof`.
- **G2 (Ballot confidentiality).** No party — including the aggregator — learns any $m_i$ individually. Enforced by the homomorphic encryption + the fact that the aggregator never holds the decryption key as a single object.
- **G3 (Aggregate correctness).** The revealed plaintext equals $f(m_1, \dots, m_k)$ for valid contributions only. Enforced by $\pi_i$ (well-formedness) + threshold combine correctness.
- **G4 (Device binding).** A valid contribution requires a signature from a hardware-rooted device key; a forwarded credential alone cannot cast a contribution. Enforced by $\sigma_{\mathsf{dev},i}$ and server-side `verifyMessage`.
- **G5 (Threshold resilience).** No coalition of $t-1$ trustees can decrypt. Enforced by threshold secret-sharing.
- **G6 (Runtime binding, operational).** Contribution and reveal UIs exist only inside the device's trusted runtime (Mini App sandbox, mobile OS-level biometric unlock). Not cryptographic; enforced by construction of the client path and the practical fact that G4 requires physical device possession.

---

## 4. Application I — vohu (voting)

*[TODO: expand — protocol details, threshold Paillier construction, the three bindings in vohu, the hackathon deployment, organic-usage evidence, evaluation numbers. Reuse material from `README.md` sections "How it works" through "Threat model (v1)" as starting text, then tighten.]*

Placeholder TOC:

- 4.1 Protocol specification
- 4.2 Identity × Device double-auth at the server boundary
- 4.3 Threshold Paillier (Shoup-style partial + Lagrange combine)
- 4.4 Runtime binding via `prome` (honest limits of the approach)
- 4.5 Device-bound receipts
- 4.6 Organic deployment evidence (World Build 3, April 2026)

---

## 5. Application II — niobi (medical matching)

*[TODO: expand from niobi/README.md. Emphasise the shift from aggregation over scalars (voting) to aggregation over a matrix of pairwise compatibility scores, and the combination with quantum-annealing optimisation as the piece that is not in vohu.]*

Placeholder TOC:

- 5.1 Protocol specification (7-step individual-sovereign)
- 5.2 Compatibility scoring under FHE (CKKS target via plat)
- 5.3 ZKP of pairwise match
- 5.4 Quantum annealing over the encrypted pairwise matrix (QUBO formulation)
- 5.5 Empirical results: D-Wave SimulatedAnnealingSampler vs greedy vs brute-force
- 5.6 NEDO Challenge Q-2 context

---

## 6. Discussion

### 6.1 The primitive generalises

vohu aggregates over a 3-choice simplex. niobi aggregates over a pairwise compatibility matrix. The same *contribution-aggregation-reveal* structure accommodates: salary-band disclosure without doxxing colleagues, private peer review at scale, threshold unlocking of secrets, coordination games with verified-human referents, clinical trial eligibility matching, and bloom-filter-style private set intersection. Each of these is a different $f$ in §3.4.

### 6.2 Collect without centralising

A policy promise ("we won't look at your data") is falsifiable by a determined adversary. A cryptographic property ("we cannot look at your data") is not. The shift from the first to the second is the full content of the aggregation paradox and the paper's central claim.

### 6.3 Honest limitations

- **Single-trustee v1 (vohu)**: all three Paillier shares are co-located in a single Redis instance during the hackathon period. The cryptographic scheme is threshold Paillier; the operational model is single-operator. v2 (Seoul Build Week, May 2026) distributes shares to distinct trustee devices.
- **No receipt-freeness yet**: a voter cannot cryptographically deny how they voted. MACI-style key rotation is the v3 target.
- **Post-quantum**: Paillier is RSA-class. Lattice migration via plat / tfhe-rs is the v4 target.
- **Runtime binding is not cryptographic**: a determined attacker can set `window.WorldApp` in devtools; the device signature (§3.2) is what actually blocks a spoofed contribution, not `prome`'s rendering gate.

### 6.4 Why now

The credential issuer registry released with World ID 4.0 (April 17, 2026) makes the primitive *necessary* rather than merely interesting: every application that will verify attributes over the coming years will eventually want to aggregate them, and the aggregation layer we describe is the only architectural response that holds under the threat model the credential-era actually faces.

---

## 7. Related work

*[TODO: expand from `vohu/README.md` "Related work and vohu's position" and add niobi-side comparisons: centralised transplant registries (UNOS, Japan OTN), federated learning for medical data, homomorphic score computation pilots (Inpher, Zama medical demos).]*

---

## 8. Roadmap

*[TODO: consolidate from vohu roadmap v2/v3 and niobi technical roadmap.]*

- **Primitive v2** (Seoul Build Week, May 2026): distributed trustee shares, NIZK-verifiable partial decryption, MACI-style receipt rotation.
- **Primitive v3** (2026–2027 research): distributed key generation, lattice-based HE via plat, formal security proofs.
- **Applications**: vohu production deployment with DAO / union / civic-tech pilots; niobi clinical pilot with a Japanese transplant centre; open primitive-as-a-service API for third-party applications.

---

## References

*[TODO: fill in bibtex. Scaffolding:]*

- [Pai99] Paillier, P. *Public-Key Cryptosystems Based on Composite Degree Residuosity Classes.* EUROCRYPT 1999.
- [Sho00] Shoup, V. *Practical Threshold Signatures.* EUROCRYPT 2000.
- [DJ01] Damgård, I., Jurik, M. *A Generalisation, a Simplification and Some Applications of Paillier's Probabilistic Public-Key System.* PKC 2001.
- [Ped91] Pedersen, T. *Non-Interactive and Information-Theoretic Secure Verifiable Secret Sharing.* CRYPTO 1991.
- [Ben87] Benaloh, J. *Verifiable Secret-Ballot Elections.* PhD thesis, Yale University.
- [CGS97] Cramer, R., Gennaro, R., Schoenmakers, B. *A Secure and Optimally Efficient Multi-Authority Election Scheme.* EUROCRYPT 1997.
- [Adi08] Adida, B. *Helios: Web-based Open-Audit Voting.* USENIX Security 2008.
- [JCJ05] Juels, A., Catalano, D., Jakobsson, M. *Coercion-Resistant Electronic Elections.* WPES 2005.
- [But19] Buterin, V. *Minimum Anti-Collusion Infrastructure.* ethresear.ch 2019.
- [FV12] Fan, J., Vercauteren, F. *Somewhat Practical Fully Homomorphic Encryption.* ePrint 2012/144.
- [BGV12] Brakerski, Z., Gentry, C., Vaikuntanathan, V. *(Leveled) Fully Homomorphic Encryption without Bootstrapping.* ITCS 2012.
- [CKKS17] Cheon, J. H., Kim, A., Kim, M., Song, Y. *Homomorphic Encryption for Arithmetic of Approximate Numbers.* ASIACRYPT 2017.
- [Sha79] Shamir, A. *How to Share a Secret.* CACM 1979.
- [TfH26] Tools for Humanity. *World ID 4.0.* world.org/world-id, April 17, 2026.
- [TfH26b] Tools for Humanity. *World ID 4.0 Credential Issuer Registry.* docs.world.org, April 2026.
- [Voc24] Vocdoni / DAVINCI Protocol. *Specification.* davinci.vote, 2024.
- [Yas26a] Yasukochi, R. *hyde: TPM-bound post-quantum primitives.* gitlab.com/Ryujiyasu/hyde.
- [Yas26b] Yasukochi, R. *vohu: Encrypted votes for verified humans.* github.com/Ryujiyasu/vohu.
- [Yas26c] Yasukochi, R. *niobi: Privacy-preserving liver transplant matching with quantum optimisation.* github.com/Ryujiyasu/niobi.

---

## Author note

Written during World Build 3 (FWB × World Foundation, Seoul Build Week cohort, April 2026). arXiv cs.CR target. Comments and co-author inquiries welcome.

---

## Drafting TODO

- [ ] Expand §4 from vohu README (protocol-level detail, avoid marketing phrasing).
- [ ] Expand §5 from niobi README (quantum-annealing formal QUBO, evaluation at larger scales).
- [ ] Write §3 formal definitions with consistent notation (align with Paillier / BFV literature).
- [ ] Pull concrete deployment numbers for §4.6 (ballot count, trustee latency, nullifier dedup hit rate).
- [ ] Add related-work table in §7 with vohu's existing comparison axes, extended for niobi's medical-matching peers.
- [ ] Scrub all "shipping" / "production" claims — hold every claim to what the deployed system actually does, not what v2 will.
- [ ] Co-author sanity-check (Ryuji's research network — one cryptographer, one medical-informatics reviewer).
- [ ] arXiv submit target: 2026-05-15 (post-Seoul kickoff).
