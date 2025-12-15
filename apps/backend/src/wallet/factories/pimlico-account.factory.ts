import { Injectable, Logger } from '@nestjs/common';
import {
  createPublicClient,
  http,
  type Address,
  type Chain,
  encodeFunctionData,
  parseAbi,
} from 'viem';
import { mnemonicToAccount } from 'viem/accounts';
import { mainnet, base, arbitrum, polygon, avalanche } from 'viem/chains';
import { createSmartAccountClient } from 'permissionless';
import { toSafeSmartAccount } from 'permissionless/accounts';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { entryPoint07Address } from 'viem/account-abstraction';
import { PimlicoConfigService } from '../config/pimlico.config.js';
import { IAccountFactory } from '../interfaces/wallet.interfaces.js';
import { IAccount } from '../types/account.types.js';

/**
 * Pimlico Account Factory
 * Creates ERC-4337 smart accounts using Pimlico infrastructure
 * Completely independent of Tether WDK - uses viem + permissionless + Pimlico
 */
@Injectable()
export class PimlicoAccountFactory implements IAccountFactory {
  private readonly logger = new Logger(PimlicoAccountFactory.name);

  constructor(private pimlicoConfig: PimlicoConfigService) {}

  getAccountType(): string {
    return 'ERC4337-Pimlico';
  }

  /**
   * Create an ERC-4337 smart account from seed phrase
   * @param seedPhrase - BIP-39 mnemonic (same as used by Tether WDK)
   * @param chain - EVM chain (ethereum, base, arbitrum, polygon, avalanche)
   * @param accountIndex - HD wallet account index (default: 0)
   * @returns Smart account wrapper
   */
  async createAccount(
    seedPhrase: string,
    chain: 'ethereum' | 'base' | 'arbitrum' | 'polygon' | 'avalanche' | string,
    accountIndex: number = 0,
  ): Promise<IAccount> {
    // Validate chain
    if (
      !['ethereum', 'base', 'arbitrum', 'polygon', 'avalanche'].includes(chain)
    ) {
      throw new Error(`Unsupported chain for ERC-4337: ${chain}`);
    }

    const chainName = chain as
      | 'ethereum'
      | 'base'
      | 'arbitrum'
      | 'polygon'
      | 'avalanche';
    const config = this.pimlicoConfig.getErc4337Config(chainName);
    const viemChain = this.getViemChain(chainName);

    this.logger.debug(`Creating ERC-4337 account on ${chain} with Pimlico`);

    // Derive EOA from mnemonic (HD path: m/44'/60'/0'/0/{accountIndex})
    const eoaAccount = mnemonicToAccount(seedPhrase, {
      accountIndex,
      addressIndex: 0,
    });

    this.logger.debug(`Derived EOA: ${eoaAccount.address}`);

    // Create public client for chain interactions
    const publicClient = createPublicClient({
      chain: viemChain,
      transport: http(config.rpcUrl),
    });

    // Create Pimlico bundler client
    const pimlicoClient = createPimlicoClient({
      transport: http(config.bundlerUrl),
      entryPoint: {
        address: entryPoint07Address,
        version: '0.7',
      },
    });

    // Create Safe smart account from EOA signer
    const smartAccount = await toSafeSmartAccount({
      client: publicClient,
      owners: [eoaAccount],
      version: '1.4.1',
      entryPoint: {
        address: entryPoint07Address,
        version: '0.7',
      },
    });

    this.logger.debug(`Smart account address: ${smartAccount.address}`);

    // Create smart account client
    const smartAccountClient = createSmartAccountClient({
      account: smartAccount,
      chain: viemChain,
      bundlerTransport: http(config.bundlerUrl),
      paymaster: config.paymasterUrl ? pimlicoClient : undefined,
      userOperation: {
        estimateFeesPerGas: async () => {
          const gasPrice = await pimlicoClient.getUserOperationGasPrice();
          return {
            maxFeePerGas: gasPrice.fast.maxFeePerGas,
            maxPriorityFeePerGas: gasPrice.fast.maxPriorityFeePerGas,
          };
        },
      },
    });

    // Wrap in IAccount interface
    return new PimlicoSmartAccountWrapper(
      smartAccountClient,
      smartAccount.address,
      publicClient,
      this.logger,
    );
  }

