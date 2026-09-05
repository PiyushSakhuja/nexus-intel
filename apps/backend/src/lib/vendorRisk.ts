// apps/backend/src/lib/vendorRisk.ts
//
// Deterministic vendor-level aggregation, derived entirely from Listing rows
// scored by riskEngine.ts. No new data source, no schema change, no
// duplicate scoring logic — this module groups already-scored listings by
// vendorAlias and aggregates.
//
// IMPORTANT — this is ALIAS CORRELATION, not identity resolution:
// Listing.vendorAlias is a free-text marketplace handle. Two listings that
// share the same vendorAlias string are assumed to belong to the same
// seller. That's a reasonable prototype-grade correlation key, but it is
// NOT a claim that we've cryptographically or forensically resolved the
// same real person across marketplaces — an alias could be reused
// coincidentally, or the same seller could operate under two different
// aliases undetected. Every downstream consumer of VendorRisk (entityRisk.ts,
// networkRisk.ts, routes/vendors.ts) must preserve this caveat rather than
// presenting it as confirmed identity.

import { scoreListings, HIGH_RISK_CATEGORIES, type ListingInput } from "./riskEngine.js";

export interface VendorRisk {
  vendorAlias: string;
  risk: number; // 0-100, computed
  listingCount: number;
  highRiskListingCount: number; // listings individually scored >= HIGH_RISK_LISTING_THRESHOLD
  marketplaceCount: number;
  marketplaces: string[];
  categoryCount: number;
  categories: string[];
  highRiskCategoryCount: number;
  highRiskCategories: string[];
  firstSeen: Date;
  lastSeen: Date;
  averageListingRisk: number;
  maxListingRisk: number;
  correlationMethod: "vendorAlias_exact_match";
}

// Matches the HIGH status threshold in riskStatus.ts, kept as a named
// constant here so the "what counts as a high-risk listing" definition is
// explicit and in one place per module.
const HIGH_RISK_LISTING_THRESHOLD = 60;

export function computeVendorRisk(listings: ListingInput[]): Map<string, VendorRisk> {
  // Reuses the real, existing, unmodified listing risk engine — vendor risk
  // never re-implements or re-guesses a listing's score.
  const scored = scoreListings(listings);

  const byVendor = new Map<string, ListingInput[]>();
  for (const l of listings) {
    if (!l.vendorAlias) continue; // no vendor to attribute this listing to
    const arr = byVendor.get(l.vendorAlias) ?? [];
    arr.push(l);
    byVendor.set(l.vendorAlias, arr);
  }

  const out = new Map<string, VendorRisk>();
  for (const [vendorAlias, vendorListings] of byVendor) {
    const risks = vendorListings.map((l) => scored.get(l.id)!.score);
    const marketplaces = new Set<string>();
    const categories = new Set<string>();
    let firstSeen = vendorListings[0].firstSeen;
    let lastSeen = vendorListings[0].lastSeen;
    for (const l of vendorListings) {
      if (l.marketplace) marketplaces.add(l.marketplace);
      categories.add(l.category);
      if (l.firstSeen < firstSeen) firstSeen = l.firstSeen;
      if (l.lastSeen > lastSeen) lastSeen = l.lastSeen;
    }
    const highRiskCategories = Array.from(categories).filter((c) => HIGH_RISK_CATEGORIES.has(c));
    const meanRisk = risks.reduce((a, b) => a + b, 0) / risks.length;
    const maxRisk = Math.max(...risks);
    const highRiskListingCount = risks.filter((r) => r >= HIGH_RISK_LISTING_THRESHOLD).length;

    // Weighted aggregate: mean (0.5) captures typical behavior, max (0.3)
    // ensures one severe listing isn't diluted away by many mild ones, and
    // up to 20 bonus points reward corroborating breadth of evidence
    // (cross-marketplace presence, multiple high-risk categories) — the
    // same "breadth as signal" idea riskEngine.ts already applies at the
    // listing level (crossMarketplace / riskDiversity features), just
    // reused here at the vendor level rather than re-invented.
    const crossMarketBonus = marketplaces.size >= 2 ? 10 : 0;
    const categoryDiversityBonus = Math.min(10, highRiskCategories.length * 5);
    const raw = meanRisk * 0.5 + maxRisk * 0.3 + crossMarketBonus + categoryDiversityBonus;
    const risk = Math.max(0, Math.min(100, Math.round(raw)));

    out.set(vendorAlias, {
      vendorAlias,
      risk,
      listingCount: vendorListings.length,
      highRiskListingCount,
      marketplaceCount: marketplaces.size,
      marketplaces: Array.from(marketplaces).sort(),
      categoryCount: categories.size,
      categories: Array.from(categories).sort(),
      highRiskCategoryCount: highRiskCategories.length,
      highRiskCategories: highRiskCategories.sort(),
      firstSeen,
      lastSeen,
      averageListingRisk: Math.round(meanRisk * 10) / 10,
      maxListingRisk: maxRisk,
      correlationMethod: "vendorAlias_exact_match",
    });
  }
  return out;
}