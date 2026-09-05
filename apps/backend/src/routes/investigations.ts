import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { getIo } from "../sockets/io.js";
import { generateInvestigationAssessment } from "../lib/investigationAssessment.js";
import { DEFAULT_MODEL, MODEL_OPTIONS, type SupportedModel } from "../lib/llmClient.js";

export const investigationsRouter = Router();

// POST /api/investigations — create a new investigation
investigationsRouter.post("/", async (req, res) => {
  const { title, description, priority, status, assignee } = req.body as {
    title?: string; description?: string; priority?: string; status?: string; assignee?: string;
  };
  if (!title?.trim() || !description?.trim()) {
    return res.status(400).json({ error: "title and description are required" });
  }
  const validPriorities = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
  const validStatuses = ["UNDER_INVESTIGATION", "UNDER_REVIEW", "MONITORING", "CLOSED"];
  const safePriority = validPriorities.includes(priority ?? "") ? priority! : "MEDIUM";
  const safeStatus = validStatuses.includes(status ?? "") ? status! : "UNDER_INVESTIGATION";

  // Generate a display ID like INV-2026-XXX
  const count = await prisma.investigation.count();
  const displayId = `INV-2026-${String(count + 1).padStart(3, "0")}`;

  const inv = await prisma.investigation.create({
    data: {
      displayId,
      title: title.trim(),
      description: description.trim(),
      priority: safePriority as any,
      status: safeStatus as any,
      assignee: assignee?.trim() || "Unassigned",
    },
  });
  res.status(201).json(inv);
});

// DELETE /api/investigations/:displayId
investigationsRouter.delete("/:displayId", async (req, res) => {
  const inv = await prisma.investigation.findUnique({ where: { displayId: req.params.displayId } });
  if (!inv) return res.status(404).json({ error: "Investigation not found" });
  await prisma.investigation.delete({ where: { id: inv.id } });
  res.status(204).send();
});

investigationsRouter.get("/", async (_req, res) => {
  const investigations = await prisma.investigation.findMany({
    include: { _count: { select: { entities: true, evidence: true } } },
    orderBy: { updatedAt: "desc" },
  });
  res.json(investigations);
});

// PATCH /api/investigations/:displayId — update assignee, status, priority, etc.
investigationsRouter.patch("/:displayId", async (req, res) => {
  const inv = await prisma.investigation.findUnique({ where: { displayId: req.params.displayId } });
  if (!inv) return res.status(404).json({ error: "Investigation not found" });

  const { assignee, status, priority, title, description } = req.body as {
    assignee?: string; status?: string; priority?: string; title?: string; description?: string;
  };
  const validStatuses = ["UNDER_INVESTIGATION", "UNDER_REVIEW", "MONITORING", "CLOSED"];
  const validPriorities = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

  const data: any = {};
  if (assignee !== undefined) data.assignee = assignee.trim();
  if (status !== undefined && validStatuses.includes(status)) data.status = status as any;
  if (priority !== undefined && validPriorities.includes(priority)) data.priority = priority as any;
  if (title !== undefined) data.title = title.trim();
  if (description !== undefined) data.description = description.trim();

  const updated = await prisma.investigation.update({ where: { id: inv.id }, data });
  res.json(updated);
});

// POST /api/investigations/:displayId/entities — link an entity to an investigation
investigationsRouter.post("/:displayId/entities", async (req, res) => {
  const { entityId } = req.body as { entityId?: string };
  if (!entityId) return res.status(400).json({ error: "entityId is required" });

  const inv = await prisma.investigation.findUnique({ where: { displayId: req.params.displayId } });
  if (!inv) return res.status(404).json({ error: "Investigation not found" });

  const entity = await prisma.entity.findUnique({ where: { id: entityId } });
  if (!entity) return res.status(404).json({ error: "Entity not found" });

  try {
    const link = await prisma.investigationEntity.create({
      data: { investigationId: inv.id, entityId: entity.id },
      include: { entity: true },
    });
    res.status(201).json(link);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(409).json({ error: "Entity already linked to this investigation" });
    throw e;
  }
});

