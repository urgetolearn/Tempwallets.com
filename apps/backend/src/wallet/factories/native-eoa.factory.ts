import { Injectable, Logger } from '@nestjs/common';
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Chain,
} from 'viem';
import { mnemonicToAccount } from 'viem/accounts';
import {
  mainnet,
  base,
  arbitrum,
  polygon,
  avalanche,
  sepolia,
  optimism,
  bsc,
} from 'viem/chains';
import { ChainConfigService } from '../config/chain.config.js';
import { IAccount } from '../types/account.types.js';

/**
 * Native EOA factory for EVM chains (no WDK dependency).
 * Derives EOAs via viem and exposes IAccount wrapper for reads/writes.
 */
@Injectable()
export class NativeEoaFactory {
  private readonly logger = new Logger(NativeEoaFactory.name);

  constructor(private readonly chainConfig: ChainConfigService) {}

  async createAccount(
    seedPhrase: string,
    chain:
      | 'ethereum'
      | 'base'
      | 'arbitrum'
      | 'polygon'
      | 'avalanche'
      | 'sepolia'
      | 'optimism'
      | 'bnb',
    accountIndex = 0,
  ): Promise<IAccount> {
    const viemChain = this.getViemChain(chain);
    const rpcChainKey = chain === 'sepolia' ? 'ethereum' : chain;
    const { rpcUrl } = this.chainConfig.getEvmChainConfig(
      rpcChainKey as Parameters<ChainConfigService['getEvmChainConfig']>[0],
    );

    const eoaAccount = mnemonicToAccount(seedPhrase, {
      accountIndex,
      addressIndex: 0,
    });

    const transport = http(rpcUrl);
    const publicClient = createPublicClient({ chain: viemChain, transport });
    const walletClient = createWalletClient({
      account: eoaAccount,
      chain: viemChain,
      transport,
    });

    this.logger.debug(
      `Derived native EOA for ${chain}: ${eoaAccount.address} (accountIndex=${accountIndex})`,
    );

    return new NativeEoaAccountWrapper(
      eoaAccount.address,
      publicClient,
      walletClient,
      this.logger,
    );
  }

  private getViemChain(
    chain:
      | 'ethereum'
      | 'base'
      | 'arbitrum'
      | 'polygon'
      | 'avalanche'
      | 'sepolia'
    | 'optimism'
    | 'bnb',
  ): Chain {
    const mapping: Record<string, Chain> = {
      ethereum: mainnet,
      base,
      arbitrum,
      polygon,
      avalanche,
      sepolia,
      optimism,
      bnb: bsc,
    };

    const viemChain = mapping[chain];
    if (!viemChain) {
      throw new Error(`Unsupported EVM chain for native EOA: ${chain}`);
    }
    return viemChain;
  }
}

class NativeEoaAccountWrapper implements IAccount {
  constructor(
    private readonly address: Address,
    private readonly publicClient: ReturnType<typeof createPublicClient>,
    private readonly walletClient: ReturnType<typeof createWalletClient>,
    private readonly logger: Logger,
  ) {}

  async getAddress(): Promise<string> {
    return this.address;
  }

  async getBalance(): Promise<string> {
    const balance = await this.publicClient.getBalance({ address: this.address });
    return balance.toString();
  }

  async send(to: string, amount: string): Promise<string> {
    const value = BigInt(amount);
    this.logger.log(`Sending ${value} wei to ${to} from ${this.address}`);

    const hash = await this.walletClient.sendTransaction({
      chain: this.walletClient.chain,
      account: this.walletClient.account!,
      to: to as Address,
      value,
    });

    this.logger.log(`Transaction sent: ${hash}`);
    return hash;
  }
}
