# WalletConnect Modular Architecture Plan

## 📋 Executive Summary

This document outlines a **modular, extensible WalletConnect architecture** that supports multiple blockchain ecosystems (EVM, Substrate, Solana, Bitcoin, etc.) without affecting the existing Substrate implementation.

### Key Design Principles

1. **Namespace-Based Architecture**: Each blockchain ecosystem (EIP155/EVM, Polkadot/Substrate, Solana, etc.) operates as an independent namespace
2. **Interface-Driven Design**: All wallet connection implementations follow a common interface pattern
3. **Lazy Initialization**: WalletConnect clients initialize only when needed to prevent conflicts
4. **Error Isolation**: Failures in one namespace don't affect others
5. **Non-Breaking Changes**: Existing Substrate flow remains completely unchanged

---

## 🏗️ Current Architecture Overview

### Existing Substrate Implementation

**Frontend Hook**: `useSubstrateWalletConnect`
- Location: `apps/web/hooks/useSubstrateWalletConnect.ts`
- Purpose: Manages Substrate WalletConnect sessions
- Namespace: `polkadot`
- Methods: `polkadot_signTransaction`, `polkadot_signMessage`

**Backend Service**: `SubstrateWalletConnectService`
- Location: `apps/backend/src/wallet/substrate/services/substrate-walletconnect.service.ts`
- Purpose: Signs transactions and messages for Substrate chains
- Format: CAIP-10 (`polkadot:<genesis_hash>:<address>`)

**Backend Controller**: `SubstrateWalletConnectController`
- Location: `apps/backend/src/wallet/substrate/substrate-walletconnect.controller.ts`
- Endpoints:
  - `GET /wallet/substrate/walletconnect/accounts`
  - `POST /wallet/substrate/walletconnect/sign-transaction`
  - `POST /wallet/substrate/walletconnect/sign-message`

---

## 🎯 Proposed Modular Architecture

### 1. Core Abstraction Layer

#### Base Interface: `IWalletConnectProvider`

```typescript
interface IWalletConnectProvider<TSession = any, TAccount = any> {
  // Lifecycle
  initialize(): Promise<void>;
  dispose(): Promise<void>;
  
  // Session Management
  pair(uri: string): Promise<void>;
  disconnect(topic: string): Promise<void>;
  getSessions(): TSession[];
  
  // Account Management
  getAccounts(): Promise<TAccount[]>;
  
  // Signing Operations
  signTransaction(params: SignTransactionParams): Promise<SignatureResult>;
  signMessage(params: SignMessageParams): Promise<SignatureResult>;
  
  // State
  isInitializing: boolean;
  error: string | null;
  
  // Namespace identifier
  namespace: string; // 'eip155', 'polkadot', 'solana', etc.
}

interface SignTransactionParams {
  accountId: string; // CAIP-10 format
  transactionPayload: any; // Chain-specific format
  metadata?: Record<string, any>;
}

interface SignMessageParams {
  accountId: string;
  message: string | Uint8Array;
  metadata?: Record<string, any>;
}

interface SignatureResult {
  signature: string;
  metadata?: Record<string, any>;
}
```

---

### 2. Namespace Implementations

#### A. Substrate (Existing - Already Implemented ✅)

**Hook**: `useSubstrateWalletConnect`
- Namespace: `polkadot`
- Methods: `polkadot_signTransaction`, `polkadot_signMessage`
- Format: `polkadot:<genesis_hash>:<address>`

#### B. EVM (New - To Be Implemented)

**Hook**: `useEvmWalletConnect`
- Namespace: `eip155`
- Methods: `eth_sendTransaction`, `eth_signTransaction`, `personal_sign`, `eth_signTypedData`
- Format: `eip155:<chain_id>:<address>`
- Chains: Ethereum (1), Base (8453), Arbitrum (42161), Polygon (137), Avalanche (43114)

**Backend Service**: `EvmWalletConnectService`
```typescript
class EvmWalletConnectService {
  // Format EVM address to CAIP-10
  formatAccountId(chainId: number, address: string): string
  
  // Parse CAIP-10 to extract chainId and address
  parseAccountId(accountId: string): { chainId: number; address: string } | null
  
  // Sign transaction (EIP-1559 or Legacy)
  signTransaction(userId: string, accountId: string, tx: EvmTransaction): Promise<{ signature: string; txHash?: string }>
  
  // Sign message (personal_sign)
  signMessage(userId: string, accountId: string, message: string): Promise<{ signature: string }>
  
  // Sign typed data (EIP-712)
  signTypedData(userId: string, accountId: string, typedData: any): Promise<{ signature: string }>
  
  // Get all EVM accounts for WalletConnect
  getFormattedAccounts(userId: string): Promise<Array<{ accountId: string; chainId: number; address: string }>>
}
```

