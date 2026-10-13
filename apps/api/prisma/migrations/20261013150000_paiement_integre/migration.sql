-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('SIMULATOR', 'STRIPE', 'SUMUP');

-- CreateEnum
CREATE TYPE "TerminalPaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELED');

-- AlterTable
ALTER TABLE "OrderPayment" ADD COLUMN     "reference" TEXT;

-- CreateTable
CREATE TABLE "PaymentAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "credentials" TEXT NOT NULL,
    "testMode" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentDevice" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "name" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TerminalPayment" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" "TerminalPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "clientSaleId" TEXT,
    "providerRef" TEXT,
    "failureReason" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TerminalPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAccount_organizationId_provider_key" ON "PaymentAccount"("organizationId", "provider");

-- CreateIndex
CREATE INDEX "PaymentDevice_siteId_idx" ON "PaymentDevice"("siteId");

-- CreateIndex
CREATE INDEX "TerminalPayment_siteId_createdAt_idx" ON "TerminalPayment"("siteId", "createdAt");

-- CreateIndex
CREATE INDEX "TerminalPayment_deviceId_status_idx" ON "TerminalPayment"("deviceId", "status");

-- CreateIndex
CREATE INDEX "TerminalPayment_clientSaleId_idx" ON "TerminalPayment"("clientSaleId");

-- AddForeignKey
ALTER TABLE "PaymentAccount" ADD CONSTRAINT "PaymentAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentDevice" ADD CONSTRAINT "PaymentDevice_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerminalPayment" ADD CONSTRAINT "TerminalPayment_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "PaymentDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

