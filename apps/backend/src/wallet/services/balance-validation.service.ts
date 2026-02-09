import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class BalanceValidationService {
  private readonly logger = new Logger(BalanceValidationService.name);

  /**
   * Fetch token decimals from RPC using ERC-20 decimals() call
   * @param tokenAddress - Token contract address
   * @param account - WDK account instance
   * @returns Token decimals or null if failed
   */
  async fetchDecimalsFromRPC(
    tokenAddress: string,
    account: any,
  ): Promise<number | null> {
    try {
      let provider: any = null;
      if ('provider' in account) {
        provider = account.provider;
      } else if (
        'getProvider' in account &&
        typeof account.getProvider === 'function'
      ) {
        provider = await account.getProvider();
      }

      if (!provider || typeof provider.request !== 'function') {
        return null;
      }

      // ERC-20 decimals() function signature: 0x313ce567
      const result = await provider.request({
        method: 'eth_call',
        params: [{ to: tokenAddress, data: '0x313ce567' }, 'latest'],
      });

      if (typeof result === 'string' && result !== '0x' && result !== '0x0') {
        const parsed = parseInt(result, 16);
        if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 36) {
          this.logger.log(
            `[RPC Decimals] Fetched decimals for ${tokenAddress}: ${parsed}`,
          );
          return parsed;
        }
      }

      return null;
    } catch (e) {
      this.logger.debug(
        `RPC decimals() call failed for ${tokenAddress}: ${e instanceof Error ? e.message : 'Unknown error'}`,
      );
      return null;
    }
  }

  /**
   * Validate balance on-chain (source of truth)
   * @param tokenAddress - Token contract address (null for native)
   * @param amountSmallest - Amount in smallest units (BigInt)
   * @param account - WDK account instance
   * @returns Validation result with balance
   */
  async validateBalanceOnChain(
    tokenAddress: string | null,
    amountSmallest: bigint,
    account: any,
  ): Promise<{ sufficient: boolean; balance: string }> {
    try {
      let balanceBigInt: bigint;

      if (tokenAddress) {
        // ERC-20 token balance
        if (
          'getTokenBalance' in account &&
          typeof account.getTokenBalance === 'function'
        ) {
          const bal = await account.getTokenBalance(tokenAddress);
          balanceBigInt = BigInt(bal?.toString?.() ?? String(bal));
        } else if (
          'balanceOf' in account &&
          typeof account.balanceOf === 'function'
        ) {
          const bal = await account.balanceOf(tokenAddress);
          balanceBigInt = BigInt(bal?.toString?.() ?? String(bal));
        } else {
          // Fallback to direct RPC call
          let provider: any = null;
          if ('provider' in account) {
            provider = account.provider;
          } else if (
            'getProvider' in account &&
            typeof account.getProvider === 'function'
          ) {
            provider = await account.getProvider();
          }

          if (provider && typeof provider.request === 'function') {
            const owner = await account.getAddress();
            const data =
              '0x70a08231' + owner.replace(/^0x/, '').padStart(64, '0');
            const result = await provider.request({
              method: 'eth_call',
              params: [{ to: tokenAddress, data }, 'latest'],
            });

            if (typeof result === 'string' && result.startsWith('0x')) {
              balanceBigInt = BigInt(result);
            } else {
              throw new Error('Invalid RPC response for token balance');
            }
          } else {
            throw new Error('No provider available for balance check');
          }
        }
      } else {
        // Native token balance
        const bal = await account.getBalance();
        balanceBigInt = BigInt(bal?.toString?.() ?? String(bal));
      }

      const sufficient = balanceBigInt >= amountSmallest;

      this.logger.log(
        `[On-Chain Balance] Token: ${tokenAddress || 'native'}, ` +
          `balance: ${balanceBigInt.toString()}, requested: ${amountSmallest.toString()}, ` +
          `sufficient: ${sufficient}`,
      );

      return {
        sufficient,
        balance: balanceBigInt.toString(),
      };
    } catch (e) {
      this.logger.error(
        `On-chain balance validation failed: ${e instanceof Error ? e.message : 'Unknown error'}`,
      );
      throw e;
    }
  }
}
