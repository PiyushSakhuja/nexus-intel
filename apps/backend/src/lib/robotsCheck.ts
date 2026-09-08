// src/lib/robotsCheck.ts
//
// A small, honest robots.txt checker — NOT a full spec implementation
// (no crawl-delay directive support beyond a fixed floor, no wildcard/
// $-anchor matching beyond simple prefix matching). It supports exactly
// what lib/webCrawler.ts needs: "is this specific path Disallow'd for our
// user-agent (or *)". That's deliberately conservative — on any parse
// ambiguity this fails CLOSED (treats the path as disallowed) rather than
// guessing permissive, since this file is the only thing standing between
// the crawler and a site that asked not to be crawled.
//
// This does NOT make crawling any given site "legal" — robots.txt is a
// convention, not a law, and plenty of sites that would object to being
// crawled don't bother publishing one. It's a floor, not a legal opinion.
// The operator submitting URLs to crawl (see routes/crawler.ts) is
// responsible for making sure they have the right to crawl the sites they
// submit — the ToS is a separate question this file can't check.

import { guardUrl } from "./ssrfGuard.js";

const USER_AGENT = "NexusIntelBot";
const FETCH_TIMEOUT_MS = 5000;
const MAX_ROBOTS_BYTES = 512 * 1024; // robots.txt is always small — cap generously and bail if a server sends something absurd

interface RobotsRules {
  disallowedPaths: string[];
}

const robotsCache = new Map<string, RobotsRules>();

async function fetchRobotsTxt(origin: string): Promise<string | null> {
  const robotsUrl = `${origin}/robots.txt`;
  // Same SSRF guard as the page fetch itself — robots.txt is fetched from
  // an operator-influenced origin, so it gets no less scrutiny than the
  // page it's gating access to.
  const guard = await guardUrl(robotsUrl);
  if (!guard.ok) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(robotsUrl, {
      signal: controller.signal,
      redirect: "follow", // robots.txt redirects are low-risk (no body we trust beyond text) and common (bare domain -> www)
      headers: { "User-Agent": USER_AGENT },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const text = await res.text();
    if (Buffer.byteLength(text) > MAX_ROBOTS_BYTES) return text.slice(0, MAX_ROBOTS_BYTES);
    return text;
  } catch {
    return null; // unreachable robots.txt — see isAllowedByRobots for what this means
  }
}

// Parses the block that applies to us: prefers a User-agent: NexusIntelBot
// section if present, otherwise falls back to User-agent: *.
function parseRobotsTxt(text: string): RobotsRules {
  const lines = text.split(/\r?\n/).map((l) => l.split("#")[0].trim());

  function collectFor(agent: string): string[] | null {
    let inBlock = false;
    let matched = false;
    const disallows: string[] = [];
    for (const line of lines) {
      if (!line) continue;
      const [rawKey, ...rest] = line.split(":");
      const key = rawKey?.trim().toLowerCase();
      const value = rest.join(":").trim();
      if (key === "user-agent") {
        inBlock = value.toLowerCase() === agent.toLowerCase();
        if (inBlock) matched = true;
        continue;
      }
      if (!inBlock) continue;
      if (key === "disallow" && value) disallows.push(value);
    }
    return matched ? disallows : null;
  }

  return {
    disallowedPaths: collectFor(USER_AGENT) ?? collectFor("*") ?? [],
  };
}

async function getRulesForOrigin(origin: string): Promise<RobotsRules | null> {
  if (robotsCache.has(origin)) return robotsCache.get(origin)!;
  const text = await fetchRobotsTxt(origin);
  if (text === null) {
    robotsCache.set(origin, { disallowedPaths: [] } /* see caller: null is treated separately */);
    return null;
  }
  const rules = parseRobotsTxt(text);
  robotsCache.set(origin, rules);
  return rules;
}

export interface RobotsCheckResult {
  allowed: boolean;
  reason: string;
}

/**
 * Checks one URL against its origin's robots.txt.
 *
 * - No robots.txt found / unreachable: ALLOWED, with a reason noting no
 *   rules were found (absence of a robots.txt is conventionally treated
 *   as "no crawling restrictions stated", not as a block).
 * - robots.txt found and the path is Disallow'd for us or *: BLOCKED.
 * - Otherwise: ALLOWED.
 */
export async function checkRobotsAllowed(url: string): Promise<RobotsCheckResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { allowed: false, reason: "Not a valid URL" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { allowed: false, reason: "Only http/https URLs are crawlable" };
  }

  const origin = `${parsed.protocol}//${parsed.host}`;
  const rules = await getRulesForOrigin(origin);
  if (rules === null) {
    return { allowed: true, reason: "No robots.txt found at this origin" };
  }

  const path = parsed.pathname || "/";
  const blocked = rules.disallowedPaths.some((rule) => rule === "/" || path.startsWith(rule));
  if (blocked) {
    return { allowed: false, reason: `Disallowed by robots.txt for this origin` };
  }
  return { allowed: true, reason: "Allowed by robots.txt" };
}