'use client';

import { useEffect, useState } from 'react';

declare global {
  interface Window {
    WorldApp?: unknown;
  }
}

export function useInVerifiedHumanContext(): boolean | null {
  const [isHuman, setIsHuman] = useState<boolean | null>(null);
  useEffect(() => {
    setIsHuman(typeof window !== 'undefined' && typeof window.WorldApp !== 'undefined');
  }, []);
  return isHuman;
}

const CIPHER_CHARS = '!@#$%^&*()_+{}[]<>?/|\\~`abcdef0123456789';

export function obfuscate(text: string): string {
  let seed = 0x9e3779b9;
  for (let i = 0; i < text.length; i++) {
    seed = Math.imul(seed ^ text.charCodeAt(i), 0x85ebca6b) >>> 0;
  }
  return text
    .split('')
    .map((c, i) => {
      if (c === '\n') return '\n';
      seed = Math.imul(seed ^ (i * 0x27d4eb2d), 0xc2b2ae35) >>> 0;
      return CIPHER_CHARS[seed % CIPHER_CHARS.length];
    })
    .join('');
}
