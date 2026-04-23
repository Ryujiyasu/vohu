// Thin wrapper over argo-wasm. Client-only — mirrors lib/hyde.ts.
//
// argo provides the ballot-validity proof layer: it binds the ballot
// (num_options, nullifier, ciphertextVec) to a proof produced by a
// backend (today: mock; later: halo2 / arkworks / risc0) so that
// malformed inputs never reach the tally pipeline.

'use client';

import init, { ArgoBallot, ArgoMock, ArgoProof, argo_version, ballot_validity_kind } from 'argo-wasm';

let initPromise: Promise<void> | null = null;

function ensureInit(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await init();
    })();
  }
  return initPromise;
}

export interface BallotInput {
  numOptions: number;
  nullifier: Uint8Array;
  ciphertexts: Uint8Array[];
}

export interface WitnessInput {
  chosen: number;
  randomness: Uint8Array[];
  secretKey: Uint8Array;
}

function toJsonBytes(arrays: Uint8Array[]): string {
  return JSON.stringify(arrays.map(a => Array.from(a)));
}

export async function buildBallot(ballot: BallotInput): Promise<ArgoBallot> {
  await ensureInit();
  return new ArgoBallot(
    ballot.numOptions,
    ballot.nullifier,
    toJsonBytes(ballot.ciphertexts),
  );
}

export async function proveAndVerify(
  ballot: BallotInput,
  witness: WitnessInput,
): Promise<{
  proof: Uint8Array;
  backend: string;
  statementKind: string;
  publicInputs: Uint8Array;
  verified: boolean;
}> {
  const argoBallot = await buildBallot(ballot);
  const mock = new ArgoMock();
  const argoProof: ArgoProof = mock.prove(
    argoBallot,
    witness.chosen,
    toJsonBytes(witness.randomness),
    witness.secretKey,
  );
  const verified = mock.verify(argoBallot, argoProof);
  return {
    proof: argoProof.data,
    backend: argoProof.backend,
    statementKind: argoBallot.kind,
    publicInputs: argoBallot.public_inputs(),
    verified,
  };
}

export async function argoInfo(): Promise<{ version: string; kind: string }> {
  await ensureInit();
  return { version: argo_version(), kind: ballot_validity_kind() };
}

export { ArgoBallot, ArgoMock, ArgoProof };
