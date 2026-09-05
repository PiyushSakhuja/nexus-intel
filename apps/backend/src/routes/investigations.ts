import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { getIo } from "../sockets/io.js";
import { generateInvestigationAssessment } from "../lib/investigationAssessment.js";
import { DEFAULT_MODEL, MODEL_OPTIONS, type SupportedModel } from "../lib/llmClient.js";

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
// Accepts an optional JSON body: { model?: SupportedModel }
// Defaults to DEFAULT_MODEL (openai/gpt-oss-120b via Groq) if omitted.
//
// Runs the full pipeline end to end:
//   real signals -> selected LLM narrates them -> stored as AiAssessment row
//   -> returned to the caller for display in WorkspaceScreen.
//
// Signals/score are computed deterministically — the LLM only narrates them,
// it never invents the number itself. If the LLM is unreachable/unconfigured,
// the assessment is still generated and stored using a clearly-labeled
// deterministic fallback narrative (aiGenerated: false).
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

  // Validate requested model — fall back to default if unrecognised.
  const requestedModel = req.body?.model as string | undefined;
  const validModels = MODEL_OPTIONS.map((m) => m.value);
  const model: SupportedModel =
    requestedModel && validModels.includes(requestedModel as SupportedModel)
      ? (requestedModel as SupportedModel)
      : DEFAULT_MODEL;

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

  const result = await generateInvestigationAssessment(assessmentInput, model);

  const assessment = await prisma.aiAssessment.create({
    data: {
      investigationId: inv.id,
      riskScore: result.riskScore,
      signals: result.signals,
      explanation: result.explanation,
      recommendedNext: JSON.stringify(result.recommendedNext),
    },
  });

  // Best-effort — mirrors simulate.ts's live-feed broadcast pattern.
  try {
    getIo().emit("intelligence-event", {
      type: "ai_assessment_generated",
      payload: {
        investigation: inv.displayId,
        riskScore: result.riskScore,
        aiGenerated: result.aiGenerated,
        modelUsed: result.modelUsed,
      },
      at: new Date(),
    });
  } catch {
    // Socket.IO not initialized (e.g. in isolated tests) — safe to ignore.
  }

  res.status(201).json({ ...assessment, aiGenerated: result.aiGenerated, modelUsed: result.modelUsed });
});