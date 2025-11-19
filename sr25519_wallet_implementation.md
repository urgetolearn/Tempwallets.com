# Complete SR25519 Polkadot Wallet Implementation Guide
## Multi-Chain Integration with Hydration, Bifrost & Unique Marketplace

---

## Q1: Why should I use SR25519 instead of Ed25519 for Polkadot dApp compatibility?

### Answer:

**SR25519 (Schnorrkel) is the native default cryptographic algorithm for Polkadot/Substrate for several critical reasons:**

#### 1. **Native Schnorr Signatures**
SR25519 uses Schnorr signatures instead of EdDSA, which enables:
- **Native multisignature through signature aggregation** - Multiple signatures can be combined into one
- **Better security properties** compared to Ed25519
- **More efficient cryptographic operations** - Lower computational overhead
- **Built specifically for Polkadot's architecture** - Optimized for the ecosystem

#### 2. **dApp Expectation & Compatibility**
Most Polkadot dApps (Hydration, Bifrost, Unique Marketplace) are optimized for SR25519 accounts by default:
- When you import an SR25519 account into dApps, it works seamlessly
- dApps often display SR25519 as the preferred crypto type
- Transaction signing flows expect SR25519 keypairs
- Cross-chain messaging systems assume SR25519

#### 3. **Ecosystem Standard**
All major Polkadot wallets default to SR25519:
- **Nova Wallet** - Primary Polkadot wallet (SR25519 default)
- **Subwallet** - Multi-chain Substrate wallet (SR25519 primary)
- **Talisman** - Web3 wallet for Polkadot (SR25519 default)
- **Polkadot-JS** - Official UI (SR25519 standard)

### Key Trade-offs to Consider:

**Advantages:**
✓ Network-native, no compatibility layers needed
✓ Better performance on Polkadot networks
✓ All dApps support it natively
✓ Lower development friction
✓ Official recommendation

**Disadvantages:**
✗ Requires WASM initialization (must call `cryptoWaitReady()`)
✗ Cannot use pure JavaScript - needs WebAssembly support
✗ More complex to implement than Ed25519
✗ Non-deterministic signatures (each signature is different for same message)
✗ Larger private key size (64 bytes vs 32 bytes for Ed25519)

### Recommendation:
**Use SR25519 as your primary crypto type.** The minimal additional complexity is worth the seamless ecosystem integration and native performance benefits.

---

## Q2: What are the exact chains I need to support for Hyperbridge, Bifrost & Unique Marketplace compatibility?

### Answer:

#### MAINNET CHAINS (Production Environment)

**1. Polkadot Relay Chain** (Core Infrastructure)
```
Parachain ID:      N/A (relay chain)
Genesis Hash:      0x91b171bb158e2d3848fa23a9f1c25182
SS58 Prefix:       0
Token:             DOT (10 decimal places)
RPC Endpoint:      https://rpc.polkadot.io
Purpose:           Core relay chain, shared security, settlement layer
WalletConnect ID:  polkadot:91b171bb158e2d3848fa23a9f1c25182
```

**2. Hydration (HydraDX)** - DeFi & Liquidity
```
Parachain ID:      2034
Genesis Hash:      0xaf9326e6615b9c21ef01ba1763c475c04057270bf6b6aeb1dd1bd0f3722ab861
SS58 Prefix:       63
Token:             HDX (12 decimal places)
RPC Endpoint:      https://rpc.hydration.cloud
Purpose:           Automated Market Maker (AMM) for liquidity provisioning
WalletConnect ID:  polkadot:af9326e6615b9c21ef01ba1763c475c04057270bf6b6aeb1dd1bd0f3722ab861
```

**3. Bifrost** - Liquid Staking & Cross-Chain Derivatives
```
Parachain ID:      2031
Genesis Hash:      0x262e1b2ad728475fd6fe88e62fb47b7f6c73d6e2a6fc3389a95ff8e6e3de7e89
SS58 Prefix:       6
Token:             BNC (12 decimal places)
RPC Endpoint:      https://rpc.bifrost.finance
Purpose:           Liquid staking, vToken creation, StakeFi solutions
WalletConnect ID:  polkadot:262e1b2ad728475fd6fe88e62fb47b7f6c73d6e2a6fc3389a95ff8e6e3de7e89
```

