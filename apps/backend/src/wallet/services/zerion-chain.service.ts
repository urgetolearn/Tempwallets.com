import { Injectable } from '@nestjs/common';

@Injectable()
export class ZerionChainService {
  /**
   * Chain ID aliases for Zerion API - Zerion may return chain IDs in different formats
   */
  private readonly CHAIN_ID_ALIASES: Record<string, string[]> = {
    ethereum: ['ethereum', 'eth', 'eip155:1', 'ethereum-mainnet', '1'],
    base: ['base', 'eip155:8453', 'base-mainnet', '8453'],
    arbitrum: ['arbitrum', 'arbitrum-one', 'eip155:42161', '42161'],
    polygon: ['polygon', 'matic', 'eip155:137', 'polygon-mainnet', '137'],
    avalanche: ['avalanche', 'avax', 'eip155:43114', '43114', 'avalanche-c'],
    moonbeamTestnet: [
      'moonbeamTestnet',
      'moonbase',
      'eip155:420420422',
      '420420422',
    ],
    astarShibuya: ['astarShibuya', 'shibuya', 'eip155:81', '81'],
    paseoPassetHub: [
      'paseoPassetHub',
      'paseo',
      'passethub',
      'eip155:420420422',
      '420420422',
    ],
  };

  /**
   * Get all possible Zerion chain ID formats for a given internal chain
   * @param internalChain - Internal chain name (e.g., 'baseErc4337' or 'base')
   * @returns Array of possible Zerion chain ID formats
   */
  getZerionChainAliases(internalChain: string): string[] {
    // Remove ERC-4337 suffix to get base chain
    const baseChain = internalChain.replace(/Erc4337/gi, '').toLowerCase();
    return this.CHAIN_ID_ALIASES[baseChain] || [baseChain];
  }
}
