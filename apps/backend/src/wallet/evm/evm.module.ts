import { Module, forwardRef } from '@nestjs/common';
// Import dependencies - use forwardRef to avoid circular dependency
import { WalletModule } from '../wallet.module.js';

/**
 * EVM Module
 *
 * EVM-specific functionality (WalletConnect moved to dedicated walletconnect module)
 */
@Module({
  imports: [forwardRef(() => WalletModule)], // Import to get AddressManager, SeedManager, etc.
  controllers: [],
  providers: [],
  exports: [],
})
export class EvmModule {}
