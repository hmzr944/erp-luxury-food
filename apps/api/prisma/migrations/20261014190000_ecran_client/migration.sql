-- CreateTable
CREATE TABLE "CustomerDisplay" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "pairCode" TEXT,
    "pairExpiresAt" TIMESTAMP(3),
    "siteId" TEXT,
    "terminalId" TEXT,
    "pairedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerDisplay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerDisplay_tokenHash_key" ON "CustomerDisplay"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerDisplay_pairCode_key" ON "CustomerDisplay"("pairCode");

-- CreateIndex
CREATE INDEX "CustomerDisplay_siteId_idx" ON "CustomerDisplay"("siteId");

-- AddForeignKey
ALTER TABLE "CustomerDisplay" ADD CONSTRAINT "CustomerDisplay_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

