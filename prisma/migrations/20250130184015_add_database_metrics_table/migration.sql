-- CreateTable
CREATE TABLE "database_metrics" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration" INTEGER NOT NULL,
    "query" TEXT,
    "error" BOOLEAN NOT NULL DEFAULT false,
    "route" TEXT,
    "method" TEXT,
    "status" INTEGER,
    "metadata" JSONB,

    CONSTRAINT "database_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "database_metrics_timestamp_idx" ON "database_metrics"("timestamp" DESC);
