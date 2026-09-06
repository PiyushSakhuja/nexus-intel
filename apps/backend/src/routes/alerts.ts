import { Router } from "express";

import { prisma } from "../lib/prisma.js";
import { computeVendorRisk, type VendorRisk } from "../lib/vendorRisk.js";
import { computeEntityRisk } from "../lib/entityRisk.js";
import type { ListingInput } from "../lib/riskEngine.js";
import { logAudit, ipFromRequest } from "../lib/audit.js";
import { asyncHandler } from "../lib/asyncHandler.js";

export const alertsRouter = Router();

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

alertsRouter.get("/", async (_req, res) => {
  const [alerts, vendorRiskByAlias] = await Promise.all([
    prisma.alert.findMany({
      include: {
        network: true,
        entities: {
          include: {
            entity: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    buildVendorRiskMap(),
  ]);

  const calculatedAlerts = alerts.map((alert) => ({
    ...alert,

    entities: alert.entities.map((alertEntity) => {
      const entity = alertEntity.entity;
      const computed = computeEntityRisk(entity.alias, vendorRiskByAlias);

      return {
        ...alertEntity,

        entity: {
          ...entity,

          risk: computed.risk ?? entity.risk,
          confidence: computed.confidence ?? entity.confidence,
          riskChange: null,

          legacy: {
            risk: entity.risk,
            confidence: entity.confidence,
            riskChange: entity.riskChange,
            note: "Seed-time stored values — not derived from current listing evidence.",
          },
        },
      };
    }),
  }));

  res.json(calculatedAlerts);
});

// PATCH /api/alerts/:displayId/status — keyed by displayId ("ALT-089") for
// consistency with every other resource in this API (investigations,
// networks, entities, evidence all key their update/detail routes by
// displayId, never the internal cuid).
alertsRouter.patch("/:displayId/status", asyncHandler(async (req, res) => {
  const { status, reviewedBy } = req.body as { status?: string; reviewedBy?: string };
  const VALID = ["NEW", "REVIEWED", "RESOLVED"];
  if (!status || !VALID.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${VALID.join(", ")}` });
  }

  const existing = await prisma.alert.findUnique({ where: { displayId: req.params.displayId } });
  if (!existing) return res.status(404).json({ error: "Alert not found" });

  const alert = await prisma.alert.update({
    where: { id: existing.id },
    data: { status: status as any },
  });

  await logAudit({
    user: reviewedBy?.trim() || "System",
    action: `Alert marked ${status}`,
    resource: alert.displayId,
    type: "write",
    ip: ipFromRequest(req),
  });

  res.json(alert);
}));