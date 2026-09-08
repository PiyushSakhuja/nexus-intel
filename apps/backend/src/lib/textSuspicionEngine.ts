// src/lib/textSuspicionEngine.ts
//
// Scores crawled page text for suspicion signals — deliberately NOT
// "sentiment analysis". Sentiment (positive/negative/neutral tone) mostly
// doesn't correlate with illicit-marketplace activity: a scam listing
// reads just as "positive" in tone as a legitimate one. What actually
// carries signal is specific, explainable PATTERNS — payment/anonymity
// language, urgency/secrecy language, off-platform-contact requests, and
// prohibited-item vocabulary — which is exactly the same style of
// deterministic, weighted, capped signal list riskEngine.ts already uses
// for Listing rows. Keeping that convention here means a reviewer can see
// exactly which phrase triggered which point value, same as everywhere
// else in this codebase — no black-box classifier, no "trust the model".
//
// This is a STARTING vocabulary, not a finished one — false positives are
// expected and it should be tuned against real crawled data, same as
// riskEngine.ts's HIGH_RISK_CATEGORIES was tuned against the seed dataset.

export interface TextSignal {
  label: string;
  points: number;
  matched: string; // the phrase/pattern that triggered this
}

export interface TextSuspicionResult {
  score: number; // 0-100
  signals: TextSignal[];
  wordCount: number;
}

interface PatternRule {
  label: string;
  points: number;
  pattern: RegExp;
  cap?: number; // max times this rule can fire on one page (default 1)
}

const RULES: PatternRule[] = [
  // Anonymity / payment signals
  { label: "Crypto-only payment language", points: 8, pattern: /\b(crypto\s*only|bitcoin\s*only|monero\s*only|xmr\s*only)\b/i },
  { label: "Escrow / vendor-bond language", points: 6, pattern: /\b(escrow|vendor\s*bond|fe\s*only|finalize\s*early)\b/i },
  { label: "Explicit anonymity claims", points: 6, pattern: /\b(100%\s*anonymous|untraceable|no\s*logs?\s*kept)\b/i },

  // Off-platform / secrecy signals
  { label: "Off-platform contact request", points: 10, pattern: /\b(contact\s*(me|us)\s*(on|via)\s*(telegram|wickr|signal|whatsapp))\b/i },
  { label: "Secrecy / discretion language", points: 5, pattern: /\b(discreet\s*(packaging|shipping)|no\s*questions\s*asked|stealth\s*ship)\b/i },
  { label: "Law-enforcement evasion language", points: 12, pattern: /\b(no\s*le|not\s*a\s*cop|leo\s*free|law\s*enforcement\s*free)\b/i },

  // Urgency / scarcity manipulation
  { label: "Urgency / scarcity pressure", points: 4, pattern: /\b(limited\s*time|act\s*now|only\s*\d+\s*left|hurry)\b/i },
  { label: "Too-good-to-be-true pricing language", points: 5, pattern: /\b(below\s*market|wholesale\s*price|bulk\s*discount\s*guaranteed)\b/i },

  // Prohibited-item vocabulary (kept intentionally narrow/generic — this
  // is a starting point, not a moderation-grade lexicon)
  { label: "Controlled-substance vocabulary", points: 10, pattern: /\b(mdma|cocaine|heroin|fentanyl|meth(amphetamine)?|xanax\s*bars?)\b/i, cap: 3 },
  { label: "Stolen-data vocabulary", points: 10, pattern: /\b(cvv|fullz|dumps?\s*track|bank\s*log|carding)\b/i, cap: 3 },
  { label: "Counterfeit-document vocabulary", points: 8, pattern: /\b(fake\s*(id|passport|driver'?s?\s*license))\b/i },

  // Identity-concealment signals on the page itself
  { label: "Vendor identity obfuscation", points: 4, pattern: /\b(alias|handle)\s*only[,.]?\s*no\s*real\s*name/i },
];

export function scoreText(rawText: string): TextSuspicionResult {
  const text = rawText.slice(0, 50_000); // cap — this is a signal scan, not full-document analysis
  const wordCount = text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;

  const signals: TextSignal[] = [];
  for (const rule of RULES) {
    const globalPattern = new RegExp(rule.pattern.source, rule.pattern.flags.includes("g") ? rule.pattern.flags : rule.pattern.flags + "g");
    const matches = text.match(globalPattern);
    if (!matches || matches.length === 0) continue;
    const occurrences = Math.min(matches.length, rule.cap ?? 1);
    for (let i = 0; i < occurrences; i++) {
      signals.push({ label: rule.label, points: rule.points, matched: matches[i] });
    }
  }

  const rawScore = signals.reduce((sum, s) => sum + s.points, 0);
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  return { score, signals, wordCount };
}

export function signalsToDisplayStrings(signals: TextSignal[]): string[] {
  return signals.map((s) => `${s.label} (+${s.points})`);
}
