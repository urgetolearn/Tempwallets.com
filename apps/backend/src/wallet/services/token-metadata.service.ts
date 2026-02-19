import { Injectable } from '@nestjs/common';

@Injectable()
export class TokenMetadataService {
  /**
   * Get native token symbol for a chain
   */
  getNativeTokenSymbol(chain: string): string {
    const symbols: Record<string, string> = {
      ethereum: 'ETH',
      base: 'ETH',
      arbitrum: 'ETH',
      polygon: 'MATIC',
      avalanche: 'AVAX',
      tron: 'TRX',
      bitcoin: 'BTC',
      solana: 'SOL',
      ethereumErc4337: 'ETH',
      baseErc4337: 'ETH',
      arbitrumErc4337: 'ETH',
      polygonErc4337: 'MATIC',
      avalancheErc4337: 'AVAX',
    };
    return symbols[chain] || chain.toUpperCase();
  }

  /**
   * Get native token decimals for a chain
   */
  getNativeTokenDecimals(chain: string): number {
    const decimals: Record<string, number> = {
      ethereum: 18,
      base: 18,
      arbitrum: 18,
      polygon: 18,
      avalanche: 18,
      tron: 6,
      bitcoin: 8,
      solana: 9,
      ethereumErc4337: 18,
      baseErc4337: 18,
      arbitrumErc4337: 18,
      polygonErc4337: 18,
      avalancheErc4337: 18,
    };
    return decimals[chain] || 18;
  }

  /**
   * Get default decimals for a token address with known overrides
   * Used as fallback when Zerion doesn't provide decimals
   * @param chain - The blockchain network
   * @param address - The token contract address (lowercase)
   * @returns Token decimals (defaults to 18 for unknown tokens)
   */
  getDefaultDecimals(chain: string, address: string | null): number {
    // Native tokens - return 0 to indicate native (caller should use chain-specific decimals)
    if (!address) {
      return 0;
    }

    const addr = address.toLowerCase();

    // Known token decimals overrides (cross-chain)
    const overrides: Record<string, number> = {
      // === Native USDC (6 decimals) ===
      // Base
      '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': 6,
      // Ethereum
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 6,
      // Arbitrum
      '0xaf88d065e77c8cc2239327c5edb3a432268e5831': 6,
      // Polygon
      '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359': 6,

      // === USDT (6 decimals) ===
      // Ethereum
      '0xdac17f958d2ee523a2206206994597c13d831ec7': 6,
      // Arbitrum
      '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9': 6,
      // Polygon
      '0xc2132d05d31c914a87c6611c10748aeb04b58e8f': 6,

      // === Bridged USDbC (Base - 18 decimals) ===
      '0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca': 18,

      // === WBTC (8 decimals) ===
      // Ethereum
      '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': 8,
      // Arbitrum
      '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f': 8,
      // Polygon
      '0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6': 8,
    };

    return overrides[addr] ?? 18;
  }
}
