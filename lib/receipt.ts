// Device-bound ballot receipts.
//
// After a vote is accepted by /api/vote, the client asks MiniKit to
// signMessage() a canonical receipt payload using the user's in-app wallet
// key. That signing key lives in the World App's secure key store
// (Secure Enclave on iOS, StrongBox on Android) and is not exportable —
// so the signature is non-transferable in the sense that matters for
// coercion: a coercer who takes the bytes cannot produce a new
// signature for a fresh challenge, because only the voter's device
// holds the private key.
//
// v1 stores the receipt client-side only (localStorage). The voter
// proves ownership by re-signing a challenge under the same address and
// checking the recovered address matches the stored one via
// viem.verifyMessage. v2 moves the signing key into hyde-backed TPM
// storage on self-host deployments — same protocol, stronger hardware
// attestation.
//
// Receipt format (stable, versioned):
//
//   vohu-receipt/v1
//   proposal=<proposalId>
//   nullifier=<hex>
//   ballot-digest=<sha256-hex>
//   issued-at=<ISO8601 millis>
//
// The server does not hold receipts. They are a purely voter-facing
// artifact for self-proof.

export const RECEIPT_VERSION = 'vohu-receipt/v1';

export interface Receipt {
  version: typeof RECEIPT_VERSION;
  proposalId: string;
  nullifier: string;
  ballotDigest: string;
  issuedAt: string;
  message: string;
  signature: string;
  address: string;
}

export function receiptStorageKey(proposalId: string): string {
  return `vohu-receipt:${proposalId}`;
}

export function buildReceiptMessage(input: {
  proposalId: string;
  nullifier: string;
  ballotDigest: string;
  issuedAt: string;
}): string {
  return [
    RECEIPT_VERSION,
    `proposal=${input.proposalId}`,
    `nullifier=${input.nullifier}`,
    `ballot-digest=${input.ballotDigest}`,
    `issued-at=${input.issuedAt}`,
  ].join('\n');
}

export function buildChallengeMessage(
  receipt: Pick<Receipt, 'proposalId' | 'nullifier'>,
  nonce: string,
): string {
  return [
    'vohu-receipt-challenge/v1',
    `proposal=${receipt.proposalId}`,
    `nullifier=${receipt.nullifier}`,
    `nonce=${nonce}`,
  ].join('\n');
}

export async function ballotDigest(ciphertextVec: string[]): Promise<string> {
  const encoded = new TextEncoder().encode(ciphertextVec.join('\n'));
  const hash = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function loadReceipt(proposalId: string): Receipt | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(receiptStorageKey(proposalId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Receipt;
    if (parsed.version !== RECEIPT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveReceipt(r: Receipt) {
  localStorage.setItem(receiptStorageKey(r.proposalId), JSON.stringify(r));
}

export function clearReceipt(proposalId: string) {
  localStorage.removeItem(receiptStorageKey(proposalId));
}

export function randomNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
