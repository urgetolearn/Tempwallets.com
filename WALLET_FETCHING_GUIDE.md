# Wallet Fetching Guide

## Recent Changes Summary

### ✅ Completed Changes

1. **Removed wallet name duplication** - No more "EVM Smart Account" appearing twice
2. **Removed chain type badges** - Cleaned up wallet card UI
3. **Fixed Polkadot WalletConnect** - Enabled WalletConnect for Polkadot chain
4. **Fixed wallet card height** - Added `min-h-[200px]` to maintain consistent height
5. **Removed BNB and Optimism chains** - Replaced with Base and Tron
6. **Added Base chain** - Using Ethereum icon as fallback (Base icon not available in package)
7. **Added Tron chain** - Full icon support
8. **Hidden scrollbar** - Added custom CSS utility to hide scrollbar completely
9. **Updated chain configuration** - Now showing: Ethereum, Bitcoin, Polkadot, Solana, Tron, Polygon, Avalanche, Base, Arbitrum

---

## Why Bitcoin, Solana, and Tron Wallets May Not Be Fetching

### Understanding the Wallet Data Flow

Your wallet fetching system follows this flow:

```
Backend API (/wallet/addresses) 
    ↓
Returns UiWalletPayload with:
    - smartAccount (EVM)
    - auxiliary[] (other chains)
        ↓
useWallet Hook processes data
    ↓
Maps categories to chainType using mapWalletCategoryToChainType()
    ↓
Displays in UI via getWalletByChainType()
```

### The Issue: Backend Data Structure

Looking at your `useWallet.ts` hook, wallets are fetched from the backend via:

```typescript
const addresses = await walletApi.getAddresses(userId);
```

This returns a `UiWalletPayload` with:
- `smartAccount`: For EVM addresses
- `auxiliary[]`: For other blockchain addresses

**The Problem:**

For non-EVM wallets (Bitcoin, Solana, Tron) to appear, they must be present in the `auxiliary[]` array with the correct `category` field.

### Checking Your Backend

**1. Verify Backend Returns the Data**

Check your backend API response structure. Run this in your browser console when logged in:

```javascript
// Check what the API returns
fetch('http://localhost:5005/wallet/addresses?userId=YOUR_USER_ID')
  .then(r => r.json())
  .then(data => {
    console.log('Smart Account:', data.smartAccount);
    console.log('Auxiliary Wallets:', data.auxiliary);
  });
```

Expected structure for auxiliary wallets:

```json
{
  "smartAccount": {
    "address": "0x...",
    "label": "EVM Smart Account"
  },
  "auxiliary": [
    {
      "chain": "bitcoin",
      "address": "bc1q...",
      "label": "Bitcoin Wallet",
      "category": "bitcoin"  // ← This is CRUCIAL
    },
    {
      "chain": "solana",
      "address": "...",
      "label": "Solana Wallet",
      "category": "solana"  // ← This is CRUCIAL
    },
    {
      "chain": "tron",
      "address": "T...",
      "label": "Tron Wallet",
      "category": "tron"  // ← This is CRUCIAL
    },
    {
      "chain": "polkadot",
      "address": "1...",
      "label": "Polkadot Wallet",
      "category": "substrate"  // ← This is CRUCIAL for Polkadot
    }
  ]
}
```

**2. Backend Must Generate These Addresses**

Your backend likely has wallet generation logic that:
- Generates EVM addresses (Ethereum, Polygon, Base, etc.) from one seed
- Generates Bitcoin addresses from the same seed (different derivation path)
- Generates Solana addresses from the same seed
- Generates Substrate/Polkadot addresses from SR25519 keys
- Generates Tron addresses

If the backend only generates EVM addresses, you need to add logic to generate other chain addresses.

---

## How the Category Mapping Works

The frontend uses this mapping in `lib/chains.ts`:

```typescript
export const mapWalletCategoryToChainType = (category?: string): ChainType | null => {
  if (!category) return 'evm'; // Default to EVM
  
  switch (category.toLowerCase()) {
    case 'evm':
    case 'ethereum':
      return 'evm';
    case 'bitcoin':
    case 'btc':
      return 'bitcoin';
    case 'substrate':
    case 'polkadot':
    case 'dot':
      return 'substrate';
    case 'solana':
    case 'sol':
    case 'tron':
    case 'trx':
      return 'solana'; // Using 'solana' as generic non-EVM type
    default:
      return null;
  }
};
```

