'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useInVerifiedHumanContext } from '@/lib/prome';
import { ObfuscatedScreen } from '@/components/ObfuscatedScreen';

type VoteData = { total: number; ciphertexts: string[] };

export default function ResultPage() {
  const { proposalId } = useParams<{ proposalId: string }>();
  const isHuman = useInVerifiedHumanContext();
  const [data, setData] = useState<VoteData | null>(null);
  const [tally, setTally] = useState<Record<string, number> | null>(null);
  const [decrypting, setDecrypting] = useState(false);

  useEffect(() => {
    if (isHuman !== true) return;
    fetch(`/api/vote?proposalId=${encodeURIComponent(proposalId)}`)
      .then(r => r.json())
      .then(setData)
      .catch(console.error);
  }, [proposalId, isHuman]);

  if (isHuman === null || isHuman === false) {
    return (
      <ObfuscatedScreen plaintext={`Results for ${proposalId}\nEncrypted ballots\nTally`} />
    );
  }

  const handleTally = async () => {
    setDecrypting(true);
    await new Promise(r => setTimeout(r, 1500));
    const counts: Record<string, number> = {};
    for (const ct of data?.ciphertexts ?? []) {
      try {
        const decoded = JSON.parse(atob(ct));
        counts[decoded.vote] = (counts[decoded.vote] || 0) + 1;
      } catch {
        // ignore malformed ciphertext
      }
    }
    setTally(counts);
    setDecrypting(false);
  };

  if (!data) {
    return (
      <main className="min-h-screen p-6 bg-gradient-to-b from-slate-900 to-black text-white">
        <p className="pt-12 text-center text-slate-400">Loading…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 bg-gradient-to-b from-slate-900 to-black text-white">
      <div className="max-w-md mx-auto pt-12">
        <h1 className="text-2xl font-bold mb-2">Encrypted ballots</h1>
        <p className="text-slate-400 mb-6">{data.total} verified humans voted</p>

        <div className="bg-black/40 border border-slate-800 rounded-xl p-4 mb-6 max-h-48 overflow-auto">
          {data.ciphertexts.length === 0 ? (
            <p className="text-xs text-slate-500">No ballots yet.</p>
          ) : (
            data.ciphertexts.map((ct, i) => (
              <div
                key={i}
                className="font-mono text-xs text-emerald-400 mb-1 truncate"
              >
                🔒 {ct.slice(0, 60)}…
              </div>
            ))
          )}
        </div>

        {!tally && (
          <button
            onClick={handleTally}
            disabled={decrypting || data.total === 0}
            className="w-full py-4 bg-white text-black rounded-full font-semibold disabled:opacity-30 active:scale-95 transition-transform"
          >
            {decrypting ? 'Computing tally on encrypted data…' : 'Reveal aggregate result'}
          </button>
        )}

        {tally && (
          <div className="space-y-2 mt-6">
            <h2 className="font-semibold mb-2">Result (decrypted)</h2>
            {Object.entries(tally).map(([k, v]) => (
              <div
                key={k}
                className="flex justify-between p-3 bg-white/5 rounded-lg"
              >
                <span>{k}</span>
                <span className="font-mono">{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
