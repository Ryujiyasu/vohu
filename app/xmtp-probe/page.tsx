'use client';

// /xmtp-probe
//
// Sanity check: can we instantiate an XMTP browser-sdk client inside the
// World App WebView using MiniKit's walletAuth + signMessage as the signer?
// If yes → the snapshot architecture for Pattern 4 (chat-scoped polls) is
// viable; we can list the user's World Chat groups and snapshot members.
// If no → fall back to URL-share-based scoping.

import { useState } from 'react';
import { useInVerifiedHumanContext } from '@/lib/prome';
import { ObfuscatedScreen } from '@/components/ObfuscatedScreen';
import {
  createMiniKitSigner,
  getUserAddress,
} from '@/lib/xmtp-signer';

type Status =
  | { kind: 'idle' }
  | { kind: 'auth' }
  | { kind: 'xmtp-init' }
  | { kind: 'syncing' }
  | { kind: 'listing' }
  | {
      kind: 'ok';
      address: string;
      inboxId: string;
      groupCount: number;
      groups: Array<{ id: string; name: string; members: number }>;
    }
  | { kind: 'err'; message: string };

export default function XmtpProbePage() {
  const isHuman = useInVerifiedHumanContext();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  if (isHuman === null || isHuman === false) {
    return (
      <ObfuscatedScreen plaintext="XMTP group discovery probe for vohu chat scoping" />
    );
  }

  const run = async () => {
    try {
      setStatus({ kind: 'auth' });
      const address = await getUserAddress();

      setStatus({ kind: 'xmtp-init' });
      // Dynamic import — browser-sdk pulls WASM + OPFS; only do it on demand.
      const { Client } = await import('@xmtp/browser-sdk');
      const signer = createMiniKitSigner(address);
      // env cast: browser-sdk's ClientOptions is a discriminated union; the
      // `env` field lives on NetworkOptions but TypeScript doesn't narrow it
      // automatically for an inline object literal.
      const client = await Client.create(
        signer,
        { env: 'dev' as const } as Parameters<typeof Client.create>[1],
      );

      setStatus({ kind: 'syncing' });
      await client.conversations.sync();

      setStatus({ kind: 'listing' });
      const conversations = await client.conversations.list();
      const groupsOnly = conversations.filter(c => {
        // Group conversations have a non-null metadata.name or members > 2.
        // The SDK exposes a type discriminator on recent versions; we soft-check.
        const maybeType = (c as unknown as { conversationType?: string })
          .conversationType;
        return maybeType === 'group' || maybeType === undefined;
      });
      const groups: Array<{ id: string; name: string; members: number }> = [];
      for (const conv of groupsOnly.slice(0, 5)) {
        try {
          const id = conv.id;
          const name =
            (conv as unknown as { name?: () => Promise<string> | string })
              .name instanceof Function
              ? await (conv as unknown as { name: () => Promise<string> }).name()
              : (conv as unknown as { name?: string }).name ?? '(unnamed)';
          const members = (await conv.members()).length;
          groups.push({
            id: id.slice(0, 16) + '…',
            name: typeof name === 'string' ? name : '(unnamed)',
            members,
          });
        } catch {
          // Skip conversations we can't introspect fully.
        }
      }

      setStatus({
        kind: 'ok',
        address,
        inboxId: client.inboxId ?? '(none)',
        groupCount: groupsOnly.length,
        groups,
      });
    } catch (e) {
      setStatus({
        kind: 'err',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  return (
    <main className="min-h-screen p-6 bg-gradient-to-b from-slate-900 to-black text-white">
      <div className="max-w-md mx-auto pt-12 space-y-4">
        <h1 className="text-2xl font-bold">XMTP probe</h1>
        <p className="text-sm text-slate-400 leading-relaxed">
          Validate that an XMTP browser-sdk client can be constructed inside
          the World App WebView using MiniKit as the signer. This is the
          architectural prerequisite for the Pattern 4 <em>chat-scoped
          polls</em> feature.
        </p>

        {status.kind === 'idle' && (
          <button
            onClick={run}
            className="w-full py-4 bg-white text-black rounded-full font-semibold active:scale-95 transition-transform"
          >
            Connect XMTP
          </button>
        )}

        {status.kind === 'auth' && (
          <p className="text-slate-300">Requesting wallet signature…</p>
        )}
        {status.kind === 'xmtp-init' && (
          <p className="text-slate-300">
            Initializing XMTP client (you may see a signature prompt)…
          </p>
        )}
        {status.kind === 'syncing' && (
          <p className="text-slate-300">Syncing conversations…</p>
        )}
        {status.kind === 'listing' && (
          <p className="text-slate-300">Listing groups…</p>
        )}

        {status.kind === 'ok' && (
          <div className="space-y-2 text-xs font-mono bg-black/40 border border-emerald-900 rounded-xl p-4">
            <div className="text-emerald-400 text-sm font-sans font-semibold">
              ✓ XMTP client connected
            </div>
            <div>
              <span className="text-slate-500">address:</span>{' '}
              {status.address.slice(0, 14)}…
            </div>
            <div>
              <span className="text-slate-500">inboxId:</span>{' '}
              {status.inboxId.slice(0, 14)}…
            </div>
            <div>
              <span className="text-slate-500">groups:</span>{' '}
              {status.groupCount}
            </div>
            {status.groups.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="text-slate-500">recent:</div>
                {status.groups.map((g, i) => (
                  <div key={i} className="text-slate-300">
                    · {g.name} — {g.members}p ({g.id})
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {status.kind === 'err' && (
          <div className="space-y-2 bg-rose-950/40 border border-rose-900 rounded-xl p-4">
            <div className="text-rose-300 font-semibold text-sm">FAILED</div>
            <pre className="text-xs font-mono text-rose-200 whitespace-pre-wrap break-words">
              {status.message}
            </pre>
            <button
              onClick={() => setStatus({ kind: 'idle' })}
              className="mt-2 text-xs text-emerald-400 font-mono"
            >
              retry
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
