'use client';

import { Suspense, useState } from 'react';
import { MiniKit, VerificationLevel } from '@worldcoin/minikit-js';
import {
  IDKitRequestWidget,
  orbLegacy,
  type IDKitResult,
  type RpContext,
} from '@worldcoin/idkit';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useInVerifiedHumanContext } from '@/lib/prome';

function extractNullifier(result: IDKitResult): string | null {
  // v3/v4 result: responses[] has { nullifier } (hex string).
  if ('responses' in result && Array.isArray(result.responses)) {
    const first = result.responses[0];
    if (first && 'nullifier' in first && typeof first.nullifier === 'string') {
      return first.nullifier;
    }
  }
  return null;
}

function LoginInner() {
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idkitOpen, setIdkitOpen] = useState(false);
  const [rpContext, setRpContext] = useState<RpContext | null>(null);
  const [preparingRp, setPreparingRp] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const isHuman = useInVerifiedHumanContext();

  const nextUrl = searchParams.get('next') ?? '/';
  const action = process.env.NEXT_PUBLIC_ACTION_ID!;

  const finish = (nullifier: string) => {
    sessionStorage.setItem('nullifier', nullifier);
    router.push(nextUrl);
  };

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

  const handleStartIDKit = async () => {
    setError(null);
    setPreparingRp(true);
    try {
      const res = await fetch('/api/rp-signature', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `rp-signature failed: ${res.status}`);
      }
      const { sig, nonce, created_at, expires_at } = await res.json();
      setRpContext({
        rp_id: process.env.NEXT_PUBLIC_RP_ID!,
        nonce,
        created_at,
        expires_at,
        signature: sig,
      });
      setIdkitOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'RP signature failed');
    } finally {
      setPreparingRp(false);
    }
  };

  const handleIDKitSuccess = (result: IDKitResult) => {
    const n = extractNullifier(result);
    if (!n) {
      setError('World ID returned no nullifier.');
      return;
    }
    finish(n);
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
          <button
            onClick={handleStartIDKit}
            disabled={preparingRp}
            className="px-8 py-4 bg-white text-black rounded-full font-semibold disabled:opacity-50 active:scale-95 transition-transform"
          >
            {preparingRp ? 'Preparing…' : 'Verify with World ID (scan QR)'}
          </button>
          {rpContext && (
            <IDKitRequestWidget
              app_id={process.env.NEXT_PUBLIC_APP_ID as `app_${string}`}
              action={action}
              rp_context={rpContext}
              allow_legacy_proofs={true}
              preset={orbLegacy({})}
              open={idkitOpen}
              onOpenChange={setIdkitOpen}
              onSuccess={handleIDKitSuccess}
              onError={code => setError(`IDKit error: ${code}`)}
            />
          )}
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
