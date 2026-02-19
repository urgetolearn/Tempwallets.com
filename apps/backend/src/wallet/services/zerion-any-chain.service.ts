import { Injectable, Logger } from '@nestjs/common';
import { SeedRepository } from '../seed.repository.js';
import { ZerionService } from '../zerion.service.js';
import { AddressManager } from '../managers/address.manager.js';
// import { PolkadotEvmRpcService } from './polkadot-evm-rpc.service.js';
import { Eip7702DelegationRepository } from '../repositories/eip7702-delegation.repository.js';
import { WalletAddresses } from '../interfaces/wallet.interfaces.js';
import { WalletIdentityService } from './wallet-identity.service.js';

@Injectable()
export class ZerionAnyChainService {
  private readonly logger = new Logger(ZerionAnyChainService.name);

  constructor(
    private readonly seedRepository: SeedRepository,
    private readonly zerionService: ZerionService,
    private readonly addressManager: AddressManager,
    // private readonly polkadotEvmRpcService: PolkadotEvmRpcService,
    private readonly eip7702DelegationRepository: Eip7702DelegationRepository,
    private readonly walletIdentityService: WalletIdentityService,
  ) {}

  private async getAddresses(userId: string): Promise<WalletAddresses> {
    return this.addressManager.getAddresses(userId);
  }

  /**
   * Get all token positions across any supported chains for the user's primary addresses
   * Uses Zerion any-chain endpoints per address (no chain filter) and merges results.
   * Primary addresses considered: EVM EOA (ethereum), first ERC-4337 smart account, and Solana.
   * @param userId - The user ID
   * @param forceRefresh - Force refresh from API (bypass Zerion's internal cache)
   */
  async getTokenBalancesAny(
    userId: string,
    forceRefresh: boolean = false,
  ): Promise<
    Array<{
      chain: string;
      address: string | null;
      symbol: string;
      balance: string;
      decimals: number;
      balanceHuman?: string;
    }>
  > {
    // Ensure wallet exists
    const hasSeed = await this.seedRepository.hasSeed(userId);
    if (!hasSeed) {
      await this.walletIdentityService.createOrImportSeed(userId, 'random');
    }

    const addresses = await this.getAddresses(userId);

    // Collect all unique target addresses we want Zerion to index
    const seenAddresses = new Set<string>();
    const targetAddresses: string[] = [];
    const addTarget = (addr?: string | null) => {
      if (!addr) return;
      const key = addr.toLowerCase();
      if (seenAddresses.has(key)) return;
      seenAddresses.add(key);
      targetAddresses.push(addr);
    };

    // Primary EVM EOAs (one per supported chain)
    addTarget(addresses.ethereum);
    addTarget(addresses.base);
    addTarget(addresses.arbitrum);
    addTarget(addresses.polygon);
    addTarget(addresses.avalanche);

    // Solana address (Zerion supports Solana)
    //addTarget(addresses.solana);

    // Include any recorded EIP-7702 delegated accounts (EOA keeps same address)
    try {
      const delegations =
        await this.eip7702DelegationRepository.getDelegationsForUser(userId);
      for (const delegation of delegations) {
        addTarget(delegation.address);
      }
    } catch (error) {
      this.logger.warn(
        `Failed to load EIP-7702 delegations for ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    // Polkadot EVM chains use the same EOA address as ethereum
    const polkadotEvmAddress = addresses.ethereum;

    // Invalidate Zerion cache for all addresses if force refresh is requested
    if (forceRefresh) {
      for (const addr of targetAddresses) {
        // Invalidate for common chains that Zerion supports
        const chains = [
          'ethereum',
          'base',
          'arbitrum',
          'polygon',
          'avalanche',
          'solana',
        ];
        for (const chain of chains) {
          this.zerionService.invalidateCache(addr, chain);
        }
      }
    }

    // Fetch positions for each address in parallel (Zerion)
    const zerionResults =
      targetAddresses.length > 0
        ? await Promise.all(
            targetAddresses.map((addr) =>
              this.zerionService.getPositionsAnyChain(addr),
            ),
          )
        : [];

    // Fetch Polkadot EVM chain assets using RPC
    // const polkadotEvmChains = [
    //   'moonbeamTestnet',
    //   'astarShibuya',
    //   'paseoPassetHub',
    // ];
    // const polkadotResults: Array<{
    //   chain: string;
    //   address: string | null;
    //   symbol: string;
    //   balance: string;
    //   decimals: number;
    //   balanceHuman?: string;
    // }> = [];

    // if (polkadotEvmAddress) {
    //   // Use Promise.allSettled to ensure RPC errors don't block Zerion results
    //   const polkadotAssetResults = await Promise.allSettled(
    //     polkadotEvmChains.map(async (chain) => {
    //       try {
    //         const assets = await this.polkadotEvmRpcService.getAssets(
    //           polkadotEvmAddress,
    //           chain,
    //         );
    //         return assets;
    //       } catch (error) {
    //         this.logger.error(
    //           `Error fetching assets for ${chain}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    //         );
    //         return []; // Return empty array on error
    //       }
    //     }),
    //   );

    //   // Flatten the results
    //   for (const result of polkadotAssetResults) {
    //     if (result.status === 'fulfilled') {
    //       polkadotResults.push(...result.value);
    //     }
    //   }
    // }

    // Merge and dedupe across addresses using chain_id + token address/native
    // Preserve Zerion's native balance format (smallest units) and decimals
    const byKey = new Map<
      string,
      {
        chain: string;
        address: string | null;
        symbol: string;
        balance: string;
        decimals: number;
        balanceHuman?: string;
      }
    >();

    // Process Zerion results
    for (const parsedTokens of zerionResults) {
      if (!parsedTokens || !Array.isArray(parsedTokens)) continue;
      for (const token of parsedTokens) {
        try {
          const chainId = token.chain;
          const balanceSmallest = token.balanceSmallest;

          // Skip zero balances
          if (balanceSmallest === '0' || BigInt(balanceSmallest) === 0n)
            continue;

          const key = `${chainId}:${token.address ? token.address.toLowerCase() : 'native'}`;
          if (!byKey.has(key)) {
            byKey.set(key, {
              chain: chainId,
              address: token.address,
              symbol: token.symbol,
              balance: balanceSmallest, // Keep smallest units as primary balance
              decimals: token.decimals || 18, // Use Zerion's decimals with fallback
              balanceHuman: token.balanceHuman.toString(), // Add human-readable for UI
            });
          }
        } catch (e) {
          this.logger.debug(
            `Error processing parsed token: ${e instanceof Error ? e.message : 'Unknown error'}`,
          );
        }
      }
    }

    // Process Polkadot EVM RPC results
    // for (const asset of polkadotResults) {
    //   try {
    //     // Skip zero balances
    //     if (asset.balance === '0' || BigInt(asset.balance) === 0n) continue;

    //     const key = `${asset.chain}:${asset.address ? asset.address.toLowerCase() : 'native'}`;
    //     if (!byKey.has(key)) {
    //       byKey.set(key, {
    //         chain: asset.chain,
    //         address: asset.address,
    //         symbol: asset.symbol,
    //         balance: asset.balance,
    //         decimals: asset.decimals,
    //         balanceHuman: asset.balanceHuman,
    //       });
    //     }
    //   } catch (e) {
    //     this.logger.debug(
    //       `Error processing Polkadot EVM asset: ${e instanceof Error ? e.message : 'Unknown error'}`,
    //     );
    //   }
    // }

    return Array.from(byKey.values());
  }
}
