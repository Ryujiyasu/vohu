// Phase H4 preflight: verifies hyde-wasm loads and roundtrips in Next.js.
// Remove this route once Phase H4 (proper ballot encryption) lands.

'use client';

import { useEffect, useState } from 'react';
import { protectText, unprotectText } from '@/lib/hyde';
import { BackBar } from '@/components/BackBar';

type Status =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'ok'; ciphertextBytes: number; recovered: string }
  | { kind: 'err'; message: string };

export default function HydeProbe() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus({ kind: 'running' });
      try {
        const msg = 'hello from vohu preflight';
        const blob = await protectText(msg);
        const recovered = await unprotectText(blob);
        if (cancelled) return;
        if (recovered !== msg) {
          setStatus({ kind: 'err', message: `roundtrip mismatch: ${recovered}` });
          return;
        }
        setStatus({ kind: 'ok', ciphertextBytes: blob.byteLength, recovered });
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
    <main style={{ fontFamily: 'ui-monospace, monospace', padding: '2rem', maxWidth: 640 }}>
      <div style={{ marginBottom: '1rem' }}>
        <BackBar />
      </div>
      <h1>hyde-wasm preflight</h1>
      {status.kind === 'idle' && <p>waiting…</p>}
      {status.kind === 'running' && <p>running…</p>}
      {status.kind === 'ok' && (
        <pre style={{ background: '#f4f4f4', padding: '1rem' }}>
          {`ok\nciphertext: ${status.ciphertextBytes} bytes\nrecovered : ${status.recovered}`}
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
