# WalletConnect Multi-Chain Implementation Guide

## 📘 Quick Reference Guide

This document provides a **practical, step-by-step guide** for implementing the modular WalletConnect architecture in your Tempwallets application. Use this alongside the comprehensive plan and visual diagrams.

---

## 🎯 What You're Building

A **modular wallet connection system** that supports:
- ✅ **Substrate/Polkadot chains** (Already implemented)
- 🔜 **EVM chains** (Ethereum, Base, Arbitrum, Polygon, Avalanche)
- 🔮 **Future chains** (Solana, Bitcoin, etc.)

Each blockchain ecosystem operates **independently** with **no interference** between namespaces.

---

## 📚 Related Documents

1. **WalletConnectPlan.md** - Comprehensive architecture and design document
2. **walletconnect-diagram.js** - Visual sequence diagrams (Mermaid.js)
3. **WALLETCONNECT_TESTING_GUIDE.md** - Testing procedures (Substrate - already exists)

---

## 🏗️ Understanding the Current Architecture

### Substrate Implementation (Reference)

**What's Already Working:**

```typescript
// Frontend Hook
const { client, sessions, pair, disconnect } = useSubstrateWalletConnect(userId);

// Backend Service
GET  /wallet/substrate/walletconnect/accounts
POST /wallet/substrate/walletconnect/sign-transaction
POST /wallet/substrate/walletconnect/sign-message
```

**Key Concepts:**
- **Namespace**: `polkadot`
- **Account Format**: `polkadot:<genesis_hash>:<ss58_address>`
- **Methods**: `polkadot_signTransaction`, `polkadot_signMessage`
- **Lazy Initialization**: Client initializes only when modal opens
- **Session Management**: Stores active connections with DApps

---

## 🚀 Step-by-Step Implementation (EVM)

### Phase 1: Backend Service (Week 1)

#### Step 1.1: Create Service File

**File**: `apps/backend/src/wallet/evm/walletconnect/evm-walletconnect.service.ts`

