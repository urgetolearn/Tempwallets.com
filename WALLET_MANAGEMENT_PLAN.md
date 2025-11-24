# Wallet Management Simplification Plan

## Overview

The backend creates **27+ wallet addresses** across multiple chains. Currently, the frontend doesn't have a centralized way to manage which wallets to show, their capabilities, or their visibility. This plan creates a unified configuration system for managing all wallets.

---

## Current Backend Wallet Output

Based on the backend logs, these wallets are being created:

### EVM Chains (Standard EOA)
1. `ethereum` - 0x4d50...98AB
2. `base` - 0x4d50...98AB (same as Ethereum)
3. `arbitrum` - 0x4d50...98AB (same)
4. `polygon` - 0x4d50...98AB (same)
5. `avalanche` - 0x4d50...98AB (same)
6. `moonbeamTestnet` - 0x4d50...98AB (TESTNET)
7. `astarShibuya` - 0x4d50...98AB (TESTNET)
8. `paseoPassetHub` - 0x4d50...98AB (TESTNET)

### EVM Chains (ERC-4337 Smart Accounts)
9. `ethereumErc4337` - 0x9ACD...75AF
10. `baseErc4337` - 0x9ACD...75AF
11. `arbitrumErc4337` - 0x9ACD...75AF
12. `polygonErc4337` - 0x9ACD...75AF
13. `avalancheErc4337` - 0x9ACD...75AF

### Substrate/Polkadot Chains
14. `polkadot` - 15w6Y5...wdNa (MAINNET)
15. `hydration` - null (not available)
16. `hydrationSubstrate` - 7NXepa...fuX6 (MAINNET)
17. `bifrost` - null (not available)
18. `bifrostSubstrate` - gf462L...diqS (MAINNET)
19. `unique` - null (not available)
20. `uniqueSubstrate` - nSiM1t...uqSC (MAINNET)
21. `paseo` - 5GzoPj...mKAE (TESTNET)
22. `paseoAssethub` - 15w6Y5...wdNa (TESTNET)
23. `bifrostTestnet` - null (TESTNET)

### Other Chains
24. `tron` - TCjqi9...jh1R
25. `bitcoin` - 1Ctd6B...SQjG
26. `solana` - HZHoDp...cQh3

---

## Problems to Solve

1. **No centralized wallet configuration** - Frontend doesn't know which wallets exist or their capabilities
2. **No visibility control** - Can't easily show/hide testnets or specific chains
3. **No capability flags** - Don't know which wallets support WalletConnect, send, receive, balance fetching
4. **No streaming support** - All wallets load at once, blocking each other
5. **Backend/Frontend mismatch** - Backend returns many wallets, frontend only configured for 9
6. **No testnet filtering** - Can't easily toggle testnets on/off
7. **Duplicate addresses** - EVM chains share same address, need smart grouping
8. **Balance fetching unclear** - Don't know which chains support balance API
9. **Transaction history unclear** - Don't know which chains have transaction support

---

## Proposed Solution

### Phase 1: Wallet Configuration Registry ✅

Create a single source of truth for all wallet configurations.

**File:** `/apps/web/lib/wallet-config.ts`

**What it contains:**
```typescript
interface WalletConfig {
  // Identity
  id: string;                    // Backend key (e.g., 'ethereum', 'polkadot')
  name: string;                  // Display name (e.g., 'Ethereum')
  symbol: string;                // Token symbol (e.g., 'ETH')
  
  // Chain properties
  type: ChainType;               // 'evm' | 'substrate' | 'bitcoin' | 'solana'
  chainId?: number;              // EVM chain ID
  isTestnet: boolean;            // Testnet vs mainnet
  
  // UI configuration
  visible: boolean;              // Show in UI by default
  icon: React.ComponentType;     // Chain icon
  priority: number;              // Display order (lower = first)
  
  // Capabilities
  capabilities: {
    walletConnect: boolean;      // Supports WalletConnect
    send: boolean;               // Can send transactions
    receive: boolean;            // Can receive (show QR)
    copy: boolean;               // Can copy address
    balanceFetch: boolean;       // Can fetch balance
    transactionHistory: boolean; // Can fetch transactions
    nativeToken: boolean;        // Has native token balance
  };
  
  // Feature flags
  features: {
    showInSelector: boolean;     // Show in chain selector
    showInWalletList: boolean;   // Show in wallet list
    enabledInProd: boolean;      // Enabled in production
    enabledInDev: boolean;       // Enabled in development
  };
  
  // Grouping
  group?: string;                // Group similar chains (e.g., 'evm-standard')
  parentChain?: string;          // Parent chain if this is L2/parachain
}
```