**Backend Controller**: `EvmWalletConnectController`
```typescript
@Controller('wallet/evm/walletconnect')
class EvmWalletConnectController {
  @Get('accounts')
  async getAccounts(@Query('userId') userId: string)
  
  @Post('sign-transaction')
  async signTransaction(@Body() dto: EvmWalletConnectSignTransactionDto)
  
  @Post('sign-message')
  async signMessage(@Body() dto: EvmWalletConnectSignMessageDto)
  
  @Post('sign-typed-data')
  async signTypedData(@Body() dto: EvmWalletConnectSignTypedDataDto)
}
```

#### C. Solana (Future)

**Hook**: `useSolanaWalletConnect`
- Namespace: `solana`
- Methods: `solana_signTransaction`, `solana_signMessage`
- Format: `solana:<genesis_hash>:<address>`

#### D. Bitcoin (Future)

**Hook**: `useBitcoinWalletConnect`
- Namespace: `bip122`
- Methods: `bitcoin_signTransaction`, `bitcoin_signMessage`
- Format: `bip122:<genesis_hash>:<address>`

---

### 3. Unified Hook Factory

**Hook**: `useMultiChainWalletConnect`

```typescript
interface UseMultiChainWalletConnectProps {
  userId: string | null;
  enabledNamespaces?: ('eip155' | 'polkadot' | 'solana' | 'bip122')[];
}

interface UseMultiChainWalletConnectReturn {
  // Clients
  evmProvider: IWalletConnectProvider | null;
  substrateProvider: IWalletConnectProvider | null;
  solanaProvider: IWalletConnectProvider | null;
  bitcoinProvider: IWalletConnectProvider | null;
  
  // Unified session list
  allSessions: Array<{
    namespace: string;
    topic: string;
    peer: any;
    accounts: string[]; // CAIP-10 format
  }>;
  
  // Unified operations
  pair(uri: string): Promise<void>; // Auto-detects namespace from URI
  disconnect(topic: string): Promise<void>;
  disconnectAll(): Promise<void>;
  
  // State
  isInitializing: boolean;
  error: string | null;
}

function useMultiChainWalletConnect(props: UseMultiChainWalletConnectProps): UseMultiChainWalletConnectReturn {
  const { userId, enabledNamespaces = ['eip155', 'polkadot'] } = props;
  
  // Initialize providers based on enabled namespaces
  const evmProvider = enabledNamespaces.includes('eip155') 
    ? useEvmWalletConnect(userId)
    : null;
    
  const substrateProvider = enabledNamespaces.includes('polkadot')
    ? useSubstrateWalletConnect(userId)
    : null;
  
  // ... similar for other namespaces
  
  // Aggregate sessions from all providers
  const allSessions = useMemo(() => {
    const sessions: any[] = [];
    if (evmProvider) sessions.push(...evmProvider.sessions.map(s => ({ ...s, namespace: 'eip155' })));
    if (substrateProvider) sessions.push(...substrateProvider.sessions.map(s => ({ ...s, namespace: 'polkadot' })));
    return sessions;
  }, [evmProvider?.sessions, substrateProvider?.sessions]);
  
  // Auto-detect namespace from URI and pair with appropriate provider
  const pair = useCallback(async (uri: string) => {
    // Parse URI to detect namespace
    // For now, we can use heuristics or proposal data
    
    // WalletConnect URIs are namespace-agnostic at the pairing stage
    // The namespace is determined during session_proposal
    
    // Try all enabled providers in parallel
    const promises = [];
    if (evmProvider) promises.push(evmProvider.pair(uri).catch(() => null));
    if (substrateProvider) promises.push(substrateProvider.pair(uri).catch(() => null));
    
    await Promise.all(promises);
  }, [evmProvider, substrateProvider]);
  
  return {
    evmProvider,
    substrateProvider,
    solanaProvider,
    bitcoinProvider,
    allSessions,
    pair,
    disconnect: async (topic) => {
      // Find which provider owns this session
      if (evmProvider?.sessions.some(s => s.topic === topic)) {
        await evmProvider.disconnect(topic);
      } else if (substrateProvider?.sessions.some(s => s.topic === topic)) {
        await substrateProvider.disconnect(topic);
      }
      // ... check other providers
    },
    disconnectAll: async () => {
      await Promise.all([
        evmProvider?.disconnect,
        substrateProvider?.disconnect,
      ].filter(Boolean));
    },
    isInitializing: evmProvider?.isInitializing || substrateProvider?.isInitializing || false,
    error: evmProvider?.error || substrateProvider?.error || null,
  };
}
```

