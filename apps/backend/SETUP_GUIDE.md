# Wallet Service Refactoring - Setup Guide

## Quick Start

### 1. Install Dependencies

```bash
cd apps/backend
pnpm install
```

This will install the new dependencies:
- `viem` - Ethereum library
- `permissionless` - ERC-4337 account abstraction

### 2. Environment Configuration

Add to your `.env` file:

```bash
# Required: Pimlico API Key for ERC-4337
PIMLICO_API_KEY=your_pimlico_api_key_here
```

Get your Pimlico API key from: https://dashboard.pimlico.io/

### 3. Update Wallet Module

Update `wallet.module.ts` to register the new services:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Config
import { ChainConfigService } from './config/chain.config.js';
import { PimlicoConfigService } from './config/pimlico.config.js';

// Factories
import { AccountFactory } from './factories/account.factory.js';
import { PimlicoAccountFactory } from './factories/pimlico-account.factory.js';

// Managers
import { SeedManager } from './managers/seed.manager.js';
import { AddressManager } from './managers/address.manager.js';

// Services
import { WalletService } from './wallet.service.js';
import { WalletController } from './wallet.controller.js';
import { SeedRepository } from './seed.repository.js';
import { ZerionService } from './zerion.service.js';

@Module({
  imports: [ConfigModule],
  controllers: [WalletController],
  providers: [
    // Config
    ChainConfigService,
    PimlicoConfigService,
    
    // Factories
    AccountFactory,
    PimlicoAccountFactory,
    
    // Managers
    SeedManager,
    AddressManager,
    
    // Services & Repositories
    WalletService,
    SeedRepository,
    ZerionService,
  ],
  exports: [WalletService],
})
export class WalletModule {}
```

### 4. Compile and Test

```bash
# Compile TypeScript
pnpm build

# Run in development mode
pnpm dev

# Run tests
pnpm test
```

## Architecture Overview

### New Modular Structure

```
┌─────────────────────────────────────────────────────────────┐
│                      Wallet Service                         │
│  (Orchestrates all wallet operations)                       │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Seed Manager │ │Address Mgr   │ │Transaction   │
│              │ │              │ │Manager       │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                │
       │                │                │
       ▼                ▼                ▼
┌─────────────────────────────────────────────────┐
│            Account Factories                    │
├─────────────────────────────────────────────────┤
│ AccountFactory        PimlicoAccountFactory     │
│ (Tether WDK EOA)     (Pimlico ERC-4337)        │
└─────────────────────────────────────────────────┘
       │                        │
       ▼                        ▼
┌──────────────┐        ┌──────────────┐
│  Tether WDK  │        │   Pimlico    │
│  (EOA)       │        │  (ERC-4337)  │
└──────────────┘        └──────────────┘
```

### Account Types

**EOA (Externally Owned Accounts)**
- Uses: Tether WDK
- Chains: All (Ethereum, Base, Arbitrum, Polygon, Tron, Bitcoin, Solana)
- Creation: Instant, no deployment needed

**ERC-4337 (Smart Contract Accounts)**
- Uses: Pimlico + viem + permissionless
- Chains: EVM only (Ethereum, Base, Arbitrum, Polygon)
- Creation: Counterfactual (address computed before deployment)
- Deployment: On first transaction (via bundler)
- Features: Gas sponsorship, batch transactions, account recovery

### Key Components

#### 1. Configuration Services
- `ChainConfigService`: EVM chain RPC configurations
- `PimlicoConfigService`: ERC-4337 bundler/paymaster configurations

#### 2. Factories
- `AccountFactory`: Creates EOA accounts from seed phrase
- `PimlicoAccountFactory`: Creates ERC-4337 smart accounts

#### 3. Managers
- `SeedManager`: Mnemonic creation, validation, storage
- `AddressManager`: Address generation for all chains
- (TODO) `BalanceManager`: Balance fetching and caching
- (TODO) `TransactionManager`: Transaction creation and signing

#### 4. Utilities
- `conversion.utils.ts`: Amount conversions (wei, human-readable)
- `validation.utils.ts`: Input validation (addresses, amounts, mnemonics)

## Usage Examples

### Creating a Wallet

```typescript
// Auto-creates with random mnemonic
const addresses = await walletService.getAddresses(userId);

// Import existing mnemonic
await walletService.createOrImportSeed(
  userId,
  'mnemonic',
  'your twelve word mnemonic phrase here...'
);
```

### Getting Addresses

```typescript
const addresses = await addressManager.getAddresses(userId);

console.log(addresses);
// {
//   ethereum: '0x...',        // EOA
//   base: '0x...',           // EOA
//   arbitrum: '0x...',       // EOA
//   polygon: '0x...',        // EOA
//   ethereumErc4337: '0x...', // Smart Account
//   baseErc4337: '0x...',    // Smart Account
//   arbitrumErc4337: '0x...', // Smart Account
//   polygonErc4337: '0x...',  // Smart Account
//   tron: 'T...',
//   bitcoin: 'bc1...',
//   solana: '...',
// }
```

### Smart Account Features

```typescript
// Create ERC-4337 account
const smartAccount = await pimlicoAccountFactory.createAccount(
  seedPhrase,
  'base',
  0
);

// Get address (before deployment)
const address = await smartAccount.getAddress();

// Check if deployed
const isDeployed = await smartAccount.isDeployed();

// Send transaction (auto-deploys if needed)
const txHash = await smartAccount.send(recipientAddress, amount);
```

## Troubleshooting

### Issue: Missing Pimlico API Key
```
Error: Pimlico API key not configured
```
**Solution**: Add `PIMLICO_API_KEY` to your `.env` file

### Issue: Module not found errors for viem/permissionless
```
Cannot find module 'viem' or its corresponding type declarations
```
**Solution**: Run `pnpm install` to install dependencies

### Issue: ERC-4337 account creation fails
```
Error: Failed to create smart account
```
**Solution**: 
1. Verify Pimlico API key is valid
2. Check RPC URLs are accessible
3. Ensure chain is supported (Ethereum, Base, Arbitrum, Polygon)

### Issue: TypeScript compilation errors
```
Property 'send' is missing in type...
```
**Solution**: The interfaces need to be aligned. This will be resolved when we complete the final refactoring steps.

## Next Development Steps

1. **Complete Balance Manager**: Extract balance fetching logic
2. **Complete Transaction Manager**: Extract transaction logic
3. **Refactor wallet.service.ts**: Use new managers
4. **Add comprehensive tests**: Unit tests for each component
5. **Add integration tests**: End-to-end wallet workflows

## Migration Notes

### Backward Compatibility
✅ **Mnemonics**: Same format, fully compatible
✅ **EOA Addresses**: Unchanged (same HD derivation)
⚠️ **ERC-4337 Addresses**: May differ from Tether WDK implementation
  - Still deterministic from same seed
  - Different factory/implementation = different addresses
  - Consider migration strategy for existing smart accounts

### Production Deployment

Before deploying to production:
1. Test mnemonic import/export
2. Verify address generation matches expected values
3. Test ERC-4337 deployment on testnet first
4. Ensure Pimlico API quotas are sufficient
5. Set up monitoring for bundler/paymaster errors

## Resources

- **Pimlico Docs**: https://docs.pimlico.io/
- **viem Docs**: https://viem.sh/
- **permissionless.js**: https://docs.pimlico.io/permissionless
- **ERC-4337**: https://eips.ethereum.org/EIPS/eip-4337
