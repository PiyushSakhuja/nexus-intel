import { Router } from "express";
import crypto from "node:crypto";

import { prisma } from "../lib/prisma.js";

import {
  scoreListings,
  signalsToDisplayStrings,
  type ListingInput,
} from "../lib/riskEngine.js";

import {
  logAudit,
  ipFromRequest,
} from "../lib/audit.js";

import { asyncHandler } from "../lib/asyncHandler.js";

export const evidenceRouter = Router();

export const walletsRouter = Router();

export const listingsRouter = Router();

export const auditRouter = Router();

export const sourcesRouter = Router();

evidenceRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(
      await prisma.evidenceRecord.findMany({
        include: {
          source: true,
          investigation: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      })
    );
  })
);

// POST /api/evidence — actually computes a SHA-256 hash of the submitted
// content, so the "chain of custody" claim is real, not decorative.
evidenceRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const {
      type,
      content,
      uploadedBy,
      investigationId,
      sourceId,
    } = req.body;

    if (!content || !String(content).trim()) {
      return res.status(400).json({
        error: "content is required — it's what gets hashed",
      });
    }

    if (!investigationId) {
      return res.status(400).json({
        error: "investigationId is required",
      });
    }

    const hash = crypto
      .createHash("sha256")
      .update(content ?? "")
      .digest("hex")
      .toUpperCase();

    const count = await prisma.evidenceRecord.count();

    let evidence;

    try {
      evidence = await prisma.evidenceRecord.create({
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
    } catch (err) {
      return res.status(400).json({
        error: `Could not create evidence record: ${
          (err as Error).message
        }`,
      });
    }

    await logAudit({
      user: uploadedBy || "System",
      action: "Added Evidence",
      resource: evidence.displayId,
      type: "write",
      ip: ipFromRequest(req),
    });

    res.status(201).json(evidence);
  })
);

// PATCH /api/evidence/:displayId/status — investigator verification action.
//
// This is what makes EvidenceStatus (VERIFIED/PENDING/REJECTED) something an
// investigator can actually change, rather than a value only ever set once
// at creation/seed time.
evidenceRouter.patch(
  "/:displayId/status",
  asyncHandler(async (req, res) => {
    const {
      status,
      reviewedBy,
    } = req.body as {
      status?: string;
      reviewedBy?: string;
    };

    const VALID = [
      "VERIFIED",
      "PENDING",
      "REJECTED",
    ];

    if (!status || !VALID.includes(status)) {
      return res.status(400).json({
        error: `status must be one of ${VALID.join(", ")}`,
      });
    }

    const existing =
      await prisma.evidenceRecord.findUnique({
        where: {
          displayId: req.params.displayId,
        },
      });

    if (!existing) {
      return res.status(404).json({
        error: "Evidence record not found",
      });
    }

    const evidence =
      await prisma.evidenceRecord.update({
        where: {
          id: existing.id,
        },
        data: {
          status: status as any,
        },
      });

    await logAudit({
      user: reviewedBy || "System",
      action: `Evidence marked ${status}`,
      resource: evidence.displayId,
      type: "write",
      ip: ipFromRequest(req),
    });

    res.json(evidence);
  })
);

walletsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(
      await prisma.wallet.findMany({
        orderBy: {
          risk: "desc",
        },
      })
    );
  })
);

// GET /api/listings — risk/signals are NOT read from the stored columns.
//
// They're recomputed here, at request time, from riskEngine.ts against the
// current listing population, so the API can never drift from the scorer
// (the stored `risk`/`signals` columns are effectively a cache last written
// by prisma/seed.ts; this route treats riskEngine.ts as the source of truth
// instead of duplicating any scoring logic locally).
listingsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const listings =
      await prisma.listing.findMany({
        include: {
          source: true,
        },
      });

    const inputs: ListingInput[] =
      listings.map((l) => ({
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

        if (!result) {
          return l;
        }

        return {
          ...l,
          risk: result.score,
          signals: signalsToDisplayStrings(
            result.signals
          ),
        };
      })
      .sort((a, b) => b.risk - a.risk);

    res.json(withLiveRisk);
  })
);

auditRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(
      await prisma.auditLogEntry.findMany({
        orderBy: {
          createdAt: "desc",
        },
        take: 100,
      })
    );
  })
);

sourcesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(
      await prisma.source.findMany({
        include: {
          _count: {
            select: {
              listings: true,
            },
          },
        },
      })
    );
  })
);