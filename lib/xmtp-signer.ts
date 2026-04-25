// XMTP signer that delegates to MiniKit.
//
// World App wallets are smart contract wallets on World Chain, so MiniKit's
// signMessage returns an EIP-1271 signature, not a raw ECDSA signature. We
// must therefore declare type: 'SCW' and provide the chain id — declaring
// 'EOA' makes XMTP ecrecover the signature, get the wrong address, and bail
// out with SignatureRequestError(UnknownSigner).

'use client';

import { MiniKit } from '@worldcoin/minikit-js';
import { IdentifierKind, type Signer } from '@xmtp/browser-sdk';

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

/** World Chain mainnet chain id — the chain the World App wallet lives on. */
const WORLD_CHAIN_ID = 480n;

/** Build an XMTP signer backed by MiniKit for the given SCW address. */
export function createMiniKitSigner(address: string): Signer {
  return {
    type: 'SCW',
    getIdentifier: () => ({
      identifier: address.toLowerCase(),
      identifierKind: IdentifierKind.Ethereum,
    }),
    getChainId: () => WORLD_CHAIN_ID,
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
