'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { MiniKit } from '@worldcoin/minikit-js';
import { createPublicClient, http } from 'viem';
import { verifyMessage } from 'viem/actions';
import { useInVerifiedHumanContext } from '@/lib/prome';

// World App wallets are SCWs on World Chain — verifyMessage must round-trip
// through EIP-1271 (isValidSignature) on chain rather than ECDSA recovery.
const worldChainClient = createPublicClient({
  chain: {
    id: 480,
    name: 'World Chain',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: ['https://worldchain-mainnet.g.alchemy.com/public'] } },
  },
  transport: http(),
});
import {
  Receipt,
  buildChallengeMessage,
  loadReceipt,
  randomNonce,
} from '@/lib/receipt';

type ProofState =
  | { kind: 'idle' }
  | { kind: 'signing' }
  | { kind: 'verified'; nonce: string; at: string }
  | { kind: 'failed'; reason: string };

export default function ReceiptPage() {
  const { proposalId } = useParams<{ proposalId: string }>();
  const isHuman = useInVerifiedHumanContext();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [proof, setProof] = useState<ProofState>({ kind: 'idle' });

  useEffect(() => {
    setReceipt(loadReceipt(proposalId));
    setLoaded(true);
  }, [proposalId]);

  const proveOwnership = async () => {
    if (!receipt) return;
    setProof({ kind: 'signing' });
    const nonce = randomNonce();
    const challenge = buildChallengeMessage(receipt, nonce);
    try {
      const res = await MiniKit.commandsAsync.signMessage({ message: challenge });
      const payload = res.finalPayload;
      if (payload.status !== 'success') {
        setProof({ kind: 'failed', reason: 'signing rejected' });
        return;
      }
      const recovered = await verifyMessage(worldChainClient, {
        address: receipt.address as `0x${string}`,
        message: challenge,
        signature: payload.signature as `0x${string}`,
      });
      if (recovered) {
        setProof({
          kind: 'verified',
          nonce,
          at: new Date().toISOString(),
        });
      } else {
        setProof({
          kind: 'failed',
          reason: 'signature did not recover to receipt address',
        });
      }
    } catch (e) {
      setProof({
        kind: 'failed',
        reason: e instanceof Error ? e.message : 'unknown',
      });
    }
  };

  if (!loaded) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-900 to-black text-white p-6">
        <p className="pt-12 text-center text-slate-400">…</p>
      </main>
    );
  }

  if (!receipt) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-900 to-black text-white px-6 py-12">
        <div className="max-w-md mx-auto">
          <Link
            href="/"
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            ← vohu
          </Link>
          <h1 className="text-2xl font-bold mt-6 mb-4">No receipt on this device</h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Receipts are bound to the device that cast the ballot. This
            device has no receipt for <span className="font-mono">{proposalId}</span>,
            which means either (a) you haven&apos;t voted on this proposal
            here, or (b) the receipt was cleared. Receipts cannot be
            recovered from elsewhere — that&apos;s the entire point.
          </p>
          <Link
            href={`/result/${proposalId}`}
            className="mt-8 inline-block text-sm text-emerald-400 underline hover:text-emerald-300"
          >
            View the aggregate tally →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 to-black text-white px-6 py-12">
      <div className="max-w-md mx-auto">
        <Link href="/" className="text-xs text-slate-400 hover:text-slate-200">
          ← vohu
        </Link>
        <h1 className="text-2xl font-bold mt-6 mb-2">Your ballot receipt</h1>
        <p className="text-sm text-slate-400 mb-8 leading-relaxed">
          Signed by your World App wallet key at the time you cast the
          ballot. The key lives in this device&apos;s secure element and
          cannot be exported — so forwarding this receipt to someone else
          does not let them prove anything.
        </p>

        <dl className="text-xs text-slate-400 space-y-2 font-mono border border-slate-800 bg-slate-900/60 rounded-xl p-4 mb-6">
          <FieldRow label="version" value={receipt.version} />
          <FieldRow label="proposal" value={receipt.proposalId} />
          <FieldRow label="nullifier" value={receipt.nullifier} truncate />
          <FieldRow label="ballot-digest" value={receipt.ballotDigest} truncate />
          <FieldRow label="issued-at" value={receipt.issuedAt} />
          <FieldRow label="signer" value={receipt.address} truncate />
          <FieldRow label="signature" value={receipt.signature} truncate />
        </dl>

        {isHuman === true ? (
          <button
            onClick={proveOwnership}
            disabled={proof.kind === 'signing'}
            className="w-full py-3 bg-white text-black rounded-full font-semibold disabled:opacity-50 active:scale-95 transition-transform"
          >
            {proof.kind === 'signing'
              ? 'Signing challenge…'
              : 'Prove ownership on this device'}
          </button>
        ) : (
          <p className="text-xs text-slate-500 text-center">
            Open in World App to re-sign an ownership challenge.
          </p>
        )}

        {proof.kind === 'verified' && (
          <div className="mt-4 rounded-xl border border-emerald-800/50 bg-emerald-950/30 p-4 text-xs text-emerald-200 space-y-1 font-mono break-words">
            <div className="text-emerald-300">✓ ownership verified</div>
            <div className="text-emerald-400/80">nonce · {proof.nonce}</div>
            <div className="text-emerald-400/80">at · {proof.at}</div>
            <div className="mt-2 text-[11px] text-emerald-300/70 font-sans leading-relaxed">
              A fresh nonce was signed by this device&apos;s wallet key, and
              the signature recovered to the same address embedded in the
              original receipt. That is something a forwarded copy cannot
              do.
            </div>
          </div>
        )}
        {proof.kind === 'failed' && (
          <p className="mt-4 text-sm text-rose-400 text-center">
            {proof.reason}
          </p>
        )}

        <Link
          href={`/result/${receipt.proposalId}`}
          className="mt-8 block text-center text-sm text-emerald-400 underline hover:text-emerald-300"
        >
          View the aggregate tally →
        </Link>
      </div>
    </main>
  );
}

function FieldRow({
  label,
  value,
  truncate,
}: {
  label: string;
  value: string;
  truncate?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <dt className="text-slate-500 w-24 shrink-0">{label}</dt>
      <dd
        className={
          'text-slate-200 break-all' + (truncate ? ' truncate' : '')
        }
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}
