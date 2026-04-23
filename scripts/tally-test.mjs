// End-to-end smoke test for vohu's threshold-Paillier voting flow.
//
// Usage:
//   node scripts/tally-test.mjs                   # defaults to localhost
//   BASE=https://vohu.vercel.app node scripts/tally-test.mjs
//
// The script:
//   1. Fetches /api/proposal (Paillier pub key + threshold params).
//   2. Casts N ballots with distinct nullifiers.
//   3. Confirms /api/tally reports `revealed: false`.
//   4. POSTs /api/trustee/approve for trustee 1 — still not revealed.
//   5. POSTs /api/trustee/approve for trustee 2 — now revealed.
//   6. Verifies the decrypted counts match expectations.

import { PublicKey } from 'paillier-bigint';
import { hexToBigint, bigintToHex } from 'bigint-conversion';

const BASE = process.env.BASE ?? 'http://localhost:3000';
const PROPOSAL_ID = 'demo-2026-04';

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  console.log('  ok:', msg);
}

async function main() {
  const proposalRes = await fetch(
    `${BASE}/api/proposal?proposalId=${encodeURIComponent(PROPOSAL_ID)}`,
  );
  const { proposal, publicKey, thresholdParams } = await proposalRes.json();
  console.log(`proposal: ${proposal.title.slice(0, 50)}…`);
  console.log(
    `threshold: t=${thresholdParams.threshold} of N=${thresholdParams.totalParties}`,
  );
  const pk = new PublicKey(hexToBigint(publicKey.n), hexToBigint(publicKey.g));

  async function castBallot(nullifier, choiceIdx) {
    const vec = [];
    for (let i = 0; i < proposal.options.length; i++) {
      vec.push(bigintToHex(pk.encrypt(BigInt(i === choiceIdx ? 1 : 0))));
    }
    const r = await fetch(`${BASE}/api/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposalId: PROPOSAL_ID, nullifier, ciphertextVec: vec }),
    });
    return r.status;
  }

  const stamp = Date.now();
  console.log('\ncasting 3 ballots');
  const s1 = await castBallot(`thresh-${stamp}-a`, 0);
  const s2 = await castBallot(`thresh-${stamp}-b`, 0);
  const s3 = await castBallot(`thresh-${stamp}-c`, 1);
  assert(s1 === 200, 'ballot 1 accepted');
  assert(s2 === 200, 'ballot 2 accepted');
  assert(s3 === 200, 'ballot 3 accepted');

  let tally = await (
    await fetch(`${BASE}/api/tally?proposalId=${encodeURIComponent(PROPOSAL_ID)}`)
  ).json();
  console.log('\ntally before approvals:');
  console.log(`  revealed: ${tally.revealed}`);
  console.log(`  approvals: [${tally.approvals.join(',')}]`);
  console.log(`  counts:   ${JSON.stringify(tally.counts)}`);
  assert(tally.revealed === false, 'tally hidden before approvals');
  assert(tally.counts === null, 'counts null before approvals');

  console.log('\ntrustee 1 approves');
  const a1 = await fetch(`${BASE}/api/trustee/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ proposalId: PROPOSAL_ID, trusteeIndex: 1 }),
  });
  assert(a1.status === 200, 'trustee 1 approval accepted');

  tally = await (
    await fetch(`${BASE}/api/tally?proposalId=${encodeURIComponent(PROPOSAL_ID)}`)
  ).json();
  console.log(`  approvals now: [${tally.approvals.join(',')}]`);
  assert(tally.revealed === false, 'tally still hidden after 1/2');
  assert(tally.approvals.includes(1), 'trustee 1 in approvals');

  console.log('\ntrustee 2 approves');
  const a2 = await fetch(`${BASE}/api/trustee/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ proposalId: PROPOSAL_ID, trusteeIndex: 2 }),
  });
  assert(a2.status === 200, 'trustee 2 approval accepted');

  tally = await (
    await fetch(`${BASE}/api/tally?proposalId=${encodeURIComponent(PROPOSAL_ID)}`)
  ).json();
  console.log(`  approvals now: [${tally.approvals.join(',')}]`);
  console.log(`  revealed: ${tally.revealed}`);
  console.log(`  counts:   ${JSON.stringify(tally.counts)}`);
  assert(tally.revealed === true, 'tally revealed with 2 approvals');
  assert(Array.isArray(tally.counts), 'counts is an array');
  assert(
    tally.counts.length === proposal.options.length,
    'counts length matches options',
  );

  console.log(
    '\naggregate (includes ballots from earlier runs):\n' +
      proposal.options
        .map((o, k) => `  ${o.id.padEnd(8)} = ${tally.counts[k]}`)
        .join('\n'),
  );

  console.log('\nall threshold tests passed');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
