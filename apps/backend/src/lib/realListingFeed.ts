// src/lib/realListingFeed.ts
//
// Backs the live producer feed with REAL, not-yet-seen rows from the same
// Hansa/Valhalla dark-web data-dump CSVs prisma/seed.ts and
// prisma/importDatadump.ts already sample from — instead of the pipeline
// re-processing the same handful of already-imported listings forever.
//
// prisma/importDatadump.ts only imports a curated slice (top 40 vendors,
// capped at 15 listings each, plus a stride sample) — most of those
// vendors have many more real rows sitting unused in the CSVs. This module
// is the "next batch" of that same real data: rows that
//   (a) aren't already a Listing row (by the same H-/V- displayId scheme
//       importDatadump.ts uses), AND
//   (b) belong to a vendorAlias that normalizes to an alias we already
//       have an Entity for (so every candidate has a well-defined
//       entity/network to attach to — this module never invents a new
//       vendor or network on its own).
//
// Deliberately stateless: it re-derives "next" on every call by diffing
// against the DB's current Listing rows. Once the caller (routes/ingest.ts)
// actually inserts a returned candidate, it naturally disappears from the
// next call's result — no separate cursor/offset file to keep in sync.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { prisma } from "./prisma.js";
import { normalizeVendorAlias } from "./entityCorrelation.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// src/lib -> src -> backend -> prisma/data
const DATA_DIR = join(__dirname, "..", "..", "prisma", "data");
const EUR_TO_USD = 1.08; // same fixed rate as importDatadump.ts — not a live FX call

export interface RealListingCandidate {
  displayId: string; // "H-12345" | "V-6789" — matches importDatadump.ts's scheme
  marketplace: "Hansa" | "Valhalla";
  title: string;
  vendorAlias: string; // raw, as it appears in the CSV
  priceUsd: number | null;
  category: string;
  categoryInferred: boolean;
  shipsFrom: string | null;
  entityDisplayId: string;
  networkDisplayId: string | null;
}

interface RawRow {
  marketplace: "Hansa" | "Valhalla";
  marketplaceId: string;
  displayId: string;
  title: string;
  vendorAlias: string;
  priceUsd: number | null;
  category: string;
  categoryInferred: boolean;
  shipsFrom: string | null;
}

// ─── Tiny CSV parser (quote-aware) — same as importDatadump.ts, duplicated
// here rather than imported from it, since that script runs main() at
// import time and isn't safe to pull into the running server. ────────────
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur.trim());
  return fields;
}

function parseCsvFile(path: string): string[][] {
  const text = readFileSync(path, "utf-8");
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)
    .map(parseCsvLine);
}

const CATEGORY_KEYWORDS: [RegExp, string][] = [
  [/\b(mg|pills?|tablets?|cocaine|heroin|mdma|weed|cannabis|morphine|oxy|xanax|lsd|meth|ketamine|hash)\b/i, "Drugs"],
  [/\b(fraud|carding|cvv|credit card|paypal|bank log|dumps?|phishing)\b/i, "Fraud Related"],
  [/\b(counterfeit|replica|fake (id|passport|note))\b/i, "Counterfeits"],
  [/\b(hack|hacking|penetration|exploit|guide|tutorial|ebook|course)\b/i, "Guides & Tutorials"],
  [/\b(account|key|license|software|download|ebook|leak)\b/i, "Digital Goods"],
  [/\b(gold|silver|jewell?ery|diamond)\b/i, "Jewellery"],
  [/\b(phone|iphone|laptop|electronics?|gadget)\b/i, "Electronics"],
  [/\b(escort|adult|xxx)\b/i, "Erotica"],
  [/\b(vpn|hosting|proxy|server)\b/i, "Security & Hosting"],
];
function inferCategory(title: string): string {
  for (const [re, cat] of CATEGORY_KEYWORDS) {
    if (re.test(title)) return cat;
  }
  return "Miscellaneous";
}

