'use client';

import { ReactNode } from 'react';
import { WalletDataProvider } from '@/contexts/wallet-data-context';
import { useBrowserFingerprint } from '@/hooks/useBrowserFingerprint';

interface ProvidersProps {
  children: ReactNode;
}

/**
 * Root providers component that wraps the app with all necessary context providers
 * Ensures providers are mounted only once for the entire application
 */
export function Providers({ children }: ProvidersProps) {
  const { fingerprint } = useBrowserFingerprint();

  return (
    <WalletDataProvider fingerprint={fingerprint}>
      {children}
    </WalletDataProvider>
  );
}

