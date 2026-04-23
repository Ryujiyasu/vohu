'use client';

// /propose — organiser UI for creating an XMTP-scoped proposal.
//
// Flow:
//   1. Connect to XMTP via MiniKit walletAuth (Secure-Enclave-backed signer).
//   2. List the user's group conversations (DMs filtered out).
//   3. Pick a group; the page enumerates group members via browser-sdk,
//      pulls their Ethereum Identifier entries, and lowercases them for
//      the allow-list.
//   4. Fill in title, 2–8 options, and an optional close time.
//   5. Submit to POST /api/propose with the snapshot; receive back a
//      shareable URL.
//
// Important: the member list captured here is a *snapshot at creation
// time*. Later joiners/leavers do not affect who can vote. That's the
// point — the scope is stable and auditable after the fact.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useInVerifiedHumanContext } from '@/lib/prome';
import { ObfuscatedScreen } from '@/components/ObfuscatedScreen';
import { createMiniKitSigner, getUserAddress } from '@/lib/xmtp-signer';

interface GroupSummary {
  id: string;
  name: string;
  memberCount: number;
}

interface ProposalOptionDraft {
  id: string;
  label: string;
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'walletauth' }
  | { kind: 'xmtp-init' }
  | { kind: 'syncing' }
  | { kind: 'listing' }
  | { kind: 'inspecting'; done: number; total: number }
  | { kind: 'connected'; groups: GroupSummary[] }
  | { kind: 'err'; message: string };

const MAX_GROUPS_SHOWN = 30;

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 8;
const DEFAULT_CLOSE_HOURS = 24;

