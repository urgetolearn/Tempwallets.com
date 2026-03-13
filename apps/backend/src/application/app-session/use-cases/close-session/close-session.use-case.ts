/**
 * CLOSE SESSION USE CASE
 *
 * Application Layer - Business Operation
 *
 * Close an app session and return funds to unified balance.
 *
 * Business Flow:
 * 1. Authenticate user's wallet
 * 2. Query current session state
 * 3. Verify user is a participant
 * 4. Close session on Yellow Network
 * 5. Return result
 *
 * Simplified from current implementation:
 * - No database update (Yellow Network is source of truth)
 * - No complex participant status checks
 * - Clean, simple close operation
 */

import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import type { IYellowNetworkPort } from '../../ports/yellow-network.port.js';
import { YELLOW_NETWORK_PORT } from '../../ports/yellow-network.port.js';
import type { IWalletProviderPort } from '../../ports/wallet-provider.port.js';
import { WALLET_PROVIDER_PORT } from '../../ports/wallet-provider.port.js';
import { CloseSessionDto, CloseSessionResultDto } from './close-session.dto.js';

// Safe decimal math (Yellow uses string amounts, avoid floats)
const DECIMAL_PRECISION = 18;

function toFixedPoint(value: string): bigint {
  const trimmed = value.trim();
  const negative = trimmed.startsWith('-');
  const abs = negative ? trimmed.slice(1) : trimmed;
  const [intPart = '0', decPart = ''] = abs.split('.');
  const padded = decPart.padEnd(DECIMAL_PRECISION, '0').slice(0, DECIMAL_PRECISION);
  const result = BigInt(intPart + padded);
  return negative ? -result : result;
}

function fromFixedPoint(value: bigint): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const str = abs.toString().padStart(DECIMAL_PRECISION + 1, '0');
  const intPart = str.slice(0, str.length - DECIMAL_PRECISION) || '0';
  const decPart = str.slice(str.length - DECIMAL_PRECISION);
  const trimmed = decPart.replace(/0+$/, '');
  const finalDec = trimmed.length < 2 ? decPart.slice(0, 2) : trimmed;
  return `${negative ? '-' : ''}${intPart}.${finalDec}`;
}

function addDecimal(a: string, b: string): string {
  return fromFixedPoint(toFixedPoint(a) + toFixedPoint(b));
}

@Injectable()
export class CloseSessionUseCase {
  constructor(
    @Inject(YELLOW_NETWORK_PORT)
    private readonly yellowNetwork: IYellowNetworkPort,
    @Inject(WALLET_PROVIDER_PORT)
    private readonly walletProvider: IWalletProviderPort,
  ) {}

  async execute(dto: CloseSessionDto): Promise<CloseSessionResultDto> {
    // 1. Get user's wallet address
    const walletAddress = await this.walletProvider.getWalletAddress(
      dto.userId,
      dto.chain,
    );

    // 2. Authenticate with Yellow Network
    await this.yellowNetwork.authenticate(dto.userId, walletAddress);

    // 3. Query current session
    const session = await this.yellowNetwork.querySession(dto.appSessionId);

    // 4. Verify user is a participant
    const isParticipant = session.definition.participants.some(
      (p) => p.toLowerCase() === walletAddress.toLowerCase(),
    );

    if (!isParticipant) {
      throw new BadRequestException(
        'You are not a participant in this session',
      );
    }

    // 5. Verify session is open
    if (session.status !== 'open') {
      throw new BadRequestException(
        `Cannot close session in ${session.status} state`,
      );
    }

    // 6. Build COMPLETE allocations — every participant must be listed.
    //    Yellow Network rejects close if any participant is missing
    //    ("asset X not fully redistributed").
    const allParticipants = session.definition.participants ?? [];
    const sessionBalances = await this.yellowNetwork.getAppSessionBalances(
      dto.appSessionId,
    );

    const assets = [
      ...new Set(
        (sessionBalances ?? [])
          .map((b: any) => b.asset?.toLowerCase?.() ?? b.asset)
          .filter(Boolean),
      ),
    ];
    // Default to 'usdc' if session has no balances at all
    if (assets.length === 0) assets.push('usdc');

    // Calculate totals per asset from ledger balances, then redistribute all funds to caller
    const totalsByAsset = new Map<string, string>();
    for (const bal of sessionBalances ?? []) {
      const asset = (bal.asset?.toLowerCase?.() ?? bal.asset ?? 'usdc') as string;
      const current = totalsByAsset.get(asset) ?? '0';
      totalsByAsset.set(asset, addDecimal(current, bal.amount ?? '0'));
    }

    const redistributeAllocations: Array<{
      participant: string;
      asset: string;
      amount: string;
    }> = [];
    for (const asset of assets) {
      const total = totalsByAsset.get(asset) ?? '0';
      for (const p of allParticipants) {
        redistributeAllocations.push({
          participant: p,
          asset,
          amount: p.toLowerCase() === walletAddress.toLowerCase() ? total : '0',
        });
      }
    }

    // 7. Force redistribute (OPERATE) so close will succeed
    await this.yellowNetwork.updateSession({
      sessionId: dto.appSessionId,
      intent: 'OPERATE',
      allocations: redistributeAllocations,
    });

    // 8. Close session with Yellow Network
    await this.yellowNetwork.closeSession(
      dto.appSessionId,
      redistributeAllocations,
    );

    // 9. Return result
    return {
      appSessionId: dto.appSessionId,
      closed: true,
    };
  }
}
