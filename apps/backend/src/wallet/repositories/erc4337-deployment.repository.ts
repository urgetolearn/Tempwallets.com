import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

@Injectable()
export class Erc4337DeploymentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertCounterfactual(params: {
    walletId: string;
    chainId: number;
    address: string;
    entryPointAddress: string;
    factoryAddress?: string | null;
  }): Promise<void> {
    const { walletId, chainId, address, entryPointAddress, factoryAddress } =
      params;
    await this.prisma.erc4337Deployment.upsert({
      where: { walletId_chainId: { walletId, chainId } },
      update: {
        address: address.toLowerCase(),
        entryPointAddress: entryPointAddress.toLowerCase(),
        factoryAddress: factoryAddress ? factoryAddress.toLowerCase() : null,
      },
      create: {
        walletId,
        chainId,
        address: address.toLowerCase(),
        entryPointAddress: entryPointAddress.toLowerCase(),
        factoryAddress: factoryAddress ? factoryAddress.toLowerCase() : null,
      },
    });
  }

  async markDeployed(walletId: string, chainId: number): Promise<void> {
    await this.prisma.erc4337Deployment.updateMany({
      where: { walletId, chainId, deployedAt: null },
      data: { deployedAt: new Date() },
    });
  }

  async get(walletId: string, chainId: number): Promise<{
    address: string;
    deployedAt: Date | null;
  } | null> {
    const row = await this.prisma.erc4337Deployment.findUnique({
      where: { walletId_chainId: { walletId, chainId } },
      select: { address: true, deployedAt: true },
    });
    return row ?? null;
  }
}

