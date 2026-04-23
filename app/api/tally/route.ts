// GET /api/tally?proposalId=<id>
//
// Server-side homomorphic aggregation. Multiplies all stored ciphertexts
// (component-wise) into a single aggregate ciphertext, then decrypts the
// aggregate only. Individual ballots are never decrypted — even by this
// route.
//
// The returned preview list of ciphertexts is intentionally included so the
// /result UI can show "what the server sees" alongside the decrypted
// aggregate.

import { NextRequest, NextResponse } from 'next/server';
import { getBallots, ballotCount } from '@/lib/store';
import { getProposal } from '@/lib/proposal';
import { getProposalPrivateKey } from '@/lib/keys';
import { aggregateBallots, decryptTally } from '@/lib/tally';

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

  const [total, ballots, sk] = await Promise.all([
    ballotCount(proposalId),
    getBallots(proposalId),
    getProposalPrivateKey(proposalId),
  ]);

  const ciphertextPreview = ballots
    .slice(-10) // last 10 for display
    .map(b => b.ciphertextVec.map(ct => ct.slice(0, 64)));

  if (ballots.length === 0) {
    return NextResponse.json({
      proposal,
      total: 0,
      counts: proposal.options.map(() => 0),
      ciphertextPreview,
      revealed: true,
    });
  }

  const aggregate = aggregateBallots(
    sk.publicKey,
    ballots.map(b => b.ciphertextVec),
  );
  const counts = decryptTally(sk, aggregate);

  return NextResponse.json({
    proposal,
    total,
    counts,
    ciphertextPreview,
    revealed: true,
  });
}
