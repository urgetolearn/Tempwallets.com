import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EvmChainConfig, Erc4337Config } from '../types/chain.types.js';

/**
 * Chain configuration service
 * Provides chain-specific configuration for all supported EVM chains
 */
@Injectable()
export class ChainConfigService {
  constructor(private configService: ConfigService) {}

  /**
   * Get EVM chain configuration
   */
  getEvmChainConfig(
    chain: 'ethereum' | 'base' | 'arbitrum' | 'polygon' | 'avalanche',
  ): EvmChainConfig {
    const configs: Record<string, EvmChainConfig> = {
      ethereum: {
        chainId: 1,
        name: 'Ethereum Mainnet',
        rpcUrl:
          this.configService.get<string>('ETH_RPC_URL') ||
          'https://eth.llamarpc.com',
        nativeCurrency: {
          name: 'Ether',
          symbol: 'ETH',
          decimals: 18,
        },
        blockExplorer: 'https://etherscan.io',
      },
      base: {
        chainId: 8453,
        name: 'Base',
        rpcUrl:
          this.configService.get<string>('BASE_RPC_URL') ||
          'https://mainnet.base.org',
        nativeCurrency: {
          name: 'Ether',
          symbol: 'ETH',
          decimals: 18,
        },
        blockExplorer: 'https://basescan.org',
      },
      arbitrum: {
        chainId: 42161,
        name: 'Arbitrum One',
        rpcUrl:
          this.configService.get<string>('ARB_RPC_URL') ||
          'https://arb1.arbitrum.io/rpc',
        nativeCurrency: {
          name: 'Ether',
          symbol: 'ETH',
          decimals: 18,
        },
        blockExplorer: 'https://arbiscan.io',
      },
      polygon: {
        chainId: 137,
        name: 'Polygon',
        rpcUrl:
          this.configService.get<string>('POLYGON_RPC_URL') ||
          'https://polygon-rpc.com',
        nativeCurrency: {
          name: 'MATIC',
          symbol: 'MATIC',
          decimals: 18,
        },
        blockExplorer: 'https://polygonscan.com',
      },
      avalanche: {
        chainId: 43114,
        name: 'Avalanche C-Chain',
        rpcUrl:
          this.configService.get<string>('AVAX_RPC_URL') ||
          'https://api.avax.network/ext/bc/C/rpc',
        nativeCurrency: {
          name: 'Avalanche',
          symbol: 'AVAX',
          decimals: 18,
        },
        blockExplorer: 'https://snowtrace.io',
      },
    };

    const config = configs[chain];
    if (!config) {
      throw new Error(`Unsupported EVM chain: ${chain}`);
    }
    return config;
  }

  /**
   * Get Tron configuration
   */
  getTronConfig() {
    return {
      provider:
        this.configService.get<string>('TRON_RPC_URL') ||
        'https://api.trongrid.io',
    };
  }

  /**
   * Get Bitcoin configuration
   */
  getBitcoinConfig() {
    return {
      provider:
        this.configService.get<string>('BTC_RPC_URL') ||
        'https://blockstream.info/api',
    };
  }

  /**
   * Get Solana configuration
   */
  getSolanaConfig() {
    return {
      rpcUrl:
        this.configService.get<string>('SOL_RPC_URL') ||
        'https://api.mainnet-beta.solana.com',
    };
  }

  /**
   * Get all EVM chain configs
   */
  getAllEvmChainConfigs(): Record<string, EvmChainConfig> {
    return {
      ethereum: this.getEvmChainConfig('ethereum'),
      base: this.getEvmChainConfig('base'),
      arbitrum: this.getEvmChainConfig('arbitrum'),
      polygon: this.getEvmChainConfig('polygon'),
      avalanche: this.getEvmChainConfig('avalanche'),
    };
  }

  /**
   * Check if a chain is EVM-compatible
   */
  isEvmChain(chain: string): boolean {
    return ['ethereum', 'base', 'arbitrum', 'polygon', 'avalanche'].includes(
      chain,
    );
  }
}
