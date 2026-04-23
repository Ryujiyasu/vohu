'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useInVerifiedHumanContext } from '@/lib/prome';

const DEMO_PROPOSAL_ID = 'demo-2026-04';
const GITHUB_URL = 'https://github.com/Ryujiyasu/vohu';

export default function Dashboard() {
  const isHuman = useInVerifiedHumanContext();
  const [nullifier, setNullifier] = useState<string | null>(null);

  useEffect(() => {
    setNullifier(sessionStorage.getItem('nullifier'));
  }, []);

  const loggedIn = !!nullifier;
  const inWorldApp = isHuman === true;

  const logout = () => {
    sessionStorage.removeItem('nullifier');
    setNullifier(null);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 to-black text-white px-6 py-10">
      <div className="max-w-xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-5xl font-bold tracking-tight">vohu</h1>
          <p className="text-sm text-slate-400 mt-2">
            Encrypted votes for verified humans
          </p>
        </div>

        <AuthBanner
          loggedIn={loggedIn}
          nullifier={nullifier}
          isHuman={isHuman}
          onLogout={logout}
        />

        <div className="space-y-3">
          <Tile
            unlocked
            title="Public"
            bindings="none"
            items={[
              { label: 'Three bindings demo', href: '/demos' },
              { label: 'Source (GitHub)', href: GITHUB_URL, external: true },
            ]}
          />
          <Tile
            unlocked={loggedIn}
            title="Identity-bound"
            bindings="login"
            lockHint="Login to unlock — works in any browser"
            items={[
              {
                label: 'Live tally (aggregate)',
                href: `/result/${DEMO_PROPOSAL_ID}`,
              },
            ]}
          />
          <Tile
            unlocked={loggedIn && inWorldApp}
            title="Identity + Runtime (prome)"
            bindings="login + World App"
            lockHint={
              !loggedIn
                ? 'Login, then open in World App'
                : !inWorldApp
                ? 'Open in World App to unlock'
                : ''
            }
            items={[
              { label: 'Cast a vote', href: '/vote' },
              { label: 'Create a proposal (XMTP-scoped)', href: '/propose' },
              {
                label: 'Trustee console',
                href: `/trustee?p=${DEMO_PROPOSAL_ID}`,
              },
            ]}
          />
        </div>

        <p className="mt-12 text-[11px] text-slate-500 text-center leading-relaxed">
          Each tile unlocks as more bindings are satisfied. See{' '}
          <Link href="/demos" className="underline hover:text-slate-300">
            /demos
          </Link>{' '}
          for the binding model up close.
        </p>
      </div>
    </main>
  );
}

function AuthBanner({
  loggedIn,
  nullifier,
  isHuman,
  onLogout,
}: {
  loggedIn: boolean;
  nullifier: string | null;
  isHuman: boolean | null;
  onLogout: () => void;
}) {
  const env = isHuman === null ? '…' : isHuman ? 'World App' : 'Browser';
  return (
    <div className="mb-8 rounded-xl border border-slate-800 bg-slate-900/60 p-4 flex items-center justify-between gap-4">
      <div className="text-xs min-w-0">
        <div className="text-slate-400">
          environment · <span className="text-slate-200">{env}</span>
        </div>
        {loggedIn && nullifier && (
          <div className="text-slate-400 mt-1 truncate">
            nullifier ·{' '}
            <span className="font-mono text-emerald-300">
              {nullifier.slice(0, 12)}…
            </span>
          </div>
        )}
        {!loggedIn && (
          <div className="text-slate-500 mt-1">not logged in</div>
        )}
      </div>
      {loggedIn ? (
        <button
          onClick={onLogout}
          className="text-xs text-slate-400 underline hover:text-slate-200 whitespace-nowrap"
        >
          Log out
        </button>
      ) : (
        <Link
          href="/login"
          className="px-4 py-2 bg-white text-black text-sm font-semibold rounded-full active:scale-95 whitespace-nowrap"
        >
          Login
        </Link>
      )}
    </div>
  );
}

interface TileItem {
  label: string;
  href: string;
  external?: boolean;
}

function Tile({
  unlocked,
  title,
  bindings,
  lockHint,
  items,
}: {
  unlocked: boolean;
  title: string;
  bindings: string;
  lockHint?: string;
  items: TileItem[];
}) {
  return (
    <div
      className={
        'rounded-xl border p-4 ' +
        (unlocked
          ? 'border-emerald-800/40 bg-emerald-900/10'
          : 'border-slate-800 bg-slate-900/60')
      }
    >
      <div className="flex items-center gap-3 mb-3">
        <span
          className={
            'text-xs font-mono w-6 h-6 rounded-full flex items-center justify-center ' +
            (unlocked
              ? 'bg-emerald-500/20 text-emerald-300'
              : 'bg-slate-800 text-slate-500')
          }
          aria-hidden
        >
          {unlocked ? '●' : '○'}
        </span>
        <div>
          <h2 className="font-semibold text-sm">{title}</h2>
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
            bindings: {bindings}
          </p>
        </div>
      </div>
      {unlocked ? (
        <ul className="space-y-1.5 pl-9">
          {items.map(i => (
            <li key={i.href}>
              {i.external ? (
                <a
                  href={i.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-slate-200 hover:text-white underline decoration-slate-600 hover:decoration-white"
                >
                  {i.label} ↗
                </a>
              ) : (
                <Link
                  href={i.href}
                  className="text-sm text-slate-200 hover:text-white underline decoration-slate-600 hover:decoration-white"
                >
                  {i.label}
                </Link>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-slate-500 pl-9 leading-relaxed">
          {lockHint}
        </p>
      )}
    </div>
  );
}
