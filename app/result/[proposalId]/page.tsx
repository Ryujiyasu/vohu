'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { DEMO_PROPOSAL, Proposal, ProposalPhase } from '@/lib/proposal';

interface TallyResponse {
  proposal: Proposal;
  total: number;
  revealed: boolean;
  counts: number[] | null;
  approvals: number[];
  threshold: number;
  totalParties: number;
  ciphertextPreview: string[][];
  phase: ProposalPhase;
  votesCloseAt: number | null;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'closed';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export default function ResultPage() {
  const { proposalId } = useParams<{ proposalId: string }>();
  const [data, setData] = useState<TallyResponse | null>(null);
  const [showServerView, setShowServerView] = useState(false);

  useEffect(() => {
    const load = () =>
      fetch(`/api/tally?proposalId=${encodeURIComponent(proposalId)}`)
        .then(r => r.json())
        .then(setData)
        .catch(console.error);
    load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [proposalId]);

  if (!data) {
    return (
      <main className="min-h-screen p-6 bg-gradient-to-b from-slate-900 to-black text-white">
        <p className="pt-12 text-center text-slate-400">
          Computing homomorphic tally…
        </p>
      </main>
    );
  }

  const p = data.proposal ?? DEMO_PROPOSAL;
  const counts = data.counts ?? new Array(p.options.length).fill(0);
  const maxCount = Math.max(1, ...counts);

  return (
    <main className="min-h-screen p-6 bg-gradient-to-b from-slate-900 to-black text-white">
      <div className="max-w-md mx-auto pt-12 pb-20">
        <Link
          href="/"
          className="text-xs text-slate-400 hover:text-slate-200"
        >
          ← vohu
        </Link>
        <h1 className="text-2xl font-bold mt-6 mb-2 leading-snug">{p.title}</h1>
        <p className="text-slate-400 mb-3">
          {data.total} verified human{data.total === 1 ? '' : 's'} voted
          {data.revealed ? '.' : ' · tally encrypted.'}
        </p>

        {p.scope?.kind === 'xmtp-group' && (
          <div className="mb-6 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs text-slate-400 space-y-1">
            <div>
              <span className="text-slate-500">scope · </span>
              <span className="text-slate-200">
                {p.scope.groupName ?? 'XMTP group'}
              </span>
            </div>
            <div>
              <span className="text-slate-500">members at snapshot · </span>
              <span className="font-mono text-slate-300">
                {p.scope.allowedAddresses.length}
              </span>
            </div>
            <div>
              <span className="text-slate-500">snapshot · </span>
              <span className="font-mono text-slate-300">
                {new Date(p.scope.snapshotAt).toISOString().slice(0, 16)}Z
              </span>
            </div>
          </div>
        )}
        {!p.scope && (
          <p className="mb-6 text-xs text-slate-500">
            Open to all Orb-verified humans.
          </p>
        )}

        <PhaseBanner
          phase={data.phase}
          votesCloseAt={data.votesCloseAt}
          revealed={data.revealed}
        />

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

        <div className="flex gap-2">
          <Link
            href={`/receipt/${proposalId}`}
            className="flex-1 text-center text-xs text-emerald-400 font-mono py-2 border border-emerald-900 rounded hover:bg-emerald-950/40 transition"
          >
            My receipt →
          </Link>
          <button
            onClick={() => setShowServerView(v => !v)}
            className="flex-1 text-xs text-emerald-400 font-mono py-2 border border-emerald-900 rounded hover:bg-emerald-950/40 transition"
          >
            {showServerView ? 'Hide' : 'Show'} server view
          </button>
        </div>

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

        <div className="mt-8 pt-6 border-t border-slate-800/60 text-xs text-slate-500 leading-relaxed space-y-2">
          <p>
            <span className="text-slate-300 font-mono">Threshold Paillier</span>{' '}
            · t={data.threshold} of N={data.totalParties}. No single party —
            including the server — can decrypt a ballot. Only the aggregate is
            ever revealed, and only after {data.threshold} trustees cooperate.
          </p>
          <p>
            <span className="text-slate-300 font-mono">Sybil resistance</span> ·
            World ID Orb nullifier, single-use per proposal. One human, one
            vote, enforced at the cryptographic layer.
          </p>
          {p.scope && (
            <p>
              <span className="text-slate-300 font-mono">Scope</span> ·
              Membership snapshot taken at proposal creation. A signed
              attribution proves the voter held an allowed address at snapshot
              time, without revealing which address.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

function PhaseBanner({
  phase,
  votesCloseAt,
  revealed,
}: {
  phase: ProposalPhase;
  votesCloseAt: number | null;
  revealed: boolean;
}) {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (phase !== 'voting' || votesCloseAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [phase, votesCloseAt]);

  if (phase === 'open' && !revealed) return null;

  if (phase === 'voting' && votesCloseAt !== null) {
    const remaining = votesCloseAt - now;
    return (
      <div className="mb-4 rounded-lg border border-amber-900/50 bg-amber-950/20 px-3 py-2 text-xs text-amber-200 space-y-1">
        <div className="font-mono">
          <span className="text-amber-400">●</span> voting open · change your
          ballot any time before close
        </div>
        <div className="text-amber-300/70 font-mono">
          closes in {formatCountdown(remaining)} ·{' '}
          {new Date(votesCloseAt).toISOString().slice(0, 16)}Z
        </div>
      </div>
    );
  }

  if (phase === 'tallying' && !revealed) {
    return (
      <div className="mb-4 rounded-lg border border-sky-900/50 bg-sky-950/20 px-3 py-2 text-xs text-sky-200 space-y-1 font-mono">
        <div>
          <span className="text-sky-400">●</span> voting closed · tallying phase
        </div>
        <div className="text-sky-300/70">
          aggregate frozen at{' '}
          {votesCloseAt !== null
            ? new Date(votesCloseAt).toISOString().slice(0, 16) + 'Z'
            : '—'}{' '}
          · trustees approve to reveal
        </div>
      </div>
    );
  }

  if (revealed) {
    return (
      <div className="mb-4 rounded-lg border border-emerald-900/50 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-200 font-mono">
        <span className="text-emerald-400">●</span> revealed · tally decrypted
        by trustee threshold
      </div>
    );
  }

  return null;
}
