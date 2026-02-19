// import { Injectable } from '@nestjs/common';
// import { SubstrateManager } from '../substrate/managers/substrate.manager.js';
// import { SubstrateChainKey } from '../substrate/config/substrate-chain.config.js';

// @Injectable()
// export class WalletSubstrateService {
//   constructor(private readonly substrateManager: SubstrateManager) {}

//   /**
//    * Get Substrate transaction history for a user
//    *
//    * @param userId - User ID
//    * @param chain - Chain key
//    * @param useTestnet - Whether to use testnet
//    * @param limit - Number of transactions to fetch
//    * @param cursor - Pagination cursor
//    * @returns Transaction history
//    */
//   async getSubstrateTransactions(
//     userId: string,
//     chain: SubstrateChainKey,
//     useTestnet: boolean = false,
//     limit: number = 10,
//     cursor?: string,
//   ) {
//     return this.substrateManager.getUserTransactionHistory(
//       userId,
//       chain,
//       useTestnet,
//       limit,
//       cursor,
//     );
//   }

//   /**
//    * Get Substrate addresses for a user
//    *
//    * @param userId - User ID
//    * @param useTestnet - Whether to use testnet
//    * @returns Substrate addresses
//    */
//   async getSubstrateAddresses(userId: string, useTestnet: boolean = false) {
//     return this.substrateManager.getAddresses(userId, useTestnet);
//   }

//   /**
//    * Send Substrate transfer
//    *
//    * @param userId - User ID
//    * @param chain - Chain key
//    * @param to - Recipient address
//    * @param amount - Amount in smallest units
//    * @param useTestnet - Whether to use testnet
//    * @param transferMethod - Transfer method ('transferAllowDeath' or 'transferKeepAlive')
//    * @param accountIndex - Account index (default: 0)
//    * @returns Transaction result
//    */
//   async sendSubstrateTransfer(
//     userId: string,
//     chain: SubstrateChainKey,
//     to: string,
//     amount: string,
//     useTestnet: boolean = false,
//     transferMethod?: 'transferAllowDeath' | 'transferKeepAlive',
//     accountIndex: number = 0,
//   ) {
//     return this.substrateManager.sendTransfer(
//       userId,
//       {
//         from: '', // Will be resolved from userId in SubstrateTransactionService
//         to,
//         amount,
//         chain,
//         useTestnet,
//         transferMethod,
//       },
//       accountIndex,
//     );
//   }
// }
