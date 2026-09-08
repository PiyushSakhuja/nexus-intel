import { useState, useEffect } from "react";
import { apiGet, apiPost, apiPatch } from "../lib/api";
import { EVIDENCE_TYPES } from "../components/shared";

export function EvidenceScreen({ selectedId }: { selectedId?: string | null }) {
  const [evidenceRows, setEvidenceRows] = useState<any[]>([]);
  const [evidenceLoading, setEvidenceLoading] = useState(true);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [sel, setSel] = useState<any | null>(null);
  const [custody, setCustody] = useState<any[]>([]);
  const [custodyLoading, setCustodyLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // ── Add Evidence modal state ─────────────────────────────────────────────
  const [showAddModal, setShowAddModal] = useState(false);
  const [invOptions, setInvOptions] = useState<{ id: string; displayId: string; title: string }[]>([]);
  const [sourceOptions, setSourceOptions] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({ type: "Intelligence Record", content: "", uploadedBy: "Investigator A", investigationId: "", sourceId: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fetchEvidence = () => {
    apiGet<any[]>("/api/evidence")
      .then(data => {
        const normalised = data.map((ev: any) => ({
          ...ev,
          id: ev.displayId ?? ev.id,
          type: ev.type ?? "Document",
          source: ev.source?.name ?? ev.source ?? "Unknown",
          ts: ev.createdAt ? new Date(ev.createdAt).toLocaleString() : ev.ts ?? "",
          hash: ev.hash ?? "—",
          caseRef: ev.investigation?.displayId ?? ev.investigationId ?? ev.caseRef ?? "—",
          notes: ev.notes ?? null,
          by: ev.uploadedBy ?? ev.by ?? "System",
          status: ev.status ? ev.status.charAt(0) + ev.status.slice(1).toLowerCase() : "Pending",
        }));
        setEvidenceRows(normalised);
        setEvidenceError(null);
      })
      .catch(err => setEvidenceError(err.message))
      .finally(() => setEvidenceLoading(false));
  };

  useEffect(() => {
    fetchEvidence();

    // Populate the modal's dropdowns once, up front.
    apiGet<any[]>("/api/investigations")
      .then(data => setInvOptions(
        data
          .filter((i: any) => i.status !== "CLOSED")
          .map((i: any) => ({
            id: i.id,
            displayId: i.displayId ?? i.id,
            title: i.title,
          }))
      ))
      .catch(() => { });
    apiGet<any[]>("/api/sources")
      .then(data => {
        setSourceOptions(data.map((s: any) => ({ id: s.id, name: s.name })));
        setForm(f => f.sourceId || !data.length ? f : { ...f, sourceId: data[0].id });
      })
      .catch(() => { });
  }, []);

  // Auto-select evidence when navigated from workspace with a selectedId
  useEffect(() => {
    if (!selectedId || evidenceRows.length === 0) return;
    const match = evidenceRows.find(ev => ev.id === selectedId);
    if (match) {
      setSel(match);
      // Scroll the row into view after a short paint delay
      setTimeout(() => {
        const el = document.querySelector(`[data-ev-id="${selectedId}"]`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 80);
    }
  }, [selectedId, evidenceRows]);

  // Real chain-of-custody: pulls the audit log entries whose `resource`
  // matches this evidence record's displayId, instead of three fabricated
  // "Evidence collected / Integrity verified / Added to case" lines that
  // always showed the same fixed script regardless of what actually
  // happened to the record.
  useEffect(() => {
    if (!sel) { setCustody([]); return; }
    setCustodyLoading(true);
    apiGet<any[]>("/api/audit-log")
      .then(data => {
        setCustody(
          data
            .filter((entry: any) => entry.resource === sel.id)
            .sort((a: any, b: any) => new Date(a.createdAt ?? a.ts).getTime() - new Date(b.createdAt ?? b.ts).getTime())
        );
      })
      .catch(() => setCustody([]))
      .finally(() => setCustodyLoading(false));
  }, [sel?.id]);

  const verifyEvidence = async (status: "VERIFIED" | "REJECTED") => {
    if (!sel) return;
    setVerifying(true);
    try {
      const updated = await apiPatch<any>(`/api/evidence/${encodeURIComponent(sel.id)}/status`, {
        status,
        reviewedBy: form.uploadedBy || "Investigator A",
      });
      setSel((s: any) => s ? { ...s, status: status.charAt(0) + status.slice(1).toLowerCase() } : s);
      fetchEvidence();
    } catch (err) {
      // surfaced inline below rather than blocking the whole screen
    } finally {
      setVerifying(false);
    }
  };

  const openAddModal = () => {
    setSubmitError(null);
    setForm(f => ({ ...f, investigationId: f.investigationId || invOptions[0]?.id || "" }));
    setShowAddModal(true);
  };

  const submitEvidence = async () => {
    if (!form.content.trim()) { setSubmitError("Content is required — it's what gets hashed."); return; }
    if (!form.investigationId) { setSubmitError("Select an investigation to attach this evidence to."); return; }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await apiPost("/api/evidence", form);
      setShowAddModal(false);
      setForm(f => ({ ...f, content: "" }));
      fetchEvidence(); // refresh the table with the new row
    } catch (err: any) {
      setSubmitError(err.message ?? "Failed to submit evidence");
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <div style={{ padding: "26px 28px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
        <div>
          <h1 className="section-head">Evidence Repository</h1>
          <p className="page-sub">Verified evidence with integrity tracking and chain-of-custody audit trail.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={openAddModal}>+ Add Evidence</button>
        </div>
      </div>

      {evidenceLoading && <p className="page-sub" style={{ marginBottom: 12 }}>Loading evidence…</p>}
      {evidenceError && <p className="page-sub" style={{ marginBottom: 12, color: "var(--high-light)" }}>Couldn't reach the API ({evidenceError}).</p>}
      {!evidenceLoading && !evidenceError && evidenceRows.length === 0 && <p className="page-sub" style={{ marginBottom: 12 }}>No evidence recorded yet.</p>}
      <div style={{ display: "grid", gridTemplateColumns: sel ? "1fr 380px" : "1fr", gap: 16, transition: "all 0.25s" }}>
        <div className="card">
          <table className="data-table">
            <thead><tr><th>ID</th><th>Type</th><th>Source</th><th>Timestamp</th><th>SHA-256 (partial)</th><th>Case</th><th>By</th><th>Status</th></tr></thead>
            <tbody>
              {evidenceRows.map(ev => (
                <tr key={ev.id} data-ev-id={ev.id} className={sel?.id === ev.id ? "selected" : ""} onClick={() => setSel(ev.id === sel?.id ? null : ev)}>
                  <td><span className="mono" style={{ color: "var(--accent-hi)", fontSize: 12 }}>{ev.id}</span></td>
                  <td>{ev.type}</td>
                  <td>{ev.source}</td>
                  <td style={{ fontSize: 11 }}>{ev.ts}</td>
                  <td><span className="mono-sm" style={{ color: "var(--text-4)" }}>{ev.hash.slice(0, 14)}…</span></td>
                  <td><span className="mono-sm" style={{ color: "var(--accent-hi)" }}>{ev.caseRef}</span></td>
                  <td>{ev.by}</td>
                  <td><span className={`badge ${ev.status === "Verified" ? "badge-verified" : "badge-pending"}`}>{ev.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sel && (
          <div className="card anim-slide-r" style={{ padding: 20, height: "fit-content" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>Evidence Details</div>
              <button onClick={() => setSel(null)} style={{ background: "none", border: "none", color: "var(--text-4)", cursor: "pointer", fontSize: 20 }}>×</button>
            </div>

            <div className="mono" style={{ fontSize: 11, color: "var(--accent-hi)", marginBottom: 12 }}>{sel.id}</div>

            {sel.status === "Verified" ? (
              <div className="integrity-banner" style={{ marginBottom: 14 }}>
                <span style={{ fontSize: 15 }}>✓</span> Integrity Verified
              </div>
            ) : sel.status === "Rejected" ? (
              <div style={{ marginBottom: 14, padding: "8px 12px", background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 7, fontSize: 12, color: "var(--critical-light)", fontWeight: 600 }}>
                ✕ Rejected
              </div>
            ) : (
              <div style={{ marginBottom: 14, padding: "8px 12px", background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.2)", borderRadius: 7, fontSize: 12, color: "var(--medium-light)", fontWeight: 600 }}>
                ◷ Pending Verification
              </div>
            )}

            {[
              { l: "Type", v: sel.type }, { l: "Source", v: sel.source },
              { l: "Timestamp", v: sel.ts }, { l: "Related Case", v: sel.caseRef, mono: true },
              { l: "Uploaded By", v: sel.by }, { l: "Status", v: sel.status },
            ].map(item => (
              <div key={item.l} style={{ display: "flex", flexDirection: "column", gap: 3, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontSize: 10, color: "var(--text-4)" }}>{item.l}</span>
                <span style={{ fontSize: 12, color: "var(--text-2)", fontFamily: item.mono ? "JetBrains Mono,monospace" : "inherit" }}>{item.v}</span>
              </div>
            ))}

            <div style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ fontSize: 10, color: "var(--text-4)", marginBottom: 4 }}>SHA-256 Hash</div>
              <div className="hash-block">{sel.hash}</div>
            </div>

            {sel.notes && (
              <div style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                <div style={{ fontSize: 10, color: "var(--text-4)", marginBottom: 4 }}>Notes</div>
                <div style={{ fontSize: 12, color: "var(--text-2)", whiteSpace: "pre-wrap" }}>{sel.notes}</div>
              </div>
            )}

            <div style={{ marginTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Chain of Custody</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {sel.status !== "Verified" && (
                    <button className="btn btn-primary btn-sm" disabled={verifying} onClick={() => verifyEvidence("VERIFIED")} style={{ fontSize: 11 }}>
                      {verifying ? "…" : "✓ Mark Verified"}
                    </button>
                  )}
                  {sel.status !== "Pending" && sel.status !== "Rejected" && (
                    <button className="btn btn-ghost btn-sm" disabled={verifying} onClick={() => verifyEvidence("REJECTED")} style={{ fontSize: 11 }}>
                      {verifying ? "…" : "✕ Reject"}
                    </button>
                  )}
                  {sel.status !== "Pending" && (
                    <button className="btn btn-ghost btn-sm" disabled={verifying} onClick={async () => {
                      setVerifying(true);
                      try {
                        await apiPatch(`/api/evidence/${encodeURIComponent(sel.id)}/status`, { status: "PENDING", reviewedBy: form.uploadedBy || "Investigator A" });
                        setSel((s: any) => s ? { ...s, status: "Pending" } : s);
                        fetchEvidence();
                      } finally { setVerifying(false); }
                    }} style={{ fontSize: 11 }}>
                      {verifying ? "…" : "◷ Mark Pending"}
                    </button>
                  )}
                </div>
              </div>
              {custodyLoading && <div style={{ fontSize: 11.5, color: "var(--text-4)" }}>Loading custody trail…</div>}
              {!custodyLoading && custody.length === 0 && (
                <div style={{ fontSize: 11.5, color: "var(--text-4)" }}>No audit events recorded for this evidence yet.</div>
              )}
              {!custodyLoading && custody.map((c, i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", marginTop: 4, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 11.5, color: "var(--text-2)" }}>{c.action}</div>
                    <div style={{ fontSize: 10.5, color: "var(--text-4)" }}>{c.user} · {c.createdAt ? new Date(c.createdAt).toLocaleString() : c.ts}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showAddModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
          onClick={() => !submitting && setShowAddModal(false)}
        >
          <div
            className="card"
            style={{ width: 440, padding: 24, maxHeight: "85vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>Add Evidence</div>
              <button onClick={() => setShowAddModal(false)} style={{ background: "none", border: "none", color: "var(--text-4)", cursor: "pointer", fontSize: 20, lineHeight: 1 }}>×</button>
            </div>

            <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 16, lineHeight: 1.5 }}>
              A SHA-256 hash is computed server-side from the content below — this is what
              gives the evidence record its integrity guarantee, so paste the actual
              content (a note, a transcript, a record) rather than just a description.
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 10, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>Type</label>
              <select className="input" style={{ padding: "7px 10px", fontSize: 12 }} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                {EVIDENCE_TYPES.map(t => (
                  <option key={t.value} value={t.value} style={{ background: "#0f1420" }}>{t.value}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 10, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>Investigation</label>
              <select className="input" style={{ padding: "7px 10px", fontSize: 12 }} value={form.investigationId} onChange={e => setForm(f => ({ ...f, investigationId: e.target.value }))}>
                {invOptions.length === 0 && <option style={{ background: "#0f1420" }}>No investigations found</option>}
                {invOptions.map(inv => (
                  <option key={inv.id} value={inv.id} style={{ background: "#0f1420" }}>{inv.displayId} — {inv.title}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 10, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>Source</label>
              <select className="input" style={{ padding: "7px 10px", fontSize: 12 }} value={form.sourceId} onChange={e => setForm(f => ({ ...f, sourceId: e.target.value }))}>
                {sourceOptions.map(s => (
                  <option key={s.id} value={s.id} style={{ background: "#0f1420" }}>{s.name}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 10, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>Uploaded By</label>
              <input className="input" style={{ padding: "7px 10px", fontSize: 12 }} value={form.uploadedBy} onChange={e => setForm(f => ({ ...f, uploadedBy: e.target.value }))} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 10, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>Content (this gets hashed)</label>
              <textarea
                className="input"
                style={{ minHeight: 100, resize: "vertical", fontSize: 12.5 }}
                placeholder="Paste the record content, transcript, or note here…"
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              />
            </div>

            {submitError && (
              <div style={{ fontSize: 11.5, color: "var(--critical-light)", marginBottom: 12, padding: "8px 10px", background: "rgba(220,38,38,0.08)", borderRadius: 6, border: "1px solid rgba(220,38,38,0.2)" }}>
                {submitError}
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => setShowAddModal(false)} disabled={submitting}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }} onClick={submitEvidence} disabled={submitting}>
                {submitting ? "Hashing & saving…" : "Add Evidence"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}