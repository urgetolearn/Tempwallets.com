import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPublicClient, http, Chain, Address, Hex } from 'viem';
import { mainnet, base, arbitrum, polygon, avalanche } from 'viem/chains';
import { Erc4337Chain } from '../types/chain.types.js';

/**
 * Pimlico Service
 * Handles bundler and paymaster operations for ERC-4337 smart accounts
 * Provides gas sponsorship and UserOperation bundling
 */
@Injectable()
export class PimlicoService {
  private readonly logger = new Logger(PimlicoService.name);

  constructor(private configService: ConfigService) {}

  /**
   * Get Pimlico API key from environment
   */
  private getPimlicoApiKey(): string {
    const apiKey = this.configService.get<string>('PIMLICO_API_KEY');
    if (!apiKey) {
      this.logger.warn(
        'PIMLICO_API_KEY not configured - gas sponsorship will not be available',
      );
    }
    return apiKey || '';
  }

  /**
   * Get viem chain configuration
   */
  private getViemChain(chain: Erc4337Chain): Chain {
    const chains: Record<Erc4337Chain, Chain> = {
      ethereum: mainnet,
      base: base,
      arbitrum: arbitrum,
      polygon: polygon,
      avalanche: avalanche,
    };
    return chains[chain];
  }

  /**
   * Get Pimlico bundler URL for a chain
   */
  getBundlerUrl(chain: Erc4337Chain): string {
    const apiKey = this.getPimlicoApiKey();

    const bundlerUrls: Record<Erc4337Chain, string> = {
      ethereum: apiKey
        ? `https://api.pimlico.io/v2/ethereum/rpc?apikey=${apiKey}`
        : 'https://api.pimlico.io/v2/ethereum/rpc',
      base: apiKey
        ? `https://api.pimlico.io/v2/base/rpc?apikey=${apiKey}`
        : 'https://api.pimlico.io/v2/base/rpc',
      arbitrum: apiKey
        ? `https://api.pimlico.io/v2/arbitrum/rpc?apikey=${apiKey}`
        : 'https://api.pimlico.io/v2/arbitrum/rpc',
      polygon: apiKey
        ? `https://api.pimlico.io/v2/polygon/rpc?apikey=${apiKey}`
        : 'https://api.pimlico.io/v2/polygon/rpc',
      avalanche: apiKey
        ? `https://api.pimlico.io/v2/avalanche/rpc?apikey=${apiKey}`
        : 'https://api.pimlico.io/v2/avalanche/rpc',
    };

    return bundlerUrls[chain];
  }

  /**
   * Get Pimlico paymaster URL for a chain
   * Returns undefined if no API key is configured (no gas sponsorship)
   */
  getPaymasterUrl(chain: Erc4337Chain): string | undefined {
    const apiKey = this.getPimlicoApiKey();
    if (!apiKey) {
      return undefined; // No gas sponsorship without API key
    }

    const paymasterUrls: Record<Erc4337Chain, string> = {
      ethereum: `https://api.pimlico.io/v2/ethereum/rpc?apikey=${apiKey}`,
      base: `https://api.pimlico.io/v2/base/rpc?apikey=${apiKey}`,
      arbitrum: `https://api.pimlico.io/v2/arbitrum/rpc?apikey=${apiKey}`,
      polygon: `https://api.pimlico.io/v2/polygon/rpc?apikey=${apiKey}`,
      avalanche: `https://api.pimlico.io/v2/avalanche/rpc?apikey=${apiKey}`,
    };

    return paymasterUrls[chain];
  }

  /**
   * Check if paymaster is available for gas sponsorship
   */
  isPaymasterAvailable(chain: Erc4337Chain): boolean {
    return !!this.getPaymasterUrl(chain);
  }

  /**
   * Get entry point address (ERC-4337 v0.7)
   */
  getEntryPointAddress(): Address {
    return '0x0000000071727De22E5E9d8BAf0edAc6f37da032';
  }

  /**
   * Get Safe factory address (Pimlico)
   */
  getFactoryAddress(): Address {
    return '0x0000000000FFe8B47B3e2130213B802212439497';
  }

