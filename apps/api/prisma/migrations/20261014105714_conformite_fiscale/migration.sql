-- CreateEnum
CREATE TYPE "ClosurePeriod" AS ENUM ('DAY', 'MONTH', 'YEAR');

-- AlterTable
ALTER TABLE "OrganizationSettings" ADD COLUMN     "receiptFooter" TEXT,
ADD COLUMN     "receiptPolicy" TEXT NOT NULL DEFAULT 'ASK',
ADD COLUMN     "serviceNote" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PaymentMethod" ADD COLUMN     "giveChange" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maxAmount" DECIMAL(10,2),
ADD COLUMN     "mealVoucher" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requiresReference" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "mealVoucherEligible" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ReceiptChain" ADD COLUMN     "contentDigest" TEXT,
ADD COLUMN     "kind" "OrderKind",
ADD COLUMN     "perpetualAbsTotal" DECIMAL(14,2),
ADD COLUMN     "perpetualTotal" DECIMAL(14,2),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "FiscalClosure" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "period" "ClosurePeriod" NOT NULL,
    "label" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "firstCounter" INTEGER,
    "lastCounter" INTEGER,
    "ticketCount" INTEGER NOT NULL,
    "salesCount" INTEGER NOT NULL,
    "refundCount" INTEGER NOT NULL,
    "salesTotal" DECIMAL(14,2) NOT NULL,
    "refundsTotal" DECIMAL(14,2) NOT NULL,
    "periodTotal" DECIMAL(14,2) NOT NULL,
    "totalHT" DECIMAL(14,2) NOT NULL,
    "totalTax" DECIMAL(14,2) NOT NULL,
    "taxBreakdown" JSONB NOT NULL,
    "paymentBreakdown" JSONB NOT NULL,
    "perpetualTotal" DECIMAL(14,2) NOT NULL,
    "perpetualAbsTotal" DECIMAL(14,2) NOT NULL,
    "previousHash" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "auto" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedById" TEXT,

    CONSTRAINT "FiscalClosure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "siteId" TEXT,
    "seq" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "detail" JSONB,
    "userId" TEXT,
    "terminalId" TEXT,
    "previousHash" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FiscalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptDuplicate" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "userId" TEXT,
    "terminalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceiptDuplicate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingTicket" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "terminalId" TEXT,
    "total" DECIMAL(10,2) NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalArchive" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "period" "ClosurePeriod" NOT NULL,
    "label" TEXT NOT NULL,
    "fromCounter" INTEGER,
    "toCounter" INTEGER,
    "sha256" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "content" BYTEA NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FiscalArchive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SigningKey" (
    "id" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "privateKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SigningKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FiscalClosure_siteId_period_closedAt_idx" ON "FiscalClosure"("siteId", "period", "closedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalClosure_siteId_period_label_key" ON "FiscalClosure"("siteId", "period", "label");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalClosure_siteId_period_seq_key" ON "FiscalClosure"("siteId", "period", "seq");

-- CreateIndex
CREATE INDEX "FiscalEvent_siteId_createdAt_idx" ON "FiscalEvent"("siteId", "createdAt");

-- CreateIndex
CREATE INDEX "FiscalEvent_organizationId_createdAt_idx" ON "FiscalEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalEvent_organizationId_seq_key" ON "FiscalEvent"("organizationId", "seq");

-- CreateIndex
CREATE INDEX "ReceiptDuplicate_siteId_createdAt_idx" ON "ReceiptDuplicate"("siteId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReceiptDuplicate_orderId_number_key" ON "ReceiptDuplicate"("orderId", "number");

-- CreateIndex
CREATE INDEX "TrainingTicket_siteId_createdAt_idx" ON "TrainingTicket"("siteId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingTicket_siteId_number_key" ON "TrainingTicket"("siteId", "number");

-- CreateIndex
CREATE INDEX "FiscalArchive_siteId_createdAt_idx" ON "FiscalArchive"("siteId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalArchive_siteId_period_label_key" ON "FiscalArchive"("siteId", "period", "label");

-- CreateIndex
CREATE UNIQUE INDEX "SigningKey_keyId_key" ON "SigningKey"("keyId");

-- AddForeignKey
ALTER TABLE "FiscalClosure" ADD CONSTRAINT "FiscalClosure_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- Inaltérabilité au niveau de la base : les tables fiscales sont en ajout
-- seul. Aucune mise à jour ; suppression seulement lors d'une purge
-- explicite (SET LOCAL flow.allow_purge = 'on'), après archivage.
-- ============================================================
CREATE OR REPLACE FUNCTION flow_append_only() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('flow.allow_purge', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Table fiscale % en ajout seul : % refusé', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER receipt_chain_append_only BEFORE UPDATE OR DELETE ON "ReceiptChain"
  FOR EACH ROW EXECUTE FUNCTION flow_append_only();
CREATE TRIGGER fiscal_closure_append_only BEFORE UPDATE OR DELETE ON "FiscalClosure"
  FOR EACH ROW EXECUTE FUNCTION flow_append_only();
CREATE TRIGGER fiscal_event_append_only BEFORE UPDATE OR DELETE ON "FiscalEvent"
  FOR EACH ROW EXECUTE FUNCTION flow_append_only();
CREATE TRIGGER receipt_duplicate_append_only BEFORE UPDATE OR DELETE ON "ReceiptDuplicate"
  FOR EACH ROW EXECUTE FUNCTION flow_append_only();
CREATE TRIGGER training_ticket_append_only BEFORE UPDATE OR DELETE ON "TrainingTicket"
  FOR EACH ROW EXECUTE FUNCTION flow_append_only();
CREATE TRIGGER fiscal_archive_append_only BEFORE UPDATE OR DELETE ON "FiscalArchive"
  FOR EACH ROW EXECUTE FUNCTION flow_append_only();

-- Moyens de paiement existants : règles françaises par défaut
UPDATE "PaymentMethod" SET "giveChange" = true WHERE "kind" = 'CASH';
UPDATE "PaymentMethod" SET "mealVoucher" = true, "maxAmount" = 25 WHERE "code" IN ('TICKET_RESTO', 'MEAL_VOUCHER');
UPDATE "PaymentMethod" SET "requiresReference" = true WHERE "code" IN ('CHEQUE', 'CHECK');

-- Alimentaire : produits à 5,5 % et 10 % payables en titre-restaurant
UPDATE "Product" p SET "mealVoucherEligible" = true
FROM "Site" s JOIN "Organization" o ON o.id = s."organizationId"
WHERE p."siteId" = s.id AND o.sector = 'FOOD' AND p."taxRate" IN (5.5, 10);
