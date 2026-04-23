import Link from 'next/link';

interface Card {
  href: string;
  title: string;
  bindings: { identity: boolean; runtime: boolean };
  summary: string;
  risk: string;
}

const cards: Card[] = [
  {
    href: '/demos/public',
    title: 'Door 1 — Public',
    bindings: { identity: false, runtime: false },
    summary:
      'No bindings. Any browser, any visitor. Content renders to whoever requests it.',
    risk: 'Coercion-trivial: a scraper, a screenshare, anyone can reproduce the content.',
  },
  {
    href: '/demos/verified',
    title: 'Door 2 — Verified human',
    bindings: { identity: true, runtime: false },
    summary:
      'Requires a "human" token. Once obtained, the same token renders the page in any browser.',
    risk:
      'Coercion-vulnerable: the identity token is transferable. An attacker with your token sees what you see.',
  },
  {
    href: '/demos/prome',
    title: 'Door 3 — prome',
    bindings: { identity: true, runtime: true },
    summary:
      'Requires a human token AND a Mini App runtime. Even with the token, Chrome renders ciphertext.',
    risk:
      'Coercion-resistant: the content refuses to materialize outside the World App sandbox, so forwarding credentials leaks nothing visible.',
  },
];

export default function DemosIndex() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 to-black text-white px-6 py-12">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-xs text-slate-400 hover:text-slate-200">
          ← vohu
        </Link>
        <h1 className="text-3xl font-bold mt-6 mb-2 tracking-tight">
          Three bindings, three doors
        </h1>
        <p className="text-sm text-slate-400 leading-relaxed mb-10">
          prome is vohu&apos;s <em>runtime binding</em>: a gate that refuses to
          render sensitive content outside the World App. These three pages
          show what happens at each binding level. Try each one in Chrome
          <em> and</em> in World App — the difference is the pitch.
        </p>

        <div className="space-y-4">
          {cards.map(c => (
            <Link
              key={c.href}
              href={c.href}
              className="block rounded-xl border border-slate-800 bg-slate-900/60 p-5 hover:border-slate-600 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold">{c.title}</h2>
                <div className="flex gap-1 text-[10px] font-mono">
                  <Badge on={c.bindings.identity} label="identity" />
                  <Badge on={c.bindings.runtime} label="runtime" />
                </div>
              </div>
              <p className="text-sm text-slate-300 mb-2 leading-relaxed">
                {c.summary}
              </p>
              <p className="text-xs text-rose-300/80 leading-relaxed">
                {c.risk}
              </p>
            </Link>
          ))}
        </div>

        <p className="mt-12 text-xs text-slate-500 leading-relaxed">
          vohu stacks all three bindings on every ballot. The demos isolate one
          binding at a time so the failure mode of each weaker configuration is
          visible to the eye, not just the whitepaper.
        </p>
      </div>
    </main>
  );
}

function Badge({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={
        'px-2 py-0.5 rounded-full border ' +
        (on
          ? 'border-emerald-500/60 text-emerald-300 bg-emerald-500/10'
          : 'border-slate-700 text-slate-500')
      }
    >
      {on ? '●' : '○'} {label}
    </span>
  );
}
