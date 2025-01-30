-- AlterTable
ALTER TABLE "Log" ADD COLUMN     "duration" INTEGER,
ADD COLUMN     "error" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "method" TEXT,
ADD COLUMN     "route" TEXT,
ADD COLUMN     "status" INTEGER;

-- CreateIndex
CREATE INDEX "Log_timestamp_idx" ON "Log"("timestamp");

-- CreateIndex
CREATE INDEX "Log_route_idx" ON "Log"("route");

-- CreateIndex
CREATE INDEX "Log_level_idx" ON "Log"("level");
