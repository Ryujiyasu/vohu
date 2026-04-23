// Ballot storage layer.
//
// - In production (Vercel): backed by Upstash Redis. Survives cold starts,
//   shared across invocations.
// - In local dev / CI: falls back to an in-memory Map so the project runs
//   without any credentials set.
//
// The store is deliberately simple: a set of seen nullifiers per proposal
// (for Sybil-resistance dedup) and an ordered list of ciphertexts per proposal
// (for aggregate retrieval). The server never sees plaintext ballots.

import { Redis } from '@upstash/redis';

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const USE_REDIS = Boolean(REDIS_URL && REDIS_TOKEN);

const redis = USE_REDIS
  ? new Redis({ url: REDIS_URL!, token: REDIS_TOKEN! })
  : null;

// ---------- In-memory fallback (dev only) ----------

const memBallots = new Map<string, string[]>();
const memNullifiers = new Map<string, Set<string>>();

// ---------- Public API ----------

export interface Ballot {
  nullifier: string;
  ciphertext: string;
  receivedAt: number;
}

const kNullifiers = (proposalId: string) =>
  `vohu:proposal:${proposalId}:nullifiers`;
const kBallots = (proposalId: string) => `vohu:proposal:${proposalId}:ballots`;

/** Returns `true` if the nullifier was newly added (vote counts), `false` if
 *  it had already voted (Sybil dedup triggered). */
export async function submitBallot(
  proposalId: string,
  nullifier: string,
  ciphertext: string,
): Promise<boolean> {
  if (redis) {
    const added = await redis.sadd(kNullifiers(proposalId), nullifier);
    if (added === 0) return false;
    const entry = JSON.stringify({
      nullifier,
      ciphertext,
      receivedAt: Date.now(),
    } satisfies Ballot);
    await redis.rpush(kBallots(proposalId), entry);
    return true;
  }

  // In-memory fallback
  let nullSet = memNullifiers.get(proposalId);
  if (!nullSet) {
    nullSet = new Set();
    memNullifiers.set(proposalId, nullSet);
  }
  if (nullSet.has(nullifier)) return false;
  nullSet.add(nullifier);

  let list = memBallots.get(proposalId);
  if (!list) {
    list = [];
    memBallots.set(proposalId, list);
  }
  list.push(ciphertext);
  return true;
}

/** Returns the ordered list of ciphertexts for a proposal. */
export async function getCiphertexts(proposalId: string): Promise<string[]> {
  if (redis) {
    const entries = await redis.lrange<string>(kBallots(proposalId), 0, -1);
    return entries
      .map(raw => {
        try {
          const parsed =
            typeof raw === 'string' ? (JSON.parse(raw) as Ballot) : (raw as unknown as Ballot);
          return parsed.ciphertext;
        } catch {
          return null;
        }
      })
      .filter((ct): ct is string => Boolean(ct));
  }

  return memBallots.get(proposalId) ?? [];
}

/** Number of ballots cast for a proposal. */
export async function ballotCount(proposalId: string): Promise<number> {
  if (redis) {
    return await redis.scard(kNullifiers(proposalId));
  }
  return memNullifiers.get(proposalId)?.size ?? 0;
}

/** Whether the Upstash credentials are configured. Useful for diagnostics. */
export const isPersistent = USE_REDIS;
