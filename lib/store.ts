// Ballot storage layer.
//
// - Production (Vercel): backed by Upstash Redis. Survives cold starts,
//   shared across invocations.
// - Local dev / CI: falls back to an in-memory Map.
//
// Data model (per proposal):
//   HASH vohu:proposal:<id>:ballots    field=nullifier  value=JSON BallotRecord
//
// The hash keying on the nullifier gives us Sybil dedup for free (one
// entry per voter) and lets a voter revise their ballot before voting
// closes without us needing to track insertion order. Count is HLEN,
// listing is HVALS.
//
// The server NEVER decrypts individual ciphertexts. Aggregation is done
// homomorphically in /lib/tally.ts; only the aggregate is decrypted at
// result time.

import { Redis } from '@upstash/redis';

// Supports both naming conventions:
//   - Upstash native: UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
//   - Vercel KV (Marketplace Upstash): KV_REST_API_URL / KV_REST_API_TOKEN
const REDIS_URL =
  process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const REDIS_TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

const redis =
  REDIS_URL && REDIS_TOKEN
    ? new Redis({ url: REDIS_URL, token: REDIS_TOKEN })
    : null;

const memBallots = new Map<string, Map<string, BallotRecord>>();

export interface BallotRecord {
  nullifier: string;
  /** Paillier-encrypted ballot vector (hex per option). */
  ciphertextVec: string[];
  receivedAt: number;
}

/** Outcome of a ballot submission. */
export type SubmitOutcome = 'accepted' | 'revised';

const kBallots = (proposalId: string) => `vohu:proposal:${proposalId}:ballots`;

function memHash(proposalId: string): Map<string, BallotRecord> {
  let h = memBallots.get(proposalId);
  if (!h) {
    h = new Map();
    memBallots.set(proposalId, h);
  }
  return h;
}

/**
 * Record (or replace) a ballot for `nullifier` on `proposalId`.
 * Returns `accepted` for a first ballot, `revised` when an existing
 * ballot for the same nullifier was overwritten. Phase gating (reject
 * after voting closes) is enforced by the caller — this function just
 * writes.
 */
export async function submitBallot(
  proposalId: string,
  nullifier: string,
  ciphertextVec: string[],
): Promise<SubmitOutcome> {
  const record: BallotRecord = {
    nullifier,
    ciphertextVec,
    receivedAt: Date.now(),
  };

  if (redis) {
    const added = await redis.hset(kBallots(proposalId), {
      [nullifier]: JSON.stringify(record),
    });
    // Upstash hset returns the number of NEW fields created (0 if the
    // field already existed and was updated).
    return added === 0 ? 'revised' : 'accepted';
  }

  const h = memHash(proposalId);
  const existed = h.has(nullifier);
  h.set(nullifier, record);
  return existed ? 'revised' : 'accepted';
}

export async function getBallots(proposalId: string): Promise<BallotRecord[]> {
  if (redis) {
    const entries = (await redis.hvals(kBallots(proposalId))) as unknown[];
    return entries
      .map(raw => {
        try {
          if (typeof raw === 'string') return JSON.parse(raw) as BallotRecord;
          return raw as BallotRecord;
        } catch {
          return null;
        }
      })
      .filter((r): r is BallotRecord => Boolean(r));
  }
  return Array.from(memHash(proposalId).values());
}

export async function ballotCount(proposalId: string): Promise<number> {
  if (redis) {
    return (await redis.hlen(kBallots(proposalId))) as number;
  }
  return memHash(proposalId).size;
}

/** True if this nullifier has already voted on this proposal. */
export async function hasVoted(
  proposalId: string,
  nullifier: string,
): Promise<boolean> {
  if (redis) {
    const exists = (await redis.hexists(
      kBallots(proposalId),
      nullifier,
    )) as number;
    return exists === 1;
  }
  return memHash(proposalId).has(nullifier);
}

export const isPersistent = Boolean(redis);
