# Prefix-Agnostic Address Handling

This document explains the prefix-agnostic address handling implementation, inspired by the Edgeware example where addresses can be used without specifying the prefix in URLs.

## Overview

Previously, all endpoints required specifying the chain and testnet/mainnet flag. Now, addresses can be used directly without prefix specification - the system auto-detects the chain and network from the address prefix.

## Key Features

### 1. Auto-Detection of Chain from Address

The system can automatically determine which chain and network (testnet/mainnet) an address belongs to by detecting its SS58 prefix.

**Example:**
```typescript
const address = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
const chainInfo = getChainConfigFromAddress(address);
// Returns: { chain: 'polkadot', config: {...}, isTestnet: false }
```

### 2. Prefix-Agnostic Address Decoding

Like the Edgeware example, addresses can be decoded to bytes without needing to know the prefix:

```typescript
const addressBytes = ss58Util.decodeToBytes(address);
// Works for any valid SS58 address, regardless of prefix
```

### 3. New Utility Functions

#### `ss58Util.detectPrefix(address: string): number | null`
Detects the SS58 prefix from an address by trying common prefixes.

#### `ss58Util.decodeToBytes(address: string): Uint8Array`
Decodes any valid SS58 address to public key bytes (prefix-agnostic).

#### `getChainConfigFromAddress(address: string)`
Finds the chain configuration that matches the address prefix.

#### `findChainFromAddress(address: string)`
Same as above but returns `null` if not found (non-throwing).

## New Endpoints

### 1. Auto-Detect Chain from Address
```
GET /wallet/substrate/test/detect?address=5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
```

**Response:**
```json
{
  "success": true,
  "address": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
  "detectedPrefix": 0,
  "chain": "polkadot",
  "chainName": "Polkadot",
  "isTestnet": false,
  "ss58Prefix": 0,
  "genesisHash": "0x91b171bb158e2d3848fa23a9f1c25182",
  "rpc": "wss://rpc.polkadot.io",
  "token": { "symbol": "DOT", "decimals": 10 },
  "addressBytes": [...],
  "addressBytesHex": "...",
  "note": "Chain and network auto-detected from address prefix"
}
```

### 2. Get Balance (Auto-Detect Chain)
```
GET /wallet/substrate/test/balance-detect?address=5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
```

**Response:**
```json
{
  "success": true,
  "address": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
  "detectedChain": "polkadot",
  "chainName": "Polkadot",
  "isTestnet": false,
  "balance": "1000000000000",
  "balanceHuman": "1.0",
  "token": "DOT",
  "decimals": 10,
  "note": "Chain auto-detected from address prefix"
}
```

### 3. Decode Address to Bytes
```
GET /wallet/substrate/test/decode?address=5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
```

**Response:**
```json
{
  "success": true,
  "address": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
  "addressBytes": [0, 1, 2, ...],
  "addressBytesHex": "000102...",
  "addressBytesLength": 32,
  "detectedPrefix": 0,
  "chain": "polkadot",
  "chainName": "Polkadot",
  "isTestnet": false,
  "note": "Address decoded successfully (prefix-agnostic)"
}
```

## How It Works

### 1. Address Validation
First, the address is validated using `decodeAddress()` which works for any valid SS58 address regardless of prefix:

```typescript
if (!ss58Util.validate(address)) {
  // Invalid address
}
```

### 2. Prefix Detection
The system tries common prefixes to find which one matches:

```typescript
const detectedPrefix = ss58Util.detectPrefix(address);
// Tries: 0, 2, 42, 6, 7, 63
```

### 3. Chain Matching
Once the prefix is detected, the system matches it against known chain configurations:

```typescript
const chainInfo = getChainConfigFromAddress(address);
// Finds chain config that matches the detected prefix
```

### 4. Address Decoding
The address can be decoded to bytes without needing the prefix:

```typescript
const addressBytes = ss58Util.decodeToBytes(address);
// Returns 32-byte public key
```

## Supported Prefixes

| Prefix | Chain | Network |
|--------|-------|---------|
| 0 | Polkadot | Mainnet |
| 42 | Polkadot/Paseo | Testnet |
| 6 | Bifrost | Mainnet/Testnet |
| 7 | Unique | Mainnet/Testnet |
| 63 | Hydration | Mainnet/Testnet |

## Usage Examples

### Example 1: Decode Address (Like Edgeware)
```typescript
// No need to know the prefix
const address = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
const addressBytes = ss58Util.decodeToBytes(address);
// Use addressBytes for EVM conversion, etc.
```

### Example 2: Auto-Detect Chain
```typescript
const address = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
const chainInfo = getChainConfigFromAddress(address);
console.log(`Chain: ${chainInfo.chain}, Network: ${chainInfo.isTestnet ? 'Testnet' : 'Mainnet'}`);
```

### Example 3: Get Balance Without Specifying Chain
```typescript
// Old way (required chain parameter):
const balance = await rpcService.getBalance(address, 'polkadot', false);

// New way (auto-detect):
const chainInfo = getChainConfigFromAddress(address);
const balance = await rpcService.getBalance(address, chainInfo.chain, chainInfo.isTestnet);
```

## Benefits

1. **Simpler API**: No need to specify chain/testnet in URLs
2. **User-Friendly**: Users can just paste an address
3. **Error Prevention**: Can't accidentally use wrong chain config
4. **Flexibility**: Works with any valid SS58 address
5. **Edgeware-Compatible**: Follows the same pattern as Edgeware's implementation

## Backward Compatibility

All existing endpoints that require `chain` and `useTestnet` parameters still work. The new prefix-agnostic endpoints are additional options.

## Implementation Details

### SS58 Utility (`ss58.util.ts`)
- `detectPrefix()`: Detects prefix by trying common values
- `decodeToBytes()`: Decodes address without needing prefix
- `validate()`: Validates address format (prefix-agnostic)

### Chain Config (`substrate-chain.config.ts`)
- `findChainFromAddress()`: Finds chain config from address
- `getChainConfigFromAddress()`: Same but throws if not found

### Test Controller (`substrate-test.controller.ts`)
- `/detect`: Auto-detect chain from address
- `/balance-detect`: Get balance without specifying chain
- `/decode`: Decode address to bytes

## Testing

Test the new endpoints:

```bash
# Auto-detect chain
curl "http://localhost:5005/wallet/substrate/test/detect?address=5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"

# Get balance (auto-detect)
curl "http://localhost:5005/wallet/substrate/test/balance-detect?address=5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"

# Decode address
curl "http://localhost:5005/wallet/substrate/test/decode?address=5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
```

## Future Enhancements

1. Update main wallet endpoints to support prefix-agnostic addresses
2. Add EVM address conversion (like Edgeware example)
3. Support for more chains/prefixes
4. Cache detected chain info for performance

