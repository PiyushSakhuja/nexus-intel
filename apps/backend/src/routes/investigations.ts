import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { getIo } from "../sockets/io.js";
import { generateInvestigationAssessment } from "../lib/investigationAssessment.js";

export const investigationsRouter = Router();

investigationsRouter.get("/", async (_req, res) => {
  const investigations = await prisma.investigation.findMany({
    include: { _count: { select: { entities: true, evidence: true } } },
    orderBy: { updatedAt: "desc" },
  });
  res.json(investigations);
});

investigationsRouter.get("/:displayId", async (req, res) => {
  const inv = await prisma.investigation.findUnique({
    where: { displayId: req.params.displayId },
    include: {
      entities: { include: { entity: true } },
      evidence: true,
      timeline: { orderBy: { occurredAt: "asc" } },
      aiAssessments: { orderBy: { createdAt: "desc" } },
      network: true,
    },
  });
  if (!inv) return res.status(404).json({ error: "Investigation not found" });
  res.json(inv);
});

// POST /api/investigations/:displayId/ai-assessment
//
// The AI Assessment endpoint. Runs the full pipeline end to end:
//
//   real signals (related entities' risk/confidence, linked network risk,
//   timeline escalations, evidence verification) -> Gemini turns those
//   signals into a plain-English explanation + recommended next steps ->
//   stored as an AiAssessment row (score + signals + explanation, always
//   together so the explanation stays traceable to real numbers) ->
//   returned to the caller for display in WorkspaceScreen.
//
// Signals/score are computed deterministically in investigationAssessment.ts
// — Gemini only narrates them, it never invents the number itself. If
// Gemini is unreachable/unconfigured (no GEMINI_API_KEY), the assessment is
// still generated and stored, using a clearly-labeled deterministic
// fallback narrative (see `aiGenerated: false` in the response) instead of
// failing the request.
investigationsRouter.post("/:displayId/ai-assessment", async (req, res) => {
  const inv = await prisma.investigation.findUnique({
    where: { displayId: req.params.displayId },
    include: {
      entities: { include: { entity: true } },
      evidence: true,
      timeline: true,
      network: true,
    },
  });
  if (!inv) return res.status(404).json({ error: "Investigation not found" });

  const assessmentInput = {
    displayId: inv.displayId,
    title: inv.title,
    description: inv.description,
    priority: inv.priority,
    status: inv.status,
    entities: inv.entities.map((ie) => ({
      alias: ie.entity.alias,
      risk: ie.entity.risk,
      confidence: ie.entity.confidence,
      riskChange: ie.entity.riskChange,
    })),
    evidence: inv.evidence.map((e) => ({ status: e.status })),
    timeline: inv.timeline.map((t) => ({ type: t.type })),
    network: inv.network
      ? { displayId: inv.network.displayId, risk: inv.network.risk, change: inv.network.change, status: inv.network.status }
      : null,
  };

  const result = await generateInvestigationAssessment(assessmentInput);

  const assessment = await prisma.aiAssessment.create({
    data: {
      investigationId: inv.id,
      riskScore: result.riskScore,
      signals: result.signals,
      explanation: result.explanation,
      recommendedNext: JSON.stringify(result.recommendedNext),
    },
  });

  // Best-effort — mirrors simulate.ts's live-feed broadcast pattern. Socket
  // may not be initialized in some test contexts, so this is guarded.
  try {
    getIo().emit("intelligence-event", {
      type: "ai_assessment_generated",
      payload: { investigation: inv.displayId, riskScore: result.riskScore, aiGenerated: result.aiGenerated },
      at: new Date(),
    });
  } catch {
    // Socket.IO not initialized (e.g. in isolated tests) — safe to ignore.
  }

  res.status(201).json({ ...assessment, aiGenerated: result.aiGenerated });
});