---

## 🔄 Data Flow Diagrams

### Connection Flow

```
DApp                Frontend                Backend
 |                     |                       |
 |-- WalletConnect URI -->                    |
 |                     |                       |
 |                  [Parse URI]               |
 |                  [Detect Namespace]        |
 |                     |                       |
 |                     |-- Get Accounts ------>|
 |                     |                       |
 |                     |    (For namespace)    |
 |                     |                       |
 |                     |<-- Accounts List -----|
 |                     |     (CAIP-10)         |
 |                     |                       |
 |                [Approval Dialog]            |
 |                     |                       |
 |<-- Session Approved |                       |
 |                     |                       |
```

### Transaction Signing Flow

```
DApp                Frontend                Backend
 |                     |                       |
 |-- Sign Request ---->|                       |
 |  (via WalletConnect)|                       |
 |                     |                       |
 |                [Confirmation Dialog]        |
 |                [User Approves]              |
 |                     |                       |
 |                     |-- Sign Request ------>|
 |                     |   (accountId + tx)    |
 |                     |                       |
 |                     |                [Verify Account]
 |                     |                [Load Keys]
 |                     |                [Sign Tx]
 |                     |                       |
 |                     |<-- Signature ---------|
 |                     |                       |
 |<-- Signed Tx -------|                       |
 |                     |                       |
```

---

## 📁 File Structure

```
apps/
├── web/
│   ├── hooks/
│   │   ├── walletconnect/
│   │   │   ├── types.ts                     # Shared types and interfaces
│   │   │   ├── useEvmWalletConnect.ts       # EVM implementation
│   │   │   ├── useSubstrateWalletConnect.ts # Substrate (existing)
│   │   │   ├── useSolanaWalletConnect.ts    # Solana (future)
│   │   │   ├── useBitcoinWalletConnect.ts   # Bitcoin (future)
│   │   │   └── useMultiChainWalletConnect.ts # Unified hook
│   │   ├── useWallet.ts                     # Existing wallet hook
│   │   └── useSubstrateWalletConnect.ts     # (Legacy - move to walletconnect/)
│   ├── components/
│   │   └── walletconnect/
│   │       ├── EvmWalletConnect.tsx         # EVM UI component
│   │       ├── SubstrateWalletConnect.tsx   # Substrate UI (existing)
│   │       ├── MultiChainWalletConnect.tsx  # Unified UI
│   │       └── SessionCard.tsx              # Reusable session card
│   └── lib/
│       └── api.ts                           # API functions (existing)
│
└── backend/
    └── src/
        └── wallet/
            ├── walletconnect/               # Shared WalletConnect logic
            │   ├── interfaces/
            │   │   └── wallet-connect.interface.ts
            │   ├── dto/
            │   │   └── wallet-connect.dto.ts
            │   └── utils/
            │       └── caip.utils.ts        # CAIP-10 formatting utilities
            │
            ├── evm/                         # EVM-specific
            │   └── walletconnect/
            │       ├── evm-walletconnect.controller.ts
            │       ├── evm-walletconnect.service.ts
            │       └── dto/
            │           └── evm-walletconnect.dto.ts
            │
            └── substrate/                   # Substrate (existing)
                └── walletconnect/
                    ├── substrate-walletconnect.controller.ts
                    └── substrate-walletconnect.service.ts
```

---

## 🛠️ Implementation Phases

### Phase 1: Infrastructure Setup ✅ (Completed for Substrate)

- [x] Define base interfaces (`IWalletConnectProvider`)
- [x] Implement Substrate provider
- [x] Backend service and controller for Substrate
- [x] Frontend hook for Substrate

### Phase 2: EVM Implementation (Next)

**Step 2.1: Backend EVM Service**
- [ ] Create `EvmWalletConnectService`
- [ ] Implement CAIP-10 formatting for EVM
- [ ] Add transaction signing (EIP-1559, Legacy)
- [ ] Add message signing (personal_sign)
- [ ] Add typed data signing (EIP-712)

