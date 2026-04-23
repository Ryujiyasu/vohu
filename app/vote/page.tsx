'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MiniKit } from '@worldcoin/minikit-js';
import { useInVerifiedHumanContext } from '@/lib/prome';
import { ObfuscatedScreen } from '@/components/ObfuscatedScreen';
import {
  deserializePublicKey,
  encryptBallot,
  SerializedPublicKey,
} from '@/lib/tally';
import { DEMO_PROPOSAL, Proposal } from '@/lib/proposal';
import {
  RECEIPT_VERSION,
  ballotDigest,
  buildReceiptMessage,
  saveReceipt,
} from '@/lib/receipt';

const PROPOSAL_PLAINTEXT =
  DEMO_PROPOSAL.title + '\n' + DEMO_PROPOSAL.options.map(o => o.label).join('\n');

export default function VotePage() {
  const isHuman = useInVerifiedHumanContext();
  const router = useRouter();

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [pubKey, setPubKey] = useState<SerializedPublicKey | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [nullifier, setNullifier] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pull proposal metadata + Paillier public key.
  useEffect(() => {
    if (isHuman !== true) return;
    fetch(`/api/proposal?proposalId=${encodeURIComponent(DEMO_PROPOSAL.id)}`)
      .then(r => r.json())
      .then(d => {
        if (d.proposal && d.publicKey) {
          setProposal(d.proposal);
          setPubKey(d.publicKey);
        } else {
          setError(d.error ?? 'failed to load proposal');
        }
      })
      .catch(e => setError(String(e)));
  }, [isHuman]);

  // Gate: must have already verified on `/`.
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
    if (!selected || !nullifier || !proposal || !pubKey) return;
    setSubmitting(true);
    setError(null);

    setStage('Fetching election public key…');
    const pk = deserializePublicKey(pubKey);
    const choiceIdx = proposal.options.findIndex(o => o.id === selected);
    if (choiceIdx < 0) {
      setError('invalid choice');
      setSubmitting(false);
      setStage(null);
      return;
    }

    setStage('Encrypting ballot (Paillier)…');
    const ciphertextVec = encryptBallot(pk, choiceIdx, proposal.options.length);

    setStage('Submitting ciphertext…');
    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId: proposal.id,
          nullifier,
          ciphertextVec,
        }),
      });
      if (res.ok) {
        setStage('Signing device-bound receipt…');
        try {
          const digest = await ballotDigest(ciphertextVec);
          const issuedAt = new Date().toISOString();
          const message = buildReceiptMessage({
            proposalId: proposal.id,
            nullifier,
            ballotDigest: digest,
            issuedAt,
          });
          const signed = await MiniKit.commandsAsync.signMessage({ message });
          const payload = signed.finalPayload;
          if (payload.status === 'success') {
            saveReceipt({
              version: RECEIPT_VERSION,
              proposalId: proposal.id,
              nullifier,
              ballotDigest: digest,
              issuedAt,
              message,
              signature: payload.signature,
              address: payload.address,
            });
          }
        } catch (e) {
          // Receipt signing is best-effort. If the user rejects or we're
          // outside a signMessage-capable runtime, the vote still stands.
          console.warn('receipt signing failed', e);
        }
        router.push(`/result/${proposal.id}`);
      } else if (res.status === 409) {
        // Already voted with this nullifier — that's fine, proceed to
        // results so the user can see the aggregate without being stuck
        // on the /vote screen.
        router.push(`/result/${proposal.id}`);
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `server returned ${res.status}`);
        setStage(null);
        setSubmitting(false);
      }
    } catch (e) {
      setError(String(e));
      setStage(null);
      setSubmitting(false);
    }
  };

  const p = proposal ?? DEMO_PROPOSAL;

  return (
    <main className="min-h-screen p-6 bg-gradient-to-b from-slate-900 to-black text-white">
      <div className="max-w-md mx-auto pt-12">
        <div className="mb-2 text-xs text-emerald-400 font-mono">
          ✓ HUMAN VERIFIED
        </div>
        <h1 className="text-2xl font-bold mb-8 leading-snug">{p.title}</h1>

        <div className="space-y-3 mb-8">
          {p.options.map(opt => (
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
          disabled={!selected || submitting || !pubKey}
          className="w-full py-4 bg-white text-black rounded-full font-semibold disabled:opacity-30 active:scale-95 transition-transform"
        >
          {stage ?? (pubKey ? 'Cast encrypted vote' : 'Loading…')}
        </button>

        {error && (
          <p className="mt-4 text-sm text-rose-400 text-center">{error}</p>
        )}

        <Link
          href={`/result/${p.id}`}
          className="mt-4 block w-full py-3 text-center text-sm text-emerald-400 font-mono border border-emerald-900 rounded-full hover:bg-emerald-950/40 transition"
        >
          View current results →
        </Link>

        <p className="mt-6 text-xs text-slate-500 text-center leading-relaxed">
          🔒 Your ballot is encrypted on this device under the election&apos;s
          Paillier public key.<br />
          The server aggregates homomorphically — it never decrypts your vote.
        </p>
      </div>
    </main>
  );
}
