import { Injectable, Logger } from '@nestjs/common';
import { ZerionService, TokenBalance } from '../zerion.service.js';
import { ZerionChainService } from './zerion-chain.service.js';

@Injectable()
export class ZerionTokenLookupService {
  private readonly logger = new Logger(ZerionTokenLookupService.name);

  constructor(
    private readonly zerionService: ZerionService,
    private readonly zerionChainService: ZerionChainService,
  ) {}

  /**
   * Get token info from Zerion for a specific token address
   * @param tokenAddress - Token contract address
   * @param chain - Internal chain name
   * @param walletAddress - Wallet address to check
   * @returns Token info with decimals and balance, or null if not found
   */
  async getZerionTokenInfo(
    tokenAddress: string,
    chain: string,
    walletAddress: string,
  ): Promise<{
    decimals: number;
    balanceSmallest: string;
    symbol?: string;
  } | null> {
    try {
      // Get all possible Zerion chain ID formats for this chain
      const chainAliases = this.zerionChainService.getZerionChainAliases(chain);
      const tokenAddressLower = tokenAddress.toLowerCase();
      const aliasSet = new Set(
        chainAliases.map((alias) => alias.toLowerCase()),
      );

      this.logger.log(
        `[Zerion Lookup] Fetching positions for address: ${walletAddress}, ` +
          `internal chain: ${chain}, Zerion chain aliases: [${chainAliases.join(', ')}], ` +
          `token: ${tokenAddress}`,
      );

      const positionsAny =
        await this.zerionService.getPositionsAnyChain(walletAddress);

      if (!positionsAny || positionsAny.length === 0) {
        this.logger.warn(
          `[Zerion Lookup] No data returned for ${walletAddress}`,
        );
        return null;
      }

      this.logger.log(
        `[Zerion Lookup] Got ${positionsAny.length} positions for ${walletAddress}`,
      );

      // Log all positions for debugging
      positionsAny.forEach((p: TokenBalance, index: number) => {
        this.logger.debug(
          `[Zerion Position ${index}] symbol=${p.symbol}, ` +
            `address=${p.address}, chain=${p.chain}, balance=${p.balanceSmallest}`,
        );
      });

      // Check all implementations, not just the first one
      const match = positionsAny.find((p: TokenBalance) => {
        // Match by token address (case-insensitive) + Zerion chain aliases
        const positionAddress = p.address?.toLowerCase();
        const positionChain = p.chain?.toLowerCase() || '';
        return (
          !!positionAddress &&
          positionAddress === tokenAddressLower &&
          aliasSet.has(positionChain)
        );
      });

      if (!match) {
        this.logger.warn(
          `[Zerion Lookup] Token ${tokenAddress} not found in Zerion positions for ${walletAddress}. ` +
            `User may not hold this token, or Zerion data is stale. ` +
            `Checked chain aliases: [${chainAliases.join(', ')}]`,
        );
        return null;
      }

      const decimals = match.decimals;
      const balanceSmallest = match.balanceSmallest;

      // CRITICAL VALIDATION: Ensure decimals field exists and is valid
      if (decimals === null || decimals === undefined) {
        this.logger.error(
          `[Zerion Lookup] Token ${tokenAddress} found but decimals field is null/undefined. ` +
            `Decimals value: ${decimals}. Zerion data may be incomplete.`,
        );
        return null;
      }

      if (typeof decimals !== 'number') {
        this.logger.error(
          `[Zerion Lookup] Token ${tokenAddress} has invalid decimals type: ${typeof decimals}. ` +
            `Value: ${decimals}. Expected a number.`,
        );
        return null;
      }

      if (decimals < 0 || decimals > 36) {
        this.logger.error(
          `[Zerion Lookup] Token ${tokenAddress} has out-of-range decimals: ${decimals}. ` +
            `Decimals must be between 0 and 36.`,
        );
        return null;
      }

      this.logger.log(
        `[Zerion Lookup] Successfully found token: symbol=${match.symbol}, ` +
          `decimals=${decimals}, balance=${balanceSmallest}. ` +
          `Data from Zerion is valid and ready for use.`,
      );

      return {
        decimals,
        balanceSmallest,
        symbol: match.symbol,
      };
    } catch (e) {
      this.logger.error(
        `[Zerion Lookup] Failed to get Zerion token info: ${e instanceof Error ? e.message : 'Unknown error'}`,
      );
      return null;
    }
  }

