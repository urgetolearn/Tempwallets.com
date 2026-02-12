// import { Injectable, Logger } from '@nestjs/common';
// import { SubstrateManager } from '../substrate/managers/substrate.manager.js';
// import { SubstrateChainKey } from '../substrate/config/substrate-chain.config.js';
// import { BalanceCacheRepository } from '../repositories/balance-cache.repository.js';
// import { AddressManager } from '../managers/address.manager.js';
// import { WalletAddresses } from '../interfaces/wallet.interfaces.js';

// @Injectable()
// export class SubstrateBalanceService {
//   private readonly logger = new Logger(SubstrateBalanceService.name);

//   constructor(
//     private readonly substrateManager: SubstrateManager,
//     private readonly balanceCacheRepository: BalanceCacheRepository,
//     private readonly addressManager: AddressManager,
//   ) {}

//   /**
//    * Get Substrate balances for all chains for a user
//    *
//    * @param userId - User ID
//    * @param useTestnet - Whether to use testnet
//    * @returns Map of chain -> balance information
//    */
//   async getSubstrateBalances(
//     userId: string,
//     useTestnet: boolean = false,
//     forceRefresh: boolean = false,
//   ): Promise<
//     Record<
//       SubstrateChainKey,
//       {
//         balance: string;
//         address: string | null;
//         token: string;
//         decimals: number;
//       }
//     >
//   > {
//     // Fast path: Check database cache first (unless force refresh)
//     const cacheKey = `substrate_${useTestnet ? 'testnet' : 'mainnet'}`;

//     if (!forceRefresh) {
//       const cachedBalances =
//         await this.balanceCacheRepository.getCachedBalances(userId);
//       if (cachedBalances) {
//         // Check if we have substrate balances cached
//         const substrateChains: SubstrateChainKey[] = [
//           'polkadot',
//           'hydration',
//           'bifrost',
//           'unique',
//           'paseo',
//           'paseoAssethub',
//         ];
//         const hasSubstrateCache = substrateChains.some((chain) => {
//           const key = `${cacheKey}_${chain}`;
//           return cachedBalances[key] !== undefined;
//         });

//         if (hasSubstrateCache) {
//           this.logger.debug(
//             `Returning cached Substrate balances from DB for user ${userId}`,
//           );
//           const result: Record<
//             string,
//             {
//               balance: string;
//               address: string | null;
//               token: string;
//               decimals: number;
//             }
//           > = {};

//           for (const chain of substrateChains) {
//             const key = `${cacheKey}_${chain}`;
//             const cached = cachedBalances[key];
//             if (cached) {
//               const chainConfig = this.substrateManager.getChainConfig(
//                 chain,
//                 useTestnet,
//               );
//               // We need to get the address separately since it's not in cache
//               const addresses = await this.addressManager.getAddresses(userId);
//               let address: string | null = null;

//               // Map chain to address key
//               const addressMap: Record<
//                 SubstrateChainKey,
//                 keyof WalletAddresses
//               > = {
//                 polkadot: 'polkadot',
//                 hydration: 'hydrationSubstrate',
//                 bifrost: 'bifrostSubstrate',
//                 unique: 'uniqueSubstrate',
//                 paseo: 'paseo',
//                 paseoAssethub: 'paseoAssethub',
//               };

//               address = addresses[addressMap[chain]] ?? null;

//               result[chain] = {
//                 balance: cached.balance,
//                 address,
//                 token: chainConfig.token.symbol,
//                 decimals: chainConfig.token.decimals,
//               };
//             }
//           }

//           if (Object.keys(result).length > 0) {
//             return result as Record<
//               SubstrateChainKey,
//               {
//                 balance: string;
//                 address: string | null;
//                 token: string;
//                 decimals: number;
//               }
//             >;
//           }
//         }
//       }
//     }

//     this.logger.log(
//       `[SubstrateBalanceService] Getting Substrate balances for user ${userId} (testnet: ${useTestnet})`,
//     );
//     const balances = await this.substrateManager.getBalances(
//       userId,
//       useTestnet,
//     );
//     this.logger.log(
//       `[SubstrateBalanceService] Received ${Object.keys(balances).length} Substrate chain balances`,
//     );

//     const result: Record<
//       string,
//       {
//         balance: string;
//         address: string | null;
//         token: string;
//         decimals: number;
//       }
//     > = {};
//     const balancesToCache: Record<
//       string,
//       { balance: string; lastUpdated: number }
//     > = {};

//     for (const [chain, data] of Object.entries(balances)) {
//       const chainConfig = this.substrateManager.getChainConfig(
//         chain as SubstrateChainKey,
//         useTestnet,
//       );
//       result[chain] = {
//         balance: data.balance,
//         address: data.address,
//         token: chainConfig.token.symbol,
//         decimals: chainConfig.token.decimals,
//       };

//       // Cache with a key that includes testnet/mainnet distinction
//       const cacheKeyForChain = `${cacheKey}_${chain}`;
//       balancesToCache[cacheKeyForChain] = {
//         balance: data.balance,
//         lastUpdated: Date.now(),
//       };

//       this.logger.debug(
//         `[SubstrateBalanceService] ${chain}: ${data.balance} ${chainConfig.token.symbol} (address: ${data.address ? 'present' : 'null'})`,
//       );
//     }

//     // Update cache with substrate balances (merge with existing cache)
//     const existingCache =
//       (await this.balanceCacheRepository.getCachedBalances(userId)) || {};
//     const mergedCache = { ...existingCache, ...balancesToCache };
//     await this.balanceCacheRepository.updateCachedBalances(userId, mergedCache);

//     this.logger.log(
//       `[SubstrateBalanceService] Returning ${Object.keys(result).length} Substrate balances`,
//     );
//     return result as Record<
//       SubstrateChainKey,
//       {
//         balance: string;
//         address: string | null;
//         token: string;
//         decimals: number;
//       }
//     >;
//   }
// }
