'use client';

import { Suspense, useState } from 'react';
import { MiniKit, VerificationLevel } from '@worldcoin/minikit-js';
import {
  IDKitWidget,
  VerificationLevel as IDKitLevel,
  ISuccessResult,
} from '@worldcoin/idkit';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useInVerifiedHumanContext } from '@/lib/prome';

function LoginInner() {
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const isHuman = useInVerifiedHumanContext();

  const nextUrl = searchParams.get('next') ?? '/';

  const finish = (nullifier: string) => {
    sessionStorage.setItem('nullifier', nullifier);
    router.push(nextUrl);
  };

  const handleMiniKitVerify = async () => {
    setError(null);
    setVerifying(true);
    try {
      const result = await MiniKit.commandsAsync.verify({
        action: process.env.NEXT_PUBLIC_ACTION_ID!,
        verification_level: VerificationLevel.Orb,
      });
      const payload = result.finalPayload;
      if (payload.status === 'success' && 'nullifier_hash' in payload) {
        finish(payload.nullifier_hash);
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

  const handleIDKitSuccess = (result: ISuccessResult) => {
    finish(result.nullifier_hash);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-slate-900 to-black text-white">
      <Link
        href="/"
        className="absolute top-6 left-6 text-xs text-slate-400 hover:text-slate-200"
      >
        ← vohu
      </Link>

      <h1 className="text-4xl font-bold mb-4 tracking-tight">Login</h1>
      <p className="text-sm text-slate-300 mb-10 text-center max-w-xs leading-relaxed">
        Prove you&apos;re a unique human with World ID.
      </p>

      {isHuman === null && (
        <div className="text-sm text-slate-400">Loading…</div>
      )}

      {isHuman === true && (
        <>
          <button
            onClick={handleMiniKitVerify}
            disabled={verifying}
            className="px-8 py-4 bg-white text-black rounded-full font-semibold disabled:opacity-50 active:scale-95 transition-transform"
          >
            {verifying ? 'Verifying…' : 'Verify with World ID'}
          </button>
          <p className="mt-6 text-xs text-slate-500 max-w-xs text-center">
            In World App · Orb verification via MiniKit
          </p>
        </>
      )}

      {isHuman === false && (
        <>
          <IDKitWidget
            app_id={process.env.NEXT_PUBLIC_APP_ID as `app_${string}`}
            action={process.env.NEXT_PUBLIC_ACTION_ID!}
            verification_level={IDKitLevel.Orb}
            onSuccess={handleIDKitSuccess}
            onError={err => setError(err.code ?? 'IDKit error')}
          >
            {({ open }) => (
              <button
                onClick={open}
                className="px-8 py-4 bg-white text-black rounded-full font-semibold active:scale-95 transition-transform"
              >
                Verify with World ID (scan QR)
              </button>
            )}
          </IDKitWidget>
          <p className="mt-6 text-xs text-slate-400 max-w-xs text-center leading-relaxed">
            Scan the QR with World App to verify. Identity unlocks Chrome-viewable
            surfaces (aggregate results). Vote casting still requires opening
            vohu inside World App — that&apos;s the runtime binding.
          </p>
        </>
      )}

      {error && (
        <p className="mt-4 text-sm text-rose-400 max-w-xs text-center">{error}</p>
      )}
    </main>
  );
}

export default function Login() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
