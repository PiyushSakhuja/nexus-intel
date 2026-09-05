import { Router } from "express";

import { prisma } from "../lib/prisma.js";
import { computeVendorRisk, type VendorRisk } from "../lib/vendorRisk.js";
import { computeEntityRisk } from "../lib/entityRisk.js";
import type { ListingInput } from "../lib/riskEngine.js";

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

alertsRouter.patch("/:id/status", async (req, res) => {
  const { status } = req.body;

  const alert = await prisma.alert.update({
    where: { id: req.params.id },
    data: { status },
  });

  res.json(alert);
});