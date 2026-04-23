// Shared helper: the canonical attribution message a voter signs to prove
// ownership of an Ethereum address when casting a ballot on a scoped
// proposal.
//
// The server (POST /api/vote) re-derives the same string and verifies the
// signature recovers to the claimed address. Keeping the message format in
// one place prevents subtle string-mismatch bugs between client and server.

export function attributionMessage(
  proposalId: string,
  address: string,
  nonce: string,
): string {
  return `vohu: voting on ${proposalId} as ${address.toLowerCase()} (${nonce})`;
}