function parseHansa(): RawRow[] {
  const rows = parseCsvFile(join(DATA_DIR, "hansa-marketplace-listings-december-2016.csv"));
  const seen = new Set<string>();
  const out: RawRow[] = [];
  for (const f of rows) {
    if (f.length < 6) continue;
    const [, marketplaceId, title, vendor, priceStr, category, shipsFrom] = f;
    if (!marketplaceId || seen.has(marketplaceId)) continue;
    seen.add(marketplaceId);
    const priceMatch = priceStr?.match(/([\d.]+)/);
    out.push({
      marketplace: "Hansa",
      marketplaceId,
      displayId: `H-${marketplaceId}`,
      title: title || "Untitled listing",
      vendorAlias: vendor || "unknown",
      priceUsd: priceMatch ? parseFloat(priceMatch[1]) : null,
      category: category && category.length > 0 ? category : "Miscellaneous",
      categoryInferred: !category,
      shipsFrom: shipsFrom || null,
    });
  }
  return out;
}

function parseValhalla(): RawRow[] {
  const rows = parseCsvFile(join(DATA_DIR, "valhalla-marketplace-listings-2016-10.csv"));
  const seen = new Set<string>();
  const out: RawRow[] = [];
  for (const f of rows) {
    const [marketplaceId, title, vendor, priceStr, shipsFrom] = f;
    if (!marketplaceId || seen.has(marketplaceId)) continue;
    seen.add(marketplaceId);
    const priceMatch = priceStr?.match(/([\d.]+)\s*(\w+)?/);
    let priceUsd: number | null = null;
    if (priceMatch) {
      const amount = parseFloat(priceMatch[1]);
      const currency = (priceMatch[2] || "EUR").toUpperCase();
      priceUsd = currency === "USD" ? amount : amount * EUR_TO_USD;
    }
    out.push({
      marketplace: "Valhalla",
      marketplaceId,
      displayId: `V-${marketplaceId}`,
      title: title || "Untitled listing",
      vendorAlias: vendor || "unknown",
      priceUsd,
      category: inferCategory(title || ""),
      categoryInferred: true,
      shipsFrom: shipsFrom || null,
    });
  }
  return out;
}

// Parsed once per process and cached — the CSVs on disk never change at
// runtime, only which rows have already been turned into Listing rows.
let cachedRawRows: RawRow[] | null = null;
function getAllRawRows(): RawRow[] {
  if (!cachedRawRows) {
    cachedRawRows = [...parseHansa(), ...parseValhalla()].sort((a, b) =>
      a.displayId < b.displayId ? -1 : a.displayId > b.displayId ? 1 : 0
    );
  }
  return cachedRawRows;
}

/**
 * Returns up to `count` real CSV listing rows that (a) haven't been
 * inserted as a Listing yet and (b) belong to a vendor we already have an
 * Entity for — deterministically ordered, so repeated calls hand out a
 * stable "next slice" as the caller inserts what it's given.
 */
export async function getNextRealListings(count: number): Promise<RealListingCandidate[]> {
  const [existingListings, entities] = await Promise.all([
    prisma.listing.findMany({ select: { displayId: true } }),
    prisma.entity.findMany({ include: { network: true } }),
  ]);

  const existingDisplayIds = new Set(existingListings.map((l) => l.displayId));

  const entityByNormalizedAlias = new Map<string, (typeof entities)[number]>();
  for (const e of entities) {
    entityByNormalizedAlias.set(normalizeVendorAlias(e.alias), e);
  }

  const candidates: RealListingCandidate[] = [];
  for (const row of getAllRawRows()) {
    if (candidates.length >= count) break;
    if (existingDisplayIds.has(row.displayId)) continue;
    const entity = entityByNormalizedAlias.get(normalizeVendorAlias(row.vendorAlias));
    if (!entity) continue; // only surface listings for vendors we already track

    candidates.push({
      displayId: row.displayId,
      marketplace: row.marketplace,
      title: row.title,
      vendorAlias: row.vendorAlias,
      priceUsd: row.priceUsd,
      category: row.category,
      categoryInferred: row.categoryInferred,
      shipsFrom: row.shipsFrom,
      entityDisplayId: entity.displayId,
      networkDisplayId: entity.network?.displayId ?? null,
    });
  }
  return candidates;
}

export async function resolveSourceIdForMarketplace(marketplace: "Hansa" | "Valhalla"): Promise<string | null> {
  const name = marketplace === "Hansa" ? "Hansa Marketplace" : "Valhalla Marketplace";
  const source = await prisma.source.findUnique({ where: { name } });
  return source?.id ?? null;
}
