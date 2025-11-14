/**
 * Supported blockchain networks
 */
export type ChainType =
  | 'ethereum'
  | 'base'
  | 'arbitrum'
  | 'polygon'
  | 'avalanche'
  | 'tron'
  | 'bitcoin'
  | 'solana';

/**
 * EVM-compatible chains that support ERC-4337
 */
export type Erc4337Chain =
  | 'ethereum'
  | 'base'
  | 'arbitrum'
  | 'polygon'
  | 'avalanche';

/**
 * All chain types including ERC-4337 variants
 */
export type AllChainTypes = ChainType | `${Erc4337Chain}Erc4337`;

/**
 * Chain configuration for EVM chains
 */
export interface EvmChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  blockExplorer?: string;
}

/**
 * ERC-4337 specific configuration
 */
export interface Erc4337Config {
  chainId: number;
  rpcUrl: string;
  bundlerUrl: string;
  paymasterUrl?: string;
  entryPointAddress: string;
  factoryAddress: string;
  paymasterAddress?: string;
}

/**
 * Native token information for each chain
 */
export const NATIVE_TOKENS: Record<
  ChainType,
  { symbol: string; decimals: number }
> = {
  ethereum: { symbol: 'ETH', decimals: 18 },
  base: { symbol: 'ETH', decimals: 18 },
  arbitrum: { symbol: 'ETH', decimals: 18 },
  polygon: { symbol: 'MATIC', decimals: 18 },
  avalanche: { symbol: 'AVAX', decimals: 18 },
  tron: { symbol: 'TRX', decimals: 6 },
  bitcoin: { symbol: 'BTC', decimals: 8 },
  solana: { symbol: 'SOL', decimals: 9 },
};
