import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { computeVendorRisk, type VendorRisk } from "../lib/vendorRisk.js";
import { computeEntityRisk } from "../lib/entityRisk.js";
import { correlateListings, getCorrelationForAlias, type CorrelationResult } from "../lib/entityCorrelation.js";
import type { ListingInput } from "../lib/riskEngine.js";
import { logAudit, ipFromRequest } from "../lib/audit.js";

export const entitiesRouter = Router();

async function buildListingInputs(): Promise<ListingInput[]> {
  const listings = await prisma.listing.findMany();
  return listings.map((l) => ({
    id: l.id,
    category: l.category,
    title: l.title,
    priceUsd: l.priceUsd,
    marketplace: l.marketplace,
    vendorAlias: l.vendorAlias,
    firstSeen: l.firstSeen,
    lastSeen: l.lastSeen,
    shipsFrom: l.shipsFrom,
  }));
}

async function buildVendorRiskMap(): Promise<Map<string, VendorRisk>> {
  return computeVendorRisk(await buildListingInputs());
}

// Correlation is intentionally computed independently of vendor/entity
// risk (see lib/entityCorrelation.ts header): it answers "which listings
// belong together", never "how risky is this". Reused as-is by the
// simulation pipeline (routes/simulate.ts) so the two never disagree.
async function buildCorrelationResult(): Promise<CorrelationResult> {
  return correlateListings(await buildListingInputs());
}

// Attaches a `computed` block (honest, listing-evidence-derived — see
// lib/entityRisk.ts) alongside a `legacy` block holding the untouched
// seed-time stored values. The original top-level risk/confidence/riskChange
// fields are ALSO left completely unmodified for backward API-contract
// compatibility with anything already reading them directly — nothing about
// this change silently overwrites or removes existing fields.
function attachComputedRisk(
  entity: { alias: string; risk: number; confidence: number; riskChange: number; [key: string]: unknown },
  vendorRiskByAlias: Map<string, VendorRisk>,
  correlationResult: CorrelationResult
) {
  const computed = computeEntityRisk(entity.alias, vendorRiskByAlias);

  // Additive field only — does not replace or feed into risk/confidence
  // above, which remain entirely owned by lib/entityRisk.ts. Correlation
  // answers "which listings make up this entity"; risk answers "how risky
  // is it" — see lib/entityCorrelation.ts header for why these stay separate.
  const correlationGroup = getCorrelationForAlias(entity.alias, correlationResult);
  const correlation = correlationGroup
    ? {
        method: correlationGroup.method,
        confidence: correlationGroup.confidence,
        matchedSignals: correlationGroup.matchedSignals,
        signalDetails: correlationGroup.signalDetails,
        correlatedListings: correlationGroup.listingCount,
        rawAliasVariants: correlationGroup.rawAliasVariants,
        marketplaces: correlationGroup.marketplaces,
        explanation: correlationGroup.explanation,
      }
    : {
        method: "multi_signal_correlation" as const,
        confidence: 0,
        matchedSignals: [] as const,
        signalDetails: [] as const,
        correlatedListings: 0,
        rawAliasVariants: [] as const,
        marketplaces: [] as const,
        explanation: "No listing carries a vendorAlias that normalizes to match this entity's alias.",
      };

  return {
    ...entity,
      risk: computed.risk ?? entity.risk,
      confidence: computed.confidence ?? entity.confidence,
      riskChange: null as number | null,
    computed: {
      risk: computed.risk ?? entity.risk,
      confidence: computed.confidence ?? entity.confidence,
      riskChange: null as number | null,
      riskChangeExplanation:
        "Not calculable: no per-entity historical risk snapshots exist in the schema (unlike Network, which has NetworkRiskPoint). See lib/entityRisk.ts.",
      correlated: computed.correlated,
      correlationMethod: computed.correlationMethod,
      vendorAlias: computed.vendorAlias,
      evidence: computed.evidence,
      explanation: computed.explanation,
    },
    correlation,
    legacy: {
      risk: entity.risk,
      confidence: entity.confidence,
      riskChange: entity.riskChange,
      note: "Seed-time stored values — not derived from listing evidence. Prefer `computed` for anything presented to a user as a live/calculated metric.",
    },
  };
}

// GET /api/entities — list, matches the Entities screen table
entitiesRouter.get("/", async (_req, res) => {
  const [entities, vendorRiskByAlias, correlationResult] = await Promise.all([
    prisma.entity.findMany({
      include: { identifiers: true, network: true },
    }),
    buildVendorRiskMap(),
    buildCorrelationResult(),
  ]);
  const calculatedEntities = entities.map((e) =>
  attachComputedRisk(e, vendorRiskByAlias, correlationResult)
);

calculatedEntities.sort((a, b) => b.risk - a.risk);
  res.json(calculatedEntities);
});

// GET /api/entities/:displayId — entity profile page
entitiesRouter.get("/:displayId", async (req, res) => {
  const [entity, vendorRiskByAlias, correlationResult] = await Promise.all([
    prisma.entity.findUnique({
      where: { displayId: req.params.displayId },
      include: {
        identifiers: true,
        network: { include: { riskPoints: true } },
        alertLinks: { include: { alert: true } },
        investigationLinks: { include: { investigation: true } },
        events: { orderBy: { createdAt: "desc" } },
      },
    }),
    buildVendorRiskMap(),
    buildCorrelationResult(),
  ]);
  if (!entity) return res.status(404).json({ error: "Entity not found" });

  await logAudit({
    user: "System",
    action: "Viewed Entity",
    resource: entity.alias,
    type: "read",
    ip: ipFromRequest(req),
  });

  res.json(attachComputedRisk(entity, vendorRiskByAlias, correlationResult));
});