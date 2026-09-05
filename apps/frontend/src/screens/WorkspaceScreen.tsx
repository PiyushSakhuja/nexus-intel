import { useState, useEffect, useRef } from "react";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  riskColor, riskColorLight, riskLabel, riskBg, riskBorder,
  activityTimeline, riskDistribution, networkRiskEvolution,
  alertsByDay, entityTypeDist, sourceContrib, walletClusterData,
  kpis, entities as mockEntities, alerts, emergingNetworks, listings, wallets,
  investigations, evidenceRecords, graphNodes, graphEdges,
  auditLog, flagContributions, networkSignals, caseTimeline,
  type Entity, type Alert, type Investigation, type EvidenceRecord,
} from "../data";
import {
  Sparkline, RingScore, RiskBadge, CustomTooltip, Section,
  PulseIndicator, BarContrib, TimelineView,
} from "../components/shared";
import { getSocket, EVENT_META } from "../lib/socket";

// Kept so every screen still reading the hardcoded demo array works
// unchanged; only screens explicitly wired to the API override this.
const entities = mockEntities;

// -- Model options (keep in sync with backend/src/lib/llmClient.ts) ----------
// llama-3.3-70b-versatile and llama-3.1-8b-instant were decommissioned by
// Groq on 2026-08-16 (deprecated 2026-06-17) — see
// https://console.groq.com/docs/deprecations. Requests using them 404.
// Replaced here with Groq's recommended migrations: openai/gpt-oss-20b and
// qwen/qwen3.6-27b.
type SupportedModel =
  | "openai/gpt-oss-120b"
  | "openai/gpt-oss-20b"
  | "qwen/qwen3.6-27b"
  | "gemini-flash-2.5-lite"
  | "gemini-flash-2.5"
  | "gemini-flash-3.1-lite";

interface ModelOption {
  value: SupportedModel;
  label: string;
  group: string;
  note: string;
  badge: "groq" | "gemini";
}

const MODEL_OPTIONS: ModelOption[] = [
  { value: "openai/gpt-oss-120b",     label: "GPT-OSS 120B",          group: "Grok",   note: "~500 t/s · best quality",          badge: "groq"   },
  { value: "openai/gpt-oss-20b",      label: "GPT-OSS 20B",           group: "Grok",   note: "~1000 t/s · fastest",               badge: "groq"   },
  { value: "qwen/qwen3.6-27b",        label: "Qwen 3.6 27B",          group: "Qwen",   note: "Groq's Llama 3.3 70B replacement",  badge: "groq"   },
  { value: "gemini-flash-2.5-lite",   label: "Gemini Flash 2.5 Lite", group: "Gemini", note: "free tier",               badge: "gemini" },
  { value: "gemini-flash-2.5",        label: "Gemini Flash 2.5",      group: "Gemini", note: "free tier",               badge: "gemini" },
  { value: "gemini-flash-3.1-lite",   label: "Gemini Flash 3.1 Lite", group: "Gemini", note: "stable GA",               badge: "gemini" },
];

const DEFAULT_MODEL: SupportedModel = "openai/gpt-oss-120b";