```typescript
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { SeedManager } from '../../managers/seed.manager.js';
import { AddressManager } from '../../managers/address.manager.js';
import { AccountFactory } from '../../factories/account.factory.js';
import { PimlicoAccountFactory } from '../../factories/pimlico-account.factory.js';

@Injectable()
export class EvmWalletConnectService {
  private readonly logger = new Logger(EvmWalletConnectService.name);

  constructor(
    private readonly seedManager: SeedManager,
    private readonly addressManager: AddressManager,
    private readonly accountFactory: AccountFactory,
    private readonly pimlicoFactory: PimlicoAccountFactory,
  ) {}

  /**
   * Format EVM address to CAIP-10
   * Format: eip155:<chainId>:<address>
   */
  formatAccountId(chainId: number, address: string): string {
    return `eip155:${chainId}:${address.toLowerCase()}`;
  }

  /**
   * Parse CAIP-10 to extract chainId and address
   */
  parseAccountId(accountId: string): { chainId: number; address: string } | null {
    const parts = accountId.split(':');
    if (parts.length !== 3 || parts[0] !== 'eip155') {
      return null;
    }

    const chainId = parseInt(parts[1], 10);
    const address = parts[2];

    if (isNaN(chainId) || !address) {
      return null;
    }

    return { chainId, address };
  }

  /**
   * Get all EVM accounts for WalletConnect
   */
  async getFormattedAccounts(userId: string): Promise<Array<{
    accountId: string;
    chainId: number;
    address: string;
    chainName: string;
  }>> {
    const addresses = await this.addressManager.getAddresses(userId);

    const supportedChains = [
      { chainId: 1, key: 'ethereumErc4337', fallback: 'ethereum', name: 'Ethereum' },
      { chainId: 8453, key: 'baseErc4337', fallback: 'base', name: 'Base' },
      { chainId: 42161, key: 'arbitrumErc4337', fallback: 'arbitrum', name: 'Arbitrum' },
      { chainId: 137, key: 'polygonErc4337', fallback: 'polygon', name: 'Polygon' },
      { chainId: 43114, key: 'avalancheErc4337', fallback: 'avalanche', name: 'Avalanche' },
    ];

    const accounts: Array<{
      accountId: string;
      chainId: number;
      address: string;
      chainName: string;
    }> = [];

    for (const chain of supportedChains) {
      // Prefer ERC-4337 smart account, fallback to EOA
      const address = addresses[chain.key] || addresses[chain.fallback];
      
      if (!address) {
        continue;
      }

      const accountId = this.formatAccountId(chain.chainId, address);
      accounts.push({
        accountId,
        chainId: chain.chainId,
        address,
        chainName: chain.name,
      });
    }

    return accounts;
  }

  /**
   * Sign EVM transaction for WalletConnect
   */
  async signTransaction(
    userId: string,
    accountId: string,
    transaction: {
      to: string;
      value?: string;
      data?: string;
      gas?: string;
      gasPrice?: string;
      maxFeePerGas?: string;
      maxPriorityFeePerGas?: string;
      nonce?: string;
    },
  ): Promise<{ signature: string; txHash?: string }> {
    this.logger.log(`Signing EVM transaction for user ${userId}, account ${accountId}`);

    const parsed = this.parseAccountId(accountId);
    if (!parsed) {
      throw new Error(`Invalid account ID format: ${accountId}`);
    }

    const { chainId, address } = parsed;

    // Verify the address belongs to the user
    const addresses = await this.addressManager.getAddresses(userId);
    const userAddress = this.getUserAddressForChainId(addresses, chainId);

    if (userAddress?.toLowerCase() !== address.toLowerCase()) {
      throw new UnauthorizedException(`Address ${address} does not belong to user ${userId}`);
    }

    // Get seed phrase
    const seedPhrase = await this.seedManager.getSeed(userId);

    try {
      // Determine if this is ERC-4337 or EOA
      const isSmartAccount = this.isSmartAccount(addresses, chainId);
      
      let signedTx: string;

      if (isSmartAccount) {
        // Use Pimlico factory for smart accounts
        const chain = this.getChainNameFromId(chainId);
        const account = await this.pimlicoFactory.createAccount(seedPhrase, chain, 0);
        
        // Sign transaction using smart account
        // TODO: Implement smart account signing logic
        signedTx = await this.signWithSmartAccount(account, transaction);
      } else {
        // Use regular account factory for EOA
        const chain = this.getChainNameFromId(chainId);
        const account = await this.accountFactory.createAccount(seedPhrase, chain, 0);
        
        // Sign transaction using EOA
        signedTx = await this.signWithEOA(account, transaction);
      }

      return {
        signature: signedTx,
        // txHash will be generated by the DApp when broadcasting
      };
    } finally {
      // Clear seed from memory
      (seedPhrase as any) = '';
    }
  }

  /**
   * Sign EVM message for WalletConnect (personal_sign)
   */
  async signMessage(
    userId: string,
    accountId: string,
    message: string,
  ): Promise<{ signature: string }> {
    this.logger.log(`Signing EVM message for user ${userId}, account ${accountId}`);

    const parsed = this.parseAccountId(accountId);
    if (!parsed) {
      throw new Error(`Invalid account ID format: ${accountId}`);
    }

    const { chainId, address } = parsed;

    // Verify the address belongs to the user
    const addresses = await this.addressManager.getAddresses(userId);
    const userAddress = this.getUserAddressForChainId(addresses, chainId);

    if (userAddress?.toLowerCase() !== address.toLowerCase()) {
      throw new UnauthorizedException(`Address ${address} does not belong to user ${userId}`);
    }

    // Get seed phrase
    const seedPhrase = await this.seedManager.getSeed(userId);

    try {
      const chain = this.getChainNameFromId(chainId);
      const account = await this.accountFactory.createAccount(seedPhrase, chain, 0);

      // Sign message with ECDSA
      const signature = await this.signMessageWithAccount(account, message);

      return { signature };
    } finally {
      // Clear seed from memory
      (seedPhrase as any) = '';
    }
  }

  /**
   * Sign typed data (EIP-712) for WalletConnect
   */
  async signTypedData(
    userId: string,
    accountId: string,
    typedData: any,
  ): Promise<{ signature: string }> {
    this.logger.log(`Signing EVM typed data for user ${userId}, account ${accountId}`);

    const parsed = this.parseAccountId(accountId);
    if (!parsed) {
      throw new Error(`Invalid account ID format: ${accountId}`);
    }

    const { chainId, address } = parsed;

    // Verify the address belongs to the user
    const addresses = await this.addressManager.getAddresses(userId);
    const userAddress = this.getUserAddressForChainId(addresses, chainId);

    if (userAddress?.toLowerCase() !== address.toLowerCase()) {
      throw new UnauthorizedException(`Address ${address} does not belong to user ${userId}`);
    }

    // Get seed phrase
    const seedPhrase = await this.seedManager.getSeed(userId);

    try {
      const chain = this.getChainNameFromId(chainId);
      const account = await this.accountFactory.createAccount(seedPhrase, chain, 0);

      // Sign typed data with EIP-712
      const signature = await this.signTypedDataWithAccount(account, typedData);

      return { signature };
    } finally {
      // Clear seed from memory
      (seedPhrase as any) = '';
    }
  }

  // Helper methods

  private getUserAddressForChainId(addresses: any, chainId: number): string | null {
    const chainMap: Record<number, { erc4337: string; eoa: string }> = {
      1: { erc4337: 'ethereumErc4337', eoa: 'ethereum' },
      8453: { erc4337: 'baseErc4337', eoa: 'base' },
      42161: { erc4337: 'arbitrumErc4337', eoa: 'arbitrum' },
      137: { erc4337: 'polygonErc4337', eoa: 'polygon' },
      43114: { erc4337: 'avalancheErc4337', eoa: 'avalanche' },
    };

    const keys = chainMap[chainId];
    if (!keys) return null;

    return addresses[keys.erc4337] || addresses[keys.eoa] || null;
  }

  private isSmartAccount(addresses: any, chainId: number): boolean {
    const chainMap: Record<number, string> = {
      1: 'ethereumErc4337',
      8453: 'baseErc4337',
      42161: 'arbitrumErc4337',
      137: 'polygonErc4337',
      43114: 'avalancheErc4337',
    };

    const key = chainMap[chainId];
    return !!addresses[key];
  }

  private getChainNameFromId(chainId: number): string {
    const chainNames: Record<number, string> = {
      1: 'ethereum',
      8453: 'base',
      42161: 'arbitrum',
      137: 'polygon',
      43114: 'avalanche',
    };

    return chainNames[chainId] || 'ethereum';
  }

  private async signWithSmartAccount(account: any, tx: any): Promise<string> {
    // TODO: Implement smart account transaction signing
    // This will use the account's sendUserOperation method
    throw new Error('Smart account signing not yet implemented');
  }

  private async signWithEOA(account: any, tx: any): Promise<string> {
    // TODO: Implement EOA transaction signing
    // This will use the account's signTransaction method
    throw new Error('EOA signing not yet implemented');
  }

  private async signMessageWithAccount(account: any, message: string): Promise<string> {
    // TODO: Implement message signing
    // This will use the account's signMessage method
    throw new Error('Message signing not yet implemented');
  }

  private async signTypedDataWithAccount(account: any, typedData: any): Promise<string> {
    // TODO: Implement typed data signing
    // This will use the account's signTypedData method
    throw new Error('Typed data signing not yet implemented');
  }
}
```

