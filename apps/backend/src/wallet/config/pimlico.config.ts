import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Erc4337Config } from '../types/chain.types.js';

/**
 * Pimlico configuration service
 * Provides Pimlico-specific configuration for ERC-4337 smart accounts
 * Removes dependency on Tether WDK ERC-4337 configuration
 */
@Injectable()
export class PimlicoConfigService {
  private readonly logger = new Logger(PimlicoConfigService.name);

  constructor(private configService: ConfigService) {}

  /**
   * Get Pimlico API key from environment
   */
  getPimlicoApiKey(): string {
    return this.configService.get<string>('PIMLICO_API_KEY') || '';
  }

  /**
   * Get ERC-4337 configuration for a specific chain
   */
  getErc4337Config(
    chain: 'ethereum' | 'base' | 'arbitrum' | 'polygon' | 'avalanche',
  ): Erc4337Config {
    const apiKey = this.getPimlicoApiKey();

    const configs: Record<string, Erc4337Config> = {
      ethereum: {
        chainId: 1,
        rpcUrl: this.resolveRpcUrl(
          'ETH_RPC_URL',
          'https://eth.llamarpc.com',
          'ethereum',
        ),
        bundlerUrl: apiKey
          ? `https://api.pimlico.io/v2/ethereum/rpc?apikey=${apiKey}`
          : 'https://api.pimlico.io/v2/ethereum/rpc',
        paymasterUrl: apiKey
          ? `https://api.pimlico.io/v2/ethereum/rpc?apikey=${apiKey}`
          : undefined,
        entryPointAddress: '0x0000000071727De22E5E9d8BAf0edAc6f37da032', // v0.7
        factoryAddress: '0x0000000000FFe8B47B3e2130213B802212439497', // Pimlico Safe factory
      },
      base: {
        chainId: 8453,
        rpcUrl: this.resolveRpcUrl(
          'BASE_RPC_URL',
          'https://mainnet.base.org',
          'base',
        ),
        bundlerUrl: apiKey
          ? `https://api.pimlico.io/v2/base/rpc?apikey=${apiKey}`
          : 'https://api.pimlico.io/v2/base/rpc',
        paymasterUrl: apiKey
          ? `https://api.pimlico.io/v2/base/rpc?apikey=${apiKey}`
          : undefined,
        entryPointAddress: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
        factoryAddress: '0x0000000000FFe8B47B3e2130213B802212439497',
      },
      arbitrum: {
        chainId: 42161,
        rpcUrl: this.resolveRpcUrl(
          'ARB_RPC_URL',
          'https://arb1.arbitrum.io/rpc',
          'arbitrum',
        ),
        bundlerUrl: apiKey
          ? `https://api.pimlico.io/v2/arbitrum/rpc?apikey=${apiKey}`
          : 'https://api.pimlico.io/v2/arbitrum/rpc',
        paymasterUrl: apiKey
          ? `https://api.pimlico.io/v2/arbitrum/rpc?apikey=${apiKey}`
          : undefined,
        entryPointAddress: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
        factoryAddress: '0x0000000000FFe8B47B3e2130213B802212439497',
      },
      polygon: {
        chainId: 137,
        rpcUrl: this.resolveRpcUrl(
          'POLYGON_RPC_URL',
          'https://polygon-rpc.com',
          'polygon',
        ),
        bundlerUrl: apiKey
          ? `https://api.pimlico.io/v2/polygon/rpc?apikey=${apiKey}`
          : 'https://api.pimlico.io/v2/polygon/rpc',
        paymasterUrl: apiKey
          ? `https://api.pimlico.io/v2/polygon/rpc?apikey=${apiKey}`
          : undefined,
        entryPointAddress: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
        factoryAddress: '0x0000000000FFe8B47B3e2130213B802212439497',
      },
      avalanche: {
        chainId: 43114,
        rpcUrl: this.resolveRpcUrl(
          'AVAX_RPC_URL',
          'https://api.avax.network/ext/bc/C/rpc',
          'avalanche',
        ),
        bundlerUrl: apiKey
          ? `https://api.pimlico.io/v2/avalanche/rpc?apikey=${apiKey}`
          : 'https://api.pimlico.io/v2/avalanche/rpc',
        paymasterUrl: apiKey
          ? `https://api.pimlico.io/v2/avalanche/rpc?apikey=${apiKey}`
          : undefined,
        entryPointAddress: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
        factoryAddress: '0x0000000000FFe8B47B3e2130213B802212439497',
      },
    };

    const config = configs[chain];
    if (!config) {
      throw new Error(`Unsupported ERC-4337 chain: ${chain}`);
    }
    return config;
  }

  /**
   * Get all ERC-4337 configurations
   */
  getAllErc4337Configs(): Record<string, Erc4337Config> {
    return {
      ethereum: this.getErc4337Config('ethereum'),
      base: this.getErc4337Config('base'),
      arbitrum: this.getErc4337Config('arbitrum'),
      polygon: this.getErc4337Config('polygon'),
      avalanche: this.getErc4337Config('avalanche'),
    };
  }

  /**
   * Check if Pimlico API key is configured
   */
  hasPimlicoApiKey(): boolean {
    const apiKey = this.getPimlicoApiKey();
    return apiKey.length > 0;
  }

  /**
   * Check if EIP-7702 is enabled for a chain
   * NOTE: EIP-7702 is not yet deployed on any mainnet chains
   * This method returns false for all chains for now
   */
  isEip7702Enabled(chain: string): boolean {
    // EIP-7702 is not yet deployed on any production chains
    // When it becomes available, update this method to return true for supported chains
    return false;
  }

  /**
   * Get EIP-7702 configuration for a specific chain
   * NOTE: EIP-7702 is not yet deployed, this returns the standard ERC-4337 config
   */
  getEip7702Config(
    chain: 'ethereum' | 'base' | 'arbitrum' | 'polygon' | 'avalanche' | 'sepolia' | 'optimism' | 'bnb',
  ): Erc4337Config {
    // Map non-standard chains to supported ones
    const chainMap: Record<string, 'ethereum' | 'base' | 'arbitrum' | 'polygon' | 'avalanche'> = {
      sepolia: 'ethereum',
      optimism: 'ethereum',
      bnb: 'ethereum',
    };

    const mappedChain = chainMap[chain] || chain;

    // For now, return standard ERC-4337 config since EIP-7702 is not deployed
    if (mappedChain === 'ethereum' || mappedChain === 'base' || mappedChain === 'arbitrum' || mappedChain === 'polygon' || mappedChain === 'avalanche') {
      return this.getErc4337Config(mappedChain);
    }

    // Fallback to ethereum config
    return this.getErc4337Config('ethereum');
  }

  /**
   * Ensure RPC URL points to a standard node (not Pimlico bundler)
   */
  private resolveRpcUrl(
    envKey: string,
    fallback: string,
    chainLabel: string,
  ): string {
    const raw = (this.configService.get<string>(envKey) || '').trim();
    if (!raw) {
      return fallback;
    }

    if (raw.toLowerCase().includes('api.pimlico.io')) {
      this.logger.warn(
        `Detected ${envKey} pointing to Pimlico bundler for ${chainLabel}. Falling back to ${fallback}. ` +
          `Please set ${envKey} to a standard RPC (Infura, Alchemy, Ankr, etc.).`,
      );
      return fallback;
    }

    return raw;
  }
}