function defaultCloseTime(): string {
  const t = new Date(Date.now() + DEFAULT_CLOSE_HOURS * 3600_000);
  // datetime-local expects YYYY-MM-DDTHH:mm (no seconds, no Z).
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(
    t.getHours(),
  )}:${pad(t.getMinutes())}`;
}

// Cached XMTP client — avoid rebuilding between actions.
// We keep this at module scope (rather than in React state) because the
// client holds WASM resources and re-creation is expensive.
let cachedClient: unknown = null;

async function getClient(address: string): Promise<unknown> {
  if (cachedClient) return cachedClient;
  const { Client } = await import('@xmtp/browser-sdk');
  const signer = createMiniKitSigner(address);
  cachedClient = await Client.create(
    signer,
    { env: 'dev' as const } as Parameters<typeof Client.create>[1],
  );
  return cachedClient;
}

export default function ProposePage() {
  const isHuman = useInVerifiedHumanContext();
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [nullifier, setNullifier] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [address, setAddress] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [options, setOptions] = useState<ProposalOptionDraft[]>([
    { id: 'yes', label: 'Yes' },
    { id: 'no', label: 'No' },
  ]);
  const [closeAt, setCloseAt] = useState<string>(defaultCloseTime());
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    proposalId: string;
    shareUrl: string;
    memberCount: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset defaultCloseTime once on mount so SSR and CSR agree.
  useEffect(() => {
    setCloseAt(defaultCloseTime());
  }, []);

  // Login gate: require a World ID nullifier before exposing the
  // organiser UI. A proposal creator is an identifiable action on the
  // server (the share URL identifies the organiser), so the same
  // identity binding as /vote applies.
  useEffect(() => {
    if (isHuman !== true) return;
    const n = sessionStorage.getItem('nullifier');
    setNullifier(n);
    setAuthChecked(true);
    if (!n) router.push('/login?next=' + encodeURIComponent('/propose'));
  }, [isHuman, router]);

  if (isHuman === null) {
    return (
      <main className="min-h-screen p-6 bg-gradient-to-b from-slate-900 to-black text-white">
        <p className="pt-12 text-center text-slate-400">…</p>
      </main>
    );
  }
  if (isHuman === false) {
    return (
      <ObfuscatedScreen plaintext="vohu proposal organiser — create an XMTP-scoped poll" />
    );
  }
  if (!authChecked || !nullifier) {
    return (
      <main className="min-h-screen p-6 bg-gradient-to-b from-slate-900 to-black text-white">
        <p className="pt-12 text-center text-slate-400">Redirecting to login…</p>
      </main>
    );
  }

  const connect = async () => {
    setError(null);
    try {
      setPhase({ kind: 'walletauth' });
      const addr = await getUserAddress();
      setAddress(addr);

      setPhase({ kind: 'xmtp-init' });
      const client = (await getClient(addr)) as {
        conversations: {
          sync: () => Promise<void>;
          list: () => Promise<unknown[]>;
        };
      };

      setPhase({ kind: 'syncing' });
      await client.conversations.sync();

      setPhase({ kind: 'listing' });
      const convs = (await client.conversations.list()) as Array<{
        id: string;
        conversationType?: string;
        name?: (() => Promise<string>) | string;
        members: () => Promise<unknown[]>;
      }>;

      // Drop DMs; cap at MAX_GROUPS_SHOWN so we don't spin on a huge inbox.
      const candidates = convs
        .filter(c => !c.conversationType || c.conversationType === 'group')
        .slice(0, MAX_GROUPS_SHOWN);

      setPhase({ kind: 'inspecting', done: 0, total: candidates.length });

      // Inspect in small parallel batches: avoids n-second serial stalls
      // on inboxes with many groups while not fanning out so wide that
      // we DDoS the user's network.
      const BATCH = 4;
      const groups: GroupSummary[] = new Array(candidates.length);
      for (let i = 0; i < candidates.length; i += BATCH) {
        const slice = candidates.slice(i, i + BATCH);
        await Promise.all(
          slice.map(async (c, j) => {
            let groupName = '(unnamed)';
            try {
              if (typeof c.name === 'function') {
                groupName = (await c.name()) ?? groupName;
              } else if (typeof c.name === 'string') {
                groupName = c.name;
              }
            } catch {
              /* noop */
            }
            let memberCount = 0;
            try {
              memberCount = (await c.members()).length;
            } catch {
              /* noop */
            }
            groups[i + j] = { id: c.id, name: groupName, memberCount };
          }),
        );
        setPhase({
          kind: 'inspecting',
          done: Math.min(i + BATCH, candidates.length),
          total: candidates.length,
        });
      }

      setPhase({ kind: 'connected', groups: groups.filter(Boolean) });
    } catch (e) {
      setPhase({
        kind: 'err',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const snapshotMembers = async (
    groupId: string,
  ): Promise<{ addresses: string[]; groupName: string }> => {
    if (!address) throw new Error('not connected');
    const client = (await getClient(address)) as {
      conversations: {
        getConversationById: (id: string) => Promise<unknown>;
      };
    };
    const conv = (await client.conversations.getConversationById(
      groupId,
    )) as {
      members: () => Promise<
        Array<{ accountIdentifiers: Array<{ identifier: string; identifierKind: number }> }>
      >;
      name?: (() => Promise<string>) | string;
    };
    const rawMembers = await conv.members();
    const addrs = new Set<string>();
    for (const m of rawMembers) {
      for (const id of m.accountIdentifiers ?? []) {
        // IdentifierKind: Ethereum = 0
        if (id.identifierKind === 0 && /^0x[0-9a-fA-F]{40}$/.test(id.identifier)) {
          addrs.add(id.identifier.toLowerCase());
        }
      }
    }
    let groupName = '(unnamed)';
    try {
      if (typeof conv.name === 'function') groupName = (await conv.name()) ?? groupName;
      else if (typeof conv.name === 'string') groupName = conv.name;
    } catch {
      /* noop */
    }
    return { addresses: Array.from(addrs), groupName };
  };

  const submit = async () => {
    if (!selectedGroupId) {
      setError('pick a group first');
      return;
    }
    if (!title.trim()) {
      setError('title is required');
      return;
    }
    const clean = options
      .map(o => ({ id: o.id.trim(), label: o.label.trim() }))
      .filter(o => o.id && o.label);
    if (clean.length < MIN_OPTIONS) {
      setError(`at least ${MIN_OPTIONS} options required`);
      return;
    }
    if (new Set(clean.map(o => o.id)).size !== clean.length) {
      setError('option ids must be unique');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const { addresses, groupName } = await snapshotMembers(selectedGroupId);
      if (addresses.length === 0) {
        throw new Error('no Ethereum-bound members in this group');
      }
      const votesCloseAt = new Date(closeAt).getTime();
      if (!Number.isFinite(votesCloseAt) || votesCloseAt <= Date.now()) {
        throw new Error('close time must be in the future');
      }

      const res = await fetch('/api/propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          options: clean,
          votesCloseAt,
          scope: {
            kind: 'xmtp-group',
            groupId: selectedGroupId,
            groupName,
            allowedAddresses: addresses,
          },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `server returned ${res.status}`);
      }
      const data = (await res.json()) as {
        proposal: { id: string };
        shareUrl: string;
      };
      setResult({
        proposalId: data.proposal.id,
        shareUrl: data.shareUrl,
        memberCount: addresses.length,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen p-6 bg-gradient-to-b from-slate-900 to-black text-white">
      <div className="max-w-lg mx-auto pt-8 pb-20">
        <Link href="/" className="text-xs text-slate-400 hover:text-slate-200">
          ← vohu
        </Link>
        <h1 className="text-2xl font-bold mt-6 mb-2">Create proposal</h1>
        <p className="text-sm text-slate-400 mb-8 leading-relaxed">
          Scoped to an XMTP group. Only members at snapshot time can cast a
          ballot; the snapshot is frozen the moment you click Create.
        </p>

        {result ? (
          <section className="rounded-xl border border-emerald-800/40 bg-emerald-950/20 p-4 space-y-3 font-mono text-sm">
            <div className="text-emerald-300 font-semibold font-sans">
              ✓ Proposal created
            </div>
            <div>
              <span className="text-slate-500">proposal:</span>{' '}
              <span className="text-emerald-200">{result.proposalId}</span>
            </div>
            <div>
              <span className="text-slate-500">snapshot members:</span>{' '}
              <span className="text-emerald-200">{result.memberCount}</span>
            </div>
            <div className="text-xs text-slate-400 font-sans leading-relaxed mt-3">
              Share this URL in the group chat; group members opening it in
              World App will be walked through walletAuth attribution.
            </div>
            <div className="pt-2 border-t border-emerald-900/40 text-xs break-all">
              <span className="text-slate-500">share:</span>{' '}
              <a
                href={result.shareUrl}
                className="text-emerald-300 underline"
              >
                {result.shareUrl}
              </a>
            </div>
          </section>
        ) : phase.kind === 'idle' || phase.kind === 'err' ? (
          <div className="space-y-4">
            <button
              onClick={connect}
              className="w-full py-4 bg-white text-black rounded-full font-semibold active:scale-95"
            >
              Connect XMTP
            </button>
            {phase.kind === 'err' && (
              <p className="text-sm text-rose-400">{phase.message}</p>
            )}
          </div>
        ) : phase.kind === 'walletauth' ||
          phase.kind === 'xmtp-init' ||
          phase.kind === 'syncing' ||
          phase.kind === 'listing' ||
          phase.kind === 'inspecting' ? (
          <div className="space-y-2 text-sm text-slate-300">
            <p>
              {phase.kind === 'walletauth' &&
                'Requesting wallet signature (SIWE)…'}
              {phase.kind === 'xmtp-init' &&
                'Initializing XMTP client (watch for signature prompts)…'}
              {phase.kind === 'syncing' && 'Syncing XMTP conversations…'}
              {phase.kind === 'listing' && 'Listing groups…'}
              {phase.kind === 'inspecting' &&
                `Inspecting groups · ${phase.done} / ${phase.total}`}
            </p>
            {phase.kind === 'inspecting' && (
              <div className="h-1 bg-slate-800 rounded overflow-hidden">
                <div
                  className="h-full bg-emerald-400"
                  style={{
                    width: `${
                      phase.total === 0 ? 0 : (phase.done / phase.total) * 100
                    }%`,
                  }}
                />
              </div>
            )}
            <p className="text-[11px] text-slate-500">
              First-time XMTP registration takes 30–60 s and requires a few
              signature prompts. After that, connections are fast.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <section>
              <h2 className="text-sm font-semibold mb-2">1 · Pick a group</h2>
              {phase.groups.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No group conversations on this inbox.
                </p>
              ) : (
                <div className="space-y-2">
                  {phase.groups.map(g => (
                    <button
                      key={g.id}
                      onClick={() => setSelectedGroupId(g.id)}
                      className={
                        'w-full text-left rounded-xl border p-3 transition ' +
                        (selectedGroupId === g.id
                          ? 'border-white bg-white/10'
                          : 'border-slate-800 hover:border-slate-600')
                      }
                    >
                      <div className="text-sm">{g.name}</div>
                      <div className="text-xs text-slate-500 font-mono">
                        {g.memberCount} members · {g.id.slice(0, 10)}…
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-sm font-semibold mb-2">2 · Ballot</h2>
              <label className="block text-xs text-slate-400 mb-1">Title</label>
              <input
                className="w-full bg-slate-900/60 border border-slate-800 rounded-md px-3 py-2 text-sm mb-4"
                value={title}
                onChange={e => setTitle(e.target.value)}
                maxLength={280}
                placeholder="Should we merge PR #42?"
              />

              <label className="block text-xs text-slate-400 mb-1">Options</label>
              <div className="space-y-2 mb-2">
                {options.map((o, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      className="w-20 bg-slate-900/60 border border-slate-800 rounded-md px-2 py-2 text-xs font-mono"
                      value={o.id}
                      onChange={e => {
                        const next = [...options];
                        next[i] = { ...next[i], id: e.target.value };
                        setOptions(next);
                      }}
                      placeholder="id"
                    />
                    <input
                      className="flex-1 bg-slate-900/60 border border-slate-800 rounded-md px-3 py-2 text-sm"
                      value={o.label}
                      onChange={e => {
                        const next = [...options];
                        next[i] = { ...next[i], label: e.target.value };
                        setOptions(next);
                      }}
                      placeholder="label"
                    />
                    {options.length > MIN_OPTIONS && (
                      <button
                        className="text-xs text-slate-500 hover:text-rose-400 px-2"
                        onClick={() =>
                          setOptions(options.filter((_, j) => j !== i))
                        }
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {options.length < MAX_OPTIONS && (
                <button
                  className="text-xs text-emerald-400 hover:underline"
                  onClick={() =>
                    setOptions([
                      ...options,
                      { id: `opt${options.length}`, label: '' },
                    ])
                  }
                >
                  + add option
                </button>
              )}

              <label className="block text-xs text-slate-400 mt-4 mb-1">
                Voting closes at
              </label>
              <input
                type="datetime-local"
                className="w-full bg-slate-900/60 border border-slate-800 rounded-md px-3 py-2 text-sm"
                value={closeAt}
                onChange={e => setCloseAt(e.target.value)}
              />
            </section>

            <button
              onClick={submit}
              disabled={submitting || !selectedGroupId || !title.trim()}
              className="w-full py-4 bg-white text-black rounded-full font-semibold disabled:opacity-40 active:scale-95"
            >
              {submitting ? 'Creating…' : '3 · Create proposal'}
            </button>

            {error && (
              <p className="text-sm text-rose-400 text-center">{error}</p>
            )}
          </div>
        )}

        <p className="mt-10 text-[11px] text-slate-500 leading-relaxed">
          The group member list is copied into the proposal now and frozen
          — later joiners won&apos;t be allowed to vote, later leavers
          still can. Scope changes are a v2 feature.
        </p>
      </div>
    </main>
  );
}