**Checklist:**
- [ ] Create `wallet-config.ts` with interface definitions
- [ ] Define all 26+ wallet configurations from backend
- [ ] Add icon imports for each chain
- [ ] Set default capabilities for each wallet type
- [ ] Set visibility flags (hide testnets by default)
- [ ] Add priority/ordering for display
- [ ] Add grouping (EVM standard, EVM smart accounts, Substrate, etc.)

---

### Phase 2: Wallet Data Streaming ✅

Implement progressive/streaming wallet data loading so wallets don't block each other.

**File:** `/apps/web/hooks/useStreamingWallets.ts`

**What it does:**
- Fetches wallet addresses progressively
- Each wallet loads independently via SSE/streaming
- Updates UI as soon as each wallet is ready
- Shows loading state per wallet, not global

**Checklist:**
- [ ] Create `useStreamingWallets` hook
- [ ] Implement SSE streaming for wallet addresses
- [ ] Add per-wallet loading states
- [ ] Add error handling per wallet
- [ ] Cache successfully loaded wallets
- [ ] Support retry for failed wallets
- [ ] Emit events when wallet becomes available

---

### Phase 3: Balance Streaming ✅

Stream balance data independently for each wallet.

**File:** `/apps/web/hooks/useStreamingBalances.ts`

**What it does:**
- Fetches balances for each wallet independently
- Updates UI as soon as balance is available
- Supports different balance APIs per chain type
- Handles rate limiting and errors gracefully

**Checklist:**
- [ ] Create `useStreamingBalances` hook
- [ ] Implement SSE streaming for balances
- [ ] Add per-wallet balance states (loading, success, error)
- [ ] Support multiple balance providers (Zerion, RPC, etc.)
- [ ] Add balance caching with TTL
- [ ] Handle rate limiting per provider
- [ ] Support token balances (not just native)

---

### Phase 4: Transaction Streaming ✅

Stream transaction history independently for each wallet.

**File:** `/apps/web/hooks/useStreamingTransactions.ts`

**What it does:**
- Fetches transaction history per wallet
- Streams transactions as they're found
- Aggregates transactions from multiple chains
- Supports pagination and filtering

**Checklist:**
- [ ] Create `useStreamingTransactions` hook
- [ ] Implement SSE streaming for transactions
- [ ] Add per-wallet transaction states
- [ ] Support transaction pagination
- [ ] Add transaction caching
- [ ] Handle different transaction formats per chain
- [ ] Aggregate multi-chain transactions with proper sorting

---

### Phase 5: Unified Wallet Manager ✅

Create a central manager that orchestrates everything.

**File:** `/apps/web/lib/wallet-manager.ts`

**What it does:**
- Central orchestrator for all wallet operations
- Manages wallet config, streaming, balances, transactions
- Provides unified API for components
- Handles dev/prod environment switching

**Checklist:**
- [ ] Create `WalletManager` class
- [ ] Integrate wallet config registry
- [ ] Integrate streaming hooks
- [ ] Add environment-aware filtering (dev/prod)
- [ ] Add testnet toggle functionality
- [ ] Provide unified API for components
- [ ] Add event emitter for wallet state changes

---

### Phase 6: Component Integration ✅

Update existing components to use new wallet management system.

**Files to update:**
- `/apps/web/components/dashboard/wallet-info.tsx`
- `/apps/web/components/dashboard/chain-selector.tsx`
- `/apps/web/components/dashboard/wallet-card.tsx`
- `/apps/web/hooks/useWallet.ts` (migrate or deprecate)

**Checklist:**
- [ ] Update `chain-selector.tsx` to use wallet config
- [ ] Update `wallet-card.tsx` to show per-wallet loading
- [ ] Update `wallet-info.tsx` to use streaming data
- [ ] Add testnet toggle UI component
- [ ] Add dev mode indicator
- [ ] Migrate existing components gradually
- [ ] Add backward compatibility layer

---

### Phase 7: Developer Experience ✅

Add tools for developers to manage wallets easily.

**Features:**
- Dev panel to toggle testnets
- Dev panel to enable/disable specific chains
- Wallet capability inspector
- Balance/transaction debugging tools

**Checklist:**
- [ ] Create dev panel component (only in dev mode)
- [ ] Add testnet toggle switch
- [ ] Add individual chain enable/disable switches
- [ ] Add wallet capability inspector
- [ ] Add balance fetching debugger
- [ ] Add transaction streaming debugger
- [ ] Persist dev settings in localStorage

---

## Implementation Strategy

