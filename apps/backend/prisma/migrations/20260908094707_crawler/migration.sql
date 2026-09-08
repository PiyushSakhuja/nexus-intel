-- CreateTable
CREATE TABLE "CrawledSource" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "allowedByRobots" BOOLEAN NOT NULL DEFAULT true,
    "lastCrawledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrawledSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrawledPage" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "textExcerpt" TEXT,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "suspicionScore" INTEGER NOT NULL DEFAULT 0,
    "signals" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrawledPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrawledImage" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "cameraMake" TEXT,
    "cameraModel" TEXT,
    "software" TEXT,
    "gpsLat" DOUBLE PRECISION,
    "gpsLon" DOUBLE PRECISION,
    "capturedAt" TIMESTAMP(3),
    "metadataStripped" BOOLEAN NOT NULL DEFAULT false,
    "suspicionFlags" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrawledImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CrawledSource_url_key" ON "CrawledSource"("url");

-- CreateIndex
CREATE UNIQUE INDEX "CrawledPage_url_key" ON "CrawledPage"("url");

-- AddForeignKey
ALTER TABLE "CrawledPage" ADD CONSTRAINT "CrawledPage_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "CrawledSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrawledImage" ADD CONSTRAINT "CrawledImage_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "CrawledPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