**4. Unique Marketplace** - NFT Ecosystem
```
Parachain ID:      8880
Genesis Hash:      0x84322d9cddbf35c713341e2c3fb0a0da20d2bbb28221c6521d1bd7fc85949971
SS58 Prefix:       7
Token:             UNQ (18 decimal places)
RPC Endpoint:      https://rpc.unique.network
Purpose:           NFT creation, marketplace, composable digital assets
WalletConnect ID:  polkadot:84322d9cddbf35c713341e2c3fb0a0da20d2bbb28221c6521d1bd7fc85949971
```

**5. Hyperbridge** - Cross-Chain Bridge Infrastructure
```
Parachain ID:      2092
Genesis Hash:      Varies - check official docs
SS58 Prefix:       42 (can vary)
Purpose:           Cross-chain bridging, interoperability layer
Role:              Infrastructure, not a primary dApp
Important:         You connect TO Hyperbridge FROM other chains,
                   not directly for user transactions
```

#### TESTNET CHAINS (Development Environment)

**1. Paseo (Polkadot Testnet)** - Main Testing Ground
```
Relay Chain Genesis Hash:  0xd5d32db5e6c12cdc1a94a4b58a19c59aaab54dfcc6d11ad26dc9db8d5c858ad2
SS58 Prefix:               42
Token:                     PAS
RPC Endpoint:              https://paseo-rpc.dwellir.com
Purpose:                   Test all parachains before mainnet
Faucet:                    https://faucet.polkadot.io (select Paseo)
```

### Recommended Chain Support Strategy:

**Phase 1 - Development (Weeks 1-2):** Paseo testnet only
- Test basic functionality
- Verify address generation
- Test WalletConnect flow

**Phase 2 - Integration (Weeks 3-4):** Add individual parachains on testnet
- Test Hydration integration
- Test Bifrost integration
- Test Unique integration

**Phase 3 - Mainnet Launch (Week 5+):** Migrate to mainnet chains listed above

---

## Q3: Does testnet work the same as mainnet for wallet development?

### Answer:

**SHORT ANSWER:** Yes, testnet works identically for wallet implementation, but with critical differences in configuration that you must track.

### Testnet Advantages for Development:

✓ Free tokens from faucets (no financial risk)
✓ Same chain parameters and formats
✓ Same cryptographic algorithms
✓ Same WalletConnect specifications and session formats
✓ Same RPC interfaces and call structure
✓ Same SS58 address encoding logic
✓ Safe to test extensively without consequences

### Critical Testnet ↔ Mainnet Differences:

#### 1. **Different Genesis Hashes - This is CRITICAL**
- **Mainnet Polkadot:** `0x91b171bb158e2d3848fa23a9f1c25182`
- **Testnet Paseo:** `0xd5d32db5e6c12cdc1a94a4b58a19c59aaab54dfcc6d11ad26dc9db8d5c858ad2`

**Problem:** The SAME seed phrase generates DIFFERENT addresses on testnet vs mainnet because genesis hash is part of address derivation context.

#### 2. **Different Chain IDs for WalletConnect**
- You MUST use the correct genesis hash in CAIP-2 format
- dApps will REJECT connections with wrong genesis hash
- Format: `polkadot:<genesis_hash>:<address>`

#### 3. **RPC Endpoint Differences**
| Aspect | Testnet | Mainnet |
|--------|---------|---------|
| Speed | Often slower (100-500ms) | Fast (10-50ms) |
| Availability | May have scheduled downtime | Always available |
| Data persistence | Chains occasionally reset | Permanent records |
| Load | Lower (fewer users) | Higher (more traffic) |

#### 4. **Security & Validator Differences**
- Testnet: May have fewer validators or centralized setup
- Mainnet: Full validator set, proven security
- Not suitable for production user fund testing on testnet

### Configuration Strategy for Your Wallet:

Store chain configurations separately for dev/prod:

