import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const alertsRouter = Router();

alertsRouter.get("/", async (_req, res) => {
  const alerts = await prisma.alert.findMany({
    include: { network: true, entities: { include: { entity: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(alerts);
});

alertsRouter.patch("/:id/status", async (req, res) => {
  const { status } = req.body; // "NEW" | "REVIEWED" | "RESOLVED"
  const alert = await prisma.alert.update({
    where: { id: req.params.id },
    data: { status },
  });
  res.json(alert);
});
