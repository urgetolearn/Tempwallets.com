import { Injectable, Logger } from '@nestjs/common';

import { SeedManager } from '../managers/seed.manager.js';
import { AddressManager } from '../managers/address.manager.js';

import { WalletHistoryRepository } from '../repositories/wallet-history.repository.js';

@Injectable()
export class WalletIdentityService {
  private readonly logger = new Logger(WalletIdentityService.name);

  constructor(
    private readonly seedManager: SeedManager,
    private readonly addressManager: AddressManager,
    private readonly walletHistoryRepository: WalletHistoryRepository,
  ) {}

  /**
   * Create or import a wallet seed phrase
   * For authenticated users, saves the current wallet to history before creating new one
   * @param userId - The user ID
   * @param mode - Either 'random' to generate or 'mnemonic' to import
   * @param mnemonic - The mnemonic phrase (required if mode is 'mnemonic')
   * @param saveHistory - Whether to save current wallet to history (default: true for authenticated users)
   */
  async createOrImportSeed(
    userId: string,
    mode: 'random' | 'mnemonic',
    mnemonic?: string,
    saveHistory: boolean = true,
  ): Promise<void> {
    // For authenticated users (non-temp IDs), save current wallet to history
    const isAuthenticatedUser = !userId.startsWith('temp-');

    if (saveHistory && isAuthenticatedUser) {
      try {
        // Check if user has an existing seed to save
        const hasSeed = await this.seedManager.hasSeed(userId);
        if (hasSeed) {
          const currentSeed = await this.seedManager.getSeed(userId);
          await this.walletHistoryRepository.saveToHistory(userId, currentSeed);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to save wallet history: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        // Continue even if history save fails
      }
    }

    // Clear any cached addresses since a new seed means new addresses
    await this.addressManager.clearAddressCache(userId);

    // Use the SeedManager for all seed operations
    return this.seedManager.createOrImportSeed(userId, mode, mnemonic);
  }

  /**
   * Get wallet history for authenticated users
   * @param userId - The user ID
   */
  async getWalletHistory(userId: string) {
    return this.walletHistoryRepository.getWalletHistory(userId);
  }

  /**
   * Switch to a different wallet from history
   * @param userId - The user ID
   * @param walletId - The wallet history entry ID to switch to
   */
  async switchWallet(userId: string, walletId: string): Promise<boolean> {
    // Get the seed from history
    const seedPhrase = await this.walletHistoryRepository.getSeedFromHistory(
      walletId,
      userId,
    );

    if (!seedPhrase) {
      this.logger.error(`Wallet ${walletId} not found for user ${userId}`);
      return false;
    }

    // Save current wallet to history first (don't save again if switching)
    const hasSeed = await this.seedManager.hasSeed(userId);
    if (hasSeed) {
      const currentSeed = await this.seedManager.getSeed(userId);
      // Only save if it's different from the one we're switching to
      if (currentSeed !== seedPhrase) {
        const existsInHistory =
          await this.walletHistoryRepository.hasSeedInHistory(
            userId,
            currentSeed,
          );

        if (!existsInHistory) {
          await this.walletHistoryRepository.saveToHistory(userId, currentSeed);
        }
      }
    }

    // Clear address cache
    await this.addressManager.clearAddressCache(userId);

    // Import the selected wallet's seed
    await this.seedManager.createOrImportSeed(userId, 'mnemonic', seedPhrase);

    // Set this wallet as active
    await this.walletHistoryRepository.setActiveWallet(walletId, userId);

    return true;
  }

  /**
   * Delete a wallet from history
   * @param userId - The user ID
   * @param walletId - The wallet history entry ID to delete
   */
  async deleteWalletHistory(
    userId: string,
    walletId: string,
  ): Promise<boolean> {
    return this.walletHistoryRepository.deleteWallet(walletId, userId);
  }
}
