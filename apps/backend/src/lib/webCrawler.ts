// src/lib/webCrawler.ts
//
// Fetches OPERATOR-SUBMITTED URLs only — never auto-discovers or follows
// links on its own. This is deliberate: a self-directed crawler that
// follows every link it finds is a much bigger scope (queue management,
// depth limits, infinite-crawl protection) and a much bigger legal/ethics
// surface (it can wander onto pages/domains nobody vetted). Submitting
// exactly the pages you want scored keeps this tool inside the same
// "explainable, bounded, operator-directed" shape as the rest of the
// pipeline (compare: producer.mjs pushes specific known rows, it doesn't
// wander the internet).
//
// Every URL is checked against its origin's robots.txt (lib/robotsCheck.ts)
// before being fetched — see that file's header for what that check does
// and doesn't guarantee. This tool does NOT check a site's Terms of
// Service; the operator submitting a URL is responsible for having the
// right to crawl it.
//
// Rate limiting: one request in flight at a time, with a fixed per-domain
// delay — a hackathon-scale crawler has no business hammering a target
// site, and a shared delay is simpler and safer than trying to be clever
// about it.

import * as cheerio from "cheerio";
import { prisma } from "./prisma.js";
import { checkRobotsAllowed } from "./robotsCheck.js";
import { scoreText, signalsToDisplayStrings } from "./textSuspicionEngine.js";
import { analyzeImage } from "./imageMetadata.js";

const USER_AGENT = "NexusIntelBot/1.0 (+operator-submitted URL crawl)";
const FETCH_TIMEOUT_MS = 10_000;
const PER_DOMAIN_DELAY_MS = 2000; // be polite — one request per domain at a time, with a floor between them
const MAX_IMAGES_PER_PAGE = 5;

export interface CrawlPageResult {
  url: string;
  ok: boolean;
  reason?: string; // set when ok=false (robots-blocked, fetch failed, etc.)
  pageId?: string;
  suspicionScore?: number;
  imageCount?: number;
}

const lastFetchAtByDomain = new Map<string, number>();

async function politeDelay(domain: string) {
  const last = lastFetchAtByDomain.get(domain) ?? 0;
  const wait = PER_DOMAIN_DELAY_MS - (Date.now() - last);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastFetchAtByDomain.set(domain, Date.now());
}

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) throw new Error(`Not HTML (content-type: ${contentType || "unknown"})`);
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

function extractTextAndImages(html: string, pageUrl: string) {
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();

  const title = $("title").first().text().trim() || null;
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();

  const imageUrls: string[] = [];
  $("img").each((_, el) => {
    const src = $(el).attr("src");
    if (!src) return;
    try {
      const absolute = new URL(src, pageUrl).toString();
      if (!imageUrls.includes(absolute)) imageUrls.push(absolute);
    } catch {
      // malformed src attribute — skip rather than guess
    }
  });

  return { title, bodyText, imageUrls: imageUrls.slice(0, MAX_IMAGES_PER_PAGE) };
}

async function ensureSource(url: string, domain: string, allowedByRobots: boolean) {
  return prisma.crawledSource.upsert({
    where: { url },
    update: { lastCrawledAt: new Date(), allowedByRobots },
    create: { url, domain, allowedByRobots, lastCrawledAt: new Date() },
  });
}

/**
 * Crawls one operator-submitted URL end to end: robots check -> fetch ->
 * extract text/images -> score text -> analyze each image's metadata ->
 * persist CrawledPage + CrawledImage rows.
 */
export async function crawlUrl(url: string): Promise<CrawlPageResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { url, ok: false, reason: "Not a valid URL" };
  }
  const domain = parsed.host;

  const robots = await checkRobotsAllowed(url);
  await ensureSource(url, domain, robots.allowed);
  if (!robots.allowed) {
    return { url, ok: false, reason: robots.reason };
  }

  await politeDelay(domain);

  let html: string;
  try {
    html = await fetchHtml(url);
  } catch (err: any) {
    return { url, ok: false, reason: `Fetch failed: ${err.message ?? String(err)}` };
  }

  const { title, bodyText, imageUrls } = extractTextAndImages(html, url);
  const textResult = scoreText(bodyText);
  const status = textResult.score >= 60 ? "Flagged" : textResult.score >= 30 ? "Under Review" : "Monitoring";

  const source = await prisma.crawledSource.findUniqueOrThrow({ where: { url } });

  const page = await prisma.crawledPage.upsert({
    where: { url },
    update: {
      title,
      textExcerpt: bodyText.slice(0, 2000),
      wordCount: textResult.wordCount,
      suspicionScore: textResult.score,
      signals: signalsToDisplayStrings(textResult.signals),
      status,
      fetchedAt: new Date(),
    },
    create: {
      sourceId: source.id,
      url,
      title,
      textExcerpt: bodyText.slice(0, 2000),
      wordCount: textResult.wordCount,
      suspicionScore: textResult.score,
      signals: signalsToDisplayStrings(textResult.signals),
      status,
    },
  });

  // Clear out any prior image rows for this page before re-analyzing —
  // re-crawls should reflect the page's CURRENT images, not accumulate
  // duplicates from every crawl of the same URL.
  await prisma.crawledImage.deleteMany({ where: { pageId: page.id } });

  let imageCount = 0;
  for (const imageUrl of imageUrls) {
    const meta = await analyzeImage(imageUrl);
    await prisma.crawledImage.create({
      data: {
        pageId: page.id,
        imageUrl: meta.imageUrl,
        width: meta.width,
        height: meta.height,
        cameraMake: meta.cameraMake,
        cameraModel: meta.cameraModel,
        software: meta.software,
        gpsLat: meta.gpsLat,
        gpsLon: meta.gpsLon,
        capturedAt: meta.capturedAt,
        metadataStripped: meta.metadataStripped,
        suspicionFlags: meta.suspicionFlags,
      },
    });
    imageCount++;
  }

  return { url, ok: true, pageId: page.id, suspicionScore: textResult.score, imageCount };
}

/**
 * Crawls a batch of operator-submitted URLs sequentially (politeDelay
 * already rate-limits within a domain; sequential keeps total concurrent
 * outbound load — and therefore load on whatever site is being crawled —
 * predictable for a hackathon-scale tool).
 */
export async function crawlUrls(urls: string[]): Promise<CrawlPageResult[]> {
  const results: CrawlPageResult[] = [];
  for (const url of urls) {
    try {
      results.push(await crawlUrl(url));
    } catch (err: any) {
      results.push({ url, ok: false, reason: `Unexpected error: ${err.message ?? String(err)}` });
    }
  }
  return results;
}
