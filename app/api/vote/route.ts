import { NextRequest, NextResponse } from 'next/server';

type Ballot = { nullifier: string; ciphertext: string; receivedAt: number };

const ballots = new Map<string, Ballot[]>();

export async function POST(req: NextRequest) {
  const { proposalId, nullifier, ciphertext } = await req.json().catch(() => ({}));

  if (
    typeof proposalId !== 'string' ||
    typeof nullifier !== 'string' ||
    typeof ciphertext !== 'string'
  ) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
  }

  const existing = ballots.get(proposalId) ?? [];
  if (existing.some(b => b.nullifier === nullifier)) {
    return NextResponse.json({ error: 'already voted' }, { status: 409 });
  }

  existing.push({ nullifier, ciphertext, receivedAt: Date.now() });
  ballots.set(proposalId, existing);

  return NextResponse.json({ ok: true, total: existing.length });
}

export async function GET(req: NextRequest) {
  const proposalId = req.nextUrl.searchParams.get('proposalId');
  if (!proposalId) {
    return NextResponse.json({ error: 'no proposalId' }, { status: 400 });
  }
  const list = ballots.get(proposalId) ?? [];
  return NextResponse.json({
    total: list.length,
    ciphertexts: list.map(b => b.ciphertext),
  });
}
