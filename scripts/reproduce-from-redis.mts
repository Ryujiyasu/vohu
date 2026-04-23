// Load stored Redis state for a proposal and try to combine the partials
// exactly the way /api/tally would. This isolates whether the bug is in the
// math+params OR in how the route computes the aggregate.

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

import { Redis } from '@upstash/redis';
import { PublicKey } from 'paillier-bigint';
import {
  combinePartials,
  deserializeShare,
  partialDecrypt,
} from '../lib/threshold-paillier.ts';

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const pid = 'demo-2026-04';
const pub: any = await redis.get(`vohu:proposal:${pid}:threshold-public`);
const p1: any = await redis.get(`vohu:proposal:${pid}:partial:1`);
const p2: any = await redis.get(`vohu:proposal:${pid}:partial:2`);

const publicKey = new PublicKey(
  BigInt('0x' + pub.n),
  BigInt('0x' + pub.g),
);

const params = {
  combiningTheta: pub.combiningTheta,
  delta: pub.delta,
  threshold: pub.threshold,
  totalParties: pub.totalParties,
};

console.log('loaded from Redis:');
console.log(`  n bits: ${publicKey.n.toString(2).length}`);
console.log(`  threshold: t=${params.threshold} of N=${params.totalParties}`);
console.log(`  partial1.aggregateDigest[0..40]: ${p1.aggregateDigest.slice(0, 40)}`);
console.log(`  partial2.aggregateDigest[0..40]: ${p2.aggregateDigest.slice(0, 40)}`);
console.log(`  digests match: ${p1.aggregateDigest === p2.aggregateDigest}`);

for (let k = 0; k < 3; k++) {
  const partials = [
    { i: p1.i, c_i: BigInt('0x' + p1.partials[k]) },
    { i: p2.i, c_i: BigInt('0x' + p2.partials[k]) },
  ];
  const m = combinePartials(partials, publicKey, params);
  console.log(
    `option ${k} (stored partials): m = ${m.toString(10).slice(0, 50)}${
      m.toString(10).length > 50 ? '…' : ''
    }`,
  );
}

// Cross-check: encrypt a known m with the stored pub key, partial-decrypt
// using stored shares, and see if combine recovers the m.
console.log('\ncross-check: encrypt m=7 with stored pk, partial-decrypt with stored shares:');
const s1: any = await redis.get(`vohu:proposal:${pid}:share:1`);
const s2: any = await redis.get(`vohu:proposal:${pid}:share:2`);
const s3: any = await redis.get(`vohu:proposal:${pid}:share:3`);
const shares = [s1, s2, s3].filter(Boolean).map(deserializeShare);
console.log(`  loaded ${shares.length} shares`);

const knownM = 7n;
const c = publicKey.encrypt(knownM);
console.log(`  c = ${c.toString(16).slice(0, 40)}…`);

const freshPartials = shares.map(sh => ({
  i: sh.i,
  c_i: partialDecrypt(c, sh, publicKey, params),
}));
for (const fp of freshPartials) {
  console.log(`  trustee ${fp.i}: c_i = ${fp.c_i.toString(16).slice(0, 40)}…`);
}

const recovered = combinePartials(
  [freshPartials[0], freshPartials[1]],
  publicKey,
  params,
);
console.log(`  recovered m = ${recovered}`);
if (recovered === knownM) {
  console.log('  PASS: stored shares are valid for this pub key');
} else {
  console.log(`  FAIL: expected ${knownM}, got ${recovered}`);
  console.log(`  Delta from n: ${publicKey.n - recovered}`);
}

// Now: take stored ballots, compute aggregate, do a FRESH partial decrypt
// with the stored shares, and combine. This isolates whether the bug is in
// the ballot encryption or in the route's partial computation.
console.log('\nfull replay: stored ballots → fresh aggregate → fresh partials → combine');
const ballotLst: any[] = await redis.lrange(`vohu:proposal:${pid}:ballots`, 0, -1);
console.log(`  loaded ${ballotLst.length} ballots from Redis`);
const nSquared = publicKey.n * publicKey.n;
const numOptions = 3;
const aggregate: bigint[] = new Array(numOptions).fill(1n);
for (const raw of ballotLst) {
  const b = typeof raw === 'string' ? JSON.parse(raw) : raw;
  for (let k = 0; k < numOptions; k++) {
    aggregate[k] =
      (aggregate[k] * BigInt('0x' + b.ciphertextVec[k])) % nSquared;
  }
}
console.log(`  aggregate[0..20] per option: ${aggregate.map(a => a.toString(16).slice(0, 20)).join(' | ')}`);

for (let k = 0; k < numOptions; k++) {
  const freshAggPartials = shares.slice(0, 2).map(sh => ({
    i: sh.i,
    c_i: partialDecrypt(aggregate[k], sh, publicKey, params),
  }));
  const m = combinePartials(freshAggPartials, publicKey, params);
  console.log(`  option ${k}: m = ${m}`);
}