### Option A: Progressive Implementation (Recommended)
Implement in phases, keeping existing code working.

**Timeline:** 3-5 sessions
- **Session 1:** Phase 1 (Wallet Config Registry)
- **Session 2:** Phase 2 (Wallet Streaming)
- **Session 3:** Phase 3-4 (Balance & Transaction Streaming)
- **Session 4:** Phase 5 (Unified Manager)
- **Session 5:** Phase 6-7 (Component Integration + Dev Tools)

**Pros:**
- Less risky, can test each phase
- Existing functionality keeps working
- Can rollback individual phases
- Learn and adapt as we go

**Cons:**
- Takes longer
- Temporary duplicate code

### Option B: Complete Rewrite
Rewrite entire wallet system at once.

**Timeline:** 1-2 intensive sessions

**Pros:**
- Clean slate, no legacy code
- Consistent architecture from start
- Faster if everything works

**Cons:**
- High risk, everything breaks if mistake
- Hard to debug
- Can't test incrementally

---

## Configuration Example

Here's how the new system would look in practice:

### Wallet Config (Simplified)
```typescript
const WALLET_CONFIG: WalletConfig[] = [
  {
    id: 'ethereum',
    name: 'Ethereum',
    symbol: 'ETH',
    type: 'evm',
    chainId: 1,
    isTestnet: false,
    visible: true,
    icon: EthereumIcon,
    priority: 1,
    capabilities: {
      walletConnect: true,
      send: true,
      receive: true,
      copy: true,
      balanceFetch: true,
      transactionHistory: true,
      nativeToken: true,
    },
    features: {
      showInSelector: true,
      showInWalletList: true,
      enabledInProd: true,
      enabledInDev: true,
    },
    group: 'evm-standard',
  },
  {
    id: 'moonbeamTestnet',
    name: 'Moonbeam Testnet',
    symbol: 'DEV',
    type: 'evm',
    chainId: 1287,
    isTestnet: true,
    visible: false, // Hidden by default
    icon: MoonbeamIcon,
    priority: 100,
    capabilities: {
      walletConnect: true,
      send: true,
      receive: true,
      copy: true,
      balanceFetch: true,
      transactionHistory: false, // RPC timeout issues
      nativeToken: true,
    },
    features: {
      showInSelector: false, // Don't show in main selector
      showInWalletList: true, // Show in full list if testnets enabled
      enabledInProd: false,
      enabledInDev: true,
    },
    group: 'evm-testnet',
    parentChain: 'moonbeam',
  },
  // ... 24+ more configurations
];
```

### Usage in Components
```typescript
// Before (manual, error-prone)
const chains = [
  { id: 'ethereum', name: 'Ethereum', ... },
  { id: 'bitcoin', name: 'Bitcoin', ... },
];

// After (automatic, type-safe)
const walletManager = useWalletManager();
const visibleWallets = walletManager.getVisibleWallets(); // Auto-filtered
const evmWallets = walletManager.getWalletsByType('evm');
const mainnetOnly = walletManager.getMainnetWallets();
```

---

## Benefits After Implementation

### For Developers
1. **Single source of truth** - One file to manage all wallet configs
2. **Type safety** - TypeScript ensures all properties are set correctly
3. **Easy testnet toggle** - One flag to show/hide all testnets
4. **Dev mode tools** - Built-in debugging and testing utilities
5. **No more manual syncing** - Backend changes automatically reflected

### For Performance
1. **Streaming data** - Wallets load independently, UI updates progressively
2. **No blocking** - Slow chains don't block fast chains
3. **Intelligent caching** - Reduce API calls
4. **Lazy loading** - Only fetch data for visible wallets

### For Users
1. **Faster load times** - See wallets as soon as they're ready
2. **Better UX** - Per-wallet loading states
3. **Cleaner UI** - Only show relevant wallets
4. **More reliable** - Failed wallets don't break others

### For Maintenance
1. **Easy to add chains** - Just add config object
2. **Easy to disable chains** - Change one flag
3. **Easy to update capabilities** - Centralized config
4. **Easy to debug** - Dev tools built-in

---

## Configuration Management Examples

### Show Only Production Wallets
```typescript
const prodWallets = walletManager.getWallets({
  enabledInProd: true,
  isTestnet: false,
});
```

### Enable Testnets in Dev Mode
```typescript
const devWallets = walletManager.getWallets({
  enabledInDev: true,
  includeTestnets: isDevelopment,
});
```

### Get Wallets with WalletConnect
```typescript
const wcWallets = walletManager.getWallets({
  capabilities: { walletConnect: true },
});
```

