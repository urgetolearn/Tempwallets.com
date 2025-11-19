import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import {
  IAddressManager,
  WalletAddresses,
  WalletAddressMetadataMap,
  WalletAddressKind,
  WalletAddressKey,
} from '../interfaces/wallet.interfaces.js';
import { AllChainTypes } from '../types/chain.types.js';
import { SeedManager } from './seed.manager.js';
import { AccountFactory } from '../factories/account.factory.js';
import { PimlicoAccountFactory } from '../factories/pimlico-account.factory.js';
import { SubstrateManager } from '../substrate/managers/substrate.manager.js';

/**
 * Address Manager
 * Handles address generation and retrieval for all supported chains
 */
@Injectable()
export class AddressManager implements IAddressManager {
  private readonly logger = new Logger(AddressManager.name);

  // Cache for addresses per user to avoid repeated fetching
  private addressCache: Map<
    string,
    {
      addresses: WalletAddresses;
      metadata: WalletAddressMetadataMap;
      timestamp: number;
    }
  > = new Map();
  private readonly ADDRESS_CACHE_TTL = 60 * 1000; // 1 minute cache

  private readonly eoaChains: WalletAddressKey[] = [
    'ethereum',
    'base',
    'arbitrum',
    'polygon',
    'avalanche',
    'moonbeamTestnet',
    'astarShibuya',
    'paseoPassetHub',
    'hydration',
    'unique',
    'bifrost',
    'bifrostTestnet',
  ];

  private readonly erc4337Chains: WalletAddressKey[] = [
    'ethereumErc4337',
    'baseErc4337',
    'arbitrumErc4337',
    'polygonErc4337',
    'avalancheErc4337',
  ];

  private readonly nonEvmChains: WalletAddressKey[] = [
    'tron',
    'bitcoin',
    'solana',
  ];

  constructor(
    private seedManager: SeedManager,
    private accountFactory: AccountFactory,
    private pimlicoAccountFactory: PimlicoAccountFactory,
    @Inject(forwardRef(() => SubstrateManager))
    private substrateManager: SubstrateManager,
  ) {}

