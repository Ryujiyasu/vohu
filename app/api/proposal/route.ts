// GET /api/proposal?proposalId=<id>
// Returns public proposal metadata and the Paillier public key needed to
// encrypt a ballot client-side. The private key is never exposed.

import { NextRequest, NextResponse } from 'next/server';
import { getProposal } from '@/lib/proposal';
import { getProposalPublicKey } from '@/lib/keys';

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
  const publicKey = await getProposalPublicKey(proposalId);
  return NextResponse.json({ proposal, publicKey });
}
