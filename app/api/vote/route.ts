import { NextRequest, NextResponse } from 'next/server';
import { ballotCount, getCiphertexts, submitBallot } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { proposalId, nullifier, ciphertext } = await req.json().catch(() => ({}));

  if (
    typeof proposalId !== 'string' ||
    typeof nullifier !== 'string' ||
    typeof ciphertext !== 'string'
  ) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
  }

  const accepted = await submitBallot(proposalId, nullifier, ciphertext);
  if (!accepted) {
    return NextResponse.json({ error: 'already voted' }, { status: 409 });
  }

  return NextResponse.json({ ok: true, total: await ballotCount(proposalId) });
}

export async function GET(req: NextRequest) {
  const proposalId = req.nextUrl.searchParams.get('proposalId');
  if (!proposalId) {
    return NextResponse.json({ error: 'no proposalId' }, { status: 400 });
  }
  const [total, ciphertexts] = await Promise.all([
    ballotCount(proposalId),
    getCiphertexts(proposalId),
  ]);
  return NextResponse.json({ total, ciphertexts });
}
