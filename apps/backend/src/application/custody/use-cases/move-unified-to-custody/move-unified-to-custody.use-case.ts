/**
 * MOVE UNIFIED TO CUSTODY USE CASE
 *
 * Moves funds from Yellow Network unified balance to on-chain custody
 * available balance (reverse resize). Does not send funds to the user's wallet;
 * use withdraw-from-custody after this if needed.
 */

import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import type { IWalletProviderPort } from '../../../app-session/ports/wallet-provider.port.js';
import { WALLET_PROVIDER_PORT } from '../../../app-session/ports/wallet-provider.port.js';
import type { IYellowNetworkPort } from '../../../app-session/ports/yellow-network.port.js';
import { YELLOW_NETWORK_PORT } from '../../../app-session/ports/yellow-network.port.js';
import type { ICustodyContractPort } from '../../ports/custody-contract.port.js';
import { CUSTODY_CONTRACT_PORT } from '../../ports/custody-contract.port.js';
import {
  MoveUnifiedToCustodyDto,
  MoveUnifiedToCustodyResultDto,
} from './move-unified-to-custody.dto.js';

@Injectable()
export class MoveUnifiedToCustodyUseCase {
  constructor(
    @Inject(WALLET_PROVIDER_PORT)
    private readonly walletProvider: IWalletProviderPort,
    @Inject(YELLOW_NETWORK_PORT)
    private readonly yellowNetwork: IYellowNetworkPort,
    @Inject(CUSTODY_CONTRACT_PORT)
    private readonly custodyContract: ICustodyContractPort,
  ) {}

  async execute(
    dto: MoveUnifiedToCustodyDto,
  ): Promise<MoveUnifiedToCustodyResultDto> {
    const userAddress = await this.walletProvider.getWalletAddress(
      dto.userId,
      dto.chain,
    );

    const decimals = 6;
    const amountInSmallestUnits = BigInt(
      Math.floor(parseFloat(dto.amount) * Math.pow(10, decimals)),
    );

    if (amountInSmallestUnits <= 0n) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    const chainIdMap: Record<string, number> = {
      ethereum: 1,
      base: 8453,
      arbitrum: 42161,
      avalanche: 43114,
    };
    const chainId = chainIdMap[dto.chain.toLowerCase()];
    if (!chainId) {
      throw new BadRequestException(`Unsupported chain: ${dto.chain}`);
    }

    const tokenAddressMap: Record<string, Record<string, string>> = {
      base: {
        usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        usdt: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
      },
      arbitrum: {
        usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        usdt: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      },
      ethereum: {
        usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        usdt: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      },
      avalanche: {
        usdc: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
        usdt: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
      },
    };

    const tokenAddress =
      tokenAddressMap[dto.chain.toLowerCase()]?.[dto.asset.toLowerCase()];
    if (!tokenAddress) {
      throw new BadRequestException(
        `Token ${dto.asset} not supported on chain ${dto.chain}`,
      );
    }

    await this.yellowNetwork.authenticate(dto.userId, userAddress);

    const unifiedHuman = await this.custodyContract.getUnifiedBalance(
      userAddress,
      dto.asset,
    );
    const unifiedUnits = BigInt(
      Math.floor(parseFloat(unifiedHuman || '0') * Math.pow(10, decimals)),
    );

    if (unifiedUnits < amountInSmallestUnits) {
      throw new BadRequestException(
        `Insufficient unified balance: have ${unifiedHuman}, requested ${dto.amount}`,
      );
    }

    const { channelId } = await this.custodyContract.debitUnifiedBalanceToCustody(
      {
        userId: dto.userId,
        chain: dto.chain,
        userAddress,
        tokenAddress,
        amount: amountInSmallestUnits,
      },
    );

    return {
      channelId,
      debited: true,
      message: `Moved ${dto.amount} ${dto.asset.toUpperCase()} from unified balance to custody (on-chain available).`,
    };
  }
}
