// Partial decryption store.
//
// For each proposal, each trustee submits one "partial decryption" per
// aggregate-ciphertext component (one per ballot option). When at least t
// distinct trustees have submitted, the server can combine them into the
// final plaintext counts.
//
// Storage layout:
//   vohu:proposal:<id>:partial:<i>  ->  { i, ciphertextAggregate: hex,
//                                         partials: hex[] }
//
//   The `ciphertextAggregate` is stored alongside so a later combiner can
//   detect mismatch (if new ballots arrived between partial submissions,
//   previously-submitted partials become stale and the trustee must re-sign).

import { Redis } from '@upstash/redis';

const REDIS_URL =
  process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const REDIS_TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

const redis =
  REDIS_URL && REDIS_TOKEN
    ? new Redis({ url: REDIS_URL, token: REDIS_TOKEN })
    : null;

const mem = new Map<string, Map<number, StoredPartial>>();

export interface StoredPartial {
  /** Trustee index. */
  i: number;
  /** Hex-encoded concatenated aggregate (one per option). Used to detect
   *  ballot set changes after a trustee signs. */
  aggregateDigest: string;
  /** Hex-encoded partial decryption of each aggregate component. */
  partials: string[];
  submittedAt: number;
}

const kPartial = (proposalId: string, i: number) =>
  `vohu:proposal:${proposalId}:partial:${i}`;

export async function savePartial(
  proposalId: string,
  partial: StoredPartial,
): Promise<void> {
  if (redis) {
    await redis.set(kPartial(proposalId, partial.i), partial);
    return;
  }
  let inner = mem.get(proposalId);
  if (!inner) {
    inner = new Map();
    mem.set(proposalId, inner);
  }
  inner.set(partial.i, partial);
}

export async function loadPartials(
  proposalId: string,
  totalParties: number,
): Promise<StoredPartial[]> {
  const out: StoredPartial[] = [];
  if (redis) {
    for (let i = 1; i <= totalParties; i++) {
      const p = await redis.get<StoredPartial>(kPartial(proposalId, i));
      if (p) out.push(p);
    }
    return out;
  }
  const inner = mem.get(proposalId);
  if (!inner) return [];
  for (const v of inner.values()) out.push(v);
  return out;
}

export async function clearPartials(proposalId: string, totalParties: number) {
  if (redis) {
    for (let i = 1; i <= totalParties; i++) {
      await redis.del(kPartial(proposalId, i));
    }
    return;
  }
  mem.delete(proposalId);
}

/** Stable fingerprint of an aggregate-ciphertext vector. Used as a cache key
 *  so partials computed against one ballot set don't accidentally combine
 *  with a newer ballot set. */
export function aggregateDigest(aggregate: bigint[]): string {
  return aggregate.map(b => b.toString(16)).join(':');
}
