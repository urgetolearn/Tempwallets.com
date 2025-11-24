# Wallet Order & Default Selection - Fixed! ✅

## Problem Summary

**Issue:** When the dashboard page loads, it was showing the **Ethereum EOA wallet** instead of the **Ethereum Smart Account (ERC-4337)**.

**Root Cause:** The `DEFAULT_CHAIN` in `chains.ts` was pointing to the old EOA wallet (`'ethereum'`) instead of the new smart account (`'ethereumErc4337'`).

---

## Files Involved

### 1. **`/apps/web/lib/chains.ts`** ⭐ (Fixed)
- **Purpose:** Defines legacy chain configurations and `DEFAULT_CHAIN`
- **What Changed:** Updated `DEFAULT_CHAIN` to use `'ethereumErc4337'` instead of `chains[0]` (old EOA)
- **Impact:** This sets the initial selected wallet when page loads

### 2. **`/apps/web/components/dashboard/wallet-info.tsx`**
- **Purpose:** Main wallet display component
- **What It Does:** 
  - Uses `useState(DEFAULT_CHAIN.id)` to set initial `selectedChainId`
  - Calls `getWalletByChainType(selectedChain.type)` to get current wallet
  - Manages wallet loading, copying, WalletConnect, etc.
- **Updated:** Now uses `useWalletV2` instead of old `useWallet` hook

### 3. **`/apps/web/components/dashboard/chain-selector.tsx`** ⭐
- **Purpose:** Displays the horizontal scrollable list of chain icons
- **What It Does:**
  - Calls `walletConfig.getVisible()` to get visible chains
  - Renders icons in priority order (lowest priority number first)
  - Handles chain selection via `onChainChange(chain.id)`
- **Order:** Automatically sorted by `priority` field from wallet config

### 4. **`/apps/web/lib/wallet-config.ts`** ⭐
- **Purpose:** Master configuration for all 23+ wallets
- **Priority Order:**
  - **1-5:** EVM Smart Accounts (Primary) - Shown first
  - **6-9:** Non-EVM (Bitcoin, Polkadot, Solana, Tron)
  - **50-52:** Substrate Parachains (Advanced only)
  - **100-104:** EOA Wallets (Hidden by default)
  - **200-205:** Testnets (Dev only)
- **Function:** `getVisibleWalletConfigs()` filters and sorts by priority

### 5. **`/apps/web/hooks/useWalletConfig.ts`**
- **Purpose:** React hook wrapper for wallet config
- **Returns:** Helper functions to access wallet configurations
- **Key Method:** `getVisible()` → returns visible chains sorted by priority

### 6. **`/apps/web/hooks/useWalletV2.ts`**
- **Purpose:** Unified wallet hook with streaming support
- **Replaces:** Old `useWallet` hook
- **Features:** Progressive loading, per-wallet states, backward compatible

---

## Current Display Order

### In Production (what users see):
1. **Ethereum** (Smart Account) - Priority 1 ✅ DEFAULT
2. **Base** (Smart Account) - Priority 2
3. **Arbitrum** (Smart Account) - Priority 3
4. **Polygon** (Smart Account) - Priority 4
5. **Avalanche** (Smart Account) - Priority 5
6. **Bitcoin** - Priority 6
7. **Polkadot** - Priority 7
8. **Solana** - Priority 8
9. **Tron** - Priority 9

### Hidden (not shown in selector):
- Ethereum EOA (Priority 100)
- Base EOA (Priority 101)
- Arbitrum EOA (Priority 102)
- Polygon EOA (Priority 103)
- Avalanche EOA (Priority 104)
- All testnets (Priority 200+)
- Advanced parachains (Priority 50+, unless advanced mode enabled)

---

## How to Change the Order

### Option 1: Change Individual Priorities
Edit `/apps/web/lib/wallet-config.ts` and modify the `priority` field:

```typescript
{
  id: 'bitcoin',
  name: 'Bitcoin',
  // Change this number to move Bitcoin higher/lower
  priority: 6, // Lower number = shown first
  // ...
}
```

**Example:** To show Bitcoin before Ethereum:
- Change Bitcoin priority from `6` to `0`
- Bitcoin will now appear first in the list