  /**
   * Validate balance from Zerion
   * @param tokenAddress - Token contract address (null for native)
   * @param amountSmallest - Amount in smallest units (BigInt)
   * @param chain - Internal chain name
   * @param walletAddress - Wallet address to check
   * @returns Validation result with balance info
   */
  async validateBalanceFromZerion(
    tokenAddress: string | null,
    amountSmallest: bigint,
    chain: string,
    walletAddress: string,
  ): Promise<{
    sufficient: boolean;
    zerionBalance: string;
    onChainBalance?: string;
    error?: string;
  }> {
    try {
      if (tokenAddress) {
        // ERC-20 token
        const tokenInfo = await this.getZerionTokenInfo(
          tokenAddress,
          chain,
          walletAddress,
        );
        if (!tokenInfo) {
          return {
            sufficient: false,
            zerionBalance: '0',
            error: `Token ${tokenAddress} not found in Zerion for this wallet`,
          };
        }

        const zerionBalanceBigInt = BigInt(tokenInfo.balanceSmallest);
        const sufficient =
          zerionBalanceBigInt >= BigInt(amountSmallest.toString());

        return {
          sufficient,
          zerionBalance: tokenInfo.balanceSmallest,
        };
      } else {
        // Native token - fetch from Zerion
        const chainAliases =
          this.zerionChainService.getZerionChainAliases(chain);

        this.logger.log(
          `[Zerion Balance] Fetching native balance for address: ${walletAddress}, ` +
            `chain: ${chain}, aliases: [${chainAliases.join(', ')}]`,
        );

        const positionsAny =
          await this.zerionService.getPositionsAnyChain(walletAddress);
        if (!positionsAny || positionsAny.length === 0) {
          return {
            sufficient: false,
            zerionBalance: '0',
            error: 'Could not fetch native balance from Zerion',
          };
        }

        const nativeMatch = positionsAny.find((p: TokenBalance) => {
          const isNative = !p.address; // Native tokens have null address
          const chainMatch = chainAliases.some(
            (alias) => p.chain?.toLowerCase() === alias.toLowerCase(),
          );

          return isNative && chainMatch;
        });

        if (!nativeMatch) {
          this.logger.warn(
            `[Zerion Balance] Native token not found for chain=${chain} ` +
              `(checked aliases: [${chainAliases.join(', ')}])`,
          );
          return {
            sufficient: false,
            zerionBalance: '0',
            error: `Native token not found in Zerion for chain ${chain}`,
          };
        }

        const balanceSmallest = nativeMatch.balanceSmallest;
        const zerionBalanceBigInt = BigInt(balanceSmallest);
        const sufficient =
          zerionBalanceBigInt >= BigInt(amountSmallest.toString());

        this.logger.log(
          `[Zerion Balance] Native balance: ${balanceSmallest}, ` +
            `requested: ${amountSmallest.toString()}, sufficient: ${sufficient}`,
        );

        return {
          sufficient,
          zerionBalance: balanceSmallest,
        };
      }
    } catch (e) {
      this.logger.error(
        `Balance validation from Zerion failed: ${e instanceof Error ? e.message : 'Unknown error'}`,
      );
      return {
        sufficient: false,
        zerionBalance: '0',
        error: `Balance validation error: ${e instanceof Error ? e.message : 'Unknown error'}`,
      };
    }
  }
}
