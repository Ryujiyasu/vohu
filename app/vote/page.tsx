'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useInVerifiedHumanContext } from '@/lib/prome';
import { ObfuscatedScreen } from '@/components/ObfuscatedScreen';

const PROPOSAL = {
  id: 'demo-2026-04',
  title: 'Should the World ecosystem prioritize privacy primitives in 2026?',
  options: [
    { id: 'yes', label: 'Yes — privacy is foundational' },
    { id: 'no', label: 'No — focus on growth first' },
    { id: 'mixed', label: 'Mixed — depends on use case' },
  ],
};

const PROPOSAL_PLAINTEXT =
  PROPOSAL.title + '\n' + PROPOSAL.options.map(o => o.label).join('\n');

export default function VotePage() {
  const isHuman = useInVerifiedHumanContext();
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [nullifier, setNullifier] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (isHuman !== true) return;
    const n = sessionStorage.getItem('nullifier');
    if (!n) {
      router.push('/');
      return;
    }
    setNullifier(n);
  }, [router, isHuman]);

  if (isHuman === null || isHuman === false) {
    return <ObfuscatedScreen plaintext={PROPOSAL_PLAINTEXT} />;
  }

  const handleVote = async () => {
    if (!selected || !nullifier) return;
    setSubmitting(true);

    setStage('Generating cryptographic commitment…');
    await new Promise(r => setTimeout(r, 500));

    setStage('Encrypting ballot with hyde…');
    await new Promise(r => setTimeout(r, 600));

    const mockEncrypted = btoa(
      JSON.stringify({
        vote: selected,
        timestamp: Date.now(),
        nonce: Math.random().toString(36).slice(2),
      })
    );

    setStage('Submitting ciphertext…');
    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId: PROPOSAL.id,
          nullifier,
          ciphertext: mockEncrypted,
        }),
      });
      if (res.ok) {
        router.push(`/result/${PROPOSAL.id}`);
      } else {
        const body = await res.json().catch(() => ({}));
        setStage(null);
        alert(body.error ?? 'Vote submission failed');
        setSubmitting(false);
      }
    } catch (e) {
      console.error(e);
      setStage(null);
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen p-6 bg-gradient-to-b from-slate-900 to-black text-white">
      <div className="max-w-md mx-auto pt-12">
        <div className="mb-2 text-xs text-emerald-400 font-mono">✓ HUMAN VERIFIED</div>
        <h1 className="text-2xl font-bold mb-8 leading-snug">{PROPOSAL.title}</h1>

        <div className="space-y-3 mb-8">
          {PROPOSAL.options.map(opt => (
            <button
              key={opt.id}
              onClick={() => setSelected(opt.id)}
              disabled={submitting}
              className={`w-full p-4 rounded-xl border text-left transition ${
                selected === opt.id
                  ? 'border-white bg-white/10'
                  : 'border-slate-700 hover:border-slate-500'
              } disabled:opacity-60`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button
          onClick={handleVote}
          disabled={!selected || submitting}
          className="w-full py-4 bg-white text-black rounded-full font-semibold disabled:opacity-30 active:scale-95 transition-transform"
        >
          {stage ?? 'Cast encrypted vote'}
        </button>

        <p className="mt-6 text-xs text-slate-500 text-center leading-relaxed">
          🔒 Your vote is encrypted on this device.<br />
          The server only sees ciphertext.
        </p>
      </div>
    </main>
  );
}
