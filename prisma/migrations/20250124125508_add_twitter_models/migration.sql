-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "content" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "chatSessionId" TEXT NOT NULL,
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "skillTags" TEXT[],

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemPrompt" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "content" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,

    CONSTRAINT "SystemPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tweet" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publicMetrics" JSONB,
    "editHistoryTweetIds" TEXT[],
    "authorId" TEXT NOT NULL,

    CONSTRAINT "Tweet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TweetEntity" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "url" TEXT,
    "expandedUrl" TEXT,
    "mediaKey" TEXT,
    "tweetId" TEXT NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "TweetEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TweetCache" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TweetCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwitterRateLimit" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "remaining" INTEGER NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TwitterRateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CachedTweets" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CachedTweets_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "Message_chatSessionId_idx" ON "Message"("chatSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "SystemPrompt_version_key" ON "SystemPrompt"("version");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimit_ipAddress_key" ON "RateLimit"("ipAddress");

-- CreateIndex
CREATE INDEX "RateLimit_ipAddress_idx" ON "RateLimit"("ipAddress");

-- CreateIndex
CREATE INDEX "Tweet_createdAt_idx" ON "Tweet"("createdAt");

-- CreateIndex
CREATE INDEX "Tweet_authorId_idx" ON "Tweet"("authorId");

-- CreateIndex
CREATE INDEX "TweetEntity_tweetId_idx" ON "TweetEntity"("tweetId");

-- CreateIndex
CREATE INDEX "TweetEntity_type_idx" ON "TweetEntity"("type");

-- CreateIndex
CREATE INDEX "TweetCache_type_idx" ON "TweetCache"("type");

-- CreateIndex
CREATE INDEX "TweetCache_isActive_idx" ON "TweetCache"("isActive");

-- CreateIndex
CREATE INDEX "TwitterRateLimit_endpoint_resetAt_idx" ON "TwitterRateLimit"("endpoint", "resetAt");

-- CreateIndex
CREATE UNIQUE INDEX "TwitterRateLimit_endpoint_key" ON "TwitterRateLimit"("endpoint");

-- CreateIndex
CREATE INDEX "_CachedTweets_B_index" ON "_CachedTweets"("B");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_chatSessionId_fkey" FOREIGN KEY ("chatSessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TweetEntity" ADD CONSTRAINT "TweetEntity_tweetId_fkey" FOREIGN KEY ("tweetId") REFERENCES "Tweet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CachedTweets" ADD CONSTRAINT "_CachedTweets_A_fkey" FOREIGN KEY ("A") REFERENCES "Tweet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CachedTweets" ADD CONSTRAINT "_CachedTweets_B_fkey" FOREIGN KEY ("B") REFERENCES "TweetCache"("id") ON DELETE CASCADE ON UPDATE CASCADE;
