import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { computeVendorRisk, type VendorRisk } from "../lib/vendorRisk.js";
import { computeEntityRisk } from "../lib/entityRisk.js";
import { computeNetworkRiskAggregate } from "../lib/networkRisk.js";
import { riskToStatus } from "../lib/riskStatus.js";
import type { ListingInput } from "../lib/riskEngine.js";

export const networksRouter = Router();

async function buildVendorRiskMap(): Promise<Map<string, VendorRisk>> {
  const listings = await prisma.listing.findMany();
  const inputs: ListingInput[] = listings.map((l) => ({
    id: l.id,
    category: l.category,
    title: l.title,
    priceUsd: l.priceUsd,
    marketplace: l.marketplace,
    vendorAlias: l.vendorAlias,
    shipsFrom: l.shipsFrom,
    firstSeen: l.firstSeen,
    lastSeen: l.lastSeen,
  }));
  return computeVendorRisk(inputs);
}
async function calculateNetworkRisk(
  entities: { alias: string }[]
) {
  const vendorRiskByAlias = await buildVendorRiskMap();

  const entityRisks = entities.map((entity) =>
    computeEntityRisk(entity.alias, vendorRiskByAlias)
  );

  const aggregate = computeNetworkRiskAggregate(entityRisks);

  return {
    entityRisks,
    aggregate,
  };
}
// GET /api/networks — emerging networks list (Overview page ranking)
//
// `risk` / `change` / `status` remain the persisted, event-sourced values
// (see routes/simulate.ts) — completely UNCHANGED by this route, so the
// existing API contract and trajectory semantics stay intact. `computed` is
// a fresh, always-current aggregate derived from each network's entities'
// listing evidence, exposed alongside so the two can be compared rather
// than one silently masquerading as the other. See lib/networkRisk.ts.
networksRouter.get("/", async (_req, res) => {
  const [networks, vendorRiskByAlias] = await Promise.all([
    prisma.network.findMany({
      include: { _count: { select: { entities: true } }, entities: true },
    }),
    buildVendorRiskMap(),
  ]);

  const out = networks.map((n) => {
    const entityRisks = n.entities.map((e) => computeEntityRisk(e.alias, vendorRiskByAlias));
    const aggregate = computeNetworkRiskAggregate(entityRisks);
    const { entities, ...rest } = n; // keep list-view payload the same shape as before (no raw entity rows)
    return {
      ...rest,
      computed: aggregate,
      computedStatus: aggregate.computedBaselineRisk !== null ? riskToStatus(aggregate.computedBaselineRisk) : null,
    };
  });
  out.sort(
  (a, b) =>
    (b.computed.computedBaselineRisk ?? -1) -
    (a.computed.computedBaselineRisk ?? -1)
);

  res.json(out);
});

// GET /api/networks/:displayId — full network details
networksRouter.get("/:displayId", async (req, res) => {
  const network = await prisma.network.findUnique({
    where: { displayId: req.params.displayId },
    include: {
      entities: true,
      riskPoints: {
        orderBy: { recordedAt: "asc" },
      },
      alerts: true,
    },
  });

  if (!network) {
    return res.status(404).json({ error: "Network not found" });
  }

  const { entityRisks, aggregate } = await calculateNetworkRisk(
    network.entities
  );

  const calculatedEntities = network.entities.map((entity, index) => {
  const computed = entityRisks[index];

  return {
    ...entity,

    // These are the values the frontend should treat as authoritative.
    risk: computed.risk ?? entity.risk,
    confidence: computed.confidence ?? entity.confidence,

    // No historical entity snapshots exist, so this cannot be calculated.
    riskChange: null,

    legacy: {
      risk: entity.risk,
      confidence: entity.confidence,
      riskChange: entity.riskChange,
      note: "Seed-time stored values — not derived from current listing evidence.",
    },
  };
});

  res.json({
    ...network,
    entities: calculatedEntities,
    computed: aggregate,
    computedStatus:
      aggregate.computedBaselineRisk !== null
        ? riskToStatus(aggregate.computedBaselineRisk)
        : null,
    entityRiskBreakdown: entityRisks,
  });
});

// GET /api/networks/:displayId/trajectory — the early-warning risk-over-time
// chart, built from real NetworkRiskPoint rows instead of a hardcoded array.
// UNCHANGED — this endpoint was already correctly implemented and is
// preserved exactly as-is. If a network has no NetworkRiskPoint rows yet
// (e.g. immediately after a fresh seed, before any /api/simulate/event
// calls), `riskPoints` will correctly be an empty array — the frontend
// should render "No historical risk data available" for that case rather
// than a fabricated chart.
networksRouter.get("/:displayId/trajectory", async (req, res) => {
  const network = await prisma.network.findUnique({
    where: { displayId: req.params.displayId },
    include: { riskPoints: { orderBy: { recordedAt: "asc" } } },
  });
  if (!network) return res.status(404).json({ error: "Network not found" });
  res.json(network);
});

// POST /api/networks/:displayId/recalculate — EXPLICIT, non-silent
// recalculation. Overwrites the persisted risk/status/change from the
// current computed entity-evidence baseline, records why via a RiskEvent,
// and appends a NetworkRiskPoint so the trajectory chart shows a real,
// honestly-labeled jump instead of quietly rewriting history. This is the
// only code path — besides routes/simulate.ts's event-driven deltas —
// allowed to write Network.risk/status/change, and it is deliberately
// gated behind an explicit POST rather than happening automatically on
// every GET (see lib/networkRisk.ts for why GET stays read-only).
networksRouter.post("/:displayId/recalculate", async (req, res) => {
  const network = await prisma.network.findUnique({
    where: { displayId: req.params.displayId },
    include: { entities: true },
  });
  if (!network) return res.status(404).json({ error: "Network not found" });

  const vendorRiskByAlias = await buildVendorRiskMap();
  const entityRisks = network.entities.map((e) => computeEntityRisk(e.alias, vendorRiskByAlias));
  const aggregate = computeNetworkRiskAggregate(entityRisks);

  if (!aggregate.calculable || aggregate.computedBaselineRisk === null) {
    return res.status(422).json({ error: "Not calculable", explanation: aggregate.explanation });
  }

  const newRisk = aggregate.computedBaselineRisk;
  const status = riskToStatus(newRisk);
  const change = newRisk - network.risk;

  const [updatedNetwork] = await prisma.$transaction([
    prisma.network.update({
      where: { id: network.id },
      data: { risk: newRisk, status, change, lastActivity: new Date() },
    }),
    prisma.networkRiskPoint.create({
      data: { networkId: network.id, label: `Recalculated: ${new Date().toISOString()}`, score: newRisk },
    }),
    prisma.riskEvent.create({
      data: {
        type: "network_recalculated",
        description: `Network risk explicitly recalculated from entity evidence: ${aggregate.explanation}`,
        scoreDelta: change,
      },
    }),
  ]);

  res.json({ network: updatedNetwork, aggregate });
});