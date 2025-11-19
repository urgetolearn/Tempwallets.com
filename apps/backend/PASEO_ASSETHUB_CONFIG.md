# Paseo AssetHub Configuration

## Overview

Added **Paseo AssetHub** as a separate chain configuration for transaction testing. Regular Paseo is **NOT asset-bearing**, so AssetHub must be used for balance transfers and transaction testing.

## Key Differences

### Paseo (Regular)
- **Purpose**: Relay chain testnet (not asset-bearing)
- **SS58 Prefix**: 42
- **Token**: PAS (18 decimals)
- **RPC**: `wss://rpc.ibp.network/paseo`
- **Use Case**: Chain operations, not transactions

### Paseo AssetHub
- **Purpose**: Asset-bearing parachain for transaction testing
- **SS58 Prefix**: 47
- **Token**: PAS (10 decimals)
- **RPC**: `wss://asset-hub-paseo.dotters.network`
- **ParaChain ID**: 1000
- **Genesis Hash**: `0xb2bd50b6b5e8cd4996fa87e17dcb9fbc3ce3e4e47d0c114b92111decc032d0e9`
- **Use Case**: Balance transfers, transaction testing, asset operations

## Configuration

### Chain Key
```typescript
type SubstrateChainKey = 'polkadot' | 'hydration' | 'bifrost' | 'unique' | 'paseo' | 'paseoAssethub';
```

### Chain Config
```typescript
paseoAssethub: {
  testnet: {
    genesisHash: '0xb2bd50b6b5e8cd4996fa87e17dcb9fbc3ce3e4e47d0c114b92111decc032d0e9',
    rpc: 'wss://asset-hub-paseo.dotters.network',
    ss58Prefix: 47,
    token: { symbol: 'PAS', decimals: 10 },
    name: 'Paseo AssetHub',
    paraId: 1000,
    walletConnectId: 'polkadot:b2bd50b6b5e8cd4996fa87e17dcb9fbc3ce3e4e47d0c114b92111decc032d0e9',
    isTestnet: true,
  },
}
```

## Usage

### For Transaction Testing

**Always use `paseoAssethub` (not `paseo`) for:**
- Balance transfers
- Transaction construction
- Fee estimation
- Transaction signing
- Transaction broadcasting

### Example API Calls

```bash
# Construct transaction (use paseoAssethub)
curl "http://localhost:5005/wallet/substrate/test/construct?from=xxx&to=yyy&amount=1000000&chain=paseoAssethub&useTestnet=true"

# Estimate fee (use paseoAssethub)
curl "http://localhost:5005/wallet/substrate/test/estimate-fee?from=xxx&to=yyy&amount=1000000&chain=paseoAssethub&useTestnet=true"

# Sign transaction (use paseoAssethub)
curl "http://localhost:5005/wallet/substrate/test/sign?userId=xxx&to=yyy&amount=1000000&chain=paseoAssethub&useTestnet=true"

# Send transfer (use paseoAssethub)
curl "http://localhost:5005/wallet/substrate/test/send?userId=xxx&to=yyy&amount=1000000&chain=paseoAssethub&useTestnet=true"
```

## Address Generation

Addresses for Paseo AssetHub use **SS58 prefix 47**:

```typescript
// Address will be generated with prefix 47
const address = await addressManager.getAddressForChain(userId, 'paseoAssethub', true);
// Example: Address starting with prefix 47 characters
```

## SS58 Prefix Detection

The SS58 utility now includes prefix **47** in the common prefixes list for auto-detection:

```typescript
const commonPrefixes = [0, 2, 42, 6, 7, 47, 63];
// 0 = Polkadot, 2 = Kusama, 42 = Substrate generic, 6 = Bifrost, 7 = Unique, 47 = AssetHub, 63 = Hydration
```

## Testing

### Test All Chains
```bash
curl "http://localhost:5005/wallet/substrate/test/all?userId=test-user"
```

This will now include `paseoAssethub` in the address derivation test.

### Test RPC Connection
The RPC connection test now uses `paseoAssethub` instead of `paseo`:

```bash
curl "http://localhost:5005/wallet/substrate/test/rpc?chain=paseoAssethub&useTestnet=true"
```

## Important Notes

1. **Paseo is NOT asset-bearing**: Regular Paseo cannot be used for balance transfers
2. **Use AssetHub for transactions**: Always use `paseoAssethub` for transaction testing
3. **Different prefixes**: Paseo uses prefix 42, AssetHub uses prefix 47
4. **Different decimals**: Paseo uses 18 decimals, AssetHub uses 10 decimals
5. **Different RPCs**: Different WebSocket endpoints for each chain

## Integration

The following have been updated:
- ✅ Chain configuration (`substrate-chain.config.ts`)
- ✅ Address manager (`substrate-address.manager.ts`)
- ✅ SS58 utility (prefix 47 detection)
- ✅ Test endpoints (documentation updated)
- ✅ RPC connection test (uses AssetHub)

## Next Steps

1. Test transaction construction with AssetHub
2. Test balance transfers on AssetHub
3. Verify address generation with prefix 47
4. Test fee estimation on AssetHub

## References

- [Polkadot AssetHub Documentation](https://docs.polkadot.com/polkadot-protocol/architecture/system-chains/asset-hub/)
- [Paseo Testnet](https://polkadot.js.org/apps/?rpc=wss://rpc.ibp.network/paseo)
- [AssetHub Paseo RPC](https://asset-hub-paseo.dotters.network)