**Step 2.2: Backend EVM Controller**
- [ ] Create `EvmWalletConnectController`
- [ ] Add endpoints:
  - `GET /wallet/evm/walletconnect/accounts`
  - `POST /wallet/evm/walletconnect/sign-transaction`
  - `POST /wallet/evm/walletconnect/sign-message`
  - `POST /wallet/evm/walletconnect/sign-typed-data`

**Step 2.3: Frontend EVM Hook**
- [ ] Create `useEvmWalletConnect` hook
- [ ] Initialize separate WalletConnect client for EIP155
- [ ] Handle `eth_sendTransaction`, `personal_sign`, `eth_signTypedData`
- [ ] Integrate with backend API

**Step 2.4: Frontend EVM UI**
- [ ] Create `EvmWalletConnect.tsx` component
- [ ] Add connection UI
- [ ] Add session management
- [ ] Add signing confirmations

### Phase 3: Unified Multi-Chain Interface

**Step 3.1: Unified Hook**
- [ ] Create `useMultiChainWalletConnect`
- [ ] Aggregate sessions from all providers
- [ ] Implement namespace detection from URI
- [ ] Handle cross-provider operations

**Step 3.2: Unified UI**
- [ ] Create `MultiChainWalletConnect.tsx`
- [ ] Display all sessions (EVM + Substrate + others)
- [ ] Namespace-aware session cards
- [ ] Unified pairing interface

### Phase 4: Additional Chains (Future)

**Step 4.1: Solana**
- [ ] Implement `useSolanaWalletConnect`
- [ ] Backend service and controller
- [ ] UI components

**Step 4.2: Bitcoin**
- [ ] Implement `useBitcoinWalletConnect`
- [ ] Backend service and controller
- [ ] UI components

---

## 🔐 Security Considerations

### 1. Account Ownership Verification

**Before signing any transaction or message:**
```typescript
// Backend validation
const userAddress = await addressManager.getAddress(userId, chain);
if (userAddress !== parsedAccountId.address) {
  throw new UnauthorizedException('Address does not belong to user');
}
```

### 2. User Confirmation

**All signing operations require explicit user approval:**
- Display transaction details
- Show recipient address and amount
- Require confirmation dialog

### 3. Session Isolation

**Each namespace has its own WalletConnect client:**
- Prevents namespace conflicts
- Isolates errors
- Independent session management

### 4. Storage Isolation

**Each client uses separate storage keys:**
```typescript
// EVM client
const evmClient = await SignClient.init({
  projectId,
  metadata: { name: 'Tempwallets EVM', ... },
  // Storage automatically isolated by client instance
});

// Substrate client
const substrateClient = await SignClient.init({
  projectId,
  metadata: { name: 'Tempwallets Substrate', ... },
  // Different instance = different storage
});
```

### 5. CAIP-10 Format Validation

**Always validate CAIP-10 format:**
```typescript
function validateCaip10(accountId: string): boolean {
  // Format: <namespace>:<reference>:<address>
  const parts = accountId.split(':');
  return parts.length === 3 && 
         parts[0].length > 0 && 
         parts[1].length > 0 && 
         parts[2].length > 0;
}
```

---

## 🧪 Testing Strategy

### Unit Tests

**Backend Services:**
- Test CAIP-10 formatting/parsing
- Test transaction signing
- Test message signing
- Test account ownership verification

**Frontend Hooks:**
- Test session management
- Test pairing flow
- Test error handling
- Test lazy initialization

### Integration Tests

**End-to-End Flow:**
1. Connect to DApp
2. Approve session
3. Sign transaction
4. Verify signature
5. Disconnect session

**Multi-Chain Testing:**
1. Connect to EVM DApp
2. Connect to Substrate DApp
3. Verify both sessions coexist
4. Sign transactions from both
5. Disconnect independently

### Manual Testing

**Test DApps:**
- **EVM**: Uniswap, Aave, OpenSea
- **Substrate**: Hydration, Bifrost, Unique Network
- **Cross-Chain**: Test simultaneous connections

---

## 🚀 Migration Strategy

### Non-Breaking Changes

The existing Substrate implementation will **NOT** be affected:

1. **Existing Hook**: `useSubstrateWalletConnect` remains unchanged
2. **Existing Backend**: Substrate endpoints remain unchanged
3. **Existing UI**: Substrate components work as-is

### Gradual Adoption

