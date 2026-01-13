# Production Send Error Fix - "gas required exceeds allowance (0)"

**Date:** January 13, 2026  
**Issue:** Native token sends failing in production with "gas required exceeds allowance (0)"  
**Chain:** Base (8453)  
**User:** cmit6j14b005tph2bx2xl9fqc

---

## 🔍 Root Cause Analysis

### The Problem

User tried to send **0.001 ETH** (their entire balance) on Base:
```
Balance:    1000000000000000 wei (0.001 ETH)
Requested:  1000000000000000 wei (0.001 ETH)
Result:     ❌ gas required exceeds allowance (0)
```

### Why It Failed

1. **Production has NO EIP-7702 environment variables set**
   - Local `.env`: `ENABLE_EIP7702=true` and `EIP7702_CHAINS=ethereum,sepolia,base,arbitrum,optimism`
   - Production (Railway): Missing these variables ❌
   
2. **System fell back to regular EOA (Externally Owned Account)**
   - `isEip7702Enabled('base')` returned `false` in production
   - Used `NativeEoaFactory` instead of `Eip7702SmartAccountFactory`
   
3. **EOA tried to send the ENTIRE balance**
   - Native EOA doesn't estimate gas before sending
   - Attempted to send: `value = 1000000000000000` (all of it)
   - No funds left for gas fees → Transaction rejected

### Code Flow

```typescript
// wallet.service.ts line 2012
const isEip7702Chain = this.pimlicoConfig.isEip7702Enabled(chain);
// Returns FALSE in production (no env vars) ❌

// wallet.service.ts line 2018
if (isEip7702Chain && !tokenAddress && !forceEip7702) {
  // This is SKIPPED in production
  return await this.sendEip7702Gasless(...);
}

// Falls through to regular EOA flow
const account = await this.createAccountForChain(seedPhrase, chain, userId);
// Creates NativeEoaAccountWrapper

// native-eoa.factory.ts line 127
async send(to: string, amount: string): Promise<string> {
  const value = BigInt(amount);
  // Sends the FULL amount without gas estimation ❌
  const hash = await this.walletClient.sendTransaction({
    to: to as Address,
    value, // Problem: This is the user's entire balance!
  });
}
```

---

## ✅ Solution 1: Enable EIP-7702 in Production (RECOMMENDED)

### Why This is Better
- ✅ **Gasless transactions** - Sponsored by Pimlico paymaster
- ✅ **Users can send their full balance** - No need to reserve gas
- ✅ **Better UX** - No confusing "insufficient funds for gas" errors
- ✅ **Already working locally** - Just needs env vars in production

### Steps to Fix

**1. Add Environment Variables to Railway:**

Go to your Railway project → Variables → Add these:

```bash
ENABLE_EIP7702=true
EIP7702_CHAINS=ethereum,sepolia,base,arbitrum,optimism
EIP7702_DELEGATION_ADDRESS=0xe6Cae83BdE06E4c305530e199D7217f42808555B
```

**2. Redeploy**

Railway will automatically redeploy with the new variables.

**3. Verify**

After redeployment, check logs for:
```
[Send Debug] User is sending 0.001 native from base (accountType: EIP-7702, address: 0x...)
```

Should say `EIP-7702` instead of `EOA` ✅

### How It Works

With EIP-7702 enabled:

1. **First Transaction** (Delegation):
   ```typescript
   // Delegates the EOA to a smart contract
   // User signs authorization
   // Pimlico sponsors the gas
   ```

2. **Subsequent Transactions**:
   ```typescript
   // Uses smart contract logic
   // Pimlico sponsors the gas
   // User can send FULL balance
   ```

### Benefits

- **Chain:** Base, Arbitrum, Optimism, Ethereum, Sepolia
- **Cost:** $0 gas fees (sponsored by Pimlico)
- **UX:** Seamless, no balance calculations needed

---

## ✅ Solution 2: Fix EOA to Reserve Gas (If you don't want EIP-7702)

If you prefer to keep using regular EOA without EIP-7702, we need to update the `native-eoa.factory.ts` to estimate and reserve gas.

### Implementation

