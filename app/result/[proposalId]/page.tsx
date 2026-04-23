'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useInVerifiedHumanContext } from '@/lib/prome';
import { ObfuscatedScreen } from '@/components/ObfuscatedScreen';
import { DEMO_PROPOSAL, Proposal } from '@/lib/proposal';

interface TallyResponse {
  proposal: Proposal;
  total: number;
  revealed: boolean;
  counts: number[] | null;
  approvals: number[];
  threshold: number;
  totalParties: number;
  ciphertextPreview: string[][];
}

export default function ResultPage() {
  const { proposalId } = useParams<{ proposalId: string }>();
  const isHuman = useInVerifiedHumanContext();
  const [data, setData] = useState<TallyResponse | null>(null);
  const [showServerView, setShowServerView] = useState(false);

  useEffect(() => {
    if (isHuman !== true) return;
    const load = () =>
      fetch(`/api/tally?proposalId=${encodeURIComponent(proposalId)}`)
        .then(r => r.json())
        .then(setData)
        .catch(console.error);
    load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [proposalId, isHuman]);

  if (isHuman === null || isHuman === false) {
    return (
      <ObfuscatedScreen plaintext={`Results for ${proposalId}\nEncrypted ballots\nTally`} />
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen p-6 bg-gradient-to-b from-slate-900 to-black text-white">
        <p className="pt-12 text-center text-slate-400">Computing homomorphic tally…</p>
      </main>
    );
  }

  const p = data.proposal ?? DEMO_PROPOSAL;
  const counts = data.counts ?? new Array(p.options.length).fill(0);
  const maxCount = Math.max(1, ...counts);

  return (
    <main className="min-h-screen p-6 bg-gradient-to-b from-slate-900 to-black text-white">
      <div className="max-w-md mx-auto pt-12 pb-20">
        <h1 className="text-2xl font-bold mb-2 leading-snug">{p.title}</h1>
        <p className="text-slate-400 mb-6">
          {data.total} verified human{data.total === 1 ? '' : 's'} voted
        </p>

        {!data.revealed ? (
          <section className="rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-4 mb-6 space-y-3">
            <div className="text-sm font-mono text-emerald-300">
              AWAITING TRUSTEE APPROVALS
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Approvals</span>
              <span className="font-mono text-emerald-200">
                {data.approvals.length} / {data.threshold} needed
              </span>
            </div>
            <div className="text-xs text-slate-400 leading-relaxed">
              The ballot tally is encrypted. {data.threshold} of{' '}
              {data.totalParties} trustees must each submit a partial
              decryption before any plaintext count is revealed. No single
              trustee — including the server — holds enough key material to
              decrypt a ballot.
            </div>
            <div className="pt-2 border-t border-emerald-900/40 space-y-2 text-xs">
              <div className="text-slate-500 font-mono">Trustees</div>
              {Array.from({ length: data.totalParties }, (_, k) => k + 1).map(
                i => (
                  <div
                    key={i}
                    className="flex justify-between items-center gap-2"
                  >
                    <span className="text-slate-300">Trustee {i}</span>
                    {data.approvals.includes(i) ? (
                      <span className="text-emerald-400 font-mono text-xs">
                        ✓ signed
                      </span>
                    ) : (
                      <a
                        href={`/trustee?p=${encodeURIComponent(
                          proposalId,
                        )}&i=${i}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-400 hover:underline font-mono text-xs"
                      >
                        approve →
                      </a>
                    )}
                  </div>
                ),
              )}
            </div>
          </section>
        ) : (
          <div className="space-y-3 mb-8">
            {p.options.map((opt, i) => {
              const c = counts[i] ?? 0;
              const pct = Math.round((c / maxCount) * 100);
              return (
                <div key={opt.id} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{opt.label}</span>
                    <span className="font-mono text-emerald-400">{c}</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded">
                    <div
                      className="h-full bg-emerald-400 rounded transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button
          onClick={() => setShowServerView(v => !v)}
          className="w-full text-xs text-emerald-400 font-mono py-2 border border-emerald-900 rounded hover:bg-emerald-950/40 transition"
        >
          {showServerView ? 'Hide' : 'Show'} what the server sees
        </button>

        {showServerView && (
          <div className="mt-4 bg-black/60 border border-emerald-900/50 rounded-xl p-4 space-y-1 max-h-64 overflow-auto">
            <p className="text-xs text-slate-500 mb-2">
              Paillier ciphertexts (truncated). The server never decrypts
              these individually — only the aggregate, and only with
              t-of-N trustee cooperation.
            </p>
            {data.ciphertextPreview.length === 0 ? (
              <p className="text-xs text-slate-500">No ballots yet.</p>
            ) : (
              data.ciphertextPreview.map((vec, i) => (
                <div
                  key={i}
                  className="font-mono text-xs text-emerald-400 truncate"
                >
                  🔒 [{vec.map(v => v.slice(0, 8)).join(', ')}…]
                </div>
              ))
            )}
          </div>
        )}

        <p className="mt-6 text-xs text-slate-500 text-center leading-relaxed">
          Threshold Paillier · t={data.threshold} of N={data.totalParties}.
          <br />
          Only the aggregate is ever decrypted.
        </p>
      </div>
    </main>
  );
}
