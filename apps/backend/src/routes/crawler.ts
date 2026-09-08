// src/routes/crawler.ts
//
// POST /api/crawler/run  — kick off a crawl of operator-submitted URLs.
//   Header: x-ingest-key: <INGEST_SECRET_KEY>  (same shared secret as
//   routes/ingest.ts — this endpoint makes the server issue outbound HTTP
//   requests to arbitrary hosts, so it's gated the same way the producer's
//   push endpoint is, not left open like the read-only GET routes below).
//   Body:   { urls: string[] }  — max 20 per call, kept synchronous and
//   small on purpose; this is not a queueing system.
//
// GET /api/crawler/pages     — list crawled pages (newest first).
// GET /api/crawler/pages/:id — one page + its images.

import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { crawlUrls } from "../lib/webCrawler.js";
import { logAudit, ipFromRequest } from "../lib/audit.js";

export const crawlerRouter = Router();

const MAX_URLS_PER_REQUEST = 20;

crawlerRouter.post(
  "/run",
  asyncHandler(async (req, res) => {
    const expectedKey = process.env.INGEST_SECRET_KEY;
    if (!expectedKey) return res.status(500).json({ error: "INGEST_SECRET_KEY is not configured on the server" });
    const providedKey = req.header("x-ingest-key");
    if (!providedKey || providedKey !== expectedKey) return res.status(401).json({ error: "Invalid or missing ingestion key" });

    const { urls } = req.body as { urls?: string[] };
    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: "Body must include a non-empty `urls` array" });
    }
    if (urls.length > MAX_URLS_PER_REQUEST) {
      return res.status(400).json({ error: `Max ${MAX_URLS_PER_REQUEST} URLs per request` });
    }

    const results = await crawlUrls(urls);

    await logAudit({
      user: "Operator",
      action: "Crawl Requested",
      resource: `${urls.length} URL(s)`,
      type: "system",
      ip: ipFromRequest(req),
    });

    res.status(201).json({ results });
  })
);

crawlerRouter.get(
  "/pages",
  asyncHandler(async (req, res) => {
    const pages = await prisma.crawledPage.findMany({
      include: { source: true, _count: { select: { images: true } } },
      orderBy: { fetchedAt: "desc" },
      take: 100,
    });
    res.json(pages);
  })
);

crawlerRouter.get(
  "/pages/:id",
  asyncHandler(async (req, res) => {
    const page = await prisma.crawledPage.findUnique({
      where: { id: req.params.id },
      include: { source: true, images: true },
    });
    if (!page) return res.status(404).json({ error: "Page not found" });
    res.json(page);
  })
);


