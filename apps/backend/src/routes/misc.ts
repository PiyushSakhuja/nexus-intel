import { Router } from "express";
import crypto from "node:crypto";

import { prisma } from "../lib/prisma.js";

import {
  scoreListings,
  signalsToDisplayStrings,
  type ListingInput,
} from "../lib/riskEngine.js";

import {
  scoreAllWallets,
  walletSignalsToContributors,
  type WalletTransactionInput,
} from "../lib/walletRisk.js";

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

// GET /api/wallets — Blockchain Intelligence screen table.
//
// `risk` here used to be read straight off the stored Wallet.risk column,
// which is fake — see lib/walletRisk.ts header for exactly how (hand-typed
// for WALLET-W1..W5, seed-only jitter for WALLET-G1..G28). This now
// computes risk deterministically from real WalletTransaction rows via
// lib/walletRisk.ts, the blockchain-intelligence analogue of the listing
// risk engine. The response also distinguishes:
//   - `computed`   — the honest, transaction-derived risk + explanation
//   - `legacy`     — the untouched seed-time stored value, clearly labeled
//   - `dataQuality`— whether this wallet has ANY real transaction evidence
// so the frontend (and anyone reading the raw API) can never mistake
// seeded/synthetic demo numbers for a calculated result.
walletsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const [wallets, transactions] = await Promise.all([
      prisma.wallet.findMany(),
      prisma.walletTransaction.findMany(),
    ]);

    const walletRiskById = scoreAllWallets(
      wallets.map((w) => w.id),
      transactions
    );

    const out = wallets
      .map((w) => {
        const computed = walletRiskById.get(w.id)!;
        return {
          ...w,

          // Authoritative for anything presented as a live/calculated
          // metric. Falls back to the legacy stored risk ONLY when there
          // is literally no transaction evidence to compute from — and
          // even then it's clearly flagged via dataQuality/computed.calculable,
          // never silently presented as equivalent to a real calculation.
          risk: computed.calculable ? computed.score : w.risk,

          computed: {
            score: computed.score,
            calculable: computed.calculable,
            signals: computed.signals,
            evidence: computed.evidence,
            explanation: computed.explanation,
            contributors: walletSignalsToContributors(computed.signals),
          },

          dataQuality: computed.calculable
            ? ("real_transaction_data" as const)
            : ("no_transaction_data" as const),

          legacy: {
            risk: w.risk,
            txnCount: w.txnCount,
            entityCount: w.entityCount,
            totalVolume: w.totalVolume,
            note: "Seed-time stored values — not derived from WalletTransaction evidence. Prefer `computed` for anything presented to a user as a live/calculated metric.",
          },
        };
      })
      .sort((a, b) => b.risk - a.risk);

    res.json(out);
  })
);

// GET /api/wallets/:displayId — single wallet, full risk breakdown. Used
// by the Blockchain Intelligence screen's wallet detail panel to show the
// same explainable signals (transaction activity, transaction volume,
// linked entities, linked networks, final calculated score) that drove
// `computed.score` above — nothing here is recomputed differently, it's
// the same lib/walletRisk.ts output for just this one wallet.
walletsRouter.get(
  "/:displayId",
  asyncHandler(async (req, res) => {
    const wallet = await prisma.wallet.findUnique({
      where: { displayId: req.params.displayId },
    });
    if (!wallet) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    const transactions: WalletTransactionInput[] = await prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      include: { entity: true, network: true },
      orderBy: { occurredAt: "desc" },
    });

    const walletRiskById = scoreAllWallets([wallet.id], transactions);
    const computed = walletRiskById.get(wallet.id)!;

    res.json({
      ...wallet,
      risk: computed.calculable ? computed.score : wallet.risk,
      computed: {
        score: computed.score,
        calculable: computed.calculable,
        signals: computed.signals,
        evidence: computed.evidence,
        explanation: computed.explanation,
        contributors: walletSignalsToContributors(computed.signals),
      },
      dataQuality: computed.calculable ? ("real_transaction_data" as const) : ("no_transaction_data" as const),
      transactions: transactions.map((t: any) => ({
        id: t.id,
        direction: t.direction,
        amountBtcEq: t.amountBtcEq,
        occurredAt: t.occurredAt,
        entityAlias: t.entity?.alias ?? null,
        networkDisplayId: t.network?.displayId ?? null,
      })),
      legacy: {
        risk: wallet.risk,
        txnCount: wallet.txnCount,
        entityCount: wallet.entityCount,
        totalVolume: wallet.totalVolume,
        note: "Seed-time stored values — not derived from WalletTransaction evidence. Prefer `computed` for anything presented to a user as a live/calculated metric.",
      },
    });
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