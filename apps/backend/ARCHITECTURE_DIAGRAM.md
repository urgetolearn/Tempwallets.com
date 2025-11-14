# Wallet Service Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Client Application                            │
│                     (Frontend / API Consumer)                           │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             │ HTTP/REST
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        WalletController                                 │
│  Routes: /wallet/addresses, /wallet/balances, /wallet/send, etc.      │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             │ Orchestrates
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         WalletService                                   │
│  • High-level wallet operations                                        │
│  • Orchestrates managers and factories                                 │
│  • Maintains backward compatibility                                    │
└─────┬──────────┬──────────┬──────────┬──────────┬────────────────────┬──┘
      │          │          │          │          │                    │
      │          │          │          │          │                    │
      ▼          ▼          ▼          ▼          ▼                    ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  ┌──────────┐
│  Seed    │ │ Address  │ │ Balance  │ │Transaction│ │ Zerion   │  │  Seed    │
│ Manager  │ │ Manager  │ │ Manager  │ │ Manager  │ │ Service  │  │Repository│
└─────┬────┘ └─────┬────┘ └─────┬────┘ └─────┬────┘ └──────────┘  └──────────┘
      │            │            │            │
      │            │            │            │
      │            ▼            │            │
      │     ┌──────────────┐   │            │
      │     │  Account     │◄──┘            │
      │     │  Factories   │◄───────────────┘
      │     └──────┬───────┘
      │            │
      │            │ Creates accounts
      │            │
      │     ┌──────┴───────────────────────────────────┐
      │     │                                           │
      │     ▼                                           ▼
      │ ┌─────────────────────┐          ┌─────────────────────────┐
      │ │  AccountFactory     │          │ PimlicoAccountFactory   │
      │ │  (EOA Accounts)     │          │ (ERC-4337 Smart Acct)   │
      │ └─────────┬───────────┘          └─────────┬───────────────┘
      │           │                                 │
      │           │ Uses                            │ Uses
      │           ▼                                 ▼
      │  ┌────────────────┐              ┌────────────────────────┐
      │  │  Tether WDK    │              │  viem + permissionless │
      │  │  • EVM         │              │  • Pimlico Bundler     │
      │  │  • Tron        │              │  • Pimlico Paymaster   │
      │  │  • Bitcoin     │              │  • Safe Smart Account  │
      │  │  • Solana      │              │  • ERC-4337 v0.7       │
      │  └────────────────┘              └────────────────────────┘
      │
      │ Reads mnemonic
      ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       SeedRepository                                   │
│  • Encrypted storage of seed phrases                                  │
│  • Database persistence (Prisma)                                      │
└────────────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Configuration Layer

```
┌─────────────────────────────────────────────────────────────┐
│                    Configuration Services                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ChainConfigService              PimlicoConfigService       │
│  ├─ Ethereum (RPC)               ├─ Ethereum (Bundler)     │
│  ├─ Base (RPC)                   ├─ Base (Bundler)         │
│  ├─ Arbitrum (RPC)               ├─ Arbitrum (Bundler)     │
│  ├─ Polygon (RPC)                ├─ Polygon (Bundler)      │
│  ├─ Tron (RPC)                   ├─ Paymaster URLs         │
│  ├─ Bitcoin (RPC)                ├─ Entry Point v0.7       │
│  └─ Solana (RPC)                 └─ Factory Addresses      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2. Account Creation Flow

```
User Creates Wallet
       │
       ▼
  ┌─────────────┐
  │SeedManager  │
  │Creates or   │
  │imports      │
  │mnemonic     │
  └──────┬──────┘
         │
         │ Mnemonic (12/24 words)
         │
         ▼
