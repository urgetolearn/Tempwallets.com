# Substrate Wallet Testing Guide

## Quick Start

The backend runs on **port 5005** by default. All endpoints are available at:
```
http://localhost:5005
```

## Testing Flow

### 1. Health Check

First, verify the Substrate functionality is available:

```bash
curl "http://localhost:5005/wallet/substrate/health"
```

**Expected Response:**
```json
{
  "status": "ok",
  "message": "Substrate functionality is available"
}
```

---

### 2. Test WASM Initialization

Verify crypto/WASM is properly initialized:

```bash
curl "http://localhost:5005/wallet/substrate/test/wasm"
```

**Expected Response:**
```json
{
  "success": true,
  "before": false,
  "after": true,
  "message": "WASM crypto initialized successfully"
}
```

---

### 3. Check Enabled Chains

See which Substrate chains are configured:

```bash
# Mainnet chains
curl "http://localhost:5005/wallet/substrate/test/chains?useTestnet=false"

# Testnet chains
curl "http://localhost:5005/wallet/substrate/test/chains?useTestnet=true"
```

**Expected Response:**
```json
{
  "success": true,
  "enabledChains": ["polkadot", "hydration", "bifrost", "unique", "paseo", "paseoAssethub"],
  "chains": {
    "polkadot": {
      "name": "Polkadot",
      "genesisHash": "0x91b171bb158e2d3848fa23a9f1c25182",
      "rpc": "wss://rpc.polkadot.io",
      "ss58Prefix": 0,
      "token": { "symbol": "DOT", "decimals": 10 },
      "isTestnet": false
    },
    ...
  }
}
```

---

### 4. Create/Ensure Wallet Exists

The wallet is auto-created when you first access addresses, but you can ensure it exists:

```bash
# Replace 'test-user' with your userId
curl -X POST "http://localhost:5005/wallet/seed" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "mode": "random"
  }'
```

**Expected Response:**
```json
{
  "ok": true
}
```

---

### 5. Get Substrate Addresses (Production Endpoint)

Get all Substrate addresses for a user:

```bash
# Mainnet
curl "http://localhost:5005/wallet/substrate/addresses?userId=test-user&useTestnet=false"

# Testnet
curl "http://localhost:5005/wallet/substrate/addresses?userId=test-user&useTestnet=true"
```

**Expected Response:**
```json
{
  "userId": "test-user",
  "useTestnet": false,
  "addresses": {
    "polkadot": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
    "hydration": "7KzvGZG94oYZdQeEZ37p5xr1oyH6rqbHQKQJGQfHSZVJvWfS",
    "bifrost": "e8KY1QAADh8j4anvgyTZbgnyK8LjPhcehppCT183pbWt2nu",
    "unique": "juynzwZYWZrt7zFqDrUwVxDcoGdnaL8qeNwp8eRWgC1ADW2",
    "paseo": "5EU4qitfzhBJMB9VXreKA3G6EnGvhzNMSZmYM49xic151fDQ",
    "paseoAssethub": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
  }
}
```

---

### 6. Get All Wallet Addresses (Including Substrate)

Get addresses for ALL chains (EVM + Substrate):

```bash
curl "http://localhost:5005/wallet/addresses?userId=test-user"
```

This will include Substrate addresses in the response.

---

### 7. Get Substrate Balances

Get balances for all Substrate chains:

```bash
# Mainnet
curl "http://localhost:5005/wallet/substrate/balances?userId=test-user&useTestnet=false"

# Testnet
curl "http://localhost:5005/wallet/substrate/balances?userId=test-user&useTestnet=true"
```

**Expected Response:**
```json
{
  "userId": "test-user",
  "useTestnet": false,
  "balances": {
    "polkadot": {
      "balance": "0",
      "address": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
      "token": "DOT",
      "decimals": 10
    },
    "hydration": {
      "balance": "0",
      "address": "7KzvGZG94oYZdQeEZ37p5xr1oyH6rqbHQKQJGQfHSZVJvWfS",
      "token": "HDX",
      "decimals": 12
    },
    ...
  }
}
```

---

### 8. Get Transaction History

Get transaction history for a specific chain:

```bash
# Get transactions for Polkadot
curl "http://localhost:5005/wallet/substrate/transactions?userId=test-user&chain=polkadot&useTestnet=false&limit=10"

# Get transactions for Paseo AssetHub (testnet)
curl "http://localhost:5005/wallet/substrate/transactions?userId=test-user&chain=paseoAssethub&useTestnet=true&limit=10"
```

**Expected Response:**
```json
{
  "userId": "test-user",
  "chain": "polkadot",
  "useTestnet": false,
  "history": {
    "transactions": [],
    "total": 0,
    "page": 1,
    "pageSize": 10,
    "hasMore": false
  }
}
```

---

### 9. Test Transaction Construction (Testnet)

