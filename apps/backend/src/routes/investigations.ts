import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { getIo } from "../sockets/io.js";
import { generateInvestigationAssessment } from "../lib/investigationAssessment.js";
import { DEFAULT_MODEL, MODEL_OPTIONS, type SupportedModel } from "../lib/llmClient.js";
import { computeVendorRisk, type VendorRisk } from "../lib/vendorRisk.js";
import { computeEntityRisk, type EntityComputedRisk } from "../lib/entityRisk.js";
import type { ListingInput } from "../lib/riskEngine.js";
import { bfsSubgraph } from "../lib/graphTraversal.js";

export const investigationsRouter = Router();

// Same pattern already used independently in routes/entities.ts,
// routes/networks.ts, routes/alerts.ts, and routes/simulate.ts — kept as a
// local duplicate here rather than a shared import so this file's changes
// stay self-contained and don't risk touching those other routes' behavior.
async function buildVendorRiskMap(): Promise<Map<string, VendorRisk>> {
  const listings = await prisma.listing.findMany();
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
  return computeVendorRisk(inputs);
}

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
  const { type, notes } = req.body as { type?: string; notes?: string };
  if (!type?.trim()) return res.status(400).json({ error: "type is required" });

  const inv = await prisma.investigation.findUnique({ where: { displayId: req.params.displayId } });
  if (!inv) return res.status(404).json({ error: "Investigation not found" });

  const count = await prisma.evidenceRecord.count({ where: { investigationId: inv.id } });
  const displayId = `EV-${String(count + 1).padStart(4, "0")}`;

  const evidence = await prisma.evidenceRecord.create({
    data: {
      displayId,
      investigationId: inv.id,
      type: type!.trim(),
      uploadedBy: "Investigator A",
      status: "PENDING",
      hash: `sha256-${Math.random().toString(36).slice(2, 18)}`,
    },
  });
  res.status(201).json(evidence);
});

// DELETE /api/investigations/:displayId/evidence/:evidenceId
investigationsRouter.delete("/:displayId/evidence/:evidenceId", async (req, res) => {
  const inv = await prisma.investigation.findUnique({ where: { displayId: req.params.displayId } });
  if (!inv) return res.status(404).json({ error: "Investigation not found" });
  const ev = await prisma.evidenceRecord.findUnique({ where: { id: req.params.evidenceId } });
  if (!ev || ev.investigationId !== inv.id) return res.status(404).json({ error: "Evidence not found" });
  await prisma.evidenceRecord.delete({ where: { id: ev.id } });
  res.status(204).send();
});

// DELETE /api/investigations/:displayId/entities/:entityId
investigationsRouter.delete("/:displayId/entities/:entityId", async (req, res) => {
  const inv = await prisma.investigation.findUnique({ where: { displayId: req.params.displayId } });
  if (!inv) return res.status(404).json({ error: "Investigation not found" });
  const link = await prisma.investigationEntity.findUnique({
    where: { investigationId_entityId: { investigationId: inv.id, entityId: req.params.entityId } },
  });
  if (!link) return res.status(404).json({ error: "Entity not linked to this investigation" });
  await prisma.investigationEntity.delete({
    where: { investigationId_entityId: { investigationId: inv.id, entityId: req.params.entityId } },
  });
  res.status(204).send();
});

// GET /api/investigations/:displayId/graph — investigation-SCOPED subgraph.
//
// Derives the subgraph purely from existing, persisted relationships:
//   Investigation -> InvestigationEntity -> Entity -> GraphNode -> GraphEdge
// via bounded BFS (lib/graphTraversal.ts). Creates NO nodes, NO edges, NO
// investigationId column — see the audit note this endpoint was built from
// for why that's unnecessary for the current graph size/shape: most of this
// investigation's entities already have a GraphNode (entityId FK), and the
// existing GraphEdge rows already reach the relevant market/wallet/listing
// nodes from there. Entities that DON'T have a GraphNode are reported
// explicitly (`entitiesWithoutGraphNode`) rather than silently dropped or
// papered over with an invented node.
//
// This does not change GET /api/graph (routes/graph.ts) at all — that
// route is untouched and still returns the full global graph.
const INVESTIGATION_GRAPH_MAX_DEPTH = 2;

