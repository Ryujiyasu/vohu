// GET /api/proposal?proposalId=<id>
//
// Returns proposal metadata, the Paillier public key, and the threshold
// parameters that the voter's client needs. The private decryption key does
// not exist as a single object anywhere — it is split into shares held by the
// proposal's trustees.

import { NextRequest, NextResponse } from 'next/server';
import { getProposal } from '@/lib/proposal';
import { getProposalPublicKey, getThresholdParams } from '@/lib/keys';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const proposalId = req.nextUrl.searchParams.get('proposalId');
  if (!proposalId) {
    return NextResponse.json({ error: 'no proposalId' }, { status: 400 });
  }
  const proposal = await getProposal(proposalId);
  if (!proposal) {
    return NextResponse.json({ error: 'unknown proposal' }, { status: 404 });
  }
  const [publicKey, thresholdParams] = await Promise.all([
    getProposalPublicKey(proposalId),
    getThresholdParams(proposalId),
  ]);
  return NextResponse.json({ proposal, publicKey, thresholdParams });
}
