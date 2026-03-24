/**
 * CREATE APP SESSION USE CASE
 *
 * Application Layer - Business Operation
 *
 * Creates a new Yellow Network app session (Lightning Node).
 *
 * Business Flow:
 * 1. Get user's wallet address (creator)
 * 2. Build session definition (participants, weights, quorum)
 * 3. Build initial allocations
 * 4. Create domain entity (validates business rules)
 * 5. Register with Yellow Network
 * 6. Persist canonical session state to database
 * 7. Return canonical session result (single source of truth)
 *
 * Simplified from current implementation:
 * - Canonical session state stored in DB for multi-user consistency
 * - Participant status tracked in DB (invited/joined)
 * - Removed EOA/ERC-4337 complexity (Yellow Network doesn't care)
 * - No URI generation (just use app_session_id directly)
 */

import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import type { IYellowNetworkPort } from '../../ports/yellow-network.port.js';
import { YELLOW_NETWORK_PORT } from '../../ports/yellow-network.port.js';
import type { IWalletProviderPort } from '../../ports/wallet-provider.port.js';
import { WALLET_PROVIDER_PORT } from '../../ports/wallet-provider.port.js';
import { AppSession } from '../../../../domain/app-session/entities/app-session.entity.js';
import { SessionDefinition } from '../../../../domain/app-session/value-objects/session-definition.vo.js';
import { Allocation } from '../../../../domain/app-session/value-objects/allocation.vo.js';
import { PrismaService } from '../../../../database/prisma.service.js';
import { mergeSessionState } from '../../utils/canonical-session.js';
import {
  CreateAppSessionDto,
  CreateAppSessionResultDto,
} from './create-app-session.dto.js';

@Injectable()
export class CreateAppSessionUseCase {
  constructor(
    @Inject(YELLOW_NETWORK_PORT)
    private readonly yellowNetwork: IYellowNetworkPort,
    @Inject(WALLET_PROVIDER_PORT)
    private readonly walletProvider: IWalletProviderPort,
    private readonly prisma: PrismaService,
  ) {}