```typescript
const CHAIN_CONFIGS = {
  development: {
    relayChain: {
      name: 'Paseo',
      genesisHash: '0xd5d32db5e6c12cdc1a94a4b58a19c59aaab54dfcc6d11ad26dc9db8d5c858ad2',
      ss58Prefix: 42,
      rpcUrl: 'https://paseo-rpc.dwellir.com',
      isTestnet: true
    },
    parachains: [
      {
        name: 'Hydration (Testnet)',
        paraId: 2034,
        genesisHash: '0x...',
        ss58Prefix: 63,
        rpcUrl: 'https://...',
        isTestnet: true
      }
    ]
  },
  production: {
    relayChain: {
      name: 'Polkadot',
      genesisHash: '0x91b171bb158e2d3848fa23a9f1c25182',
      ss58Prefix: 0,
      rpcUrl: 'https://rpc.polkadot.io',
      isTestnet: false
    },
    parachains: [
      {
        name: 'Hydration',
        paraId: 2034,
        genesisHash: '0xaf9326e6615b9c21ef01ba1763c475c04057270bf6b6aeb1dd1bd0f3722ab861',
        ss58Prefix: 63,
        rpcUrl: 'https://rpc.hydration.cloud',
        isTestnet: false
      }
    ]
  }
};
```

---

## Q4: What are the correct address formats I should implement and validate?

### Answer:

**Address formats work in a three-level hierarchy in your wallet implementation.**

### LEVEL 1: SS58 ADDRESS FORMAT (User Display)

**What it is:** Base58-encoded address with chain-specific prefix for display to users.

**Examples:**
- Polkadot mainnet: `1REAJ39y5Z2V3pzQNMeZnRfKCRvKCb2UTQe3` (starts with '1')
- Generic/Test: `5DTestUPts3kjeXSTMyerHihn1vGRxJhWzJYcNxqH5W5ddiqnL` (starts with '5')
- Kusama: `Ct6qSDfPq1MjJXpBVy6kfPQHsJZ1K3F1K...` (starts with 'C')

**Structure:**
```
base58encode(concat(<address-type>, <public-key-hash>, <checksum>))

├─ Address Type (1-4 bytes): Network identifier
│  ├─ 0:  Polkadot mainnet → '1'
│  ├─ 2:  Kusama → 'C'
│  ├─ 6:  Bifrost → '3'
│  ├─ 7:  Unique → '5' or '1'
│  ├─ 42: Substrate Generic → '5'
│  ├─ 63: Hydration → '7'
│
├─ Public Key Hash: Blake2b hash of public key (32 bytes)
│
└─ Checksum: 2-byte validation hash (prevents typos)
```

**SS58 Prefix Reference Table:**

| Chain | Prefix | Address Start | Mainnet? |
|-------|--------|---|---|
| Polkadot | 0 | `1` | Yes |
| Kusama | 2 | `C` | Yes |
| Bifrost | 6 | `3` | Yes |
| Unique | 7 | `5`/`1` | Yes |
| Substrate Generic | 42 | `5` | N/A |
| Hydration | 63 | `7` | Yes |

### LEVEL 2: CAIP-10 FORMAT (For WalletConnect)

**What it is:** Standardized cross-chain account identifier used in WalletConnect sessions.

**Format:**
```
<namespace>:<network>:<address>

Example:
polkadot:91b171bb158e2d3848fa23a9f1c25182:1REAJ39y5Z2V3pzQNMeZnRfKCRvKCb2UTQe3
```

**Components:**
- **Namespace:** `polkadot` (always for Substrate chains)
- **Network ID:** 64-character genesis hash (chain identifier)
- **Address:** SS58-encoded address for that specific chain

### LEVEL 3: INTERNAL STORAGE FORMAT

**What it is:** How your wallet internally stores account data (NOT the SS58 address).

**Why:** SS58 addresses change with chain prefix, but the public key is universal across all chains. Store the public key, recalculate addresses as needed.

---

## Q5: How do I structure my code to be modular and integrate with existing EVM/Solana wallet code?

### Answer:

**Use a chain adapter architecture with a unified wallet interface that orchestrates all blockchain interactions.**

### Directory Structure (Monorepo Pattern):

