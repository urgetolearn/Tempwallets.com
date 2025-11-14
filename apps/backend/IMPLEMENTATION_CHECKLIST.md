# Wallet Service Refactoring - Implementation Checklist

## ✅ Completed Tasks

### 1. Modular Directory Structure
- [x] Created `interfaces/` directory
- [x] Created `types/` directory  
- [x] Created `config/` directory
- [x] Created `factories/` directory
- [x] Created `managers/` directory
- [x] Created `utils/` directory

### 2. Type Definitions & Interfaces
- [x] `types/chain.types.ts` - Chain types and configs
- [x] `types/account.types.ts` - Account interfaces
- [x] `interfaces/wallet.interfaces.ts` - Service interfaces

### 3. Configuration Modules
- [x] `config/chain.config.ts` - EVM chain configurations
- [x] `config/pimlico.config.ts` - Pimlico ERC-4337 configurations

### 4. Utility Modules
- [x] `utils/conversion.utils.ts` - Amount conversion functions
- [x] `utils/validation.utils.ts` - Input validation functions

### 5. Managers
- [x] `managers/seed.manager.ts` - Mnemonic management
- [x] `managers/address.manager.ts` - Address generation

### 6. Factories
- [x] `factories/account.factory.ts` - EOA account creation (Tether WDK)
- [x] `factories/pimlico-account.factory.ts` - ERC-4337 account creation (Pimlico)

### 7. Dependencies
- [x] Updated `package.json`:
  - Removed: `@tetherto/wdk-wallet-evm-erc-4337`
  - Added: `viem` (v2.21.45)
  - Added: `permissionless` (v0.2.10)

### 8. Documentation
- [x] `REFACTORING_SUMMARY.md` - Complete refactoring overview
- [x] `SETUP_GUIDE.md` - Setup and usage guide
- [x] `IMPLEMENTATION_CHECKLIST.md` - This checklist

---

## 🚧 Remaining Tasks

### Phase 1: Complete Managers (High Priority)

#### Balance Manager
- [ ] Create `managers/balance.manager.ts`
- [ ] Extract balance fetching logic from `wallet.service.ts`
- [ ] Implement caching strategy
- [ ] Support both EOA and ERC-4337 accounts
- [ ] Integration with Zerion API

#### Transaction Manager  
- [ ] Create `managers/transaction.manager.ts`
- [ ] Extract transaction send logic
- [ ] Extract transaction signing logic
- [ ] Handle both EOA and ERC-4337 transactions
- [ ] Implement proper error handling

### Phase 2: Refactor Main Service (High Priority)

#### Update wallet.service.ts
- [ ] Inject new managers (SeedManager, AddressManager, BalanceManager, TransactionManager)
- [ ] Replace monolithic methods with manager calls
- [ ] Remove Tether ERC-4337 configuration code
- [ ] Update WDK instance creation to use ChainConfigService
- [ ] Maintain backward compatibility for existing API

#### Update wallet.module.ts
- [ ] Register ChainConfigService
- [ ] Register PimlicoConfigService
- [ ] Register AccountFactory
- [ ] Register PimlicoAccountFactory
- [ ] Register SeedManager
- [ ] Register AddressManager
- [ ] Register BalanceManager (when created)
- [ ] Register TransactionManager (when created)

### Phase 3: Installation & Testing (Critical)

#### Install Dependencies
- [ ] Run `pnpm install` in `apps/backend`
- [ ] Verify `viem` and `permissionless` are installed
- [ ] Check for any peer dependency warnings

#### Environment Configuration
- [ ] Add `PIMLICO_API_KEY` to `.env`
- [ ] Verify all RPC URLs are configured
- [ ] Test configuration loading

#### Compilation
- [ ] Run `pnpm build`
- [ ] Fix any TypeScript errors
- [ ] Resolve import path issues
- [ ] Ensure all types are correct

