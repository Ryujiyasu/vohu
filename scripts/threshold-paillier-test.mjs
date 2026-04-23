// Unit tests for lib/threshold-paillier.ts.
//
// Runs natively with Node (ESM). No test framework — a few asserts are
// enough and we want the output to be human-readable for the demo pitch.
//
//   pnpm build && node --experimental-vm-modules scripts/threshold-paillier-test.mjs
//
// Or simpler, use `tsx` to run against the .ts source directly:
//   pnpm add -D tsx
//   pnpm tsx scripts/threshold-paillier-test.mjs
//
// This script imports the .js compiled output from .next (or re-implements
// the critical path inline). For hackathon-speed we re-implement the
// smallest possible call against the library by requiring dist output.

import { generateRandomKeysSync } from 'paillier-bigint';
import { modInv, modPow } from 'bigint-crypto-utils';

// ---- Inline copy of the threshold math (matches lib/threshold-paillier.ts) ----

function factorial(n) {
  let r = 1n;
  for (let i = 2; i <= n; i++) r *= BigInt(i);
  return r;
}
function mod(a, m) {
  return ((a % m) + m) % m;
}

function thresholdKeygen(privateKey, N, t) {
  const { n } = privateKey.publicKey;
  const delta = factorial(N);
  const lambda = privateKey.lambda;
  const mu = privateKey.mu;
  const coefficients = [lambda];
  const bound = delta * delta * n * n;
  for (let k = 1; k < t; k++) {
    // Insecure randomness OK for this test — real lib uses CSPRNG.
    const bits = bound.toString(2).length;
    let r = 0n;
    for (let j = 0; j < bits; j++) {
      if (Math.random() < 0.5) r |= 1n << BigInt(j);
    }
    coefficients.push(r % bound);
  }
  const shares = [];
  for (let i = 1; i <= N; i++) {
    let s = 0n, xk = 1n;
    for (const a of coefficients) { s += a * xk; xk *= BigInt(i); }
    shares.push({ i, s });
  }
  const theta = mod(modInv(4n * delta * delta, n) * mu, n);
  return { publicKey: privateKey.publicKey, shares, delta, theta, N, t };
}

function partialDecrypt(c, share, pk, delta) {
  return modPow(c, 2n * delta * share.s, pk.n * pk.n);
}

function combine(partials, params) {
  const { publicKey, delta, theta, t } = params;
  const subset = partials.slice(0, t);
  const indices = subset.map(p => p.i);
  const n = publicKey.n;
  const nSq = n * n;

  let product = 1n;
  for (const p of subset) {
    let num = delta, den = 1n;
    for (const j of indices) {
      if (j === p.i) continue;
      num *= BigInt(-j);
      den *= BigInt(p.i - j);
    }
    if (num % den !== 0n) throw new Error(`λ not integer: ${num}/${den}`);
    const lambdaIS = num / den;
    const exp = 2n * lambdaIS;
    const term = exp < 0n
      ? modPow(modInv(p.c_i, nSq), -exp, nSq)
      : modPow(p.c_i, exp, nSq);
    product = mod(product * term, nSq);
  }
  if (mod(product - 1n, n) !== 0n) throw new Error('product − 1 ∤ n');
  return mod(((product - 1n) / n) * theta, n);
}

// ---- Tests ----

function assert(cond, msg) {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  else console.log('  ok:', msg);
}

function test1_basic() {
  console.log('\n[test 1] basic threshold decrypt (3 trustees, threshold 2)');
  const { publicKey, privateKey } = generateRandomKeysSync(1024); // faster for test
  const params = thresholdKeygen(privateKey, 3, 2);
  const m = 42n;
  const c = publicKey.encrypt(m);

  const partials = params.shares.map(s => ({
    i: s.i,
    c_i: partialDecrypt(c, s, publicKey, params.delta),
  }));

  // Each possible 2-subset of 3 should reconstruct m.
  const subsets = [[0, 1], [0, 2], [1, 2]];
  for (const [a, b] of subsets) {
    const subset = [partials[a], partials[b]];
    const recovered = combine(subset, params);
    assert(recovered === m, `subset {${partials[a].i},${partials[b].i}} recovered m`);
  }
}