#### Step 1.2: Create Controller

**File**: `apps/backend/src/wallet/evm/walletconnect/evm-walletconnect.controller.ts`

```typescript
import {
  Controller,
  Post,
  Get,
  Query,
  Body,
  Logger,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { EvmWalletConnectService } from './evm-walletconnect.service.js';
import {
  EvmWalletConnectSignTransactionDto,
  EvmWalletConnectSignMessageDto,
  EvmWalletConnectSignTypedDataDto,
} from './dto/evm-walletconnect.dto.js';

@Controller('wallet/evm/walletconnect')
export class EvmWalletConnectController {
  private readonly logger = new Logger(EvmWalletConnectController.name);

  constructor(
    private readonly walletConnectService: EvmWalletConnectService,
  ) {}

  @Get('accounts')
  async getAccounts(
    @Query('userId') userId: string,
  ) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }

    try {
      const accounts = await this.walletConnectService.getFormattedAccounts(userId);

      return {
        userId,
        accounts,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get EVM WalletConnect accounts: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  @Post('sign-transaction')
  @HttpCode(HttpStatus.OK)
  async signTransaction(@Body() dto: EvmWalletConnectSignTransactionDto) {
    this.logger.log(
      `Signing EVM WalletConnect transaction for user ${dto.userId}, account ${dto.accountId}`,
    );

    try {
      const result = await this.walletConnectService.signTransaction(
        dto.userId,
        dto.accountId,
        dto.transaction,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to sign EVM WalletConnect transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  @Post('sign-message')
  @HttpCode(HttpStatus.OK)
  async signMessage(@Body() dto: EvmWalletConnectSignMessageDto) {
    this.logger.log(
      `Signing EVM WalletConnect message for user ${dto.userId}, account ${dto.accountId}`,
    );

    try {
      const result = await this.walletConnectService.signMessage(
        dto.userId,
        dto.accountId,
        dto.message,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to sign EVM WalletConnect message: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  @Post('sign-typed-data')
  @HttpCode(HttpStatus.OK)
  async signTypedData(@Body() dto: EvmWalletConnectSignTypedDataDto) {
    this.logger.log(
      `Signing EVM WalletConnect typed data for user ${dto.userId}, account ${dto.accountId}`,
    );

    try {
      const result = await this.walletConnectService.signTypedData(
        dto.userId,
        dto.accountId,
        dto.typedData,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to sign EVM WalletConnect typed data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }
}
```

