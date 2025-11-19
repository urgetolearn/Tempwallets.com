# Phase 2 Testing Guide

This guide helps you test all Phase 2 components of the Substrate wallet implementation.

## Prerequisites

1. Backend server running: `pnpm dev` (or `npm run dev`)
2. Server should be accessible at `http://localhost:5005` (or your configured port)

## Test Endpoints

All test endpoints are available at: `http://localhost:5005/wallet/substrate/test/`

### 1. Test WASM Initialization

**Endpoint:** `GET /wallet/substrate/test/wasm`

**Test:** Verifies that WASM crypto is initialized correctly.

```bash
curl http://localhost:5005/wallet/substrate/test/wasm
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

### 2. Test Chain Configuration

**Endpoint:** `GET /wallet/substrate/test/chains?useTestnet=true`

**Test:** Verifies chain configurations are loaded correctly.

```bash
# Test testnet configs
curl "http://localhost:5005/wallet/substrate/test/chains?useTestnet=true"

# Test mainnet configs
curl "http://localhost:5005/wallet/substrate/test/chains?useTestnet=false"
```

**Expected Response:**
```json
{
  "success": true,
  "enabledChains": ["polkadot", "hydration", "bifrost", "unique", "paseo"],
  "chains": {
    "polkadot": {
      "name": "Paseo",
      "genesisHash": "0xd5d32db5e6c12cdc1a94a4b58a19c59aaab54dfcc6d11ad26dc9db8d5c858ad2",
      "rpc": "wss://paseo-rpc.dwellir.com",
      "ss58Prefix": 42,
      "token": { "symbol": "PAS", "decimals": 10 },
      "isTestnet": true
    }
  },
  "useTestnet": true
}
```

---

### 3. Test SS58 Encoding/Decoding

**Endpoint:** `GET /wallet/substrate/test/ss58`

**Test:** Verifies SS58 address encoding and validation.

```bash
# Test encoding (generates a test address)
curl "http://localhost:5005/wallet/substrate/test/ss58?prefix=0"