investigationsRouter.get("/:displayId/graph", async (req, res) => {
  const inv = await prisma.investigation.findUnique({
    where: { displayId: req.params.displayId },
    include: { entities: { include: { entity: { include: { graphNode: true } } } } },
  });
  if (!inv) return res.status(404).json({ error: "Investigation not found" });

  const entitiesWithNode = inv.entities.filter((ie) => ie.entity.graphNode);
  const entitiesWithoutNode = inv.entities.filter((ie) => !ie.entity.graphNode);
  const rootNodeIds = entitiesWithNode.map((ie) => ie.entity.graphNode!.id);

  const base = {
    investigation: { displayId: inv.displayId, title: inv.title },
    maxDepth: INVESTIGATION_GRAPH_MAX_DEPTH,
    rootNodeIds,
    entitiesConsidered: inv.entities.length,
    entitiesWithoutGraphNode: entitiesWithoutNode.map((ie) => ({
      alias: ie.entity.alias,
      displayId: ie.entity.displayId,
    })),
  };

  if (rootNodeIds.length === 0) {
    return res.json({
      ...base,
      nodes: [],
      edges: [],
      calculable: false,
      explanation:
        inv.entities.length === 0
          ? "This investigation has no linked entities yet, so no investigation-specific graph can be derived."
          : "None of this investigation's linked entities have a corresponding graph node, so no investigation-specific graph can be derived from the current graph data.",
    });
  }

  const [allNodes, allEdges] = await Promise.all([prisma.graphNode.findMany(), prisma.graphEdge.findMany()]);

  const { nodeIds, depthById } = bfsSubgraph(allNodes, allEdges, rootNodeIds, INVESTIGATION_GRAPH_MAX_DEPTH);

  const nodes = allNodes
    .filter((n) => nodeIds.has(n.id))
    .map((n) => ({
      ...n,
      depthFromInvestigation: depthById.get(n.id) ?? null,
      isInvestigationEntity: rootNodeIds.includes(n.id),
    }));

  // Only edges whose BOTH endpoints made it into the reached set — never an
  // edge to a node the investigation isn't actually connected to.
  const edges = allEdges.filter((e) => nodeIds.has(e.fromId) && nodeIds.has(e.toId));

  res.json({
    ...base,
    nodes,
    edges,
    calculable: true,
    explanation: `Derived from ${rootNodeIds.length} entity-linked graph node(s) belonging to this investigation, traversed up to ${INVESTIGATION_GRAPH_MAX_DEPTH} hop(s) along existing graph edges. No nodes or edges were created for this response.`,
  });
});

// Used by GET /:displayId to recompute the per-entity contributor
// breakdown from currently-persisted data. POST /:displayId/ai-assessment
// keeps its own separate inline version below (needed there because it also
// builds assessmentInput.entities from the same vendorRiskByAlias map) —
// deliberately NOT refactored into this shared helper to avoid touching
// that already-working, already-tested endpoint for an unrelated change.
async function computeEntityRiskContributors(entities: { entity: any }[]) {
  const vendorRiskByAlias = await buildVendorRiskMap();
  return entities.map((ie) => {
    const computed = computeEntityRisk(ie.entity.alias, vendorRiskByAlias);
    return {
      alias: ie.entity.alias,
      displayId: ie.entity.displayId,
      risk: computed.risk,
      confidence: computed.confidence,
      correlated: computed.correlated,
      contributors: computed.contributors,
      representativeListingId: computed.representativeListingId,
      explanation: computed.explanation,
    };
  });
}

