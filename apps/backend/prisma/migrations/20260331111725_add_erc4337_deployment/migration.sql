-- CreateTable
CREATE TABLE "erc4337_deployment" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "entryPointAddress" TEXT NOT NULL,
    "factoryAddress" TEXT,
    "deployedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erc4337_deployment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "erc4337_deployment_address_chainId_idx" ON "erc4337_deployment"("address", "chainId");

-- CreateIndex
CREATE INDEX "erc4337_deployment_walletId_idx" ON "erc4337_deployment"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "erc4337_deployment_walletId_chainId_key" ON "erc4337_deployment"("walletId", "chainId");
