'use client';

// /trustee?p=<proposalId>&i=<trusteeIndex>
//
// Trustee-facing page. A trustee opens this URL to contribute their partial
// decryption. In v1 the server holds all shares (demo) and computes the
// partial on their behalf when the trustee clicks "Approve"; in a production
// deployment the trustee's share would be held client-side (hardware-bound or
// paper key) and the partial would be computed in their browser. The
// underlying cryptographic scheme is identical either way — only the key
// distribution path differs.

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { BackBar } from '@/components/BackBar';

interface ProposalPayload {
  proposal: {
    id: string;
    title: string;
    options: { id: string; label: string }[];
  };
  thresholdParams: {
    threshold: number;
    totalParties: number;
  };
}

interface TallyState {
  total: number;
  revealed: boolean;
  approvals: number[];
  threshold: number;
  totalParties: number;
}

function TrusteeInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const proposalId = searchParams.get('p');
  const trusteeIndex = Number(searchParams.get('i'));

  const [proposal, setProposal] = useState<ProposalPayload | null>(null);
  const [tally, setTally] = useState<TallyState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const resultHref = proposalId
    ? `/result/${encodeURIComponent(proposalId)}`
    : '/';

  useEffect(() => {
    if (!proposalId || !trusteeIndex) return;
    Promise.all([
      fetch(`/api/proposal?proposalId=${encodeURIComponent(proposalId)}`).then(r => r.json()),
      fetch(`/api/tally?proposalId=${encodeURIComponent(proposalId)}`).then(r => r.json()),
    ]).then(([p, t]) => {
      if (p.error) setError(p.error);
      else setProposal({ proposal: p.proposal, thresholdParams: p.thresholdParams });
      if (!t.error) setTally(t);
    });
  }, [proposalId, trusteeIndex]);

  const handleApprove = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/trustee/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId, trusteeIndex }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? `server ${res.status}`);
      } else {
        setSubmitted(true);
        // Re-poll tally to reflect approval
        const t = await fetch(
          `/api/tally?proposalId=${encodeURIComponent(proposalId!)}`,
        ).then(r => r.json());
        setTally(t);
        // Auto-return to results after a short beat so the trustee sees
        // confirmation, then lands back on /result.
        setTimeout(() => router.push(resultHref), 1800);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (!proposalId || !trusteeIndex) {
    return (
      <main className="min-h-screen p-6 bg-gradient-to-b from-slate-900 to-black text-white">
        <div className="max-w-md mx-auto pt-12">
          <p className="text-rose-400">
            Missing ?p=&lt;proposalId&gt; or ?i=&lt;trusteeIndex&gt;
          </p>
        </div>
      </main>
    );
  }

  if (!proposal) {
    return (
      <main className="min-h-screen p-6 bg-gradient-to-b from-slate-900 to-black text-white">
        <BackBar />
        <p className="pt-12 text-center text-slate-400">Loading…</p>
      </main>
    );
  }

  const p = proposal.proposal;
  const params = proposal.thresholdParams;
  const alreadyApproved = tally?.approvals.includes(trusteeIndex) ?? false;
  const progress = tally
    ? `${tally.approvals.length} of ${params.threshold} required (${params.totalParties} trustees total)`
    : '';

  return (
    <main className="min-h-screen p-6 bg-gradient-to-b from-slate-900 to-black text-white">
      <BackBar />
      <div className="max-w-md mx-auto pt-12">
        <div className="mb-2 text-xs text-emerald-400 font-mono">
          TRUSTEE {trusteeIndex} OF {params.totalParties}
        </div>
        <h1 className="text-2xl font-bold mb-4 leading-snug">{p.title}</h1>

        <p className="text-sm text-slate-300 mb-2">
          You are being asked to contribute a partial decryption of the
          aggregate tally.
        </p>
        <p className="text-xs text-slate-500 mb-6 leading-relaxed">
          Your partial alone reveals nothing about any individual ballot.
          When at least {params.threshold} of {params.totalParties} trustees
          contribute, the aggregate becomes decryptable — and only the
          aggregate, not any ballot.
        </p>

        <div className="rounded-xl border border-slate-800 p-4 mb-6 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Ballots received</span>
            <span className="font-mono">{tally?.total ?? '…'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Approvals so far</span>
            <span className="font-mono">{progress}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Your status</span>
            <span
              className={
                alreadyApproved ? 'text-emerald-400' : 'text-slate-300'
              }
            >
              {alreadyApproved ? '✓ signed' : '— waiting'}
            </span>
          </div>
        </div>

        {!alreadyApproved && !submitted && (
          <button
            onClick={handleApprove}
            disabled={submitting || !tally || tally.total === 0}
            className="w-full py-4 bg-white text-black rounded-full font-semibold disabled:opacity-30 active:scale-95 transition-transform"
          >
            {submitting ? 'Computing partial decryption…' : 'Approve aggregate decryption'}
          </button>
        )}

        {(alreadyApproved || submitted) && (
          <>
            <div className="w-full py-4 bg-emerald-950/60 border border-emerald-800 text-emerald-200 rounded-full font-semibold text-center">
              ✓ Partial decryption submitted
            </div>
            <Link
              href={resultHref}
              className="mt-3 block w-full py-3 text-center text-sm text-emerald-400 font-mono border border-emerald-900 rounded-full hover:bg-emerald-950/40 transition"
            >
              Back to results →
            </Link>
          </>
        )}

        {error && (
          <p className="mt-4 text-sm text-rose-400 text-center">{error}</p>
        )}

        <p className="mt-6 text-xs text-slate-500 text-center leading-relaxed">
          Threshold Paillier · t={params.threshold} of N={params.totalParties}.
          Individual ballots are never decrypted.
        </p>
      </div>
    </main>
  );
}

export default function TrusteePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen p-6 bg-gradient-to-b from-slate-900 to-black text-white">
          <p className="pt-12 text-center text-slate-400">Loading…</p>
        </main>
      }
    >
      <TrusteeInner />
    </Suspense>
  );
}