  /**
   * Get viem chain object
   */
  private getViemChain(
    chain: 'ethereum' | 'base' | 'arbitrum' | 'polygon' | 'avalanche',
  ): Chain {
    const chains: Record<string, Chain> = {
      ethereum: mainnet,
      base: base,
      arbitrum: arbitrum,
      polygon: polygon,
      avalanche: avalanche,
    };
    const viemChain = chains[chain];
    if (!viemChain) {
      throw new Error(`Unsupported chain: ${chain}`);
    }
    return viemChain;
  }
}

/**
 * Wrapper class to implement IAccount interface for Pimlico smart accounts
 */
class PimlicoSmartAccountWrapper implements IAccount {
  public readonly provider: any;

  constructor(
    private client: any, // SmartAccountClient type from permissionless
    private address: Address,
    private publicClient: any,
    private logger: Logger,
  ) {
    this.provider = this.publicClient;
  }

  async getProvider(): Promise<any> {
    return this.provider;
  }

  async getAddress(): Promise<string> {
    return this.address;
  }

  async getBalance(): Promise<string> {
    try {
      const balance = await this.publicClient.getBalance({
        address: this.address,
      });
      return balance.toString();
    } catch (error) {
      this.logger.error(
        `Failed to get balance: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  async send(to: string, amount: string): Promise<string> {
    try {
      this.logger.log(`Sending ${amount} wei to ${to}`);

      const txHash = await this.client.sendTransaction({
        to: to as Address,
        value: BigInt(amount),
        data: '0x',
      });

      this.logger.log(`Transaction sent: ${txHash}`);
      return txHash;
    } catch (error) {
      this.logger.error(
        `Failed to send transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Send ERC-20 token transfer
   */
  async transfer(params: {
    to: string;
    amount: bigint;
    token?: string;
  }): Promise<string> {
    try {
      if (!params.token) {
        // Native token transfer
        return this.send(params.to, params.amount.toString());
      }

      // ERC-20 token transfer
      // ERC-20 transfer function: transfer(address,uint256)
      const transferData = this.encodeErc20Transfer(
        params.to as Address,
        params.amount,
      );

      const txHash = await this.client.sendTransaction({
        to: params.token as Address,
        data: transferData,
        value: 0n,
      });

      this.logger.log(`Token transfer sent: ${txHash}`);
      return txHash;
    } catch (error) {
      this.logger.error(
        `Failed to transfer token: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Encode ERC-20 transfer function call
   */
  private encodeErc20Transfer(to: Address, amount: bigint): `0x${string}` {
    // Function selector for transfer(address,uint256): 0xa9059cbb
    return encodeFunctionData({
      abi: parseAbi(['function transfer(address to, uint256 amount)']),
      functionName: 'transfer',
      args: [to, amount],
    });
  }

  /**
   * Get token balance (ERC-20)
   */
  async getTokenBalance(tokenAddress: string): Promise<string> {
    try {
      // ERC-20 balanceOf function: balanceOf(address)
      const data = `0x70a08231${this.address.slice(2).padStart(64, '0')}`;

      const result = await this.publicClient.call({
        to: tokenAddress as Address,
        data: data as `0x${string}`,
      });

      if (!result || !result.data) {
        return '0';
      }

      return BigInt(result.data).toString();
    } catch (error) {
      this.logger.error(
        `Failed to get token balance: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return '0';
    }
  }

  /**
   * Check if smart account is deployed on-chain
   */
  async isDeployed(): Promise<boolean> {
    try {
      const code = await this.publicClient.getCode({
        address: this.address,
      });
      return code !== undefined && code !== '0x' && code !== '0x0';
    } catch (error) {
      this.logger.error(
        `Failed to check deployment: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return false;
    }
  }
}
