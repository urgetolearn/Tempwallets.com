import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { entryPoint07Address, entryPoint08Address } from 'viem/account-abstraction';
import { Erc4337Config } from '../types/chain.types.js';
import { ChainConfigService } from './chain.config.js';

/**
 * Pimlico configuration service
 * Provides Pimlico-specific configuration for ERC-4337 smart accounts
 * Removes dependency on Tether WDK ERC-4337 configuration
 */
@Injectable()
export class PimlicoConfigService {
  private readonly logger = new Logger(PimlicoConfigService.name);

  constructor(
    private configService: ConfigService,
    private chainConfig: ChainConfigService,
  ) {}

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
    chain: string,
  ): Erc4337Config {
    const apiKey = this.getPimlicoApiKey();
    const normalizedChain = chain.replace(/Erc4337$/i, '').toLowerCase();
    const evmConfig = this.chainConfig.getEvmChainConfig(
      normalizedChain as
        | 'ethereum'
        | 'base'
        | 'arbitrum'
        | 'polygon'
        | 'avalanche'
        | 'optimism'
        | 'bnb',
    );

    const chainId = evmConfig.chainId;
    const bundlerBase = `https://api.pimlico.io/v2/${chainId}/rpc`;

    const bundlerUrl = apiKey ? `${bundlerBase}?apikey=${apiKey}` : bundlerBase;
    const paymasterUrl = apiKey ? `${bundlerBase}?apikey=${apiKey}` : undefined;

    const entryPointAddress =
      this.configService.get<string>('ERC4337_ENTRYPOINT_ADDRESS') ||
      entryPoint07Address;

    const factoryAddress =
      this.configService.get<string>('ERC4337_FACTORY_ADDRESS') ||
      '0x9406Cc6185a346906296840746125a0E44976454';

    return {
      chainId,
      rpcUrl: evmConfig.rpcUrl,
      bundlerUrl,
      paymasterUrl,
      entryPointAddress,
      entryPointVersion: '0.7',
      factoryAddress,
    };
  }

  /**
   * Get all ERC-4337 configurations
   */
  getAllErc4337Configs(): Record<string, Erc4337Config> {
    const configured =
      this.configService
        .get<string>('ERC4337_CHAINS')
        ?.split(',')
        .map((chain) => chain.trim())
        .filter(Boolean) || [];
    const chains =
      configured.length > 0
        ? configured
        : ['ethereum', 'base', 'arbitrum', 'polygon', 'avalanche'];

    return Object.fromEntries(
      chains.map((chain) => [chain, this.getErc4337Config(chain)]),
    );
  }

  /**
   * Check if Pimlico API key is configured
   */
  hasPimlicoApiKey(): boolean {
    const apiKey = this.getPimlicoApiKey();
    return apiKey.length > 0;
  }

  /**
   * EIP-7702 enablement guard per chain name (AllChainTypes string)
   */
  isEip7702Enabled(chain: string): boolean {
    const enabled = this.configService.get<string>('ENABLE_EIP7702') === 'true';
    if (!enabled) return false;
    const supportedChains =
      this.configService
        .get<string>('EIP7702_CHAINS')
        ?.split(',')
        .map((chain) => chain.trim())
        .filter(Boolean) || [];
    return supportedChains.includes(chain.toLowerCase());
  }

  /**
   * ERC-4337 enablement guard per chain name
   */
  isErc4337Enabled(chain: string): boolean {
    const enabled = this.configService.get<string>('ENABLE_ERC4337') === 'true';
    if (!enabled) return false;
    const supportedChains =
      this.configService
        .get<string>('ERC4337_CHAINS')
        ?.split(',')
        .map((chain) => chain.trim())
        .filter(Boolean) || [];
    const normalizedChain = chain.replace(/Erc4337$/i, '').toLowerCase();
    return supportedChains.includes(normalizedChain);
  }

  getGaslessRateLimit(): { windowMs: number; maxRequests: number } {
    const windowMs = Number(
      this.configService.get<string>('GASLESS_RATE_LIMIT_WINDOW_MS') || 60000,
    );
    const maxRequests = Number(
      this.configService.get<string>('GASLESS_RATE_LIMIT_MAX') || 10,
    );

    return {
      windowMs: Number.isFinite(windowMs) ? windowMs : 60000,
      maxRequests: Number.isFinite(maxRequests) ? maxRequests : 10,
    };
  }

  getGaslessMaxGasLimit(): bigint | null {
    const raw = this.configService.get<string>('GASLESS_MAX_GAS_LIMIT');
    if (!raw) return null;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return BigInt(Math.floor(parsed));
  }

  getGaslessMaxCallDataBytes(): number | null {
    const raw = this.configService.get<string>('GASLESS_MAX_CALLDATA_BYTES');
    if (!raw) return null;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.floor(parsed);
  }

  getEip7702DelegationAddress(): string {
    return (
      this.configService.get<string>('EIP7702_DELEGATION_ADDRESS') ||
      '0xe6Cae83BdE06E4c305530e199D7217f42808555B'
    );
  }

  getEip7702Config(
    chain:
      | 'ethereum'
      | 'base'
      | 'arbitrum'
      | 'optimism'
      | 'polygon'
      | 'bnb'
      | 'avalanche',
  ) {
    const chainIds: Record<string, number> = {
      ethereum: 1,
      base: 8453,
      arbitrum: 42161,
      optimism: 10,
      polygon: 137,
      bnb: 56,
      avalanche: 43114,
    };

    const chainId = chainIds[chain];
    if (!chainId) {
      throw new Error(`Unsupported EIP-7702 chain: ${chain}`);
    }

    const apiKey = this.getPimlicoApiKey();
    const bundlerBase = `https://api.pimlico.io/v2/${chainId}/rpc`;

    // ✅ FIX: Always provide paymaster URL for sponsored transactions
    // If no API key, still provide URL (may work for some networks)
    const paymasterUrl = apiKey
      ? `${bundlerBase}?apikey=${apiKey}`
      : bundlerBase;

    this.logger.log(`[Pimlico Config] EIP-7702 config for ${chain}:`, {
      chainId,
      bundlerUrl: apiKey ? `${bundlerBase}?apikey=${apiKey}` : bundlerBase,
      paymasterUrl,
      delegationAddress: this.getEip7702DelegationAddress(),
      hasApiKey: !!apiKey,
    });

    return {
      chainId,
      bundlerUrl: apiKey ? `${bundlerBase}?apikey=${apiKey}` : bundlerBase,
      paymasterUrl, // ✅ Always provide paymaster URL for sponsorship
      delegationAddress: this.getEip7702DelegationAddress(),
      // Use entry point 0.8 for EIP-7702 (required by to7702SimpleSmartAccount)
      // Paymaster works via direct pimlico client integration
      entryPointAddress: entryPoint08Address, // Entry Point v0.8
    };
  }

  /**
   * Validate EIP-7702 support for a specific chain
   * Checks if delegation contract exists and bundler is accessible
   */
  async validateEip7702Support(
    chain:
      | 'ethereum'
      | 'base'
      | 'arbitrum'
      | 'optimism'
      | 'polygon'
      | 'bnb'
      | 'avalanche',
  ): Promise<{
    supported: boolean;
    errors: string[];
    config?: ReturnType<PimlicoConfigService['getEip7702Config']>;
  }> {
    const errors: string[] = [];

    try {
      const config = this.getEip7702Config(chain);

      // Check if API key is configured (recommended but not always required)
      if (!this.hasPimlicoApiKey()) {
        errors.push(
          'PIMLICO_API_KEY not configured. Sponsored transactions may not work.',
        );
      }

      // Note: We can't check delegation contract or bundler here without
      // creating clients, which would require chain config. This validation
      // is done in the factory's createAccount method instead.

      return {
        supported: errors.length === 0,
        errors,
        config,
      };
    } catch (error) {
      errors.push(
        error instanceof Error ? error.message : 'Unknown validation error',
      );
      return {
        supported: false,
        errors,
      };
    }
  }

}