**File:** `/apps/backend/src/wallet/factories/native-eoa.factory.ts`

```typescript
async send(to: string, amount: string): Promise<string> {
  const requestedValue = BigInt(amount);
  
  // Check current balance
  const balance = await this.publicClient.getBalance({ 
    address: this.address 
  });
  
  this.logger.log(
    `Sending ${requestedValue} wei to ${to} from ${this.address} ` +
    `(balance: ${balance})`
  );
  
  // For native token sends, estimate gas and reserve funds
  try {
    // Estimate gas for this transaction
    const gasEstimate = await this.publicClient.estimateGas({
      account: this.address,
      to: to as Address,
      value: requestedValue,
    });
    
    // Get current gas price
    const gasPrice = await this.publicClient.getGasPrice();
    
    // Calculate total gas cost with 20% buffer for safety
    const gasCostEstimate = gasEstimate * gasPrice;
    const gasCostWithBuffer = (gasCostEstimate * 120n) / 100n;
    
    this.logger.log(
      `Gas estimate: ${gasEstimate} units, ` +
      `price: ${gasPrice} wei, ` +
      `total cost: ${gasCostEstimate} wei ` +
      `(with 20% buffer: ${gasCostWithBuffer} wei)`
    );
    
    // Check if user is trying to send their entire balance
    const totalNeeded = requestedValue + gasCostWithBuffer;
    
    if (totalNeeded > balance) {
      // User is trying to send too much - need to reserve gas
      this.logger.warn(
        `Requested amount (${requestedValue}) + gas (${gasCostWithBuffer}) ` +
        `exceeds balance (${balance}). Adjusting send amount to reserve gas.`
      );
      
      // Calculate maximum sendable amount (balance - gas buffer)
      const maxSendable = balance - gasCostWithBuffer;
      
      if (maxSendable <= 0n) {
        throw new Error(
          `Insufficient balance for gas fees. ` +
          `Balance: ${balance} wei, Gas needed: ${gasCostWithBuffer} wei. ` +
          `Please add more funds to cover gas costs.`
        );
      }
      
      // Check if the difference is significant (>1%)
      const difference = requestedValue - maxSendable;
      const percentDiff = (difference * 100n) / requestedValue;
      
      if (percentDiff > 1n) {
        // Significant difference - throw error asking user to send less
        throw new Error(
          `Cannot send ${requestedValue} wei. ` +
          `Maximum sendable: ${maxSendable} wei ` +
          `(must reserve ${gasCostWithBuffer} wei for gas). ` +
          `Please reduce your send amount.`
        );
      }
      
      // Small difference (<1%) - auto-adjust and log
      this.logger.log(
        `Auto-adjusting send amount from ${requestedValue} to ${maxSendable} ` +
        `to reserve gas fees (difference: ${difference} wei, ${percentDiff}%)`
      );
      
      // Send adjusted amount
      const hash = await this.walletClient.sendTransaction({
        chain: this.walletClient.chain,
        account: this.walletClient.account!,
        to: to as Address,
        value: maxSendable,
        gas: gasEstimate,
      });
      
      this.logger.log(
        `Transaction sent with auto-adjusted amount: ${hash} ` +
        `(sent ${maxSendable} instead of ${requestedValue})`
      );
      
      return hash;
    }
    
    // Normal case - enough balance to cover both amount and gas
    const hash = await this.walletClient.sendTransaction({
      chain: this.walletClient.chain,
      account: this.walletClient.account!,
      to: to as Address,
      value: requestedValue,
      gas: gasEstimate,
    });
    
    this.logger.log(`Transaction sent: ${hash}`);
    return hash;
    
  } catch (error) {
    this.logger.error(
      `Failed to send transaction: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    throw error;
  }
}
```

### How It Works

1. **Estimates gas** before sending
2. **Adds 20% buffer** for safety (gas price fluctuations)
3. **Checks if user has enough** for amount + gas
4. **Auto-adjusts** if trying to send entire balance (within 1%)
5. **Throws clear error** if adjustment is too large

### Pros & Cons

**Pros:**
- ✅ No infrastructure changes needed
- ✅ Works with current setup
- ✅ Clear error messages

**Cons:**
- ❌ Users pay gas fees (not gasless)
- ❌ Can't send exact full balance
- ❌ More complex logic
- ❌ Gas estimation can fail

---

## 📊 Comparison

| Feature | EIP-7702 (Solution 1) | EOA with Gas Reserve (Solution 2) |
|---------|----------------------|----------------------------------|
| **Gas Fees** | $0 (sponsored) | User pays |
| **Send Full Balance** | ✅ Yes | ❌ No (must reserve gas) |
| **Complexity** | Simple (env vars) | Complex (gas estimation) |
| **Setup** | Add env vars to Railway | Update factory code |
| **User Experience** | Excellent | Good |
| **Error Handling** | Built-in | Manual |
| **Production Ready** | ✅ Yes | Needs testing |

---

## 🎯 Recommendation

**Use Solution 1 (Enable EIP-7702 in Production)**

### Reasons:

1. **Already working locally** - Just missing env vars in production
2. **Better UX** - Gasless transactions, can send full balance
3. **Simpler** - No code changes needed
4. **Future-proof** - EIP-7702 is the future of Ethereum UX
5. **Quick fix** - Just add 3 env vars to Railway

### Action Items:

1. ✅ Go to Railway dashboard
2. ✅ Add the 3 environment variables
3. ✅ Redeploy
4. ✅ Test send with same user

---

## 🧪 Testing After Fix

### Test Case 1: Send Full Balance
```bash
User Balance: 0.001 ETH
Send Amount:  0.001 ETH
Expected:     ✅ Success (with EIP-7702)
```

### Test Case 2: Send Partial Balance
```bash
User Balance: 0.01 ETH
Send Amount:  0.005 ETH
Expected:     ✅ Success
```

### Test Case 3: Verify Logs
```bash
# Should see:
[Send Debug] User is sending 0.001 native from base (accountType: EIP-7702, address: 0x...)
# NOT:
[Send Debug] User is sending 0.001 native from base (accountType: EOA, address: 0x...)
```

---

## 📝 Related Files

- `/apps/backend/src/wallet/wallet.service.ts` - Lines 2010-2040
- `/apps/backend/src/wallet/config/pimlico.config.ts` - Lines 146-153
- `/apps/backend/src/wallet/factories/native-eoa.factory.ts` - Lines 104-143
- `/apps/backend/.env.example` - Lines 80-95 (documentation)
- `/apps/backend/.env` - Lines 85-95 (your local config)

---

## 🚀 Next Steps

1. **Decide which solution** (I recommend Solution 1)
2. **If Solution 1:** Add env vars to Railway
3. **If Solution 2:** Apply code changes to `native-eoa.factory.ts`
4. **Test** with the same user/amount
5. **Monitor** production logs
6. **Update** documentation

---

## 💡 Why EIP-7702 Wasn't Working in Production

The code has a safety check:

```typescript
// wallet.service.ts line 2018
if (isEip7702Chain && !tokenAddress && !forceEip7702) {
  // Route to gasless EIP-7702 flow
  const result = await this.sendEip7702Gasless(...);
  return { txHash: result.transactionHash || result.userOpHash };
}
```

This check only passes if:
1. ✅ `isEip7702Chain` is true (requires env vars)
2. ✅ `!tokenAddress` (native token, not ERC-20)
3. ✅ `!forceEip7702` (not forcing EOA)

In production, condition 1 failed because:
```typescript
// pimlico.config.ts line 147-151
isEip7702Enabled(chain: string): boolean {
  const enabled = this.configService.get<string>('ENABLE_EIP7702') === 'true';
  if (!enabled) return false; // ❌ This returned false in production
  const supportedChains =
    this.configService.get<string>('EIP7702_CHAINS')?.split(',') || [];
  return supportedChains.includes(chain);
}
```

**Missing in production:**
- `ENABLE_EIP7702=true`
- `EIP7702_CHAINS=ethereum,sepolia,base,arbitrum,optimism`

**Result:** System used EOA instead of EIP-7702 → gas fee issue → transaction failed