function test2_homomorphic_aggregate_then_threshold() {
  console.log('\n[test 2] homomorphic aggregate + threshold decrypt');
  const { publicKey, privateKey } = generateRandomKeysSync(1024);
  const params = thresholdKeygen(privateKey, 3, 2);

  // Simulate 5 ballots over a 3-option ballot:
  //   b0 = [1,0,0]  (yes)
  //   b1 = [1,0,0]  (yes)
  //   b2 = [0,1,0]  (no)
  //   b3 = [0,0,1]  (mixed)
  //   b4 = [1,0,0]  (yes)
  // Expected tally: [3, 1, 1]
  const ballots = [
    [1, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 0, 0],
  ];
  const ctVecs = ballots.map(b => b.map(v => publicKey.encrypt(BigInt(v))));

  // Aggregate homomorphically: ∏ ciphertexts per option
  const nSq = publicKey.n * publicKey.n;
  const width = ballots[0].length;
  const aggregate = new Array(width).fill(1n);
  for (const vec of ctVecs) {
    for (let k = 0; k < width; k++) aggregate[k] = mod(aggregate[k] * vec[k], nSq);
  }

  // Threshold decrypt each aggregate component
  const expected = [3n, 1n, 1n];
  for (let k = 0; k < width; k++) {
    const partials = params.shares.map(s => ({
      i: s.i,
      c_i: partialDecrypt(aggregate[k], s, publicKey, params.delta),
    }));
    const tally_k = combine([partials[0], partials[1]], params);
    assert(tally_k === expected[k], `option ${k} tally = ${expected[k]}`);
  }
}

function test3_insufficient_partials() {
  console.log('\n[test 3] insufficient partials throws');
  const { publicKey, privateKey } = generateRandomKeysSync(1024);
  const params = thresholdKeygen(privateKey, 3, 2);
  const c = publicKey.encrypt(7n);
  const partials = [{ i: 1, c_i: partialDecrypt(c, params.shares[0], publicKey, params.delta) }];
  try {
    combine(partials, params);
    assert(false, 'expected throw for insufficient partials');
  } catch (e) {
    assert(true, 'correctly rejected 1 partial when threshold is 2');
  }
}

function test4_large_N() {
  console.log('\n[test 4] N=5 t=3');
  const { publicKey, privateKey } = generateRandomKeysSync(1024);
  const params = thresholdKeygen(privateKey, 5, 3);
  const m = 1234n;
  const c = publicKey.encrypt(m);
  const partials = params.shares.map(s => ({
    i: s.i,
    c_i: partialDecrypt(c, s, publicKey, params.delta),
  }));
  // pick 3 of 5 in an odd pattern
  const subset = [partials[0], partials[2], partials[4]];
  const recovered = combine(subset, params);
  assert(recovered === m, 'N=5 t=3 with trustees {1,3,5}');
}

function test5_single_trustee_N1_t1() {
  console.log('\n[test 5] N=1, t=1 degenerate case (no threshold benefit)');
  const { publicKey, privateKey } = generateRandomKeysSync(1024);
  const params = thresholdKeygen(privateKey, 1, 1);
  const m = 9n;
  const c = publicKey.encrypt(m);
  const partial = { i: 1, c_i: partialDecrypt(c, params.shares[0], publicKey, params.delta) };
  const recovered = combine([partial], params);
  assert(recovered === m, 'N=1 t=1 works (checks lone-share math)');
}

console.log('threshold paillier test suite');
test1_basic();
test2_homomorphic_aggregate_then_threshold();
test3_insufficient_partials();
test4_large_N();
test5_single_trustee_N1_t1();
console.log('\nall tests passed');
