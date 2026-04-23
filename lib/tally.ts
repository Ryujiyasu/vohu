// Additive homomorphic tally for vohu.
//
// Implements a Paillier-encrypted ballot vector:
//
//   ballot        = [e_0, e_1, e_2, ...]   with e_i = Paillier(0 or 1)
//   running total = [E_0, E_1, E_2, ...]   with E_i = ∏ e_i^(j)   (mod n²)
//   tally         = [Paillier.decrypt(E_0), ..., Paillier.decrypt(E_2)]
//
// Properties this buys us:
//  - The server stores only ciphertext vectors. It never sees an individual
//    ballot unless the tally private key is misused.
//  - Aggregation is performed by multiplying ciphertexts (homomorphic add in
//    Paillier). The aggregate is the only thing ever decrypted.
//
// Caveat (v1): the tally private key is held by the election organizer
// (server-side). v2 roadmap: threshold Paillier so no single party can
// decrypt individual ballots.
//
// References:
//  - Paillier, P. (1999). Public-Key Cryptosystems Based on Composite Degree
//    Residuosity Classes.
//  - Helios voting system (2008): same primitive, different UX.

import {
  PublicKey,
  PrivateKey,
  generateRandomKeysSync,
} from 'paillier-bigint';
import { hexToBigint, bigintToHex } from 'bigint-conversion';

// ---------- Serialization ----------

export interface SerializedPublicKey {
  n: string; // hex
  g: string; // hex
}

export interface SerializedPrivateKey {
  lambda: string;
  mu: string;
  pub: SerializedPublicKey;
}

export function serializePublicKey(pk: PublicKey): SerializedPublicKey {
  return { n: bigintToHex(pk.n), g: bigintToHex(pk.g) };
}

export function deserializePublicKey(s: SerializedPublicKey): PublicKey {
  return new PublicKey(hexToBigint(s.n), hexToBigint(s.g));
}

export function serializePrivateKey(sk: PrivateKey): SerializedPrivateKey {
  return {
    lambda: bigintToHex(sk.lambda),
    mu: bigintToHex(sk.mu),
    pub: serializePublicKey(sk.publicKey),
  };
}

export function deserializePrivateKey(s: SerializedPrivateKey): PrivateKey {
  const pub = deserializePublicKey(s.pub);
  return new PrivateKey(hexToBigint(s.lambda), hexToBigint(s.mu), pub);
}

// ---------- Keypair ----------

/** 2048-bit Paillier keypair (~112-bit security). Generation takes a few
 *  hundred ms on a modern server — fine for per-proposal generation. */
export function generateKeypair() {
  return generateRandomKeysSync(2048);
}

// ---------- Ballot ----------

/** Encrypt a ballot for a proposal with `optionCount` options.
 *  `choice` is the zero-based index of the selected option. */
export function encryptBallot(
  pk: PublicKey,
  choice: number,
  optionCount: number,
): string[] {
  if (choice < 0 || choice >= optionCount) {
    throw new Error(`choice ${choice} out of range for ${optionCount} options`);
  }
  const vec: string[] = [];
  for (let i = 0; i < optionCount; i++) {
    const plaintext = BigInt(i === choice ? 1 : 0);
    const ct = pk.encrypt(plaintext);
    vec.push(bigintToHex(ct));
  }
  return vec;
}

// ---------- Aggregation ----------

/** Homomorphically add two ciphertext vectors (element-wise). */
export function addCiphertextVectors(
  pk: PublicKey,
  a: string[],
  b: string[],
): string[] {
  if (a.length !== b.length) {
    throw new Error('ciphertext vector length mismatch');
  }
  return a.map((ctA, i) => {
    const cta = hexToBigint(ctA);
    const ctb = hexToBigint(b[i]);
    return bigintToHex(pk.addition(cta, ctb));
  });
}

/** Homomorphically aggregate a collection of ballot vectors.
 *  Returns a single ciphertext vector whose i-th entry, once decrypted, is
 *  the count of ballots that chose option i. */
export function aggregateBallots(
  pk: PublicKey,
  ballots: string[][],
): string[] {
  if (ballots.length === 0) {
    // By convention: encryption of zero for each slot.
    throw new Error('aggregateBallots requires at least one ballot');
  }
  let acc = ballots[0];
  for (let i = 1; i < ballots.length; i++) {
    acc = addCiphertextVectors(pk, acc, ballots[i]);
  }
  return acc;
}

// ---------- Tally decryption ----------

/** Decrypt a ciphertext vector and return the plaintext tally per option. */
export function decryptTally(sk: PrivateKey, ct: string[]): number[] {
  return ct.map(hex => Number(sk.decrypt(hexToBigint(hex))));
}
