import { NextRequest, NextResponse } from 'next/server';
import { verifyMessage } from 'viem';
import { ballotCount, submitBallot } from '@/lib/store';
import { getProposal } from '@/lib/proposal';
import { attributionMessage } from '@/lib/attribution';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Attribution {
  address: string;
  nonce: string;
  signature: `0x${string}`;
}

function isValidAddress(a: unknown): a is string {
  return typeof a === 'string' && /^0x[0-9a-fA-F]{40}$/.test(a);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { proposalId, nullifier, ciphertextVec, attribution } = body as {
    proposalId?: unknown;
    nullifier?: unknown;
    ciphertextVec?: unknown;
    attribution?: unknown;
  };

  if (
    typeof proposalId !== 'string' ||
    typeof nullifier !== 'string' ||
    !Array.isArray(ciphertextVec)
  ) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
  }

  const proposal = await getProposal(proposalId);
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

  // Scope check: if the proposal has an XMTP-group scope, the voter must
  // prove ownership of an allowed Ethereum address. The proof is a signed
  // message: "vohu: voting on <proposalId> as <address> (<nonce>)".
  if (proposal.scope?.kind === 'xmtp-group') {
    if (
      typeof attribution !== 'object' ||
      attribution === null ||
      !isValidAddress((attribution as Attribution).address) ||
      typeof (attribution as Attribution).nonce !== 'string' ||
      typeof (attribution as Attribution).signature !== 'string' ||
      !(attribution as Attribution).signature.startsWith('0x')
    ) {
      return NextResponse.json(
        { error: 'scoped proposal requires signed attribution' },
        { status: 401 },
      );
    }
    const a = attribution as Attribution;
    const address = a.address.toLowerCase();
    if (!proposal.scope.allowedAddresses.includes(address)) {
      return NextResponse.json(
        { error: 'address not in group at snapshot time' },
        { status: 403 },
      );
    }
    const expected = attributionMessage(proposal.id, address, a.nonce);
    let ok = false;
    try {
      ok = await verifyMessage({
        address: a.address as `0x${string}`,
        message: expected,
        signature: a.signature,
      });
    } catch {
      ok = false;
    }
    if (!ok) {
      return NextResponse.json(
        { error: 'signature did not recover to attributed address' },
        { status: 401 },
      );
    }
  }

  const accepted = await submitBallot(proposalId, nullifier, ciphertextVec);
  if (!accepted) {
    return NextResponse.json({ error: 'already voted' }, { status: 409 });
  }

  return NextResponse.json({ ok: true, total: await ballotCount(proposalId) });
}