**Option 1: Keep Separate (Recommended for Initial Release)**
```typescript
// Substrate-only page
<SubstrateWalletConnect userId={userId} />

// EVM-only page
<EvmWalletConnect userId={userId} />
```

**Option 2: Unified Interface (Future)**
```typescript
// Multi-chain page
<MultiChainWalletConnect 
  userId={userId} 
  enabledNamespaces={['eip155', 'polkadot']} 
/>
```

### Backward Compatibility

- All existing Substrate endpoints remain functional
- No changes to Substrate wallet logic
- Existing UI components continue to work
- New features are additive only

---

## 📊 Performance Considerations

### 1. Lazy Initialization

**Problem**: Multiple WalletConnect clients can cause storage conflicts

**Solution**: Initialize clients only when needed
```typescript
const initialize = useCallback(async () => {
  if (isInitialized.current) return;
  // Initialize client
  isInitialized.current = true;
}, []);
```

### 2. Client Caching

**Use global client instances to prevent re-initialization:**
```typescript
let globalEvmClient: SignClient | null = null;
let globalSubstrateClient: SignClient | null = null;
```

### 3. Stale Session Cleanup

**Regularly clean up invalid sessions:**
```typescript
useEffect(() => {
  const cleanup = async () => {
    const sessions = client.session.getAll();
    for (const session of sessions) {
      if (!session.topic || !session.namespaces) {
        await client.disconnect({ topic: session.topic, reason: { code: 6000, message: 'Stale session' }});
      }
    }
  };
  cleanup();
}, [client]);
```

### 4. Error Boundaries

**Wrap components in error boundaries:**
```typescript
<ErrorBoundary>
  <MultiChainWalletConnect userId={userId} />
</ErrorBoundary>
```

---

## 🎨 UI/UX Design

### Session Card Design

```
┌─────────────────────────────────────────┐
│ 🌐 Uniswap                              │
│ https://app.uniswap.org                 │
│                                         │
│ Namespace: EIP155                       │
│ Chains: Ethereum (1), Base (8453)      │
│ Accounts: 2                             │
│                                         │
│ 0x1234...5678 (Ethereum)               │
│ 0x1234...5678 (Base)                   │
│                                         │
│                    [Disconnect]         │
└─────────────────────────────────────────┘
```

### Multi-Chain Tab Design

```
┌─────────────────────────────────────────┐
│  [ EVM ]  [ Substrate ]  [ Solana ]     │
├─────────────────────────────────────────┤
│                                         │
│  Connected to 3 DApps                  │
│                                         │
│  [Session Card 1]                      │
│  [Session Card 2]                      │
│  [Session Card 3]                      │
│                                         │
│  Paste WalletConnect URI:               │
│  ┌───────────────────────────────┐     │
│  │ wc:...                        │ 📋  │
│  └───────────────────────────────┘     │
│                        [Connect]        │
└─────────────────────────────────────────┘
```

---

## 📚 API Reference

### Backend Endpoints

#### EVM WalletConnect

**Get EVM Accounts**
```
GET /wallet/evm/walletconnect/accounts?userId={userId}

Response:
{
  "userId": "user123",
  "accounts": [
    {
      "accountId": "eip155:1:0x1234...5678",
      "chainId": 1,
      "address": "0x1234...5678"
    },
    {
      "accountId": "eip155:8453:0x1234...5678",
      "chainId": 8453,
      "address": "0x1234...5678"
    }
  ]
}
```

**Sign Transaction**
```
POST /wallet/evm/walletconnect/sign-transaction

Body:
{
  "userId": "user123",
  "accountId": "eip155:1:0x1234...5678",
  "transaction": {
    "to": "0xabcd...ef01",
    "value": "0x0",
    "data": "0x...",
    "gas": "0x5208",
    "maxFeePerGas": "0x...",
    "maxPriorityFeePerGas": "0x..."
  }
}

Response:
{
  "signature": "0x...",
  "txHash": "0x..."
}
```

**Sign Message**
```
POST /wallet/evm/walletconnect/sign-message

Body:
{
  "userId": "user123",
  "accountId": "eip155:1:0x1234...5678",
  "message": "Hello, World!"
}

Response:
{
  "signature": "0x..."
}
```

**Sign Typed Data (EIP-712)**
```
POST /wallet/evm/walletconnect/sign-typed-data

Body:
{
  "userId": "user123",
  "accountId": "eip155:1:0x1234...5678",
  "typedData": {
    "domain": { ... },
    "types": { ... },
    "primaryType": "...",
    "message": { ... }
  }
}

Response:
{
  "signature": "0x..."
}
```

