-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "wc_session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "pairingTopic" TEXT,
    "dappName" TEXT,
    "dappDescription" TEXT,
    "dappUrl" TEXT,
    "dappIcon" TEXT,
    "namespaces" JSONB NOT NULL,
    "expiry" TIMESTAMP(3) NOT NULL,
    "relay" JSONB NOT NULL,
    "eip7702Only" BOOLEAN NOT NULL DEFAULT true,
    "approvedChains" INTEGER[],
    "approvedAccounts" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wc_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wc_proposal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "proposalId" INTEGER NOT NULL,
    "proposerName" TEXT,
    "proposerUrl" TEXT,
    "proposerIcon" TEXT,
    "requiredChains" TEXT[],
    "requiredMethods" TEXT[],
    "requiredEvents" TEXT[],
    "optionalChains" TEXT[],
    "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING',
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wc_proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wc_request" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "requestId" INTEGER NOT NULL,
    "topic" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "chainId" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "response" JSONB,
    "error" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "usedEip7702" BOOLEAN NOT NULL DEFAULT false,
    "gasSponsored" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wc_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wc_session_topic_key" ON "wc_session"("topic");

-- CreateIndex
CREATE INDEX "wc_session_userId_idx" ON "wc_session"("userId");

-- CreateIndex
CREATE INDEX "wc_session_topic_idx" ON "wc_session"("topic");

-- CreateIndex
CREATE INDEX "wc_session_expiry_idx" ON "wc_session"("expiry");

-- CreateIndex
CREATE INDEX "wc_proposal_userId_idx" ON "wc_proposal"("userId");

-- CreateIndex
CREATE INDEX "wc_proposal_proposalId_idx" ON "wc_proposal"("proposalId");

-- CreateIndex
CREATE INDEX "wc_proposal_status_idx" ON "wc_proposal"("status");

-- CreateIndex
CREATE INDEX "wc_request_sessionId_idx" ON "wc_request"("sessionId");

-- CreateIndex
CREATE INDEX "wc_request_topic_idx" ON "wc_request"("topic");

-- CreateIndex
CREATE INDEX "wc_request_status_idx" ON "wc_request"("status");

-- AddForeignKey
ALTER TABLE "wc_request" ADD CONSTRAINT "wc_request_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "wc_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
