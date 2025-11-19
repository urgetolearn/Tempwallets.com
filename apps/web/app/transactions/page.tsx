"use client";

import { useState, useEffect } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import { Loader2, Send, RefreshCw, AlertCircle, Wallet } from "lucide-react";
import { walletApi, TokenBalance, ApiError } from "@/lib/api";
import { useBrowserFingerprint } from "@/hooks/useBrowserFingerprint";
import { SendCryptoModal } from "@/components/dashboard/send-crypto-modal";
import RecentTransactions from "@/components/dashboard/recent-transactions";

const CHAIN_NAMES: Record<string, string> = {
  // Zerion canonical chain ids
  ethereum: "Ethereum",
  base: "Base",
  arbitrum: "Arbitrum",
  polygon: "Polygon",
  solana: "Solana",
  avalanche: "Avalanche",
  // Legacy/internal (not expected here but kept as fallback)
  tron: "Tron",
  bitcoin: "Bitcoin",
  ethereumErc4337: "Ethereum (ERC-4337)",
  baseErc4337: "Base (ERC-4337)",
  arbitrumErc4337: "Arbitrum (ERC-4337)",
  polygonErc4337: "Polygon (ERC-4337)",
  avalancheErc4337: "Avalanche (ERC-4337)",
  // Polkadot EVM Compatible chains
  moonbeamTestnet: "Moonbeam Testnet",
  astarShibuya: "Astar Shibuya",
  paseoPassetHub: "Paseo PassetHub",
  // Substrate/Polkadot chains
  polkadot: "Polkadot",
  hydrationSubstrate: "Hydration (Substrate)",
  bifrostSubstrate: "Bifrost (Substrate)",
  uniqueSubstrate: "Unique (Substrate)",
  paseo: "Paseo",
  paseoAssethub: "Paseo AssetHub",
};

const NATIVE_TOKEN_SYMBOLS: Record<string, string> = {
  // Zerion canonical chains
  ethereum: 'ETH',
  base: 'ETH',
  arbitrum: 'ETH',
  polygon: 'MATIC',
  solana: 'SOL',
  avalanche: 'AVAX',
  // Legacy/internal fallbacks
  tron: 'TRX',
  bitcoin: 'BTC',
  ethereumErc4337: 'ETH',
  baseErc4337: 'ETH',
  arbitrumErc4337: 'ETH',
  polygonErc4337: 'MATIC',
  avalancheErc4337: 'AVAX',
  // Polkadot EVM Compatible chains
  moonbeamTestnet: 'DEV',
  astarShibuya: 'SBY',
  paseoPassetHub: 'PAS',
  // Substrate/Polkadot chains
  polkadot: 'DOT',
  hydrationSubstrate: 'HDX',
  bifrostSubstrate: 'BFC',
  uniqueSubstrate: 'UNQ',
  paseo: 'PAS',
  paseoAssethub: 'PAS',
};

const getNativeTokenSymbol = (chain: string): string => {
  return NATIVE_TOKEN_SYMBOLS[chain] || 'TOKEN';
};

// Convert smallest units to human-readable using actual token decimals
const formatBalance = (balance: string, decimals: number): string => {
  const num = parseFloat(balance);
  if (isNaN(num)) return "0";
  const humanReadable = num / Math.pow(10, decimals);
  return humanReadable.toFixed(6).replace(/\.?0+$/, "");
};

interface ChainBalance {
  chain: string;
  nativeBalance: string;
  nativeDecimals: number;
  nativeBalanceHuman?: string;
  tokens: (TokenBalance & { balanceHuman?: string })[];
  category?: string;
}

// Polkadot EVM compatible chains
const POLKADOT_EVM_CHAINS = ['moonbeamTestnet', 'astarShibuya', 'paseoPassetHub'];

// Substrate/Polkadot chains
const SUBSTRATE_CHAINS = ['polkadot', 'hydrationSubstrate', 'bifrostSubstrate', 'uniqueSubstrate', 'paseo', 'paseoAssethub'];

