# Substrate Transaction Support Implementation

## Overview

Complete transaction support for Substrate/Polkadot wallets including transaction construction, signing, broadcasting, fee estimation, and transaction history.

## Features Implemented

### 1. Transaction Construction
- **Transfer transactions**: Construct balance transfers between addresses
- **Generic transactions**: Construct any extrinsic from method and args
- **Type-safe**: Full TypeScript support with proper types

### 2. Transaction Signing
- **SR25519 signing**: Uses Substrate's native SR25519 cryptography
- **Nonce management**: Automatic nonce handling with pending nonce tracking
- **Era management**: Automatic mortality era calculation
- **Security**: Seed phrases are decrypted only when needed and cleared immediately

### 3. Transaction Broadcasting
- **Status tracking**: Tracks transaction status (pending, inBlock, finalized, failed)
- **Error handling**: Comprehensive error handling and reporting
- **Block hash tracking**: Returns block hash when transaction is included

### 4. Fee Estimation
- **Payment info**: Uses Substrate's payment info API
- **Weight calculation**: Returns transaction weight and class
- **Human-readable**: Converts fees to human-readable format

### 5. Transaction History
- **Block scanning**: Scans blocks to find transactions
- **Pagination**: Supports cursor-based pagination
- **Filtering**: Filters transactions by sender address
- **Metadata**: Includes method, args, amounts, and status

## API Endpoints

### Test Endpoints

#### 1. Construct Transaction
```
GET /wallet/substrate/test/construct?from=xxx&to=yyy&amount=1000000&chain=polkadot&useTestnet=true
```

**Response:**
```json
{
  "success": true,
  "from": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
  "to": "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty",
  "amount": "1000000",
  "chain": "polkadot",
  "useTestnet": true,
  "method": "balances.transfer",
  "args": [...],
  "txHash": "0x...",
  "note": "Transaction constructed successfully"
}
```

#### 2. Estimate Fee
```
GET /wallet/substrate/test/estimate-fee?from=xxx&to=yyy&amount=1000000&chain=polkadot&useTestnet=true
```

**Response:**
```json
{
  "success": true,
  "from": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
  "to": "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty",
  "amount": "1000000",
  "chain": "polkadot",
  "useTestnet": true,
  "fee": "1000000000",
  "feeHuman": "0.001",
  "token": "DOT",
  "weight": "1000000",
  "class": "Normal",
  "note": "Fee estimated successfully"
}
```

#### 3. Sign Transaction
```
GET /wallet/substrate/test/sign?userId=xxx&to=yyy&amount=1000000&chain=polkadot&useTestnet=true
```

**Response:**
```json
{
  "success": true,
  "userId": "user-123",
  "from": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
  "to": "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty",
  "amount": "1000000",
  "chain": "polkadot",
  "useTestnet": true,
  "txHash": "0x...",
  "nonce": 5,
  "signedTxLength": 256,
  "note": "Transaction signed successfully (not broadcast)"
}
```

#### 4. Send Transfer (Complete Flow)
```
GET /wallet/substrate/test/send?userId=xxx&to=yyy&amount=1000000&chain=polkadot&useTestnet=true
```

**Response:**
```json
{
  "success": true,
  "userId": "user-123",
  "from": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
  "to": "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty",
  "amount": "1000000",
  "chain": "polkadot",
  "useTestnet": true,
  "txHash": "0x...",
  "status": "finalized",
  "blockHash": "0x...",
  "note": "Transaction sent and finalized successfully"
}
```

#### 5. Transaction History
```
GET /wallet/substrate/test/history?address=xxx&chain=polkadot&useTestnet=true&limit=10&cursor=12345
```

**Response:**
```json
{
  "success": true,
  "address": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
  "chain": "polkadot",
  "useTestnet": true,
  "history": {
    "transactions": [
      {
        "txHash": "0x...",
        "blockNumber": 12345,
        "blockHash": "0x...",
        "from": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
        "to": "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty",
        "amount": "1000000",
        "status": "finalized",
        "method": "balances.transfer"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 10,
    "hasMore": true,
    "nextCursor": "12335"
  },
  "note": "Found 1 transactions"
}
```

## Service Methods

### SubstrateTransactionService

#### `constructTransfer(params: TransferParams): Promise<any>`
Constructs a balance transfer transaction.

#### `constructTransaction(params: TransactionParams): Promise<any>`
Constructs any extrinsic from method and args.

