import { NextRequest, NextResponse } from 'next/server';
import { ballotCount, submitBallot } from '@/lib/store';
import { getProposal } from '@/lib/proposal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { proposalId, nullifier, ciphertextVec } = await req
    .json()
    .catch(() => ({}));

  if (
    typeof proposalId !== 'string' ||
    typeof nullifier !== 'string' ||
    !Array.isArray(ciphertextVec)
  ) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
  }

  const proposal = getProposal(proposalId);
  if (!proposal) {
    return NextResponse.json({ error: 'unknown proposal' }, { status: 404 });
  }

  if (
    ciphertextVec.length !== proposal.options.length ||
    !ciphertextVec.every(v => typeof v === 'string')
  ) {
    return NextResponse.json(
      { error: 'ciphertext vector shape mismatch' },
      { status: 400 },
    );
  }

  const accepted = await submitBallot(proposalId, nullifier, ciphertextVec);
  if (!accepted) {
    return NextResponse.json({ error: 'already voted' }, { status: 409 });
  }

  return NextResponse.json({ ok: true, total: await ballotCount(proposalId) });
}