### Get Wallets with Balance Support
```typescript
const balanceWallets = walletManager.getWallets({
  capabilities: { balanceFetch: true },
});
```

---

## Migration Path

### Step 1: Add New System (Non-Breaking)
- Create new files alongside existing code
- Don't touch existing components yet
- Test new system independently

### Step 2: Parallel Run (Testing)
- Run both old and new systems
- Compare outputs
- Fix discrepancies

### Step 3: Gradual Migration (Safe)
- Migrate one component at a time
- Keep old code as fallback
- Test each migration thoroughly

### Step 4: Cleanup (Final)
- Remove old code
- Update documentation
- Celebrate! 🎉

---

## Questions to Answer Before Starting

1. **Do you want to show testnets in production?**
   - Recommendation: No, only in dev mode

2. **Should EVM smart accounts (ERC-4337) be separate wallets or grouped?**
   - Recommendation: Show the EVM smart contracts as the Ethereum main chains and donot show the EOAs in the UI

3. **Do you want users to toggle testnets from UI?**
   - Recommendation: Yes, add toggle in settings/dev panel

4. **Should we show all 26+ wallets or curate the list?**
   - Recommendation: Curate main list, show all in "Advanced" view

5. **Do you want balance fetching for all chains or only featured ones?**
   - Recommendation: All chains, but prioritize featured ones

6. **Should streaming be opt-in or default?**
   - Recommendation: Default, much better UX

7. **Do you want to keep backward compatibility with current useWallet hook?**
   - Recommendation: Yes, for gradual migration

---

## File Structure After Implementation

```
apps/web/
├── lib/
│   ├── wallet-config.ts          ← NEW: Master config
│   ├── wallet-manager.ts         ← NEW: Central orchestrator
│   ├── chains.ts                 ← KEEP: For now (backward compat)
│   └── api.ts                    ← UPDATE: Add streaming methods
├── hooks/
│   ├── useWalletManager.ts       ← NEW: Main hook
│   ├── useStreamingWallets.ts    ← NEW: Wallet streaming
│   ├── useStreamingBalances.ts   ← NEW: Balance streaming
│   ├── useStreamingTransactions.ts ← NEW: Transaction streaming
│   └── useWallet.ts              ← DEPRECATED: Keep for migration
├── components/
│   ├── dashboard/
│   │   ├── wallet-info.tsx       ← UPDATE: Use new hooks
│   │   ├── chain-selector.tsx    ← UPDATE: Use config
│   │   ├── wallet-card.tsx       ← UPDATE: Per-wallet loading
│   │   └── dev-panel.tsx         ← NEW: Dev tools
└── types/
    └── wallet.types.ts           ← NEW: Shared types
```

---

## Success Metrics

After implementation, we should achieve:

- ✅ **Single configuration file** managing all 26+ wallets
- ✅ **Streaming data** - wallets load independently
- ✅ **Testnet toggle** - One click to show/hide testnets
- ✅ **Dev mode tools** - Built-in debugging capabilities
- ✅ **Type safety** - No more manual config mismatches
- ✅ **Better performance** - 50%+ faster initial load
- ✅ **Better UX** - Progressive loading, per-wallet states
- ✅ **Easier maintenance** - Add new chains in minutes

---

## Recommendation

I recommend **Option A: Progressive Implementation** with this priority:

1. **Phase 1 (Session 1):** Wallet Configuration Registry
   - Most impactful, low risk
   - Immediate benefit: Single source of truth
   - No breaking changes

2. **Phase 2 (Session 2):** Wallet Streaming
   - High impact on performance
   - Moderate risk, can fallback
   - Immediate benefit: Faster loading

3. **Phase 3-4 (Session 3):** Balance & Transaction Streaming
   - Nice to have, high UX impact
   - Low risk, independent feature
   - Immediate benefit: Better data loading

4. **Phase 5-6 (Session 4-5):** Manager + Component Integration
   - Ties everything together
   - Moderate risk, but prepared by previous phases
   - Immediate benefit: Complete system

5. **Phase 7 (Session 5):** Dev Tools
   - Quality of life for developers
   - Zero risk, additive feature
   - Immediate benefit: Easier debugging

---

## Next Steps

**If you approve this plan:**
1. I'll start with Phase 1: Create the Wallet Configuration Registry
2. We'll implement it together, testing as we go
3. Each phase can be reviewed before moving to the next
4. You can approve/reject/modify each phase

**Questions?**
- Any specific chains you want to prioritize?
- Any chains you want to hide/disable?
- Should we show smart accounts (ERC-4337) separately?
- Do you want a UI toggle for testnets?

**Ready to start? Let me know!** 🚀
