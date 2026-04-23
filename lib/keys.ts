// Per-proposal Paillier keypair lifecycle.
//
// The election's key is generated on first access and persisted in Redis.
// In production (multi-replica server), the first generation wins; the
// remaining replicas fetch the stored key. For local development without
// Redis, the keypair is generated once per process and held in memory — a
// process restart will generate a fresh key, which is fine for a demo.
//
// For a real deployment, the private key would be held in threshold form by
// N organizer trustees (v2 roadmap). For v1 it is held by the server, which
// commits — in code, in the README, and in the pitch — to only decrypting
// the aggregate.

import { Redis } from '@upstash/redis';
import {
  SerializedPrivateKey,
  SerializedPublicKey,
  deserializePrivateKey,
  deserializePublicKey,
  generateKeypair,
  serializePrivateKey,
  serializePublicKey,
} from './tally';

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis =
  REDIS_URL && REDIS_TOKEN
    ? new Redis({ url: REDIS_URL, token: REDIS_TOKEN })
    : null;

// Per-process fallback cache for local dev.
const memKeys = new Map<string, SerializedPrivateKey>();

const keyKey = (proposalId: string) => `vohu:proposal:${proposalId}:paillier`;

async function loadOrCreate(proposalId: string): Promise<SerializedPrivateKey> {
  if (redis) {
    const existing = await redis.get<SerializedPrivateKey>(keyKey(proposalId));
    if (existing) return existing;
    const { privateKey } = generateKeypair();
    const serialized = serializePrivateKey(privateKey);
    await redis.set(keyKey(proposalId), serialized);
    return serialized;
  }
  const existing = memKeys.get(proposalId);
  if (existing) return existing;
  const { privateKey } = generateKeypair();
  const serialized = serializePrivateKey(privateKey);
  memKeys.set(proposalId, serialized);
  return serialized;
}

/** Server-side only. Fetches (or generates) the Paillier private key for
 *  this proposal. DO NOT expose this function or its result to the client. */
export async function getProposalPrivateKey(proposalId: string) {
  const serialized = await loadOrCreate(proposalId);
  return deserializePrivateKey(serialized);
}

/** Public-key accessor safe to serve to the client. */
export async function getProposalPublicKey(
  proposalId: string,
): Promise<SerializedPublicKey> {
  const serialized = await loadOrCreate(proposalId);
  return serialized.pub;
}

/** Used by the client to get a usable PublicKey instance from the wire
 *  representation returned by `GET /api/proposal`. */
export { deserializePublicKey };
