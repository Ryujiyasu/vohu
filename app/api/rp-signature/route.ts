// POST /api/rp-signature
//
// Produces the RP signature that IDKit v4 requires as part of the
// rp_context it sends to the bridge. World ID 4.0's proof protocol binds
// each uniqueness request to a fresh RP-signed nonce so a forwarded QR
// can't be replayed against another app's session.
//
// Body:  { action: string }
// Reply: { sig, nonce, created_at, expires_at }

import { NextResponse } from 'next/server';
import { signRequest } from '@worldcoin/idkit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { action } = body as { action?: unknown };
  if (typeof action !== 'string' || !action.trim()) {
    return NextResponse.json({ error: 'invalid action' }, { status: 400 });
  }

  const signingKeyHex =
    process.env.RP_SIGNING_KEY ?? process.env.WORLDCOIN_SIGNER_PRIVATE_KEY;
  if (!signingKeyHex) {
    return NextResponse.json(
      { error: 'signing key not configured' },
      { status: 500 },
    );
  }

  const { sig, nonce, createdAt, expiresAt } = signRequest({
    signingKeyHex,
    action,
  });

  return NextResponse.json({
    sig,
    nonce,
    created_at: createdAt,
    expires_at: expiresAt,
  });
}