```
wallet-monorepo/
├── packages/
│   ├── core-crypto/              ← Shared across all chains
│   │   ├── src/
│   │   │   ├── bip39/
│   │   │   ├── encryption/
│   │   │   ├── storage/
│   │   │   └── index.ts
│   │
│   ├── chain-adapters/           ← Chain-specific implementations
│   │   ├── src/
│   │   │   ├── interfaces/
│   │   │   │   └── IChainAdapter.ts
│   │   │   ├── ethereum/
│   │   │   ├── solana/
│   │   │   ├── polkadot/         ← NEW
│   │   │   │   ├── sr25519Adapter.ts
│   │   │   │   ├── ss58Format.ts
│   │   │   │   ├── rpc.ts
│   │   │   │   └── index.ts
│   │   │   └── index.ts
│   │
│   ├── wallet-core/              ← Orchestrator
│   │   ├── src/
│   │   │   ├── UnifiedWallet.ts
│   │   │   ├── ChainRegistry.ts
│   │   │   ├── AccountManager.ts
│   │   │   └── index.ts
│   │
│   └── wallet-connect-handler/   ← Protocol integration
│       ├── src/
│       │   ├── WalletConnectManager.ts
│       │   ├── PolkadotSessionHandler.ts
│       │   └── index.ts
```

### Core: Common Interfaces

```typescript
export interface IChainAdapter extends EventEmitter {
  config: ChainConfig;
  
  deriveAddress(publicKey: Uint8Array): Promise<string>;
  validateAddress(address: string): Promise<boolean>;
  signTransaction(tx: Transaction, privateKey: Uint8Array): Promise<SignatureResult>;
  signMessage(message: Uint8Array | string, privateKey: Uint8Array): Promise<SignatureResult>;
  constructTransaction(params: Partial<Transaction>): Promise<Transaction>;
  estimateFee(tx: Transaction): Promise<string>;
  getBalance(address: string): Promise<string>;
  getNonce(address: string): Promise<number>;
  sendTransaction(signedTx: any): Promise<string>;
  initialize(): Promise<void>;
  isReady(): boolean;
}
```

---

## Q6: How do I handle the nonce in SR25519 signature generation?

### Answer:

**The nonce in SR25519 is automatic and handled internally by the Schnorrkel library. You don't manually set or manage it.**

### Understanding SR25519 Nonce

#### What is the Nonce?

The nonce in SR25519 is a **randomization factor built into the cryptographic signing algorithm**:

