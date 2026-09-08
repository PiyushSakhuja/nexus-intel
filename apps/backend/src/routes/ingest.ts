import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { getIo } from "../sockets/io.js";
import { runIntelligencePipeline } from "../lib/intelligencePipeline.js";
import { logAudit, ipFromRequest } from "../lib/audit.js";
import { asyncHandler } from "../lib/asyncHandler.js";

export const ingestRouter = Router();

// POST /api/ingest/event
// Header: x-ingest-key: <INGEST_SECRET_KEY>
// Body:   { networkDisplayId: string, entityDisplayId?: string, eventType?: string, description?: string }
//
// This is the real push-ingestion endpoint referenced in routes/simulate.ts
// and lib/intelligencePipeline.ts ("routes/ingest.ts, coming next"). It's
// the network-facing counterpart to the "Simulate Incoming Intelligence"
// button: same pipeline, same response shape, but:
//
//   1. Authenticated with a shared secret (x-ingest-key) instead of a user
//      session, since the caller is an automated producer process, not a
//      logged-in investigator.
//   2. Takes eventType/description from the caller instead of picking one
//      deterministically — the producer's staging pool already knows what
//      kind of event each row represents.
//   3. Logs "Live Intelligence Ingested" (attributed to "Producer") rather
//      than "Simulated Incoming Intelligence", so the audit trail can tell
//      real pushed events apart from manual demo clicks.
//
// Everything else — resolving the network/entity, correlation, risk
// recalculation, alerting, wallet evidence, Socket.IO broadcast — is
// identical to /api/simulate/event because both call the same
// runIntelligencePipeline().
ingestRouter.post("/event", asyncHandler(async (req, res) => {
  const expectedKey = process.env.INGEST_SECRET_KEY;
  if (!expectedKey) {
    return res.status(500).json({ error: "INGEST_SECRET_KEY is not configured on the server" });
  }

  const providedKey = req.header("x-ingest-key");
  if (!providedKey || providedKey !== expectedKey) {
    return res.status(401).json({ error: "Invalid or missing ingestion key" });
  }

  const { networkDisplayId, entityDisplayId, eventType, description } = req.body as {
    networkDisplayId?: string;
    entityDisplayId?: string;
    eventType?: string;
    description?: string;
  };

  if (!networkDisplayId || !networkDisplayId.trim()) {
    return res.status(400).json({ error: "networkDisplayId is required" });
  }

  const io = getIo();
  const emit = (type: string, payload: unknown) => io.emit("intelligence-event", { type, payload, at: new Date() });

  const network = await prisma.network.findUnique({
    where: { displayId: networkDisplayId },
    include: { entities: true },
  });
  if (!network) return res.status(404).json({ error: "Network not found" });

  // Event label: caller-supplied (the staging pool row already knows what
  // it is). Falls back to the same default the "Simulate" button starts
  // from if the row didn't carry one.
  const chosen = {
    type: eventType?.trim() || "listing_detected",
    description: description?.trim() || "New listing detected on monitored source",
  };
  emit("event_detected", chosen);

  const entity =
    (entityDisplayId && (await prisma.entity.findUnique({ where: { displayId: entityDisplayId } }))) ??
    network.entities[0] ??
    null;

  const result = await runIntelligencePipeline({
    network,
    entity: null,
    triggerType: chosen.type,
    triggerDescription: chosen.description,
    ip: ipFromRequest(req),
  });

  await logAudit({
    user: "Producer",
    action: "Live Intelligence Ingested",
    resource: network.displayId,
    type: "system",
    ip: ipFromRequest(req),
  });

  res.status(201).json({
    riskEvent: result.riskEvent,
    network: result.network,
    alert: result.alert,
    deltaInputSource: result.deltaInputSource,
    riskChange: result.riskChange,
    wallet: result.wallet,
  });
}));
