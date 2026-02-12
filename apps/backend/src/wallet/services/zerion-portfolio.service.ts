import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SeedRepository } from '../seed.repository.js';
import { ZerionService } from '../zerion.service.js';
import { AddressManager } from '../managers/address.manager.js';
import { BalanceCacheRepository } from '../repositories/balance-cache.repository.js';
import { WalletAddresses } from '../interfaces/wallet.interfaces.js';
import { WalletIdentityService } from './wallet-identity.service.js';
import { TokenMetadataService } from './token-metadata.service.js';

@Injectable()
export class ZerionPortfolioService {
  private readonly logger = new Logger(ZerionPortfolioService.name);

  constructor(
    private readonly seedRepository: SeedRepository,
    private readonly zerionService: ZerionService,
    private readonly addressManager: AddressManager,
    private readonly balanceCacheRepository: BalanceCacheRepository,
    private readonly walletIdentityService: WalletIdentityService,
    private readonly tokenMetadataService: TokenMetadataService,
  ) {}

  private async getAddresses(userId: string): Promise<WalletAddresses> {
    return this.addressManager.getAddresses(userId);
  }

  /**
   * Get balances for all chains using Zerion API
   * Auto-creates wallet if it doesn't exist
   * @param userId - The user ID
   * @returns Array of balance objects
   */
  async getBalances(
    userId: string,
    forceRefresh: boolean = false,
  ): Promise<Array<{ chain: string; balance: string }>> {
    // Substrate chains are handled separately by getSubstrateBalances()
    // Skip them here to avoid returning misleading cached values
    // const substrateChains = [
    //   'polkadot',
    //   'hydrationSubstrate',
    //   'bifrostSubstrate',
    //   'uniqueSubstrate',
    //   'paseo',
    //   'paseoAssethub',
    // ];

    // Fast path: Check database cache first (unless force refresh)
    if (!forceRefresh) {
      const cachedBalances =
        await this.balanceCacheRepository.getCachedBalances(userId);
      if (cachedBalances) {
        this.logger.debug(
          `Returning cached balances from DB for user ${userId}`,
        );
        // Convert cached format to response format, excluding Substrate chains
        return Object.entries(cachedBalances).map(([chain, data]) => ({
          chain,
          balance: data.balance,
        }));
      }
    }

    // Check if wallet exists, create if not
    const hasSeed = await this.seedRepository.hasSeed(userId);

    if (!hasSeed) {
      await this.walletIdentityService.createOrImportSeed(userId, 'random');
    }

    // Get addresses first (using WDK - addresses stay on backend)
    const addresses = await this.getAddresses(userId);

    const balances: Array<{ chain: string; balance: string }> = [];
    const balancesToCache: Record<
      string,
      { balance: string; lastUpdated: number }
    > = {};

    // For each chain, get balance from Zerion
    for (const [chain, address] of Object.entries(addresses)) {
      if (!address) {
        balances.push({ chain, balance: '0' });
        balancesToCache[chain] = { balance: '0', lastUpdated: Date.now() };
        continue;
      }

      try {
        // Get portfolio from Zerion
        const portfolio = await this.zerionService.getPortfolio(address, chain);

        if (!portfolio?.data || !Array.isArray(portfolio.data)) {
          // Zerion doesn't support this chain or returned no data
          balances.push({ chain, balance: '0' });
          balancesToCache[chain] = { balance: '0', lastUpdated: Date.now() };
          continue;
        }

        // Find native token in portfolio
        const nativeToken = portfolio.data.find(
          (token) =>
            token.type === 'native' || !token.attributes?.fungible_info,
        );

        let balance = '0';
        if (nativeToken?.attributes?.quantity) {
          const quantity = nativeToken.attributes.quantity;
          // Combine int and decimals parts
          const intPart = quantity.int || '0';
          const decimals = quantity.decimals || 0;
          balance = `${intPart}${'0'.repeat(Math.max(0, 18 - decimals))}`;
        }

        balances.push({
          chain,
          balance,
        });

        balancesToCache[chain] = { balance, lastUpdated: Date.now() };

        this.logger.log(
          `Successfully got balance for ${chain} from Zerion: ${balance}`,
        );
      } catch (error) {
        this.logger.error(
          `Error fetching balance for ${chain} from Zerion: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        // Return 0 balance if Zerion fails (Zerion is primary source)
        balances.push({ chain, balance: '0' });
        balancesToCache[chain] = { balance: '0', lastUpdated: Date.now() };
      }
    }

    // Save to cache
    await this.balanceCacheRepository.updateCachedBalances(
      userId,
      balancesToCache,
    );

    return balances;
  }

  /**
   * Refresh balances from external APIs and update cache
   * @param userId - The user ID
   * @returns Fresh balances from APIs
   */
  async refreshBalances(
    userId: string,
  ): Promise<Array<{ chain: string; balance: string }>> {
    this.logger.debug(`Refreshing balances for user ${userId}`);
    return this.getBalances(userId, true); // Force refresh
  }

  /**
   * Get token balances for a specific chain using Zerion API
   * @param userId - The user ID
   * @param chain - The blockchain network
   * @param forceRefresh - Force refresh from API (bypass Zerion's internal cache)
   * @returns Array of token balances
   */
  async getTokenBalances(
    userId: string,
    chain: string,
    forceRefresh: boolean = false,
  ): Promise<
    Array<{
      address: string | null;
      symbol: string;
      balance: string;
      decimals: number;
    }>
  > {
    this.logger.debug(
      `Getting token balances for user ${userId} on chain ${chain} using Zerion${forceRefresh ? ' (force refresh)' : ''}`,
    );

    // Check if wallet exists, create if not
    const hasSeed = await this.seedRepository.hasSeed(userId);

    if (!hasSeed) {
      this.logger.debug(`No wallet found for user ${userId}. Auto-creating...`);
      await this.walletIdentityService.createOrImportSeed(userId, 'random');
      this.logger.debug(`Successfully auto-created wallet for user ${userId}`);
    }

    try {
      // Get address for this chain
      const addresses = await this.getAddresses(userId);
      const address = addresses[chain as keyof WalletAddresses];

      if (!address) {
        this.logger.warn(`No address found for chain ${chain}`);
        return [];
      }

      // Invalidate Zerion cache if force refresh is requested
      if (forceRefresh) {
        this.zerionService.invalidateCache(address, chain);
      }

      // Get portfolio from Zerion (includes native + all ERC-20 tokens)
      const portfolio = await this.zerionService.getPortfolio(address, chain);

      // Check if portfolio has valid data array
      if (
        !portfolio?.data ||
        !Array.isArray(portfolio.data) ||
        portfolio.data.length === 0
      ) {
        // Zerion doesn't support this chain or returned no data
        this.logger.warn(
          `No portfolio data from Zerion for ${address} on ${chain}`,
        );
        return [];
      }

      const tokens: Array<{
        address: string | null;
        symbol: string;
        balance: string;
        decimals: number;
      }> = [];

      // Process each token in portfolio
      for (const tokenData of portfolio.data) {
        try {
          const quantity = tokenData.attributes?.quantity;
          if (!quantity) continue;

          const intPart = quantity.int || '0';
          const decimals = quantity.decimals || 0;

          // Convert to standard format (18 decimals)
          const balance = `${intPart}${'0'.repeat(Math.max(0, 18 - decimals))}`;

          // Skip zero balances
          if (parseFloat(balance) === 0) continue;

          // Determine if native token or ERC-20
          const isNative =
            tokenData.type === 'native' || !tokenData.attributes?.fungible_info;
          const fungibleInfo = tokenData.attributes?.fungible_info;

          if (isNative) {
            // Native token
            const nativeSymbol =
              this.tokenMetadataService.getNativeTokenSymbol(chain);
            const nativeDecimals =
              this.tokenMetadataService.getNativeTokenDecimals(chain);

            tokens.push({
              address: null,
              symbol: nativeSymbol,
              balance,
              decimals: nativeDecimals,
            });
          } else if (fungibleInfo) {
            // ERC-20 token
            const tokenAddress =
              fungibleInfo.implementations?.[0]?.address || null;
            const symbol = fungibleInfo.symbol || 'UNKNOWN';
            // Use smart fallback for known tokens
            const tokenDecimals =
              fungibleInfo.decimals ??
              this.tokenMetadataService.getDefaultDecimals(chain, tokenAddress);

            tokens.push({
              address: tokenAddress,
              symbol,
              balance,
              decimals: tokenDecimals,
            });
          }
        } catch (error) {
          this.logger.debug(
            `Error processing token from Zerion: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        }
      }

      this.logger.debug(
        `Retrieved ${tokens.length} tokens from Zerion for ${chain}`,
      );
      return tokens;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Error getting token balances from Zerion: ${errorMessage}`,
      );

      // Return empty array if Zerion fails (Zerion is primary source)
      return [];
    }
  }
}
