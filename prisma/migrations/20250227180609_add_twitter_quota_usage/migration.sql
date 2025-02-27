-- CreateTable
CREATE TABLE "TwitterQuotaUsage" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "limit" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TwitterQuotaUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TwitterQuotaUsage_date_key" ON "TwitterQuotaUsage"("date");

-- CreateIndex
CREATE INDEX "TwitterQuotaUsage_date_idx" ON "TwitterQuotaUsage"("date");
