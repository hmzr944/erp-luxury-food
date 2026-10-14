-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "invoiceSentAt" TIMESTAMP(3),
ADD COLUMN     "invoiceSentTo" TEXT,
ADD COLUMN     "receiptSentAt" TIMESTAMP(3);
