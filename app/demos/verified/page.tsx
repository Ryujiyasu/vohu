'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

// Demo 2: "identity binding only."
//
// We simulate a human-auth token with a localStorage flag. The point is NOT
// that this is real verification — the point is that any identity token,
// however strong, is fungible the moment it lands in a browser. A World ID
// nullifier, an OAuth access token, a passkey assertion — all of them are
// bytes that can be forwarded to another device.
//
// Demo 3 is the same content behind the same token, plus a runtime check
// that refuses to render outside World App.

const KEY = 'vohu-demo-verified';

export default function VerifiedDemo() {
  const [verified, setVerified] = useState<boolean | null>(null);

  useEffect(() => {
    setVerified(localStorage.getItem(KEY) === 'yes');
  }, []);

  const verify = () => {
    localStorage.setItem(KEY, 'yes');
    setVerified(true);
  };

  const reset = () => {
    localStorage.removeItem(KEY);
    setVerified(false);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 to-black text-white px-6 py-12">
      <div className="max-w-xl mx-auto">
        <Link
          href="/demos"
          className="text-xs text-slate-400 hover:text-slate-200"
        >
          ← demos
        </Link>
        <div className="mt-6 mb-8">
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">
            Door 2 · bindings: identity
          </p>
          <h1 className="text-2xl font-bold tracking-tight">
            Verified human, any browser
          </h1>
        </div>

        {verified === null && (
          <div className="text-slate-400 text-sm">Loading…</div>
        )}

        {verified === false && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 mb-8">
            <p className="text-sm text-slate-300 mb-4">
              This page requires a human-auth token. Click below to obtain one.
              (In production this would be World ID, a passkey, or a SIWE
              signature — for the demo the token is a localStorage flag.)
            </p>
            <button
              onClick={verify}
              className="px-5 py-2.5 rounded-full bg-white text-black font-semibold active:scale-95 transition-transform"
            >
              I am human
            </button>
          </div>
        )}

        {verified === true && (
          <>
            <div className="rounded-xl border border-emerald-800/40 bg-emerald-900/10 p-6 mb-8">
              <p className="text-lg leading-relaxed">
                The launch code is{' '}
                <span className="font-mono">4-7-2-3-α</span>.
              </p>
              <p className="text-sm text-emerald-300/70 mt-3">
                Rendered because a human-auth token is present.
              </p>
            </div>
            <button
              onClick={reset}
              className="text-xs text-slate-400 underline hover:text-slate-200 mb-8"
            >
              Clear token
            </button>
          </>
        )}

        <div className="text-xs text-slate-400 leading-relaxed space-y-3">
          <p>
            <strong className="text-slate-200">What this demonstrates.</strong>{' '}
            Identity binding raises the bar for casual scraping, but the token
            itself is transferable. Open this page in Chrome, click{' '}
            <em>I am human</em>, and the content renders. Now copy the token
            out of devtools and paste it into a colleague&apos;s browser — they
            see the same content.
          </p>
          <p>
            <strong className="text-slate-200">Why this fails vohu.</strong> A
            coercer standing next to the voter can demand the token, load the
            ballot on their own machine, and watch the vote cast itself. The
            token proves a human exists; it does not prove{' '}
            <em>this human, right now, in front of this screen</em>.
          </p>
          <p>
            <strong className="text-slate-200">Next door.</strong>{' '}
            <Link
              href="/demos/prome"
              className="underline hover:text-white"
            >
              /demos/prome
            </Link>{' '}
            adds the runtime binding. Same token, stricter gate.
          </p>
        </div>
      </div>
    </main>
  );
}
