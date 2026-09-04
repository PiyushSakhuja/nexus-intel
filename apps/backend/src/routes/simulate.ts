import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { getIo } from "../sockets/io.js";
import { computeSimulateScoreDelta } from "../lib/riskEngine.js";

export const simulateRouter = Router();

const CRITICAL_THRESHOLD = 80;

// POST /api/simulate/event
// Body: { networkDisplayId: string, entityDisplayId?: string }
//
// This is the "Simulate Incoming Intelligence" button. It runs the real
// pipeline end to end — no fake numbers, no frontend-only animation:
//
//   new event -> stored -> entity risk bumped -> network risk recalculated
//   -> risk point recorded -> threshold check -> alert created if crossed
//   -> everything broadcast live over Socket.IO for the Live Intelligence Feed
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

  // 1. New listing/transaction event detected
  const eventTypes = [
    { type: "listing_detected", description: "New listing detected on monitored source" },
    { type: "transaction_detected", description: "New blockchain transaction detected" },
  ];
  const chosen = eventTypes[Math.floor(Math.random() * eventTypes.length)];
  emit("event_detected", chosen);

  // 2. Entity correlation
  const entity =
    (entityDisplayId && (await prisma.entity.findUnique({ where: { displayId: entityDisplayId } }))) ??
    network.entities[0];

  if (entity) {
    emit("correlation", { entity: entity.alias, confidence: entity.confidence });
  }

  // 3. Risk bump — deterministic function of the correlated entity's own
  // (already-computed, stored) risk and confidence. See
  // riskEngine.ts#computeSimulateScoreDelta for the exact formula.
  const { delta: scoreDelta, explanation: deltaExplanation } = computeSimulateScoreDelta(
    entity ? { risk: entity.risk, confidence: entity.confidence } : null
  );
  const newNetworkRisk = Math.min(100, network.risk + scoreDelta);
  const status = newNetworkRisk >= 80 ? "CRITICAL" : newNetworkRisk >= 60 ? "HIGH" : newNetworkRisk >= 30 ? "MEDIUM" : "LOW";

  const riskEvent = await prisma.riskEvent.create({
    data: {
      entityId: entity?.id,
      type: chosen.type,
      description: `${chosen.description} — ${deltaExplanation}`,
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
  if (network.risk < CRITICAL_THRESHOLD && newNetworkRisk >= CRITICAL_THRESHOLD) {
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

  res.status(201).json({ riskEvent, network: updatedNetwork, alert });
});