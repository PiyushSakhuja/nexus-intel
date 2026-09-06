// apps/backend/src/lib/entityRisk.ts
//
// Computes entity-level risk/confidence FROM vendor evidence, instead of
// trusting the seeded Entity.risk/confidence columns as if they were
// measured (they aren't — see seed.ts, where every entity's risk and
// confidence are literal hand-typed numbers with no calculation behind
// them).
//
// Correlation is by exact Entity.alias <-> Listing.vendorAlias string
// match — same ALIAS CORRELATION caveat as vendorRisk.ts: this is NOT
// identity resolution.
//
// Design: when an entity's alias matches a vendor with real listing
// evidence, entity risk is set equal to that vendor's computed risk — a
// deliberate 1:1 pass-through rather than a second weighted formula. The
// vendor score already IS the aggregate of every observable signal about
// that identity's marketplace behavior; re-blending it with anything else
// at the entity layer would just be double-counting the same underlying
// listings under a different name. The Listing -> Vendor -> Entity ->
// Network pipeline is evidence flowing upward, not re-scoring at each
// layer.
//
// When there is no alias match, there is no listing evidence at all for
// this entity, so risk/confidence are reported as null ("not calculable"),
// never defaulted to some number.

import type { VendorRisk } from "./vendorRisk.js";
import { signalsToContributors, type RiskContributor } from "./riskEngine.js";

export interface EntityComputedRisk {
  correlated: boolean;
  correlationMethod: "alias_exact_match" | "none";
  risk: number | null; // 0-100, or null if not calculable
  confidence: number | null; // 0-100, or null if not calculable
  vendorAlias: string | null;
  evidence: {
    listingCount: number;
    marketplaceCount: number;
    highRiskCategoryCount: number;
  } | null;
  explanation: string;
  // Pass-through of vendorRisk.ts's representative-listing data (see the
  // comment on VendorRisk.representativeListingId/representativeListingSignals
  // for why this — and not a decomposition of the blended vendor `risk`
  // itself — is the honest thing to expose as "why"). `contributors` is
  // just signalsToContributors() applied to those same real, unmodified
  // RiskSignal[] — no new scoring, no schema change.
  representativeListingId: string | null;
  contributors: RiskContributor[];
}

export function computeEntityRisk(
  entityAlias: string,
  vendorRiskByAlias: Map<string, VendorRisk>
): EntityComputedRisk {
  const vendor = vendorRiskByAlias.get(entityAlias);
  if (!vendor) {
    return {
      correlated: false,
      correlationMethod: "none",
      risk: null,
      confidence: null,
      vendorAlias: null,
      evidence: null,
      explanation:
        "No listing carries a vendorAlias matching this entity's alias — there is no marketplace evidence to compute risk or confidence from, so both are reported as not calculable rather than defaulted to a number.",
      representativeListingId: null,
      contributors: [],
    };
  }

  const risk = vendor.risk;

  // Confidence measures how much corroborating evidence backs this
  // correlation, not how risky the behavior is. Base 30 for having at
  // least one matching listing at all, then reward volume (more listings =
  // more observed behavior, capped) and independent corroboration
  // (appearing under the same alias on 2+ marketplaces is much stronger
  // evidence than a single listing on one site).
  const volumeBonus = Math.min(40, vendor.listingCount * 4);
  const crossMarketBonus = vendor.marketplaceCount >= 2 ? 20 : 0;
  const consistencyBonus = Math.min(10, vendor.highRiskCategoryCount * 5);
  const confidence = Math.max(0, Math.min(100, Math.round(30 + volumeBonus + crossMarketBonus + consistencyBonus)));

  return {
    correlated: true,
    correlationMethod: "alias_exact_match",
    risk,
    confidence,
    vendorAlias: vendor.vendorAlias,
    evidence: {
      listingCount: vendor.listingCount,
      marketplaceCount: vendor.marketplaceCount,
      highRiskCategoryCount: vendor.highRiskCategoryCount,
    },
    explanation: `Derived from ${vendor.listingCount} listing(s) under alias "${vendor.vendorAlias}" across ${vendor.marketplaceCount} marketplace(s) (alias correlation, not identity resolution).`,
    representativeListingId: vendor.representativeListingId,
    contributors: signalsToContributors(vendor.representativeListingSignals),
  };
}

// NOTE on Entity.riskChange: intentionally NOT computed anywhere in this
// module. A defensible "risk change" requires comparing the current
// computed risk against a stored PAST risk value at a known prior point in
// time — the same role NetworkRiskPoint plays for networks. No equivalent
// per-entity history table exists in schema.prisma (no "EntityRiskPoint"),
// so there is nothing real to diff against. Inventing a "before" value
// here would violate the no-fabricated-history rule. Until a per-entity
// risk-history table exists, riskChange is NOT CALCULABLE — routes/entities.ts
// reports computed.riskChange as null with this explanation attached.