'use client';

// Two-mode login. In World App we run MiniKit verify (Orb proof, in-webview).
// In any other browser we cannot do the IDKit v4 RP-signed QR flow because
// vohu is registered as a Mini App and the bridge route rejects Mini-App
// app IDs from non-World-App entry points — World App returns a generic
// "問題が発生しました" rather than a typed error. So Chrome users get a
// deep link into World App instead of a doomed QR.

import { Suspense, useState } from 'react';
import { MiniKit, VerificationLevel } from '@worldcoin/minikit-js';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useInVerifiedHumanContext } from '@/lib/prome';

const APP_ID = process.env.NEXT_PUBLIC_APP_ID!;
const MINIAPP_DEEP_LINK = `https://world.org/mini-app?app_id=${APP_ID}`;

function LoginInner() {
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const isHuman = useInVerifiedHumanContext();

  const nextUrl = searchParams.get('next') ?? '/';
  const action = process.env.NEXT_PUBLIC_ACTION_ID!;

  const handleMiniKitVerify = async () => {
    setError(null);
    setVerifying(true);
    try {
      const result = await MiniKit.commandsAsync.verify({
        action,
        verification_level: VerificationLevel.Orb,
      });
      const payload = result.finalPayload;
      if (payload.status === 'success' && 'nullifier_hash' in payload) {
        // Persist the full verification envelope for /vote to re-present
        // to the server for cloud-side proof verification. /api/vote
        // rejects ballots whose proof does not round-trip through
        // World ID's verify endpoint for (app_id, action, nullifier).
        sessionStorage.setItem(
          'worldid_proof',
          JSON.stringify({
            proof: payload.proof,
            merkle_root: payload.merkle_root,
            nullifier_hash: payload.nullifier_hash,
            verification_level: payload.verification_level,
          }),
        );
        sessionStorage.setItem('nullifier', payload.nullifier_hash);
        router.push(nextUrl);
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
            Orb verification via MiniKit
          </p>
        </>
      )}

      {isHuman === false && (
        <div className="flex flex-col items-center max-w-xs text-center">
          <a
            href={MINIAPP_DEEP_LINK}
            className="px-8 py-4 bg-white text-black rounded-full font-semibold active:scale-95 transition-transform"
          >
            Open in World App
          </a>
          <p className="mt-6 text-xs text-slate-400 leading-relaxed">
            Voting requires the World App runtime — that&apos;s the binding
            that makes the proof of personhood actually one-human-one-vote.
            Aggregate results stay viewable in this browser without
            logging in; only ballot casting needs the App.
          </p>
          <Link
            href="/"
            className="mt-6 text-xs text-emerald-400 font-mono"
          >
            ← back to results
          </Link>
        </div>
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