#### Step 1.3: Create DTOs

**File**: `apps/backend/src/wallet/evm/walletconnect/dto/evm-walletconnect.dto.ts`

```typescript
import { IsString, IsNotEmpty, IsObject, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

class EvmTransactionDto {
  @IsString()
  @IsNotEmpty()
  to: string;

  @IsString()
  @IsOptional()
  value?: string;

  @IsString()
  @IsOptional()
  data?: string;

  @IsString()
  @IsOptional()
  gas?: string;

  @IsString()
  @IsOptional()
  gasPrice?: string;

  @IsString()
  @IsOptional()
  maxFeePerGas?: string;

  @IsString()
  @IsOptional()
  maxPriorityFeePerGas?: string;

  @IsString()
  @IsOptional()
  nonce?: string;
}

export class EvmWalletConnectSignTransactionDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  accountId: string; // CAIP-10 format: eip155:1:0x...

  @ValidateNested()
  @Type(() => EvmTransactionDto)
  transaction: EvmTransactionDto;
}

export class EvmWalletConnectSignMessageDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  accountId: string; // CAIP-10 format

  @IsString()
  @IsNotEmpty()
  message: string;
}

export class EvmWalletConnectSignTypedDataDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  accountId: string; // CAIP-10 format

  @IsObject()
  @IsNotEmpty()
  typedData: any; // EIP-712 typed data
}
```

---

### Phase 2: Frontend Hook (Week 2)

#### Step 2.1: Create Hook File

**File**: `apps/web/hooks/walletconnect/useEvmWalletConnect.ts`

