// src/lib/ocrSentiment.ts
//
// Analyzes EvidenceRecord.ocrText (text extracted from an uploaded image
// by lib/ocr.ts) along two independent axes:
//
//   1. Suspicion score — a deterministic, explainable keyword scorer, same
//      "no faked numbers" convention as lib/riskEngine.ts's CONTENT_GROUPS:
//      every point is traceable to a matched pattern, nothing here is an
//      LLM guess. Reuses riskStatus.ts's shared 0-100 -> LOW/MEDIUM/HIGH/
//      CRITICAL thresholds so a piece of OCR text is never labeled
//      inconsistently with how the same number would read anywhere else
//      in the product.
//   2. Sentiment — general-purpose AFINN-based tone (positive/neutral/
//      negative + comparative score) via the `sentiment` package. This is
//      literal sentiment analysis, kept deliberately separate from the
//      suspicion score: an OCR'd threat or a coerced message can score
//      strongly negative in tone without containing any of the marketplace
//      keyword groups below, and vice versa (a "pure, uncut" listing
//      reads tonally neutral). Reporting both, rather than collapsing them
//      into one number, is what lets an investigator see *why* something
//      was flagged.
//
// Like investigationAssessment.ts, an optional LLM call (via llmClient.ts)
// turns the deterministic signals into a plain-English explanation —
// never the other way around, and it degrades to a deterministic
// templated explanation if the model is unavailable/unconfigured, so this
// never blocks evidence creation.

import Sentiment from "sentiment";
import { callLlmForJson, LlmError, SupportedModel, DEFAULT_MODEL } from "./llmClient.js";
import { riskToStatus, type RiskLevel } from "./riskStatus.js";

const sentimentAnalyzer = new Sentiment();

// ─── Suspicion keyword groups ───────────────────────────────────────────
//
// Six independent groups covering the categories that actually show up in
// dark-web marketplace listings, chat screenshots, and photographed
// documents — the kinds of images evidence gets attached to. Weights sum
// to 100. Deliberately mirrors the shape of riskEngine.ts's CONTENT_GROUPS
// (label, pattern, value) rather than inventing a different convention.

export type SuspicionFactor =
  | "financialFraud"
  | "identityDocument"
  | "controlledSubstance"
  | "weapon"
  | "operationalSecurity"
  | "urgencyPressure"
  | "transactionCoordination";

export const SUSPICION_FACTOR_LABELS: Record<SuspicionFactor, string> = {
  financialFraud: "Financial fraud terminology",
  identityDocument: "Identity-document terminology",
  controlledSubstance: "Controlled-substance terminology",
  weapon: "Weapons terminology",
  operationalSecurity: "Operational-security / evasion language",
  urgencyPressure: "Urgency or pressure language",
  transactionCoordination: "Transaction-in-progress language",
};

export interface SuspicionSignal {
  label: string;
  value: number; // points this signal contributed, out of 100
  factor: SuspicionFactor;
}

