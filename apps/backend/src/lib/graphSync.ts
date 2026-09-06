import type { PrismaClient } from "@prisma/client";
let graphSyncInFlight: Promise<{ nodeCount: number; edgeCount: number }> | null = null;

// Deterministic hash -> angle, so each node always lands in the same
// visual position on the graph regardless of how many other nodes exist or
// in what order they were created. This means adding entity #23 (or
// listing #9, wallet #4, etc.) later never reshuffles where the existing
// nodes are drawn. Works for any node id, not just entities.
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

function positionForNode(nodeId: string): { x: number; y: number } {
  const angle = hashToUnitInterval(nodeId) * 2 * Math.PI;
  return {
    x: Math.round(CENTER_X + RADIUS * Math.cos(angle)),
    y: Math.round(CENTER_Y + RADIUS * Math.sin(angle)),
  };
}

const entityGraphNodeId = (entityId: string) => `gph_${entityId}`;
// Deterministic, collision-safe ids for the non-entity node types. Each of
// these corresponds to a real DB record (a Listing row, a Wallet row, a
// WalletTransaction row) or a distinct Listing.marketplace value actually
// present in the data — never a hardcoded/invented id.
const marketGraphNodeId = (marketplace: string) =>
  `gph_market_${marketplace.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
const listingGraphNodeId = (listingId: string) => `gph_listing_${listingId}`;
const walletGraphNodeId = (walletId: string) => `gph_wallet_${walletId}`;
const txnGraphNodeId = (txnId: string) => `gph_txn_${txnId}`;

// Rebuilds GraphNode/GraphEdge from the CURRENT set of entities, listings,
// wallets, and wallet transactions every time it's called. Safe to call on
// every GET /api/graph request — upserts are idempotent, so nodes/edges
// that already match do nothing, and anything newly added (via ingestion,
// simulate events, etc.) gets a node the very next time the graph is
// requested, with no manual reseed.
//
// IMPORTANT: this used to delete every GraphNode with entityId === null on
// every call, on the assumption that a null entityId meant "leftover
// manual/demo scaffolding." That assumption was wrong — per schema.prisma,
// entityId === null is also the CORRECT, intentional shape for every
// non-entity node type (Market/Listing/Wallet/Txn), since those aren't
// backed by an Entity row at all. That delete was silently wiping real
// marketplace/listing/wallet/txn nodes (e.g. Hansa, Valhalla, and their
// listings) on every single graph load, before they ever had a chance to
// be synced — because nothing synced them in the first place. Both halves
// of that bug are fixed below: real nodes are now synced for every backed
// type, and only nodes with NO backing row of any kind are removed.
export async function syncGraphFromEntities(prisma: PrismaClient): Promise<{ nodeCount: number; edgeCount: number }> {
  const [allEntities, allListings, allWallets, allWalletTxns] = await Promise.all([
    prisma.entity.findMany({ include: { identifiers: true } }),
    prisma.listing.findMany(),
    prisma.wallet.findMany(),
    prisma.walletTransaction.findMany(),
  ]);

  // Edges are always fully recomputed below from current data, so it's
  // safe to clear them first rather than trying to diff old vs new.
  await prisma.graphEdge.deleteMany({});

  // Tracks every node id this sync pass actually produced from a real row
  // — across every node type. Used below to remove nodes that no longer
  // have ANY backing record (e.g. a Listing that was deleted), without
  // touching anything that's still real. Nothing added to this set is
  // invented — it's exactly "one id per real row we just upserted."
  const liveNodeIds = new Set<string>();

  // ── Entities ──────────────────────────────────────────────────────────
  const nodeIdByEntityId = new Map<string, string>();

  for (const entity of allEntities) {
    const { x, y } = positionForNode(entity.id);
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
    liveNodeIds.add(node.id);
  }

  // ── Marketplaces (Hansa, Valhalla, ...) ──────────────────────────────────
  // There's no dedicated Market table — Listing.marketplace is a free-text
  // field — so a Market node is created for each DISTINCT non-null
  // marketplace value actually present on a real Listing row, never a
  // hardcoded name. Its risk is the plain average of that marketplace's
  // own real Listing.risk values: an aggregate of numbers that already
  // exist, not a new scoring model.
  const listingsByMarketplace = new Map<string, typeof allListings>();
  for (const listing of allListings) {
    if (!listing.marketplace) continue;
    if (!listingsByMarketplace.has(listing.marketplace)) listingsByMarketplace.set(listing.marketplace, []);
    listingsByMarketplace.get(listing.marketplace)!.push(listing);
  }

  const marketNodeIdByName = new Map<string, string>();
  for (const [marketplace, marketListings] of listingsByMarketplace) {
    const nodeId = marketGraphNodeId(marketplace);
    const avgRisk = Math.round(
      marketListings.reduce((sum, l) => sum + l.risk, 0) / marketListings.length
    );
    const { x, y } = positionForNode(nodeId);
    await prisma.graphNode.upsert({
      where: { id: nodeId },
      update: { label: marketplace, risk: avgRisk, x, y },
      create: { id: nodeId, label: marketplace, type: "MARKET", risk: avgRisk, x, y },
    });
    marketNodeIdByName.set(marketplace, nodeId);
    liveNodeIds.add(nodeId);
  }

  // ── Listings ──────────────────────────────────────────────────────────
  const listingNodeIdByListingId = new Map<string, string>();
  for (const listing of allListings) {
    const nodeId = listingGraphNodeId(listing.id);
    const { x, y } = positionForNode(nodeId);
    const label = listing.title ?? listing.displayId;
    await prisma.graphNode.upsert({
      where: { id: nodeId },
      update: { label, risk: listing.risk, x, y },
      create: { id: nodeId, label, type: "LISTING", risk: listing.risk, x, y },
    });
    listingNodeIdByListingId.set(listing.id, nodeId);
    liveNodeIds.add(nodeId);
  }

  // ── Wallets ───────────────────────────────────────────────────────────
  const walletNodeIdByWalletId = new Map<string, string>();
  for (const wallet of allWallets) {
    const nodeId = walletGraphNodeId(wallet.id);
    const { x, y } = positionForNode(nodeId);
    await prisma.graphNode.upsert({
      where: { id: nodeId },
      update: { label: wallet.displayId, risk: wallet.risk, x, y },
      create: { id: nodeId, label: wallet.displayId, type: "WALLET", risk: wallet.risk, x, y },
    });
    walletNodeIdByWalletId.set(wallet.id, nodeId);
    liveNodeIds.add(nodeId);
  }

  // ── Wallet transactions ("Txn" node type) ────────────────────────────────
  // WalletTransaction has no risk column of its own, so its node reuses
  // its own Wallet's real, already-computed risk rather than inventing a
  // per-transaction score.
  const txnNodeIdByTxnId = new Map<string, string>();
  const walletById = new Map(allWallets.map((w) => [w.id, w]));
  for (const txn of allWalletTxns) {
    const wallet = walletById.get(txn.walletId);
    if (!wallet) continue; // dangling FK — skip rather than crash
    const nodeId = txnGraphNodeId(txn.id);
    const { x, y } = positionForNode(nodeId);
    const label = `${txn.direction === "INBOUND" ? "In" : "Out"} ${txn.amountBtcEq} BTC-eq`;
    await prisma.graphNode.upsert({
      where: { id: nodeId },
      update: { label, risk: wallet.risk, x, y },
      create: { id: nodeId, label, type: "TXN", risk: wallet.risk, x, y },
    });
    txnNodeIdByTxnId.set(txn.id, nodeId);
    liveNodeIds.add(nodeId);
  }

  // NOTE: there is no Communication/Comm model in schema.prisma, so no
  // "comm" nodes are synced here. Adding them would mean fabricating node
  // data with no backing record, which is exactly what this fix removes
  // elsewhere — a real fix for "comm" nodes needs a real comm data source
  // added to the schema first.

  // Remove any node with NO backing row of any kind (a leftover demo node,
  // or a real record that was since deleted). Nodes still backed by a
  // current row — of ANY type — are never touched.
  const allCurrentNodes = await prisma.graphNode.findMany({ select: { id: true } });
  const staleNodeIds = allCurrentNodes.map((n) => n.id).filter((id) => !liveNodeIds.has(id));
  if (staleNodeIds.length) {
    await prisma.graphNode.deleteMany({ where: { id: { in: staleNodeIds } } });
  }

  // ── Edges ─────────────────────────────────────────────────────────────
  const seenEdgeKeys = new Set<string>();
  let edgeCount = 0;

  async function upsertEdge(fromId: string, toId: string, label: string) {
    // Dedupe by (unordered pair + label) rather than just the pair, since
    // there are now several distinct real relationship kinds that could in
    // principle touch the same two nodes.
    const dedupeKey = `${[fromId, toId].sort().join("|")}|${label}`;
    if (seenEdgeKeys.has(dedupeKey)) return;
    seenEdgeKeys.add(dedupeKey);
    const id = `gph_edge_${fromId}_${toId}_${label.replace(/\s+/g, "_")}`;
    await prisma.graphEdge.upsert({
      where: { id },
      update: { label },
      create: { id, fromId, toId, label },
    });
    edgeCount++;
  }

  // Entity <-> Entity: shared shipping origin. (Marketplace-based
  // correlation was tried and dropped: with only 2 marketplaces across 22
  // entities, nearly every pair shares one, producing a near-complete
  // graph — technically correct but useless for investigation. Shipping
  // origin is a much rarer, more meaningful signal.)
  const shippingGroups = new Map<string, string[]>();
  for (const entity of allEntities) {
    for (const ident of entity.identifiers) {
      if (ident.type === "ships_from") {
        if (!shippingGroups.has(ident.value)) shippingGroups.set(ident.value, []);
        shippingGroups.get(ident.value)!.push(entity.id);
      }
    }
  }
  for (const [shipsFrom, entityIds] of shippingGroups) {
    const uniqueIds = [...new Set(entityIds)];
    if (uniqueIds.length < 2) continue;
    for (let a = 0; a < uniqueIds.length; a++) {
      for (let b = a + 1; b < uniqueIds.length; b++) {
        await upsertEdge(
          nodeIdByEntityId.get(uniqueIds[a])!,
          nodeIdByEntityId.get(uniqueIds[b])!,
          `Shared Shipping Origin: ${shipsFrom}`
        );
      }
    }
  }

  // Listing -> Market: which marketplace a listing actually appeared on.
  for (const listing of allListings) {
    if (!listing.marketplace) continue;
    const marketNodeId = marketNodeIdByName.get(listing.marketplace);
    const listingNodeId = listingNodeIdByListingId.get(listing.id);
    if (marketNodeId && listingNodeId) {
      await upsertEdge(listingNodeId, marketNodeId, "Listed On");
    }
  }

  // Listing -> Entity: Listing.vendorAlias is documented in schema.prisma
  // as matching Entity.alias for the listing's vendor — the same
  // correlation key lib/vendorRisk.ts already relies on — so this links
  // real, already-established vendor identity, not a guessed relationship.
  const entityIdByAlias = new Map(allEntities.map((e) => [e.alias, e.id]));
  for (const listing of allListings) {
    if (!listing.vendorAlias) continue;
    const vendorEntityId = entityIdByAlias.get(listing.vendorAlias);
    const listingNodeId = listingNodeIdByListingId.get(listing.id);
    if (vendorEntityId && listingNodeId) {
      await upsertEdge(listingNodeId, nodeIdByEntityId.get(vendorEntityId)!, "Vendor");
    }
  }

  // WalletTransaction -> Wallet (always), and -> Entity when the
  // transaction carries a real entityId.
  for (const txn of allWalletTxns) {
    const txnNodeId = txnNodeIdByTxnId.get(txn.id);
    const walletNodeId = walletNodeIdByWalletId.get(txn.walletId);
    if (!txnNodeId || !walletNodeId) continue;
    await upsertEdge(txnNodeId, walletNodeId, "On Wallet");
    if (txn.entityId) {
      const entityNodeId = nodeIdByEntityId.get(txn.entityId);
      if (entityNodeId) await upsertEdge(txnNodeId, entityNodeId, "Transacted By");
    }
  }

  return { nodeCount: liveNodeIds.size, edgeCount };
}