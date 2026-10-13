-- CreateEnum
CREATE TYPE "CashSessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'PRODUCTION';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "pinLookup" TEXT,
ADD COLUMN     "pinSetAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CashSession" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "terminalId" TEXT NOT NULL,
    "status" "CashSessionStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedById" TEXT NOT NULL,
    "expectedOpening" DECIMAL(10,2),
    "openingFloat" DECIMAL(10,2) NOT NULL,
    "openingNote" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "denominations" JSONB,
    "counted" DECIMAL(10,2),
    "expectedCash" DECIMAL(10,2),
    "difference" DECIMAL(10,2),
    "differenceReason" TEXT,
    "keptFloat" DECIMAL(10,2),
    "deposit" DECIMAL(10,2),

    CONSTRAINT "CashSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplyAlert" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "siteName" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "productName" TEXT,
    "reductionPct" INTEGER,
    "message" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplyAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashSession_siteId_openedAt_idx" ON "CashSession"("siteId", "openedAt");

-- CreateIndex
CREATE INDEX "CashSession_terminalId_status_idx" ON "CashSession"("terminalId", "status");

-- CreateIndex
CREATE INDEX "SupplyAlert_organizationId_day_idx" ON "SupplyAlert"("organizationId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "User_organizationId_pinLookup_key" ON "User"("organizationId", "pinLookup");

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