// GET /api/investigations/:displayId
//
// Includes `entityRiskContributors` — the same real, listing-evidence-derived
// breakdown previously only returned by POST /ai-assessment (and therefore
// lost on refresh, since it's not a persisted AiAssessment column). It's
// recomputed here from currently-persisted Investigation/Entity/Listing data
// via the existing computeEntityRisk/computeVendorRisk functions — nothing
// new is stored, nothing in riskEngine.ts's scoring changed, and there's no
// Prisma schema change. This does mean the numbers reflect CURRENT listing
// evidence, which can differ slightly from what a past AiAssessment's
// riskScore was generated from if listings have changed since — that's
// inherent to not persisting a contributor snapshot per assessment, and is
// the same trade-off already accepted for entityRisk/vendorRisk elsewhere.
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

  const entityRiskContributors = await computeEntityRiskContributors(inv.entities);

  res.json({ ...inv, entityRiskContributors });
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

  // ── Risk provenance fix ────────────────────────────────────────────────
  // Previously this built assessmentInput.entities directly from
  // ie.entity.risk/confidence — the raw Entity table columns, which per
  // lib/entityRisk.ts are LITERAL HAND-TYPED SEED VALUES with no
  // calculation behind them. routes/entities.ts, routes/networks.ts, and
  // routes/simulate.ts already prefer computeEntityRisk()'s real,
  // listing-evidence-derived values; this route did not, so the one place
  // that answers "why is this investigation high risk" was silently built
  // on the least trustworthy numbers in the system. Fixed below: use the
  // computed value when it exists (i.e. the entity's alias correlates to
  // real listing evidence), fall back to the legacy stored value only when
  // there's no evidence to compute from — never fabricate a difference,
  // never silently guess. `computeInvestigationSignals` (the actual scoring
  // function, in lib/investigationAssessment.ts) is untouched — only its
  // input data changed.
  const vendorRiskByAlias = await buildVendorRiskMap();
  const entityComputedByAlias = new Map<string, EntityComputedRisk>();
  for (const ie of inv.entities) {
    entityComputedByAlias.set(ie.entity.alias, computeEntityRisk(ie.entity.alias, vendorRiskByAlias));
  }

  const assessmentInput = {
    displayId: inv.displayId,
    title: inv.title,
    description: inv.description,
    priority: inv.priority,
    status: inv.status,
    entities: inv.entities.map((ie) => {
      const computed = entityComputedByAlias.get(ie.entity.alias)!;
      return {
        alias: ie.entity.alias,
        risk: computed.risk ?? ie.entity.risk,
        confidence: computed.confidence ?? ie.entity.confidence,
        riskChange: ie.entity.riskChange,
      };
    }),
    evidence: inv.evidence.map((e) => ({ status: e.status })),
    timeline: inv.timeline.map((t) => ({ type: t.type })),
    network: inv.network
      ? { displayId: inv.network.displayId, risk: inv.network.risk, change: inv.network.change, status: inv.network.status }
      : null,
  };

  const result = await generateInvestigationAssessment(assessmentInput, model);

  // Additive, not persisted: per-entity contributor breakdown (real
  // riskEngine.ts signals, via computeEntityRisk -> vendorRisk's
  // representative-listing signals) so the frontend can render a
  // "WHY FLAGGED" panel per entity, distinct from computeInvestigationSignals'
  // own investigation-level aggregate signals (which remain what's actually
  // stored in AiAssessment.signals and fed to the LLM, unchanged).
  const entityRiskContributors = inv.entities.map((ie) => {
    const computed = entityComputedByAlias.get(ie.entity.alias)!;
    return {
      alias: ie.entity.alias,
      displayId: ie.entity.displayId,
      risk: computed.risk,
      confidence: computed.confidence,
      correlated: computed.correlated,
      contributors: computed.contributors,
      representativeListingId: computed.representativeListingId,
      explanation: computed.explanation,
    };
  });

  const assessment = await prisma.aiAssessment.create({
    data: {
      investigationId: inv.id,
      riskScore: result.riskScore,
      signals: result.signals as any,
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

  res.status(201).json({
    ...assessment,
    aiGenerated: result.aiGenerated,
    modelUsed: result.modelUsed,
    entityRiskContributors,
  });
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