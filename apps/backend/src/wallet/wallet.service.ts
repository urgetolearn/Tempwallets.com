import {
  Injectable,
  BadRequestException,
  Logger,
  UnprocessableEntityException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SeedRepository } from './seed.repository.js';
import { ZerionService } from './zerion.service.js';
import { AddressManager } from './managers/address.manager.js';
import { AccountFactory } from './factories/account.factory.js';
import { NativeEoaFactory } from './factories/native-eoa.factory.js';
import { Eip7702AccountFactory } from './factories/eip7702-account.factory.js';
import { PolkadotEvmRpcService } from './services/polkadot-evm-rpc.service.js';
import { SubstrateManager } from './substrate/managers/substrate.manager.js';
import { SubstrateChainKey } from './substrate/config/substrate-chain.config.js';
import { Eip7702DelegationRepository } from './repositories/eip7702-delegation.repository.js';
import { IAccount } from './types/account.types.js';
import { AllChainTypes } from './types/chain.types.js';
import {
  WalletAddresses,
  UiWalletPayload,
  WalletAddressContext,
  WalletAddressKey,
  WalletConnectNamespacePayload,
} from './interfaces/wallet.interfaces.js';
import { validateAmount, getExplorerUrl } from './utils/validation.utils.js';
import { PimlicoConfigService } from './config/pimlico.config.js';
import { WALLETCONNECT_CHAIN_CONFIG } from './constants/wallet.constants.js';
import { WalletMapper } from './mappers/wallet.mapper.js';
import { WalletIdentityService } from './services/wallet-identity.service.js';
import { WalletBalanceService } from './services/wallet-balance.service.js';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private seedRepository: SeedRepository,
    private zerionService: ZerionService,
    private addressManager: AddressManager,
    private accountFactory: AccountFactory,
    private nativeEoaFactory: NativeEoaFactory,
    private eip7702AccountFactory: Eip7702AccountFactory,
    private polkadotEvmRpcService: PolkadotEvmRpcService,
    private substrateManager: SubstrateManager,
    private pimlicoConfig: PimlicoConfigService,
    private eip7702DelegationRepository: Eip7702DelegationRepository,
    private readonly walletIdentityService: WalletIdentityService,
    private readonly walletMapper: WalletMapper,
    private readonly walletBalanceService: WalletBalanceService,

  ) {}


  /**
   * Get all wallet addresses for all chains
   * Auto-creates wallet if it doesn't exist
   * @param userId - The user ID
   * @returns Object containing addresses for all chains
   */
  async getAddresses(userId: string): Promise<WalletAddresses> {
    // Use the AddressManager for address operations
    return this.addressManager.getAddresses(userId);
  }

  

  async getWalletAddressContext(userId: string): Promise<WalletAddressContext> {
    const { addresses, metadata } =
      await this.addressManager.getManagedAddresses(userId);
    const ui = this.walletMapper.buildUiWalletPayload(metadata);
    return {
      internal: addresses,
      metadata,
      ui,
    };
  }

  async getUiWalletAddresses(userId: string): Promise<UiWalletPayload> {
    const context = await this.getWalletAddressContext(userId);
    return context.ui;
  }

  async getWalletConnectAccounts(
    userId: string,
  ): Promise<WalletConnectNamespacePayload[]> {
    const { metadata } = await this.addressManager.getManagedAddresses(userId);
    const namespaces: WalletConnectNamespacePayload[] = [];

    // EIP155 namespace (EVM chains)
    const eip155Namespace: WalletConnectNamespacePayload = {
      namespace: 'eip155',
      chains: [],
      accounts: [],
      addressesByChain: {},
    };

    for (const config of WALLETCONNECT_CHAIN_CONFIG) {
      const address = metadata[config.key]?.address;

      if (!address) {
        continue;
      }

      const chainTag = `eip155:${config.chainId}`;
      eip155Namespace.chains.push(chainTag);
      eip155Namespace.accounts.push(`${chainTag}:${address}`);
      eip155Namespace.addressesByChain[chainTag] = address;
    }

    if (eip155Namespace.accounts.length > 0) {
      namespaces.push(eip155Namespace);
    }

    // Polkadot namespace (Substrate chains) - with error isolation
    try {
      const substrateAddresses = await this.substrateManager.getAddresses(
        userId,
        false,
      );
      const enabledChains = this.substrateManager.getEnabledChains();

      const polkadotNamespace: WalletConnectNamespacePayload = {
        namespace: 'polkadot',
        chains: [],
        accounts: [],
        addressesByChain: {},
      };

      for (const chain of enabledChains) {
        const address = substrateAddresses[chain];
        if (!address) {
          continue;
        }

        const chainConfig = this.substrateManager.getChainConfig(chain, false);
        const genesisHash = chainConfig.genesisHash;
        const chainTag = `polkadot:${genesisHash}`;
        const accountId = `polkadot:${genesisHash}:${address}`;

        polkadotNamespace.chains.push(chainTag);
        polkadotNamespace.accounts.push(accountId);
        polkadotNamespace.addressesByChain[chainTag] = address;
      }

      if (polkadotNamespace.accounts.length > 0) {
        namespaces.push(polkadotNamespace);
      }
    } catch (error) {
      this.logger.error(
        `Failed to register Polkadot namespace for WalletConnect: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      // Continue with other namespaces - error isolation (Issue #6)
    }

    if (namespaces.length === 0) {
      throw new BadRequestException(
        'No WalletConnect-compatible addresses found. Please initialize your wallet first.',
      );
    }

    // Return first namespace for backward compatibility, but log that multiple namespaces are available
    if (namespaces.length > 1) {
      this.logger.debug(
        `Multiple WalletConnect namespaces available: ${namespaces.map((n) => n.namespace).join(', ')}`,
      );
    }

    return namespaces;
  }

  /**
   * Get all token positions across any supported chains for the user's primary addresses
   * Uses Zerion any-chain endpoints per address (no chain filter) and merges results.
   * Primary addresses considered: EVM EOA (ethereum), first ERC-4337 smart account, and Solana.
   * @param userId - The user ID
   * @param forceRefresh - Force refresh from API (bypass Zerion's internal cache)
   */
  async getTokenBalancesAny(
    userId: string,
    forceRefresh: boolean = false,
  ): Promise<
    Array<{
      chain: string;
      address: string | null;
      symbol: string;
      balance: string;
      decimals: number;
      balanceHuman?: string;
    }>
  > {
    return this.walletBalanceService.getTokenBalancesAny(
      userId,
      forceRefresh,
    );
  }

  /**
   * Get transactions across any supported chains for the user's primary addresses
   * Merges and dedupes by chain_id + tx hash.
   */
  async getTransactionsAny(
    userId: string,
    limit: number = 100,
  ): Promise<
    Array<{
      txHash: string;
      from: string;
      to: string | null;
      value: string;
      timestamp: number | null;
      blockNumber: number | null;
      status: 'success' | 'failed' | 'pending';
      chain: string;
      tokenSymbol?: string;
      tokenAddress?: string;
    }>
  > {
    const hasSeed = await this.seedRepository.hasSeed(userId);
    if (!hasSeed) {
      await this.walletIdentityService.createOrImportSeed(userId, 'random');
    }

    const addresses = await this.getAddresses(userId);
    const targetAddresses = [addresses.ethereum, addresses.solana].filter(
      Boolean,
    );

    // Polkadot EVM chains use the same EOA address as ethereum
    const polkadotEvmAddress = addresses.ethereum;

    // Fetch transactions from Zerion with timeout protection
    const zerionPerAddr =
      targetAddresses.length > 0
        ? await Promise.allSettled(
            targetAddresses.map((addr) =>
              Promise.race([
                this.zerionService.getTransactionsAnyChain(addr, limit),
                new Promise<never>((_, reject) =>
                  setTimeout(
                    () =>
                      reject(
                        new Error(
                          `Transaction fetch timeout for ${addr} after 30s`,
                        ),
                      ),
                    30000,
                  ),
                ),
              ]).catch((error) => {
                this.logger.warn(
                  `Failed to fetch transactions for ${addr}: ${error instanceof Error ? error.message : 'Unknown error'}`,
                );
                return []; // Return empty array on error/timeout
              }),
            ),
          ).then((results) =>
            results.map((result) =>
              result.status === 'fulfilled' ? result.value : [],
            ),
          )
        : [];

    // Fetch Polkadot EVM chain transactions using RPC
    const polkadotEvmChains = [
      'moonbeamTestnet',
      'astarShibuya',
      'paseoPassetHub',
    ];
    const polkadotTransactions: Array<{
      txHash: string;
      from: string;
      to: string | null;
      value: string;
      timestamp: number | null;
      blockNumber: number | null;
      status: 'success' | 'failed' | 'pending';
      chain: string;
      tokenSymbol?: string;
      tokenAddress?: string;
    }> = [];

    if (polkadotEvmAddress) {
      // Use Promise.allSettled with timeout to ensure RPC errors don't block Zerion results
      const polkadotResults = await Promise.allSettled(
        polkadotEvmChains.map(async (chain) => {
          try {
            const txs = await Promise.race([
              this.polkadotEvmRpcService.getTransactions(
                polkadotEvmAddress,
                chain,
                limit,
              ),
              new Promise<never>((_, reject) =>
                setTimeout(
                  () => reject(new Error(`RPC timeout for ${chain} after 20s`)),
                  20000,
                ),
              ),
            ]);
            return txs.map((tx) => ({
              txHash: tx.txHash,
              from: tx.from,
              to: tx.to,
              value: tx.value,
              timestamp: tx.timestamp,
              blockNumber: tx.blockNumber,
              status: tx.status,
              chain: tx.chain,
            }));
          } catch (error) {
            this.logger.warn(
              `Error fetching transactions for ${chain}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
            return []; // Return empty array on error
          }
        }),
      );

      // Flatten the results
      for (const result of polkadotResults) {
        if (result.status === 'fulfilled') {
          polkadotTransactions.push(...result.value);
        }
      }
    }

    const perAddr = [...zerionPerAddr];

    const byKey = new Map<
      string,
      {
        txHash: string;
        from: string;
        to: string | null;
        value: string;
        timestamp: number | null;
        blockNumber: number | null;
        status: 'success' | 'failed' | 'pending';
        chain: string;
        tokenSymbol?: string;
        tokenAddress?: string;
      }
    >();

    for (const list of perAddr) {
      for (const tx of list) {
        try {
          const attrs = tx.attributes || {};
          const chainId =
            tx.relationships?.chain?.data?.id?.toLowerCase() || 'unknown';
          const hash = (attrs.hash || tx.id || '').toLowerCase();
          if (!hash) continue;

          // Determine status
          let status: 'success' | 'failed' | 'pending' = 'pending';
          if (attrs.status) {
            const s = attrs.status.toLowerCase();
            if (s === 'confirmed' || s === 'success') status = 'success';
            else if (s === 'failed' || s === 'error') status = 'failed';
          } else if (
            attrs.block_confirmations !== undefined &&
            attrs.block_confirmations > 0
          ) {
            status = 'success';
          }

          const transfers = attrs.transfers || [];
          let tokenSymbol: string | undefined;
          let tokenAddress: string | undefined;
          let value = '0';
          let toAddress: string | null = null;

          if (transfers.length > 0) {
            const tr = transfers[0];
            if (tr) {
              tokenSymbol = tr.fungible_info?.symbol;
              const q = tr.quantity;
              if (q) {
                const intPart = q.int || '0';
                const decimals = q.decimals || 0;
                value = `${intPart}${'0'.repeat(Math.max(0, 18 - decimals))}`;
              }
              toAddress = tr.to?.address || null;
            }
          }

          const key = `${chainId}:${hash}`;
          if (!byKey.has(key)) {
            byKey.set(key, {
              txHash: hash,
              from: '',
              to: toAddress,
              value,
              timestamp: attrs.mined_at || attrs.sent_at || null,
              blockNumber: attrs.block_number || null,
              status,
              chain: chainId,
              tokenSymbol,
              tokenAddress,
            });
          }
        } catch (e) {
          this.logger.debug(
            `Error processing any-chain tx: ${e instanceof Error ? e.message : 'Unknown error'}`,
          );
        }
      }
    }

    // Process Polkadot EVM RPC transactions
    for (const tx of polkadotTransactions) {
      try {
        const key = `${tx.chain}:${tx.txHash.toLowerCase()}`;
        if (!byKey.has(key)) {
          byKey.set(key, {
            txHash: tx.txHash,
            from: tx.from,
            to: tx.to,
            value: tx.value,
            timestamp: tx.timestamp,
            blockNumber: tx.blockNumber,
            status: tx.status,
            chain: tx.chain,
          });
        }
      } catch (e) {
        this.logger.debug(
          `Error processing Polkadot EVM transaction: ${e instanceof Error ? e.message : 'Unknown error'}`,
        );
      }
    }

    const sorted = Array.from(byKey.values()).sort((a, b) => {
      const timeA = a.timestamp || 0;
      const timeB = b.timestamp || 0;
      return timeB - timeA; // Most recent first
    });

    this.logger.log(
      `Returning ${Math.min(sorted.length, limit)} transactions (from ${sorted.length} total) for user ${userId}`,
    );

    return sorted.slice(0, limit);
  }

  /**
   * Stream addresses progressively (for SSE)
   * Yields addresses as they become available
   */
  async *streamAddresses(
    userId: string,
  ): AsyncGenerator<UiWalletPayload, void, unknown> {
    const collected: Partial<Record<WalletAddressKey, string | null>> = {};

    for await (const { chain, address } of this.addressManager.streamAddresses(
      userId,
    )) {
      const key = chain as WalletAddressKey;
      collected[key] = address;

      if (!this.walletMapper.isVisibleChain(key)) {
        continue;
      }

      const metadata = this.walletMapper.buildMetadataSnapshot(collected);
      const uiPayload = this.walletMapper.buildUiWalletPayload(metadata);
      yield uiPayload;
    }
  }

  /**
   * Stream balances progressively (for SSE)
   * Yields balances as they're fetched from Zerion
   */
  async *streamBalances(userId: string): AsyncGenerator<
    {
      chain: string;
      nativeBalance: string;
      tokens: Array<{
        address: string | null;
        symbol: string;
        balance: string;
        decimals: number;
      }>;
    },
    void,
    unknown
  > {
    for await (const balance of this.walletBalanceService.streamBalances(
      userId,
    )) {
      yield balance;
    }
  }

  /**
   * Get balances for all chains using Zerion API
   * Auto-creates wallet if it doesn't exist
   * @param userId - The user ID
   * @returns Array of balance objects
   */
  async getBalances(
    userId: string,
    forceRefresh: boolean = false,
  ): Promise<Array<{ chain: string; balance: string }>> {
    return this.walletBalanceService.getBalances(userId, forceRefresh);
  }

  /**
   * Refresh balances from external APIs and update cache
   * @param userId - The user ID
   * @returns Fresh balances from APIs
   */
  async refreshBalances(
    userId: string,
  ): Promise<Array<{ chain: string; balance: string }>> {
    return this.walletBalanceService.refreshBalances(userId);
  }

  /**
   * Get ERC-4337 paymaster token balances
   * @param userId - The user ID
   * @returns Array of paymaster token balances
   */
  async getErc4337PaymasterBalances(
    userId: string,
  ): Promise<Array<{ chain: string; balance: string }>> {
    return this.walletBalanceService.getErc4337PaymasterBalances(userId);
  }

  /**
   * Convert human-readable amount to smallest units (BigInt)
   * @param humanAmount - Human-readable amount string (e.g., "1.5")
   * @param decimals - Number of decimal places
   * @returns BigInt representing the amount in smallest units
   */
  private convertToSmallestUnits(
    humanAmount: string,
    decimals: number,
  ): bigint {
    const [wholeRaw = '0', fracRaw = ''] = humanAmount.trim().split('.');
    const whole = wholeRaw.replace(/^0+/, '') || '0';
    const fracPadded = (fracRaw + '0'.repeat(decimals)).slice(0, decimals);
    const combined = (whole + fracPadded).replace(/^0+/, '') || '0';
    return BigInt(combined);
  }

  /**
   * Convert smallest units to human-readable amount
   * @param smallestUnits - Amount in smallest units (string)
   * @param decimals - Number of decimal places
   * @returns Human-readable amount string
   */
  private convertSmallestToHuman(
    smallestUnits: string,
    decimals: number,
  ): string {
    const smallestBigInt = BigInt(smallestUnits);
    const divisor = BigInt(10 ** decimals);
    const whole = smallestBigInt / divisor;
    const remainder = smallestBigInt % divisor;

    if (remainder === 0n) {
      return whole.toString();
    }

    const remainderStr = remainder.toString().padStart(decimals, '0');
    const trimmedRemainder = remainderStr.replace(/0+$/, '');
    return `${whole}.${trimmedRemainder}`;
  }

  /**
   * Check if a smart account is deployed on-chain
   * @param account - WDK account instance
   * @returns true if account is deployed, false otherwise
   */
  private async checkIfDeployed(account: any): Promise<boolean> {
    try {
      const address = await account.getAddress();

      // Get provider from account
      let provider: any = null;
      if ('provider' in account) {
        provider = account.provider;
      } else if (
        'getProvider' in account &&
        typeof account.getProvider === 'function'
      ) {
        provider = await account.getProvider();
      }

      if (!provider || typeof provider.request !== 'function') {
        this.logger.warn(
          `Cannot check deployment status: provider not available for address ${address}`,
        );
        return false;
      }

      // Check if contract code exists at address
      const code = await provider.request({
        method: 'eth_getCode',
        params: [address, 'latest'],
      });

      const isDeployed = code && code !== '0x' && code !== '0x0';

      this.logger.log(
        `[Deployment Check] Address: ${address}, deployed: ${isDeployed}, code length: ${code?.length || 0}`,
      );

      return isDeployed;
    } catch (e) {
      this.logger.error(
        `Failed to check deployment status: ${e instanceof Error ? e.message : 'Unknown error'}`,
      );
      return false;
    }
  }

  /**
   * Deploy an ERC-4337 smart account using UserOperation
   * @param account - WDK ERC-4337 account instance
   * @param address - Account address
   * @param chain - Internal chain name
   * @returns Promise that resolves when deployment is complete
   */
  private async deployErc4337Account(
    account: any,
    address: string,
    chain: string,
  ): Promise<void> {
    this.logger.log(
      `[Deploy] Starting deployment for ERC-4337 account ${address} on ${chain}`,
    );

    try {
      // Method 1: Try deployAccount() if available
      if (
        'deployAccount' in account &&
        typeof account.deployAccount === 'function'
      ) {
        await account.deployAccount();
        return;
      }

      // Method 2: Try deploy() if available
      if ('deploy' in account && typeof account.deploy === 'function') {
        await account.deploy();
        return;
      }

      // Method 3: Send a zero-value transaction to self to trigger deployment
      // ERC-4337 accounts typically auto-deploy on first UserOperation
      if ('send' in account && typeof account.send === 'function') {
        await account.send(address, '0');

        // Wait a bit for deployment to be confirmed
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Verify deployment
        const isNowDeployed = await this.checkIfDeployed(account);
        if (!isNowDeployed) {
          throw new Error(
            'Deployment transaction sent but account not deployed yet. Please try again in a moment.',
          );
        }
        return;
      }

      // Method 4: Try transfer with structured params
      if ('transfer' in account && typeof account.transfer === 'function') {
        this.logger.debug(
          `[Deploy] Using account.transfer() to trigger deployment`,
        );
        const result = await account.transfer({
          to: address,
          amount: 0,
        });
        this.logger.log(
          `[Deploy] Deployment triggered via transfer: ${JSON.stringify(result)}`,
        );

        // Wait for deployment confirmation
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Verify deployment
        const isNowDeployed = await this.checkIfDeployed(account);
        if (!isNowDeployed) {
          throw new Error(
            'Deployment transaction sent but account not deployed yet. Please try again in a moment.',
          );
        }
        return;
      }

      // If no deployment method found, throw error
      throw new Error(
        `No deployment method available for ERC-4337 account. ` +
          `Account type may not support auto-deployment. ` +
          `Available methods: ${Object.keys(account)
            .filter((k) => typeof account[k] === 'function')
            .join(', ')}`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[Deploy] Deployment failed: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Create an account instance using appropriate factory based on chain type
   * @param seedPhrase - The mnemonic seed phrase
   * @param chain - The blockchain network
   * @returns Account instance implementing IAccount interface
   */
  private async createAccountForChain(
    seedPhrase: string,
    chain: AllChainTypes,
    userId?: string,
  ): Promise<IAccount> {
    const eip7702Chains: AllChainTypes[] = [
      'ethereum',
      'base',
      'arbitrum',
      'optimism',
    ];

    const isEip7702 =
      this.pimlicoConfig.isEip7702Enabled(chain) &&
      eip7702Chains.includes(chain);

    if (isEip7702) {
      return this.eip7702AccountFactory.createAccount(
        seedPhrase,
        chain as 'ethereum' | 'base' | 'arbitrum' | 'optimism',
        0,
        userId,
      );
    }

    const evmChains: AllChainTypes[] = [
      'ethereum',
      'base',
      'arbitrum',
      'optimism',
      'polygon',
      'avalanche',
      'bnb',
    ];

    if (evmChains.includes(chain)) {
      return this.nativeEoaFactory.createAccount(
        seedPhrase,
        chain as
          | 'ethereum'
          | 'base'
          | 'arbitrum'
          | 'polygon'
          | 'avalanche',
        0,
      );
    }

    return this.accountFactory.createAccount(seedPhrase, chain, 0);
  }

  /**
   * Send crypto to a recipient address
   * @param userId - The user ID
   * @param chain - The blockchain network
   * @param recipientAddress - The recipient's address
   * @param amount - The amount to send (as string to preserve precision)
   * @param tokenAddress - Optional token contract address for ERC-20 tokens
   * @param tokenDecimals - Optional token decimals from Zerion/UI (if provided, will be used directly)
   * @returns Transaction hash
   */
  async sendCrypto(
    userId: string,
    chain: AllChainTypes,
    recipientAddress: string,
    amount: string,
    tokenAddress?: string,
    tokenDecimals?: number,
    options?: { forceEip7702?: boolean },
  ): Promise<{ txHash: string }> {
    this.logger.log(
      `Sending crypto for user ${userId} on chain ${chain}: ${amount} to ${recipientAddress}`,
    );

    // Check if wallet exists, create if not
    const hasSeed = await this.seedRepository.hasSeed(userId);

    if (!hasSeed) {
      await this.walletIdentityService.createOrImportSeed(userId, 'random');
    }

    // Validate amount
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      throw new BadRequestException('Amount must be a positive number');
    }

    const forceEip7702 = options?.forceEip7702 === true;
    const isEip7702Chain = this.pimlicoConfig.isEip7702Enabled(chain);
    const accountType = isEip7702Chain ? 'EIP-7702' : 'EOA';

    try {
      const seedPhrase = await this.seedRepository.getSeedPhrase(userId);

      // Auto-route native sends on EIP-7702 enabled chains to the gasless flow to avoid zeroed gas fields
      if (isEip7702Chain && !tokenAddress && !forceEip7702) {
        const chainId = this.pimlicoConfig.getEip7702Config(
          chain as
            | 'ethereum'
            | 'base'
            | 'arbitrum'
            | 'optimism'
            | 'polygon'
            | 'bnb'
            | 'avalanche',
        ).chainId;

        this.logger.warn(
          `[Auto-Route] Chain ${chain} has EIP-7702 enabled but sendCrypto() was called. ` +
            `Routing to sendEip7702Gasless() for proper user operation flow.`,
        );

        const result = await this.sendEip7702Gasless(
          userId,
          chainId,
          recipientAddress,
          amount,
          tokenAddress,
          tokenDecimals,
        );

        return { txHash: result.transactionHash || result.userOpHash };
      }

      // Create account using appropriate factory
      const account = await this.createAccountForChain(
        seedPhrase,
        chain,
        userId,
      );
      const walletAddress = await account.getAddress();

      this.logger.log(
        `[Send Debug] User is sending ${amount} ${tokenAddress || 'native'} from ${chain} ` +
          `(accountType: ${accountType}, address: ${walletAddress})`,
      );

      // Get decimals: Use provided tokenDecimals, or fetch from Zerion, or use native decimals
      let finalDecimals: number;
      let decimalsSource: string;

      if (tokenAddress) {
        // ERC-20 token
        if (
          tokenDecimals !== undefined &&
          tokenDecimals !== null &&
          tokenDecimals >= 0 &&
          tokenDecimals <= 36
        ) {
          // OPTIMIZED: Use provided decimals from UI/Zerion directly - no re-fetch
          finalDecimals = tokenDecimals;
          decimalsSource = 'frontend-zerion';
          this.logger.log(
            `[Decimals Optimization] Using frontend-provided token decimals: ${finalDecimals} ` +
              `(source: ${decimalsSource}). Skipping redundant Zerion API call.`,
          );
        } else {
          // Frontend didn't provide decimals or they're invalid - fetch from Zerion
          this.logger.warn(
            `[Decimals Fallback] Frontend did not provide valid tokenDecimals for ${tokenAddress}. ` +
              `Provided value: ${tokenDecimals}. Falling back to Zerion API lookup.`,
          );

          const tokenInfo = await this.walletBalanceService.getZerionTokenInfo(
            tokenAddress,
            chain,
            walletAddress,
          );
          if (
            tokenInfo &&
            tokenInfo.decimals !== null &&
            tokenInfo.decimals !== undefined &&
            tokenInfo.decimals >= 0 &&
            tokenInfo.decimals <= 36
          ) {
            finalDecimals = tokenInfo.decimals;
            decimalsSource = 'zerion-api';
            this.logger.log(
              `[Decimals Fallback] Fetched token decimals from Zerion API: ${finalDecimals} ` +
                `(source: ${decimalsSource})`,
            );
          } else {
            // Zerion failed - try RPC as final fallback
            this.logger.warn(
              `[Decimals Fallback] Zerion API lookup failed for ${tokenAddress} on ${chain}. ` +
                `Trying RPC decimals() call as final fallback.`,
            );

            const rpcDecimals = await this.walletBalanceService.fetchDecimalsFromRPC(
              tokenAddress,
              account,
            );
            if (rpcDecimals !== null && rpcDecimals >= 0 && rpcDecimals <= 36) {
              finalDecimals = rpcDecimals;
              decimalsSource = 'rpc-decimals()';
              this.logger.log(
                `[Decimals Fallback] Fetched token decimals from RPC: ${finalDecimals} ` +
                  `(source: ${decimalsSource})`,
              );
            } else {
              // All methods failed
              throw new BadRequestException(
                `Cannot determine token decimals for ${tokenAddress} on ${chain}. ` +
                  `Attempted: Frontend (${tokenDecimals}), Zerion API (failed), RPC decimals() (failed). ` +
                  `This token may not exist on ${chain}, or Zerion data is incomplete. ` +
                  `Please refresh your wallet data and try again.`,
              );
            }
          }
        }
      } else {
        // Native token
        finalDecimals = this.walletBalanceService.getNativeTokenDecimals(chain);
        decimalsSource = 'native';
        this.logger.log(
          `Using native token decimals: ${finalDecimals} (source: ${decimalsSource})`,
        );
      }

      // Convert human-readable amount to smallest units using Zerion's decimals
      const amountSmallest = this.convertToSmallestUnits(amount, finalDecimals);
      this.logger.log(
        `Send pre-check: chain=${chain}, accountType=${accountType}, token=${tokenAddress || 'native'}, ` +
          `humanAmount=${amount}, decimals=${finalDecimals} (source: ${decimalsSource}), ` +
          `amountSmallest=${amountSmallest.toString()}`,
      );

      // Validate address format (basic check)
      if (!recipientAddress || recipientAddress.trim().length === 0) {
        throw new BadRequestException('Recipient address is required');
      }

      // Validate balance using Zerion as primary source
      const balanceValidation =
        await this.walletBalanceService.validateBalanceFromZerion(
        tokenAddress || null,
        amountSmallest,
        chain,
        walletAddress,
      );

      this.logger.log(
        `Balance validation: zerionBalance=${balanceValidation.zerionBalance}, ` +
          `requested=${amountSmallest.toString()}, sufficient=${balanceValidation.sufficient}`,
      );

      // Use on-chain balance as source of truth - verify if Zerion says insufficient
      if (!balanceValidation.sufficient) {
        // Zerion says insufficient - verify with on-chain balance (source of truth)
        this.logger.warn(
          `Zerion reported insufficient balance (${balanceValidation.zerionBalance}), ` +
            `verifying with on-chain balance (source of truth)`,
        );

        try {
          const onChainValidation =
            await this.walletBalanceService.validateBalanceOnChain(
            tokenAddress || null,
            amountSmallest,
            account,
          );

          if (onChainValidation.sufficient) {
            // On-chain says sufficient - allow transaction (Zerion may be stale)
            this.logger.warn(
              `Balance discrepancy detected: Zerion shows ${balanceValidation.zerionBalance}, ` +
                `on-chain shows ${onChainValidation.balance}, requested ${amountSmallest.toString()}. ` +
                `Using on-chain balance (source of truth) - proceeding with transaction.`,
            );
            // Don't throw error - proceed with send
          } else {
            // Both Zerion AND on-chain say insufficient
            const errorMessage =
              balanceValidation.error ||
              `Insufficient balance confirmed by both Zerion and on-chain. ` +
                `Zerion: ${balanceValidation.zerionBalance} smallest units, ` +
                `On-chain: ${onChainValidation.balance} smallest units, ` +
                `Requested: ${amountSmallest.toString()} smallest units`;

            this.logger.error(
              `Insufficient balance: ${errorMessage}, token=${tokenAddress || 'native'}, ` +
                `decimals=${finalDecimals}, chain=${chain}`,
            );

            throw new UnprocessableEntityException(errorMessage);
          }
        } catch (e) {
          if (e instanceof UnprocessableEntityException) {
            throw e;
          }

          // Couldn't get on-chain balance - trust Zerion
          this.logger.error(
            `Could not verify with on-chain balance: ${e instanceof Error ? e.message : 'Unknown error'}. ` +
              `Trusting Zerion result.`,
          );

          const errorMessage =
            balanceValidation.error ||
            `Insufficient balance. Zerion shows: ${balanceValidation.zerionBalance} smallest units, ` +
              `Requested: ${amountSmallest.toString()} smallest units. ` +
              `Could not verify with on-chain balance.`;

          throw new UnprocessableEntityException(errorMessage);
        }
      } else {
        // Zerion says sufficient - log for debugging but proceed
        this.logger.log(
          `Balance validation passed: Zerion shows ${balanceValidation.zerionBalance}, ` +
            `requested ${amountSmallest.toString()}`,
        );
      }

      // Send transaction- single mapped method per account type
      let txHash: string = '';
      let sendMethod: string = 'unknown';

      try {
        if (tokenAddress) {
          // ERC-20 token transfer
          // Use account.transfer with structured parameters (preferred for both EOA and ERC-4337)
          if (
            'transfer' in account &&
            typeof (account as any).transfer === 'function'
          ) {
            try {
              // Try with 'recipient' key first
              // Define a type for accounts with transfer method
              type TransferableAccount = {
                transfer(params: {
                  token: string;
                  recipient: string;
                  amount: bigint;
                }): Promise<string | { hash?: string; txHash?: string }>;
              };
              const transferableAccount = account as TransferableAccount;
              const result = await transferableAccount.transfer({
                token: tokenAddress,
                recipient: recipientAddress,
                amount: amountSmallest,
              });
              if (typeof result === 'string') {
                txHash = result;
              } else if (
                typeof result === 'object' &&
                result !== null &&
                ('hash' in result || 'txHash' in result)
              ) {
                txHash =
                  (result as { hash?: string; txHash?: string }).hash ||
                  (result as { hash?: string; txHash?: string }).txHash ||
                  String(result);
              } else {
                txHash = String(result);
              }
              sendMethod = 'transfer({token, recipient, amount})';
            } catch (e1) {
              // Try with 'to' key if 'recipient' was not accepted
              try {
                const result = await (account as any).transfer({
                  token: tokenAddress,
                  to: recipientAddress,
                  amount: amountSmallest,
                });
                txHash =
                  typeof result === 'string'
                    ? result
                    : result?.hash || result?.txHash || String(result);
                sendMethod = 'transfer({token, to, amount})';
              } catch (e2) {
                this.logger.error(
                  `Token transfer via account.transfer failed: ${e2 instanceof Error ? e2.message : 'unknown'}`,
                );
                throw new ServiceUnavailableException(
                  `Token transfer method not supported. Account type: ${accountType}, ` +
                    `Error: ${e2 instanceof Error ? e2.message : 'unknown'}`,
                );
              }
            }
          } else {
            throw new ServiceUnavailableException(
              `Token transfer not supported for account type ${accountType} on chain ${chain}. ` +
                `The account does not support the transfer method.`,
            );
          }
        } else {
          // Native token transfer
          if ('send' in account && typeof account.send === 'function') {
            const result = await account.send(
              recipientAddress,
              amountSmallest.toString(),
            );
            txHash =
              typeof result === 'string'
                ? result
                : (result as any).hash ||
                  (result as any).txHash ||
                  String(result);
            sendMethod = 'send(recipient, amount)';
          } else if (
            'transfer' in account &&
            typeof (account as any).transfer === 'function'
          ) {
            const result = await (account as any).transfer({
              to: recipientAddress,
              amount: amountSmallest,
            });
            txHash =
              typeof result === 'string'
                ? result
                : result.hash || result.txHash || String(result);
            sendMethod = 'transfer({to, amount})';
          } else {
            throw new BadRequestException(
              `Native token send not supported for chain ${chain}. ` +
                `Account type: ${accountType}. Please check if this chain/account combination is supported.`,
            );
          }
        }

        if (!txHash || typeof txHash !== 'string') {
          throw new ServiceUnavailableException(
            'Transaction submitted but no transaction hash returned',
          );
        }

        // Structured logging for successful transaction
        this.logger.log(
          `Transaction successful: chain=${chain}, accountType=${accountType}, ` +
            `token=${tokenAddress || 'native'}, decimals=${finalDecimals} (source: ${decimalsSource}), ` +
            `humanAmount=${amount}, amountSmallest=${amountSmallest.toString()}, ` +
            `method=${sendMethod}, txHash=${txHash}, recipient=${recipientAddress}`,
        );

        // Invalidate caches after successful send
        try {
          // Invalidate Zerion cache
          this.zerionService.invalidateCache(walletAddress, chain);
          this.logger.log(
            `Invalidated Zerion cache for ${walletAddress} on ${chain} after send`,
          );
        } catch (cacheError) {
          this.logger.warn(
            `Failed to invalidate cache: ${cacheError instanceof Error ? cacheError.message : 'Unknown error'}`,
          );
        }

        return { txHash };
      } catch (error) {
        // Structured error logging
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(
          `Transaction failed: chain=${chain}, accountType=${accountType}, ` +
            `token=${tokenAddress || 'native'}, decimals=${finalDecimals} (source: ${decimalsSource}), ` +
            `humanAmount=${amount}, amountSmallest=${amountSmallest.toString()}, ` +
            `method=${sendMethod}, error=${errorMessage}`,
        );

        // Re-throw known exceptions
        if (
          error instanceof BadRequestException ||
          error instanceof UnprocessableEntityException ||
          error instanceof ServiceUnavailableException
        ) {
          throw error;
        }

        // Enhanced error handling with specific messages
        const lowerError = errorMessage.toLowerCase();

        if (
          lowerError.includes('insufficient') ||
          lowerError.includes('balance')
        ) {
          throw new UnprocessableEntityException(
            `Insufficient balance for this transaction. ` +
              `Please check your balance and try again. Error: ${errorMessage}`,
          );
        }

        if (
          lowerError.includes('network') ||
          lowerError.includes('timeout') ||
          lowerError.includes('rpc')
        ) {
          throw new ServiceUnavailableException(
            `Blockchain network is unavailable. Please try again later. Error: ${errorMessage}`,
          );
        }

        if (
          lowerError.includes('invalid address') ||
          lowerError.includes('address')
        ) {
          throw new BadRequestException(
            `Invalid recipient address. Error: ${errorMessage}`,
          );
        }

        if (
          lowerError.includes('nonce') ||
          lowerError.includes('replacement')
        ) {
          throw new ServiceUnavailableException(
            `Transaction nonce error. Please wait a moment and try again. Error: ${errorMessage}`,
          );
        }

        // Generic fallback
        throw new ServiceUnavailableException(
          `Transaction failed: ${errorMessage}`,
        );
      }
    } catch (error) {
      // Re-throw known exceptions (they already have proper error messages)
      if (
        error instanceof BadRequestException ||
        error instanceof UnprocessableEntityException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }
      // Log unexpected errors with full context
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Unexpected error in sendCrypto: userId=${userId}, chain=${chain}, ` +
          `token=${tokenAddress || 'native'}, amount=${amount}, error=${errorMessage}`,
      );
      this.logger.error(
        `Stack trace: ${error instanceof Error ? error.stack : 'No stack trace'}`,
      );
      throw new ServiceUnavailableException(
        `Failed to send crypto: ${errorMessage}`,
      );
    }
  }

  async sendEip7702Gasless(
    userId: string,
    chainId: number,
    recipientAddress: string,
    amount: string,
    tokenAddress?: string,
    tokenDecimals?: number,
  ): Promise<{
    success: boolean;
    userOpHash: string;
    transactionHash?: string;
    isFirstTransaction: boolean;
    explorerUrl?: string;
  }> {
    const chainIdMap: Record<number, AllChainTypes> = {
      1: 'ethereum',
      8453: 'base',
      42161: 'arbitrum',
      10: 'optimism',
      137: 'polygon',
      43114: 'avalanche',
      56: 'bnb',
    };

    const chain = chainIdMap[chainId];
    if (!chain) {
      throw new BadRequestException(`Unsupported EIP-7702 chainId: ${chainId}`);
    }

    if (!this.pimlicoConfig.isEip7702Enabled(chain)) {
      throw new BadRequestException(
        `EIP-7702 is not enabled for chain ${chain}. Enable via config before sending gasless transactions.`,
      );
    }

    // Determine if this is the first delegation/transaction before sending
    const isFirstTransaction =
      !(await this.eip7702DelegationRepository.hasDelegation(userId, chainId));

    const { txHash } = await this.sendCrypto(
      userId,
      chain,
      recipientAddress,
      amount,
      tokenAddress,
      tokenDecimals,
      { forceEip7702: true },
    );

    // Generate explorer URL for the transaction
    const explorerUrl = getExplorerUrl(txHash, chainId);

    return {
      success: true,
      userOpHash: txHash,
      transactionHash: txHash,
      isFirstTransaction,
      explorerUrl,
    };
  }

  /**
   * Sign a WalletConnect transaction request
   * @param userId - The user ID
   * @param chainId - WalletConnect chain ID (e.g., "eip155:1", "eip155:8453")
   * @param transaction - Transaction parameters from WalletConnect
   * @returns Transaction hash
   */
  async signWalletConnectTransaction(
    userId: string,
    chainId: string,
    transaction: {
      from: string;
      to?: string;
      value?: string;
      data?: string;
      gas?: string;
      gasPrice?: string;
      maxFeePerGas?: string;
      maxPriorityFeePerGas?: string;
      nonce?: string;
    },
  ): Promise<{ txHash: string }> {
    const hasSeed = await this.seedRepository.hasSeed(userId);

    if (!hasSeed) {
      await this.walletIdentityService.createOrImportSeed(userId, 'random');
    }

    const chainIdMatch = chainId.match(/^eip155:(\d+)$/);
    if (!chainIdMatch || !chainIdMatch[1]) {
      throw new BadRequestException(
        `Invalid WalletConnect chain ID format: ${chainId}. Expected format: eip155:chainId`,
      );
    }

    const chainMap: Record<string, AllChainTypes> = {
      '1': 'ethereum',
      '8453': 'base',
      '42161': 'arbitrum',
      '137': 'polygon',
      '43114': 'avalanche',
    };

    const internalChain = chainMap[chainIdMatch[1]];
    if (!internalChain) {
      throw new BadRequestException(
        `Unsupported chain ID: ${chainIdMatch[1]}. Supported chains: ${Object.keys(chainMap).join(', ')}`,
      );
    }

    const seedPhrase = await this.seedRepository.getSeedPhrase(userId);
    const account = await this.createAccountForChain(
      seedPhrase,
      internalChain,
      userId,
    );

    const to = transaction.to || transaction.from;
    const value = transaction.value || '0';
    const txHash = await account.send(to, value);
    return { txHash };
  }

  /**
   * Get token balances for a specific chain using Zerion API
   * @param userId - The user ID
   * @param chain - The blockchain network
   * @param forceRefresh - Force refresh from API (bypass Zerion's internal cache)
   * @returns Array of token balances
   */
  async getTokenBalances(
    userId: string,
    chain: string,
    forceRefresh: boolean = false,
  ): Promise<
    Array<{
      address: string | null;
      symbol: string;
      balance: string;
      decimals: number;
    }>
  > {
    return this.walletBalanceService.getTokenBalances(
      userId,
      chain,
      forceRefresh,
    );
  }

  /**
   * Get token addresses for a chain (fallback list for common tokens)
   * Used when dynamic discovery fails
   */
  private getTokenAddressesForChain(
    chain: string,
  ): Array<{ address: string; symbol: string; decimals: number }> {
    // Token addresses per network (fallback for common tokens)
    const tokens: Record<
      string,
      Array<{ address: string; symbol: string; decimals: number }>
    > = {
      ethereum: [
        {
          address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
          symbol: 'USDT',
          decimals: 6,
        },
        {
          address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          symbol: 'USDC',
          decimals: 6,
        },
      ],
      ethereumErc4337: [
        {
          address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
          symbol: 'USDT',
          decimals: 6,
        },
        {
          address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          symbol: 'USDC',
          decimals: 6,
        },
      ],
      baseErc4337: [
        {
          address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          symbol: 'USDC',
          decimals: 6,
        },
      ],
      arbitrumErc4337: [
        {
          address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
          symbol: 'USDT',
          decimals: 6,
        },
        {
          address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
          symbol: 'USDC',
          decimals: 6,
        },
      ],
      polygonErc4337: [
        {
          address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
          symbol: 'USDT',
          decimals: 6,
        },
        {
          address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
          symbol: 'USDC',
          decimals: 6,
        },
      ],
    };
    return tokens[chain] || [];
  }

  /**
   * Get transaction history for a user on a specific chain using Zerion API
   * @param userId - The user ID
   * @param chain - The chain identifier
   * @param limit - Maximum number of transactions to return (default: 50)
   * @returns Array of transaction objects
   */
  async getTransactionHistory(
    userId: string,
    chain: string,
    limit: number = 50,
  ): Promise<
    Array<{
      txHash: string;
      from: string;
      to: string | null;
      value: string;
      timestamp: number | null;
      blockNumber: number | null;
      status: 'success' | 'failed' | 'pending';
      chain: string;
      tokenSymbol?: string;
      tokenAddress?: string;
    }>
  > {
    this.logger.log(
      `Getting transaction history for user ${userId} on chain ${chain} using Zerion`,
    );

    // Check if wallet exists, create if not
    const hasSeed = await this.seedRepository.hasSeed(userId);

    if (!hasSeed) {
      this.logger.debug(`No wallet found for user ${userId}. Auto-creating...`);
      await this.walletIdentityService.createOrImportSeed(userId, 'random');
      this.logger.debug(`Successfully auto-created wallet for user ${userId}`);
    }

    try {
      // Get address for this chain
      const addresses = await this.getAddresses(userId);
      const address = addresses[chain as keyof WalletAddresses];

      if (!address) {
        this.logger.warn(`No address found for chain ${chain}`);
        return [];
      }

      // Get transactions from Zerion
      const zerionTransactions = await this.zerionService.getTransactions(
        address,
        chain,
        limit,
      );

      if (!zerionTransactions || zerionTransactions.length === 0) {
        this.logger.debug(
          `No transactions from Zerion for ${address} on ${chain}`,
        );
        return [];
      }

      const transactions: Array<{
        txHash: string;
        from: string;
        to: string | null;
        value: string;
        timestamp: number | null;
        blockNumber: number | null;
        status: 'success' | 'failed' | 'pending';
        chain: string;
        tokenSymbol?: string;
        tokenAddress?: string;
      }> = [];

      // Map Zerion transactions to our format
      for (const zerionTx of zerionTransactions) {
        try {
          const attributes = zerionTx.attributes || {};
          const txHash = attributes.hash || zerionTx.id || '';
          const timestamp = attributes.mined_at || attributes.sent_at || null;
          const blockNumber = attributes.block_number || null;

          // Determine status
          let status: 'success' | 'failed' | 'pending' = 'pending';
          if (attributes.status) {
            const statusLower = attributes.status.toLowerCase();
            if (statusLower === 'confirmed' || statusLower === 'success') {
              status = 'success';
            } else if (statusLower === 'failed' || statusLower === 'error') {
              status = 'failed';
            }
          } else if (
            attributes.block_confirmations !== undefined &&
            attributes.block_confirmations > 0
          ) {
            status = 'success';
          }

          // Get transfer information
          const transfers = attributes.transfers || [];
          let tokenSymbol: string | undefined;
          let tokenAddress: string | undefined;
          let value = '0';
          let toAddress: string | null = null;

          if (transfers.length > 0) {
            // Use first transfer for token info
            const transfer = transfers[0];
            if (transfer) {
              tokenSymbol = transfer.fungible_info?.symbol;
              const quantity = transfer.quantity;
              if (quantity) {
                const intPart = quantity.int || '0';
                const decimals = quantity.decimals || 0;
                value = `${intPart}${'0'.repeat(Math.max(0, 18 - decimals))}`;
              }
              toAddress = transfer.to?.address || null;
            }
          } else {
            // Native token transfer - get from fee or use default
            if (attributes.fee?.value) {
              value = attributes.fee.value.toString();
            }
          }

          transactions.push({
            txHash,
            from: address,
            to: toAddress,
            value,
            timestamp,
            blockNumber,
            status,
            chain,
            tokenSymbol,
            tokenAddress,
          });
        } catch (error) {
          this.logger.debug(
            `Error processing transaction from Zerion: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        }
      }

      this.logger.log(
        `Retrieved ${transactions.length} transactions from Zerion for ${chain}`,
      );
      return transactions;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Error getting transaction history from Zerion: ${errorMessage}`,
      );
      return [];
    }
  }

  /**
   * Get Substrate balances for all chains for a user
   *
   * @param userId - User ID
   * @param useTestnet - Whether to use testnet
   * @returns Map of chain -> balance information
   */
  async getSubstrateBalances(
    userId: string,
    useTestnet: boolean = false,
    forceRefresh: boolean = false,
  ): Promise<
    Record<
      SubstrateChainKey,
      {
        balance: string;
        address: string | null;
        token: string;
        decimals: number;
      }
    >
  > {
    return this.walletBalanceService.getSubstrateBalances(
      userId,
      useTestnet,
      forceRefresh,
    );
  }

  /**
   * Get Substrate transaction history for a user
   *
   * @param userId - User ID
   * @param chain - Chain key
   * @param useTestnet - Whether to use testnet
   * @param limit - Number of transactions to fetch
   * @param cursor - Pagination cursor
   * @returns Transaction history
   */
  async getSubstrateTransactions(
    userId: string,
    chain: SubstrateChainKey,
    useTestnet: boolean = false,
    limit: number = 10,
    cursor?: string,
  ) {
    return this.substrateManager.getUserTransactionHistory(
      userId,
      chain,
      useTestnet,
      limit,
      cursor,
    );
  }

  /**
   * Get Substrate addresses for a user
   *
   * @param userId - User ID
   * @param useTestnet - Whether to use testnet
   * @returns Substrate addresses
   */
  async getSubstrateAddresses(userId: string, useTestnet: boolean = false) {
    return this.substrateManager.getAddresses(userId, useTestnet);
  }

  /**
   * Send Substrate transfer
   *
   * @param userId - User ID
   * @param chain - Chain key
   * @param to - Recipient address
   * @param amount - Amount in smallest units
   * @param useTestnet - Whether to use testnet
   * @param transferMethod - Transfer method ('transferAllowDeath' or 'transferKeepAlive')
   * @param accountIndex - Account index (default: 0)
   * @returns Transaction result
   */
  async sendSubstrateTransfer(
    userId: string,
    chain: SubstrateChainKey,
    to: string,
    amount: string,
    useTestnet: boolean = false,
    transferMethod?: 'transferAllowDeath' | 'transferKeepAlive',
    accountIndex: number = 0,
  ) {
    return this.substrateManager.sendTransfer(
      userId,
      {
        from: '', // Will be resolved from userId in SubstrateTransactionService
        to,
        amount,
        chain,
        useTestnet,
        transferMethod,
      },
      accountIndex,
    );
  }
}
