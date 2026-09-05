// apps/backend/src/lib/investigationAssessment.ts
//
// AI Assessment pipeline for a single investigation:
//
//   structured risk signals (deterministic, computed from real DB rows)
//     -> Groq turns the signals into a plain-English explanation + next
//        steps (never the other way around — the score is never derived
//        from the LLM's output)
//     -> caller stores the result as an AiAssessment row, always alongside
//        the signals that produced it, so the explanation stays traceable
//        back to real numbers
//
// This mirrors the "no faked numbers" philosophy in riskEngine.ts: the
// score and signals are pure functions of the investigation's related rows.
// Only the natural-language explanation/next-steps come from the LLM, and
// even that call degrades to a deterministic templated summary if Groq
// is unavailable or misconfigured, rather than failing the whole request.

import { callGroqForJson, GroqError } from "./groq.js";

export interface AssessmentSignal {
  label: string;
  value: number; // points this signal contributed to the final score
}

export interface AssessmentInput {
  displayId: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  entities: { alias: string; risk: number; confidence: number; riskChange: number }[];
  evidence: { status: string }[];
  timeline: { type: string }[];
  network: { displayId: string; risk: number; change: number; status: string } | null;
}

export interface AssessmentResult {
  riskScore: number;
  signals: AssessmentSignal[];
  explanation: string;
  recommendedNext: string[];
  aiGenerated: boolean; // false when Groq failed/was unconfigured and a fallback template was used instead
}

// Max contribution per feature — sums to 100, same convention as
// riskEngine.ts's WEIGHTS table.
const WEIGHTS = {
  relatedEntityRisk: 35,
  peakEntityConfidence: 15,
  networkRisk: 25,
  escalationActivity: 15,
  verifiedEvidence: 10,
} as const;

const ESCALATION_TYPES = new Set(["ESCALATION", "WARNING", "ALERT"]);

/**
 * Deterministic, explainable scorer — pure function of the investigation's
 * related entities/network/evidence/timeline. Same inputs always produce
 * the same score; no randomness, no LLM involvement.
 */
export function computeInvestigationSignals(inv: AssessmentInput): { score: number; signals: AssessmentSignal[] } {
  const signals: AssessmentSignal[] = [];

  if (inv.entities.length > 0) {
    const avgRisk = inv.entities.reduce((sum, e) => sum + e.risk, 0) / inv.entities.length;
    const riskValue = Math.round((avgRisk / 100) * WEIGHTS.relatedEntityRisk);
    if (riskValue > 0) {
      signals.push({
        label: `Average related-entity risk: ${avgRisk.toFixed(0)}/100 across ${inv.entities.length} entit${inv.entities.length === 1 ? "y" : "ies"}`,
        value: riskValue,
      });
    }

    const peakConfidence = Math.max(...inv.entities.map((e) => e.confidence));
    const confValue = Math.round((peakConfidence / 100) * WEIGHTS.peakEntityConfidence);
    if (confValue > 0) {
      signals.push({ label: `Highest entity resolution confidence: ${peakConfidence}%`, value: confValue });
    }
  }

  if (inv.network) {
    const netValue = Math.round((inv.network.risk / 100) * WEIGHTS.networkRisk);
    if (netValue > 0) {
      signals.push({
        label: `Linked network ${inv.network.displayId} risk: ${inv.network.risk}/100 (${inv.network.status})`,
        value: netValue,
      });
    }
  }

  const escalationCount = inv.timeline.filter((t) => ESCALATION_TYPES.has(t.type)).length;
  if (escalationCount > 0) {
    signals.push({
      label: `${escalationCount} escalation/warning/alert event(s) in the case timeline`,
      value: Math.min(WEIGHTS.escalationActivity, escalationCount * 5),
    });
  }

  if (inv.evidence.length > 0) {
    const verified = inv.evidence.filter((e) => e.status === "VERIFIED").length;
    const ratio = verified / inv.evidence.length;
    const evValue = Math.round(ratio * WEIGHTS.verifiedEvidence);
    if (evValue > 0) {
      signals.push({ label: `${verified}/${inv.evidence.length} evidence record(s) verified`, value: evValue });
    }
  }

  const rawScore = signals.reduce((sum, s) => sum + s.value, 0);
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));
  return { score, signals };
}

// Used only when OpenAI is unconfigured/unreachable, so the endpoint still
// returns something useful instead of a 500. Clearly labeled as a fallback
// (see `aiGenerated: false`) rather than passed off as a real AI narrative.
function fallbackNarrative(
  inv: AssessmentInput,
  score: number,
  signals: AssessmentSignal[]
): { explanation: string; recommendedNext: string[] } {
  const top = [...signals].sort((a, b) => b.value - a.value)[0];
  const explanation =
    `Computed risk score ${score}/100 for ${inv.displayId} from ${signals.length} contributing signal(s)` +
    (top ? `, the largest being "${top.label}" (+${top.value}).` : ".") +
    ` AI narrative generation is currently unavailable — this is a deterministic fallback summary, not a Groq-generated explanation.`;
  const recommendedNext = [
    "Review the underlying signals above against current case evidence",
    "Confirm related-entity risk and confidence scores are up to date before escalating",
    "Re-run the AI assessment once the Groq integration is reachable",
  ];
  return { explanation, recommendedNext };
}

function buildPrompt(inv: AssessmentInput, score: number, signals: AssessmentSignal[]): string {
  const signalLines =
    signals.map((s) => `- ${s.label} (contributed ${s.value} pts)`).join("\n") || "- No contributing signals found";

  return `You are assisting a criminal-intelligence investigator reviewing case ${inv.displayId} ("${inv.title}").

Case summary: ${inv.description}
Status: ${inv.status} · Priority: ${inv.priority}
Computed risk score: ${score}/100 — this was derived deterministically from the signals below; do not recompute, restate as different, or contradict this number.

Contributing signals:
${signalLines}

Return a JSON object with exactly two fields:
1. "explanation": a concise (3-5 sentence) plain-English assessment of why this case scored ${score}/100, grounded ONLY in the signals and case summary above. Do not invent entities, wallets, or facts not present above.
2. "recommendedNext": an array of 3-5 concrete, specific next investigative steps, grounded in the entities/network/evidence referenced above.

This is a decision-support tool only — conclusions require investigator review and do not constitute a criminal determination.`;
}

/**
 * Full pipeline: compute deterministic signals, ask OpenAI to turn them
 * into a narrative + next steps, and gracefully fall back to a templated
 * summary if Groq is unavailable. Never throws — always resolves to an
 * AssessmentResult so the route can persist and return it unconditionally.
 */
export async function generateInvestigationAssessment(inv: AssessmentInput): Promise<AssessmentResult> {
  const { score, signals } = computeInvestigationSignals(inv);

  try {
    const parsed = await callGroqForJson<{ explanation: string; recommendedNext: string[] }>({
      prompt: buildPrompt(inv, score, signals),
      systemInstruction: "You are a criminal intelligence analysis assistant. Always respond with valid JSON only.",
    });
    if (!parsed?.explanation || !Array.isArray(parsed.recommendedNext) || parsed.recommendedNext.length === 0) {
      throw new GroqError("Groq response was missing required fields");
    }
    return { riskScore: score, signals, explanation: parsed.explanation, recommendedNext: parsed.recommendedNext, aiGenerated: true };
  } catch (err) {
    console.error(`[ai-assessment] Groq call failed for ${inv.displayId}, using fallback narrative:`, (err as Error).message);
    const fallback = fallbackNarrative(inv, score, signals);
    return { riskScore: score, signals, ...fallback, aiGenerated: false };
  }
}
