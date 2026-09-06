// ─── Types ────────────────────────────────────────────────────────────────────
// Only shared TYPES and pure presentational helpers live here now. Every
// hardcoded demo array (entities, alerts, investigations, evidence, graph
// nodes/edges, audit log, charts, KPIs, listings, wallets, timeline) has
// been removed — screens fetch this data live from the backend API
// (see src/lib/api.ts) instead. See MOCK_DATA_AUDIT.md for the full record
// of what was removed and which live endpoint replaced it.

export type RiskLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type InvStatus = "UNDER INVESTIGATION" | "UNDER REVIEW" | "MONITORING" | "CLOSED";
export type EvidenceStatus = "Verified" | "Pending" | "Rejected";

export interface Entity {
  id: string;
  alias: string;
  risk: number;
  confidence: number;
  marketplaces: number;
  wallets: number;
  listings: number;
  comms: number;
  firstSeen: string;
  lastSeen: string;
  riskChange: number | null;
  identifiers: { type: string; value: string; confidence: number }[];
}

export interface Alert {
  id: string;
  severity: number;
  title: string;
  time: string;
  entities: string[];
  reason: string;
  status: "new" | "reviewed" | "resolved";
  network?: string;
}

export interface Investigation {
  id: string;
  title: string;
  status: InvStatus;
  priority: "HIGH" | "MEDIUM" | "LOW";
  assignee: string;
  entities: number;
  evidence: number;
  updated: string;
  description: string;
}

export interface EvidenceRecord {
  id: string;
  type: string;
  source: string;
  ts: string;
  hash: string;
  caseRef: string;
  by: string;
  status: EvidenceStatus;
}

export interface NetworkNode {
  id: string;
  label: string;
  type: "entity" | "market" | "listing" | "wallet" | "comm" | "txn";
  risk: number;
  x: number;
  y: number;
}

export interface NetworkEdge {
  from: string;
  to: string;
  label: string;
}

// ─── Colour helpers ───────────────────────────────────────────────────────────
// Pure functions of a risk score — not data, safe to keep as shared code.

export const riskColor = (s: number) =>
  s >= 80 ? "#dc2626" : s >= 60 ? "#ea580c" : s >= 40 ? "#d97706" : "#16a34a";

export const riskColorLight = (s: number) =>
  s >= 80 ? "#f87171" : s >= 60 ? "#fb923c" : s >= 40 ? "#fbbf24" : "#4ade80";

export const riskLabel = (s: number): RiskLevel =>
  s >= 80 ? "CRITICAL" : s >= 60 ? "HIGH" : s >= 40 ? "MEDIUM" : "LOW";

export const riskBg = (s: number) =>
  s >= 80
    ? "rgba(220,38,38,0.12)"
    : s >= 60
    ? "rgba(234,88,12,0.12)"
    : s >= 40
    ? "rgba(217,119,6,0.12)"
    : "rgba(22,163,74,0.1)";

export const riskBorder = (s: number) =>
  s >= 80
    ? "rgba(220,38,38,0.25)"
    : s >= 60
    ? "rgba(234,88,12,0.25)"
    : s >= 40
    ? "rgba(217,119,6,0.25)"
    : "rgba(22,163,74,0.2)";
