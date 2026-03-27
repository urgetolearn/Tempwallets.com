/**
 * MOVE UNIFIED TO CUSTODY DTO
 *
 * Moves funds from Yellow unified (off-chain) balance back to on-chain
 * custody available balance via reverse channel resize.
 */

export class MoveUnifiedToCustodyDto {
  userId!: string;
  chain!: string;
  asset!: string;
  amount!: string;
}

export class MoveUnifiedToCustodyResultDto {
  channelId!: string;
  debited!: boolean;
  message!: string;
}