So your backend must return the correct `category` field for each wallet.

---

## Backend Implementation Checklist

To make Bitcoin, Solana, and Tron wallets appear, your backend needs to:

### ✅ 1. Wallet Generation (Backend)

Check your backend's wallet creation/seed generation endpoint:
- File: Likely in `apps/backend/src/wallet/` directory
- Look for: `createOrImportSeed`, `generateAddresses`, or similar methods

**What needs to be added:**

```typescript
// Example backend structure (adjust to your actual code)
async generateAddresses(seed: string, userId: string) {
  // EVM (already working)
  const evmWallet = generateEVMFromSeed(seed);
  
  // Bitcoin (ADD THIS)
  const bitcoinWallet = generateBitcoinFromSeed(seed);
  
  // Solana (ADD THIS)
  const solanaWallet = generateSolanaFromSeed(seed);
  
  // Tron (ADD THIS)
  const tronWallet = generateTronFromSeed(seed);
  
  // Polkadot/Substrate (CHECK IF EXISTS)
  const polkadotWallet = generateSubstrateFromSeed(seed);
  
  return {
    smartAccount: {
      address: evmWallet.address,
      label: 'EVM Smart Account'
    },
    auxiliary: [
      {
        chain: 'bitcoin',
        address: bitcoinWallet.address,
        label: 'Bitcoin Wallet',
        category: 'bitcoin'
      },
      {
        chain: 'solana',
        address: solanaWallet.address,
        label: 'Solana Wallet',
        category: 'solana'
      },
      {
        chain: 'tron',
        address: tronWallet.address,
        label: 'Tron Wallet',
        category: 'tron'
      },
      {
        chain: 'polkadot',
        address: polkadotWallet.address,
        label: 'Polkadot Wallet',
        category: 'substrate'
      }
    ]
  };
}
```

### ✅ 2. Required Backend Libraries

You'll need these npm packages in your backend:

```bash
# Bitcoin
npm install bitcoinjs-lib bip32 bip39

# Solana
npm install @solana/web3.js

# Tron
npm install tronweb

# Polkadot (you might already have this)
npm install @polkadot/keyring @polkadot/util-crypto
```

### ✅ 3. Database Schema

If you're storing addresses in a database, ensure your schema supports:

```sql
-- Example structure
auxiliary_wallets (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR,
  chain VARCHAR,  -- 'bitcoin', 'solana', 'tron', 'polkadot'
  address VARCHAR,
  label VARCHAR,
  category VARCHAR,  -- 'bitcoin', 'solana', 'tron', 'substrate'
  created_at TIMESTAMP
)
```

---

## Testing the Fix

### Step 1: Check Current State

```bash
# In browser console when logged in
const userId = localStorage.getItem('userId');
fetch(`${process.env.NEXT_PUBLIC_API_URL}/wallet/addresses?userId=${userId}`)
  .then(r => r.json())
  .then(data => {
    console.log('Current auxiliary wallets:', data.auxiliary);
    console.log('Bitcoin exists?', data.auxiliary?.some(w => w.category === 'bitcoin'));
    console.log('Solana exists?', data.auxiliary?.some(w => w.category === 'solana'));
    console.log('Tron exists?', data.auxiliary?.some(w => w.category === 'tron'));
  });
```

### Step 2: Force Wallet Regeneration

After updating your backend, you may need to regenerate wallets:

```bash
# Option 1: Use the "Change Wallet" button in the UI
# This triggers: changeWallets(userId) → creates new seed → generates all addresses

# Option 2: Clear cache and reload
localStorage.clear();
location.reload();
```

### Step 3: Verify Frontend Display

1. Open dashboard
2. Click through each chain icon:
   - ✅ Ethereum → Should show EVM address
   - ✅ Bitcoin → Should show Bitcoin address (bc1q...)
   - ✅ Polkadot → Should show Polkadot address (1...)
   - ✅ Solana → Should show Solana address
   - ✅ Tron → Should show Tron address (T...)
   - ✅ Polygon, Base, Arbitrum → Should show same EVM address
   - ✅ Avalanche → Should show same EVM address

---

## Quick Diagnostic Commands

### Check if Backend is Running
```bash
curl http://localhost:5005/health
```

