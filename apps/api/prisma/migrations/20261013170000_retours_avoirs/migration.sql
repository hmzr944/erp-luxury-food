-- CreateEnum
CREATE TYPE "OrderKind" AS ENUM ('SALE', 'REFUND');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "kind" "OrderKind" NOT NULL DEFAULT 'SALE',
ADD COLUMN     "refundOfId" TEXT,
ADD COLUMN     "refundReason" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "refundOfItemId" TEXT;

-- CreateTable
CREATE TABLE "StoreCredit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "initialAmount" DECIMAL(10,2) NOT NULL,
    "balance" DECIMAL(10,2) NOT NULL,
    "issuedOrderId" TEXT,
    "customerEmail" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreCreditRedemption" (
    "id" TEXT NOT NULL,
    "creditId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreCreditRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreCredit_code_key" ON "StoreCredit"("code");

-- CreateIndex
CREATE INDEX "StoreCredit_organizationId_idx" ON "StoreCredit"("organizationId");

-- CreateIndex
CREATE INDEX "StoreCreditRedemption_creditId_idx" ON "StoreCreditRedemption"("creditId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_refundOfId_fkey" FOREIGN KEY ("refundOfId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreCredit" ADD CONSTRAINT "StoreCredit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreCreditRedemption" ADD CONSTRAINT "StoreCreditRedemption_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "StoreCredit"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Moyen de paiement « Avoir » pour toutes les organisations existantes
INSERT INTO "PaymentMethod" ("id", "organizationId", "code", "label", "kind", "position")
SELECT gen_random_uuid()::text, o."id", 'CREDIT', 'Avoir', 'VOUCHER'::"PaymentKind", 50
FROM "Organization" o
ON CONFLICT ("organizationId", "code") DO NOTHING;