```typescript
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import SignClient from '@walletconnect/sign-client';
import { SessionTypes } from '@walletconnect/types';
import { walletApi } from '@/lib/api';

const EVM_WALLETCONNECT_METHODS = [
  'eth_sendTransaction',
  'eth_signTransaction',
  'eth_sign',
  'personal_sign',
  'eth_signTypedData',
  'eth_signTypedData_v4',
];

const EVM_WALLETCONNECT_EVENTS = ['chainChanged', 'accountsChanged'];

export interface EvmWalletConnectSession {
  topic: string;
  peer: {
    metadata?: {
      name?: string;
      description?: string;
      url?: string;
      icons?: string[];
    };
  };
  namespaces: SessionTypes.Namespaces;
}

export interface UseEvmWalletConnectReturn {
  client: SignClient | null;
  sessions: EvmWalletConnectSession[];
  isInitializing: boolean;
  error: string | null;
  pair: (uri: string) => Promise<void>;
  disconnect: (topic: string) => Promise<void>;
  initialize: () => Promise<void>;
}

// Global client instance to prevent multiple initializations
let globalEvmSignClient: SignClient | null = null;
let isInitializingGlobal = false;

export function useEvmWalletConnect(userId: string | null): UseEvmWalletConnectReturn {
  const [client, setClient] = useState<SignClient | null>(null);
  const [sessions, setSessions] = useState<EvmWalletConnectSession[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isInitializedRef = useRef(false);

  // Lazy initialization function
  const initialize = useCallback(async () => {
    if (!userId) {
      setIsInitializing(false);
      return;
    }

    // Prevent multiple initializations
    if (isInitializedRef.current || globalEvmSignClient) {
      setClient(globalEvmSignClient);
      setIsInitializing(false);
      if (globalEvmSignClient) {
        const existingSessions = globalEvmSignClient.session.getAll();
        setSessions(
          existingSessions
            .filter(s => s?.topic && s.namespaces?.eip155 !== undefined)
            .map(s => ({
              topic: s.topic,
              peer: s.peer || { metadata: undefined },
              namespaces: s.namespaces || {},
            }))
        );
      }
      return;
    }

    if (isInitializingGlobal) {
      while (isInitializingGlobal) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      const existingClient = globalEvmSignClient;
      if (existingClient) {
        setClient(existingClient);
        setIsInitializing(false);
        isInitializedRef.current = true;
        const existingSessions = existingClient.session.getAll();
        setSessions(
          existingSessions
            .filter(s => s?.topic && s.namespaces?.eip155 !== undefined)
            .map(s => ({
              topic: s.topic,
              peer: s.peer || { metadata: undefined },
              namespaces: s.namespaces || {},
            }))
        );
      }
      return;
    }

    isInitializingGlobal = true;
    setIsInitializing(true);

    try {
      const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
      if (!projectId) {
        throw new Error('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set');
      }

      // Wait to prevent storage conflicts with other clients
      await new Promise(resolve => setTimeout(resolve, 1500));

      let signClient: SignClient;
      try {
        signClient = await SignClient.init({
          projectId,
          metadata: {
            name: 'Tempwallets EVM',
            description: 'Temporary wallet service - EVM chains',
            url: typeof window !== 'undefined' ? window.location.origin : 'https://tempwallets.com',
            icons: [`${typeof window !== 'undefined' ? window.location.origin : 'https://tempwallets.com'}/tempwallets-logo.png`],
          },
        });
      } catch (initError: any) {
        if (initError?.message?.includes('restore') || initError?.message?.includes('storage')) {
          console.warn('[EvmWalletConnect] Initialization conflict detected, retrying...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          signClient = await SignClient.init({
            projectId,
            metadata: {
              name: 'Tempwallets EVM',
              description: 'Temporary wallet service - EVM chains',
              url: typeof window !== 'undefined' ? window.location.origin : 'https://tempwallets.com',
              icons: [`${typeof window !== 'undefined' ? window.location.origin : 'https://tempwallets.com'}/tempwallets-logo.png`],
            },
          });
        } else {
          throw initError;
        }
      }

      globalEvmSignClient = signClient;
      setClient(signClient);
      setIsInitializing(false);
      isInitializedRef.current = true;
      isInitializingGlobal = false;

      // Load existing sessions
      const existingSessions = signClient.session.getAll();
      const validSessions = existingSessions
        .filter(s => s?.topic && s.namespaces?.eip155 !== undefined)
        .map(s => ({
          topic: s.topic,
          peer: s.peer || { metadata: undefined },
          namespaces: s.namespaces || {},
        }));

      setSessions(validSessions);

      // Session proposal handler
      signClient.on('session_proposal', async (event) => {
        console.log('[EvmWalletConnect] Session proposal received:', event);
        const { id, params } = event;

        const hasEip155Namespace = params.requiredNamespaces?.eip155 || params.optionalNamespaces?.eip155;

        if (!hasEip155Namespace) {
          console.warn('[EvmWalletConnect] No EIP155 namespace, rejecting');
          await signClient.reject({
            id,
            reason: { code: 6001, message: 'This wallet only supports EVM chains' },
          });
          return;
        }

        const approved = window.confirm(
          `Connect to ${params.proposer.metadata?.name || 'Unknown DApp'}?\n\n` +
          `URL: ${params.proposer.metadata?.url || 'Unknown'}\n\n` +
          `This will allow the DApp to request transactions from your EVM wallets.`
        );

        if (approved) {
          try {
            // Get EVM accounts
            const accountsData = await walletApi.getEvmWalletConnectAccounts(userId);

            const eip155Namespace = params.requiredNamespaces?.eip155 || params.optionalNamespaces?.eip155;
            const chains = eip155Namespace.chains || [];
            const methods = eip155Namespace.methods || EVM_WALLETCONNECT_METHODS;
            const events = eip155Namespace.events || EVM_WALLETCONNECT_EVENTS;

            if (chains.length === 0 || accountsData.accounts.length === 0) {
              throw new Error('No chains or accounts available');
            }

            const namespaces: SessionTypes.Namespaces = {
              eip155: {
                accounts: accountsData.accounts.map(acc => acc.accountId),
                methods: methods,
                events: events,
                chains: chains,
              },
            };

            console.log('[EvmWalletConnect] Approving session with namespaces:', namespaces);

            const { topic } = await signClient.approve({ id, namespaces });
            const session = signClient.session.get(topic);

            setSessions(prev => [...prev, {
              topic: session.topic,
              peer: session.peer || { metadata: undefined },
              namespaces: session.namespaces || {},
            }]);
          } catch (err) {
            console.error('[EvmWalletConnect] Failed to approve session:', err);
            await signClient.reject({
              id,
              reason: { code: 5000, message: err instanceof Error ? err.message : 'Failed to approve' },
            });
          }
        } else {
          await signClient.reject({
            id,
            reason: { code: 5000, message: 'User rejected' },
          });
        }
      });

      // Session request handler
      signClient.on('session_request', async (event) => {
        console.log('[EvmWalletConnect] Session request received:', event);
        const { id, topic, params } = event;
        const { request, chainId } = params;

        try {
          let result;

          switch (request.method) {
            case 'eth_sendTransaction':
            case 'eth_signTransaction': {
              const [tx] = request.params;
              const confirmed = window.confirm(
                `Sign transaction?\n\n` +
                `To: ${tx.to || 'Contract'}\n` +
                `Value: ${tx.value || '0'}\n` +
                `Chain: ${chainId}`
              );

              if (!confirmed) {
                throw new Error('User rejected transaction');
              }

              result = await walletApi.signEvmWalletConnectTransaction({
                userId,
                accountId: `${chainId}:${tx.from}`,
                transaction: tx,
              });
              break;
            }

            case 'personal_sign':
            case 'eth_sign': {
              const [message, address] = request.params;
              const confirmed = window.confirm(
                `Sign message?\n\nMessage: ${message}\n\nDo you want to sign this message?`
              );

              if (!confirmed) {
                throw new Error('User rejected message signing');
              }

              result = await walletApi.signEvmWalletConnectMessage({
                userId,
                accountId: `${chainId}:${address}`,
                message,
              });
              break;
            }

            case 'eth_signTypedData':
            case 'eth_signTypedData_v4': {
              const [address, typedData] = request.params;
              const confirmed = window.confirm(
                `Sign typed data?\n\nDApp: ${params.proposer?.metadata?.name || 'Unknown'}\n\nReview carefully before signing.`
              );

              if (!confirmed) {
                throw new Error('User rejected typed data signing');
              }

              result = await walletApi.signEvmWalletConnectTypedData({
                userId,
                accountId: `${chainId}:${address}`,
                typedData: JSON.parse(typedData),
              });
              break;
            }

            default:
              throw new Error(`Unsupported method: ${request.method}`);
          }

          await signClient.respond({
            topic,
            response: {
              id,
              jsonrpc: '2.0',
              result,
            },
          });
        } catch (err) {
          console.error('[EvmWalletConnect] Request handling failed:', err);
          await signClient.respond({
            topic,
            response: {
              id,
              jsonrpc: '2.0',
              error: {
                code: 5000,
                message: err instanceof Error ? err.message : 'Unknown error',
              },
            },
          });
        }
      });

      // Session delete handler
      signClient.on('session_delete', (event) => {
        console.log('[EvmWalletConnect] Session deleted:', event);
        setSessions(prev => prev.filter(s => s.topic !== event.topic));
      });

    } catch (err) {
      console.error('[EvmWalletConnect] Initialization failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize');
      setIsInitializing(false);
      isInitializingGlobal = false;
    }
  }, [userId]);

  // Auto-check if client already exists
  useEffect(() => {
    if (!userId) {
      setIsInitializing(false);
      return;
    }

    if (globalEvmSignClient) {
      setClient(globalEvmSignClient);
      setIsInitializing(false);
      const existingSessions = globalEvmSignClient.session.getAll();
      setSessions(
        existingSessions
          .filter(s => s?.topic && s.namespaces?.eip155 !== undefined)
          .map(s => ({
            topic: s.topic,
            peer: s.peer || { metadata: undefined },
            namespaces: s.namespaces || {},
          }))
      );
    } else {
      setIsInitializing(false);
    }
  }, [userId]);

  const pair = useCallback(async (uri: string) => {
    if (!client) {
      throw new Error('WalletConnect client not initialized');
    }

    if (!uri.startsWith('wc:')) {
      throw new Error('Invalid WalletConnect URI');
    }

    try {
      await client.pair({ uri });
      console.log('[EvmWalletConnect] Paired successfully');
    } catch (err) {
      console.error('[EvmWalletConnect] Pairing failed:', err);
      throw err;
    }
  }, [client]);

  const disconnect = useCallback(async (topic: string) => {
    if (!client) {
      throw new Error('WalletConnect client not initialized');
    }

    try {
      await client.disconnect({
        topic,
        reason: { code: 6000, message: 'User disconnected' },
      });

      setSessions(prev => prev.filter(s => s.topic !== topic));
    } catch (err) {
      console.error('[EvmWalletConnect] Disconnect failed:', err);
      throw err;
    }
  }, [client]);

  return {
    client,
    sessions,
    isInitializing,
    error,
    pair,
    disconnect,
    initialize,
  };
}
```

