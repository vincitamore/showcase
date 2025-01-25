-- CreateTable
CREATE TABLE "TempImage" (
    "id" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TempImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TempImage_expiresAt_idx" ON "TempImage"("expiresAt");
