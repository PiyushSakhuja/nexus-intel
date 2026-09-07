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
import type { WalletRiskResult } from "./walletRisk.js";

export interface EntityWalletEvidence {
  walletCount: number; // distinct wallets with a real WalletTransaction.entityId FK to this entity
  walletDisplayIds: string[];
  maxWalletRisk: number | null; // highest computed wallet risk among this entity's linked wallets
  averageWalletRisk: number | null;
  totalTransactionCount: number;
}

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
  // Wallet-derived evidence (see walletRisk.ts). Independent of the
  // listing/vendorAlias evidence above — an entity can have one, the
  // other, both, or neither. Null when this entity has no wallets linked
  // to it via a real WalletTransaction.entityId row.
  walletEvidence: EntityWalletEvidence | null;
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

// How much a linked wallet's own computed risk can move this entity's
// final risk, on top of/independent of listing evidence. Deliberately
// capped well under 100 so wallet evidence can escalate an entity's risk
// (e.g. an otherwise-unlisted entity that is nonetheless the counterparty
// on a high-risk wallet) without a single wallet ever being able to
// manufacture a maximal entity score on its own.
const WALLET_RISK_BLEND_WEIGHT = 0.4;

export function computeEntityRisk(
  entityAlias: string,
  vendorRiskByAlias: Map<string, VendorRisk>,
  walletEvidenceByEntityId?: Map<string, EntityWalletEvidence>,
  entityId?: string
): EntityComputedRisk {
  const vendor = vendorRiskByAlias.get(entityAlias);
  const walletEvidence = entityId ? walletEvidenceByEntityId?.get(entityId) ?? null : null;

  if (!vendor && !walletEvidence) {
    return {
      correlated: false,
      correlationMethod: "none",
      risk: null,
      confidence: null,
      vendorAlias: null,
      evidence: null,
      walletEvidence: null,
      explanation:
        "No listing carries a vendorAlias matching this entity's alias, and no wallet transaction links to this entity — there is no evidence to compute risk or confidence from, so both are reported as not calculable rather than defaulted to a number.",
      representativeListingId: null,
      contributors: [],
    };
  }

  if (!vendor && walletEvidence) {
    // Wallet-only evidence, no listing evidence at all: entity risk passes
    // through the linked wallets' own computed risk (worst-case-weighted,
    // same "max matters, don't let it get diluted" idea used elsewhere in
    // this codebase), since there is nothing else to blend it with.
    const risk = Math.max(0, Math.min(100, Math.round((walletEvidence.maxWalletRisk ?? 0) * 0.7 + (walletEvidence.averageWalletRisk ?? 0) * 0.3)));
    const confidence = Math.max(0, Math.min(100, Math.round(20 + Math.min(50, walletEvidence.totalTransactionCount * 3) + Math.min(20, walletEvidence.walletCount * 10))));
    return {
      correlated: true,
      correlationMethod: "none",
      risk,
      confidence,
      vendorAlias: null,
      evidence: null,
      walletEvidence,
      explanation: `Derived from ${walletEvidence.walletCount} linked wallet(s) (${walletEvidence.totalTransactionCount} total transaction(s)) — no marketplace listing evidence exists for this entity.`,
      representativeListingId: null,
      contributors: [],
    };
  }

  // vendor is guaranteed non-null past this point.
  const vendorRisk = vendor!.risk;

  // Confidence measures how much corroborating evidence backs this
  // correlation, not how risky the behavior is. Base 30 for having at
  // least one matching listing at all, then reward volume (more listings =
  // more observed behavior, capped) and independent corroboration
  // (appearing under the same alias on 2+ marketplaces is much stronger
  // evidence than a single listing on one site).
  const volumeBonus = Math.min(40, vendor!.listingCount * 4);
  const crossMarketBonus = vendor!.marketplaceCount >= 2 ? 20 : 0;
  const consistencyBonus = Math.min(10, vendor!.highRiskCategoryCount * 5);
  let confidence = Math.max(0, Math.min(100, Math.round(30 + volumeBonus + crossMarketBonus + consistencyBonus)));

  let risk = vendorRisk;
  let explanation = `Derived from ${vendor!.listingCount} listing(s) under alias "${vendor!.vendorAlias}" across ${vendor!.marketplaceCount} marketplace(s) (alias correlation, not identity resolution).`;

  if (walletEvidence) {
    // Blend in real wallet evidence: the entity's risk becomes a weighted
    // combination of its listing-derived (vendor) risk and its linked
    // wallets' computed risk, rather than listing evidence silently
    // ignoring blockchain activity that is already stored and linked via
    // WalletTransaction.entityId.
    const walletRiskFigure = Math.round((walletEvidence.maxWalletRisk ?? 0) * 0.7 + (walletEvidence.averageWalletRisk ?? 0) * 0.3);
    risk = Math.max(0, Math.min(100, Math.round(vendorRisk * (1 - WALLET_RISK_BLEND_WEIGHT) + walletRiskFigure * WALLET_RISK_BLEND_WEIGHT)));
    confidence = Math.max(0, Math.min(100, confidence + Math.min(10, walletEvidence.walletCount * 3)));
    explanation += ` Blended with computed risk from ${walletEvidence.walletCount} linked wallet(s) (${walletEvidence.totalTransactionCount} transaction(s); wallet-derived component weighted at ${Math.round(WALLET_RISK_BLEND_WEIGHT * 100)}%).`;
  }

  return {
    correlated: true,
    correlationMethod: "alias_exact_match",
    risk,
    confidence,
    vendorAlias: vendor!.vendorAlias,
    evidence: {
      listingCount: vendor!.listingCount,
      marketplaceCount: vendor!.marketplaceCount,
      highRiskCategoryCount: vendor!.highRiskCategoryCount,
    },
    walletEvidence,
    explanation,
    representativeListingId: vendor!.representativeListingId,
    contributors: signalsToContributors(vendor!.representativeListingSignals),
  };
}

/**
 * Builds the per-entity wallet evidence map from already-computed
 * WalletRiskResult rows and the real WalletTransaction.entityId FKs that
 * link wallets to entities. Pure function — no DB access — so it composes
 * cleanly with scoreAllWallets() from walletRisk.ts at the route layer.
 */
export function buildEntityWalletEvidence(
  walletRiskById: Map<string, WalletRiskResult>,
  transactions: { walletId: string; entityId: string | null }[]
): Map<string, EntityWalletEvidence> {
  const byEntity = new Map<string, { walletIds: Set<string>; walletDisplayIds: Set<string>; txnCount: number }>();
  for (const t of transactions) {
    if (!t.entityId) continue;
    const bucket = byEntity.get(t.entityId) ?? { walletIds: new Set<string>(), walletDisplayIds: new Set<string>(), txnCount: 0 };
    bucket.walletIds.add(t.walletId);
    bucket.txnCount += 1;
    byEntity.set(t.entityId, bucket);
  }

  const out = new Map<string, EntityWalletEvidence>();
  for (const [entityId, bucket] of byEntity) {
    const risks = Array.from(bucket.walletIds)
      .map((id) => walletRiskById.get(id))
      .filter((r): r is WalletRiskResult => !!r && r.calculable);
    if (risks.length === 0) continue; // wallets linked, but none have any calculable risk — nothing honest to report

    const scores = risks.map((r) => r.score);
    out.set(entityId, {
      walletCount: bucket.walletIds.size,
      walletDisplayIds: [], // filled in by the route layer, which has the Wallet.displayId lookup
      maxWalletRisk: Math.max(...scores),
      averageWalletRisk: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
      totalTransactionCount: bucket.txnCount,
    });
  }
  return out;
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