const getChainCategory = (chain: string): string | undefined => {
  if (POLKADOT_EVM_CHAINS.includes(chain)) {
    return 'polkadot-evm';
  }
  if (SUBSTRATE_CHAINS.includes(chain)) {
    return 'substrate';
  }
  return undefined;
};

export default function TransactionsPage() {
  const { fingerprint } = useBrowserFingerprint();
  const [chainBalances, setChainBalances] = useState<ChainBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedChain, setSelectedChain] = useState<string | null>(null);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  // No per-chain error tracking needed with any-chain fetch

  useEffect(() => {
    if (fingerprint) {
      loadBalances();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint]);

  const loadBalances = async () => {
    if (!fingerprint) {
      console.log('⏸️ No fingerprint available, skipping balance load');
      return;
    }

    console.log('🚀 Starting loadBalances for user:', fingerprint);
    setLoading(true);
    setError(null);
    setChainBalances([]);

    try {
      // Load EVM and other chain assets
      const assets = await walletApi.getAssetsAny(fingerprint);

      // Group assets by chain and split native vs tokens
      const map = new Map<string, ChainBalance>();
      for (const a of assets) {
        const existing = map.get(a.chain) || { 
          chain: a.chain, 
          nativeBalance: '0', 
          nativeDecimals: 18,
          nativeBalanceHuman: undefined,
          tokens: [],
          category: getChainCategory(a.chain)
        };
        if (a.address === null) {
          // Native token - use actual decimals from API
          existing.nativeBalance = a.balance;
          existing.nativeDecimals = a.decimals;
          existing.nativeBalanceHuman = a.balanceHuman;
        } else {
          // ERC-20 or other tokens - preserve decimals and balanceHuman
          existing.tokens.push({ 
            address: a.address, 
            symbol: a.symbol, 
            balance: a.balance, 
            decimals: a.decimals,
            balanceHuman: a.balanceHuman
          });
        }
        map.set(a.chain, existing);
      }

      // Load Substrate balances
      try {
        console.log('🔄 Fetching Substrate balances for user:', fingerprint);
        const substrateBalances = await walletApi.getSubstrateBalances(fingerprint, false);
        console.log('✅ Substrate balances received:', substrateBalances);
        
        // Map backend chain keys to frontend chain keys
        const chainKeyMap: Record<string, string> = {
          polkadot: 'polkadot',
          hydration: 'hydrationSubstrate',
          bifrost: 'bifrostSubstrate',
          unique: 'uniqueSubstrate',
          paseo: 'paseo',
          paseoAssethub: 'paseoAssethub',
        };
        
        let substrateCount = 0;
        for (const [backendChain, balanceData] of Object.entries(substrateBalances)) {
          if (!balanceData.address) {
            console.log(`⏭️ Skipping ${backendChain}: no address`);
            continue; // Skip if no address
          }
          
          // Map backend chain key to frontend chain key
          const frontendChain = chainKeyMap[backendChain] || backendChain;
          
          // Always add Substrate chains, even with zero balance (like Polkadot EVM chains)
          const balance = parseFloat(balanceData.balance);
          map.set(frontendChain, {
            chain: frontendChain,
            nativeBalance: balanceData.balance,
            nativeDecimals: balanceData.decimals,
            nativeBalanceHuman: balance > 0 ? formatBalance(balanceData.balance, balanceData.decimals) : undefined,
            tokens: [],
            category: 'substrate'
          });
          substrateCount++;
          console.log(`✅ Added Substrate chain ${frontendChain} (${backendChain}): ${balanceData.balance} ${balanceData.token}`);
        }
        console.log(`📊 Total Substrate chains added: ${substrateCount}`);
      } catch (substrateErr) {
        console.error('❌ Failed to load Substrate balances:', substrateErr);
        console.error('Error details:', substrateErr instanceof Error ? substrateErr.message : String(substrateErr));
        // Don't fail the whole load if Substrate fails
      }

      const balances = Array.from(map.values());
      
      // Ensure Polkadot EVM chains are always present, even with zero balance
      const existingPolkadotChains = balances.filter(cb => cb.category === 'polkadot-evm').map(cb => cb.chain);
      POLKADOT_EVM_CHAINS.forEach(chain => {
        if (!existingPolkadotChains.includes(chain)) {
          balances.push({
            chain,
            nativeBalance: '0',
            nativeDecimals: 18,
            nativeBalanceHuman: undefined,
            tokens: [],
            category: 'polkadot-evm'
          });
        }
      });
      
      // Ensure Substrate chains are always present, even with zero balance
      const existingSubstrateChains = balances.filter(cb => cb.category === 'substrate').map(cb => cb.chain);
      SUBSTRATE_CHAINS.forEach(chain => {
        if (!existingSubstrateChains.includes(chain)) {
          // Get default decimals for Substrate chains
          const defaultDecimals: Record<string, number> = {
            polkadot: 10,
            hydrationSubstrate: 12,
            bifrostSubstrate: 12,
            uniqueSubstrate: 18,
            paseo: 10,
            paseoAssethub: 10,
          };
          balances.push({
            chain,
            nativeBalance: '0',
            nativeDecimals: defaultDecimals[chain] || 10,
            nativeBalanceHuman: undefined,
            tokens: [],
            category: 'substrate'
          });
        }
      });
      
      setChainBalances(balances);
    } catch (err) {
      const errorMessage = err instanceof ApiError ? err.message : 'Failed to load balances. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Map Zerion chain ids to backend internal chain identifiers for sending
  const mapChainForSend = (chain: string): string | null => {
    const m: Record<string, string> = {
      // Zerion canonical chains (map to internal send identifiers)
      ethereum: 'ethereum',
      base: 'baseErc4337',
      arbitrum: 'arbitrumErc4337',
      polygon: 'polygonErc4337',
      solana: 'solana',
      avalanche: 'avalancheErc4337',
      tron: 'tron',
      bitcoin: 'bitcoin',
      // Already-internal identifiers should pass through unchanged
      ethereumErc4337: 'ethereumErc4337',
      baseErc4337: 'baseErc4337',
      arbitrumErc4337: 'arbitrumErc4337',
      polygonErc4337: 'polygonErc4337',
      avalancheErc4337: 'avalancheErc4337',
      // Substrate chains - pass through as-is
      polkadot: 'polkadot',
      hydrationSubstrate: 'hydrationSubstrate',
      bifrostSubstrate: 'bifrostSubstrate',
      uniqueSubstrate: 'uniqueSubstrate',
      paseo: 'paseo',
      paseoAssethub: 'paseoAssethub',
    };
    return m[chain] || null;
  };

  const handleSendClick = (chain: string) => {
    const mapped = mapChainForSend(chain);
    if (!mapped) return;
    setSelectedChain(mapped);
    setSendModalOpen(true);
  };

  const handleSendSuccess = () => {
    // Reload balances after successful send
    if (fingerprint) {
      loadBalances();
    }
  };

  // No per-chain retry now; full reload is enough

  return (
    <div className="min-h-screen px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Header Section */}
        <div className="mb-8 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-white sm:text-4xl">
                Transactions
              </h1>
              <p className="mt-2 text-base text-white/70">
                Manage your assets across all chains
              </p>
            </div>
            <Button
              onClick={loadBalances}
              disabled={loading}
              className="gap-2 rounded-full bg-white/10 px-4 py-5 text-white hover:bg-white/20"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>

        {/* Balance Cards Section */}
        <Card className="mb-8 border-white/10 rounded-2xl bg-black/70 text-white shadow-2xl backdrop-blur">
          <CardContent className="p-6 sm:p-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-full bg-white/10 p-2">
                <Wallet className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-xl font-semibold">Your Balances</h2>
            </div>

            {loading && chainBalances.length === 0 ? (
              <div className="py-12 text-center">
                <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-white/60" />
                <p className="text-sm text-white/70">Loading balances...</p>
              </div>
            ) : error && chainBalances.length === 0 ? (
              <div className="py-12 text-center">
                <AlertCircle className="mx-auto mb-4 h-8 w-8 text-red-400" />
                <p className="mb-4 text-sm text-red-400">{error}</p>
                <Button
                  onClick={loadBalances}
                  variant="outline"
                  className="rounded-full border-white/20 text-white hover:bg-white/10"
                >
                  Try Again
                </Button>
              </div>
            ) : (
              <>
                {chainBalances
                  .filter((chainBalance) => {
                    // Only show chains with non-zero balance
                    const nativeBalance = parseFloat(chainBalance.nativeBalance);
                    const hasTokenBalance = chainBalance.tokens.some(token => parseFloat(token.balance) > 0);
                    return nativeBalance > 0 || hasTokenBalance;
                  })
                  .length === 0 ? (
                  <div className="py-12 text-center">
                    <Wallet className="mx-auto mb-4 h-12 w-12 text-white/40" />
                    <p className="text-sm text-white/70">No balances found. Your wallets are empty.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {chainBalances
                      .filter((chainBalance) => {
                        // Only show chains with non-zero balance
                        const nativeBalance = parseFloat(chainBalance.nativeBalance);
                        const hasTokenBalance = chainBalance.tokens.some(token => parseFloat(token.balance) > 0);
                        return nativeBalance > 0 || hasTokenBalance;
                      })
                      .map((chainBalance) => {
                        const chainName = CHAIN_NAMES[chainBalance.chain] || chainBalance.chain;
                        const formattedNative = chainBalance.nativeBalanceHuman || 
                          formatBalance(chainBalance.nativeBalance, chainBalance.nativeDecimals);
                        
                        const formattedTokens = chainBalance.tokens
                          .filter(token => parseFloat(token.balance) > 0)
                          .map(token => {
                            const formatted = token.balanceHuman || 
                              formatBalance(token.balance, token.decimals);
                            return { ...token, formatted };
                          });
                        
                        const hasBalance = parseFloat(chainBalance.nativeBalance) > 0 || formattedTokens.length > 0;
                        
                        return (
                          <div
                            key={chainBalance.chain}
                            className="group relative rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 via-white/0 to-white/5 p-5 transition-all hover:border-white/20 hover:bg-white/5"
                          >
                            <div className="mb-4 flex items-start justify-between">
                              <div className="flex-1">
                                <p className="text-xs font-medium uppercase tracking-wider text-white/50">
                                  {chainName}
                                </p>
                                {hasBalance ? (
                                  <div className="mt-2 space-y-1">
                                    {parseFloat(chainBalance.nativeBalance) > 0 && (
                                      <p className="text-lg font-semibold text-white">
                                        {formattedNative} <span className="text-sm text-white/60">{getNativeTokenSymbol(chainBalance.chain)}</span>
                                      </p>
                                    )}
                                    {formattedTokens.map((token) => (
                                      <p key={token.address} className="text-sm text-white/80">
                                        {token.formatted} <span className="text-white/50">{token.symbol}</span>
                                      </p>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="mt-2 text-sm text-white/40">No balance</p>
                                )}
                              </div>
                            </div>
                            <Button
                              onClick={() => handleSendClick(chainBalance.chain)}
                              size="sm"
                              className="w-full gap-2 rounded-full bg-white/10 text-xs text-white hover:bg-white/20"
                            >
                              <Send className="h-3 w-3" />
                              Send
                            </Button>
                          </div>
                        );
                      })}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Send Modal */}
        {selectedChain && fingerprint && (
          <SendCryptoModal
            open={sendModalOpen}
            onOpenChange={setSendModalOpen}
            chain={selectedChain}
            userId={fingerprint}
            onSuccess={handleSendSuccess}
          />
        )}

        {/* Transaction List */}
        <div className="mt-8">
          <RecentTransactions showAll={true} />
        </div>
      </div>
    </div>
  );
}