#### Testing
- [ ] Test mnemonic generation
- [ ] Test mnemonic import
- [ ] Test EOA address generation (all chains)
- [ ] Test ERC-4337 address generation (Ethereum, Base, Arbitrum, Polygon)
- [ ] Test balance fetching
- [ ] Test transaction sending (EOA)
- [ ] Test transaction sending (ERC-4337)
- [ ] Test gas sponsorship (paymaster)

### Phase 4: Code Quality & Documentation (Medium Priority)

#### Unit Tests
- [ ] Write tests for `SeedManager`
- [ ] Write tests for `AddressManager`
- [ ] Write tests for `AccountFactory`
- [ ] Write tests for `PimlicoAccountFactory`
- [ ] Write tests for utility functions

#### Integration Tests
- [ ] End-to-end wallet creation flow
- [ ] Multi-chain address generation
- [ ] Transaction lifecycle tests
- [ ] Error handling tests

#### Documentation
- [ ] API documentation for new managers
- [ ] Code comments and JSDoc
- [ ] Update README if needed
- [ ] Migration guide for existing users

### Phase 5: Production Readiness (Low Priority)

#### Performance
- [ ] Profile address generation performance
- [ ] Optimize caching strategies
- [ ] Benchmark ERC-4337 vs EOA transaction times

#### Monitoring
- [ ] Add logging for Pimlico API calls
- [ ] Monitor bundler success rates
- [ ] Track paymaster usage
- [ ] Alert on failures

#### Security
- [ ] Audit seed phrase storage
- [ ] Review private key handling
- [ ] Validate all user inputs
- [ ] Rate limiting on wallet creation

---

## 📋 Next Immediate Steps

1. **Install Dependencies** (5 mins)
   ```bash
   cd apps/backend
   pnpm install
   ```

2. **Add Environment Variable** (2 mins)
   - Get Pimlico API key from https://dashboard.pimlico.io/
   - Add to `.env`: `PIMLICO_API_KEY=your_key_here`

3. **Update wallet.module.ts** (10 mins)
   - Import and register all new services
   - See SETUP_GUIDE.md for complete example

4. **Test Compilation** (5 mins)
   ```bash
   pnpm build
   ```
   - Fix any import errors
   - Resolve type mismatches

5. **Test Basic Functionality** (15 mins)
   - Start the server: `pnpm dev`
   - Create a test wallet
   - Verify addresses are generated
   - Check logs for any errors

6. **Create Balance Manager** (30 mins)
   - Extract logic from wallet.service.ts
   - Implement similar to AddressManager pattern
   - Add proper error handling

7. **Create Transaction Manager** (30 mins)
   - Extract transaction logic
   - Handle both account types
   - Integrate with Pimlico for ERC-4337

8. **Refactor wallet.service.ts** (1 hour)
   - Use new managers
   - Remove duplicate code
   - Simplify orchestration layer

---

## 🎯 Success Criteria

The refactoring is complete when:

- ✅ All dependencies installed without errors
- ✅ TypeScript compiles without errors
- ✅ All tests pass
- ✅ EOA wallets work on all chains (Ethereum, Base, Arbitrum, Polygon, Tron, Bitcoin, Solana)
- ✅ ERC-4337 wallets work on EVM chains (Ethereum, Base, Arbitrum, Polygon)
- ✅ Same mnemonic generates expected addresses
- ✅ Transactions can be sent successfully
- ✅ Gas sponsorship works (with Pimlico paymaster)
- ✅ No Tether ERC-4337 dependencies remain
- ✅ Code is modular and maintainable
- ✅ Documentation is complete

---

## 🆘 Support

If you encounter issues:

1. Check `SETUP_GUIDE.md` for common problems
2. Review `REFACTORING_SUMMARY.md` for architecture details
3. Check TypeScript errors carefully - most are import path issues
4. Verify environment variables are set correctly
5. Test with Pimlico testnet first before mainnet

---

## 📝 Notes

- **Backward Compatibility**: Existing EOA addresses will remain the same
- **ERC-4337 Addresses**: May differ from previous Tether WDK implementation
- **Migration**: Existing smart account users may need address updates
- **Testing**: Always test on testnet first (Sepolia, Base Sepolia, etc.)
