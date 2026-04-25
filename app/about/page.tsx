// Public-facing About page. Acts as the App Official Website registered
// in the World Developer Portal — a no-auth surface a reviewer can land
// on to understand what vohu is, how it treats user data, and how to
// reach us. Nothing here is gated; this page is intentionally crawlable.

import Link from 'next/link';
import { BackBar } from '@/components/BackBar';

export const metadata = {
  title: 'About · vohu',
  description:
    'vohu is a privacy-preserving voting Mini App for World ID. ' +
    'Ballots are encrypted on-device; only the aggregate tally is ever decrypted.',
};

const GITHUB_URL = 'https://github.com/Ryujiyasu/vohu';
const MINIAPP_URL =
  'https://world.org/mini-app?app_id=app_7ef7c4ad41af2d289fd9312a18bb8d68';

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 to-black text-white px-6 py-10">
      <div className="max-w-2xl mx-auto space-y-10">
        <BackBar />

        <header className="space-y-3">
          <h1 className="text-5xl font-bold tracking-tight">vohu</h1>
          <p className="text-lg text-slate-300">
            Encrypted votes for verified humans.
          </p>
          <p className="text-sm text-slate-400 leading-relaxed">
            A privacy-preserving voting Mini App for{' '}
            <a
              href="https://world.org"
              className="text-emerald-400 hover:text-emerald-300"
            >
              World
            </a>
            . World ID guarantees one person, one vote. Each ballot is
            encrypted on-device with an additive homomorphic cipher. The
            server aggregates ciphertexts homomorphically — only the final
            tally is ever decrypted.
          </p>
        </header>

        <Section title="How a vote works">
          <ol className="list-decimal list-inside space-y-2 text-slate-300 text-sm leading-relaxed">
            <li>
              You verify with World ID — Orb-attested proof of personhood,
              one nullifier per proposal.
            </li>
            <li>
              Your choice (yes / no / abstain) is encoded as a vector and
              encrypted on your device with a Paillier public key. The
              ciphertext leaves your device; the plaintext never does.
            </li>
            <li>
              The server adds your ciphertext to a running aggregate. Per
              Paillier&rsquo;s additive-homomorphic property, the sum of
              encrypted ballots equals the encryption of the sum.
            </li>
            <li>
              When the proposal closes, threshold trustees jointly decrypt
              the aggregate. No single party can decrypt a ballot or even
              the running total. The result is published; individual
              ballots remain encrypted forever.
            </li>
          </ol>
        </Section>

        <Section title="What vohu does not see">
          <ul className="list-disc list-inside space-y-2 text-slate-300 text-sm leading-relaxed">
            <li>
              Your wallet address (we use World ID nullifiers, not
              addresses, for the vote-once binding).
            </li>
            <li>
              Your individual ballot in cleartext — at no point in the
              pipeline.
            </li>
            <li>
              Cross-proposal correlation — each proposal uses an
              action-scoped nullifier, so the same human casts unlinkable
              votes across different polls.
            </li>
          </ul>
        </Section>

        <Section title="Threat model, in plain text">
          <p className="text-sm text-slate-300 leading-relaxed">
            For one ballot to leak in v1, the operator running the
            aggregation server would have to be coerced and turn over the
            single trustee key. v2 (research roadmap) splits that key
            across independent trustees in separate jurisdictions
            (currently targeting Japan + Taiwan + an academic / nonprofit
            trustee under a <code className="font-mono">k-of-n</code>{' '}
            scheme), so a leak requires multiple governments to
            cooperatively act against their own citizens. That is the
            failure mode we are designing against.
          </p>
        </Section>

        <Section title="Who built this">
          <p className="text-sm text-slate-300 leading-relaxed">
            vohu was built for{' '}
            <a
              href="https://worldbuildlabs.com"
              className="text-emerald-400 hover:text-emerald-300"
            >
              World Build 3 (April 2026)
            </a>{' '}
            as the first application of a research primitive: threshold
            homomorphic aggregation on verified-human inputs. The same
            primitive will eventually power matching, coordination, and
            compatibility surfaces — voting is the cleanest first proof.
          </p>
        </Section>

        <Section title="Open source">
          <p className="text-sm text-slate-300 leading-relaxed">
            All cryptographic code, server aggregation logic, and Mini App
            UI are public. Audit, fork, or run your own trustee.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href={GITHUB_URL}
              className="px-4 py-2 bg-white text-black rounded-full text-sm font-semibold active:scale-95 transition-transform"
            >
              GitHub repo →
            </a>
            <a
              href={MINIAPP_URL}
              className="px-4 py-2 border border-emerald-700 text-emerald-300 rounded-full text-sm font-semibold active:scale-95 transition-transform"
            >
              Open in World App →
            </a>
            <Link
              href="/"
              className="px-4 py-2 border border-slate-700 text-slate-300 rounded-full text-sm font-semibold active:scale-95 transition-transform"
            >
              Try it live →
            </Link>
          </div>
        </Section>

        <Section title="Contact">
          <p className="text-sm text-slate-300 leading-relaxed">
            Issues, security disclosures, and trustee inquiries:{' '}
            <a
              href={`${GITHUB_URL}/issues`}
              className="text-emerald-400 hover:text-emerald-300"
            >
              file a GitHub issue
            </a>
            . For sensitive reports, contact the maintainer directly via
            the email listed on the GitHub profile.
          </p>
        </Section>

        <footer className="pt-8 border-t border-slate-800 text-xs text-slate-500">
          vohu · MIT licensed · Built on World ID, Paillier homomorphic
          encryption, and (research track) hyde / argo / plat.
        </footer>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {children}
    </section>
  );
}
