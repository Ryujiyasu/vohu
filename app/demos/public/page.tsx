import Link from 'next/link';

export default function PublicDemo() {
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
            Door 1 · bindings: none
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Public content</h1>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 mb-8">
          <p className="text-lg leading-relaxed">
            The launch code is <span className="font-mono">4-7-2-3-α</span>.
          </p>
          <p className="text-sm text-slate-400 mt-3">
            You are reading this page. That is the entire access control story.
          </p>
        </div>

        <div className="text-xs text-slate-400 leading-relaxed space-y-3">
          <p>
            <strong className="text-slate-200">What this demonstrates.</strong>{' '}
            No bindings means no assurance about who the reader is, what device
            they&apos;re on, or where the content rendered. A scraper, a cached
            CDN, a screenshot, a forwarded link — every one of them reproduces
            the content perfectly.
          </p>
          <p>
            <strong className="text-slate-200">Where vohu stands.</strong>{' '}
            Ballots MUST never render at this level. If they did, a bystander
            watching over your shoulder, a compromised browser extension, or a
            coerced screenshare would all see the vote.
          </p>
        </div>
      </div>
    </main>
  );
}
