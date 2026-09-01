import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const networksRouter = Router();

// GET /api/networks — emerging networks list (Overview page ranking)
networksRouter.get("/", async (_req, res) => {
  const networks = await prisma.network.findMany({
    include: { _count: { select: { entities: true } } },
    orderBy: { risk: "desc" },
  });
  res.json(networks);
});

// GET /api/networks/:displayId/trajectory — the early-warning risk-over-time
// chart, built from real NetworkRiskPoint rows instead of a hardcoded array.
networksRouter.get("/:displayId/trajectory", async (req, res) => {
  const network = await prisma.network.findUnique({
    where: { displayId: req.params.displayId },
    include: { riskPoints: { orderBy: { recordedAt: "asc" } } },
  });
  if (!network) return res.status(404).json({ error: "Network not found" });
  res.json(network);
});
