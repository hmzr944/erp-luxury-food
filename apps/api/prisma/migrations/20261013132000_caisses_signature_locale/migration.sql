-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "soldAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ReceiptChain" ADD COLUMN     "terminalCounter" INTEGER,
ADD COLUMN     "terminalHash" TEXT,
ADD COLUMN     "terminalId" TEXT,
ADD COLUMN     "terminalPreviousHash" TEXT,
ADD COLUMN     "terminalSignature" TEXT,
ADD COLUMN     "terminalSignedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Terminal" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3),

    CONSTRAINT "Terminal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Terminal_siteId_idx" ON "Terminal"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_clientId_key" ON "Order"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ReceiptChain_terminalId_terminalCounter_key" ON "ReceiptChain"("terminalId", "terminalCounter");

-- AddForeignKey
ALTER TABLE "ReceiptChain" ADD CONSTRAINT "ReceiptChain_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "Terminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Terminal" ADD CONSTRAINT "Terminal_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

