// Threshold Paillier — Shoup-style partial decryption with Lagrange combine.
//
// Scheme (Hazay–Mikkelsen–Patra–Venkitasubramaniam 2017, simplified for a
// trusted dealer at proposal creation):
//
//   KeyGen:
//     - Standard Paillier (n, g, λ, μ).
//     - Pick polynomial f over the integers with f(0) = λ and t-1 random
//       coefficients uniformly in [0, Δ²·n²).
//     - Share for trustee i ∈ {1..N}: s_i = f(i).
//     - Publish combining constant θ = (4·Δ²)⁻¹ · μ  mod n  and the modulus
//       n²; discard λ, μ, f's coefficients.
//
//   PartialDecrypt(c, s_i):
//     - c_i = c^(2·Δ·s_i) mod n²
//
//   Combine({(i, c_i)}_{i∈S}, |S|=t):
//     - For each i ∈ S: λ_i^S = Δ · ∏_{j∈S, j≠i} (-j) / (i - j).
//       This is an INTEGER because Δ = N! absorbs the denominator.
//     - Product: c′ = ∏ c_i^(2 λ_i^S) mod n²
//     - c′ equals c^(4·Δ²·λ) mod n²  =  1 + 4·Δ²·λ·m·n + O(n²).
//     - L(c′) = (c′ − 1) / n ≡ 4·Δ²·λ·m   (mod n).
//     - m = L(c′) · θ mod n.
//
// Assumptions:
//   - g = n + 1 (paillier-bigint's default).
//   - Trusted dealer at KeyGen (vohu v1: the server at proposal creation).
//   - No malicious trustee checks (a bad partial poisons the combine). v2
//     adds verification-key zero-knowledge proofs per partial.

import { modInv, modPow } from 'bigint-crypto-utils';
import { PrivateKey, PublicKey } from 'paillier-bigint';

function factorial(n: number): bigint {
  let r = 1n;
  for (let i = 2; i <= n; i++) r *= BigInt(i);
  return r;
}

function mod(a: bigint, m: bigint): bigint {
  return ((a % m) + m) % m;
}

/** Cryptographically secure uniform BigInt in [0, bound). */
function randomBigIntLT(bound: bigint): bigint {
  if (bound <= 0n) throw new Error('bound must be > 0');
  const byteLen = Math.ceil(bound.toString(16).length / 2);
  // Use Web Crypto if available, else fall back to Node's crypto.
  const getRandomBytes = (len: number): Uint8Array => {
    if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
      const arr = new Uint8Array(len);
      globalThis.crypto.getRandomValues(arr);
      return arr;
    }
    // Node fallback
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { randomBytes } = require('crypto') as typeof import('crypto');
    return new Uint8Array(randomBytes(len));
  };
  while (true) {
    const bytes = getRandomBytes(byteLen);
    let r = 0n;
    for (const b of bytes) r = (r << 8n) | BigInt(b);
    if (r < bound) return r;
  }
}

// ---------------- Public types ----------------

export interface ThresholdShare {
  /** Trustee index, 1..N. */
  i: number;
  /** Secret share s_i = f(i). */
  s: bigint;
}

export interface SerializedShare {
  i: number;
  s: string; // hex
}

export interface ThresholdPublicParams {
  /** Public combining constant θ = (4·Δ²)⁻¹·μ mod n. */
  combiningTheta: string; // hex
  /** Δ = N!, for convenience (derivable from totalParties). */
  delta: string; // hex
  threshold: number; // t
  totalParties: number; // N
}

export interface ThresholdKeygen {
  publicKey: PublicKey;
  shares: ThresholdShare[];
  params: ThresholdPublicParams;
}

// ---------------- KeyGen ----------------

/**
 * Split a Paillier private key into `totalParties` shares with a reconstruction
 * threshold of `threshold`. After this call, the caller MUST discard the input
 * `privateKey` — only the returned shares + params should be persisted.
 */
export function thresholdKeygen(
  privateKey: PrivateKey,
  totalParties: number,
  threshold: number,
): ThresholdKeygen {
  if (threshold < 1 || threshold > totalParties) {
    throw new Error(`invalid threshold ${threshold} for N=${totalParties}`);
  }
  const { n } = privateKey.publicKey;
  const nSquared = n * n;
  const delta = factorial(totalParties);
  const lambda = privateKey.lambda;
  const mu = privateKey.mu;

  // Polynomial f(X) = λ + a₁ X + ... + a_{t-1} X^{t-1}
  const coefficients: bigint[] = [lambda];
  const coeffBound = delta * delta * nSquared;
  for (let k = 1; k < threshold; k++) {
    coefficients.push(randomBigIntLT(coeffBound));
  }

  const shares: ThresholdShare[] = [];
  for (let i = 1; i <= totalParties; i++) {
    let s = 0n;
    let xk = 1n;
    const bi = BigInt(i);
    for (const a of coefficients) {
      s += a * xk;
      xk *= bi;
    }
    shares.push({ i, s });
  }

  // Public combining constant θ = (4·Δ²)⁻¹·μ mod n
  const fourDelta2 = 4n * delta * delta;
  const combiningTheta = mod(modInv(fourDelta2, n) * mu, n);

  return {
    publicKey: privateKey.publicKey,
    shares,
    params: {
      combiningTheta: combiningTheta.toString(16),
      delta: delta.toString(16),
      threshold,
      totalParties,
    },
  };
}