const SUSPICION_GROUPS: { factor: SuspicionFactor; pattern: RegExp; value: number }[] = [
  {
    factor: "financialFraud",
    pattern: /\b(cvv|fullz|dumps?|carding|paypal|western union|\bwu\b|bank ?log|swift|iban|\bbin\b|wire transfer|money mule|chargeback)\b/i,
    value: 18,
  },
  {
    factor: "identityDocument",
    pattern: /\b(passport|driver'?s?\s?licen[sc]e|id card|\bssn\b|social security|fake id|date of birth|\bdob\b)\b/i,
    value: 12,
  },
  {
    factor: "controlledSubstance",
    // Added "controlled substance" as its own phrase — the generic legal term
    // an investigator uses when the specific drug name isn't stated, distinct
    // from (and additional to) the named-substance list already here.
    pattern: /\b(pure|uncut|aaa\+*|fentanyl|carfentanil|heroin|cocaine|meth(?:amphetamine)?|\bmdma\b|\blsd\b|ketamine|oxycodone|xanax|controlled substances?)\b/i,
    value: 18,
  },
  {
    factor: "weapon",
    pattern: /\b(glock|pistol|firearm|handgun|ammo(?:nition)?|silencer|suppressor|ghost gun|untraceable weapon|explosive device)\b/i,
    value: 15,
  },
  {
    factor: "operationalSecurity",
    // Added off-platform/account-hopping evasion language — moving a deal
    // off the monitored platform or switching away from a "main" account is
    // as much an evasion signal as the existing tor/vpn/monero terms.
    pattern: /\b(burner phone|untraceable|no ?le\b|stealth (?:ship|packaging)|encrypted|\bpgp\b|monero|\bxmr\b|escrow|wipe metadata|\btor\b|\bvpn\b|cash only|no camera|off.?grid|off.?platform|main account|anonymous account|keep (?:this|it) (?:private|secret))\b/i,
    value: 12,
  },
  {
    factor: "urgencyPressure",
    // Added a bare "urgent" match — the original phrasing required "this
    // (is) urgent", which misses a standalone "URGENT" header/label or
    // "urgent response requested", both common in flagged chat excerpts.
    pattern: /\b(act now|limited time|don'?t tell anyone|keep this (?:secret|between us)|verify payment now|wire (?:it |the money )?immediately|final warning|last chance|this (?:is )?urgent|urgent(?:ly)?\b.{0,20}\b(response|reply|action)|^urgent\b)\b/i,
    value: 10,
  },
  {
    factor: "transactionCoordination",
    // New group: previous groups only caught vocabulary (drug names, fraud
    // terms, evasion tools), not the shape of an actual deal in progress —
    // "buyer confirmed", "payment sent", "package ready", "awaiting
    // confirmation" are exactly the concrete completed/pending-transaction
    // evidence an investigator weighs most heavily, and nothing above was
    // built to catch it.
    pattern: /\b(payment (?:has been |was )?sent|payment confirm(?:ed|ation)|buyer (?:has )?confirmed|awaiting confirmation|package (?:is )?ready|transaction (?:is )?(?:pending|awaiting|complete|confirmed))\b/i,
    value: 15,
  },
];

/**
 * Deterministic, explainable scorer — pure function of the OCR text. Same
 * input always produces the same signals; no randomness, no LLM
 * involvement. Only signals with a match are returned (riskEngine.ts
 * convention: skip what wasn't found rather than listing zero-value rows).
 */
export function computeSuspicionSignals(ocrText: string): SuspicionSignal[] {
  const signals: SuspicionSignal[] = [];
  for (const group of SUSPICION_GROUPS) {
    if (group.pattern.test(ocrText)) {
      signals.push({
        label: SUSPICION_FACTOR_LABELS[group.factor],
        value: group.value,
        factor: group.factor,
      });
    }
  }
  return signals;
}

export interface SentimentSummary {
  score: number; // raw AFINN score
  comparative: number; // score normalized by token count
  label: "positive" | "neutral" | "negative";
  positiveWords: string[];
  negativeWords: string[];
}

/** General-purpose tone analysis — deliberately separate from suspicion (see header). */
export function analyzeSentiment(ocrText: string): SentimentSummary {
  const result = sentimentAnalyzer.analyze(ocrText);
  const label: SentimentSummary["label"] =
    result.comparative > 0.05 ? "positive" : result.comparative < -0.05 ? "negative" : "neutral";
  return {
    score: result.score,
    comparative: result.comparative,
    label,
    positiveWords: result.positive,
    negativeWords: result.negative,
  };
}

export interface OcrTextAnalysis {
  suspicious: boolean; // score >= riskStatus.ts's MEDIUM threshold
  suspicionScore: number; // 0-100, sum of matched signal values (capped at 100)
  suspicionLevel: RiskLevel;
  signals: SuspicionSignal[];
  sentiment: SentimentSummary;
  explanation: string;
  aiGenerated: boolean; // false when the LLM failed/was unconfigured and a fallback template was used
  modelUsed: string; // which model produced `explanation`, or "fallback"
}

function templatedExplanation(signals: SuspicionSignal[], sentiment: SentimentSummary, level: RiskLevel): string {
  if (signals.length === 0) {
    return `No suspicion indicators matched in the extracted text. Overall tone reads ${sentiment.label} (comparative ${sentiment.comparative.toFixed(2)}).`;
  }
  const factorList = signals.map((s) => s.label.toLowerCase()).join(", ");
  return `Extracted text matched ${signals.length} indicator group${signals.length === 1 ? "" : "s"} (${factorList}), putting the suspicion level at ${level}. Overall tone reads ${sentiment.label} (comparative ${sentiment.comparative.toFixed(2)}).`;
}

interface LlmExplanationResponse {
  explanation: string;
}

/**
 * Full pipeline for one piece of OCR text: deterministic suspicion score +
 * sentiment, then an optional LLM pass that turns those into a
 * plain-English explanation. The score/level themselves are NEVER derived
 * from the LLM — only the explanation text is, and even that falls back
 * to a deterministic template on any LLM failure so this never blocks
 * evidence creation (same contract as ocr.ts and investigationAssessment.ts).
 */
export async function analyzeOcrText(ocrText: string, model: SupportedModel = DEFAULT_MODEL): Promise<OcrTextAnalysis> {
  const signals = computeSuspicionSignals(ocrText);
  const suspicionScore = Math.min(100, signals.reduce((sum, s) => sum + s.value, 0));
  const suspicionLevel = riskToStatus(suspicionScore);
  const suspicious = suspicionLevel === "MEDIUM" || suspicionLevel === "HIGH" || suspicionLevel === "CRITICAL";
  const sentiment = analyzeSentiment(ocrText);

  try {
    const prompt = [
      `OCR-extracted text from a piece of uploaded evidence:`,
      `"""${ocrText.slice(0, 2000)}"""`,
      ``,
      `Deterministic suspicion signals already computed (do not change these numbers, only explain them):`,
      signals.length > 0
        ? signals.map((s) => `- ${s.label}: +${s.value}`).join("\n")
        : "- (none matched)",
      `Suspicion score: ${suspicionScore}/100 (${suspicionLevel})`,
      `Sentiment: ${sentiment.label} (comparative ${sentiment.comparative.toFixed(2)})`,
      ``,
      `Write a 1-2 sentence, investigator-facing explanation of why this text was flagged at this level. Do not invent new signals or repeat the raw text verbatim.`,
    ].join("\n");

    const parsed = await callLlmForJson<LlmExplanationResponse>({
      model,
      prompt,
      systemInstruction:
        'You are assisting a dark-web intelligence analyst. Respond ONLY with JSON of the shape {"explanation": string}.',
    });

    if (parsed?.explanation) {
      return {
        suspicious,
        suspicionScore,
        suspicionLevel,
        signals,
        sentiment,
        explanation: parsed.explanation,
        aiGenerated: true,
        modelUsed: model,
      };
    }
    throw new LlmError("LLM returned no explanation field");
  } catch (err) {
    console.error("[ocrSentiment] LLM explanation failed, using fallback template:", err instanceof Error ? err.message : err);
    return {
      suspicious,
      suspicionScore,
      suspicionLevel,
      signals,
      sentiment,
      explanation: templatedExplanation(signals, sentiment, suspicionLevel),
      aiGenerated: false,
      modelUsed: "fallback",
    };
  }
}