- **NOT** set by the user or application
- **NOT** a transaction counter (that's different)
- **Automatically generated** during signature creation
- **Different every time** you sign the same message
- **Built into the signature itself** - verifier can validate it

#### Key Difference: SR25519 vs Ed25519

```
Ed25519 (Deterministic):
  Input:  Same message + same key = Signature₁
  Input:  Same message + same key = Signature₁ (again)
  Result: Same signature every time

SR25519 (Non-Deterministic):
  Input:  Same message + same key = Signature₁
  Input:  Same message + same key = Signature₂ (different!)
  Input:  Same message + same key = Signature₃ (different!)
  Result: Different signature every time (due to nonce randomization)
```

### Private Key Structure in SR25519

```
Ed25519 Private Key: 32 bytes
  ├─ 32 bytes: Private key material

SR25519 Private Key: 64 bytes
  ├─ 32 bytes: Private key material
  └─ 32 bytes: Nonce/randomization factor
```

When you derive an SR25519 keypair, the library automatically generates this 64-byte private key with embedded nonce material. **This 64-byte key is what you store and use for signing.**

### Implementation - Signing with SR25519:

#### Basic Signing (Automatic Nonce):

```typescript
import { cryptoWaitReady, sr25519PairFromSeed } from '@polkadot/util-crypto';
import { stringToU8a } from '@polkadot/util';

async function signMessageWithSR25519(
  message: string,
  privateKey: Uint8Array // 64-byte key with nonce
): Promise<Uint8Array> {
  // CRITICAL: Ensure WASM is ready first
  await cryptoWaitReady();
  
  // Step 1: Create pair from 64-byte private key
  const pair = sr25519PairFromSeed(privateKey);
  
  // Step 2: Sign message
  // Nonce is handled AUTOMATICALLY by Schnorrkel
  const signature = pair.sign(stringToU8a(message));
  
  // Step 3: Return 64-byte signature
  return signature.signature;
}
```

#### Using Keyring (Recommended):

```typescript
import Keyring from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';

async function signWithKeyring(
  seedPhrase: string,
  derivationPath: string,
  message: string
): Promise<Uint8Array> {
  // Initialize WASM
  await cryptoWaitReady();
  
  // Create keyring with SR25519
  const keyring = new Keyring({ type: 'sr25519' });
  
  // Derive pair from seed
  const pair = keyring.createFromUri(
    `${seedPhrase}${derivationPath}`
  );
  
  // Sign - nonce is automatic
  const signature = pair.sign(stringToU8a(message));
  
  // Extract signature bytes
  return signature.signature;
}
```

### DON'T DO THIS - Manual Nonce Handling:

```typescript
// ❌ WRONG - Don't try to manage nonce yourself
const customNonce = Math.random() * 1000;
const signature = await customSignFunction(message, privateKey, customNonce);

// ❌ WRONG - Don't create custom randomness
const randomBytes = generateRandomBytes(32);
const signature = await signWithRandomness(message, privateKey, randomBytes);

// ❌ WRONG - Don't try to reuse signatures
const sig1 = pair.sign(message);
const sig2 = sig1;
```

### What SHOULD You Do:

```typescript
// ✅ RIGHT - Let Schnorrkel handle everything
async function properSigningFlow(
  seedPhrase: string,
  derivationPath: string,
  message: string
) {
  await cryptoWaitReady();
  
  const keyring = new Keyring({ type: 'sr25519' });
  const pair = keyring.createFromUri(`${seedPhrase}${derivationPath}`);
  
  // Just call sign() - nonce is automatic
  const signature = pair.sign(stringToU8a(message));
  
  return signature.signature;
}
```

---

## Q7: Where and how should I initialize WASM for SR25519?

### Answer:

**Initialize WASM exactly once at application startup, before any SR25519 operations. This is critical for your wallet to function.**

### Why WASM Initialization is Required

SR25519 (Schnorrkel) cryptography has:
- ✓ Only WebAssembly implementation (no JavaScript fallback)
- ✓ Must be loaded and compiled into browser/runtime memory
- ✓ Takes 100-500ms first time (then cached)
- ✓ Required before any key derivation, signing, or verification

### Initialization Location Strategy

#### Option 1: Application Entry Point (RECOMMENDED)

```typescript
// src/main.ts or src/index.ts
import { cryptoWaitReady } from '@polkadot/util-crypto';

async function initializeApplication() {
  console.time('Crypto initialization');
  
  try {
    // Initialize WASM - MUST be first
    console.log('Initializing cryptography...');
    await cryptoWaitReady();
    console.timeEnd('Crypto initialization');
    
    console.log('✓ Cryptography ready - SR25519 available');
    
    // Now initialize wallet and other modules
    await initializeWallet();
    await initializeUI();
    
    // Render app
    renderApplication();
    
  } catch (error) {
    console.error('Failed to initialize application:', error);
    displayError('Failed to initialize wallet. Please refresh the page.');
    process.exit(1);
  }
}

// Start the app
initializeApplication();
```

#### Option 2: React Component (Web Apps)

```typescript
// src/components/WalletProvider.tsx
import React, { useEffect, useState } from 'react';
import { cryptoWaitReady } from '@polkadot/util-crypto';

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    cryptoWaitReady()
      .then(() => {
        console.log('✓ WASM initialized');
        setIsReady(true);
      })
      .catch((err) => {
        console.error('WASM initialization failed:', err);
        setError(err);
      });
  }, []);
  
  if (error) {
    return <div>Error: Failed to initialize wallet</div>;
  }
  
  if (!isReady) {
    return <div>Loading wallet...</div>;
  }
  
  return <>{children}</>;
};
```

#### Option 3: Next.js

```typescript
// src/lib/crypto-init.ts
import { cryptoWaitReady } from '@polkadot/util-crypto';

let cryptoReady: Promise<void> | null = null;

export async function ensureCryptoReady(): Promise<void> {
  if (!cryptoReady) {
    cryptoReady = cryptoWaitReady();
  }
  return cryptoReady;
}

// pages/_app.tsx
function MyApp({ Component, pageProps }: any) {
  const [isReady, setIsReady] = useState(false);
  
  useEffect(() => {
    ensureCryptoReady().then(() => setIsReady(true));
  }, []);
  
  if (!isReady) return <div>Initializing wallet...</div>;
  
  return <Component {...pageProps} />;
}
```

### Initialization in Your Modular Wallet

```typescript
// src/wallet/WalletFactory.ts
import { cryptoWaitReady } from '@polkadot/util-crypto';

export class WalletFactory {
  private static cryptoReady: Promise<void> | null = null;
  private static isInitialized = false;
  
  static async ensureCryptoReady(): Promise<void> {
    if (!WalletFactory.cryptoReady) {
      console.log('Initializing WASM globally...');
      WalletFactory.cryptoReady = cryptoWaitReady();
    }
    return WalletFactory.cryptoReady;
  }
  
  static async createWallet(): Promise<UnifiedWallet> {
    if (WalletFactory.isInitialized) {
      return WalletFactory.instance;
    }
    
    // Initialize WASM
    await WalletFactory.ensureCryptoReady();
    console.log('✓ WASM initialized');
    
    // Initialize other components...
    
    WalletFactory.isInitialized = true;
    return wallet;
  }
}
```

---

## Q8: How do I implement JSON export in Polkadot.js-compatible format?

### Answer:

**JSON export encrypts your account's private key and stores metadata in a format compatible with Polkadot-JS UI, Nova Wallet, and Subwallet.**

### Complete Polkadot.js JSON Backup Format

```json
{
  "encoded": "0x7d5f1b4c9e2a8f3b6d9c1e4a7f2b5d8e9c1f4a7b0d3e6f9c2e5a8b1d4f7a0c3e6b9d2f5a8e1c4f7b0d3e6f9c2e5a8b1d4f7a0c3e6b9d2f5a8e1c4f7b0d3e6f9c2e5a8b1d4f7a0c3e6b9d2f5a8e1c4f7b0d3e6f9c2e5a8b1d4f7a0c3e6b9d2f5a8e1c4f7b0d3e6f9c2e5a8b1d4f7a0c3e6b9d2f5a8e1c4f7b0d3e",
  "encoding": {
    "content": ["pkcs8", "sr25519"],
    "type": ["scrypt", "xsalsa20-poly1305"],
    "version": "3"
  },
  "address": "1REAJ39y5Z2V3pzQNMeZnRfKCRvKCb2UTQe3",
  "meta": {
    "genesisHash": "0x91b171bb158e2d3848fa23a9f1c25182",
    "name": "My Polkadot Account",
    "whenCreated": 1634567890123,
    "chainType": "polkadot",
    "derivationPath": "//44//354//0//0//0"
  }
}
```

### Implementation - Export Account to JSON

#### Simple Approach (Using @polkadot/keyring)

```typescript
import Keyring from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';

async function exportAccountAsJSON(
  seedPhrase: string,
  derivationPath: string,
  password: string,
  genesisHash: string,
  ss58Prefix: number,
  accountName: string
): Promise<string> {
  await cryptoWaitReady();
  
  const keyring = new Keyring({
    type: 'sr25519',
    ss58Format: ss58Prefix
  });
  
  const pair = keyring.createFromUri(
    `${seedPhrase}${derivationPath}`,
    { name: accountName, genesisHash }
  );
  
  const json = keyring.toJson(pair.address, password);
  
  if (!json.meta) json.meta = {};
  json.meta.chainType = 'polkadot';
  json.meta.derivationPath = derivationPath;
  
  return JSON.stringify(json, null, 2);
}
```

### Web File Handling (Browser)

```typescript
// Export: Download JSON file
function downloadAccountJSON(jsonData: string, filename: string) {
  const blob = new Blob([jsonData], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

// Import: Handle file upload
async function handleFileImport(event: React.ChangeEvent<HTMLInputElement>) {
  const file = event.target.files?.[0];
  if (!file) return;
  
  const password = prompt('Enter password:');
  if (!password) return;
  
  try {
    const content = await file.text();
    const account = await importAccountFromJSON(content, password);
    console.log('Imported:', account);
  } catch (error) {
    alert(`Import failed: ${error.message}`);
  }
}
```

### Import Account from JSON

```typescript
async function importAccountFromJSON(
  jsonContent: string,
  password: string,
  ss58Prefix?: number
): Promise<{
  address: string;
  name: string;
  genesisHash: string;
}> {
  await cryptoWaitReady();
  
  const json = JSON.parse(jsonContent);
  const keyring = new Keyring({
    type: 'sr25519',
    ss58Format: ss58Prefix || 42
  });
  
  const pair = keyring.addFromJson(json);
  pair.unlock(password);
  
  return {
    address: pair.address,
    name: pair.meta.name as string,
    genesisHash: (pair.meta.genesisHash as string) || ''
  };
}
```

---

## Q9: How do I avoid Session Proposal Rejection from dApps? (WalletConnect Best Practices)

### Answer:

**Session rejection happens when your wallet doesn't support all the methods and chains the dApp requires. Solve this by implementing comprehensive support upfront.**

### Root Causes of Session Rejection

1. **Missing Required Methods** - dApp requests methods you don't support
2. **Missing Required Chains** - dApp needs chains not in your response
3. **Incorrect Namespace Format** - CAIP-2 or CAIP-10 format wrong
4. **Incompatible Chain Configuration** - Genesis hash or prefix mismatch
5. **Missing Event Handlers** - accountsChanged or chainChanged not implemented
6. **Protocol Version Mismatch** - WalletConnect v1 vs v2 incompatibility

### Solution 1: Implement ALL Required Methods

**Methods dApps require:**

```typescript
const REQUIRED_POLKADOT_METHODS = [
  'polkadot_signTransaction',     // PRIMARY: Sign blockchain transactions
  'polkadot_signMessage',         // PRIMARY: Sign arbitrary messages
  'polkadot_signRaw',             // OPTIONAL: Sign raw bytes
  'polkadot_getSignedHex'         // OPTIONAL: Alternative method name
];
```

**Implementation:**

```typescript
import WalletKit from '@walletconnect/walletkit';

class PolkadotWalletConnectManager {
  async approveSession(proposal: any) {
    const sessionNamespaces = {
      polkadot: {
        chains: [
          'polkadot:91b171bb158e2d3848fa23a9f1c25182',
          'polkadot:af9326e6615b9c21ef01ba1763c475c04057270bf6b6aeb1dd1bd0f3722ab861'
        ],
        methods: [
          'polkadot_signTransaction',
          'polkadot_signMessage',
          'polkadot_signRaw',
          'polkadot_getSignedHex'
        ],
        events: [
          'accountsChanged',
          'chainChanged'
        ],
        accounts: [
          'polkadot:91b171bb158e2d3848fa23a9f1c25182:1REAJ39y5Z2V3pzQNMeZnRfKCRvKCb2UTQe3'
        ]
      }
    };
    
    await this.walletKit.approveSession({
      id: proposal.id,
      namespaces: sessionNamespaces
    });
  }
}
```

### Solution 2: Support Multiple Chains

```typescript
const SUPPORTED_CHAINS = {
  'polkadot:91b171bb158e2d3848fa23a9f1c25182': {
    name: 'Polkadot',
    methods: ['polkadot_signTransaction', 'polkadot_signMessage']
  },
  'polkadot:af9326e6615b9c21ef01ba1763c475c04057270bf6b6aeb1dd1bd0f3722ab861': {
    name: 'Hydration',
    methods: ['polkadot_signTransaction', 'polkadot_signMessage']
  },
  'polkadot:262e1b2ad728475fd6fe88e62fb47b7f6c73d6e2a6fc3389a95ff8e6e3de7e89': {
    name: 'Bifrost',
    methods: ['polkadot_signTransaction', 'polkadot_signMessage']
  }
};
```

### Solution 3: Correct Namespace Format (CRITICAL)

```typescript
// ❌ WRONG Format
{
  polkadot: {
    chains: ['polkadot:123'],  // Too short
    accounts: ['1REAJ39y5...']  // Missing chain ID
  }
}

// ✅ CORRECT Format
{
  polkadot: {
    chains: ['polkadot:91b171bb158e2d3848fa23a9f1c25182'],
    methods: ['polkadot_signTransaction', 'polkadot_signMessage'],
    events: ['accountsChanged', 'chainChanged'],
    accounts: [
      'polkadot:91b171bb158e2d3848fa23a9f1c25182:1REAJ39y5Z2V3pzQNMeZnRfKCRvKCb2UTQe3'
    ]
  }
}
```

### Solution 4: Implement ALL Event Handlers

```typescript
class EventManager {
  private emitter: EventEmitter;
  
  setupEventHandlers() {
    this.emitter.on('accountsChanged', (data) => {
      this.walletKit.emitSessionEvent({
        event: {
          name: 'accountsChanged',
          data: data.accounts
        }
      });
    });
    
    this.emitter.on('chainChanged', (data) => {
      this.walletKit.emitSessionEvent({
        event: {
          name: 'chainChanged',
          data: data.chainId
        }
      });
    });
  }
}
```

### Solution 5: Implement Request Handlers

```typescript
async handleRequest(request: { method: string; id: number; params: any }) {
  switch (request.method) {
    case 'polkadot_signTransaction':
      return await this.handleSignTransaction(request);
    case 'polkadot_signMessage':
      return await this.handleSignMessage(request);
    case 'polkadot_signRaw':
      return await this.handleSignRaw(request);
    default:
      throw new Error(`Unsupported method: ${request.method}`);
  }
}
```

### Solution 6: Error Response with Correct Codes

```typescript
const ERROR_CODES = {
  USER_REJECTED: 4001,
  UNSUPPORTED_METHOD: 4200,
  UNSUPPORTED_CHAIN: 4902,
  INTERNAL_ERROR: -32603
};

function createErrorResponse(id: number, code: number, message: string) {
  return {
    id,
    error: {
      code,
      message,
      data: { cause: message }
    }
  };
}
```

### Solution 7: Validate Proposal BEFORE Approval

```typescript
function validateSessionProposal(proposal: any) {
  const errors: string[] = [];
  
  if (!proposal.requiredNamespaces.polkadot) {
    errors.push('Missing polkadot namespace');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
```

---

## Quick Reference: Essential Chain IDs for Your Wallet

```typescript
export const ESSENTIAL_CHAINS = {
  POLKADOT: {
    genesis: '0x91b171bb158e2d3848fa23a9f1c25182',
    prefix: 0,
    name: 'Polkadot',
    rpc: 'wss://rpc.polkadot.io'
  },
  HYDRATION: {
    genesis: '0xaf9326e6615b9c21ef01ba1763c475c04057270bf6b6aeb1dd1bd0f3722ab861',
    prefix: 63,
    name: 'Hydration',
    rpc: 'wss://rpc.hydration.cloud',
    paraId: 2034
  },
  BIFROST: {
    genesis: '0x262e1b2ad728475fd6fe88e62fb47b7f6c73d6e2a6fc3389a95ff8e6e3de7e89',
    prefix: 6,
    name: 'Bifrost',
    rpc: 'wss://rpc.bifrost.finance',
    paraId: 2031
  },
  UNIQUE: {
    genesis: '0x84322d9cddbf35c713341e2c3fb0a0da20d2bbb28221c6521d1bd7fc85949971',
    prefix: 7,
    name: 'Unique',
    rpc: 'wss://rpc.unique.network',
    paraId: 8880
  }
};
```

---

## Implementation Priority & Timeline

**Week 1-2: Foundation**
- WASM initialization
- SR25519 key generation
- SS58 address formatting
- Basic signing

**Week 3-4: Polkadot Integration**
- Multi-chain account derivation
- Account manager
- JSON export/import
- Modular adapter architecture

**Week 5-6: WalletConnect**
- WalletConnect v2 integration
- Session management
- Request handlers
- Event handling

**Week 7+: Polish & Deploy**
- Error handling
- Edge cases
- Testing
- Mainnet launch

---

**This guide covers all 9 critical questions for SR25519 Polkadot wallet development. Use this as your complete reference for implementation.**