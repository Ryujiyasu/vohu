// Dump Redis keys for a proposal for diagnostic purposes.

import { Redis } from '@upstash/redis';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const envPath = join(here, '..', '.env.local');
try {
  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(?:"([^"]*)"|(.*))$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2] ?? m[3];
  }
} catch {}

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const pid = process.argv[2] ?? 'demo-2026-04';
const pub = await redis.get(`vohu:proposal:${pid}:threshold-public`);
console.log('threshold-public:');
console.log(JSON.stringify(pub, null, 2));
for (let i = 1; i <= 3; i++) {
  const p = await redis.get(`vohu:proposal:${pid}:partial:${i}`);
  console.log(`\npartial ${i}:`);
  if (!p) { console.log('  (none)'); continue; }
  console.log('  i:', p.i);
  console.log('  aggregateDigest[0..50]:', p.aggregateDigest.slice(0, 50));
  console.log('  partials[0..50]:', p.partials.map(x => x.slice(0, 50)));
  console.log('  submittedAt:', p.submittedAt);
}
