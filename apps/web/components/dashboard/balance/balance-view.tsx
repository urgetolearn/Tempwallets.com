'use client';

import { useMemo } from 'react';
import { useState } from 'react';
import Image from 'next/image';
import { Loader2, TrendingUp, Eye, EyeOff } from 'lucide-react';
import { useWalletData } from '@/hooks/useWalletData';
import { TokenBalanceItem } from './token-balance-item';
import { NormalizedBalance } from '@/types/wallet-data';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';

import { useWalletConfig } from '@/hooks/useWalletConfig';

/**
 * Container component that displays token balances
 * Uses useWalletData hook to get balances from provider
 */
interface BalanceViewProps {
  onOpenSend?: (chain: string, tokenSymbol?: string) => void;
  selectedChainId: string;
}

export function BalanceView({ onOpenSend, selectedChainId }: BalanceViewProps) {
  const [hideBalance, setHideBalance] = useState(false);
  const { balances: realBalances, loading } = useWalletData();
  const walletConfig = useWalletConfig();

  // Helper to group/filter balances
  const processBalances = (rawBalances: NormalizedBalance[]) => {
    let totalUsd = 0;
    const byChain = new Map<string, NormalizedBalance[]>();

    for (const balance of rawBalances) {
      if (balance.valueUsd) totalUsd += balance.valueUsd;

      // Filter zero balances if they are not native (we might want to keep native)
      // But for now, let's keep everything the API returns

      const existing = byChain.get(balance.chain) || [];
      existing.push(balance);
      byChain.set(balance.chain, existing);
    }

    const grouped: Array<{ chain: string; balances: NormalizedBalance[] }> = [];
    for (const [chain, chainBalances] of byChain.entries()) {
      const sorted = chainBalances.sort((a, b) => {
        if (a.valueUsd && b.valueUsd && a.valueUsd !== b.valueUsd) return b.valueUsd - a.valueUsd;
        if (a.isNative && !b.isNative) return -1;
        if (!a.isNative && b.isNative) return 1;
        return a.symbol.localeCompare(b.symbol);
      });
      grouped.push({ chain, balances: sorted });
    }
    grouped.sort((a, b) => a.chain.localeCompare(b.chain));

    return { groupedBalances: grouped, totalBalanceUsd: totalUsd };
  };

  // 1. Process balances
  const { groupedBalances, totalBalanceUsd: globalTotal } = useMemo(() => processBalances(realBalances), [realBalances]);

  // Resolve authoritative chain info
  const selectedChainConfig = walletConfig.getById(selectedChainId);
  const selectedChainName = selectedChainConfig?.name || 'Unknown Chain';
  const chainSymbol = selectedChainConfig?.symbol || 'TOKEN';

  // LOGIC: "Unless and until someanother token is there i want you to use native token of repesctive blockchain"
  // 1. Get real tokens for this chain
  //
  // The backend (Zerion) uses canonical chain keys: 'ethereum', 'base', 'arbitrum', etc.
  // The chain selector uses wallet-config keys: 'ethereumErc4337', 'baseErc4337', etc.
  // We must map the selected config ID → the Zerion chain key before looking up balances,
  // otherwise this find() never matches and the UI always shows a zero-balance fallback.
  const CONFIG_ID_TO_CHAIN: Record<string, string> = {
    ethereumErc4337: 'ethereum',
    baseErc4337: 'base',
    arbitrumErc4337: 'arbitrum',
    polygonErc4337: 'polygon',
    avalancheErc4337: 'avalanche',
  };
  const backendChainKey = CONFIG_ID_TO_CHAIN[selectedChainId] ?? selectedChainId;
  const chainGroup = groupedBalances.find(g => g.chain === backendChainKey);
  const realChainTokens = chainGroup ? chainGroup.balances : [];

  // 2. Decide what to display
  // If we have real tokens, show them.
  // If NOT, show the Native Token fallback (0 balance).
  const displayBalances = realChainTokens.length > 0
    ? realChainTokens
    : [{
      chain: selectedChainId,
      symbol: chainSymbol,
      balance: '0',
      decimals: 18,
      balanceHuman: '0.00',
      valueUsd: 0,
      isNative: true,
      address: null,
    }] as NormalizedBalance[];

  // Calculate total for THIS chain selection
  const totalBalanceUsd = displayBalances.reduce((acc, curr) => acc + (curr.valueUsd || 0), 0);

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  // Show loading spinner while the FIRST fetch is in-flight.
  // The context only sets loading.balances=true when showLoading=true (manual refresh).
  // For the initial load we infer "fetching" by: no balances AND no explicit loading flag.
  // We show a subtle spinner instead of the empty mailbox so the user knows data is coming.
  if (realBalances.length === 0) {
    return (
      <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400 mb-4" />
        <p className="text-gray-500 font-rubik-normal">Loading balances...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
      {/* 1. Total Balance Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-sm text-gray-500 font-rubik-normal">Total Balance</h2>
            <button
              onClick={() => setHideBalance(!hideBalance)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label={hideBalance ? 'Show balance' : 'Hide balance'}
            >
              {hideBalance ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-3xl font-rubik-semibold text-gray-900">
            {hideBalance ? '••••••' : formatCurrency(totalBalanceUsd)}
          </p>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 text-green-600 bg-green-50 px-3 py-1.5 rounded-lg">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm font-rubik-medium">Live</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Balance updates in real-time</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* 2. Asset List - Forced Single Item for Selected Chain */}
      <div className="space-y-3 mt-4 relative z-10">
        {displayBalances.map((balance, index) => {
          // Use contract address for ERC-20 tokens; 'native' suffix for native tokens
          const key = `${balance.chain}-${balance.address ?? 'native'}`;
          return (
            <TokenBalanceItem
              key={key}
              chain={balance.chain}
              symbol={balance.symbol}
              balance={balance.balance}
              decimals={balance.decimals}
              balanceHuman={balance.balanceHuman}
              valueUsd={balance.valueUsd}
              isNative={balance.isNative}
              chainName={walletConfig.getById(balance.chain)?.name || selectedChainName}
              onOpenSend={onOpenSend}
            />
          );
        })}
      </div>

      {/* 3. Empty State — shown ONLY when the chain has no real token data (i.e., we are
           showing the 0-balance placeholder). Previously this fired whenever valueUsd was
           undefined, which is always true because the API does not return USD pricing.
           That caused "No Tokens Available" to appear on top of real token rows. */}
      {realChainTokens.length === 0 && (
        <div className="flex flex-col items-center justify-center pb-4 -mt-10 relative z-0">
          <div className="pointer-events-none transform scale-75 sm:scale-90 -mb-4">
            <Image
              src="/empty-mailbox-illustration-with-spiderweb-and-flie-2025-10-20-04-28-09-utc.gif"
              alt="No Tokens Available"
              width={320}
              height={320}
              className="object-contain mix-blend-multiply"
            />
          </div>
          <p className="text-gray-500 text-sm font-rubik-normal z-10 -mt-8 relative">
            No Tokens Available
          </p>
        </div>
      )}
    </div>
  );
}
