import { Router } from "express";
import crypto from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { scoreListings, signalsToDisplayStrings, type ListingInput } from "../lib/riskEngine.js";

export const evidenceRouter = Router();
export const walletsRouter = Router();
export const listingsRouter = Router();
export const auditRouter = Router();
export const sourcesRouter = Router();

evidenceRouter.get("/", async (_req, res) => {
  res.json(await prisma.evidenceRecord.findMany({
    include: { source: true, investigation: true },
    orderBy: { createdAt: "desc" },
  }));
});

// POST /api/evidence — actually computes a SHA-256 hash of the submitted
// content, so the "chain of custody" claim is real, not decorative.
evidenceRouter.post("/", async (req, res) => {
  const { type, content, uploadedBy, investigationId, sourceId } = req.body;
  const hash = crypto.createHash("sha256").update(content ?? "").digest("hex").toUpperCase();
  const count = await prisma.evidenceRecord.count();
  const evidence = await prisma.evidenceRecord.create({
    data: {
      displayId: `EV-${1000 + count}`,
      type,
      hash,
      uploadedBy,
      status: "PENDING",
      investigationId,
      sourceId,
    },
  });
  res.status(201).json(evidence);
});

walletsRouter.get("/", async (_req, res) => {
  res.json(await prisma.wallet.findMany({ orderBy: { risk: "desc" } }));
});

// GET /api/listings — risk/signals are NOT read from the stored columns.
// They're recomputed here, at request time, from riskEngine.ts against the
// current listing population, so the API can never drift from the scorer
// (the stored `risk`/`signals` columns are effectively a cache last written
// by prisma/seed.ts; this route treats riskEngine.ts as the source of truth
// instead of duplicating any scoring logic locally).
listingsRouter.get("/", async (_req, res) => {
  const listings = await prisma.listing.findMany({ include: { source: true } });

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
  const scored = scoreListings(inputs);

  const withLiveRisk = listings
    .map((l) => {
      const result = scored.get(l.id);
      if (!result) return l; // should never happen — every input has a score
      return { ...l, risk: result.score, signals: signalsToDisplayStrings(result.signals) };
    })
    .sort((a, b) => b.risk - a.risk);

  res.json(withLiveRisk);
});

auditRouter.get("/", async (_req, res) => {
  res.json(await prisma.auditLogEntry.findMany({ orderBy: { createdAt: "desc" }, take: 100 }));
});

sourcesRouter.get("/", async (_req, res) => {
  res.json(await prisma.source.findMany());
});