'use client';

import { obfuscate } from '@/lib/prome';

export function ObfuscatedScreen({ plaintext }: { plaintext: string }) {
  const cipher = obfuscate(plaintext.repeat(8));
  return (
    <main className="min-h-screen bg-black text-emerald-400 font-mono p-6 pb-40">
      <pre className="whitespace-pre-wrap break-words text-xs opacity-70">
        {cipher}
      </pre>
      <div className="fixed bottom-8 left-0 right-0 text-center text-white font-sans px-6">
        <p className="mb-2">🔒 This content is encrypted to verified humans.</p>
        <p className="text-sm text-slate-400">Open in World App to decrypt.</p>
      </div>
    </main>
  );
}
