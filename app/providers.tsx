'use client';

import { MiniKit } from '@worldcoin/minikit-js';
import { useEffect, ReactNode } from 'react';

export function MiniKitProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_APP_ID as `app_${string}` | undefined;
    if (appId) {
      MiniKit.install(appId);
    }
  }, []);

  return <>{children}</>;
}