// POST /api/investigations/:displayId/evidence — add an evidence record
investigationsRouter.post("/:displayId/evidence", async (req, res) => {
  const { type, source } = req.body as { type?: string; source?: string };
  if (!type || !source?.trim()) return res.status(400).json({ error: "type and source are required" });

  const inv = await prisma.investigation.findUnique({ where: { displayId: req.params.displayId } });
  if (!inv) return res.status(404).json({ error: "Investigation not found" });

  const count = await prisma.evidenceRecord.count({ where: { investigationId: inv.id } });
  const displayId = `EV-${String(count + 1).padStart(4, "0")}`;

  const evidence = await prisma.evidenceRecord.create({
    data: {
      displayId,
      investigationId: inv.id,
      type: type.trim(),
      uploadedBy: "Investigator A",
      status: "PENDING",
      hash: `sha256-${Math.random().toString(36).slice(2, 18)}`,
    },
  });
  res.status(201).json(evidence);
});

investigationsRouter.get("/:displayId", async (req, res) => {
  const inv = await prisma.investigation.findUnique({
    where: { displayId: req.params.displayId },
    include: {
      entities: { include: { entity: true } },
      evidence: true,
      timeline: { orderBy: { occurredAt: "asc" } },
      aiAssessments: { orderBy: { createdAt: "desc" } },
      notes: { orderBy: { createdAt: "desc" }, include: { revisions: { orderBy: { supersededAt: "desc" } } } },
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

// PATCH /api/investigations/:displayId/ai-assessment/:assessmentId/review
//
// Investigator decision on a generated AI assessment. Accepts:
//   { action: "ACCEPT" | "MODIFY" | "REJECT" | "RESET",
//     editedExplanation?: string,       // required for MODIFY
//     editedRecommendedNext?: string[], // optional for MODIFY
//     reviewNote?: string,              // optional reason, mainly for REJECT
//     reviewedBy?: string }             // defaults to the investigation's assignee
//
// The original AI-generated `explanation`/`recommendedNext` columns are
// NEVER overwritten — edits from MODIFY are stored separately in
// `editedExplanation`/`editedRecommendedNext` so there's always a clean
// record of what the AI actually said vs. what the investigator changed it
// to. RESET clears the review back to PENDING (e.g. "undo my decision").
const REVIEW_ACTIONS = ["ACCEPT", "MODIFY", "REJECT", "RESET"] as const;
type ReviewAction = (typeof REVIEW_ACTIONS)[number];

investigationsRouter.patch("/:displayId/ai-assessment/:assessmentId/review", async (req, res) => {
  const { action, editedExplanation, editedRecommendedNext, reviewNote, reviewedBy } = req.body as {
    action?: string;
    editedExplanation?: string;
    editedRecommendedNext?: string[];
    reviewNote?: string;
    reviewedBy?: string;
  };

  if (!action || !REVIEW_ACTIONS.includes(action as ReviewAction)) {
    return res.status(400).json({ error: `action must be one of ${REVIEW_ACTIONS.join(", ")}` });
  }
  if (action === "MODIFY" && !editedExplanation?.trim()) {
    return res.status(400).json({ error: "editedExplanation is required for a MODIFY review" });
  }

  const inv = await prisma.investigation.findUnique({ where: { displayId: req.params.displayId } });
  if (!inv) return res.status(404).json({ error: "Investigation not found" });

  const existing = await prisma.aiAssessment.findUnique({ where: { id: req.params.assessmentId } });
  if (!existing || existing.investigationId !== inv.id) {
    return res.status(404).json({ error: "AI assessment not found for this investigation" });
  }

  if (action === "RESET") {
    const assessment = await prisma.aiAssessment.update({
      where: { id: existing.id },
      data: {
        reviewStatus: "PENDING",
        editedExplanation: null,
        editedRecommendedNext: null,
        reviewNote: null,
        reviewedBy: null,
        reviewedAt: null,
      },
    });
    return res.status(200).json(assessment);
  }

  // ACCEPT/MODIFY/REJECT -> present-tense action name to the past-tense
  // AssessmentReviewStatus enum value.
  const reviewStatus = { ACCEPT: "ACCEPTED", MODIFY: "MODIFIED", REJECT: "REJECTED" } as const;

  const assessment = await prisma.aiAssessment.update({
    where: { id: existing.id },
    data: {
      reviewStatus: reviewStatus[action as "ACCEPT" | "MODIFY" | "REJECT"],
      editedExplanation: action === "MODIFY" ? editedExplanation!.trim() : null,
      editedRecommendedNext:
        action === "MODIFY" && Array.isArray(editedRecommendedNext) && editedRecommendedNext.length > 0
          ? JSON.stringify(editedRecommendedNext)
          : null,
      reviewNote: reviewNote?.trim() || null,
      reviewedBy: reviewedBy?.trim() || inv.assignee,
      reviewedAt: new Date(),
    },
  });

  try {
    getIo().emit("intelligence-event", {
      type: "ai_assessment_reviewed",
      payload: { investigation: inv.displayId, assessmentId: assessment.id, reviewStatus: assessment.reviewStatus },
      at: new Date(),
    });
  } catch {
    // Socket.IO not initialized (e.g. in isolated tests) — safe to ignore.
  }

  res.status(200).json(assessment);
});

// ── Investigator notes (multiple, editable, self-auditing) ────────────────
//
// Each note tracks who created it and when, and — separately — who last
// edited it and when (`updatedBy`/`updatedAt`). That's enough to render a
// full "added by X on <date> · edited by Y on <date>" trail per note
// without a separate revision-history table.

// POST /api/investigations/:displayId/notes
// Body: { content: string, author?: string } — author defaults to the
// investigation's assignee (no real auth in this app yet).
investigationsRouter.post("/:displayId/notes", async (req, res) => {
  const { content, author } = req.body as { content?: string; author?: string };
  if (!content?.trim()) return res.status(400).json({ error: "content is required" });

  const inv = await prisma.investigation.findUnique({ where: { displayId: req.params.displayId } });
  if (!inv) return res.status(404).json({ error: "Investigation not found" });

  const note = await prisma.investigationNote.create({
    data: {
      investigationId: inv.id,
      content: content.trim(),
      createdBy: author?.trim() || inv.assignee,
    },
  });

  res.status(201).json(note);
});

// PATCH /api/investigations/:displayId/notes/:noteId
// Body: { content: string, author?: string } — author is who's editing,
// recorded as `updatedBy` so the note shows who last changed it.
//
// Before overwriting the content, the CURRENT version is snapshotted into
// InvestigationNoteRevision — so editing a note never destroys the
// previous text, it just supersedes it. That's what "view edit history"
// on the frontend reads from.
investigationsRouter.patch("/:displayId/notes/:noteId", async (req, res) => {
  const { content, author } = req.body as { content?: string; author?: string };
  if (!content?.trim()) return res.status(400).json({ error: "content is required" });

  const inv = await prisma.investigation.findUnique({ where: { displayId: req.params.displayId } });
  if (!inv) return res.status(404).json({ error: "Investigation not found" });

  const existing = await prisma.investigationNote.findUnique({ where: { id: req.params.noteId } });
  if (!existing || existing.investigationId !== inv.id) {
    return res.status(404).json({ error: "Note not found for this investigation" });
  }

  // No-op edits (identical content) don't create a pointless revision entry.
  if (existing.content.trim() === content.trim()) {
    return res.status(200).json(
      await prisma.investigationNote.findUnique({
        where: { id: existing.id },
        include: { revisions: { orderBy: { supersededAt: "desc" } } },
      })
    );
  }

  const [, note] = await prisma.$transaction([
    prisma.investigationNoteRevision.create({
      data: {
        noteId: existing.id,
        content: existing.content,
        author: existing.updatedBy ?? existing.createdBy,
        versionAt: existing.updatedAt ?? existing.createdAt,
      },
    }),
    prisma.investigationNote.update({
      where: { id: existing.id },
      data: { content: content.trim(), updatedBy: author?.trim() || inv.assignee },
      include: { revisions: { orderBy: { supersededAt: "desc" } } },
    }),
  ]);

  res.status(200).json(note);
});

// DELETE /api/investigations/:displayId/notes/:noteId
investigationsRouter.delete("/:displayId/notes/:noteId", async (req, res) => {
  const inv = await prisma.investigation.findUnique({ where: { displayId: req.params.displayId } });
  if (!inv) return res.status(404).json({ error: "Investigation not found" });

  const existing = await prisma.investigationNote.findUnique({ where: { id: req.params.noteId } });
  if (!existing || existing.investigationId !== inv.id) {
    return res.status(404).json({ error: "Note not found for this investigation" });
  }

  await prisma.investigationNote.delete({ where: { id: existing.id } });
  res.status(204).send();
});