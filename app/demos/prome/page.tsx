'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useInVerifiedHumanContext, obfuscate } from '@/lib/prome';

// Demo 3: "identity + runtime bindings."
//
// Uses the same localStorage "token" as /demos/verified, but ALSO checks
// window.WorldApp. In Chrome, even with the token set, the content refuses
// to render — you see ciphertext.

const KEY = 'vohu-demo-verified';

export default function PromeDemo() {
  const isHuman = useInVerifiedHumanContext();
  const [verified, setVerified] = useState<boolean | null>(null);

  useEffect(() => {
    setVerified(localStorage.getItem(KEY) === 'yes');
  }, []);

  const verify = () => {
    localStorage.setItem(KEY, 'yes');
    setVerified(true);
  };

  // Runtime-not-World-App: render obfuscated even if the identity token is set.
  if (isHuman === false) {
    const scrambled = obfuscate(
      'The launch code is 4-7-2-3-α. The launch code is 4-7-2-3-α. '.repeat(6),
    );
    return (
      <main className="min-h-screen bg-black text-emerald-400 font-mono px-6 py-12">
        <div className="max-w-xl mx-auto">
          <Link
            href="/demos"
            className="text-xs text-slate-500 hover:text-slate-300 font-sans"
          >
            ← demos
          </Link>
          <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest mt-6 mb-2">
            Door 3 · bindings: identity + runtime
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-white font-sans mb-6">
            prome — ciphertext outside, plaintext inside
          </h1>

          <pre className="whitespace-pre-wrap break-words text-xs opacity-70 mb-8">
            {scrambled}
          </pre>

          <div className="text-xs text-slate-400 leading-relaxed space-y-3 font-sans">
            <p className="text-emerald-300">
              🔒 You are outside the World App runtime. Even if you set the
              identity token (try it in devtools), this content will remain
              scrambled. The binding is enforced by the{' '}
              <em>place the code runs</em>, not by a cookie.
            </p>
            <p>
              <strong className="text-slate-200">Why this matters.</strong> A
              coercer who extorts your World ID nullifier cannot reproduce the
              ballot on their laptop. The Mini App sandbox is the substrate
              that renders plaintext, and it only exists on a paired Worldcoin
              device.
            </p>
            <p>
              Open this same URL inside World App to see the plaintext side.
            </p>
          </div>
        </div>
      </main>
    );
  }

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
            Door 3 · bindings: identity + runtime
          </p>
          <h1 className="text-2xl font-bold tracking-tight">
            prome — plaintext for verified humans, only here
          </h1>
        </div>

        {verified === null && (
          <div className="text-slate-400 text-sm">Loading…</div>
        )}

        {verified === false && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 mb-8">
            <p className="text-sm text-slate-300 mb-4">
              You&apos;re inside World App (good), but no identity token yet.
              Claim one to see the content.
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
          <div className="rounded-xl border border-emerald-800/40 bg-emerald-900/10 p-6 mb-8">
            <p className="text-lg leading-relaxed">
              The launch code is{' '}
              <span className="font-mono">4-7-2-3-α</span>.
            </p>
            <p className="text-sm text-emerald-300/70 mt-3">
              Rendered because (1) a human-auth token is present AND (2) this
              page is running inside the World App runtime.
            </p>
          </div>
        )}

        <div className="text-xs text-slate-400 leading-relaxed space-y-3">
          <p>
            <strong className="text-slate-200">What this demonstrates.</strong>{' '}
            Identity + runtime bindings. Either alone is insufficient. Together
            they produce what vohu calls the <em>coercion-resistant
            rendering surface</em>: ciphertext escapes any adversary-controlled
            environment, plaintext only exists inside a device the voter
            physically holds.
          </p>
          <p>
            <strong className="text-slate-200">vohu&apos;s ballot path.</strong>{' '}
            /vote and /result live at exactly this binding level. That is why
            they refuse to decrypt in Chrome, and why a forwarded session
            yields no useful information to a coercer.
          </p>
        </div>
      </div>
    </main>
  );
}
