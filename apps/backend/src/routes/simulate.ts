import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { getIo } from "../sockets/io.js";
import { computeSimulateScoreDelta } from "../lib/riskEngine.js";
import { riskToStatus, RISK_THRESHOLDS } from "../lib/riskStatus.js";
import { computeVendorRisk } from "../lib/vendorRisk.js";
import { computeEntityRisk } from "../lib/entityRisk.js";
import type { ListingInput } from "../lib/riskEngine.js";

export const simulateRouter = Router();

// POST /api/simulate/event
// Body: { networkDisplayId: string, entityDisplayId?: string }
//
// This is the "Simulate Incoming Intelligence" button. It runs the real
// pipeline end to end:
//
//   new event -> stored -> entity evidence correlated -> network risk
//   recalculated -> risk point recorded -> threshold check -> alert created
//   if crossed -> everything broadcast live over Socket.IO.
//
// CHANGES from the previous version:
//   1. Status thresholds now come from lib/riskStatus.ts instead of being
//      duplicated inline here, so this file can no longer disagree with
//      routes/networks.ts about what risk number means "HIGH" or "CRITICAL".
//   2. The delta input now PREFERS the correlated entity's COMPUTED risk/
//      confidence (real listing evidence via alias-correlated vendor — see
//      lib/entityRisk.ts) and only falls back to the entity's stored/legacy
//      risk/confidence when no listing evidence exists to correlate
//      against. The response reports which source was actually used
//      (`deltaInputSource`) so this is never silently ambiguous.
//   3. The only remaining Math.random() in this file — picking which of the
//      two cosmetic event-type labels ("listing_detected" vs
//      "transaction_detected") to show — has been replaced with a
//      deterministic selection based on the real accumulated RiskEvent
//      count, so no randomness remains anywhere in this route.
simulateRouter.post("/event", async (req, res) => {
  const { networkDisplayId, entityDisplayId } = req.body as {
    networkDisplayId: string;
    entityDisplayId?: string;
  };

  const io = getIo();
  const emit = (type: string, payload: unknown) => io.emit("intelligence-event", { type, payload, at: new Date() });

  const network = await prisma.network.findUnique({
    where: { displayId: networkDisplayId },
    include: { entities: true },
  });
  if (!network) return res.status(404).json({ error: "Network not found" });

  // 1. New listing/transaction event detected. Deterministic selection —
  // alternates based on the real total RiskEvent count so far, rather than
  // Math.random().
  const eventTypes = [
    { type: "listing_detected", description: "New listing detected on monitored source" },
    { type: "transaction_detected", description: "New blockchain transaction detected" },
  ];
  const priorEventCount = await prisma.riskEvent.count();
  const chosen = eventTypes[priorEventCount % eventTypes.length];
  emit("event_detected", chosen);

  // 2. Entity correlation
  const entity =
    (entityDisplayId && (await prisma.entity.findUnique({ where: { displayId: entityDisplayId } }))) ??
    network.entities[0];

  if (entity) {
    emit("correlation", { entity: entity.alias, confidence: entity.confidence });
  }

  // 3. Risk bump — deterministic function of the correlated entity's risk
  // and confidence. Prefers computed (listing-evidence-derived) values;
  // falls back to stored/legacy only when no evidence exists to correlate.
  let deltaInput: { risk: number; confidence: number } | null = null;
  let deltaInputSource: "computed" | "legacy" | "none" = "none";
  if (entity) {
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
    const vendorRiskByAlias = computeVendorRisk(inputs);
    const computed = computeEntityRisk(entity.alias, vendorRiskByAlias);
    if (computed.risk !== null && computed.confidence !== null) {
      deltaInput = { risk: computed.risk, confidence: computed.confidence };
      deltaInputSource = "computed";
    } else {
      deltaInput = { risk: entity.risk, confidence: entity.confidence };
      deltaInputSource = "legacy";
    }
  }

  const { delta: scoreDelta, explanation: deltaExplanation } = computeSimulateScoreDelta(deltaInput);
  const newNetworkRisk = Math.min(100, network.risk + scoreDelta);
  const status = riskToStatus(newNetworkRisk);

  const riskEvent = await prisma.riskEvent.create({
    data: {
      entityId: entity ? entity.id : undefined,
      type: chosen.type,
      description: `${chosen.description} — ${deltaExplanation} (delta input: ${deltaInputSource})`,
      scoreDelta,
    },
  });

  const updatedNetwork = await prisma.network.update({
    where: { id: network.id },
    data: {
      risk: newNetworkRisk,
      change: newNetworkRisk - network.risk,
      status,
      lastActivity: new Date(),
    },
  });

  await prisma.networkRiskPoint.create({
    data: { networkId: network.id, label: new Date().toISOString(), score: newNetworkRisk },
  });

  emit("risk_updated", { network: network.displayId, from: network.risk, to: newNetworkRisk });

  // 4. Threshold check -> alert generation (the "killer moment")
  let alert = null;
  if (network.risk < RISK_THRESHOLDS.CRITICAL && newNetworkRisk >= RISK_THRESHOLDS.CRITICAL) {
    const count = await prisma.alert.count();
    alert = await prisma.alert.create({
      data: {
        displayId: `ALT-${100 + count}`,
        severity: newNetworkRisk,
        title: `Network ${network.displayId} crossed critical risk threshold`,
        reason: `Risk escalated to ${newNetworkRisk} following ${chosen.description.toLowerCase()} and entity correlation`,
        status: "NEW",
        networkId: network.id,
        ...(entity ? { entities: { create: { entityId: entity.id } } } : {}),
      },
    });
    emit("alert_generated", alert);
  }

  res.status(201).json({ riskEvent, network: updatedNetwork, alert, deltaInputSource });
});