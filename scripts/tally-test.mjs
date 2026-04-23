// End-to-end smoke test for vohu's Paillier homomorphic tally.
// Assumes dev server is running at http://localhost:3000.
//
// Casts three ballots via /api/vote: yes, yes, no.
// Then hits /api/tally and verifies the decrypted aggregate is [2, 1, 0].

import { PublicKey } from 'paillier-bigint';
import { hexToBigint, bigintToHex } from 'bigint-conversion';

const BASE = process.env.BASE ?? 'http://localhost:3000';
const PROPOSAL_ID = 'demo-2026-04';

async function main() {
  const proposalRes = await fetch(
    `${BASE}/api/proposal?proposalId=${encodeURIComponent(PROPOSAL_ID)}`,
  );
  const { proposal, publicKey } = await proposalRes.json();
  console.log('proposal options:', proposal.options.map(o => o.id));
  const pk = new PublicKey(
    hexToBigint(publicKey.n),
    hexToBigint(publicKey.g),
  );

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
    console.log(`vote ${nullifier} -> choice ${choiceIdx}:`, r.status);
  }

  // Fresh nullifiers each run (timestamp prefix avoids replay dedup issues).
  const stamp = Date.now();
  await castBallot(`test-${stamp}-a`, 0); // yes
  await castBallot(`test-${stamp}-b`, 0); // yes
  await castBallot(`test-${stamp}-c`, 1); // no

  const tallyRes = await fetch(
    `${BASE}/api/tally?proposalId=${encodeURIComponent(PROPOSAL_ID)}`,
  );
  const tally = await tallyRes.json();
  console.log('\naggregate:');
  for (let i = 0; i < proposal.options.length; i++) {
    console.log(`  ${proposal.options[i].id.padEnd(8)} = ${tally.counts[i]}`);
  }
  console.log('\ntotal ballots cast:', tally.total);
  console.log('ciphertext preview length:', tally.ciphertextPreview.length);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