### Check Wallet Endpoint (replace USER_ID)
```bash
curl "http://localhost:5005/wallet/addresses?userId=YOUR_USER_ID" | jq
```

### Check Frontend State
```javascript
// In browser console
console.log('Wallets:', JSON.parse(localStorage.getItem('walletCache-YOUR_USER_ID')));
```

---

## Expected Chain Display Order

After all fixes, chains appear in this order (left to right):

1. **Ethereum** (Featured, EVM, WalletConnect ✓)
2. **Bitcoin** (Featured, Bitcoin, no WalletConnect)
3. **Polkadot** (Featured, Substrate, WalletConnect ✓)
4. **Solana** (Featured, Solana, no WalletConnect)
5. **Tron** (Featured, Tron-type, no WalletConnect)
6. **Polygon** (EVM, WalletConnect ✓)
7. **Avalanche** (EVM, WalletConnect ✓)
8. **Base** (EVM, WalletConnect ✓)
9. **Arbitrum** (EVM, WalletConnect ✓)

---

## UI/UX Improvements Made

### Scrollbar Completely Hidden
- Added `.scrollbar-hide` utility to `packages/ui/src/globals.css`
- Applied to chain selector's overflow container
- Works across all browsers (Chrome, Firefox, Safari, Edge)

### Wallet Card Consistency
- Fixed height: `min-h-[200px]`
- Centered content vertically with `flex items-center justify-center`
- Same height whether wallet exists, is loading, or shows error

### Removed Clutter
- No more duplicate wallet names
- No more chain type badges (EVM, BITCOIN, etc.)
- No more WalletConnect badge in card
- Clean, minimal design showing only: Chain name, wallet address

---

## Common Issues & Solutions

### Issue: "No wallet found for Bitcoin"
**Cause:** Backend not returning Bitcoin address in auxiliary array  
**Fix:** Add Bitcoin generation logic to backend

### Issue: "No wallet found for Solana"
**Cause:** Backend not returning Solana address in auxiliary array  
**Fix:** Add Solana generation logic to backend

### Issue: "No wallet found for Tron"
**Cause:** Backend not returning Tron address in auxiliary array  
**Fix:** Add Tron generation logic to backend

### Issue: WalletConnect button enabled on Bitcoin/Solana
**Cause:** Chain config has `hasWalletConnect: true`  
**Fix:** Already fixed in `lib/chains.ts` - only EVM chains and Polkadot have WalletConnect

### Issue: Scrollbar still visible
**Cause:** Browser cache or CSS not loading  
**Fix:** Hard refresh (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)

---

## Next Steps

1. **Check your backend** - Look for the wallet generation logic
2. **Add missing chain generators** - Bitcoin, Solana, Tron if not present
3. **Test locally** - Use the diagnostic commands above
4. **Force regenerate** - Use "Change Wallet" button to create new addresses
5. **Verify display** - Click through all chain icons to confirm addresses appear

---

## Files Modified in This Update

1. `/apps/web/lib/chains.ts`
   - ✅ Removed BNB Chain and Optimism
   - ✅ Added Base (Layer 2 EVM, chainId: 8453)
   - ✅ Added Tron (using Solana type as generic)
   - ✅ Enabled WalletConnect for Polkadot
   - ✅ Updated category mapping to include Tron

2. `/apps/web/components/dashboard/wallet-card.tsx`
   - ✅ Removed duplicate wallet name display
   - ✅ Removed chain type badges
   - ✅ Added fixed height (`min-h-[200px]`)
   - ✅ Centered content with flexbox
   - ✅ Simplified layout to show only chain name + address

3. `/apps/web/components/dashboard/chain-selector.tsx`
   - ✅ Already had scrollbar-hide class applied
   - ✅ 4 icons visible at a time with proper spacing

4. `/packages/ui/src/globals.css`
   - ✅ Added `.scrollbar-hide` utility
   - ✅ Cross-browser scrollbar hiding support

---

## Support Resources

- **Polkadot Key Generation:** `@polkadot/keyring` docs
- **Bitcoin Address Generation:** `bitcoinjs-lib` examples
- **Solana Wallet Creation:** `@solana/web3.js` Keypair docs
- **Tron Wallet Generation:** `tronweb` utilities

Need more help? Check your backend logs when generating wallets to see if there are any errors during address creation.
