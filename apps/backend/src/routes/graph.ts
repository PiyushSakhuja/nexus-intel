import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const graphRouter = Router();

// GET /api/graph — full node + edge set for the Network Graph screen
graphRouter.get("/", async (_req, res) => {
  const [nodes, edges] = await Promise.all([
    // Include the linked Entity's displayId so the frontend can navigate
    // straight to a real entity profile (/api/entities/:displayId) from a
    // graph node without a second lookup — GraphNode.entityId is the
    // internal Prisma cuid, not the human-readable displayId entities are
    // actually keyed by everywhere else in the API.
    prisma.graphNode.findMany({ include: { entity: { select: { displayId: true } } } }),
    prisma.graphEdge.findMany(),
  ]);
  res.json({ nodes, edges });
});

// GET /api/graph/:nodeId/expand — click-to-expand a node's direct relationships
graphRouter.get("/:nodeId/expand", async (req, res) => {
  const node = await prisma.graphNode.findUnique({
    where: { id: req.params.nodeId },
    include: {
      edgesFrom: { include: { to: true } },
      edgesTo: { include: { from: true } },
    },
  });
  if (!node) return res.status(404).json({ error: "Node not found" });
  res.json(node);
});