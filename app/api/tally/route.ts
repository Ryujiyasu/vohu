// GET /api/tally?proposalId=<id>
//
// Server-side homomorphic aggregation + conditional threshold decryption.
//
// Algorithm:
//   1. Load all submitted ballots.
//   2. Homomorphically combine them (component-wise ∏) into a single
//      aggregate ciphertext vector — one ciphertext per option.
//   3. Compute the aggregate's digest and load any trustee partials that
//      were signed against the SAME digest.
//   4. If at least `threshold` trustees have signed the current aggregate,
//      combine their partials to recover the plaintext counts.
//   5. Otherwise, return an "awaiting trustees" shape so the UI can display
//      the approval status.
//
// The server itself NEVER holds enough key material to decrypt. Even if it
// has all N shares in storage (v1 demo co-location), the API path that
// decrypts requires each trustee to submit their partial — the /api/trustee
// route is where that happens. The route below is pure combine.

import { NextRequest, NextResponse } from 'next/server';
import { ballotCount, getBallots } from '@/lib/store';
import { getProposal } from '@/lib/proposal';
import { getPublicKey, getThresholdParams } from '@/lib/keys';
import {
  Partial as ThresholdPartial,
  combinePartials,
} from '@/lib/threshold-paillier';
import { aggregateDigest, loadPartials } from '@/lib/partials';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const proposalId = req.nextUrl.searchParams.get('proposalId');
  if (!proposalId) {
    return NextResponse.json({ error: 'no proposalId' }, { status: 400 });
  }

  const proposal = getProposal(proposalId);
  if (!proposal) {
    return NextResponse.json({ error: 'unknown proposal' }, { status: 404 });
  }

  const [total, ballots, publicKey, thresholdParams] = await Promise.all([
    ballotCount(proposalId),
    getBallots(proposalId),
    getPublicKey(proposalId),
    getThresholdParams(proposalId),
  ]);

  const ciphertextPreview = ballots
    .slice(-10)
    .map(b => b.ciphertextVec.map(ct => ct.slice(0, 64)));

  // Homomorphic aggregate per option.
  const nSquared = publicKey.n * publicKey.n;
  const numOptions = proposal.options.length;
  const aggregate: bigint[] = new Array(numOptions).fill(1n);
  for (const b of ballots) {
    if (b.ciphertextVec.length !== numOptions) continue;
    for (let k = 0; k < numOptions; k++) {
      aggregate[k] =
        (aggregate[k] * BigInt('0x' + b.ciphertextVec[k])) % nSquared;
    }
  }
  const digest = aggregateDigest(aggregate);

  // Load trustee partials that were signed against this exact aggregate.
  const allPartials = await loadPartials(proposalId, thresholdParams.totalParties);
  const freshPartials = allPartials.filter(p => p.aggregateDigest === digest);
  const approvals = freshPartials.map(p => p.i).sort((a, b) => a - b);

  const approved = approvals.length >= thresholdParams.threshold;

  if (!approved || total === 0) {
    return NextResponse.json({
      proposal,
      total,
      revealed: false,
      counts: null,
      approvals,
      threshold: thresholdParams.threshold,
      totalParties: thresholdParams.totalParties,
      ciphertextPreview,
    });
  }

  const counts: number[] = [];
  for (let k = 0; k < numOptions; k++) {
    const partials: ThresholdPartial[] = freshPartials
      .slice(0, thresholdParams.threshold)
      .map(p => ({ i: p.i, c_i: BigInt('0x' + p.partials[k]) }));
    const m = combinePartials(partials, publicKey, thresholdParams);
    counts.push(Number(m));
  }

  return NextResponse.json({
    proposal,
    total,
    revealed: true,
    counts,
    approvals,
    threshold: thresholdParams.threshold,
    totalParties: thresholdParams.totalParties,
    ciphertextPreview,
  });
}