# Test validation (validate an existing address)
curl "http://localhost:5005/wallet/substrate/test/ss58?address=5DTestUPts3kjeXSTMyerHihn1vGRxJhWzJYcNxqH5W5ddiqnL&prefix=42"
```

**Expected Response (Encoding):**
```json
{
  "success": true,
  "test": "encode",
  "publicKey": [1, 1, 1, ...],
  "prefix": 0,
  "encodedAddress": "1REAJ39y5Z2V3pzQNMeZnRfKCRvKCb2UTQe3"
}
```

---

### 4. Test Derivation Paths

**Endpoint:** `GET /wallet/substrate/test/derivation?index=0`

**Test:** Verifies derivation path building and parsing.

```bash
curl "http://localhost:5005/wallet/substrate/test/derivation?index=0"
```

**Expected Response:**
```json
{
  "success": true,
  "accountIndex": 0,
  "derivationPath": "//44//354//0//0//0",
  "parsedIndex": 0,
  "isValid": true
}
```

---

### 5. Test RPC Connection

**Endpoint:** `GET /wallet/substrate/test/rpc?chain=paseo&useTestnet=true`

**Test:** Verifies RPC connection pooling and connectivity.

```bash
curl "http://localhost:5005/wallet/substrate/test/rpc?chain=paseo&useTestnet=true"
```

**Expected Response:**
```json
{
  "success": true,
  "chain": "paseo",
  "useTestnet": true,
  "isConnected": true,
  "genesisHash": "0xd5d32db5e6c12cdc1a94a4b58a19c59aaab54dfcc6d11ad26dc9db8d5c858ad2",
  "connections": {
    "paseo:testnet": true
  }
}
```

---

### 6. Test Metadata Caching

**Endpoint:** `GET /wallet/substrate/test/cache?chain=paseo`

**Test:** Verifies metadata caching is working.

```bash
curl "http://localhost:5005/wallet/substrate/test/cache?chain=paseo"
```

**Expected Response:**
```json
{
  "success": true,
  "chain": "paseo",
  "genesisHash1": "0xd5d32db5e6c12cdc1a94a4b58a19c59aaab54dfcc6d11ad26dc9db8d5c858ad2",
  "genesisHash2": "0xd5d32db5e6c12cdc1a94a4b58a19c59aaab54dfcc6d11ad26dc9db8d5c858ad2",
  "match": true,
  "cacheStats": {
    "size": 1,
    "keys": ["paseo:genesisHash"]
  }
}
```

---

### 7. Test Address Derivation

**Endpoint:** `GET /wallet/substrate/test/address?userId=test-user-123&chain=paseo&useTestnet=true`

**Test:** Verifies address derivation and validation.

```bash
curl "http://localhost:5005/wallet/substrate/test/address?userId=test-user-123&chain=paseo&useTestnet=true"
```

**Expected Response:**
```json
{
  "success": true,
  "userId": "test-user-123",
  "chain": "paseo",
  "useTestnet": true,
  "address": "5DTestUPts3kjeXSTMyerHihn1vGRxJhWzJYcNxqH5W5ddiqnL",
  "isValid": true,
  "expectedPrefix": 42
}
```

**Note:** This will auto-create a wallet if it doesn't exist for the user.

---

### 8. Test All Addresses

**Endpoint:** `GET /wallet/substrate/test/addresses?userId=test-user-123&useTestnet=true`

**Test:** Verifies all addresses are derived correctly for all chains.

```bash
curl "http://localhost:5005/wallet/substrate/test/addresses?userId=test-user-123&useTestnet=true"
```

**Expected Response:**
```json
{
  "success": true,
  "userId": "test-user-123",
  "useTestnet": true,
  "addresses": {
    "polkadot": "5DTestUPts3kjeXSTMyerHihn1vGRxJhWzJYcNxqH5W5ddiqnL",
    "hydration": null,
    "bifrost": null,
    "unique": null,
    "paseo": "5DTestUPts3kjeXSTMyerHihn1vGRxJhWzJYcNxqH5W5ddiqnL"
  },
  "validated": {
    "polkadot": { "address": "...", "isValid": true },
    "paseo": { "address": "...", "isValid": true }
  }
}
```

---

### 9. Test Account Factory

**Endpoint:** `GET /wallet/substrate/test/account?userId=test-user-123&chain=paseo&accountIndex=0&useTestnet=true`

**Test:** Verifies account creation with security (userId-based).

```bash
curl "http://localhost:5005/wallet/substrate/test/account?userId=test-user-123&chain=paseo&accountIndex=0&useTestnet=true"
```

**Expected Response:**
```json
{
  "success": true,
  "userId": "test-user-123",
  "chain": "paseo",
  "accountIndex": 0,
  "useTestnet": true,
  "account": {
    "address": "5DTestUPts3kjeXSTMyerHihn1vGRxJhWzJYcNxqH5W5ddiqnL",
    "publicKey": [123, 45, ...],
    "chain": "paseo",
    "accountIndex": 0
  },
  "isValid": true,
  "expectedPrefix": 42
}
```

---

### 10. Test Balance Fetching

**Endpoint:** `GET /wallet/substrate/test/balance?address=5DTestUPts3kjeXSTMyerHihn1vGRxJhWzJYcNxqH5W5ddiqnL&chain=paseo&useTestnet=true`

**Test:** Verifies RPC balance fetching works.

```bash
curl "http://localhost:5005/wallet/substrate/test/balance?address=5DTestUPts3kjeXSTMyerHihn1vGRxJhWzJYcNxqH5W5ddiqnL&chain=paseo&useTestnet=true"
```

**Expected Response:**
```json
{
  "success": true,
  "address": "5DTestUPts3kjeXSTMyerHihn1vGRxJhWzJYcNxqH5W5ddiqnL",
  "chain": "paseo",
  "useTestnet": true,
  "balance": "0",
  "balanceHuman": "0",
  "token": "PAS",
  "decimals": 10
}
```

---

### 11. Test Nonce Management

**Endpoint:** `GET /wallet/substrate/test/nonce?address=5DTestUPts3kjeXSTMyerHihn1vGRxJhWzJYcNxqH5W5ddiqnL&chain=paseo&useTestnet=true`

**Test:** Verifies nonce management prevents collisions.

```bash
curl "http://localhost:5005/wallet/substrate/test/nonce?address=5DTestUPts3kjeXSTMyerHihn1vGRxJhWzJYcNxqH5W5ddiqnL&chain=paseo&useTestnet=true"
```

**Expected Response:**
```json
{
  "success": true,
  "address": "5DTestUPts3kjeXSTMyerHihn1vGRxJhWzJYcNxqH5W5ddiqnL",
  "chain": "paseo",
  "useTestnet": true,
  "nonces": {
    "first": 0,
    "second": 1,
    "third": 2,
    "afterMarkUsed": 1
  },
  "pendingNonce": 2,
  "note": "Nonces should increment sequentially"
}
```

---

### 12. Run All Tests

**Endpoint:** `GET /wallet/substrate/test/all?userId=test-user-123`

**Test:** Runs all Phase 2 tests in one request.

```bash
curl "http://localhost:5005/wallet/substrate/test/all?userId=test-user-123"
```

**Expected Response:**
```json
{
  "success": true,
  "userId": "test-user-123",
  "results": {
    "wasm": { "success": true, "ready": true },
    "chainConfig": { "success": true, "enabledChains": [...], "count": 5 },
    "ss58": { "success": true, "encoded": "...", "isValid": true },
    "derivation": { "success": true, "path": "//44//354//0//0//0" },
    "addressDerivation": { "success": true, "addresses": {...}, "count": 2 },
    "rpc": { "success": true, "isConnected": true }
  },
  "summary": {
    "total": 6,
    "passed": 6,
    "failed": 0
  }
}
```

---

## Testing Checklist

- [ ] WASM initializes correctly
- [ ] Chain configurations load (testnet and mainnet)
- [ ] SS58 encoding/decoding works
- [ ] Derivation paths are correct
- [ ] RPC connections work (testnet)
- [ ] Metadata caching works
- [ ] Address derivation works for all chains
- [ ] Address validation works (SS58 format and prefix)
- [ ] Account factory uses userId (not raw seed)
- [ ] Balance fetching works
- [ ] Nonce management prevents collisions
- [ ] All tests pass in `/all` endpoint

---

## Common Issues

### Issue: RPC Connection Fails
- **Cause:** Network issue or RPC endpoint down
- **Fix:** Check RPC endpoint is accessible, try different endpoint

### Issue: Address Derivation Fails
- **Cause:** WASM not initialized or seed phrase issue
- **Fix:** Check WASM initialization, verify seed exists for user

### Issue: Address Validation Fails
- **Cause:** Wrong SS58 prefix or invalid address format
- **Fix:** Verify chain configuration has correct prefix

---

## Next Steps

After Phase 2 tests pass:
1. Proceed to Phase 3: Transaction Support
2. Test with real addresses on Paseo testnet
3. Verify addresses are safe and correctly formatted

