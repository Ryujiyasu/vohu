// Clear all Redis keys for a given proposal id.
// Used when the storage layout changes between schema versions.
//
//   node scripts/clear-proposal.mjs [proposalId]

import { Redis } from '@upstash/redis';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Load .env.local manually (Node doesn't auto-pick it up).
const here = dirname(fileURLToPath(import.meta.url));
const envPath = join(here, '..', '.env.local');
try {
  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(?:"([^"]*)"|(.*))$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2] ?? m[3];
    }
  }
} catch {
  // no .env.local, rely on process env
}

const url =
  process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token =
  process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

if (!url || !token) {
  console.error('no Upstash Redis credentials in env; nothing to clear');
  process.exit(0);
}

const redis = new Redis({ url, token });
const proposalId = process.argv[2] ?? 'demo-2026-04';

const keys = [
  `vohu:proposal:${proposalId}:paillier`, // legacy single-key private
  `vohu:proposal:${proposalId}:threshold-public`,
  `vohu:proposal:${proposalId}:ballots`,
  `vohu:proposal:${proposalId}:nullifiers`,
];
for (let i = 1; i <= 10; i++) {
  keys.push(`vohu:proposal:${proposalId}:share:${i}`);
  keys.push(`vohu:proposal:${proposalId}:partial:${i}`);
}

let deleted = 0;
for (const k of keys) {
  const r = await redis.del(k);
  if (r) {
    deleted++;
    console.log(`  deleted ${k}`);
  }
}
console.log(`cleared ${deleted} keys for proposal ${proposalId}`);