// ---------------- Partial decryption ----------------

/**
 * Trustee i, given their share, produces a partial decryption of `ciphertext`.
 * The partial is safe to publish — it reveals nothing about the plaintext
 * without t-1 other partials.
 */
export function partialDecrypt(
  ciphertext: bigint,
  share: ThresholdShare,
  publicKey: PublicKey,
  params: ThresholdPublicParams,
): bigint {
  const delta = BigInt('0x' + params.delta);
  const nSquared = publicKey.n * publicKey.n;
  const exponent = 2n * delta * share.s;
  return modPow(ciphertext, exponent, nSquared);
}

// ---------------- Combine ----------------

export interface Partial {
  i: number;
  c_i: bigint;
}

/**
 * Combine at least `threshold` partial decryptions into a plaintext.
 * Extra partials beyond the threshold are ignored (any t of N works).
 */
export function combinePartials(
  partials: Partial[],
  publicKey: PublicKey,
  params: ThresholdPublicParams,
): bigint {
  if (partials.length < params.threshold) {
    throw new Error(`need at least ${params.threshold} partials, got ${partials.length}`);
  }
  const subset = partials.slice(0, params.threshold);
  const indices = subset.map(p => p.i);

  const delta = BigInt('0x' + params.delta);
  const theta = BigInt('0x' + params.combiningTheta);
  const n = publicKey.n;
  const nSquared = n * n;

  let product = 1n;
  for (const partial of subset) {
    // λ_i^S = Δ · ∏_{j≠i} (-j) / (i - j) — must be integer (N! absorbs)
    let numerator = delta;
    let denominator = 1n;
    for (const j of indices) {
      if (j === partial.i) continue;
      numerator *= BigInt(-j);
      denominator *= BigInt(partial.i - j);
    }
    if (numerator % denominator !== 0n) {
      // Should never happen with Δ = N!, but guard against subtle bugs.
      throw new Error(
        `non-integer Lagrange coefficient: ${numerator}/${denominator} for i=${partial.i}`,
      );
    }
    const lambdaIS = numerator / denominator;
    const exponent = 2n * lambdaIS;

    let term: bigint;
    if (exponent < 0n) {
      const inv = modInv(partial.c_i, nSquared);
      term = modPow(inv, -exponent, nSquared);
    } else {
      term = modPow(partial.c_i, exponent, nSquared);
    }
    product = mod(product * term, nSquared);
  }

  // product = c^(4·Δ²·λ) mod n²
  //        ≡ 1 + 4·Δ²·λ·m·n  (mod n²)
  // L(product) = (product - 1) / n = 4·Δ²·λ·m mod n
  // m = L(product) · θ mod n   where θ = (4·Δ²)⁻¹·μ mod n, so θ·4·Δ²·λ ≡ 1 mod n
  if (mod(product - 1n, n) !== 0n) {
    throw new Error(
      `combine failed: product - 1 not divisible by n (product mod n = ${mod(
        product,
        n,
      )})`,
    );
  }
  const L = mod((product - 1n) / n, n);
  return mod(L * theta, n);
}

// ---------------- Serialization ----------------

export function serializeShare(s: ThresholdShare): SerializedShare {
  return { i: s.i, s: s.s.toString(16) };
}
export function deserializeShare(s: SerializedShare): ThresholdShare {
  return { i: s.i, s: BigInt('0x' + s.s) };
}

/** Aggregate a homomorphic ciphertext vector into a single per-option
 *  aggregate ciphertext — used before threshold decryption so that each
 *  trustee decrypts only the aggregate, never individual ballots. */
export function aggregateCiphertextVector(
  ciphertextVectors: bigint[][],
  publicKey: PublicKey,
): bigint[] {
  if (ciphertextVectors.length === 0) {
    throw new Error('at least one ciphertext vector required');
  }
  const nSquared = publicKey.n * publicKey.n;
  const width = ciphertextVectors[0].length;
  const acc = new Array<bigint>(width).fill(1n);
  for (const vec of ciphertextVectors) {
    if (vec.length !== width) throw new Error('ciphertext vector length mismatch');
    for (let k = 0; k < width; k++) {
      acc[k] = mod(acc[k] * vec[k], nSquared);
    }
  }
  return acc;
}