#### `estimateFee(transaction, from, chain, useTestnet): Promise<FeeEstimate>`
Estimates transaction fee using payment info.

#### `signTransaction(userId, transaction, chain, accountIndex, useTestnet): Promise<SignedTransaction>`
Signs a transaction using the user's seed phrase (decrypted securely).

#### `broadcastTransaction(signedTx, chain, useTestnet): Promise<TransactionResult>`
Broadcasts a signed transaction and tracks its status.

#### `sendTransfer(userId, params, accountIndex): Promise<TransactionResult>`
Complete flow: construct, sign, and broadcast a transfer.

#### `getTransactionHistory(address, chain, useTestnet, limit, cursor): Promise<TransactionHistory>`
Gets transaction history for an address with pagination.

## Security Features

1. **Seed Phrase Security**: 
   - Seed phrases are never passed as parameters
   - Decrypted only when needed
   - Cleared from memory immediately after use

2. **Nonce Management**:
   - Tracks pending nonces to prevent collisions
   - Automatically increments nonce for each transaction

3. **Error Handling**:
   - Comprehensive error handling at each step
   - Clear error messages for debugging
   - Transaction status tracking

## Usage Examples

### Example 1: Send Transfer
```typescript
const result = await transactionService.sendTransfer(
  userId,
  {
    from: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
    to: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
    amount: '1000000000000', // 1 DOT (12 decimals)
    chain: 'polkadot',
    useTestnet: false,
  },
  0, // accountIndex
);
```

### Example 2: Estimate Fee First
```typescript
// Construct transaction
const tx = await transactionService.constructTransfer({
  from: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
  to: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
  amount: '1000000000000',
  chain: 'polkadot',
  useTestnet: false,
});

// Estimate fee
const fee = await transactionService.estimateFee(
  tx,
  '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
  'polkadot',
  false,
);

console.log(`Fee: ${fee.partialFee} smallest units`);
```

### Example 3: Get Transaction History
```typescript
const history = await transactionService.getTransactionHistory(
  '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
  'polkadot',
  false,
  10, // limit
  undefined, // cursor
);

console.log(`Found ${history.transactions.length} transactions`);
```

## Integration with Existing Wallet Service

The transaction service is ready to be integrated with the main `WalletService`. The integration would:

1. Add Substrate chain support to `sendCrypto()` method
2. Add Substrate transaction history to `getTransactions()` method
3. Add Substrate balance checking to `getBalances()` method

## Testing

Test all transaction endpoints:

```bash
# Construct transaction
curl "http://localhost:5005/wallet/substrate/test/construct?from=5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY&to=5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty&amount=1000000&chain=paseo&useTestnet=true"

# Estimate fee
curl "http://localhost:5005/wallet/substrate/test/estimate-fee?from=5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY&to=5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty&amount=1000000&chain=paseo&useTestnet=true"

# Sign transaction (requires userId with wallet)
curl "http://localhost:5005/wallet/substrate/test/sign?userId=test-user&to=5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty&amount=1000000&chain=paseo&useTestnet=true"

# Send transfer (requires userId with wallet and sufficient balance)
curl "http://localhost:5005/wallet/substrate/test/send?userId=test-user&to=5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty&amount=1000000&chain=paseo&useTestnet=true"

# Get transaction history
curl "http://localhost:5005/wallet/substrate/test/history?address=5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY&chain=paseo&useTestnet=true&limit=10"
```

## Next Steps

1. **Integrate with WalletService**: Add Substrate support to main wallet service
2. **Add WalletConnect Support**: Implement WalletConnect v2 for Substrate transactions
3. **Add More Transaction Types**: Support for staking, governance, etc.
4. **Optimize History**: Use indexer for faster transaction history
5. **Add Transaction Status Polling**: Poll for transaction status updates

## Files Created

1. `src/wallet/substrate/types/substrate-transaction.types.ts` - Transaction types
2. `src/wallet/substrate/services/substrate-transaction.service.ts` - Transaction service
3. Updated `substrate.module.ts` - Registered transaction service
4. Updated `substrate-test.controller.ts` - Added transaction test endpoints

## Status

✅ **Transaction Support Complete**
- Transaction construction
- Transaction signing
- Transaction broadcasting
- Fee estimation
- Transaction history with pagination

Ready for integration with main wallet service!

