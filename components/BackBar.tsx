// Shared top-left back link. Drop one into any page so a user who
// ended up deep in a flow can always get back to the Dashboard in one
// tap — necessary because Mini App WebViews don't show a native back
// button.

import Link from 'next/link';

export function BackBar({ href = '/' }: { href?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center text-xs text-slate-400 hover:text-slate-200"
    >
      ← vohu
    </Link>
  );
}
