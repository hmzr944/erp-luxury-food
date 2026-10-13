-- AlterTable
ALTER TABLE "User" ADD COLUMN     "badgeKind" TEXT,
ADD COLUMN     "badgeLookup" TEXT,
ADD COLUMN     "badgeSetAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_organizationId_badgeLookup_key" ON "User"("organizationId", "badgeLookup");