  /**
   * Get gas price from Pimlico
   * Used for estimating transaction costs
   */
  async getGasPrice(chain: Erc4337Chain): Promise<bigint> {
    try {
      const viemChain = this.getViemChain(chain);
      const client = createPublicClient({
        chain: viemChain,
        transport: http(this.getBundlerUrl(chain)),
      });

      const gasPrice = await client.getGasPrice();
      this.logger.debug(`Gas price for ${chain}: ${gasPrice}`);
      return gasPrice;
    } catch (error) {
      this.logger.error(
        `Failed to get gas price for ${chain}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Estimate UserOperation gas
   * Returns gas estimates for the UserOperation
   */
  async estimateUserOperationGas(
    chain: Erc4337Chain,
    userOp: {
      sender: Address;
      nonce: bigint;
      initCode: Hex;
      callData: Hex;
    },
  ): Promise<{
    preVerificationGas: bigint;
    verificationGasLimit: bigint;
    callGasLimit: bigint;
  }> {
    try {
      const bundlerUrl = this.getBundlerUrl(chain);

      // Call Pimlico's eth_estimateUserOperationGas RPC method
      const response = await fetch(bundlerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_estimateUserOperationGas',
          params: [
            {
              sender: userOp.sender,
              nonce: `0x${userOp.nonce.toString(16)}`,
              initCode: userOp.initCode,
              callData: userOp.callData,
            },
            this.getEntryPointAddress(),
          ],
        }),
      });

      const data = (await response.json()) as {
        result?: any;
        error?: { message: string };
      };

      if (data.error) {
        throw new Error(`Pimlico gas estimation error: ${data.error.message}`);
      }

      const result = data.result;
      return {
        preVerificationGas: BigInt(result.preVerificationGas),
        verificationGasLimit: BigInt(result.verificationGasLimit),
        callGasLimit: BigInt(result.callGasLimit),
      };
    } catch (error) {
      this.logger.error(
        `Failed to estimate UserOp gas for ${chain}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Get paymaster and data for gas sponsorship
   * Returns paymaster address and data to sponsor the UserOperation
   */
  async getPaymasterData(
    chain: Erc4337Chain,
    userOp: {
      sender: Address;
      nonce: bigint;
      initCode: Hex;
      callData: Hex;
      callGasLimit: bigint;
      verificationGasLimit: bigint;
      preVerificationGas: bigint;
      maxFeePerGas: bigint;
      maxPriorityFeePerGas: bigint;
    },
  ): Promise<{
    paymaster: Address;
    paymasterData: Hex;
    paymasterVerificationGasLimit: bigint;
    paymasterPostOpGasLimit: bigint;
  } | null> {
    const paymasterUrl = this.getPaymasterUrl(chain);
    if (!paymasterUrl) {
      this.logger.debug(
        `No paymaster available for ${chain} - user will pay gas`,
      );
      return null;
    }

    try {
      // Call Pimlico's pm_sponsorUserOperation method
      const response = await fetch(paymasterUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'pm_sponsorUserOperation',
          params: [
            {
              sender: userOp.sender,
              nonce: `0x${userOp.nonce.toString(16)}`,
              initCode: userOp.initCode,
              callData: userOp.callData,
              callGasLimit: `0x${userOp.callGasLimit.toString(16)}`,
              verificationGasLimit: `0x${userOp.verificationGasLimit.toString(16)}`,
              preVerificationGas: `0x${userOp.preVerificationGas.toString(16)}`,
              maxFeePerGas: `0x${userOp.maxFeePerGas.toString(16)}`,
              maxPriorityFeePerGas: `0x${userOp.maxPriorityFeePerGas.toString(16)}`,
            },
            this.getEntryPointAddress(),
          ],
        }),
      });

      const data = (await response.json()) as {
        result?: any;
        error?: { message: string };
      };

      if (data.error) {
        this.logger.warn(
          `Paymaster sponsorship failed for ${chain}: ${data.error.message}`,
        );
        return null;
      }

      const result = data.result;
      this.logger.log(
        `✅ Gas sponsorship approved for ${chain} - Transaction will be gasless!`,
      );

      return {
        paymaster: result.paymaster,
        paymasterData: result.paymasterData,
        paymasterVerificationGasLimit: BigInt(
          result.paymasterVerificationGasLimit || 0,
        ),
        paymasterPostOpGasLimit: BigInt(result.paymasterPostOpGasLimit || 0),
      };
    } catch (error) {
      this.logger.error(
        `Failed to get paymaster data for ${chain}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return null;
    }
  }

  /**
   * Check if a smart account is deployed
   */
  async isAccountDeployed(
    chain: Erc4337Chain,
    accountAddress: Address,
  ): Promise<boolean> {
    try {
      const viemChain = this.getViemChain(chain);
      const client = createPublicClient({
        chain: viemChain,
        transport: http(this.getBundlerUrl(chain)),
      });

      const code = await client.getBytecode({ address: accountAddress });
      const isDeployed = code !== undefined && code !== '0x';

      this.logger.debug(
        `Account ${accountAddress} on ${chain} is ${isDeployed ? 'deployed' : 'not deployed'}`,
      );
      return isDeployed;
    } catch (error) {
      this.logger.error(
        `Failed to check deployment status for ${accountAddress} on ${chain}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return false;
    }
  }

  /**
   * Get UserOperation receipt
   * Check if a UserOperation has been included in a block
   */
  async getUserOperationReceipt(
    chain: Erc4337Chain,
    userOpHash: Hex,
  ): Promise<{
    success: boolean;
    transactionHash: Hex;
    blockNumber: bigint;
  } | null> {
    try {
      const bundlerUrl = this.getBundlerUrl(chain);

      const response = await fetch(bundlerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getUserOperationReceipt',
          params: [userOpHash],
        }),
      });

      const data = (await response.json()) as {
        result?: any;
        error?: { message: string };
      };

      if (data.error || !data.result) {
        return null;
      }

      const receipt = data.result;
      return {
        success: receipt.success,
        transactionHash: receipt.receipt.transactionHash,
        blockNumber: BigInt(receipt.receipt.blockNumber),
      };
    } catch (error) {
      this.logger.error(
        `Failed to get UserOp receipt for ${userOpHash} on ${chain}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return null;
    }
  }

  /**
   * Get configuration summary for logging
   */
  getConfigSummary(chain: Erc4337Chain): {
    bundlerUrl: string;
    paymasterUrl?: string;
    entryPoint: Address;
    factory: Address;
    gasSponsorship: boolean;
  } {
    return {
      bundlerUrl: this.getBundlerUrl(chain),
      paymasterUrl: this.getPaymasterUrl(chain),
      entryPoint: this.getEntryPointAddress(),
      factory: this.getFactoryAddress(),
      gasSponsorship: this.isPaymasterAvailable(chain),
    };
  }
}
