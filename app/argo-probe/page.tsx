// Preflight: verifies argo-wasm loads and roundtrips a ballot-validity
// proof through MockBackend in Next.js. Mirrors /hyde-probe.

'use client';

import { useEffect, useState } from 'react';
import { argoInfo, proveAndVerify } from '@/lib/argo';
import { BackBar } from '@/components/BackBar';

type Status =
  | { kind: 'idle' }
  | { kind: 'running' }
  | {
      kind: 'ok';
      version: string;
      statementKind: string;
      backend: string;
      proofBytes: number;
      publicInputBytes: number;
      verified: boolean;
    }
  | { kind: 'err'; message: string };

export default function ArgoProbe() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus({ kind: 'running' });
      try {
        const { version } = await argoInfo();

        const ballot = {
          numOptions: 3,
          nullifier: new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
          ciphertexts: [
            new Uint8Array([1, 1, 1]),
            new Uint8Array([2, 2, 2]),
            new Uint8Array([3, 3, 3]),
          ],
        };
        const witness = {
          chosen: 1,
          randomness: [
            new Uint8Array([9]),
            new Uint8Array([9]),
            new Uint8Array([9]),
          ],
          secretKey: new Uint8Array(32).fill(0xab),
        };

        const result = await proveAndVerify(ballot, witness);
        if (cancelled) return;
        setStatus({
          kind: 'ok',
          version,
          statementKind: result.statementKind,
          backend: result.backend,
          proofBytes: result.proof.byteLength,
          publicInputBytes: result.publicInputs.byteLength,
          verified: result.verified,
        });
      } catch (e) {
        if (cancelled) return;
        setStatus({ kind: 'err', message: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main style={{ fontFamily: 'ui-monospace, monospace', padding: '2rem', maxWidth: 720 }}>
      <div style={{ marginBottom: '1rem' }}>
        <BackBar />
      </div>
      <h1>argo-wasm preflight</h1>
      <p style={{ color: '#666' }}>
        ballot-validity proof (mock backend) round-trip through argo-wasm.
      </p>
      {status.kind === 'idle' && <p>waiting…</p>}
      {status.kind === 'running' && <p>running…</p>}
      {status.kind === 'ok' && (
        <pre style={{ background: '#f4f4f4', padding: '1rem' }}>
          {[
            `ok`,
            `argo version       : ${status.version}`,
            `statement kind     : ${status.statementKind}`,
            `backend            : ${status.backend}`,
            `public input bytes : ${status.publicInputBytes}`,
            `proof bytes        : ${status.proofBytes}`,
            `verified           : ${status.verified}`,
          ].join('\n')}
        </pre>
      )}
      {status.kind === 'err' && (
        <pre style={{ background: '#fee', color: '#900', padding: '1rem' }}>
          {`FAILED\n${status.message}`}
        </pre>
      )}
    </main>
  );
}