---

### Phase 3: Frontend UI Component (Week 2)

**File**: `apps/web/components/walletconnect/EvmWalletConnect.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useEvmWalletConnect } from '@/hooks/walletconnect/useEvmWalletConnect';

interface EvmWalletConnectProps {
  userId: string;
}

export function EvmWalletConnect({ userId }: EvmWalletConnectProps) {
  const [uri, setUri] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const { client, sessions, isInitializing, error, pair, disconnect, initialize } = useEvmWalletConnect(userId);

  const handleConnect = async () => {
    if (!uri.trim()) return;

    setIsConnecting(true);
    try {
      // Initialize client if not already done
      if (!client) {
        await initialize();
      }

      await pair(uri);
      setUri('');
    } catch (err) {
      console.error('Failed to connect:', err);
      alert(`Failed to connect: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async (topic: string) => {
    try {
      await disconnect(topic);
    } catch (err) {
      console.error('Failed to disconnect:', err);
      alert(`Failed to disconnect: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  if (isInitializing) {
    return <div>Initializing WalletConnect...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">EVM WalletConnect</h2>
        <p className="text-gray-600">Connect to EVM DApps (Ethereum, Base, Arbitrum, etc.)</p>
      </div>

      {/* Connection status */}
      {sessions.length > 0 && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          ✅ Connected to {sessions.length} DApp{sessions.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Active sessions */}
      {sessions.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Active Sessions</h3>
          {sessions.map((session) => (
            <div key={session.topic} className="border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold">
                    {session.peer.metadata?.name || 'Unknown DApp'}
                  </h4>
                  <p className="text-sm text-gray-600">
                    {session.peer.metadata?.url || 'Unknown URL'}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Chains: {session.namespaces.eip155?.chains?.join(', ') || 'None'}
                  </p>
                  <p className="text-xs text-gray-500">
                    Accounts: {session.namespaces.eip155?.accounts?.length || 0}
                  </p>
                </div>
                <button
                  onClick={() => handleDisconnect(session.topic)}
                  className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                >
                  Disconnect
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Connection form */}
      <div className="border rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-2">Connect New DApp</h3>
        <p className="text-sm text-gray-600 mb-4">
          Copy the WalletConnect URI from the DApp and paste it below:
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={uri}
            onChange={(e) => setUri(e.target.value)}
            placeholder="wc:..."
            className="flex-1 border rounded px-3 py-2"
          />
          <button
            onClick={() => navigator.clipboard.readText().then(setUri)}
            className="bg-gray-200 px-3 py-2 rounded hover:bg-gray-300"
          >
            📋
          </button>
          <button
            onClick={handleConnect}
            disabled={!uri.trim() || isConnecting}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isConnecting ? 'Connecting...' : 'Connect'}
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="text-sm text-gray-600">
        <p className="font-semibold mb-2">How to connect:</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Open your favorite EVM DApp (Uniswap, Aave, etc.)</li>
          <li>Click "Connect Wallet" and select "WalletConnect"</li>
          <li>Copy the WalletConnect URI or use the QR code</li>
          <li>Paste the URI above and click "Connect"</li>
        </ol>
      </div>
    </div>
  );
}
```

---

### Phase 4: API Integration (Week 2)

**File**: `apps/web/lib/api.ts` (Add these methods)

```typescript
// Add to existing walletApi object

/**
 * Get EVM WalletConnect accounts (CAIP-10 formatted)
 */
async getEvmWalletConnectAccounts(
  userId: string,
): Promise<{
  userId: string;
  accounts: Array<{
    accountId: string;
    chainId: number;
    address: string;
    chainName: string;
  }>;
}> {
  return fetchApi<{
    userId: string;
    accounts: Array<{
      accountId: string;
      chainId: number;
      address: string;
      chainName: string;
    }>;
  }>(`/wallet/evm/walletconnect/accounts?userId=${encodeURIComponent(userId)}`);
},

/**
 * Sign an EVM transaction for WalletConnect
 */
async signEvmWalletConnectTransaction(data: {
  userId: string;
  accountId: string; // CAIP-10 format
  transaction: {
    to: string;
    value?: string;
    data?: string;
    gas?: string;
    gasPrice?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
    nonce?: string;
  };
}): Promise<{ signature: string; txHash?: string }> {
  return fetchApi<{ signature: string; txHash?: string }>('/wallet/evm/walletconnect/sign-transaction', {
    method: 'POST',
    body: JSON.stringify(data),
  });
},

/**
 * Sign an EVM message for WalletConnect
 */
async signEvmWalletConnectMessage(data: {
  userId: string;
  accountId: string; // CAIP-10 format
  message: string;
}): Promise<{ signature: string }> {
  return fetchApi<{ signature: string }>('/wallet/evm/walletconnect/sign-message', {
    method: 'POST',
    body: JSON.stringify(data),
  });
},

/**
 * Sign EVM typed data for WalletConnect (EIP-712)
 */
async signEvmWalletConnectTypedData(data: {
  userId: string;
  accountId: string; // CAIP-10 format
  typedData: any;
}): Promise<{ signature: string }> {
  return fetchApi<{ signature: string }>('/wallet/evm/walletconnect/sign-typed-data', {
    method: 'POST',
    body: JSON.stringify(data),
  });
},
```

---

## 🧪 Testing Your Implementation

### Backend Tests

```bash
cd apps/backend
npm run test src/wallet/evm/walletconnect/evm-walletconnect.service.spec.ts
```

### Frontend Tests

```bash
cd apps/web
npm run test hooks/walletconnect/useEvmWalletConnect.test.ts
```

### Manual Testing

1. **Start Backend**: `cd apps/backend && npm run dev`
2. **Start Frontend**: `cd apps/web && npm run dev`
3. **Open Browser**: http://localhost:3000/dashboard/walletconnect
4. **Test with Uniswap**: https://app.uniswap.org
   - Click "Connect Wallet"
   - Select "WalletConnect"
   - Copy URI
   - Paste in TempWallets
   - Approve connection
   - Test transaction signing

---

## 🎯 Success Criteria

### Must Have
- ✅ Connect to EVM DApps
- ✅ Sign transactions
- ✅ Sign messages
- ✅ Disconnect sessions
- ✅ No interference with Substrate

### Nice to Have
- Multiple simultaneous sessions
- Session persistence across reloads
- QR code support
- Transaction history

---

## 🔧 Troubleshooting

### Issue: "Client not initialized"
**Solution**: Call `initialize()` before using the client

### Issue: "Invalid account ID"
**Solution**: Ensure CAIP-10 format: `eip155:1:0x...`

### Issue: "Storage conflicts"
**Solution**: Add delays between client initializations (1.5-2 seconds)

### Issue: "User rejected"
**Solution**: Expected behavior when user cancels

---

## 📞 Next Steps

1. ✅ Read `WalletConnectPlan.md` for full architecture
2. ✅ Review `walletconnect-diagram.js` for visual flows
3. ⏭️ Implement backend service (Step 1)
4. ⏭️ Implement backend controller (Step 1)
5. ⏭️ Implement frontend hook (Step 2)
6. ⏭️ Implement frontend UI (Step 3)
7. ⏭️ Test with real DApps
8. ⏭️ Expand to Solana, Bitcoin (Phase 4)

---

**Questions? Issues?** Review the comprehensive plan or check the diagrams!

**Happy Building! 🚀**