#### Substrate WalletConnect (Existing - No Changes)

**Get Substrate Accounts**
```
GET /wallet/substrate/walletconnect/accounts?userId={userId}&useTestnet=false
```

**Sign Transaction**
```
POST /wallet/substrate/walletconnect/sign-transaction
```

**Sign Message**
```
POST /wallet/substrate/walletconnect/sign-message
```

---

## 🎯 Success Metrics

### Functional Requirements

- [ ] Successfully connect to EVM DApps (Uniswap, etc.)
- [ ] Successfully connect to Substrate DApps (Hydration, etc.)
- [ ] Sign EVM transactions
- [ ] Sign Substrate transactions
- [ ] Multiple simultaneous sessions
- [ ] Independent session disconnection

### Performance Requirements

- [ ] Initialization time < 2 seconds
- [ ] No storage conflicts between namespaces
- [ ] No dropped connections
- [ ] Proper error handling and recovery

### Security Requirements

- [ ] Account ownership verification
- [ ] User confirmation for all signatures
- [ ] Secure key management
- [ ] CAIP-10 format validation

---

## 🔮 Future Enhancements

### 1. Chain-Agnostic URI Detection

**Auto-detect namespace from WalletConnect URI:**
```typescript
function detectNamespace(uri: string): Promise<string[]> {
  // Parse URI and fetch proposal
  // Return supported namespaces
}
```

### 2. Session Persistence

**Persist sessions across page reloads:**
```typescript
// Store sessions in localStorage
const sessions = localStorage.getItem('wc_sessions');
```

### 3. QR Code Support

**Generate and scan QR codes:**
```typescript
import QRCode from 'qrcode';

<QRCode value={uri} />
```

### 4. Multi-Device Sync

**Sync sessions across devices:**
- Use backend to store session data
- Synchronize session state

### 5. Transaction History

**Track WalletConnect transactions:**
- Store transaction metadata
- Display in UI

---

## 📝 Notes

### WalletConnect v2 Specifications

- **Session Proposal**: Initiated by DApp
- **Session Approval**: Requires wallet to provide accounts
- **Session Request**: Transaction or message signing
- **Session Disconnect**: Either party can disconnect

### CAIP Standards

- **CAIP-2**: Blockchain ID Specification
- **CAIP-10**: Account ID Specification
- **CAIP-25**: Blockchain Provider Discovery

### Namespace Support

| Namespace | Standard | Example |
|-----------|----------|---------|
| eip155 | EVM chains | `eip155:1:0x...` |
| polkadot | Substrate | `polkadot:<genesis>:<ss58>` |
| solana | Solana | `solana:<cluster>:<pubkey>` |
| bip122 | Bitcoin | `bip122:<genesis>:<address>` |

---

## 🤝 Contributing

When implementing new namespace support:

1. **Follow the interface**: Implement `IWalletConnectProvider`
2. **Use CAIP-10**: Format accounts correctly
3. **Verify ownership**: Always check account ownership
4. **Isolate errors**: Don't let one namespace affect others
5. **Document thoroughly**: Update this plan

---

## 📞 Support & Resources

- **WalletConnect Docs**: https://docs.reown.com/
- **CAIP Standards**: https://github.com/ChainAgnostic/CAIPs
- **Substrate WalletConnect**: https://wiki.polkadot.network/docs/walletconnect
- **Viem (EVM)**: https://viem.sh/

---

## ✅ Checklist for New Namespace Implementation

When adding support for a new blockchain namespace:

### Backend
- [ ] Create service class implementing signing logic
- [ ] Create controller with endpoints
- [ ] Add DTO classes for request/response
- [ ] Implement CAIP-10 formatting
- [ ] Add account ownership verification
- [ ] Write unit tests
- [ ] Write integration tests

### Frontend
- [ ] Create hook implementing `IWalletConnectProvider`
- [ ] Initialize WalletConnect client
- [ ] Handle session proposals
- [ ] Handle session requests
- [ ] Implement signing confirmations
- [ ] Create UI component
- [ ] Add to `useMultiChainWalletConnect`
- [ ] Write tests

### Documentation
- [ ] Update this plan
- [ ] Add API documentation
- [ ] Add usage examples
- [ ] Update testing guide

---

**Last Updated**: November 19, 2025
**Version**: 1.0.0
**Status**: Planning Phase
