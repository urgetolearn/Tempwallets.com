import { useWalletDataContext } from '@/contexts/wallet-data-context';
import { NormalizedBalance, Transaction } from '@/types/wallet-data';

/**
 * Hook to access wallet data from the centralized provider
 * Provides normalized data and granular errors
 */
export function useWalletData() {
  const context = useWalletDataContext();

  return {
    balances: context.balances,
    transactions: context.transactions,
    loading: context.loading,
    errors: context.errors,
    refresh: context.refresh,
    refreshBalances: context.refreshBalances,
    refreshTransactions: context.refreshTransactions,
    lastFetched: context.lastFetched,
  };
}