  async execute(dto: CreateAppSessionDto): Promise<CreateAppSessionResultDto> {
    // 1. Get creator's wallet address
    const creatorAddress = await this.walletProvider.getWalletAddress(
      dto.userId,
      dto.chain,
    );

    // 2. Authenticate with Yellow Network
    await this.yellowNetwork.authenticate(dto.userId, creatorAddress);

    // 3. Build participant list (creator + requested participants)
    const participants = this.buildParticipantList(
      creatorAddress,
      dto.participants,
    );

    // 4. Build weights — Judge model: creator gets 100, others get 0
    // This allows the backend (creator) to sign all operations alone.
    const weights =
      dto.weights || participants.map((_, i) => (i === 0 ? 100 : 0));

    // 5. Build quorum — Judge model: 100 (only creator meets it)
    const quorum = dto.quorum ?? 100;

    // 6. Create session definition (validates business rules)
    const definition = SessionDefinition.create({
      protocol: 'NitroRPC/0.4',
      participants,
      weights,
      quorum,
      challenge: 3600, // 1 hour challenge period
      nonce: Date.now(),
    });

    // 7. Build initial allocations
    const allocations = (dto.initialAllocations || []).map((alloc) =>
      Allocation.create(
        alloc.participant,
        dto.token.toLowerCase(),
        alloc.amount,
      ),
    );

    // 8. Create domain entity (validates all business rules)
    const session = AppSession.create(definition, allocations);

    // 9. Register with Yellow Network
    // Handle the common error where funds are locked in payment channels
    try {
      const yellowResponse = await this.yellowNetwork.createSession({
        sessionId: session.id.value,
        definition: definition.toYellowFormat(),
        allocations: allocations.map((a) => a.toYellowFormat()),
      });

      // 10. Persist canonical session state to DB
      const definitionParticipants = definition.participants;
      const appSessionId = yellowResponse.app_session_id;
      const now = new Date();
      const token = dto.token.toLowerCase();
      const allocationByAddress = new Map<string, string>(
        (yellowResponse.allocations || []).map((alloc) => [
          alloc.participant.toLowerCase(),
          alloc.amount ?? '0',
        ]),
      );

      const participantSnapshots = definitionParticipants.map(
        (address, idx) => {
          const status =
            address.toLowerCase() === creatorAddress.toLowerCase()
              ? 'joined'
              : 'invited';
          return {
            address,
            status,
            balance: allocationByAddress.get(address.toLowerCase()) ?? '0',
            asset: token,
            weight: weights[idx] ?? 0,
          };
        },
      );

      await this.prisma.$transaction(async (tx) => {
        const node = await tx.lightningNode.upsert({
          where: { appSessionId },
          update: {
            chain: dto.chain,
            token,
            status: yellowResponse.status,
            quorum,
            protocol: definition.protocol,
            challenge: definition.challenge,
            sessionData:
              typeof dto.sessionData === 'string'
                ? dto.sessionData
                : JSON.stringify(dto.sessionData ?? {}),
            updatedAt: now,
          },
          create: {
            userId: dto.userId,
            appSessionId,
            uri: `lightning://${appSessionId}`,
            chain: dto.chain,
            token,
            status: yellowResponse.status,
            maxParticipants: definitionParticipants.length,
            quorum,
            protocol: definition.protocol,
            challenge: definition.challenge,
            sessionData:
              typeof dto.sessionData === 'string'
                ? dto.sessionData
                : JSON.stringify(dto.sessionData ?? {}),
          },
        });

        for (const p of participantSnapshots) {
          const isJoined = p.status === 'joined';
          await tx.lightningNodeParticipant.upsert({
            where: {
              lightningNodeId_address_asset: {
                lightningNodeId: node.id,
                address: p.address,
                asset: p.asset,
              },
            },
            update: {
              weight: p.weight,
              balance: p.balance,
              asset: p.asset,
              status: p.status,
              joinedAt: isJoined ? now : undefined,
              lastSeenAt: isJoined ? now : undefined,
            },
            create: {
              lightningNodeId: node.id,
              address: p.address,
              weight: p.weight,
              balance: p.balance,
              asset: p.asset,
              status: p.status,
              joinedAt: isJoined ? now : null,
              lastSeenAt: isJoined ? now : null,
            },
          });
        }
      });

      const canonical = mergeSessionState({
        yellow: yellowResponse,
        dbParticipants: participantSnapshots.map((p) => ({
          address: p.address,
          status: p.status,
          balance: p.balance,
          asset: p.asset,
        })),
        dbToken: token,
      });

      return {
        appSessionId,
        status: yellowResponse.status,
        version: yellowResponse.version,
        totalBalance: canonical.totalBalance,
        participants: canonical.participants.map((p) => ({
          address: p.address,
          joined: p.joined,
          balance: p.balance,
        })),
        allocations: canonical.allocations,
      };
    } catch (error) {
      // Check if this is the "funds locked in channel" error
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (
        errorMsg.includes('non-zero allocation') &&
        errorMsg.includes('channel')
      ) {
        throw new BadRequestException(
          'Cannot create app session: Your funds are currently locked in an active payment channel. ' +
            '\n\n📍 Yellow Network Architecture:' +
            '\n  • Payment Channels pull from: Custody Contract (on-chain)' +
            '\n  • App Sessions pull from: Unified Balance (off-chain)' +
            '\n\n✅ Solution:' +
            '\n  1. Close your active payment channel(s) first' +
            '\n  2. Funds will return to custody "available balance"' +
            '\n  3. This makes them available in your "unified balance"' +
            '\n  4. Then create the app session' +
            '\n\n💡 Fund Flow: Payment Channel → Custody (available) → Unified Balance → App Session' +
            '\n\nOriginal error: ' +
            errorMsg,
        );
      }

      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Build participant list with deduplication
   * Creator is always first
   */
  private buildParticipantList(
    creatorAddress: string,
    requestedParticipants: string[],
  ): string[] {
    const seen = new Set<string>();
    const participants: string[] = [];

    const addUnique = (addr: string) => {
      const normalized = addr.toLowerCase();
      if (seen.has(normalized)) return;
      seen.add(normalized);
      participants.push(addr);
    };

    // Creator first
    addUnique(creatorAddress);

    // Then requested participants
    requestedParticipants.forEach(addUnique);

    // Yellow Network supports 1+ participants (simplified from current 2+ requirement)
    if (participants.length < 1) {
      throw new BadRequestException(
        'App session must have at least one participant',
      );
    }

    return participants;
  }
}
