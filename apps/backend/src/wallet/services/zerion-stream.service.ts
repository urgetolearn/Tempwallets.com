import { Injectable, Logger } from '@nestjs/common';
import { AddressManager } from '../managers/address.manager.js';
import { ZerionPortfolioService } from './zerion-portfolio.service.js';

@Injectable()
export class ZerionStreamService {
  private readonly logger = new Logger(ZerionStreamService.name);

  constructor(
    private readonly addressManager: AddressManager,
    private readonly zerionPortfolioService: ZerionPortfolioService,
  ) {}

  /**
   * Stream balances progressively (for SSE)
   * Yields balances as they're fetched from Zerion
   */
  async *streamBalances(userId: string): AsyncGenerator<
    {
      chain: string;
      nativeBalance: string;
      tokens: Array<{
        address: string | null;
        symbol: string;
        balance: string;
        decimals: number;
      }>;
    },
    void,
    unknown
  > {
    // Get addresses first
    const addresses = await this.addressManager.getAddresses(userId);

    // Process each chain independently
    for (const [chain, address] of Object.entries(addresses)) {
      if (!address) {
        yield { chain, nativeBalance: '0', tokens: [] };
        continue;
      }

      try {
        // Get token balances from Zerion (includes native + tokens)
        const tokens = await this.zerionPortfolioService.getTokenBalances(
          userId,
          chain,
        );
        const nativeToken = tokens.find((t) => t.address === null);
        const otherTokens = tokens.filter((t) => t.address !== null);

        yield {
          chain,
          nativeBalance: nativeToken?.balance || '0',
          tokens: otherTokens,
        };
      } catch (error) {
        this.logger.error(
          `Error streaming balance for ${chain}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        yield { chain, nativeBalance: '0', tokens: [] };
      }
    }
  }
}