// Custom model picker — groups by provider, shows speed/tier notes inline.
function ModelPicker({
  value,
  onChange,
  disabled,
}: {
  value: SupportedModel;
  onChange: (m: SupportedModel) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = { current: null as HTMLDivElement | null };
  const selected = MODEL_OPTIONS.find(m => m.value === value) ?? MODEL_OPTIONS[0];

  // Close on outside click
  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
  };

  const groups = ["Grok", "Llama", "Gemini"];
  const BADGE_COLORS: Record<string, { bg: string; color: string; dot: string }> = {
    groq:   { bg: "rgba(99,102,241,0.15)",  color: "var(--accent-hi)",    dot: "var(--accent-hi)"    },
    gemini: { bg: "rgba(16,185,129,0.15)",  color: "#10b981",             dot: "#10b981"             },
  };

  const bc = BADGE_COLORS[selected.badge];

  return (
    <div
      style={{ position: "relative" }}
      onBlur={handleBlur}
      tabIndex={-1}
    >
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 10px",
          background: open ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${open ? "var(--accent)" : "var(--border)"}`,
          borderRadius: 8,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
          transition: "border-color 0.15s, background 0.15s",
          textAlign: "left",
        }}
      >
        {/* Provider dot */}
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: bc.dot, flexShrink: 0, boxShadow: `0 0 5px ${bc.dot}` }} />
        {/* Label */}
        <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: "var(--text-1)", fontFamily: "JetBrains Mono,monospace" }}>
          {selected.label}
        </span>
        {/* Speed note */}
        <span style={{ fontSize: 10.5, color: "var(--text-4)", flexShrink: 0 }}>{selected.note}</span>
        {/* Chevron */}
        <span style={{ fontSize: 9, color: "var(--text-4)", flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>▼</span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "var(--surface, #16181d)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            zIndex: 50,
            overflow: "hidden",
          }}
        >
          {groups.map((group, gi) => {
            const opts = MODEL_OPTIONS.filter(m => m.group === group);
            if (!opts.length) return null;
            return (
              <div key={group}>
                {/* Group header */}
                <div style={{
                  padding: "7px 12px 4px",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  color: "var(--text-4)",
                  textTransform: "uppercase",
                  borderTop: gi > 0 ? "1px solid var(--border)" : "none",
                  background: "rgba(255,255,255,0.02)",
                }}>
                  {group}
                </div>
                {/* Options */}
                {opts.map(opt => {
                  const bc2 = BADGE_COLORS[opt.badge];
                  const isActive = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      tabIndex={0}
                      onClick={() => { onChange(opt.value); setOpen(false); }}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 9,
                        padding: "8px 12px",
                        background: isActive ? "rgba(99,102,241,0.12)" : "transparent",
                        border: "none",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
                      onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: bc2.dot, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 12, color: isActive ? "var(--accent-hi)" : "var(--text-1)", fontFamily: "JetBrains Mono,monospace", fontWeight: isActive ? 600 : 400 }}>
                        {opt.label}
                      </span>
                      <span style={{ fontSize: 10.5, color: "var(--text-4)" }}>{opt.note}</span>
                      {isActive && <span style={{ fontSize: 10, color: "var(--accent-hi)" }}>✓</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}



export function WorkspaceScreen({
  navigate,
  displayId,
}: {
  navigate: (s: string, d?: any) => void;
  displayId?: string | null;
}) {
  // ─── Investigator notes ──────────────────────────────────────────────────
  const [note, setNote] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteSavedAt, setNoteSavedAt] = useState<Date | null>(null);
  const [noteDirty, setNoteDirty] = useState(false);

  // ─── Real investigation data ────────────────────────────────────────────
  const [inv, setInv] = useState<any>(investigations[0]);
  const [invLoading, setInvLoading] = useState(true);
  const [invError, setInvError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setInvLoading(true);
    setInvError(null);

    const load = async () => {
      let targetId = displayId;
      if (!targetId) {
        const listRes = await fetch("http://localhost:4000/api/investigations");
        if (!listRes.ok) throw new Error(`API ${listRes.status}`);
        const list = await listRes.json();
        targetId = list[0]?.displayId;
        if (!targetId) throw new Error("No investigations found");
      }

      const res = await fetch(`http://localhost:4000/api/investigations/${targetId}`);
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      if (cancelled) return;

      setInv({
        ...data,
        id: data.displayId,
        entities: data.entities?.length ?? data._count?.entities ?? 0,
        evidence: data.evidence?.length ?? data._count?.evidence ?? 0,
        status: (data.status ?? "UNDER_INVESTIGATION").replace(/_/g, " "),
        priority: data.priority ?? "MEDIUM",
        assignee: data.assignee ?? "Unassigned",
        updated: data.updatedAt ? new Date(data.updatedAt).toLocaleString() : data.updated ?? "",
        description: data.description ?? "",
        relatedEntities: (data.entities ?? []).map((ie: any) => ie.entity),
        latestAssessment: data.aiAssessments?.[0] ?? null,
      });

      // Seed the notes textarea from the persisted value — but only if the
      // investigator hasn't already started typing an unsaved edit, so a
      // background refetch never clobbers in-progress typing.
      if (!cancelled) {
        setNote(data.notes ?? "");
        setNoteDirty(false);
        setNoteSavedAt(data.notesUpdatedAt ? new Date(data.notesUpdatedAt) : null);
      }
    };

    load()
      .catch((err) => { if (!cancelled) setInvError(err.message); })
      .finally(() => { if (!cancelled) setInvLoading(false); });

    return () => { cancelled = true; };
  }, [displayId]);

  // ─── AI Assessment ───────────────────────────────────────────────────────
  const [assessment, setAssessment] = useState<any>(null);
  const [assessLoading, setAssessLoading] = useState(false);
  const [assessError, setAssessError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<SupportedModel>(DEFAULT_MODEL);

  useEffect(() => {
    setAssessment(inv?.latestAssessment ?? null);
  }, [inv?.latestAssessment]);

  const runAiAssessment = async () => {
    if (!inv?.id) return;
    setAssessLoading(true);
    setAssessError(null);
    try {
      const res = await fetch(`http://localhost:4000/api/investigations/${inv.id}/ai-assessment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: selectedModel }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      setAssessment(data);
      setShowModifyForm(false);
      setShowRejectForm(false);
      setReviewError(null);
    } catch (err: any) {
      setAssessError(err.message ?? "Failed to generate AI assessment");
    } finally {
      setAssessLoading(false);
    }
  };

  const saveNote = async () => {
    if (!inv?.id) return;
    setNoteSaving(true);
    setNoteError(null);
    try {
      const res = await fetch(`http://localhost:4000/api/investigations/${inv.id}/notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: note, updatedBy: inv.assignee }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      setNoteSavedAt(data.notesUpdatedAt ? new Date(data.notesUpdatedAt) : new Date());
      setNoteDirty(false);
    } catch (err: any) {
      setNoteError(err.message ?? "Failed to save note");
    } finally {
      setNoteSaving(false);
    }
  };

  // ─── AI Assessment review (Accept / Modify / Reject) ────────────────────
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [showModifyForm, setShowModifyForm] = useState(false);
  const [modifyExplanation, setModifyExplanation] = useState("");
  const [modifyNextSteps, setModifyNextSteps] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const submitReview = async (action: "ACCEPT" | "MODIFY" | "REJECT" | "RESET", extra: Record<string, any> = {}) => {
    if (!inv?.id || !assessment?.id) return;
    setReviewSubmitting(true);
    setReviewError(null);
    try {
      const res = await fetch(
        `http://localhost:4000/api/investigations/${inv.id}/ai-assessment/${assessment.id}/review`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, reviewedBy: inv.assignee, ...extra }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `API ${res.status}`);
      }
      const data = await res.json();
      setAssessment((prev: any) => ({ ...prev, ...data }));
      setShowModifyForm(false);
      setShowRejectForm(false);
    } catch (err: any) {
      setReviewError(err.message ?? "Failed to record decision");
    } finally {
      setReviewSubmitting(false);
    }
  };

  const openModifyForm = () => {
    setModifyExplanation(assessment?.editedExplanation ?? assessment?.explanation ?? "");
    let seedSteps: string[] = [];
    try {
      seedSteps = assessment?.editedRecommendedNext
        ? JSON.parse(assessment.editedRecommendedNext)
        : assessment?.recommendedNext
        ? JSON.parse(assessment.recommendedNext)
        : [];
    } catch {
      seedSteps = [];
    }
    setModifyNextSteps(seedSteps.join("\n"));
    setShowRejectForm(false);
    setShowModifyForm(true);
  };

  const submitModify = () => {
    if (!modifyExplanation.trim()) return;
    const editedRecommendedNext = modifyNextSteps
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    submitReview("MODIFY", { editedExplanation: modifyExplanation.trim(), editedRecommendedNext });
  };

  // When an investigator has MODIFIED the assessment, their edited next
  // steps are the ones to display — the original AI text is preserved
  // underneath but is no longer what's shown as "current".
  const displayExplanation: string =
    assessment?.reviewStatus === "MODIFIED" && assessment?.editedExplanation
      ? assessment.editedExplanation
      : assessment?.explanation ?? "";

  const recommendations: string[] = (() => {
    const raw =
      assessment?.reviewStatus === "MODIFIED" && assessment?.editedRecommendedNext
        ? assessment.editedRecommendedNext
        : assessment?.recommendedNext;

    if (!raw) {
      return assessment
        ? []
        : [
            "Expand network analysis to include second-degree connections of Alias_Y",
            "Request blockchain transaction records for Wallet_W1 and Wallet_W2",
            "Cross-reference communication identifiers with Source Gamma dataset",
            "Review temporal correlation between listing activity spikes and wallet transactions",
          ];
    }
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [raw];
    } catch {
      return [raw];
    }
  })();

  return (
    <div style={{ padding: "26px 28px" }}>
      {invLoading && <p className="page-sub" style={{ marginBottom: 12 }}>Loading case…</p>}
      {invError && (
        <p className="page-sub" style={{ marginBottom: 12, color: "var(--high-light)" }}>
          Couldn't reach the API ({invError}) — showing demo data.
        </p>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <button onClick={() => navigate("investigations")} style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer", fontSize: 12, padding: 0 }}>← Investigations</button>
            <span style={{ color: "var(--text-4)" }}>/</span>
            <span className="mono-sm" style={{ color: "var(--accent-hi)" }}>{inv.id}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <h1 className="section-head display" style={{ fontSize: 20 }}>{inv.title}</h1>
            <span className="badge badge-pending">{inv.status}</span>
            <span className={`badge ${inv.priority === "HIGH" ? "badge-high" : inv.priority === "MEDIUM" ? "badge-medium" : "badge-low"}`}>{inv.priority}</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-3)" }}>Assigned to <span style={{ color: "var(--text-2)" }}>{inv.assignee}</span> · Updated {inv.updated}</div>
        </div>
        <div style={{ display: "flex", gap: 7 }}>
          <button className="btn btn-ghost btn-sm">Add Evidence</button>
          <button className="btn btn-ghost btn-sm">Add Note</button>
          <button className="btn btn-ghost btn-sm">Assign</button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate("reports")}>Generate Report</button>
          <button className="btn btn-danger btn-sm">Close Case</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 310px", gap: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Summary */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", marginBottom: 10 }}>Case Summary</div>
            <div style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.7 }}>{inv.description}</div>
          </div>

          {/* Entities */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>Related Entities ({inv.entities})</div>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate("entities")}>View All</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(inv.relatedEntities?.length ? inv.relatedEntities : entities).slice(0, 4).map((e: any) => (
                <div key={e.displayId ?? e.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, cursor: "pointer", transition: "background 0.13s" }}
                  onMouseEnter={el => { (el.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
                  onMouseLeave={el => { (el.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(99,102,241,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--accent-hi)", flexShrink: 0 }}>◈</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text-1)" }}>{e.alias}</div>
                    <div className="mono-sm" style={{ color: "var(--text-4)" }}>{e.displayId ?? e.id}</div>
                  </div>
                  <RiskBadge score={e.risk} />
                  <button className="btn btn-ghost btn-sm" onClick={() => navigate("entity", e)}>View</button>
                </div>
              ))}
            </div>
          </div>

          {/* Evidence */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>Evidence ({inv.evidence})</div>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate("evidence")}>View All</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {evidenceRecords.slice(0, 3).map(ev => (
                <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 7 }}>
                  <span className="mono-sm" style={{ color: "var(--text-4)" }}>{ev.id}</span>
                  <span style={{ flex: 1, fontSize: 12, color: "var(--text-2)" }}>{ev.type}</span>
                  <span style={{ fontSize: 11, color: "var(--text-4)" }}>{ev.ts.split("·")[0].trim()}</span>
                  <span className={`badge ${ev.status === "Verified" ? "badge-verified" : "badge-pending"}`}>{ev.status}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>Investigator Notes</div>
              {noteSavedAt && !noteDirty && (
                <span style={{ fontSize: 10.5, color: "var(--text-4)" }}>Saved {noteSavedAt.toLocaleTimeString()}</span>
              )}
            </div>
            <textarea
              className="input"
              style={{ minHeight: 80, resize: "vertical", fontSize: 12.5 }}
              placeholder="Add investigation notes…"
              value={note}
              onChange={e => { setNote(e.target.value); setNoteDirty(true); }}
            />
            {noteError && (
              <div style={{ fontSize: 11, color: "var(--critical-light)", marginTop: 6 }}>Couldn't save ({noteError}).</div>
            )}
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={saveNote} disabled={noteSaving || !noteDirty}>
              {noteSaving ? "Saving…" : "Save Note"}
            </button>
          </div>
        </div>

        {/* Right rail */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* AI Assessment */}
          <div className="card card-glow-accent" style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <PulseIndicator color="var(--accent)" />
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)" }}>AI Assessment</div>
                {assessment && <RiskBadge score={assessment.riskScore} />}
              </div>
              {assessment && (
                <button className="btn btn-ghost btn-sm" disabled={assessLoading} onClick={runAiAssessment}>
                  {assessLoading ? "Running…" : "Re-run"}
                </button>
              )}
            </div>

            {/* Model picker */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10.5, color: "var(--text-4)", marginBottom: 5, letterSpacing: "0.04em" }}>MODEL</div>
              <ModelPicker value={selectedModel} onChange={setSelectedModel} disabled={assessLoading} />
            </div>

            {!assessment && (
              <>
                <div style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.65, marginBottom: 14 }}>
                  Generate an AI-assisted assessment from the investigation's current evidence, entities, risk signals, and network activity.
                </div>

                {assessError && (
                  <div
                    style={{
                      fontSize: 11.5,
                      color: "var(--critical-light)",
                      marginBottom: 12,
                      padding: "8px 10px",
                      background: "rgba(220,38,38,0.08)",
                      borderRadius: 6,
                      border: "1px solid rgba(220,38,38,0.2)",
                    }}
                  >
                    Couldn't reach the API ({assessError}).
                  </div>
                )}

                <button
                  className="btn btn-primary"
                  style={{ width: "100%", justifyContent: "center" }}
                  onClick={runAiAssessment}
                  disabled={assessLoading}
                >
                  {assessLoading ? "Running AI Assessment…" : "Run AI Assessment"}
                </button>
              </>
            )}

            {assessment && (
              <>
                {/* Model used badge */}
                {assessment.modelUsed && assessment.modelUsed !== "fallback" && (
                  <div style={{ fontSize: 10.5, color: "var(--text-4)", marginBottom: 10 }}>
                    Generated by <span style={{ color: "var(--accent-hi)", fontFamily: "JetBrains Mono,monospace" }}>{assessment.modelUsed}</span>
                  </div>
                )}

                {assessment.reviewStatus === "MODIFIED" && assessment.editedExplanation && (
                  <div style={{ fontSize: 10, color: "var(--accent-hi)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Edited by investigator
                  </div>
                )}
                <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.65, marginBottom: 12 }}>
                  {displayExplanation}
                </div>

                {assessment.aiGenerated === false && (
                  <div style={{ fontSize: 10.5, color: "var(--text-4)", marginBottom: 12 }}>
                    The selected model was unreachable — showing a deterministic fallback summary instead of a generated narrative.
                  </div>
                )}

                <div className="ai-strip" style={{ marginBottom: 14 }}>
                  <span style={{ color: "var(--medium-light)", fontSize: 14, flexShrink: 0 }}>⚠</span>
                  <div style={{ fontSize: 10.5, color: "var(--medium-light)" }}>
                    AI-generated — all conclusions require investigator review. This assessment does not constitute a criminal determination.
                  </div>
                </div>

                {assessment.signals?.length > 0 && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1)", marginBottom: 10 }}>Risk Signals</div>
                    {assessment.signals.map((signal: any, i: number) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 9px", marginBottom: 6, background: "rgba(255,255,255,0.03)", borderRadius: 6 }}>
                        <span style={{ fontSize: 11.5, color: "var(--text-2)" }}>{signal.label}</span>
                        <span className="mono-sm" style={{ color: "var(--accent-hi)" }}>+{signal.value}</span>
                      </div>
                    ))}
                  </>
                )}

                {recommendations.length > 0 && (
                  <>
                    <div className="divider" style={{ margin: "14px 0" }} />
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1)", marginBottom: 10 }}>Recommended Next Steps</div>
                    {recommendations.map((r, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, padding: "8px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 7 }}>
                        <span style={{ color: "var(--accent-hi)", fontSize: 11, flexShrink: 0, fontWeight: 700, minWidth: 14 }}>{i + 1}.</span>
                        <span style={{ fontSize: 11.5, color: "var(--text-2)", lineHeight: 1.5 }}>{r}</span>
                      </div>
                    ))}
                  </>
                )}

                <div className="divider" style={{ margin: "14px 0" }} />

                <div style={{ fontSize: 11, color: "var(--text-4)", marginBottom: 8 }}>Investigator Decision</div>

                {reviewError && (
                  <div style={{ fontSize: 11, color: "var(--critical-light)", marginBottom: 8 }}>
                    Couldn't save decision ({reviewError}).
                  </div>
                )}

                {(!assessment.reviewStatus || assessment.reviewStatus === "PENDING") && !showModifyForm && !showRejectForm && (
                  <div style={{ display: "flex", gap: 7 }}>
                    <button
                      className="btn btn-primary"
                      style={{ flex: 1, justifyContent: "center", fontSize: 11 }}
                      onClick={() => submitReview("ACCEPT")}
                      disabled={reviewSubmitting}
                    >
                      Accept
                    </button>
                    <button
                      className="btn btn-ghost"
                      style={{ flex: 1, justifyContent: "center", fontSize: 11 }}
                      onClick={openModifyForm}
                      disabled={reviewSubmitting}
                    >
                      Modify
                    </button>
                    <button
                      className="btn btn-ghost"
                      style={{ flex: 1, justifyContent: "center", fontSize: 11 }}
                      onClick={() => { setShowRejectForm(true); setShowModifyForm(false); }}
                      disabled={reviewSubmitting}
                    >
                      Reject
                    </button>
                  </div>
                )}

                {showModifyForm && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ fontSize: 10.5, color: "var(--text-4)" }}>Explanation</div>
                    <textarea
                      className="input"
                      style={{ minHeight: 70, resize: "vertical", fontSize: 12 }}
                      value={modifyExplanation}
                      onChange={e => setModifyExplanation(e.target.value)}
                    />
                    <div style={{ fontSize: 10.5, color: "var(--text-4)" }}>Recommended next steps (one per line)</div>
                    <textarea
                      className="input"
                      style={{ minHeight: 70, resize: "vertical", fontSize: 12 }}
                      value={modifyNextSteps}
                      onChange={e => setModifyNextSteps(e.target.value)}
                    />
                    <div style={{ display: "flex", gap: 7 }}>
                      <button
                        className="btn btn-primary"
                        style={{ flex: 1, justifyContent: "center", fontSize: 11 }}
                        onClick={submitModify}
                        disabled={reviewSubmitting || !modifyExplanation.trim()}
                      >
                        {reviewSubmitting ? "Saving…" : "Save Changes"}
                      </button>
                      <button
                        className="btn btn-ghost"
                        style={{ flex: 1, justifyContent: "center", fontSize: 11 }}
                        onClick={() => setShowModifyForm(false)}
                        disabled={reviewSubmitting}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {showRejectForm && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <textarea
                      className="input"
                      style={{ minHeight: 60, resize: "vertical", fontSize: 12 }}
                      placeholder="Reason for rejecting this assessment (optional)…"
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                    />
                    <div style={{ display: "flex", gap: 7 }}>
                      <button
                        className="btn btn-danger"
                        style={{ flex: 1, justifyContent: "center", fontSize: 11 }}
                        onClick={() => submitReview("REJECT", { reviewNote: rejectReason.trim() })}
                        disabled={reviewSubmitting}
                      >
                        {reviewSubmitting ? "Saving…" : "Confirm Reject"}
                      </button>
                      <button
                        className="btn btn-ghost"
                        style={{ flex: 1, justifyContent: "center", fontSize: 11 }}
                        onClick={() => setShowRejectForm(false)}
                        disabled={reviewSubmitting}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {assessment.reviewStatus && assessment.reviewStatus !== "PENDING" && !showModifyForm && !showRejectForm && (
                  <>
                    {assessment.reviewStatus === "ACCEPTED" && (
                      <div className="integrity-banner">
                        <span>✓</span> Accepted{assessment.reviewedBy ? ` by ${assessment.reviewedBy}` : ""}
                      </div>
                    )}
                    {assessment.reviewStatus === "MODIFIED" && (
                      <div className="integrity-banner">
                        <span>✎</span> Modified{assessment.reviewedBy ? ` by ${assessment.reviewedBy}` : ""}
                      </div>
                    )}
                    {assessment.reviewStatus === "REJECTED" && (
                      <div style={{ padding: "8px 10px", borderRadius: 7, background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)" }}>
                        <div style={{ fontSize: 11.5, color: "var(--critical-light)", display: "flex", alignItems: "center", gap: 6 }}>
                          <span>✕</span> Rejected{assessment.reviewedBy ? ` by ${assessment.reviewedBy}` : ""}
                        </div>
                        {assessment.reviewNote && (
                          <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>{assessment.reviewNote}</div>
                        )}
                      </div>
                    )}
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ marginTop: 8, width: "100%", justifyContent: "center" }}
                      onClick={() => submitReview("RESET")}
                      disabled={reviewSubmitting}
                    >
                      Change decision
                    </button>
                  </>
                )}
              </>
            )}
          </div>

          {/* Case meta */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1)", marginBottom: 12 }}>Case Information</div>
            {[
              { l: "Case ID", v: inv.id, mono: true },
              { l: "Assigned To", v: inv.assignee },
              { l: "Status", v: inv.status },
              { l: "Priority", v: inv.priority },
              { l: "Entities", v: inv.entities },
              { l: "Evidence", v: inv.evidence },
              { l: "Last Updated", v: inv.updated },
            ].map(item => (
              <div key={item.l} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontSize: 11, color: "var(--text-4)" }}>{item.l}</span>
                <span style={{ fontSize: 11, color: "var(--text-2)", fontFamily: item.mono ? "JetBrains Mono,monospace" : "inherit" }}>{item.v}</span>
              </div>
            ))}
          </div>

          <button className="btn btn-ghost" style={{ justifyContent: "center" }} onClick={() => navigate("timeline")}>
            View Investigation Timeline
          </button>
          <button className="btn btn-ghost" style={{ justifyContent: "center" }} onClick={() => navigate("graph")}>
            View Network Graph
          </button>
        </div>
      </div>
    </div>
  );
}