import { Injectable, Logger } from '@nestjs/common';
import {
  createPublicClient,
  http,
  type Address,
  type Chain,
  defineChain,
  encodeFunctionData,
} from 'viem';
import { mnemonicToAccount } from 'viem/accounts';
import { createSmartAccountClient } from 'permissionless';
import { toSimpleSmartAccount } from 'permissionless/accounts';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { PimlicoConfigService } from '../config/pimlico.config.js';
import { ChainConfigService } from '../config/chain.config.js';
import { Erc4337AccountRepository } from '../repositories/erc4337-account.repository.js';
import { IAccount } from '../types/account.types.js';

@Injectable()
export class Erc4337AccountFactory {
  private readonly logger = new Logger(Erc4337AccountFactory.name);

  constructor(
    private readonly pimlicoConfig: PimlicoConfigService,
    private readonly chainConfig: ChainConfigService,
    private readonly erc4337Repo: Erc4337AccountRepository,
  ) {}

  async createAccount(
    seedPhrase: string,
    chain:
      | 'ethereum'
      | 'base'
      | 'arbitrum'
      | 'polygon'
      | 'avalanche'
      | 'optimism'
      | 'bnb',
    accountIndex = 0,
    userId?: string,
  ): Promise<IAccount> {
    const {
      publicClient,
      smartAccount,
      smartAccountAddress,
      entryPoint,
      bundlerClient,
      paymasterClient,
      viemChain,
      ercConfig,
    } = await this.buildSmartAccount(seedPhrase, chain, accountIndex);

    const deployed = await this.isDeployed(publicClient, smartAccountAddress);
    if (userId) {
      await this.erc4337Repo.upsertAccount(
        userId,
        ercConfig.chainId,
        smartAccountAddress,
        entryPoint.address,
        ercConfig.factoryAddress,
        deployed,
      );
    }

    const smartAccountClient = createSmartAccountClient({
      account: smartAccount,
      chain: viemChain,
      bundlerTransport: http(ercConfig.bundlerUrl),
      client: publicClient,
      paymaster: paymasterClient ? paymasterClient : undefined,
      userOperation: {
        estimateFeesPerGas: async () => {
          return (await bundlerClient.getUserOperationGasPrice()).fast;
        },
      },
    });

    return new Erc4337SmartAccountWrapper(
      smartAccountAddress,
      smartAccountClient,
      publicClient,
      this.erc4337Repo,
      userId,
      ercConfig.chainId,
      this.pimlicoConfig.getGaslessMaxGasLimit(),
      this.pimlicoConfig.getGaslessMaxCallDataBytes(),
      this.logger,
    );
  }

  async getSmartAccountAddress(
    seedPhrase: string,
    chain:
      | 'ethereum'
      | 'base'
      | 'arbitrum'
      | 'polygon'
      | 'avalanche'
      | 'optimism'
      | 'bnb',
    accountIndex = 0,
  ): Promise<Address> {
    const { smartAccountAddress } = await this.buildSmartAccount(
      seedPhrase,
      chain,
      accountIndex,
    );
    return smartAccountAddress;
  }

  private async buildSmartAccount(
    seedPhrase: string,
    chain:
      | 'ethereum'
      | 'base'
      | 'arbitrum'
      | 'polygon'
      | 'avalanche'
      | 'optimism'
      | 'bnb',
    accountIndex: number,
  ): Promise<{
    publicClient: ReturnType<typeof createPublicClient>;
    smartAccount: Awaited<ReturnType<typeof toSimpleSmartAccount>>;
    smartAccountAddress: Address;
    entryPoint: { address: Address; version: '0.6' | '0.7' | '0.8' };
    bundlerClient: ReturnType<typeof createPimlicoClient>;
    paymasterClient?: ReturnType<typeof createPimlicoClient>;
    viemChain: Chain;
    ercConfig: ReturnType<PimlicoConfigService['getErc4337Config']>;
  }> {
    const viemChain = this.getViemChain(chain);
    const { rpcUrl } = this.chainConfig.getEvmChainConfig(chain);

    const publicClient = createPublicClient({
      chain: viemChain,
      transport: http(rpcUrl),
    });

    const owner = mnemonicToAccount(seedPhrase, {
      accountIndex,
      addressIndex: 0,
    });

    const ercConfig = this.pimlicoConfig.getErc4337Config(chain);
    const entryPoint = {
      address: ercConfig.entryPointAddress as Address,
      version: ercConfig.entryPointVersion,
    };

    if (!ercConfig.paymasterUrl) {
      this.logger.warn(
        `[ERC-4337] Paymaster URL not configured for ${chain}. ` +
          `Transactions will not be sponsored. Consider setting PIMLICO_API_KEY.`,
      );
    }

    const smartAccount = await toSimpleSmartAccount({
      client: publicClient,
      owner,
      entryPoint,
      factoryAddress: ercConfig.factoryAddress as Address,
      index: BigInt(accountIndex),
    });

    const smartAccountAddress = (await smartAccount.getAddress()) as Address;
    const bundlerClient = createPimlicoClient({
      transport: http(ercConfig.bundlerUrl),
      entryPoint,
    });

    const paymasterClient = ercConfig.paymasterUrl
      ? createPimlicoClient({
          transport: http(ercConfig.paymasterUrl),
          entryPoint,
        })
      : undefined;

    return {
      publicClient,
      smartAccount,
      smartAccountAddress,
      entryPoint,
      bundlerClient,
      paymasterClient,
      viemChain,
      ercConfig,
    };
  }

