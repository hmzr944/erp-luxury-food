-- CreateEnum
CREATE TYPE "InventoryStatus" AS ENUM ('DRAFT', 'VALIDATED', 'CANCELLED');

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "inventoryCountId" TEXT,
ADD COLUMN     "reasonCode" TEXT;

-- CreateTable
CREATE TABLE "InventoryCount" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "status" "InventoryStatus" NOT NULL DEFAULT 'DRAFT',
    "categoryId" TEXT,
    "categoryName" TEXT,
    "openKey" TEXT,
    "createdById" TEXT,
    "validatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validatedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "InventoryCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryCountLine" (
    "id" TEXT NOT NULL,
    "countId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "barcode" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'unité',
    "expectedQty" DECIMAL(10,3) NOT NULL,
    "countedQty" DECIMAL(10,3),
    "reasonCode" TEXT,
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryCountLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCount_openKey_key" ON "InventoryCount"("openKey");

-- CreateIndex
CREATE INDEX "InventoryCount_siteId_createdAt_idx" ON "InventoryCount"("siteId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryCountLine_countId_idx" ON "InventoryCountLine"("countId");

-- CreateIndex
CREATE INDEX "StockMovement_inventoryCountId_idx" ON "StockMovement"("inventoryCountId");

-- AddForeignKey
ALTER TABLE "InventoryCountLine" ADD CONSTRAINT "InventoryCountLine_countId_fkey" FOREIGN KEY ("countId") REFERENCES "InventoryCount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
