# SS58 Address Validation Guidelines Compliance

This document verifies that our Substrate wallet implementation follows all SS58 address validation best practices.

## ✅ Guidelines Compliance Checklist

### 1. Correct SS58 Prefix During Address Generation
**Status: ✅ COMPLIANT**

- **Location**: `substrate-account.factory.ts:69`
- **Implementation**: 
  ```typescript
  const keyring = new Keyring({
    type: 'sr25519',
    ss58Format: chainConfig.ss58Prefix, // Uses correct prefix from chain config
  });
  ```
- **Verification**: The prefix comes directly from `getChainConfig(chain, useTestnet)`, which returns the correct testnet or mainnet configuration.

### 2. Matching Validation/Decoding Prefix
**Status: ✅ COMPLIANT**

- **Location**: `substrate-account.factory.ts:99`
- **Implementation**:
  ```typescript
  // Validate prefix matches expected chain prefix
  if (!ss58Util.validateWithPrefix(address, chainConfig.ss58Prefix)) {
    // Error handling...
  }
  ```
- **Verification**: We validate using the **same** `chainConfig.ss58Prefix` that was used for generation.

### 3. Correct Chain Context (No Cross-Chain Confusion)
**Status: ✅ COMPLIANT**

- **Location**: `substrate-chain.config.ts:168-180`
- **Implementation**: 
  ```typescript
  export function getChainConfig(
    chain: SubstrateChainKey,
    useTestnet?: boolean,
  ): ChainNetworkConfig {
    const chainConfig = SUBSTRATE_CHAINS[chain];
    const shouldUseTestnet = useTestnet !== undefined
      ? useTestnet
      : SUBSTRATE_FEATURES.TESTNET_ENABLED && !SUBSTRATE_FEATURES.MAINNET_ENABLED;
    return shouldUseTestnet ? chainConfig.testnet : chainConfig.mainnet;
  }
  ```
- **Verification**: Each chain has separate testnet/mainnet configs with correct prefixes:
  - Polkadot: 0 (mainnet), 42 (testnet/Paseo)
  - Hydration: 63 (both)
  - Bifrost: 6 (both)
  - Unique: 7 (both)
  - Paseo: 42 (testnet)

### 4. Testnet vs Mainnet Separation
**Status: ✅ COMPLIANT**

- **Implementation**: The `useTestnet` parameter is consistently passed through all functions:
  - `createAccount(userId, chain, accountIndex, useTestnet)`
  - `getChainConfig(chain, useTestnet)`
  - `getAddressForChain(userId, chain, useTestnet)`
- **Verification**: Testnet and mainnet addresses are generated with different prefixes and validated accordingly.

### 5. Correct Input Format (32-byte public keys)
**Status: ✅ COMPLIANT**

- **Location**: `substrate-account.factory.ts:73-75`
- **Implementation**: 
  ```typescript
  const pair = keyring.createFromUri(`${seedPhrase}${derivationPath}`, {
    name: `${chain}-${accountIndex}`,
  });
  ```
- **Verification**: The keyring handles seed phrase to public key conversion internally, ensuring 32-byte public keys.

### 6. Keyring Configuration
**Status: ✅ COMPLIANT**

- **Location**: `substrate-account.factory.ts:67-70`
- **Implementation**:
  ```typescript
  const keyring = new Keyring({
    type: 'sr25519',           // Explicitly set type
    ss58Format: chainConfig.ss58Prefix, // Explicitly set prefix
  });
  ```
- **Verification**: Keyring is created fresh for each account with the correct configuration.

### 7. Dependency Version Consistency
**Status: ✅ COMPLIANT**

- **Package**: `@polkadot/api@^13.2.1`
- **Related**: `@polkadot/util-crypto@^13.5.7`, `@polkadot/keyring@^13.5.7`
- **Verification**: All `@polkadot/*` dependencies are on compatible v13.x versions.

## Implementation Details

### Address Generation Flow
1. Get chain config: `getChainConfig(chain, useTestnet)` → Returns config with `ss58Prefix`
2. Create keyring: `new Keyring({ type: 'sr25519', ss58Format: chainConfig.ss58Prefix })`
3. Derive account: `keyring.createFromUri(seedPhrase + derivationPath)`
4. Get address: `pair.address` (automatically encoded with correct prefix)

### Address Validation Flow
1. Validate checksum: `ss58Util.validate(address)` → Uses `decodeAddress` internally
2. Validate prefix: `ss58Util.validateWithPrefix(address, chainConfig.ss58Prefix)` → Uses `checkAddress(address, expectedPrefix)`

### SS58 Utility Functions

#### `validate(address: string): boolean`
- Uses `decodeAddress(address)` directly
- Returns `true` if address decodes successfully (valid checksum)

#### `validateWithPrefix(address: string, expectedPrefix: number): boolean`
- Uses `checkAddress(address, expectedPrefix)`
- Returns `true` if address is valid for the expected prefix
- **Key**: This ensures the address was generated with the correct prefix

#### `decode(address: string): { publicKey: Uint8Array; prefix: number }`
- Decodes address to get public key
- Tries common prefixes to detect which one matches
- Returns both public key and detected prefix

## Testing

Run the comprehensive test:
```bash
curl "http://localhost:5005/wallet/substrate/test/all?userId=test-user"
```

Expected results:
- ✅ WASM initialization: Success
- ✅ Chain config: All chains enabled with correct prefixes
- ✅ SS58 validation: Should pass with known valid address
- ✅ Address derivation: Should succeed for all chains
- ✅ RPC connection: May timeout (network dependent)

## Common Issues and Solutions

### Issue: "Invalid SS58 address checksum"
**Cause**: Address generated with one prefix, validated with another
**Solution**: Ensure `chainConfig.ss58Prefix` is the same for both generation and validation

### Issue: "Address prefix mismatch"
**Cause**: Cross-chain validation (e.g., validating Paseo address with Polkadot prefix)
**Solution**: Always use `getChainConfig(chain, useTestnet)` to get the correct prefix

### Issue: "Failed to decode address"
**Cause**: Invalid address format or corrupted data
**Solution**: Verify address is complete (48 characters for SS58) and not truncated

## Summary

✅ **All guidelines are followed:**
- Correct prefix during generation
- Matching prefix during validation
- No cross-chain confusion
- Proper testnet/mainnet separation
- Correct keyring configuration
- Consistent dependency versions

The implementation is compliant with all SS58 validation best practices.

