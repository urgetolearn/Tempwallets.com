import { useMemo } from 'react';
import {
  WALLET_CONFIGS,
  getWalletConfig,
  getWalletConfigs,
  getVisibleWalletConfigs,
  getMainnetWalletConfigs,
  getWalletConfigsByType,
  getWalletConfigsByGroup,
  getSmartAccountConfigs,
  isDevelopmentEnvironment,
} from '@/lib/wallet-config';
import { WalletConfig, WalletConfigFilter, ChainType, ChainGroup } from '@/types/wallet.types';

export interface UseWalletConfigReturn {
  /** All wallet configurations */
  all: WalletConfig[];
  
  /** Get configuration by ID */
  getById: (id: string) => WalletConfig | undefined;
  
  /** Get configurations by filter */
  getByFilter: (filter: WalletConfigFilter) => WalletConfig[];
  
  /** Get visible configurations for selector */
  getVisible: () => WalletConfig[];
  
  /** Get mainnet configurations only */
  getMainnet: () => WalletConfig[];
  
  /** Get configurations by type */
  getByType: (type: ChainType) => WalletConfig[];
  
  /** Get configurations by group */
  getByGroup: (group: ChainGroup) => WalletConfig[];
  
  /** Get smart account configurations */
  getSmartAccounts: () => WalletConfig[];
  
  /** Check if development environment */
  isDev: boolean;
  
  /** Current environment */
  environment: 'development' | 'production';
}

/**
 * Hook to access wallet configurations
 * Provides easy access to all wallet config helper functions
 * 
 * @example
 * ```tsx
 * const walletConfig = useWalletConfig();
 * 
 * // Get all visible wallets for selector
 * const visibleWallets = walletConfig.getVisible();
 * 
 * // Get specific wallet
 * const ethereum = walletConfig.getById('ethereumErc4337');
 * 
 * // Get EVM wallets only
 * const evmWallets = walletConfig.getByType('evm');
 * ```
 */
export function useWalletConfig(): UseWalletConfigReturn {
  const isDev = useMemo(() => isDevelopmentEnvironment(), []);
  const environment: 'development' | 'production' = isDev ? 'development' : 'production';

  return useMemo(
    () => ({
      all: WALLET_CONFIGS,
      getById: getWalletConfig,
      getByFilter: getWalletConfigs,
      getVisible: () => getVisibleWalletConfigs(environment),
      getMainnet: getMainnetWalletConfigs,
      getByType: getWalletConfigsByType,
      getByGroup: getWalletConfigsByGroup,
      getSmartAccounts: getSmartAccountConfigs,
      isDev,
      environment,
    }),
    [isDev, environment]
  );
}