### Option 2: Reorder the Array
The array order in `WALLET_CONFIGS` doesn't matter - only the `priority` field matters. The system automatically sorts by priority in `getVisibleWalletConfigs()`.

### Option 3: Change Default Wallet
Edit `/apps/web/lib/chains.ts`:

```typescript
export const DEFAULT_CHAIN: Chain = {
  id: 'bitcoin', // Change this to any valid wallet config ID
  name: 'Bitcoin',
  symbol: 'BTC',
  // ...
};
```

---

## How the Selection Flow Works

```
User opens page
    ↓
wallet-info.tsx initializes
    ↓
useState(DEFAULT_CHAIN.id) 
    → selectedChainId = 'ethereumErc4337'
    ↓
getById('ethereumErc4337')
    → Returns Ethereum Smart Account config
    ↓
getWalletByChainType('evm')
    → Returns EVM wallet address
    ↓
WalletCard displays: "Ethereum Wallet" + address
    ↓
ChainSelector shows icons (sorted by priority)
    → Ethereum icon has green dot (selected)
    ↓
User clicks different icon
    → onChainChange(newChainId)
    → selectedChainId updates
    → WalletCard re-renders with new wallet
```

---

## Priority Ranges Explained

| Priority Range | Category | Visibility | Purpose |
|---------------|----------|------------|---------|
| **1-5** | EVM Smart Accounts | ✅ Always visible | Primary wallets for users |
| **6-9** | Non-EVM Chains | ✅ Always visible | Bitcoin, Polkadot, Solana, Tron |
| **50-59** | Substrate Parachains | 🔒 Advanced only | Hydration, Bifrost, Unique |
| **100-104** | EOA Wallets | ❌ Hidden | Legacy standard wallets |
| **200+** | Testnets | 🧪 Dev only | Testing environments |

---

## Testing Checklist

After changing the order, verify:

- [ ] Page loads with correct default wallet (Ethereum Smart Account)
- [ ] Chain icons appear in correct order in selector
- [ ] Clicking an icon changes the displayed wallet
- [ ] Green dot shows on selected icon
- [ ] Wallet address updates when switching chains
- [ ] No console errors about missing configs
- [ ] Icons are visible with correct colors

---

## Common Issues & Solutions

### Issue: "Wallet not found"
**Cause:** `selectedChainId` doesn't match any wallet config ID  
**Fix:** Ensure `DEFAULT_CHAIN.id` matches a valid `WALLET_CONFIGS` entry

### Issue: "Wrong wallet showing"
**Cause:** `getWalletByChainType()` returns wrong wallet for that type  
**Fix:** Check that the wallet's `type` field matches the chain's `type`

### Issue: "Icons not visible"
**Cause:** Icons need explicit color styling  
**Fix:** Already fixed in chain-selector.tsx with `style={{ color: chain.color }}`

### Issue: "Order is wrong"
**Cause:** Priority numbers are not sequential  
**Fix:** Update `priority` fields in wallet-config.ts and reload page

---

## Summary of Changes Made

✅ **Updated `chains.ts`:** Changed `DEFAULT_CHAIN` from EOA to Smart Account  
✅ **Updated `wallet-info.tsx`:** Now uses `useWalletV2` instead of old hook  
✅ **Updated `wallet-card.tsx`:** Imports from `useWalletV2`  
✅ **Fixed `wallet-config.ts`:** Fixed `getVisibleWalletConfigs()` filter logic  
✅ **Fixed `chain-selector.tsx`:** Added icon color styling  

**Result:** 
- ✅ Ethereum Smart Account shows by default
- ✅ Icons display in correct priority order
- ✅ Icons are visible with brand colors
- ✅ All hooks use new streaming architecture

---

## Next Steps

If you want to customize further:

1. **Change default wallet:** Edit `DEFAULT_CHAIN` in `chains.ts`
2. **Reorder icons:** Change `priority` values in `wallet-config.ts`
3. **Hide/show wallets:** Toggle `features.showInSelector` in configs
4. **Add new wallet:** Add entry to `WALLET_CONFIGS` with appropriate priority

---

**Everything is now working correctly! The Ethereum Smart Account (ERC-4337) shows first and is selected by default.** 🎉
