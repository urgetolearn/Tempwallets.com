import { Injectable } from '@nestjs/common';
import { AddressManager } from '../managers/address.manager.js';
import {
  UiWalletPayload,
  WalletAddressContext,
  WalletAddresses,
  WalletAddressKey,
} from '../interfaces/wallet.interfaces.js';
import { WalletMapper } from '../mappers/wallet.mapper.js';

@Injectable()
export class WalletAddressService {
  constructor(
    private readonly addressManager: AddressManager,
    private readonly walletMapper: WalletMapper,
  ) {}

  /**
   * Get all wallet addresses for all chains
   * Auto-creates wallet if it doesn't exist
   * @param userId - The user ID
   * @returns Object containing addresses for all chains
   */
  async getAddresses(userId: string): Promise<WalletAddresses> {
    // Use the AddressManager for address operations
    return this.addressManager.getAddresses(userId);
  }

  async getWalletAddressContext(userId: string): Promise<WalletAddressContext> {
    const { addresses, metadata } =
      await this.addressManager.getManagedAddresses(userId);
    const ui = this.walletMapper.buildUiWalletPayload(metadata);
    return {
      internal: addresses,
      metadata,
      ui,
    };
  }

  async getUiWalletAddresses(userId: string): Promise<UiWalletPayload> {
    const context = await this.getWalletAddressContext(userId);
    return context.ui;
  }

  /**
   * Stream addresses progressively (for SSE)
   * Yields addresses as they become available
   */
  async *streamAddresses(
    userId: string,
  ): AsyncGenerator<UiWalletPayload, void, unknown> {
    const collected: Partial<Record<WalletAddressKey, string | null>> = {};

    for await (const { chain, address } of this.addressManager.streamAddresses(
      userId,
    )) {
      const key = chain as WalletAddressKey;
      collected[key] = address;

      if (!this.walletMapper.isVisibleChain(key)) {
        continue;
      }

      const metadata = this.walletMapper.buildMetadataSnapshot(collected);
      const uiPayload = this.walletMapper.buildUiWalletPayload(metadata);
      yield uiPayload;
    }
  }
}
