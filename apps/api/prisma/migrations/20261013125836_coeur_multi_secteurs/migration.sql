-- CreateEnum
CREATE TYPE "Sector" AS ENUM ('GENERAL', 'FOOD', 'FASHION', 'BEAUTY', 'JEWELRY', 'WINE', 'HOME', 'SERVICES');

-- CreateEnum
CREATE TYPE "Pack" AS ENUM ('FOOD', 'FASHION', 'BEAUTY', 'JEWELRY', 'WINE', 'SERVICES');

-- CreateEnum
CREATE TYPE "TrackingMode" AS ENUM ('NONE', 'LOT', 'LOT_EXPIRY', 'SERIAL');

-- CreateEnum
CREATE TYPE "AttributeType" AS ENUM ('TEXT', 'NUMBER', 'BOOLEAN', 'SELECT', 'DATE');

-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('CARD', 'CASH', 'VOUCHER', 'TRANSFER', 'OTHER');

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "lotId" TEXT,
ADD COLUMN     "serialNumber" TEXT,
ADD COLUMN     "variantName" TEXT;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'EUR',
ADD COLUMN     "packs" "Pack"[] DEFAULT ARRAY[]::"Pack"[],
ADD COLUMN     "priceIncludesTax" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sector" "Sector" NOT NULL DEFAULT 'GENERAL';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "attributes" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "tracking" "TrackingMode" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "Variant" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "options" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sku" TEXT;

-- CreateTable
CREATE TABLE "TaxRate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "rate" DECIMAL(5,2) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TaxRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" "PaymentKind" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttributeDefinition" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "AttributeType" NOT NULL,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pack" "Pack",
    "required" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AttributeDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductOption" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "values" TEXT[],
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VariantStock" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "alertAt" DECIMAL(10,3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VariantStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockLot" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "lotNumber" TEXT,
    "serialNumber" TEXT,
    "expiresAt" TIMESTAMP(3),
    "quantity" DECIMAL(10,3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderPayment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" "PaymentKind" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaxRate_organizationId_idx" ON "TaxRate"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRate_organizationId_rate_key" ON "TaxRate"("organizationId", "rate");

-- CreateIndex
CREATE INDEX "PaymentMethod_organizationId_idx" ON "PaymentMethod"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethod_organizationId_code_key" ON "PaymentMethod"("organizationId", "code");

-- CreateIndex
CREATE INDEX "AttributeDefinition_organizationId_idx" ON "AttributeDefinition"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "AttributeDefinition_organizationId_key_key" ON "AttributeDefinition"("organizationId", "key");

-- CreateIndex
CREATE INDEX "ProductOption_productId_idx" ON "ProductOption"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductOption_productId_name_key" ON "ProductOption"("productId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "VariantStock_variantId_key" ON "VariantStock"("variantId");

-- CreateIndex
CREATE INDEX "VariantStock_siteId_idx" ON "VariantStock"("siteId");

-- CreateIndex
CREATE INDEX "StockLot_siteId_productId_idx" ON "StockLot"("siteId", "productId");

-- CreateIndex
CREATE INDEX "StockLot_expiresAt_idx" ON "StockLot"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "StockLot_productId_serialNumber_key" ON "StockLot"("productId", "serialNumber");

-- CreateIndex
CREATE INDEX "OrderPayment_orderId_idx" ON "OrderPayment"("orderId");

-- CreateIndex
CREATE INDEX "Variant_barcode_idx" ON "Variant"("barcode");

-- AddForeignKey
ALTER TABLE "TaxRate" ADD CONSTRAINT "TaxRate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributeDefinition" ADD CONSTRAINT "AttributeDefinition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOption" ADD CONSTRAINT "ProductOption_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariantStock" ADD CONSTRAINT "VariantStock_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLot" ADD CONSTRAINT "StockLot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLot" ADD CONSTRAINT "StockLot_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderPayment" ADD CONSTRAINT "OrderPayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- Reprise des données : les organisations existantes ont été créées
-- pour l'alimentaire, avec des prix saisis HT. On conserve ce comportement.
-- ============================================================
UPDATE "Organization" SET "sector" = 'FOOD', "packs" = ARRAY['FOOD']::"Pack"[], "priceIncludesTax" = false;

INSERT INTO "TaxRate" ("id", "organizationId", "label", "rate", "isDefault")
SELECT gen_random_uuid()::text, o."id", t.label, t.rate, t.is_default
FROM "Organization" o
CROSS JOIN (VALUES
  ('Taux réduit alimentaire', 5.5, true),
  ('Taux intermédiaire', 10, false),
  ('Taux normal', 20, false)
) AS t(label, rate, is_default);

INSERT INTO "PaymentMethod" ("id", "organizationId", "code", "label", "kind", "position")
SELECT gen_random_uuid()::text, o."id", m.code, m.label, m.kind::"PaymentKind", m.position
FROM "Organization" o
CROSS JOIN (VALUES
  ('CARD', 'Carte', 'CARD', 0),
  ('CASH', 'Espèces', 'CASH', 1),
  ('TICKET_RESTO', 'Titre-restaurant', 'VOUCHER', 2),
  ('INVOICE', 'Sur facture', 'TRANSFER', 3)
) AS m(code, label, kind, position);
