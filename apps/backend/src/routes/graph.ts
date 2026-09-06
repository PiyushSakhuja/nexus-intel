import { Router } from "express";

import { prisma } from "../lib/prisma.js";

import { syncGraphFromEntities } from "../lib/graphSync.js";

export const graphRouter = Router();

// GET /api/graph — full node + edge set for the Network Graph screen
//
// Rebuilds GraphNode/GraphEdge from whatever entities currently exist
// before responding, so any entity added later (via ingestion, simulate
// events, etc.) shows up automatically on the very next graph load — no
// manual reseed required. Mirrors the "compute fresh on GET" pattern used
// for network risk in routes/networks.ts.
graphRouter.get("/", async (_req, res) => {
  await syncGraphFromEntities(prisma);

  const [nodes, edges] = await Promise.all([
    prisma.graphNode.findMany(),
    prisma.graphEdge.findMany(),
  ]);

  // GraphNode only stores entityId (the entity's internal cuid), not its
  // human-readable displayId slug (e.g. "cerberus"). Without this, clicking
  // a node's "View Full Profile" button had nothing but the graph node's
  // OWN id to work with, which isn't a valid entity lookup key at all and
  // produced a 404 against /api/entities/:displayId. Attaching displayId
  // here — computed on the fly, no schema change needed — fixes that.
  const entityIds = nodes
    .map((n) => n.entityId)
    .filter((id): id is string => !!id);

  const entities = entityIds.length
    ? await prisma.entity.findMany({
        where: {
          id: {
            in: entityIds,
          },
        },
        select: {
          id: true,
          displayId: true,
        },
      })
    : [];

  const displayIdByEntityId = new Map(
    entities.map((e) => [e.id, e.displayId])
  );

  const enrichedNodes = nodes.map((n) =>
    n.entityId
      ? {
          ...n,
          displayId:
            displayIdByEntityId.get(n.entityId) ?? null,
        }
      : n
  );

  res.json({
    nodes: enrichedNodes,
    edges,
  });
});

// GET /api/graph/:nodeId/expand — click-to-expand a node's direct relationships
graphRouter.get("/:nodeId/expand", async (req, res) => {
  const node = await prisma.graphNode.findUnique({
    where: {
      id: req.params.nodeId,
    },
    include: {
      edgesFrom: {
        include: {
          to: true,
        },
      },
      edgesTo: {
        include: {
          from: true,
        },
      },
    },
  });

  if (!node) {
    return res.status(404).json({
      error: "Node not found",
    });
  }

  res.json(node);
});