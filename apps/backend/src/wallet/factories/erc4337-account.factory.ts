import { Injectable, Logger } from '@nestjs/common';
import {
  createPublicClient,
  defineChain,
  encodeFunctionData,
  http,
  type Address,
  type Chain,
} from 'viem';
import { mnemonicToAccount } from 'viem/accounts';
import { mainnet, base, arbitrum, polygon, avalanche, optimism, bsc } from 'viem/chains';
import { createSmartAccountClient } from 'permissionless';
import { toSimpleSmartAccount } from 'permissionless/accounts';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { PimlicoConfigService } from '../config/pimlico.config.js';
import { ChainConfigService } from '../config/chain.config.js';
import { IAccount } from '../types/account.types.js';
import { Erc4337DeploymentRepository } from '../repositories/erc4337-deployment.repository.js';

@Injectable()
export class Erc4337AccountFactory {
  private readonly logger = new Logger(Erc4337AccountFactory.name);

  constructor(
    private readonly pimlicoConfig: PimlicoConfigService,
    private readonly chainConfig: ChainConfigService,
    private readonly deploymentRepo: Erc4337DeploymentRepository,
  ) {}

  async createAccount(
    seedPhrase: string,
    chain:
      | 'ethereum'
      | 'base'
      | 'arbitrum'
      | 'optimism'
      | 'polygon'
      | 'avalanche'
      | 'bnb',
    accountIndex = 0,
    userId?: string,
  ): Promise<IAccount> {
    if (!this.pimlicoConfig.isErc4337Enabled(chain)) {
      throw new Error(
        `ERC-4337 is not enabled for chain ${chain}. Enable via config (ENABLE_ERC4337=true, ERC4337_CHAINS=${chain})`,
      );
    }

    const viemChain = this.getViemChain(chain);
    const rpcUrl = this.chainConfig.getEvmChainConfig(chain as any).rpcUrl;
    const publicClient = createPublicClient({
      chain: viemChain,
      transport: http(rpcUrl),
    });

    const eoaAccount = mnemonicToAccount(seedPhrase, {
      accountIndex,
      addressIndex: 0,
    });

    // Reuse existing config entries where available; for other chains, construct Pimlico URLs from chainId.
    const chainId = viemChain.id;
    const apiKey = this.pimlicoConfig.getPimlicoApiKey();
    const bundlerBase = `https://api.pimlico.io/v2/${chainId}/rpc`;
    const bundlerUrl = apiKey ? `${bundlerBase}?apikey=${apiKey}` : bundlerBase;
    const paymasterUrl = apiKey ? `${bundlerBase}?apikey=${apiKey}` : undefined;

    const entryPoint = {
      address: (this.pimlicoConfig
        .getErc4337Config(
          (['ethereum', 'base', 'arbitrum', 'polygon', 'avalanche'] as const).includes(
            chain as any,
          )
            ? (chain as any)
            : 'ethereum',
        )
        .entryPointAddress ?? '') as Address,
      version: '0.7' as const,
    };

    const pimlicoClient = createPimlicoClient({
      transport: http(paymasterUrl || bundlerUrl),
      entryPoint,
    });

    const smartAccount = await toSimpleSmartAccount({
      client: publicClient,
      owner: eoaAccount,
      // Salt nonce for deterministic per-user account instances if needed later.
      index: 0n,
    });

    const smartAccountAddress = (await smartAccount.getAddress()) as Address;

    if (userId) {
      await this.deploymentRepo.upsertCounterfactual({
        walletId: userId,
        chainId,
        address: smartAccountAddress,
        entryPointAddress: entryPoint.address,
        factoryAddress: null,
      });
    }

    const smartAccountClient = createSmartAccountClient({
      account: smartAccount,
      chain: viemChain,
      bundlerTransport: http(bundlerUrl),
      client: publicClient,
      paymaster: pimlicoClient,
      userOperation: {
        estimateFeesPerGas: async () =>
          (await pimlicoClient.getUserOperationGasPrice()).fast,
      },
    });

    return new Erc4337SmartAccountWrapper(
      smartAccountAddress,
      smartAccountClient,
      publicClient,
      this.deploymentRepo,
      userId,
      chainId,
      this.logger,
    );
  }

  private getViemChain(chain: string): Chain {
    const baseChains: Record<string, Chain> = {
      ethereum: mainnet,
      base,
      arbitrum,
      optimism,
      polygon,
      avalanche,
      bnb: bsc,
    };
    const baseChain = baseChains[chain];
    if (!baseChain) {
      throw new Error(`Unsupported ERC-4337 chain: ${chain}`);
    }
    return defineChain({ ...baseChain }) as Chain;
  }
}

class Erc4337SmartAccountWrapper implements IAccount {
  constructor(
    private readonly smartAccountAddress: Address,
    private readonly client: any,
    private readonly publicClient: ReturnType<typeof createPublicClient>,
    private readonly deploymentRepo: Erc4337DeploymentRepository,
    private readonly userId: string | undefined,
    private readonly chainId: number,
    private readonly logger: Logger,
  ) {}

  async getAddress(): Promise<string> {
    return this.smartAccountAddress;
  }

  /**
   * Best-effort: resolve UserOp hash -> tx hash (once included).
   * Returns null if not yet included.
   */
  async getUserOperationTransactionHash(userOpHash: string): Promise<string | null> {
    try {
      const receipt = await this.client.getUserOperationReceipt({
        hash: userOpHash,
      });
      const txHash =
        receipt?.receipt?.transactionHash ||
        receipt?.transactionHash ||
        null;
      return typeof txHash === 'string' && txHash.length > 0 ? txHash : null;
    } catch (e) {
      // Bundlers commonly throw while pending; treat as "not ready".
      this.logger.debug(
        `[ERC-4337] getUserOperationReceipt pending: ${e instanceof Error ? e.message : 'unknown'}`,
      );
      return null;
    }
  }

  async getBalance(): Promise<string> {
    const balance = await this.publicClient.getBalance({
      address: this.smartAccountAddress,
    });
    return balance.toString();
  }

  async send(to: string, amount: string): Promise<string> {
    const value = BigInt(amount);

    const userOpHash: string = await this.client.sendTransaction({
      to: to as Address,
      value,
      data: '0x' as `0x${string}`,
    });

    await this.maybeMarkDeployed();
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

    const userOpHash: string = await this.client.sendTransaction({
      to: token as Address,
      value: 0n,
      data,
    });

    await this.maybeMarkDeployed();
    return userOpHash;
  }

  private async maybeMarkDeployed(): Promise<void> {
    if (!this.userId) return;
    try {
      const code = await this.publicClient.getBytecode({
        address: this.smartAccountAddress,
      });
      const isDeployed = !!code && code !== '0x';
      if (isDeployed) {
        await this.deploymentRepo.markDeployed(this.userId, this.chainId);
      }
    } catch (e) {
      this.logger.warn(
        `[ERC-4337] Failed to check/mark deployment: ${e instanceof Error ? e.message : 'unknown'}`,
      );
    }
  }
}

