import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const entitiesRouter = Router();

// GET /api/entities — list, matches the Entities screen table
entitiesRouter.get("/", async (_req, res) => {
  const entities = await prisma.entity.findMany({
    include: { identifiers: true, network: true },
    orderBy: { risk: "desc" },
  });
  res.json(entities);
});

// GET /api/entities/:displayId — entity profile page
entitiesRouter.get("/:displayId", async (req, res) => {
  const entity = await prisma.entity.findUnique({
    where: { displayId: req.params.displayId },
    include: {
      identifiers: true,
      network: { include: { riskPoints: true } },
      alertLinks: { include: { alert: true } },
      investigationLinks: { include: { investigation: true } },
      events: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!entity) return res.status(404).json({ error: "Entity not found" });
  res.json(entity);
});