┌────────────────────────────────────────┐
│      HD Wallet Derivation              │
│  m/44'/60'/0'/0/{accountIndex}         │
└────────┬────────────────┬──────────────┘
         │                │
         │ EOA            │ ERC-4337
         ▼                ▼
  ┌─────────────┐  ┌─────────────────┐
  │ Account     │  │  Pimlico        │
  │ Factory     │  │  Factory        │
  └──────┬──────┘  └────────┬────────┘
         │                  │
         │                  │ Derives EOA signer
         │                  │ Creates Safe Account
         │                  │ Computes address
         │                  │
         ▼                  ▼
    ┌────────┐        ┌─────────────┐
    │EOA     │        │Smart Account│
    │Address │        │Address      │
    │0x...   │        │0x...        │
    └────────┘        └─────────────┘
         │                  │
         │                  │ First Transaction
         │                  ▼
         │            ┌─────────────┐
         │            │Auto-Deploy  │
         │            │via Bundler  │
         │            └─────────────┘
         │                  │
         ▼                  ▼
    Ready to use      Ready to use
```

### 3. Transaction Flow (ERC-4337)

```
User Initiates Send
       │
       ▼
┌──────────────────┐
│TransactionManager│
└────────┬─────────┘
         │
         ▼
┌────────────────────────────────┐
│  PimlicoAccountFactory         │
│  Creates Smart Account Client  │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│  Build User Operation          │
│  • callData                    │
│  • nonce                       │
│  • gas estimates               │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│  Sign with EOA (from mnemonic) │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│  Submit to Pimlico Bundler     │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│  Paymaster (Optional)          │
│  • Sponsors gas                │
│  • USDC payment                │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│  Bundler submits to blockchain │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│  Transaction mined             │
│  • Returns txHash              │
└────────────────────────────────┘
```

### 4. Data Flow

```
┌──────────────────────────────────────────────────────────┐
│                     Request Flow                         │
└──────────────────────────────────────────────────────────┘

GET /wallet/addresses?userId=123
       │
       ▼
WalletController.getAddresses(userId)
       │
       ▼
WalletService.getAddresses(userId)
       │
       ▼
AddressManager.getAddresses(userId)
       │
       ├──► Check cache ──► Return if valid
       │
       ├──► SeedManager.getSeed(userId)
       │         │
       │         └──► SeedRepository.getSeedPhrase(userId)
       │                   │
       │                   └──► Database (Prisma)
       │
       ├──► AccountFactory.createAccount(seed, 'ethereum', 0)
       │         │
       │         └──► Tether WDK ──► Returns EOA
       │
       ├──► PimlicoAccountFactory.createAccount(seed, 'ethereum', 0)
       │         │
       │         └──► viem + permissionless ──► Returns Smart Account
       │
       ├──► Collect all addresses
       │
       ├──► Cache addresses
       │
       └──► Return WalletAddresses object

Response:
{
  ethereum: "0xabc...",
  ethereumErc4337: "0xdef...",
  base: "0x123...",
  baseErc4337: "0x456...",
  ...
}
```

## Key Benefits of This Architecture

### 1. **Separation of Concerns**
- Each manager handles one responsibility
- Easy to test in isolation
- Clear boundaries between components

### 2. **Modularity**
- Factories are swappable (can add new account types)
- Managers are independent (can be used standalone)
- Configuration is centralized

### 3. **Scalability**
- Easy to add new chains
- Easy to add new account types
- Easy to add new features

### 4. **Maintainability**
- Clear code organization
- Comprehensive types and interfaces
- Good error handling

### 5. **Flexibility**
- Same mnemonic, multiple account types
- Support both EOA and ERC-4337
- Independent of Tether WDK for ERC-4337

## Technology Stack

### Current (EOA Accounts)
- **Tether WDK**: Multi-chain wallet SDK
- **Prisma**: Database ORM
- **NestJS**: Backend framework

### New (ERC-4337 Smart Accounts)
- **viem**: Ethereum TypeScript library
- **permissionless**: ERC-4337 library
- **Pimlico**: Bundler + Paymaster infrastructure
- **Safe**: Smart account implementation

### Shared
- **BIP-39**: Mnemonic generation
- **BIP-44**: HD wallet derivation
- **TypeScript**: Type safety
