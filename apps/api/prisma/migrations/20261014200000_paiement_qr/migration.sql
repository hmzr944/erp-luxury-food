-- AlterTable
ALTER TABLE "TerminalPayment" ADD COLUMN     "checkoutUrl" TEXT,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ALTER COLUMN "deviceId" DROP NOT NULL;

