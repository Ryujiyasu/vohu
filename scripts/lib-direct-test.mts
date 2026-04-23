// Exercise lib/threshold-paillier.ts directly (no routes, no Redis) to
// isolate any bug in the library from bugs in the storage / serialization
// layer.
//
//   pnpm tsx scripts/lib-direct-test.mts

import { PublicKey } from 'paillier-bigint';
import { hexToBigint, bigintToHex } from 'bigint-conversion';
import {
  thresholdKeygen,
  partialDecrypt,
  combinePartials,
  serializeShare,
  deserializeShare,
} from '../lib/threshold-paillier.ts';
import type { Partial as ThresholdPartial } from '../lib/threshold-paillier.ts';
import { generateKeypair } from '../lib/tally.ts';

function assert(cond: unknown, msg: string) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  console.log('  ok:', msg);
}

console.log('generating 2048-bit Paillier keypair…');
const { publicKey, privateKey } = generateKeypair();
console.log(`  n has ${publicKey.n.toString(2).length} bits`);
console.log(`  lambda has ${privateKey.lambda.toString(2).length} bits`);
console.log(`  mu has ${privateKey.mu.toString(2).length} bits`);

// Sanity: direct decryption works?
const m_direct = 42n;
const c_direct = publicKey.encrypt(m_direct);
const direct_rt = privateKey.decrypt(c_direct);
assert(direct_rt === m_direct, `direct Paillier roundtrip 42 => ${direct_rt}`);

console.log('\nthreshold keygen (N=3, t=2)…');
const ths = thresholdKeygen(privateKey, 3, 2);
console.log(`  threshold params: ${JSON.stringify(ths.params)}`);
console.log(`  shares count: ${ths.shares.length}`);

// Test with plaintext 2 (as if 2 ballots chose this option)
const m = 2n;
const c = publicKey.encrypt(m);
console.log(`\nencrypted plaintext m=${m}, c=${c.toString(16).slice(0, 50)}…`);

// Partial decrypt by each trustee
const partials = ths.shares.map(share => ({
  i: share.i,
  c_i: partialDecrypt(c, share, publicKey, ths.params),
}));
for (const p of partials) {
  console.log(`  trustee ${p.i}: c_i = ${p.c_i.toString(16).slice(0, 40)}…`);
}

// Combine with subset {1, 2}
console.log('\ncombining partials from trustees {1, 2}:');
const subset12: ThresholdPartial[] = [partials[0], partials[1]];
try {
  const recovered12 = combinePartials(subset12, publicKey, ths.params);
  console.log(`  recovered m = ${recovered12}`);
  assert(recovered12 === m, `subset {1,2} recovers m=${m}`);
} catch (e) {
  console.error('  combine {1,2} threw:', e);
  process.exit(1);
}

// Test with subset {1, 3}
console.log('\ncombining partials from trustees {1, 3}:');
const subset13: ThresholdPartial[] = [partials[0], partials[2]];
try {
  const recovered13 = combinePartials(subset13, publicKey, ths.params);
  console.log(`  recovered m = ${recovered13}`);
  assert(recovered13 === m, `subset {1,3} recovers m=${m}`);
} catch (e) {
  console.error('  combine {1,3} threw:', e);
  process.exit(1);
}

// Test with subset {2, 3}
console.log('\ncombining partials from trustees {2, 3}:');
const subset23: ThresholdPartial[] = [partials[1], partials[2]];
try {
  const recovered23 = combinePartials(subset23, publicKey, ths.params);
  console.log(`  recovered m = ${recovered23}`);
  assert(recovered23 === m, `subset {2,3} recovers m=${m}`);
} catch (e) {
  console.error('  combine {2,3} threw:', e);
  process.exit(1);
}

// Test serialization roundtrip of shares
console.log('\nshare serialization roundtrip:');
const serialized = ths.shares.map(serializeShare);
const deserialized = serialized.map(deserializeShare);
for (let i = 0; i < ths.shares.length; i++) {
  assert(
    ths.shares[i].i === deserialized[i].i && ths.shares[i].s === deserialized[i].s,
    `share ${ths.shares[i].i} roundtrip`,
  );
}

console.log('\nall direct-lib tests passed');
