import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { Erc4337Account } from '@prisma/client';

@Injectable()
export class Erc4337AccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertAccount(
    userId: string,
    chainId: number,
    address: string,
    entryPointAddress: string,
    factoryAddress: string,
    deployed: boolean,
  ): Promise<Erc4337Account> {
    return this.prisma.erc4337Account.upsert({
      where: {
        walletId_chainId: {
          walletId: userId,
          chainId,
        },
      },
      update: {
        address,
        entryPointAddress,
        factoryAddress,
        deployed,
      },
      create: {
        walletId: userId,
        chainId,
        address,
        entryPointAddress,
        factoryAddress,
        deployed,
      },
    });
  }

  async updateDeploymentStatus(
    userId: string,
    chainId: number,
    deployed: boolean,
    lastUserOpHash?: string,
  ): Promise<void> {
    await this.prisma.erc4337Account.update({
      where: {
        walletId_chainId: {
          walletId: userId,
          chainId,
        },
      },
      data: {
        deployed,
        lastUserOpHash: lastUserOpHash ?? undefined,
      },
    });
  }

  async recordUserOp(
    userId: string,
    chainId: number,
    userOpHash: string,
  ): Promise<void> {
    await this.prisma.erc4337Account.update({
      where: {
        walletId_chainId: {
          walletId: userId,
          chainId,
        },
      },
      data: {
        lastUserOpHash: userOpHash,
      },
    });
  }
}

