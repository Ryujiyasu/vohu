import { NextRequest, NextResponse } from 'next/server';
import { verifyCloudProof, VerificationLevel } from '@worldcoin/minikit-js';
import { verifyMessage } from 'viem';
import { ballotCount, submitBallot } from '@/lib/store';
import { getProposal, proposalPhase } from '@/lib/proposal';
import { attributionMessage } from '@/lib/attribution';
import { buildReceiptMessage } from '@/lib/receipt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Attribution {
  address: string;
  nonce: string;
  signature: `0x${string}`;
}

interface WorldIdProof {
  proof: string;
  merkle_root: string;
  nullifier_hash: string;
  verification_level: VerificationLevel;
}

function isValidAddress(a: unknown): a is string {
  return typeof a === 'string' && /^0x[0-9a-fA-F]{40}$/.test(a);
}

function isValidWorldIdProof(p: unknown): p is WorldIdProof {
  if (!p || typeof p !== 'object') return false;
  const o = p as Record<string, unknown>;
  return (
    typeof o.proof === 'string' &&
    typeof o.merkle_root === 'string' &&
    typeof o.nullifier_hash === 'string' &&
    typeof o.verification_level === 'string'
  );
}

async function computeBallotDigest(ciphertextVec: string[]): Promise<string> {
  const encoded = new TextEncoder().encode(ciphertextVec.join('\n'));
  const hash = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const {
    proposalId,
    nullifier,
    ciphertextVec,
    worldIdProof,
    ballotDigest,
    issuedAt,
    deviceSignature,
    deviceAddress,
    attribution,
  } = body as {
    proposalId?: unknown;
    nullifier?: unknown;
    ciphertextVec?: unknown;
    worldIdProof?: unknown;
    ballotDigest?: unknown;
    issuedAt?: unknown;
    deviceSignature?: unknown;
    deviceAddress?: unknown;
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

  // Phase gate: ballots only accepted while voting is open. Once the
  // close time is past, the aggregate is frozen so trustee approvals
  // can accumulate undisturbed.
  const phase = proposalPhase(proposal);
  if (phase === 'tallying') {
    return NextResponse.json(
      {
        error: 'voting has closed for this proposal',
        code: 'voting_closed',
        closedAt: proposal.votesCloseAt,
        phase,
      },
      { status: 403 },
    );
  }

  // -- Identity binding: World ID cloud-side proof verification.
  //
  // Rejects any ballot whose nullifier was not produced by a real
  // Orb-verified human performing the registered action. A spoofed
  // nullifier_hash string cannot survive this step — World ID checks
  // the Groth16 proof against the Merkle root of currently-enrolled
  // identities.
  if (!isValidWorldIdProof(worldIdProof)) {
    return NextResponse.json(
      { error: 'worldIdProof required' },
      { status: 401 },
    );
  }
  if (worldIdProof.nullifier_hash !== nullifier) {
    return NextResponse.json(
      { error: 'nullifier mismatch between body and proof' },
      { status: 400 },
    );
  }
  const appId = process.env.NEXT_PUBLIC_APP_ID as `app_${string}` | undefined;
  const action = process.env.NEXT_PUBLIC_ACTION_ID;
  if (!appId || !action) {
    return NextResponse.json(
      { error: 'server missing app_id / action_id env' },
      { status: 500 },
    );
  }
  const proofResult = await verifyCloudProof(worldIdProof, appId, action);
  if (!proofResult.success) {
    const code = proofResult.code ?? 'unknown';
    // Map World ID's cloud-side codes to user-facing errors. The most
    // common hit in practice is max_verifications_reached — the World ID
    // action has a per-human verification cap that's orthogonal to
    // vohu's per-proposal nullifier dedup, so an already-voted human
    // looks to the cloud like a second verification attempt.
    let error: string;
    let status = 401;
    switch (code) {
      case 'max_verifications_reached':
      case 'already_signed_up':
        error =
          "This World ID has already voted on this action. Each human can cast one ballot per World ID action; vohu's proposal-level dedup is separate. Raise the action's 'Max verifications per user' in the Developer Portal to allow re-verification across proposals.";
        status = 409;
        break;
      case 'invalid_merkle_root':
      case 'root_too_old':
        error =
          'World ID identity tree has rotated since you verified. Log out and verify again.';
        break;
      case 'invalid_proof':
        error =
          'World ID proof is cryptographically invalid — client likely tampered with the payload.';
        break;
      case 'invalid_credential_type':
        error =
          'The action is configured for a different verification level than what the client produced.';
        break;
      default:
        error = `World ID verification rejected with code "${code}".`;
    }
    return NextResponse.json(
      {
        error,
        code,
        detail: proofResult.detail ?? null,
      },
      { status },
    );
  }

  // -- Device binding: in-app wallet signature over the ballot payload.
  //
  // The signing key lives in the voter's World App secure element
  // (Secure Enclave / StrongBox) and cannot be exported. A coercer
  // who obtains the nullifier alone cannot reproduce this signature,
  // because the device holds it. Re-derive the canonical message
  // server-side so the client can't swap in a different payload.
  if (
    typeof ballotDigest !== 'string' ||
    typeof issuedAt !== 'string' ||
    typeof deviceSignature !== 'string' ||
    !isValidAddress(deviceAddress)
  ) {
    return NextResponse.json(
      { error: 'device signature fields missing' },
      { status: 400 },
    );
  }
  const expectedDigest = await computeBallotDigest(ciphertextVec as string[]);
  if (expectedDigest !== ballotDigest) {
    return NextResponse.json(
      { error: 'ballotDigest does not match ciphertextVec' },
      { status: 400 },
    );
  }
  const expectedMessage = buildReceiptMessage({
    proposalId,
    nullifier,
    ballotDigest: expectedDigest,
    issuedAt,
  });
  let sigOk = false;
  try {
    sigOk = await verifyMessage({
      address: deviceAddress as `0x${string}`,
      message: expectedMessage,
      signature: deviceSignature as `0x${string}`,
    });
  } catch {
    sigOk = false;
  }
  if (!sigOk) {
    return NextResponse.json(
      { error: 'device signature did not recover to claimed address' },
      { status: 401 },
    );
  }

  // -- Optional scope binding (XMTP group). Unchanged from v1.
  //
  // A scoped proposal requires the voter to additionally prove
  // ownership of an allow-listed Ethereum address at snapshot time.
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

  // Record the ballot. Keyed by nullifier in storage, so a second
  // submission during the voting phase overwrites the first —
  // voters can revise until the close time.
  const outcome = await submitBallot(proposalId, nullifier, ciphertextVec);

  return NextResponse.json({
    ok: true,
    outcome,
    total: await ballotCount(proposalId),
    phase,
    votesCloseAt: proposal.votesCloseAt,
  });
}
