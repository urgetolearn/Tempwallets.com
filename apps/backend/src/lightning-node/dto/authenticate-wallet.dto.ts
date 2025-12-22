import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

/**
 * DTO for Authenticating a User's Wallet with Yellow Network
 */
export class AuthenticateWalletDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsOptional()
  chain?: string; // base, arbitrum (optional, defaults to base)
}
