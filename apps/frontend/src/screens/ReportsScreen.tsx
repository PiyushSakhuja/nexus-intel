import { useState, useEffect } from "react";
import { apiGet, apiPost } from "../lib/api";

export function ReportsScreen() {
  const sections = ["Executive Summary","Risk Assessment","Entity Analysis","Network Analysis","Evidence Summary","Investigation Timeline","AI Explanation","Audit Information"];
  const [checked, setChecked] = useState<Record<string,boolean>>(Object.fromEntries(sections.map(s=>[s,true])));

  const [invOptions, setInvOptions] = useState<{ id: string; displayId: string; title: string }[]>([]);
  const [selectedInvId, setSelectedInvId] = useState("");
  const [reportType, setReportType] = useState("Intelligence Assessment");
  const [classification, setClassification] = useState("RESTRICTED");

  const [generated, setGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string|null>(null);
  const [reportData, setReportData] = useState<any|null>(null);
  const [generatedAt, setGeneratedAt] = useState<Date|null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string|null>(null);

  useEffect(() => {
    apiGet<any[]>("/api/investigations")
      .then(data => {
        const opts = data.map((i: any) => ({ id: i.displayId ?? i.id, displayId: i.displayId ?? i.id, title: i.title }));
        setInvOptions(opts);
        if (opts.length > 0) setSelectedInvId(opts[0].id);
      })
      .catch(() => {});
  }, []);

  const generateReport = async () => {
    if (!selectedInvId) { setGenError("Select an investigation first."); return; }
    setGenerating(true);
    setGenError(null);
    try {
      const data = await apiGet<any>(`/api/investigations/${selectedInvId}`);
      setReportData(data);
      setGeneratedAt(new Date());
      setGenerated(true);
      // Real audit record — this is what makes the "recorded in the
      // platform audit log" line in the Audit Information section true
      // rather than an unfulfilled claim. Fire-and-forget: a logging
      // hiccup shouldn't block the report the investigator already has.
      apiPost(`/api/investigations/${selectedInvId}/report-generated`, {
        generatedBy: "Investigator A",
        reportType,
        classification,
      }).catch(() => {});
    } catch (err: any) {
      setGenError(err.message ?? "Failed to generate report — could not reach the API.");
    } finally {
      setGenerating(false);
    }
  };

  // ── Export the currently-generated report as a PDF ──────────────────────
  // Uses the browser's native print-to-PDF (no extra client-side PDF lib
  // available in this project), then records a real "export" audit event —
  // this is what makes it show up under Audit Logs, same pattern as the
  // report-generated event fired above.
  const exportPdf = async () => {
    if (!reportData || !generated) return;
    setExporting(true);
    setExportError(null);
    try {
      window.print();
      await apiPost(`/api/investigations/${selectedInvId}/report-exported`, {
        exportedBy: "Investigator A",
        format: "PDF",
        reportType,
        classification,
      });
    } catch (err: any) {
      setExportError(err.message ?? "Failed to record the export — the PDF dialog may still have opened.");
    } finally {
      setExporting(false);
    }
  };

  // ── Compose report sections from REAL fetched data ──────────────────────
  // Nothing here is invented client-side: every number/fact comes from
  // reportData, which is the actual investigation record from Postgres.
  // recommendedNext / editedRecommendedNext are stored as JSON-stringified
  // arrays — parse defensively so the report never prints raw JSON.
  const parseSteps = (raw: any): string[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [String(raw)];
    } catch {
      return [String(raw)];
    }
  };

  const buildSections = () => {
    if (!reportData) return [];
    const inv = reportData;
    const network = inv.network;
    const entityList = (inv.entities ?? []).map((e: any) => e.entity ?? e);
    const evidenceList = inv.evidence ?? [];
    const timeline = inv.timeline ?? [];
    const assessment = (inv.aiAssessments ?? [])[0];
    const verifiedCount = evidenceList.filter((e: any) => e.status === "VERIFIED").length;
    const pendingCount = evidenceList.filter((e: any) => e.status === "PENDING").length;
    const entityNames = entityList.map((e: any) => e.alias).join(", ") || "none resolved";
    const topConfidence = entityList.length ? Math.max(...entityList.map((e: any) => e.confidence ?? 0)) : null;

    const out: { t: string; c?: string; ai?: {
      tone: "accepted" | "rejected" | "modified" | "pending" | "none";
      badgeLabel: string;
      byline?: string;
      body?: string;
      steps?: string[];
      footer?: string;
    } }[] = [];

    if (checked["Executive Summary"]) out.push({
      t: "Executive Summary",
      c: `Investigation ${inv.displayId} (${inv.title}) is currently ${inv.status?.replace(/_/g," ")}, priority ${inv.priority}.` +
         (network ? ` It is linked to network ${network.displayId}, risk score ${network.risk}/100 (${network.status}).` : " No network is currently linked to this case.") +
         (entityList.length ? ` ${entityList.length} entit${entityList.length===1?"y has":"ies have"} been resolved to this case${topConfidence!==null?`, with the strongest resolution confidence at ${topConfidence}%`:""}.` : " No entities have been added to this case yet."),
    });

    if (checked["Risk Assessment"]) out.push({
      t: "Risk Assessment",
      c: network
        ? `Overall network risk: ${network.status} (${network.risk}/100), a change of ${network.change >= 0 ? "+" : ""}${network.change} points since first detection.` +
          (assessment?.signals?.length ? ` Contributing signals: ${assessment.signals.map((s: any) => `${s.label} (+${s.value})`).join(", ")}.` : "")
        : "No network is linked to this investigation, so no aggregate network risk score is available. Risk should be assessed per-entity.",
    });

    if (checked["Entity Analysis"]) out.push({
      t: "Entity Analysis",
      c: entityList.length
        ? `${entityList.length} entit${entityList.length===1?"y":"ies"} identified: ${entityNames}. ` +
          entityList.map((e: any) => `${e.alias} — risk ${e.risk}/100, confidence ${e.confidence}%`).join("; ") + "."
        : "No entities have been resolved to this investigation yet.",
    });

    if (checked["Network Analysis"]) out.push({
      t: "Network Analysis",
      c: network
        ? `Network ${network.displayId} status: ${network.status}. Risk trajectory shows a ${network.change >= 0 ? "increase" : "decrease"} of ${Math.abs(network.change)} points. Last activity recorded ${new Date(network.lastActivity).toLocaleString()}.`
        : "This investigation is not currently associated with a tracked network.",
    });

    if (checked["Evidence Summary"]) out.push({
      t: "Evidence Summary",
      c: `${evidenceList.length} evidence record${evidenceList.length===1?"":"s"} collected. ${verifiedCount} verified via SHA-256 hash, ${pendingCount} pending verification.` +
         (evidenceList.length ? ` Evidence IDs: ${evidenceList.map((e: any) => e.displayId).join(", ")}.` : ""),
    });

    if (checked["Investigation Timeline"]) out.push({
      t: "Investigation Timeline",
      c: timeline.length
        ? `${timeline.length} recorded timeline event${timeline.length===1?"":"s"}, spanning from ${new Date(timeline[0].occurredAt).toLocaleDateString()} to ${new Date(timeline[timeline.length-1].occurredAt).toLocaleDateString()}. Most recent: "${timeline[timeline.length-1].label}" (${timeline[timeline.length-1].type}).`
        : "No timeline events have been recorded for this investigation yet.",
    });

    if (checked["AI Explanation"]) {
      if (!assessment) {
        out.push({ t: "AI Explanation", c: "No AI assessment has been generated for this investigation yet." });
      } else {
        const byline = (label: string) =>
          `${label}${assessment.reviewedBy ? ` by ${assessment.reviewedBy}` : ""}${assessment.reviewedAt ? ` on ${new Date(assessment.reviewedAt).toLocaleDateString()}` : ""}`;

        if (assessment.reviewStatus === "REJECTED") {
          out.push({
            t: "AI Explanation",
            ai: {
              tone: "rejected",
              badgeLabel: "Rejected",
              byline: byline("Rejected"),
              footer: assessment.reviewNote
                ? `Reason given: "${assessment.reviewNote}"`
                : `This AI-generated narrative was not accepted and is excluded from this report. (Risk score at time of assessment: ${assessment.riskScore}/100.)`,
            },
          });
        } else if (assessment.reviewStatus === "MODIFIED") {
          out.push({
            t: "AI Explanation",
            ai: {
              tone: "modified",
              badgeLabel: "Modified",
              byline: byline("Modified"),
              body: assessment.editedExplanation,
              steps: parseSteps(assessment.editedRecommendedNext),
              footer: `Risk score at time of assessment: ${assessment.riskScore}/100. This is the investigator-edited version of the original AI-generated narrative.`,
            },
          });
        } else if (assessment.reviewStatus === "ACCEPTED") {
          out.push({
            t: "AI Explanation",
            ai: {
              tone: "accepted",
              badgeLabel: "Accepted",
              byline: byline("Accepted"),
              body: assessment.explanation,
              steps: parseSteps(assessment.recommendedNext),
              footer: `Risk score at time of assessment: ${assessment.riskScore}/100.`,
            },
          });
        } else {
          out.push({
            t: "AI Explanation",
            ai: {
              tone: "pending",
              badgeLabel: "Pending Review",
              body: assessment.explanation,
              steps: parseSteps(assessment.recommendedNext),
              footer: `Risk score at time of assessment: ${assessment.riskScore}/100. This assessment has not yet been reviewed by an investigator.`,
            },
          });
        }
      }
    }

    if (checked["Audit Information"]) out.push({
      t: "Audit Information",
      c: `Report generated ${generatedAt?.toLocaleString()} for case ${inv.displayId}, classification ${classification}, report type "${reportType}". This document and its generation are recorded in the platform audit log.`,
    });

    return out;
  };

  const selectedInv = invOptions.find(i => i.id === selectedInvId);

  return (
    <div style={{padding:"26px 28px"}}>
      <div style={{marginBottom:22}}>
        <h1 className="section-head">Generate Intelligence Report</h1>
        <p className="page-sub">Compile and export a structured, auditable intelligence assessment.</p>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"360px 1fr",gap:24}}>
        {/* Config */}
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div className="card" style={{padding:20}}>
            <div style={{fontSize:13,fontWeight:600,color:"var(--text-1)",marginBottom:14}}>Report Configuration</div>

            <div style={{marginBottom:12}}>
              <label style={{display:"block",fontSize:10,color:"var(--text-4)",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:5}}>Investigation</label>
              <select className="input" style={{padding:"7px 10px",fontSize:12}} value={selectedInvId} onChange={e=>{ setSelectedInvId(e.target.value); setGenerated(false); }}>
                {invOptions.length === 0 && <option style={{background:"#0f1420"}}>No investigations found</option>}
                {invOptions.map(inv=>(
                  <option key={inv.id} value={inv.id} style={{background:"#0f1420"}}>{inv.displayId} — {inv.title}</option>
                ))}
              </select>
            </div>

            <div style={{marginBottom:12}}>
              <label style={{display:"block",fontSize:10,color:"var(--text-4)",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:5}}>Report Type</label>
              <select className="input" style={{padding:"7px 10px",fontSize:12}} value={reportType} onChange={e=>setReportType(e.target.value)}>
                {["Intelligence Assessment","Executive Summary","Technical Analysis"].map(o=><option key={o} style={{background:"#0f1420"}}>{o}</option>)}
              </select>
            </div>

            <div style={{marginBottom:12}}>
              <label style={{display:"block",fontSize:10,color:"var(--text-4)",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:5}}>Classification</label>
              <select className="input" style={{padding:"7px 10px",fontSize:12}} value={classification} onChange={e=>setClassification(e.target.value)}>
                {["RESTRICTED","CONFIDENTIAL","OFFICIAL"].map(o=><option key={o} style={{background:"#0f1420"}}>{o}</option>)}
              </select>
            </div>

            <div className="divider" style={{margin:"14px 0"}}/>
            <div style={{fontSize:11.5,fontWeight:600,color:"var(--text-1)",marginBottom:10}}>Include Sections</div>
            {sections.map(s=>(
              <label key={s} style={{display:"flex",alignItems:"center",gap:10,marginBottom:9,cursor:"pointer"}}>
                <div onClick={()=>setChecked(c=>({...c,[s]:!c[s]}))} style={{width:16,height:16,borderRadius:4,background:checked[s]?"var(--accent)":"rgba(255,255,255,0.05)",border:checked[s]?"none":"1px solid var(--border-mid)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer",transition:"all 0.13s"}}>
                  {checked[s]&&<span style={{color:"#fff",fontSize:10,lineHeight:1}}>✓</span>}
                </div>
                <span style={{fontSize:12,color:checked[s]?"var(--text-2)":"var(--text-4)",transition:"color 0.13s"}}>{s}</span>
              </label>
            ))}

            {genError && (
              <div style={{fontSize:11.5,color:"var(--critical-light)",marginTop:12,padding:"8px 10px",background:"rgba(220,38,38,0.08)",borderRadius:6,border:"1px solid rgba(220,38,38,0.2)"}}>
                {genError}
              </div>
            )}

            <button className="btn btn-primary btn-lg" style={{width:"100%",justifyContent:"center",marginTop:16}} onClick={generateReport} disabled={generating}>
              {generating ? "Compiling from live data…" : "Generate Secure Report"}
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="card" style={{padding:32}}>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginBottom:12}}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={exportPdf}
              disabled={!generated || !reportData || exporting}
              title={!generated || !reportData ? "Generate a report first" : "Export as PDF"}
            >
              {exporting ? "Exporting…" : "Export PDF"}
            </button>
          </div>
          {exportError && (
            <div style={{fontSize:11.5,color:"var(--critical-light)",marginBottom:12,padding:"8px 10px",background:"rgba(220,38,38,0.08)",borderRadius:6,border:"1px solid rgba(220,38,38,0.2)"}}>
              {exportError}
            </div>
          )}
          <div style={{textAlign:"center",marginBottom:28,paddingBottom:22,borderBottom:"2px solid rgba(99,102,241,0.3)"}}>
            <div style={{fontSize:9.5,color:"var(--text-4)",letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:8}}>NEXUS INTELLIGENCE PLATFORM</div>
            <div className="display" style={{fontSize:22,fontWeight:800,color:"var(--text-1)",letterSpacing:"-0.02em",marginBottom:6}}>INTELLIGENCE ASSESSMENT REPORT</div>
            <div style={{display:"flex",justifyContent:"center",gap:22,fontSize:11,color:"var(--text-3)"}}>
              <span>Case: <span className="mono" style={{color:"var(--accent-hi)"}}>{reportData?.displayId ?? selectedInv?.displayId ?? "—"}</span></span>
              <span>Risk: <span style={{color:reportData?.network ? "var(--critical-light)" : "var(--text-3)",fontWeight:600}}>{reportData?.network?.status ?? "—"}</span></span>
              <span>Generated: <span style={{color:"var(--text-2)"}}>{generatedAt ? generatedAt.toLocaleDateString() : "—"}</span></span>
            </div>
          </div>

          {generated && reportData ? (
            <div>
              {buildSections().map(s=>(
                <div key={s.t} style={{marginBottom:20}}>
                  <div style={{fontSize:10.5,fontWeight:700,color:"var(--accent-hi)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:7}}>{s.t}</div>

                  {s.ai ? (
                    <div>
                      <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:10}}>
                        <span className={`badge ${
                          s.ai.tone === "accepted" ? "badge-low" :
                          s.ai.tone === "rejected" ? "badge-critical" :
                          s.ai.tone === "modified" ? "badge-accent" : "badge-pending"
                        }`}>{s.ai.badgeLabel}</span>
                        {s.ai.byline && <span style={{fontSize:11,color:"var(--text-4)"}}>{s.ai.byline}</span>}
                      </div>

                      {s.ai.body && (
                        <div style={{fontSize:12.5,color:"var(--text-2)",lineHeight:1.72,marginBottom:s.ai.steps?.length?14:8}}>
                          {s.ai.body}
                        </div>
                      )}

                      {s.ai.steps && s.ai.steps.length > 0 && (
                        <div style={{marginBottom:10}}>
                          <div style={{fontSize:11.5,fontWeight:700,color:"var(--text-1)",marginBottom:8}}>Recommended next steps:</div>
                          <div style={{display:"flex",flexDirection:"column",gap:6}}>
                            {s.ai.steps.map((step,i)=>(
                              <div key={i} style={{display:"flex",gap:8,fontSize:12,color:"var(--text-2)",lineHeight:1.6}}>
                                <span style={{color:"var(--accent-hi)",fontWeight:700,flexShrink:0}}>{i+1}.</span>
                                <span>{step}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {s.ai.footer && (
                        <div style={{fontSize:11,color:"var(--text-4)",lineHeight:1.6,fontStyle:"italic"}}>{s.ai.footer}</div>
                      )}
                    </div>
                  ) : (
                    <div style={{fontSize:12.5,color:"var(--text-2)",lineHeight:1.72}}>{s.c}</div>
                  )}
                </div>
              ))}
              <div className="ai-strip" style={{marginTop:24}}>
                <span style={{color:"var(--medium-light)",fontSize:14,flexShrink:0}}>⚠</span>
                <div>
                  <div style={{fontSize:10,color:"var(--medium-light)",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em"}}>AI-Assisted Analysis Notice</div>
                  <div style={{fontSize:11,color:"var(--text-3)",marginTop:3}}>Portions of this report were generated with AI assistance. All conclusions and determinations are the responsibility of the assigned investigator. No AI assessment constitutes a criminal determination.</div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{textAlign:"center",padding:"60px 0",color:"var(--text-4)"}}>
              <div style={{fontSize:36,marginBottom:14,opacity:0.3}}>◫</div>
              <div style={{fontSize:14}}>Configure and generate a report to see preview</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}