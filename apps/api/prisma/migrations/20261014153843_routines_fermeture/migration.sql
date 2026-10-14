-- AlterTable
ALTER TABLE "CashSession" ADD COLUMN     "closedLate" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "SiteRoutine" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "closingTime" TEXT NOT NULL DEFAULT '19:30',
    "supplyDeadline" TEXT,
    "cashDeadline" TEXT,
    "days" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5, 6]::INTEGER[],
    "reminderMinutes" INTEGER NOT NULL DEFAULT 30,
    "alertAfterMinutes" INTEGER NOT NULL DEFAULT 60,
    "autoLock" BOOLEAN NOT NULL DEFAULT true,
    "notifyEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tasks" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteRoutine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutineCheck" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "doneAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "userName" TEXT,

    CONSTRAINT "RoutineCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutineAlert" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recipients" TEXT[],

    CONSTRAINT "RoutineAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SiteRoutine_siteId_key" ON "SiteRoutine"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "RoutineCheck_siteId_day_key_key" ON "RoutineCheck"("siteId", "day", "key");

-- CreateIndex
CREATE UNIQUE INDEX "RoutineAlert_siteId_day_kind_key" ON "RoutineAlert"("siteId", "day", "kind");

-- AddForeignKey
ALTER TABLE "SiteRoutine" ADD CONSTRAINT "SiteRoutine_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
