import { Router } from "express";
import crypto from "node:crypto";
import { prisma } from "../lib/prisma.js";

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

listingsRouter.get("/", async (_req, res) => {
  res.json(await prisma.listing.findMany({ include: { source: true }, orderBy: { risk: "desc" } }));
});

auditRouter.get("/", async (_req, res) => {
  res.json(await prisma.auditLogEntry.findMany({ orderBy: { createdAt: "desc" }, take: 100 }));
});

sourcesRouter.get("/", async (_req, res) => {
  res.json(await prisma.source.findMany());
});