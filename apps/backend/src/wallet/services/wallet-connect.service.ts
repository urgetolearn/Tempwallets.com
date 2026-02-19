import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { AddressManager } from '../managers/address.manager.js';
// import { SubstrateManager } from '../substrate/managers/substrate.manager.js';
import { WALLETCONNECT_CHAIN_CONFIG } from '../constants/wallet.constants.js';
import { WalletConnectNamespacePayload } from '../interfaces/wallet.interfaces.js';
import { SeedRepository } from '../seed.repository.js';
import { WalletIdentityService } from './wallet-identity.service.js';
import { AllChainTypes } from '../types/chain.types.js';
import { WalletAccountService } from './wallet-account.service.js';

@Injectable()
export class WalletConnectService {
  private readonly logger = new Logger(WalletConnectService.name);

  constructor(
    private readonly addressManager: AddressManager,
    // private readonly substrateManager: SubstrateManager,
    private readonly seedRepository: SeedRepository,
    private readonly walletIdentityService: WalletIdentityService,
    private readonly walletAccountService: WalletAccountService,
  ) {}

  async getWalletConnectAccounts(
    userId: string,
  ): Promise<WalletConnectNamespacePayload[]> {
    const { metadata } = await this.addressManager.getManagedAddresses(userId);
    const namespaces: WalletConnectNamespacePayload[] = [];

    // EIP155 namespace (EVM chains)
    const eip155Namespace: WalletConnectNamespacePayload = {
      namespace: 'eip155',
      chains: [],
      accounts: [],
      addressesByChain: {},
    };

    for (const config of WALLETCONNECT_CHAIN_CONFIG) {
      const address = metadata[config.key]?.address;

      if (!address) {
        continue;
      }

      const chainTag = `eip155:${config.chainId}`;
      eip155Namespace.chains.push(chainTag);
      eip155Namespace.accounts.push(`${chainTag}:${address}`);
      eip155Namespace.addressesByChain[chainTag] = address;
    }

    if (eip155Namespace.accounts.length > 0) {
      namespaces.push(eip155Namespace);
    }

    // Polkadot namespace (Substrate chains) - with error isolation
    // try {
    //   const substrateAddresses = await this.substrateManager.getAddresses(
    //     userId,
    //     false,
    //   );
    //   const enabledChains = this.substrateManager.getEnabledChains();

    //   const polkadotNamespace: WalletConnectNamespacePayload = {
    //     namespace: 'polkadot',
    //     chains: [],
    //     accounts: [],
    //     addressesByChain: {},
    //   };

    //   for (const chain of enabledChains) {
    //     const address = substrateAddresses[chain];
    //     if (!address) {
    //       continue;
    //     }

    //     const chainConfig = this.substrateManager.getChainConfig(chain, false);
    //     const genesisHash = chainConfig.genesisHash;
    //     const chainTag = `polkadot:${genesisHash}`;
    //     const accountId = `polkadot:${genesisHash}:${address}`;

    //     polkadotNamespace.chains.push(chainTag);
    //     polkadotNamespace.accounts.push(accountId);
    //     polkadotNamespace.addressesByChain[chainTag] = address;
    //   }

    //   if (polkadotNamespace.accounts.length > 0) {
    //     namespaces.push(polkadotNamespace);
    //   }
    // } catch (error) {
    //   this.logger.error(
    //     `Failed to register Polkadot namespace for WalletConnect: ${error instanceof Error ? error.message : 'Unknown error'}`,
    //   );
    //   // Continue with other namespaces - error isolation (Issue #6)
    // }

    if (namespaces.length === 0) {
      throw new BadRequestException(
        'No WalletConnect-compatible addresses found. Please initialize your wallet first.',
      );
    }

    // Return first namespace for backward compatibility, but log that multiple namespaces are available
    if (namespaces.length > 1) {
      this.logger.debug(
        `Multiple WalletConnect namespaces available: ${namespaces.map((n) => n.namespace).join(', ')}`,
      );
    }

    return namespaces;
  }

  /**
   * Sign a WalletConnect transaction request
   * @param userId - The user ID
   * @param chainId - WalletConnect chain ID (e.g., "eip155:1", "eip155:8453")
   * @param transaction - Transaction parameters from WalletConnect
   * @returns Transaction hash
   */
  async signWalletConnectTransaction(
    userId: string,
    chainId: string,
    transaction: {
      from: string;
      to?: string;
      value?: string;
      data?: string;
      gas?: string;
      gasPrice?: string;
      maxFeePerGas?: string;
      maxPriorityFeePerGas?: string;
      nonce?: string;
    },
  ): Promise<{ txHash: string }> {
    const hasSeed = await this.seedRepository.hasSeed(userId);

    if (!hasSeed) {
      await this.walletIdentityService.createOrImportSeed(userId, 'random');
    }

    const chainIdMatch = chainId.match(/^eip155:(\d+)$/);
    if (!chainIdMatch || !chainIdMatch[1]) {
      throw new BadRequestException(
        `Invalid WalletConnect chain ID format: ${chainId}. Expected format: eip155:chainId`,
      );
    }

    const chainMap: Record<string, AllChainTypes> = {
      '1': 'ethereum',
      '8453': 'base',
      '42161': 'arbitrum',
      '137': 'polygon',
      '43114': 'avalanche',
    };

    const internalChain = chainMap[chainIdMatch[1]];
    if (!internalChain) {
      throw new BadRequestException(
        `Unsupported chain ID: ${chainIdMatch[1]}. Supported chains: ${Object.keys(chainMap).join(', ')}`,
      );
    }

    const seedPhrase = await this.seedRepository.getSeedPhrase(userId);
    const account = await this.walletAccountService.createAccountForChain(
      seedPhrase,
      internalChain,
      userId,
    );

    const to = transaction.to || transaction.from;
    const value = transaction.value || '0';
    const txHash = await account.send(to, value);
    return { txHash };
  }
}
