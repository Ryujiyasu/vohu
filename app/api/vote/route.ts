import { NextRequest, NextResponse } from 'next/server';
import { VerificationLevel } from '@worldcoin/minikit-js';
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
  const action = process.env.NEXT_PUBLIC_ACTION_ID;
  const rpId = process.env.NEXT_PUBLIC_RP_ID;
  if (!action || !rpId) {
    return NextResponse.json(
      { error: 'server missing action_id / rp_id env' },
      { status: 500 },
    );
  }
  // World ID 4.0 (Managed mode) verification path:
  // POST the IDKit-shaped legacy-v3 envelope to the v4 endpoint scoped by
  // rp_id. The legacy /api/v2/verify endpoint at developer.worldcoin.org no
  // longer recognises actions registered under the new v4 portal, so a
  // direct fetch is mandatory — verifyCloudProof would 404 with
  // "Action not found".
  const idkitPayload = {
    protocol_version: '3.0' as const,
    nonce: crypto.randomUUID(),
    action,
    environment: 'production' as const,
    responses: [
      {
        identifier:
          worldIdProof.verification_level === VerificationLevel.Orb
            ? 'orb'
            : 'device',
        signal_hash:
          '0x00c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a4',
        proof: worldIdProof.proof,
        merkle_root: worldIdProof.merkle_root,
        nullifier: worldIdProof.nullifier_hash,
      },
    ],
  };
  const verifyRes = await fetch(
    `https://developer.world.org/api/v4/verify/${rpId}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(idkitPayload),
    },
  );
  if (!verifyRes.ok) {
    const detail = await verifyRes.text().catch(() => '');
    return NextResponse.json(
      {
        error: `World ID verification failed (HTTP ${verifyRes.status})`,
        detail,
      },
      { status: 401 },
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
