// Proposal registry.
//
// v1 supports two kinds of proposals:
//   1. The hardcoded demo proposal (open to any verified human)
//   2. Custom proposals stored in Redis, optionally scoped to an XMTP group's
//      membership at snapshot time

import { Redis } from '@upstash/redis';

const REDIS_URL =
  process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const REDIS_TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

const redis =
  REDIS_URL && REDIS_TOKEN
    ? new Redis({ url: REDIS_URL, token: REDIS_TOKEN })
    : null;

// In-memory proposal store for local dev without Redis.
const mem = new Map<string, Proposal>();

export interface ProposalOption {
  id: string;
  label: string;
}

export interface XmtpGroupScope {
  kind: 'xmtp-group';
  /** XMTP conversationId of the target group. */
  groupId: string;
  /** Optional human-readable name at snapshot time. */
  groupName?: string;
  /** Lower-cased EOA addresses of group members at snapshot time. */
  allowedAddresses: string[];
  /** Unix millis of the membership snapshot. */
  snapshotAt: number;
}

export type ProposalScope = XmtpGroupScope;

export interface Proposal {
  id: string;
  title: string;
  options: ProposalOption[];
  /** If present, only voters whose Ethereum address appears in
   *  `scope.allowedAddresses` may submit a ballot. */
  scope?: ProposalScope;
  createdAt: number;
}

export const DEMO_PROPOSAL: Proposal = {
  id: 'demo-2026-04',
  title: 'Should the World ecosystem prioritize privacy primitives in 2026?',
  options: [
    { id: 'yes', label: 'Yes — privacy is foundational' },
    { id: 'no', label: 'No — focus on growth first' },
    { id: 'mixed', label: 'Mixed — depends on use case' },
  ],
  createdAt: 0,
};

const HARDCODED: Record<string, Proposal> = {
  [DEMO_PROPOSAL.id]: DEMO_PROPOSAL,
};

const defKey = (id: string) => `vohu:proposal:${id}:definition`;

export async function getProposal(id: string): Promise<Proposal | null> {
  if (HARDCODED[id]) return HARDCODED[id];
  if (redis) {
    const p = await redis.get<Proposal>(defKey(id));
    return p ?? null;
  }
  return mem.get(id) ?? null;
}

export async function saveProposal(p: Proposal): Promise<void> {
  if (HARDCODED[p.id]) {
    throw new Error(`cannot overwrite hardcoded proposal ${p.id}`);
  }
  if (redis) {
    await redis.set(defKey(p.id), p);
  } else {
    mem.set(p.id, p);
  }
}

/** Convenience — generate a new proposal id. Short and URL-safe. */
export function newProposalId(): string {
  // Format: "proposal-<8 hex chars>"
  const r = new Uint8Array(4);
  crypto.getRandomValues(r);
  const hex = Array.from(r)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return `proposal-${hex}`;
}
