// Thin wrapper over hyde-wasm. Client-only — SoftwareBackend's Primary Key
// lives in WASM linear memory, which doesn't make sense to ship to the server.
//
// This file is a Phase H4 preflight: it verifies that hyde-wasm can be
// imported and used in a Next.js 16 client bundle. The proper vohu
// integration (replacing mock ballot encryption) happens in Phase H4.

'use client';

import init, { HydeWasm } from 'hyde-wasm';

let hydePromise: Promise<HydeWasm> | null = null;

export function getHyde(): Promise<HydeWasm> {
  if (!hydePromise) {
    hydePromise = (async () => {
      await init();
      return new HydeWasm();
    })();
  }
  return hydePromise;
}

export async function protectText(plaintext: string): Promise<Uint8Array> {
  const hyde = await getHyde();
  return hyde.protect(new TextEncoder().encode(plaintext));
}

export async function unprotectText(blob: Uint8Array): Promise<string> {
  const hyde = await getHyde();
  return new TextDecoder().decode(hyde.unprotect(blob));
}
