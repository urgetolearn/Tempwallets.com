/*
  Warnings:

  - You are about to drop the `aptos_account` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."aptos_account" DROP CONSTRAINT "aptos_account_walletId_fkey";

-- DropTable
DROP TABLE "public"."aptos_account";

-- CreateTable
CREATE TABLE "erc4337_account" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "entryPointAddress" TEXT NOT NULL,
    "factoryAddress" TEXT NOT NULL,
    "deployed" BOOLEAN NOT NULL DEFAULT false,
    "lastUserOpHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erc4337_account_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "erc4337_account_address_chainId_idx" ON "erc4337_account"("address", "chainId");

-- CreateIndex
CREATE INDEX "erc4337_account_walletId_idx" ON "erc4337_account"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "erc4337_account_walletId_chainId_key" ON "erc4337_account"("walletId", "chainId");
