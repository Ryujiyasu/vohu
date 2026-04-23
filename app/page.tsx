'use client';

import { useState } from 'react';
import { MiniKit, VerificationLevel } from '@worldcoin/minikit-js';
import { useRouter } from 'next/navigation';
import { useInVerifiedHumanContext } from '@/lib/prome';

export default function Home() {
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const isHuman = useInVerifiedHumanContext();

  const handleVerify = async () => {
    setError(null);
    const inWorldApp =
      typeof window !== 'undefined' && typeof window.WorldApp !== 'undefined';
    if (!inWorldApp) {
      setError('Open this in World App to verify.');
      return;
    }
    setVerifying(true);
    try {
      const result = await MiniKit.commandsAsync.verify({
        action: process.env.NEXT_PUBLIC_ACTION_ID!,
        verification_level: VerificationLevel.Orb,
      });
      const payload = result.finalPayload;
      if (payload.status === 'success' && 'nullifier_hash' in payload) {
        sessionStorage.setItem('nullifier', payload.nullifier_hash);
        router.push('/vote');
      } else {
        setError('Verification did not complete.');
      }
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-slate-900 to-black text-white">
      <h1 className="text-5xl font-bold mb-4 tracking-tight">vohu</h1>
      <p className="text-lg text-slate-300 mb-12 text-center">
        Encrypted votes<br />for verified humans
      </p>

      <button
        onClick={handleVerify}
        disabled={verifying}
        className="px-8 py-4 bg-white text-black rounded-full font-semibold disabled:opacity-50 active:scale-95 transition-transform"
      >
        {verifying ? 'Verifying…' : 'Verify with World ID'}
      </button>

      {error && (
        <p className="mt-4 text-sm text-rose-400 max-w-xs text-center">{error}</p>
      )}

      <p className="mt-8 text-xs text-slate-500 max-w-xs text-center leading-relaxed">
        Your identity stays private.<br />
        Your vote stays encrypted.<br />
        Even we can&apos;t see who voted for what.
      </p>

      {isHuman === false && (
        <p className="mt-10 text-xs text-emerald-400 font-mono max-w-xs text-center leading-relaxed">
          ↓ Everything past this point is cryptographically invisible here.<br />
          Open vohu in World App to decrypt.
        </p>
      )}

      <a
        href="/demos"
        className="mt-12 text-[11px] text-slate-500 underline hover:text-slate-300 tracking-wide"
      >
        three bindings, three doors →
      </a>
    </main>
  );
}
