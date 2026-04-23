// POST /api/trustee/approve
//
//   body: { proposalId, trusteeIndex }
//
// v1 semantics (demo-simplified):
//   - The server has co-located shares for all N trustees (documented
//     limitation; production delivers shares out-of-band to each trustee).
//   - This route accepts an "approve" intent from a given trustee index,
//     reads that trustee's share, computes the partial decryption of the
//     current aggregate-ciphertext vector, and stores it.
//
// When at least `threshold` trustees have approved against the CURRENT
// aggregate, GET /api/tally returns the revealed plaintext counts. Each
// approval is bound to the aggregate digest at the time of signing — if
// new ballots arrive after a trustee approves, their partial is
// invalidated and they must approve again.

import { NextRequest, NextResponse } from 'next/server';
import { getBallots } from '@/lib/store';
import { getProposal } from '@/lib/proposal';
import {
  getPublicKey,
  getThresholdParams,
  getTrusteeShare,
} from '@/lib/keys';
import { partialDecrypt } from '@/lib/threshold-paillier';
import { aggregateDigest, savePartial } from '@/lib/partials';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { proposalId, trusteeIndex } = await req.json().catch(() => ({}));
  if (typeof proposalId !== 'string' || typeof trusteeIndex !== 'number') {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
  }

  const proposal = getProposal(proposalId);
  if (!proposal) {
    return NextResponse.json({ error: 'unknown proposal' }, { status: 404 });
  }

  const [share, publicKey, thresholdParams, ballots] = await Promise.all([
    getTrusteeShare(proposalId, trusteeIndex),
    getPublicKey(proposalId),
    getThresholdParams(proposalId),
    getBallots(proposalId),
  ]);

  if (!share) {
    return NextResponse.json(
      { error: `trustee ${trusteeIndex} not found` },
      { status: 404 },
    );
  }
  if (ballots.length === 0) {
    return NextResponse.json(
      { error: 'no ballots yet' },
      { status: 409 },
    );
  }

  // Recompute aggregate.
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

  // Produce partials for each aggregate component.
  const partials = aggregate.map(c =>
    partialDecrypt(c, share, publicKey, thresholdParams).toString(16),
  );

  await savePartial(proposalId, {
    i: trusteeIndex,
    aggregateDigest: digest,
    partials,
    submittedAt: Date.now(),
  });

  return NextResponse.json({
    ok: true,
    trusteeIndex,
    ballotCount: ballots.length,
    aggregateDigest: digest,
  });
}