  /**
   * Get all wallet addresses for all chains
   * Auto-creates wallet if it doesn't exist
   */
  async getAddresses(userId: string): Promise<WalletAddresses> {
    // Check cache first
    const cached = this.addressCache.get(userId);
    if (cached && Date.now() - cached.timestamp < this.ADDRESS_CACHE_TTL) {
      return cached.addresses;
    }

    // Ensure wallet exists
    const hasSeed = await this.seedManager.hasSeed(userId);
    if (!hasSeed) {
      this.logger.log(`No wallet found for user ${userId}. Auto-creating...`);
      await this.seedManager.createOrImportSeed(userId, 'random');
      this.logger.log(`Successfully auto-created wallet for user ${userId}`);
    }

    const seedPhrase = await this.seedManager.getSeed(userId);

    // Get addresses for all chains
    const addresses: Partial<WalletAddresses> = {};

    // EOA chains
    const eoaChains: AllChainTypes[] = [
      'ethereum',
      'base',
      'arbitrum',
      'polygon',
      'avalanche',
      'moonbeamTestnet',
      'astarShibuya',
      'paseoPassetHub',
      'tron',
      'bitcoin',
      'solana',
    ];

    for (const chain of eoaChains) {
      try {
        const account = await this.accountFactory.createAccount(
          seedPhrase,
          chain,
          0,
        );
        const address = await account.getAddress();
        addresses[chain as keyof WalletAddresses] = address;
      } catch (error) {
        this.logger.error(
          `Error getting EOA address for ${chain}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        addresses[chain as keyof WalletAddresses] = null as any;
      }
    }

    // ERC-4337 smart accounts
    const erc4337Chains: (
      | 'ethereum'
      | 'base'
      | 'arbitrum'
      | 'polygon'
      | 'avalanche'
    )[] = ['ethereum', 'base', 'arbitrum', 'polygon', 'avalanche'];

    for (const chain of erc4337Chains) {
      try {
        const account = await this.pimlicoAccountFactory.createAccount(
          seedPhrase,
          chain,
          0,
        );
        const address = await account.getAddress();
        const chainKey = `${chain}Erc4337` as keyof WalletAddresses;
        addresses[chainKey] = address;
      } catch (error) {
        this.logger.error(
          `Error getting ERC-4337 address for ${chain}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        const chainKey = `${chain}Erc4337` as keyof WalletAddresses;
        addresses[chainKey] = null as any;
      }
    }

    // Get Substrate addresses (parallel with EVM addresses)
    try {
      const substrateAddresses = await this.substrateManager.getAddresses(userId, false);
      
      // Map Substrate addresses to WalletAddresses format
      // Note: hydration, unique, bifrost exist in both EVM and Substrate - use Substrate suffix for Substrate versions
      addresses.polkadot = substrateAddresses.polkadot ?? null;
      addresses.hydrationSubstrate = substrateAddresses.hydration ?? null;
      addresses.bifrostSubstrate = substrateAddresses.bifrost ?? null;
      addresses.uniqueSubstrate = substrateAddresses.unique ?? null;
      addresses.paseo = substrateAddresses.paseo ?? null;
      addresses.paseoAssethub = substrateAddresses.paseoAssethub ?? null;
    } catch (error) {
      this.logger.error(
        `Error getting Substrate addresses: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      // Set defaults
      addresses.polkadot = null;
      addresses.hydrationSubstrate = null;
      addresses.bifrostSubstrate = null;
      addresses.uniqueSubstrate = null;
      addresses.paseo = null;
      addresses.paseoAssethub = null;
    }

    const result = addresses as WalletAddresses;
    const metadata = this.buildMetadata(result);

    // Cache the addresses
    this.addressCache.set(userId, {
      addresses: result,
      metadata,
      timestamp: Date.now(),
    });
    this.logFinalAddresses(userId, metadata);

    return result;
  }

  async getManagedAddresses(userId: string): Promise<{
    addresses: WalletAddresses;
    metadata: WalletAddressMetadataMap;
  }> {
    await this.getAddresses(userId);
    const cached = this.addressCache.get(userId);
    if (!cached) {
      throw new Error('Address cache missing after retrieval');
    }
    return { addresses: cached.addresses, metadata: cached.metadata };
  }

  /**
   * Get address for a specific chain
   */
  async getAddressForChain(
    userId: string,
    chain: AllChainTypes,
  ): Promise<string> {
    const addresses = await this.getAddresses(userId);
    const address = addresses[chain as keyof WalletAddresses];

    if (!address) {
      throw new Error(`No address found for chain: ${chain}`);
    }

    return address;
  }

  /**
   * Stream addresses progressively (for SSE)
   * Yields addresses as they become available
   */
  async *streamAddresses(
    userId: string,
  ): AsyncGenerator<{ chain: string; address: string | null }, void, unknown> {
    // Ensure wallet exists
    const hasSeed = await this.seedManager.hasSeed(userId);
    if (!hasSeed) {
      this.logger.log(`No wallet found for user ${userId}. Auto-creating...`);
      await this.seedManager.createOrImportSeed(userId, 'random');
      this.logger.log(`Successfully auto-created wallet for user ${userId}`);
    }

    const seedPhrase = await this.seedManager.getSeed(userId);

    // Process EOA chains
    const eoaChains: { name: string; chain: AllChainTypes }[] = [
      { name: 'ethereum', chain: 'ethereum' },
      { name: 'base', chain: 'base' },
      { name: 'arbitrum', chain: 'arbitrum' },
      { name: 'polygon', chain: 'polygon' },
      { name: 'avalanche', chain: 'avalanche' },
      { name: 'moonbeamTestnet', chain: 'moonbeamTestnet' },
      { name: 'astarShibuya', chain: 'astarShibuya' },
      { name: 'paseoPassetHub', chain: 'paseoPassetHub' },
      { name: 'tron', chain: 'tron' },
      { name: 'bitcoin', chain: 'bitcoin' },
      { name: 'solana', chain: 'solana' },
    ];

    for (const { name, chain } of eoaChains) {
      try {
        const account = await this.accountFactory.createAccount(
          seedPhrase,
          chain,
          0,
        );
        const address = await account.getAddress();
        yield { chain: name, address };
      } catch (error) {
        this.logger.error(
          `Error streaming address for ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        yield { chain: name, address: null };
      }
    }

    // Process ERC-4337 chains
    const erc4337Chains: {
      name: string;
      chain: 'ethereum' | 'base' | 'arbitrum' | 'polygon' | 'avalanche';
    }[] = [
      { name: 'ethereumErc4337', chain: 'ethereum' },
      { name: 'baseErc4337', chain: 'base' },
      { name: 'arbitrumErc4337', chain: 'arbitrum' },
      { name: 'polygonErc4337', chain: 'polygon' },
      { name: 'avalancheErc4337', chain: 'avalanche' },
    ];

    for (const { name, chain } of erc4337Chains) {
      try {
        const account = await this.pimlicoAccountFactory.createAccount(
          seedPhrase,
          chain,
          0,
        );
        const address = await account.getAddress();
        yield { chain: name, address };
      } catch (error) {
        this.logger.error(
          `Error streaming address for ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        yield { chain: name, address: null };
      }
    }

    // Process Substrate chains
    try {
      const substrateAddresses = await this.substrateManager.getAddresses(userId, false);
      
      // Map Substrate addresses to WalletAddresses format
      const substrateChains: { name: string; address: string | null }[] = [
        { name: 'polkadot', address: substrateAddresses.polkadot ?? null },
        { name: 'hydrationSubstrate', address: substrateAddresses.hydration ?? null },
        { name: 'bifrostSubstrate', address: substrateAddresses.bifrost ?? null },
        { name: 'uniqueSubstrate', address: substrateAddresses.unique ?? null },
        { name: 'paseo', address: substrateAddresses.paseo ?? null },
        { name: 'paseoAssethub', address: substrateAddresses.paseoAssethub ?? null },
      ];

      for (const { name, address } of substrateChains) {
        yield { chain: name, address };
      }
    } catch (error) {
      this.logger.error(
        `Error streaming Substrate addresses: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      // Yield null addresses for all Substrate chains on error
      const substrateChainNames = ['polkadot', 'hydrationSubstrate', 'bifrostSubstrate', 'uniqueSubstrate', 'paseo', 'paseoAssethub'];
      for (const name of substrateChainNames) {
        yield { chain: name, address: null };
      }
    }
  }

  /**
   * Invalidate address cache for a user
   */
  invalidateCache(userId: string): void {
    this.addressCache.delete(userId);
  }

  private logFinalAddresses(
    userId: string,
    metadata: WalletAddressMetadataMap,
  ): void {
    const summary = Object.fromEntries(
      Object.entries(metadata).map(([chain, entry]) => [
        chain,
        this.maskAddress(entry.address),
      ]),
    );
    this.logger.log(
      `Wallet addresses ready for user ${userId}: ${JSON.stringify(summary)}`,
    );
  }

  private maskAddress(address: string | null): string | null {
    if (!address) {
      return null;
    }
    if (address.length <= 10) {
      return address;
    }
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  private buildMetadata(addresses: WalletAddresses): WalletAddressMetadataMap {
    const metadata = {} as WalletAddressMetadataMap;

    const assign = (
      chain: WalletAddressKey,
      kind: WalletAddressKind,
      visible: boolean,
    ) => {
      metadata[chain] = {
        chain,
        address: addresses[chain],
        kind,
        visible,
        label: this.getLabelForChain(chain, kind),
      };
    };

    // Standard EOA chains (not visible by default)
    const standardEoaChains = this.eoaChains.filter(
      (chain) =>
        ![
          'moonbeamTestnet',
          'astarShibuya',
          'paseoPassetHub',
          'hydration',
          'unique',
          'bifrost',
          'bifrostTestnet',
        ].includes(chain),
    );
    standardEoaChains.forEach((chain) => assign(chain, 'eoa', false));
    
    // Polkadot EVM chains (visible)
    const polkadotEvmChains: WalletAddressKey[] = [
      'moonbeamTestnet',
      'astarShibuya',
      'paseoPassetHub',
      'hydration',
      'unique',
      'bifrost',
      'bifrostTestnet',
    ];
    polkadotEvmChains.forEach((chain) => assign(chain, 'eoa', true));
    
    // Substrate chains (visible)
    const substrateChains: WalletAddressKey[] = [
      'polkadot',
      'hydrationSubstrate',
      'bifrostSubstrate',
      'uniqueSubstrate',
      'paseo',
      'paseoAssethub',
    ];
    substrateChains.forEach((chain) => assign(chain, 'substrate', true));
    
    this.erc4337Chains.forEach((chain) => assign(chain, 'erc4337', true));
    this.nonEvmChains.forEach((chain) => assign(chain, 'nonEvm', true));

    return metadata;
  }

  private getLabelForChain(
    chain: WalletAddressKey,
    kind: WalletAddressKind,
  ): string {
    const baseLabels: Partial<Record<WalletAddressKey, string>> = {
      ethereum: 'Ethereum',
      base: 'Base',
      arbitrum: 'Arbitrum',
      polygon: 'Polygon',
      avalanche: 'Avalanche',
      tron: 'Tron',
      bitcoin: 'Bitcoin',
      solana: 'Solana',
      moonbeamTestnet: 'Moonbeam Testnet',
      astarShibuya: 'Astar Shibuya',
      paseoPassetHub: 'Paseo PassetHub',
      hydration: 'Hydration',
      unique: 'Unique',
      bifrost: 'Bifrost Mainnet',
      bifrostTestnet: 'Bifrost Testnet',
      ethereumErc4337: 'Ethereum Smart Account',
      baseErc4337: 'Base Smart Account',
      arbitrumErc4337: 'Arbitrum Smart Account',
      polygonErc4337: 'Polygon Smart Account',
      avalancheErc4337: 'Avalanche Smart Account',
      // Substrate chains
      polkadot: 'Polkadot',
      hydrationSubstrate: 'Hydration (Substrate)',
      bifrostSubstrate: 'Bifrost (Substrate)',
      uniqueSubstrate: 'Unique (Substrate)',
      paseo: 'Paseo',
      paseoAssethub: 'Paseo AssetHub',
    };

    const label = baseLabels[chain];
    if (label) {
      if (kind === 'eoa') {
        return `${label} (EOA)`;
      }
      return label;
    }
    return chain;
  }
}
