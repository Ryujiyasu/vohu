// Per-proposal Paillier keypair lifecycle — threshold variant.
//
// At proposal creation, this module:
//   1. Generates a standard Paillier (n, g, λ, μ) keypair.
//   2. Splits λ into N=3 shares via Shamir-style polynomial secret sharing,
//      with reconstruction threshold t=2 (see ./threshold-paillier.ts).
//   3. Publishes the public key and combining constants (θ, Δ).
//   4. Persists each share separately — for v1 demo, in Redis under distinct
//      keys. In a production deployment each share is given to a distinct
//      trustee (the server only holds the public metadata).
//   5. Discards the original λ, μ, and polynomial coefficients.
//
// The server can NEVER decrypt an individual ballot — only the aggregate, and
// only when at least t=2 trustees have each supplied a partial decryption.
//
// Demo simplification (called out explicitly):
//   - All N=3 shares are co-located in the same Redis instance for the demo.
//   - A production deployment would distribute shares to N separate parties
//     at proposal creation time (out of band), and the server would never see
//     them. The cryptographic scheme is identical — only the key distribution
//     is simplified for the hackathon submission.
//
// Storage layout (per proposal <id>):
//   vohu:proposal:<id>:threshold-public  → { n, g, threshold, totalParties, combiningTheta, delta }
//   vohu:proposal:<id>:share:<i>         → { i, s }
//   (previous single-key layout has been removed; old proposals need to be
//    re-created.)

import { Redis } from '@upstash/redis';
import { PublicKey } from 'paillier-bigint';
import {
  SerializedShare,
  ThresholdPublicParams,
  ThresholdShare,
  deserializeShare,
  serializeShare,
  thresholdKeygen,
} from './threshold-paillier';
import { generateKeypair } from './tally';

const REDIS_URL =
  process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const REDIS_TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

const redis =
  REDIS_URL && REDIS_TOKEN
    ? new Redis({ url: REDIS_URL, token: REDIS_TOKEN })
    : null;

// In-memory fallback for local dev without Redis.
const mem = new Map<
  string,
  { publicParams: StoredThresholdPublic; shares: SerializedShare[] }
>();

// In-flight request dedup. Concurrent loadOrCreate calls for the same
// proposalId reuse a single Promise — this avoids a fatal race where two
// concurrent generations both observe "no key", generate independently, and
// the second overwrites the first, silently invalidating any ciphertext
// encrypted under the first keypair.
const inflight = new Map<
  string,
  Promise<{ publicParams: StoredThresholdPublic; shares: SerializedShare[] }>
>();

export interface StoredThresholdPublic {
  /** Paillier modulus n, hex. */
  n: string;
  /** Paillier generator g, hex. */
  g: string;
  threshold: number;
  totalParties: number;
  /** Base-16 combining constant. */
  combiningTheta: string;
  /** Base-16 factorial(N). */
  delta: string;
}

const kPublic = (id: string) => `vohu:proposal:${id}:threshold-public`;
const kShare = (id: string, i: number) => `vohu:proposal:${id}:share:${i}`;

function loadOrCreate(
  proposalId: string,
): Promise<{ publicParams: StoredThresholdPublic; shares: SerializedShare[] }> {
  // Dedup concurrent callers — see `inflight` docstring.
  const pending = inflight.get(proposalId);
  if (pending) return pending;
  const promise = _loadOrCreate(proposalId).finally(() => {
    inflight.delete(proposalId);
  });
  inflight.set(proposalId, promise);
  return promise;
}

async function _loadOrCreate(
  proposalId: string,
): Promise<{ publicParams: StoredThresholdPublic; shares: SerializedShare[] }> {
  if (redis) {
    const existing = await redis.get<StoredThresholdPublic>(kPublic(proposalId));
    if (existing) {
      const totalParties = existing.totalParties;
      const shares: SerializedShare[] = [];
      for (let i = 1; i <= totalParties; i++) {
        const s = await redis.get<SerializedShare>(kShare(proposalId, i));
        if (s) shares.push(s);
      }
      if (shares.length === totalParties) {
        return { publicParams: existing, shares };
      }
      console.warn(
        `[keys] ${proposalId}: incomplete shares (${shares.length}/${totalParties}) — regenerating`,
      );
    }
    return createAndStore(proposalId);
  }
  const cached = mem.get(proposalId);
  if (cached) return cached;
  return createAndStore(proposalId);
}

const N_TRUSTEES = 3;
const THRESHOLD = 2;

async function createAndStore(proposalId: string) {
  const { privateKey } = generateKeypair();
  const ths = thresholdKeygen(privateKey, N_TRUSTEES, THRESHOLD);

  const publicParams: StoredThresholdPublic = {
    n: ths.publicKey.n.toString(16),
    g: ths.publicKey.g.toString(16),
    threshold: ths.params.threshold,
    totalParties: ths.params.totalParties,
    combiningTheta: ths.params.combiningTheta,
    delta: ths.params.delta,
  };
  const shares = ths.shares.map(serializeShare);

  if (redis) {
    await redis.set(kPublic(proposalId), publicParams);
    for (const share of shares) {
      await redis.set(kShare(proposalId, share.i), share);
    }
  } else {
    mem.set(proposalId, { publicParams, shares });
  }
  return { publicParams, shares };
}

// ----- Public read API -----

/** Public-key payload safe to serve to voters. */
export async function getProposalPublicKey(proposalId: string): Promise<{
  n: string;
  g: string;
}> {
  const { publicParams } = await loadOrCreate(proposalId);
  return { n: publicParams.n, g: publicParams.g };
}

/** All public threshold parameters (for the tally route + client). */
export async function getThresholdParams(
  proposalId: string,
): Promise<ThresholdPublicParams> {
  const { publicParams } = await loadOrCreate(proposalId);
  return {
    combiningTheta: publicParams.combiningTheta,
    delta: publicParams.delta,
    threshold: publicParams.threshold,
    totalParties: publicParams.totalParties,
  };
}

export async function getPublicKey(proposalId: string): Promise<PublicKey> {
  const { publicParams } = await loadOrCreate(proposalId);
  return new PublicKey(
    BigInt('0x' + publicParams.n),
    BigInt('0x' + publicParams.g),
  );
}

// ----- Trustee-side API (v1: co-located for demo; production: per-trustee) -----

/**
 * Server-side only, and only used by the trustee's own approval flow. Returns
 * the trustee's share so it can produce a partial decryption. In a production
 * deployment this would be an OOB delivery, not a Redis lookup.
 */
export async function getTrusteeShare(
  proposalId: string,
  trusteeIndex: number,
): Promise<ThresholdShare | null> {
  const { shares } = await loadOrCreate(proposalId);
  const s = shares.find(x => x.i === trusteeIndex);
  return s ? deserializeShare(s) : null;
}