  private getViemChain(
    chain:
      | 'ethereum'
      | 'base'
      | 'arbitrum'
      | 'polygon'
      | 'avalanche'
      | 'optimism'
      | 'bnb',
  ): Chain {
    const config = this.chainConfig.getEvmChainConfig(chain);
    return defineChain({
      id: config.chainId,
      name: config.name,
      nativeCurrency: config.nativeCurrency,
      rpcUrls: {
        default: {
          http: [config.rpcUrl],
        },
      },
      blockExplorers: config.blockExplorer
        ? {
            default: {
              name: `${config.name} Explorer`,
              url: config.blockExplorer,
            },
          }
        : undefined,
    });
  }

  private async isDeployed(
    publicClient: ReturnType<typeof createPublicClient>,
    address: string,
  ): Promise<boolean> {
    const code = await publicClient.getBytecode({
      address: address as Address,
    });
    return !!code && code !== '0x';
  }
}

class Erc4337SmartAccountWrapper implements IAccount {
  constructor(
    private readonly smartAccountAddress: Address,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly client: any,
    private readonly publicClient: ReturnType<typeof createPublicClient>,
    private readonly erc4337Repo: Erc4337AccountRepository,
    private readonly userId: string | undefined,
    private readonly chainId: number,
    private readonly maxGasLimit: bigint | null,
    private readonly maxCallDataBytes: number | null,
    private readonly logger: Logger,
  ) {}

  async getAddress(): Promise<string> {
    return this.smartAccountAddress;
  }

  async getBalance(): Promise<string> {
    const balance = await this.publicClient.getBalance({
      address: this.smartAccountAddress,
    });
    return balance.toString();
  }

  async send(to: string, amount: string): Promise<string> {
    const value = BigInt(amount);
    const data = '0x' as `0x${string}`;

    await this.enforceLimits(to as Address, value, data);

    const userOpHash = await this.client.sendTransaction({
      to: to as Address,
      value,
      data,
    });

    await this.recordUserOperation(userOpHash);

    return userOpHash;
  }

  async transfer(params: {
    token: string;
    recipient: string;
    amount: bigint;
  }): Promise<string> {
    const { token, recipient, amount } = params;
    const data = encodeFunctionData({
      abi: [
        {
          name: 'transfer',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'to', type: 'address' },
            { name: 'amount', type: 'uint256' },
          ],
          outputs: [{ type: 'bool' }],
        },
      ],
      functionName: 'transfer',
      args: [recipient as Address, amount],
    });

    await this.enforceLimits(token as Address, 0n, data);

    const userOpHash = await this.client.sendTransaction({
      to: token as Address,
      value: 0n,
      data,
    });

    await this.recordUserOperation(userOpHash);

    return userOpHash;
  }

  private async enforceLimits(
    to: Address,
    value: bigint,
    data: `0x${string}`,
  ): Promise<void> {
    if (this.maxCallDataBytes) {
      const dataBytes = (data.length - 2) / 2;
      if (dataBytes > this.maxCallDataBytes) {
        throw new Error(
          `Call data too large (${dataBytes} bytes). Max allowed: ${this.maxCallDataBytes} bytes.`,
        );
      }
    }

    if (this.maxGasLimit) {
      try {
        const estimate = await this.publicClient.estimateGas({
          account: this.smartAccountAddress,
          to,
          value,
          data,
        });
        if (estimate > this.maxGasLimit) {
          throw new Error(
            `Gas estimate ${estimate} exceeds limit ${this.maxGasLimit}.`,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Gas estimate failed for ERC-4337 send: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }
  }

  private async recordUserOperation(userOpHash: string): Promise<void> {
    if (!this.userId) {
      return;
    }

    try {
      await this.erc4337Repo.recordUserOp(
        this.userId,
        this.chainId,
        userOpHash,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to record ERC-4337 user operation: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    try {
      const deployed = await this.publicClient.getBytecode({
        address: this.smartAccountAddress,
      });
      const isDeployed = !!deployed && deployed !== '0x';

      await this.erc4337Repo.updateDeploymentStatus(
        this.userId,
        this.chainId,
        isDeployed,
        userOpHash,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to sync ERC-4337 deployment status: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
