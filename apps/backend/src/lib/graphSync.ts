import type { PrismaClient } from "@prisma/client";
let graphSyncInFlight: Promise<{ nodeCount: number; edgeCount: number }> | null = null;

// Deterministic hash -> angle, so each entity always lands in the same
// visual position on the graph regardless of how many other entities
// exist or in what order they were created. This means adding entity #23
// later never reshuffles where entities #1-22 are drawn.
function hashToUnitInterval(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return (hash % 3600) / 3600; // 0..1
}

const CENTER_X = 450;
const CENTER_Y = 320;
const RADIUS = 260;

function positionForEntity(entityId: string): { x: number; y: number } {
  const angle = hashToUnitInterval(entityId) * 2 * Math.PI;
  return {
    x: Math.round(CENTER_X + RADIUS * Math.cos(angle)),
    y: Math.round(CENTER_Y + RADIUS * Math.sin(angle)),
  };
}

const entityGraphNodeId = (entityId: string) => `gph_${entityId}`;

// Rebuilds GraphNode/GraphEdge from the CURRENT set of entities every time
// it's called. Safe to call on every GET /api/graph request — upserts are
// idempotent, so nodes/edges that already match do nothing, and any newly
// added entity (from an ingestion pipeline, simulate route, etc.) gets a
// node the very next time the graph is requested, with no manual reseed.
export async function syncGraphFromEntities(prisma: PrismaClient): Promise<{ nodeCount: number; edgeCount: number }> {
  const allEntities = await prisma.entity.findMany({
    include: { identifiers: true },
  });

  // Edges are always fully recomputed below from current entity data, so
  // it's safe to clear them first rather than trying to diff old vs new.
  await prisma.graphEdge.deleteMany({});

  // Nodes with no entityId at all are leftover manual/demo scaffolding
  // (e.g. old hardcoded Wallet/Txn/Marketplace nodes) with nothing real
  // backing them — safe to remove. Entity-linked nodes are handled below
  // via upsert instead, so real data is never dropped.
  await prisma.graphNode.deleteMany({ where: { entityId: null } });

  // Track the ACTUAL node id each entity ends up with — for a
  // pre-existing entity this may be a preserved legacy id (e.g.
  // "gph_alias_x" from an old seed) rather than the freshly-predicted
  // "gph_<entityId>" format, since upserting on entityId updates the
  // existing row in place without renaming its primary key.
  const nodeIdByEntityId = new Map<string, string>();

  for (const entity of allEntities) {
    const { x, y } = positionForEntity(entity.id);
    const nodeId = entityGraphNodeId(entity.id);
    const node = await prisma.graphNode.upsert({
      where: { entityId: entity.id },
      update: { label: entity.alias, risk: entity.risk, x, y },
      create: {
        id: nodeId,
        label: entity.alias,
        type: "ENTITY",
        risk: entity.risk,
        x,
        y,
        entityId: entity.id,
      },
    });
    nodeIdByEntityId.set(entity.id, node.id);
  }

  // Group by shared ships_from value. (Marketplace-based correlation was
  // tried and dropped: with only 2 marketplaces across 22 entities, nearly
  // every pair shares one, producing a near-complete graph — technically
  // correct but useless for investigation. Shipping origin is a much
  // rarer, more meaningful signal.)
  const shippingGroups = new Map<string, string[]>();

  for (const entity of allEntities) {
    for (const ident of entity.identifiers) {
      if (ident.type === "ships_from") {
        if (!shippingGroups.has(ident.value)) shippingGroups.set(ident.value, []);
        shippingGroups.get(ident.value)!.push(entity.id);
      }
    }
  }

  const edgeSourcesToProcess: [string, Map<string, string[]>][] = [
    ["Shared Shipping Origin", shippingGroups],
  ];

  const seenPairs = new Set<string>();
  let edgeCount = 0;

  for (const [labelPrefix, groups] of edgeSourcesToProcess) {
    for (const [groupValue, entityIds] of groups) {
      const uniqueIds = [...new Set(entityIds)];
      if (uniqueIds.length < 2) continue;

      for (let a = 0; a < uniqueIds.length; a++) {
        for (let b = a + 1; b < uniqueIds.length; b++) {
          const fromId = nodeIdByEntityId.get(uniqueIds[a])!;
          const toId = nodeIdByEntityId.get(uniqueIds[b])!;
          const pairKey = [fromId, toId].sort().join("|");
          if (seenPairs.has(pairKey)) continue;
          seenPairs.add(pairKey);

          const id = `gph_edge_${fromId}_${toId}`;
          const label = `${labelPrefix}: ${groupValue}`;
          await prisma.graphEdge.upsert({
            where: { id },
            update: { label },
            create: { id, fromId, toId, label },
          });
          edgeCount++;
        }
      }
    }
  }

  return { nodeCount: allEntities.length, edgeCount };
}