Test constructing a transfer transaction (doesn't send):

```bash
curl "http://localhost:5005/wallet/substrate/test/construct?from=5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY&to=5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty&amount=1000000000&chain=paseoAssethub&useTestnet=true&transferMethod=transferAllowDeath"
```

**Note:** Replace addresses with actual addresses from step 5.

---

### 10. Test Fee Estimation

Estimate transaction fee:

```bash
curl "http://localhost:5005/wallet/substrate/test/estimate-fee?from=5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY&to=5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty&amount=1000000000&chain=paseoAssethub&useTestnet=true"
```

**Expected Response:**
```json
{
  "success": true,
  "fee": {
    "partialFee": "1000000000",
    "weight": "1000000",
    "class": "Normal"
  }
}
```

---

### 11. Send Transfer (Testnet Only!)

**⚠️ WARNING: This will send real tokens! Use testnet only!**

```bash
curl -X POST "http://localhost:5005/wallet/substrate/send" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "chain": "paseoAssethub",
    "to": "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty",
    "amount": "1000000000",
    "useTestnet": true,
    "transferMethod": "transferAllowDeath"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "txHash": "0x...",
  "status": "pending",
  "blockHash": null,
  "error": null
}
```

**Note:** 
- Amount is in smallest units (e.g., 1000000000 = 1 DOT for Polkadot with 10 decimals)
- Use `paseoAssethub` for testnet transactions (Paseo itself is NOT asset-bearing)
- Make sure you have testnet tokens before sending!

---

## Advanced Testing Endpoints

### Test All Components

Run comprehensive test suite:

```bash
curl "http://localhost:5005/wallet/substrate/test/all?userId=test-user"
```

This tests:
- WASM initialization
- Chain configuration
- SS58 encoding/decoding
- Address derivation
- RPC connections

---

### Test Specific Chain Address

Get address for a specific chain:

```bash
curl "http://localhost:5005/wallet/substrate/test/address?userId=test-user&chain=polkadot&useTestnet=false"
```

---

### Test RPC Connection

Test RPC connection to a chain:

```bash
curl "http://localhost:5005/wallet/substrate/test/rpc?chain=paseoAssethub&useTestnet=true"
```

---

### Check Pallet Availability

Verify which transfer methods are available:

```bash
curl "http://localhost:5005/wallet/substrate/test/check-pallet?chain=paseoAssethub&useTestnet=true&pallet=balances"
```

**Expected Response:**
```json
{
  "success": true,
  "chain": "paseoAssethub",
  "useTestnet": true,
  "pallet": "balances",
  "available": true,
  "transferAvailable": false,
  "transferAllowDeathAvailable": true,
  "transferKeepAliveAvailable": true,
  "transferAllAvailable": true,
  "runtimeSS58Prefix": 0,
  "configuredSS58Prefix": 0,
  "ss58PrefixMatch": true
}
```

---

## Testing Checklist

### Basic Functionality
- [ ] Health check returns `ok`
- [ ] WASM initializes successfully
- [ ] All 6 chains are enabled
- [ ] Addresses are derived correctly for all chains
- [ ] Balances can be fetched (may be 0)
- [ ] Transaction history endpoint works

### Integration
- [ ] Substrate addresses appear in `/wallet/addresses`
- [ ] WalletConnect accounts include Polkadot namespace
- [ ] Addresses are correctly formatted (SS58)

### Transaction Testing (Testnet Only!)
- [ ] Transaction construction works
- [ ] Fee estimation works
- [ ] Transaction signing works (test endpoint)
- [ ] Transaction sending works (testnet only!)

---

## Common Issues

### 1. "No address found for user"
**Solution:** Ensure wallet exists by calling `/wallet/seed` first, or addresses will auto-create on first access.

### 2. "RPC connection timeout"
**Solution:** Check RPC endpoints in chain config. Some may be slow or rate-limited.

### 3. "Balances are all 0"
**Solution:** This is normal for new wallets. Fund the addresses with testnet tokens to see balances.

### 4. "Out of range ss58Format specified"
**Solution:** This was fixed - Paseo AssetHub uses prefix `0` (not 47).

### 5. "Expected blockHash to be passed"
**Solution:** This was fixed - `blockHash` is now included in transaction signing.

---

## Example Test Script

Save this as `test-substrate.sh`:

```bash
#!/bin/bash

BASE_URL="http://localhost:5005"
USER_ID="test-user"

echo "1. Health Check..."
curl -s "$BASE_URL/wallet/substrate/health" | jq

echo -e "\n2. WASM Test..."
curl -s "$BASE_URL/wallet/substrate/test/wasm" | jq

echo -e "\n3. Get Addresses..."
curl -s "$BASE_URL/wallet/substrate/addresses?userId=$USER_ID&useTestnet=false" | jq

echo -e "\n4. Get Balances..."
curl -s "$BASE_URL/wallet/substrate/balances?userId=$USER_ID&useTestnet=false" | jq

echo -e "\n5. Test All Components..."
curl -s "$BASE_URL/wallet/substrate/test/all?userId=$USER_ID" | jq
```

Make it executable and run:
```bash
chmod +x test-substrate.sh
./test-substrate.sh
```

---

## Next Steps

1. **Test with real testnet tokens** on Paseo AssetHub
2. **Verify WalletConnect integration** with a dApp
3. **Test transaction signing** with actual transactions
4. **Monitor logs** for any errors or warnings

---

## Support

If you encounter issues:
1. Check backend logs for detailed error messages
2. Verify RPC endpoints are accessible
3. Ensure WASM is initialized (check `/wallet/substrate/test/wasm`)
4. Test individual components using test endpoints

