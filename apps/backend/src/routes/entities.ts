import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { computeVendorRisk, type VendorRisk } from "../lib/vendorRisk.js";
import { computeEntityRisk } from "../lib/entityRisk.js";
import type { ListingInput } from "../lib/riskEngine.js";

export const entitiesRouter = Router();

async function buildVendorRiskMap(): Promise<Map<string, VendorRisk>> {
  const listings = await prisma.listing.findMany();
  const inputs: ListingInput[] = listings.map((l) => ({
    id: l.id,
    category: l.category,
    title: l.title,
    priceUsd: l.priceUsd,
    marketplace: l.marketplace,
    vendorAlias: l.vendorAlias,
    firstSeen: l.firstSeen,
    lastSeen: l.lastSeen,
  }));
  return computeVendorRisk(inputs);
}

// Attaches a `computed` block (honest, listing-evidence-derived — see
// lib/entityRisk.ts) alongside a `legacy` block holding the untouched
// seed-time stored values. The original top-level risk/confidence/riskChange
// fields are ALSO left completely unmodified for backward API-contract
// compatibility with anything already reading them directly — nothing about
// this change silently overwrites or removes existing fields.
function attachComputedRisk(
  entity: { alias: string; risk: number; confidence: number; riskChange: number; [key: string]: unknown },
  vendorRiskByAlias: Map<string, VendorRisk>
) {
  const computed = computeEntityRisk(entity.alias, vendorRiskByAlias);
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
  const [entities, vendorRiskByAlias] = await Promise.all([
    prisma.entity.findMany({
      include: { identifiers: true, network: true },
    }),
    buildVendorRiskMap(),
  ]);
  const calculatedEntities = entities.map((e) =>
  attachComputedRisk(e, vendorRiskByAlias)
);

calculatedEntities.sort((a, b) => b.risk - a.risk);
  res.json(entities.map((e) => attachComputedRisk(e, vendorRiskByAlias)));
});

// GET /api/entities/:displayId — entity profile page
entitiesRouter.get("/:displayId", async (req, res) => {
  const [entity, vendorRiskByAlias] = await Promise.all([
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
  ]);
  if (!entity) return res.status(404).json({ error: "Entity not found" });
  res.json(attachComputedRisk(entity, vendorRiskByAlias));
});