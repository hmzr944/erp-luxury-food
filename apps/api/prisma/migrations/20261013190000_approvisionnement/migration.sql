-- CreateEnum
CREATE TYPE "SupplyStatus" AS ENUM ('DRAFT', 'SENT', 'IN_PRODUCTION', 'SHIPPED', 'RECEIVED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "orderable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "supplyPrice" DECIMAL(10,2),
ADD COLUMN     "supplyUnit" TEXT;

-- AlterTable
ALTER TABLE "Site" ADD COLUMN     "isSupplier" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "leadDays" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "orderCutoff" TEXT NOT NULL DEFAULT '18:00';

-- CreateTable
CREATE TABLE "SupplyOrder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "fromSiteId" TEXT NOT NULL,
    "toSiteId" TEXT NOT NULL,
    "deliveryDate" DATE NOT NULL,
    "status" "SupplyStatus" NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "receiptNote" TEXT,
    "sentAt" TIMESTAMP(3),
    "productionAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplyOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplyOrderLine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "name" TEXT NOT NULL,
    "variantName" TEXT,
    "unit" TEXT,
    "unitPrice" DECIMAL(10,2),
    "suggested" DECIMAL(10,3),
    "ordered" DECIMAL(10,3) NOT NULL,
    "prepared" DECIMAL(10,3),
    "received" DECIMAL(10,3),
    "issue" TEXT,

    CONSTRAINT "SupplyOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplyOrder_toSiteId_deliveryDate_idx" ON "SupplyOrder"("toSiteId", "deliveryDate");

-- CreateIndex
CREATE UNIQUE INDEX "SupplyOrder_fromSiteId_toSiteId_deliveryDate_key" ON "SupplyOrder"("fromSiteId", "toSiteId", "deliveryDate");

-- CreateIndex
CREATE UNIQUE INDEX "SupplyOrder_organizationId_number_key" ON "SupplyOrder"("organizationId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "SupplyOrderLine_orderId_productId_variantId_key" ON "SupplyOrderLine"("orderId", "productId", "variantId");

-- AddForeignKey
ALTER TABLE "SupplyOrder" ADD CONSTRAINT "SupplyOrder_fromSiteId_fkey" FOREIGN KEY ("fromSiteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyOrder" ADD CONSTRAINT "SupplyOrder_toSiteId_fkey" FOREIGN KEY ("toSiteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyOrderLine" ADD CONSTRAINT "SupplyOrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "SupplyOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

