// XMTP signer that delegates to MiniKit.
//
// XMTP's browser-sdk expects a signer with:
//   - getIdentifier(): returns { identifier, identifierKind }
//   - signMessage(message: string): returns Uint8Array
//
// We wrap MiniKit's walletAuth (to establish the user's Ethereum address once)
// and signMessage (to sign the installation + group ops XMTP will need later).
// Each signMessage call surfaces the World App's native signing sheet to the
// user — inconvenient but honest.

'use client';

import { MiniKit } from '@worldcoin/minikit-js';
import type { Signer } from '@xmtp/browser-sdk';

/** Convert a 0x-prefixed hex string to Uint8Array. */
export function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** Request the user's Ethereum address via SIWE (walletAuth). */
export async function getUserAddress(): Promise<string> {
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const result = await MiniKit.commandsAsync.walletAuth({
    nonce,
    expirationTime: new Date(Date.now() + 60 * 60 * 1000),
    requestId: crypto.randomUUID(),
    statement: 'Sign in with World ID to use vohu group scoping.',
  });
  const payload = result.finalPayload;
  if (payload.status !== 'success') {
    throw new Error('walletAuth was not successful');
  }
  // MiniKit returns the address on the result object
  const address = (payload as unknown as { address?: string }).address;
  if (!address) throw new Error('walletAuth did not return an address');
  return address;
}

/** Build an XMTP signer backed by MiniKit for the given EOA address. */
export function createMiniKitSigner(address: string): Signer {
  return {
    type: 'EOA',
    getIdentifier: () => ({
      identifier: address.toLowerCase(),
      identifierKind: 'Ethereum' as unknown as never,
    }),
    signMessage: async (message: string) => {
      const res = await MiniKit.commandsAsync.signMessage({ message });
      const payload = res.finalPayload;
      if (payload.status !== 'success') {
        throw new Error(
          `signMessage rejected: ${JSON.stringify(payload)}`,
        );
      }
      const sig = (payload as unknown as { signature: string }).signature;
      return hexToBytes(sig);
    },
  };
}
