'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { MiniKit } from '@worldcoin/minikit-js';
import { useInVerifiedHumanContext } from '@/lib/prome';
import { ObfuscatedScreen } from '@/components/ObfuscatedScreen';
import {
  deserializePublicKey,
  encryptBallot,
  SerializedPublicKey,
} from '@/lib/tally';
import { DEMO_PROPOSAL, Proposal, ProposalPhase, proposalPhase } from '@/lib/proposal';
import {
  RECEIPT_VERSION,
  ballotDigest,
  buildReceiptMessage,
  saveReceipt,
} from '@/lib/receipt';
import { attributionMessage } from '@/lib/attribution';
import { getUserAddress } from '@/lib/xmtp-signer';

const PROPOSAL_PLAINTEXT =
  DEMO_PROPOSAL.title + '\n' + DEMO_PROPOSAL.options.map(o => o.label).join('\n');

function randomNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function VotePageInner() {
  const isHuman = useInVerifiedHumanContext();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Accept ?p=<proposalId> for scoped proposals, default to demo.
  const proposalId = searchParams.get('p') ?? DEMO_PROPOSAL.id;

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
    fetch(`/api/proposal?proposalId=${encodeURIComponent(proposalId)}`)
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
  }, [isHuman, proposalId]);

  // Gate: must have already verified on `/`.
  useEffect(() => {
    if (isHuman !== true) return;
    const n = sessionStorage.getItem('nullifier');
    if (!n) {
      router.push('/login');
      return;
    }
    setNullifier(n);
  }, [router, isHuman]);

  if (isHuman === null || isHuman === false) {
    return <ObfuscatedScreen plaintext={PROPOSAL_PLAINTEXT} />;
  }

  const phase = proposal ? proposalPhase(proposal) : 'open';
  const closed = phase === 'tallying';

  const handleVote = async () => {
    if (!selected || !nullifier || !proposal || !pubKey) return;
    setSubmitting(true);
    setError(null);

    const pk = deserializePublicKey(pubKey);
    const choiceIdx = proposal.options.findIndex(o => o.id === selected);
    if (choiceIdx < 0) {
      setError('invalid choice');
      setSubmitting(false);
      return;
    }

    setStage('Encrypting ballot (Paillier)…');
    const ciphertextVec = encryptBallot(pk, choiceIdx, proposal.options.length);

    const proofStr = sessionStorage.getItem('worldid_proof');
    if (!proofStr) {
      setError('World ID proof missing — please log in again');
      setSubmitting(false);
      setStage(null);
      return;
    }
    const worldIdProof = JSON.parse(proofStr);

    // Signed attribution for XMTP-scoped proposals. The server
    // re-derives the exact same canonical message and checks the
    // signature via viem.verifyMessage — the address is compared
    // against the snapshot allow-list.
    let attribution:
      | { address: string; nonce: string; signature: `0x${string}` }
      | undefined;
    if (proposal.scope?.kind === 'xmtp-group') {
      setStage('Proving group membership (walletAuth)…');
      let voterAddress: string;
      try {
        voterAddress = (await getUserAddress()).toLowerCase();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'walletAuth failed');
        setSubmitting(false);
        setStage(null);
        return;
      }
      if (!proposal.scope.allowedAddresses.includes(voterAddress)) {
        setError(
          `Your wallet ${voterAddress.slice(0, 10)}… is not in this group's snapshot.`,
        );
        setSubmitting(false);
        setStage(null);
        return;
      }
      const nonce = randomNonce();
      const attrMsg = attributionMessage(proposal.id, voterAddress, nonce);
      try {
        const signed = await MiniKit.commandsAsync.signMessage({ message: attrMsg });
        const payload = signed.finalPayload;
        if (payload.status !== 'success') {
          setError('attribution signature was rejected');
          setSubmitting(false);
          setStage(null);
          return;
        }
        attribution = {
          address: voterAddress,
          nonce,
          signature: payload.signature as `0x${string}`,
        };
      } catch (e) {
        setError(e instanceof Error ? e.message : 'attribution signing failed');
        setSubmitting(false);
        setStage(null);
        return;
      }
    }

    setStage('Signing ballot with device key…');
    const digest = await ballotDigest(ciphertextVec);
    const issuedAt = new Date().toISOString();
    const message = buildReceiptMessage({
      proposalId: proposal.id,
      nullifier,
      ballotDigest: digest,
      issuedAt,
    });
    let deviceSignature: string;
    let deviceAddress: string;
    try {
      const signed = await MiniKit.commandsAsync.signMessage({ message });
      const signedPayload = signed.finalPayload;
      if (signedPayload.status !== 'success') {
        setError('device signature was rejected');
        setSubmitting(false);
        setStage(null);
        return;
      }
      deviceSignature = signedPayload.signature;
      deviceAddress = signedPayload.address;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'device signing failed');
      setSubmitting(false);
      setStage(null);
      return;
    }

    setStage('Submitting ciphertext + proof + signature…');
    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId: proposal.id,
          nullifier,
          ciphertextVec,
          worldIdProof,
          ballotDigest: digest,
          issuedAt,
          deviceSignature,
          deviceAddress,
          attribution,
        }),
      });
      if (res.ok) {
        setStage('Recording device-bound receipt…');
        try {
          saveReceipt({
            version: RECEIPT_VERSION,
            proposalId: proposal.id,
            nullifier,
            ballotDigest: digest,
            issuedAt,
            message,
            signature: deviceSignature,
            address: deviceAddress,
          });
        } catch (e) {
          console.warn('receipt save failed', e);
        }
        router.push(`/result/${proposal.id}`);
      } else if (res.status === 409) {
        router.push(`/result/${proposal.id}`);
      } else {
        const body = await res.json().catch(() => ({}));
        const lead = body.error ?? `server returned ${res.status}`;
        const detail =
          body.detail && body.detail !== body.code ? ` (${body.detail})` : '';
        const code = body.code ? ` [${body.code}]` : '';
        setError(`${lead}${detail}${code}`);
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
  const scopedLabel =
    p.scope?.kind === 'xmtp-group'
      ? p.scope.groupName ?? 'XMTP group'
      : null;

  return (
    <main className="min-h-screen p-6 bg-gradient-to-b from-slate-900 to-black text-white">
      <div className="max-w-md mx-auto pt-12">
        <div className="mb-2 text-xs text-emerald-400 font-mono">
          ✓ HUMAN VERIFIED
        </div>
        {scopedLabel && (
          <div className="mb-2 text-[10px] text-slate-400 font-mono">
            scoped to · {scopedLabel}
          </div>
        )}
        <h1 className="text-2xl font-bold mb-8 leading-snug">{p.title}</h1>

        {closed && (
          <div className="mb-6 rounded-lg border border-sky-900/60 bg-sky-950/30 px-3 py-2 text-xs text-sky-200 font-mono">
            voting closed — tally phase
          </div>
        )}

        <div className="space-y-3 mb-8">
          {p.options.map(opt => (
            <button
              key={opt.id}
              onClick={() => setSelected(opt.id)}
              disabled={submitting || closed}
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
          disabled={!selected || submitting || !pubKey || closed}
          className="w-full py-4 bg-white text-black rounded-full font-semibold disabled:opacity-30 active:scale-95 transition-transform"
        >
          {stage ??
            (closed
              ? 'Voting closed'
              : pubKey
              ? 'Cast encrypted vote'
              : 'Loading…')}
        </button>

        {error && (
          <p className="mt-4 text-sm text-rose-400 text-center break-words">
            {error}
          </p>
        )}

        <Link
          href={`/result/${p.id}`}
          className="mt-4 block w-full py-3 text-center text-sm text-emerald-400 font-mono border border-emerald-900 rounded-full hover:bg-emerald-950/40 transition"
        >
          View current results →
        </Link>

        <p className="mt-6 text-xs text-slate-500 text-center leading-relaxed">
          🔒 Your ballot is encrypted on this device under the
          election&apos;s Paillier public key.<br />
          You can revise it any time before voting closes.
        </p>
      </div>
    </main>
  );
}

export default function VotePage() {
  return (
    <Suspense fallback={null}>
      <VotePageInner />
    </Suspense>
  );
}
