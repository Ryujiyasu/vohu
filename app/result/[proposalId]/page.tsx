'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useInVerifiedHumanContext } from '@/lib/prome';
import { ObfuscatedScreen } from '@/components/ObfuscatedScreen';
import { DEMO_PROPOSAL, Proposal } from '@/lib/proposal';

interface TallyResponse {
  proposal: Proposal;
  total: number;
  counts: number[];
  ciphertextPreview: string[][];
  revealed: boolean;
}

export default function ResultPage() {
  const { proposalId } = useParams<{ proposalId: string }>();
  const isHuman = useInVerifiedHumanContext();
  const [data, setData] = useState<TallyResponse | null>(null);
  const [showServerView, setShowServerView] = useState(false);

  useEffect(() => {
    if (isHuman !== true) return;
    fetch(`/api/tally?proposalId=${encodeURIComponent(proposalId)}`)
      .then(r => r.json())
      .then(setData)
      .catch(console.error);
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
  const maxCount = Math.max(1, ...data.counts);

  return (
    <main className="min-h-screen p-6 bg-gradient-to-b from-slate-900 to-black text-white">
      <div className="max-w-md mx-auto pt-12">
        <h1 className="text-2xl font-bold mb-2 leading-snug">{p.title}</h1>
        <p className="text-slate-400 mb-6">
          {data.total} verified human{data.total === 1 ? '' : 's'} voted
        </p>

        <div className="space-y-3 mb-8">
          {p.options.map((opt, i) => {
            const c = data.counts[i] ?? 0;
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
              these individually.
            </p>
            {data.ciphertextPreview.length === 0 ? (
              <p className="text-xs text-slate-500">No ballots yet.</p>
            ) : (
              data.ciphertextPreview.map((vec, i) => (
                <div key={i} className="font-mono text-xs text-emerald-400 truncate">
                  🔒 [{vec.map(v => v.slice(0, 8)).join(', ')}…]
                </div>
              ))
            )}
          </div>
        )}

        <p className="mt-6 text-xs text-slate-500 text-center leading-relaxed">
          Tally computed homomorphically from {data.total} ciphertext
          vector{data.total === 1 ? '' : 's'}.<br />
          Only the aggregate was decrypted.
        </p>
      </div>
    </main>
  );
}
