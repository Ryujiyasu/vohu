// Ballot storage layer.
//
// - Production (Vercel): backed by Upstash Redis. Survives cold starts,
//   shared across invocations.
// - Local dev / CI: falls back to an in-memory Map.
//
// Data model (per proposal):
//   SET  vohu:proposal:<id>:nullifiers      -> used to dedup Sybil
//   LIST vohu:proposal:<id>:ballots         -> JSON { nullifier, ciphertextVec[], receivedAt }
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

const memBallots = new Map<string, BallotRecord[]>();
const memNullifiers = new Map<string, Set<string>>();

export interface BallotRecord {
  nullifier: string;
  /** Paillier-encrypted ballot vector (hex per option). */
  ciphertextVec: string[];
  receivedAt: number;
}

const kNullifiers = (proposalId: string) =>
  `vohu:proposal:${proposalId}:nullifiers`;
const kBallots = (proposalId: string) => `vohu:proposal:${proposalId}:ballots`;

/** `true` if the nullifier was newly recorded (vote counts), `false` if it
 *  had already voted (Sybil dedup). */
export async function submitBallot(
  proposalId: string,
  nullifier: string,
  ciphertextVec: string[],
): Promise<boolean> {
  const record: BallotRecord = {
    nullifier,
    ciphertextVec,
    receivedAt: Date.now(),
  };

  if (redis) {
    const added = await redis.sadd(kNullifiers(proposalId), nullifier);
    if (added === 0) return false;
    await redis.rpush(kBallots(proposalId), JSON.stringify(record));
    return true;
  }

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
  list.push(record);
  return true;
}

export async function getBallots(proposalId: string): Promise<BallotRecord[]> {
  if (redis) {
    const entries = await redis.lrange<string>(kBallots(proposalId), 0, -1);
    return entries
      .map(raw => {
        try {
          // Upstash already parses JSON when it can; tolerate both shapes.
          if (typeof raw === 'string') {
            return JSON.parse(raw) as BallotRecord;
          }
          return raw as unknown as BallotRecord;
        } catch {
          return null;
        }
      })
      .filter((r): r is BallotRecord => Boolean(r));
  }
  return memBallots.get(proposalId) ?? [];
}

export async function ballotCount(proposalId: string): Promise<number> {
  if (redis) {
    return await redis.scard(kNullifiers(proposalId));
  }
  return memNullifiers.get(proposalId)?.size ?? 0;
}

export const isPersistent = Boolean(redis);
