/**
 * CHANNEL CONTROLLER
 *
 * Presentation Layer - HTTP Adapter
 *
 * Manages 2-party payment channels (user ↔ clearnode).
 * Channels move funds from unified balance into payment channels.
 *
 * Flow: Unified Balance → Payment Channel
 *
 * Prerequisites: User must have funds in unified balance (deposit to custody first)
 *
 * Endpoints:
 * POST /channel/fund - Create or fund a payment channel
 */

import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  ValidationPipe,
} from '@nestjs/common';

import { FundChannelUseCase } from '../../../application/channel/use-cases/fund-channel/fund-channel.use-case.js';
import { CloseChannelUseCase } from '../../../application/channel/use-cases/close-channel/close-channel.use-case.js';
import { FundChannelRequestDto } from './dto/fund-channel-request.dto.js';
import { CloseChannelRequestDto } from './dto/close-channel-request.dto.js';

@Controller('channel')
export class ChannelController {
  constructor(
    private readonly fundChannelUseCase: FundChannelUseCase,
    private readonly closeChannelUseCase: CloseChannelUseCase,
  ) {}

  /**
   * POST /channel/fund
   *
   * Create or fund a 2-party payment channel.
   * Moves funds from unified balance into the channel.
   *
   * Prerequisites:
   * 1. User must have deposited to custody (POST /custody/deposit)
   * 2. User must be authenticated with Yellow Network
   */
  @Post('fund')
  @HttpCode(HttpStatus.OK)
  async fundChannel(@Body(ValidationPipe) request: FundChannelRequestDto) {
    const result = await this.fundChannelUseCase.execute({
      userId: request.userId,
      chain: request.chain,
      asset: request.asset,
      amount: request.amount,
    });

    return {
      ok: true,
      ...result,
    };
  }

  /**
   * POST /channel/close
   *
   * Close a 2-party payment channel.
   * Moves funds from the channel back to unified balance.
   *
   * Prerequisites:
   * 1. Channel must exist and be open
   * 2. All app sessions on the channel should be closed first
   */
  @Post('close')
  @HttpCode(HttpStatus.OK)
  async closeChannel(@Body(ValidationPipe) request: CloseChannelRequestDto) {
    const result = await this.closeChannelUseCase.execute({
      userId: request.userId,
      chain: request.chain,
      channelId: request.channelId,
    });

    return {
      ok: true,
      ...result,
    };
  }
}
