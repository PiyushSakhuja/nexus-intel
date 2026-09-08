import { useState, useEffect } from "react";
import {
  riskColorLight, riskLabel,
  type Entity,
} from "../data";
import {
  RingScore, RiskBadge,
  PulseIndicator, BarContrib,
} from "../components/shared";
import { apiGet } from "../lib/api";

// Readable labels for the backend's CorrelationSignal enum — presentation
// only, doesn't change the underlying signal identifiers.
const SIGNAL_LABELS: Record<string, string> = {
  normalized_vendor_alias: "Normalized vendor alias",
  listing_volume: "Listing volume",
  title_similarity: "Title similarity",
  category_consistency: "Category consistency",
  cross_marketplace: "Cross-marketplace presence",
  temporal_consistency: "Temporal consistency",
  shipping_location_consistency: "Shipping location consistency",
};
const SIGNAL_COLORS = ["#dc2626", "#ea580c", "#d97706", "#6366f1", "#8b5cf6", "#06b6d4", "#16a34a"];

export function EntityScreen({ entity: entityProp, navigate }: { entity: Entity; navigate:(s:string,d?:any)=>void }) {
  const [tab, setTab] = useState("Overview");
  const tabs = ["Overview","Relationships","Activity"];

  // entityProp always carries real data now — passed in via navigate("entity", row)
  // from whichever screen linked here (EntitiesScreen, SearchScreen, GraphScreen).
  // It's used only as the pre-fetch placeholder so the header isn't blank
  // while /api/entities/:displayId resolves.
  const displayId: string | undefined = (entityProp as any)?.displayId ?? entityProp?.id;

  const [live, setLive] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!displayId) { setLoading(false); return; }
    setLoading(true);
    apiGet<any>(`/api/entities/${encodeURIComponent(displayId)}`)
      .then(data => { setLive(data); setError(null); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [displayId]);

  // `source` prefers the live fetch once it resolves; entityProp (passed in
  // via navigate("entity", row)) is itself always real data from whichever
  // screen linked here (EntitiesScreen, SearchScreen, etc.) — used only as
  // the pre-fetch placeholder so the header isn't blank while loading.
  const source: any = live ?? entityProp;
  const computed = live?.computed ?? null;
  const correlation = live?.correlation ?? null;

  // Authoritative values come only from computed.* — never fall back to a
  // stale/placeholder number here. If the live fetch hasn't resolved yet
  // (or failed), risk/confidence show as "Not calculated" rather than an
  // old value from whatever was passed in via navigate().
  const risk: number | null = live?.computed?.risk ?? null;
  const confidence: number | null = live?.computed?.confidence ?? null;
  const riskChange: number | null = null; // computed.riskChange is always null — never calculable per-entity, see lib/entityRisk.ts

  const dash = (v: number | string | null | undefined) => (v === null || v === undefined || v === "" ? "—" : v);

  // Relationships + Activity tabs: the entity detail endpoint doesn't
  // include the graph node, so we find it ourselves (GraphNode.entityId ===
  // Entity.id), then ask the graph API to expand it into real edges.
  // Fetched lazily, once, the first time either tab is opened — Activity
  // renders this same neighborhood as a compact single-entity graph rather
  // than refetching it separately.
  const [graphNode, setGraphNode] = useState<any>(null);
  const [relLoading, setRelLoading] = useState(false);
  const [relError, setRelError] = useState<string | null>(null);

  useEffect(() => {
    if ((tab !== "Relationships" && tab !== "Activity") || graphNode || relLoading) return;
    setRelLoading(true);
    apiGet<any>("/api/graph")
      .then(({ nodes }) => {
        const match = (nodes || []).find((n: any) => n.entityId === source.id);
        if (!match) throw new Error("No graph node linked to this entity yet");
        return apiGet<any>(`/api/graph/${match.id}/expand`);
      })
      .then(data => { setGraphNode(data); setRelError(null); })
      .catch(err => setRelError(err.message))
      .finally(() => setRelLoading(false));
  }, [tab, source?.id]);

  const typeColors: Record<string,string> = {ENTITY:"#6366f1",MARKET:"#8b5cf6",LISTING:"#d97706",WALLET:"#06b6d4",COMM:"#16a34a",TXN:"#ea580c"};


  // Normalise edgesFrom/edgesTo (each direction has the "other" node nested
  // differently) into one flat list: { other, label, direction }.
  const relationships = graphNode
    ? [
        ...(graphNode.edgesFrom || []).map((e: any) => ({ other: e.to, label: e.label, direction: "→" })),
        ...(graphNode.edgesTo || []).map((e: any) => ({ other: e.from, label: e.label, direction: "←" })),
      ]
    : [];

  return (
    <div style={{padding:"26px 28px"}}>
      {/* Breadcrumb + header */}
      <div style={{marginBottom:22}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
          <button onClick={()=>navigate("entities")} style={{background:"none",border:"none",color:"var(--text-3)",cursor:"pointer",fontSize:12,padding:0}}>← Entities</button>
          <span style={{color:"var(--text-4)"}}>/</span>
          <span style={{fontSize:12,color:"var(--text-3)"}}>{source.alias}</span>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:6}}>
              <h1 className="section-head display" style={{fontSize:24}}>{source.alias}</h1>
              {risk != null && <RiskBadge score={risk}/>}
            </div>
            <div style={{display:"flex",gap:18,fontSize:12,color:"var(--text-3)",flexWrap:"wrap"}}>
              <span>First seen: <span style={{color:"var(--text-2)"}}>{dash(source.firstSeen ? (new Date(source.firstSeen).toString()!=="Invalid Date" ? new Date(source.firstSeen).toLocaleDateString() : source.firstSeen) : null)}</span></span>
              <span>Last seen: <span style={{color:"var(--text-2)"}}>{dash(source.lastSeen ? (new Date(source.lastSeen).toString()!=="Invalid Date" ? new Date(source.lastSeen).toLocaleDateString() : source.lastSeen) : null)}</span></span>
              <span>Risk change: <span style={{color:"var(--text-2)"}}>{riskChange != null ? `+${riskChange} pts` : "Not calculated"}</span></span>
              <span>Confidence: <span style={{color:"var(--text-2)"}}>{confidence != null ? `${confidence}%` : "Not calculated"}</span></span>
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button className="btn btn-primary" onClick={()=>navigate("workspace")}>Investigate</button>
            <button className="btn btn-ghost">Add to Case</button>
            <button className="btn btn-ghost" onClick={()=>navigate("reports")}>Generate Report</button>
          </div>
        </div>
        {loading && <p className="page-sub" style={{marginTop:10}}>Loading live entity data…</p>}
        {error && <p className="page-sub" style={{marginTop:10,color:"var(--high-light)"}}>Couldn't reach the API ({error}) — risk and confidence are unavailable.</p>}
      </div>

      {/* Tabs */}
      <div className="tab-strip" style={{marginBottom:22}}>
        {tabs.map(t=><button key={t} className={`tab ${tab===t?"active":""}`} onClick={()=>setTab(t)}>{t}</button>)}
      </div>

      {tab==="Overview" && (
        <div style={{display:"grid",gridTemplateColumns:"300px 1fr",gap:20}}>
          {/* Left col */}
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            {/* Ring score */}
            <div className="card" style={{padding:22,textAlign:"center"}}>
              <div style={{fontSize:10.5,color:"var(--text-3)",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:16}}>Risk Assessment</div>
              <div style={{display:"flex",justifyContent:"center",marginBottom:12}}>
                {risk != null
                  ? <RingScore score={risk} size={140}/>
                  : <div style={{width:140,height:140,borderRadius:"50%",border:"1px dashed var(--border)",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--text-4)",fontSize:12}}>Not calculated</div>}
              </div>
              <div style={{fontSize:13,fontWeight:700,color:risk!=null?riskColorLight(risk):"var(--text-4)",marginBottom:4}}>{risk!=null?`${riskLabel(risk)} RISK`:"RISK NOT CALCULATED"}</div>
              <div style={{fontSize:11,color:"var(--text-3)"}}>Confidence: {confidence != null ? `${confidence}%` : "Not calculated"}</div>
            </div>

            {/* Evidence behind the score — real backend evidence counts, not fabricated dimension scores */}
            <div className="card" style={{padding:18}}>
              <div style={{fontSize:12,fontWeight:600,color:"var(--text-1)",marginBottom:14}}>Evidence Behind This Score</div>
              {computed?.evidence ? (
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  {[
                    {label:"Listings", val:computed.evidence.listingCount},
                    {label:"Marketplaces", val:computed.evidence.marketplaceCount},
                    {label:"High-Risk Categories", val:computed.evidence.highRiskCategoryCount},
                  ].map(r=>(
                    <div key={r.label} style={{textAlign:"center",background:"rgba(255,255,255,0.03)",borderRadius:8,padding:"14px 6px"}}>
                      <div className="display" style={{fontSize:22,fontWeight:700,color:"var(--text-1)"}}>{r.val}</div>
                      <div style={{fontSize:10,color:"var(--text-4)",marginTop:4}}>{r.label}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{fontSize:12,color:"var(--text-4)"}}>
                  {live ? "No listing evidence correlates to this entity's alias — risk is not calculable." : "Not calculated."}
                </div>
              )}
              {source.network && (
                <div style={{marginTop:14,padding:"9px 12px",background:"rgba(99,102,241,0.07)",border:"1px solid rgba(99,102,241,0.18)",borderRadius:8}}>
                  <div style={{fontSize:11,color:"var(--accent-hi)",fontWeight:600}}>
                    Network {source.network.displayId ?? "—"}: persisted risk {dash(source.network.risk)} {source.network.status ? `(${source.network.status})` : ""}
                  </div>
                </div>
              )}
            </div>

            {/* Correlation — explicitly NOT identity resolution */}
            <div className="card" style={{padding:18}}>
              <div style={{fontSize:10.5,color:"var(--accent-hi)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>Alias Correlation</div>
              <div style={{fontSize:10,color:"var(--text-4)",marginBottom:12}}>Conservative multi-signal correlation across listings — not full identity resolution.</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {(source.identifiers ?? []).map((id: { id?: string; type: string; value: string; confidence: number })=>(
                  <div key={id.id ?? `${id.type}-${id.value}`} style={{background:"rgba(255,255,255,0.03)",borderRadius:7,padding:"9px 12px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                      <span style={{fontSize:10,color:"var(--text-4)"}}>{id.type}</span>
                      <span style={{fontSize:10,color:"var(--low-light)",fontWeight:600}}>{id.confidence != null ? `${id.confidence}%` : "—"}</span>
                    </div>
                    <div className="mono-sm" style={{color:"var(--text-2)"}}>{id.value}</div>
                  </div>
                ))}
              </div>
              {correlation && (
                <div style={{marginTop:12,padding:"9px 12px",background:"rgba(99,102,241,0.08)",borderRadius:7,border:"1px solid rgba(99,102,241,0.22)"}}>
                  <div style={{fontSize:11,color:"var(--accent-hi)",fontWeight:700}}>
                    Correlation confidence — {correlation.confidence}% ({correlation.correlatedListings} correlated listing{correlation.correlatedListings===1?"":"s"})
                  </div>
                  {correlation.marketplaces?.length > 0 && (
                    <div style={{fontSize:10,color:"var(--text-3)",marginTop:4}}>Marketplaces: {correlation.marketplaces.join(", ")}</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right col */}
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            {/* Why flagged */}
            <div className="card" style={{padding:24}}>
              <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:20}}>
                <PulseIndicator color="var(--critical)"/>
                <div style={{fontSize:14,fontWeight:700,color:"var(--text-1)"}}>Why Was This Entity Flagged?</div>
              </div>

              {correlation?.signalDetails?.length > 0 ? (
                correlation.signalDetails.map((s:any,i:number)=>(
                  <BarContrib
                    key={s.signal}
                    label={SIGNAL_LABELS[s.signal] ?? s.signal}
                    value={s.points}
                    max={Math.max(20, ...correlation.signalDetails.map((d:any)=>d.points))}
                    color={SIGNAL_COLORS[i % SIGNAL_COLORS.length]}
                  />
                ))
              ) : (
                <div style={{fontSize:12,color:"var(--text-4)",marginBottom:14}}>
                  {live ? "No correlation signals matched for this entity." : "Loading correlation signals…"}
                </div>
              )}

              <div className="divider" style={{margin:"16px 0"}}/>

              {(computed?.explanation || correlation?.explanation) && (
                <div style={{background:"rgba(255,255,255,0.03)",borderRadius:9,padding:"14px 16px",borderLeft:"3px solid var(--accent)",marginBottom:14}}>
                  {computed?.explanation && <div style={{fontSize:12.5,color:"var(--text-2)",lineHeight:1.65}}>{computed.explanation}</div>}
                  {correlation?.explanation && <div style={{fontSize:12.5,color:"var(--text-3)",lineHeight:1.65,marginTop:computed?.explanation?8:0}}>{correlation.explanation}</div>}
                </div>
              )}

              <div className="ai-strip">
                <span style={{color:"var(--medium-light)",fontSize:14}}>⚠</span>
                <div>
                  <div style={{fontSize:10.5,color:"var(--medium-light)",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em"}}>Automated Risk Assessment — Investigator Review Required</div>
                  <div style={{fontSize:11,color:"var(--text-3)",marginTop:2}}>This assessment is generated by deterministic backend analysis of listing evidence, not a criminal determination. All decisions require investigator review.</div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{display:"flex",gap:10}}>
              <button className="btn btn-primary" style={{flex:1,justifyContent:"center"}} onClick={()=>navigate("graph", { focusEntityDisplayId: source.displayId })}>View Network Graph</button>
              <button className="btn btn-ghost" style={{flex:1,justifyContent:"center"}} onClick={()=>navigate("network-risk", source.network?.displayId ?? undefined)}>Network Risk Analysis</button>
              <button className="btn btn-ghost" style={{flex:1,justifyContent:"center"}} onClick={()=>navigate("evidence")}>Evidence</button>
            </div>

            {/* Activity summary */}
            <div className="card" style={{padding:20}}>
              <div style={{fontSize:13,fontWeight:600,color:"var(--text-1)",marginBottom:14}}>Activity Summary</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
                {[
                  {label:"Marketplaces",val: live ? (correlation?.marketplaces?.length ?? "—") : source.marketplaces,icon:"▤"},
                  {label:"Wallets",val: live ? "—" : source.wallets,icon:"◇"},
                  {label:"Listings",val: live ? (correlation?.correlatedListings ?? "—") : source.listings,icon:"▣"},
                  {label:"Comm IDs",val: live ? "—" : source.comms,icon:"◉"},
                ].map(item=>(
                  <div key={item.label} style={{textAlign:"center",background:"rgba(255,255,255,0.03)",borderRadius:8,padding:"12px 8px"}}>
                    <div style={{fontSize:18,color:"var(--text-4)",marginBottom:4}}>{item.icon}</div>
                    <div className="display" style={{fontSize:22,fontWeight:700,color:"var(--text-1)"}}>{item.val}</div>
                    <div style={{fontSize:10,color:"var(--text-4)",marginTop:3}}>{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab==="Relationships" && (
        <div className="card" style={{padding:20}}>
          {relLoading && <p className="page-sub">Loading relationships…</p>}
          {relError && (
            <div style={{textAlign:"center",padding:"40px 0",color:"var(--text-4)"}}>
              <div style={{fontSize:32,marginBottom:12,opacity:0.3}}>◫</div>
              <div style={{marginBottom:10}}>{relError}</div>
              <button onClick={()=>navigate("graph")} style={{background:"none",border:"none",color:"var(--accent-hi)",cursor:"pointer",fontSize:13,textDecoration:"underline"}}>View full Network Graph instead</button>
            </div>
          )}
          {!relLoading && !relError && relationships.length===0 && graphNode && (
            <p className="page-sub">No direct relationships recorded for this entity yet.</p>
          )}
          {!relLoading && relationships.length>0 && (
            <>
              <div style={{fontSize:11,color:"var(--text-4)",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:12}}>
                Direct Relationships ({relationships.length})
              </div>
              {relationships.map((r,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:11,padding:"10px 4px",borderBottom:"1px solid var(--border)"}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:typeColors[r.other.type]||"#888",flexShrink:0,boxShadow:`0 0 5px ${typeColors[r.other.type]||"#888"}70`}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,color:"var(--text-1)",fontWeight:500}}>{r.direction} {r.other.label}</div>
                    <div style={{fontSize:10,color:"var(--text-4)"}}>{r.label} · {r.other.type}</div>
                  </div>
                  <RiskBadge score={r.other.risk}/>
                </div>
              ))}
              <button className="btn btn-ghost" style={{marginTop:16}} onClick={()=>navigate("graph", { focusEntityDisplayId: source.displayId })}>Open in Network Graph</button>
            </>
          )}
        </div>
      )}

      {tab==="Activity" && (
        <div className="card" style={{padding:20}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div style={{fontSize:13,fontWeight:600,color:"var(--text-1)"}}>{source.alias}'s Graph</div>
            <button className="btn btn-ghost btn-sm" onClick={()=>navigate("graph", { focusEntityDisplayId: source.displayId })}>Open Full Network Graph</button>
          </div>

          {relLoading && <p className="page-sub">Loading graph…</p>}

          {relError && (
            <div style={{textAlign:"center",padding:"40px 0",color:"var(--text-4)"}}>
              <div style={{fontSize:32,marginBottom:12,opacity:0.3}}>◈</div>
              <div style={{marginBottom:10}}>{relError}</div>
              <button onClick={()=>navigate("graph")} style={{background:"none",border:"none",color:"var(--accent-hi)",cursor:"pointer",fontSize:13,textDecoration:"underline"}}>View full Network Graph instead</button>
            </div>
          )}

          {!relLoading && !relError && graphNode && (
            <>
              <EntityMiniGraph
                centerLabel={source.alias}
                relationships={relationships}
                onNodeClick={()=>navigate("graph", { focusEntityDisplayId: source.displayId })}
              />
              <div style={{fontSize:11,color:"var(--text-4)",textAlign:"center",marginTop:10}}>
                {relationships.length>0
                  ? `${relationships.length} direct connection${relationships.length===1?"":"s"} — click the graph to explore in full`
                  : "No direct relationships recorded for this entity yet."}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// A compact, single-entity radial graph for the Activity tab — this
// entity at the center with only its direct neighbors around it, built
// from the same relationships list the Relationships tab already derives
// from graphNode.edgesFrom/edgesTo. This intentionally does NOT reuse
// GraphScreen's full force-directed layout: that component renders the
// entire network (or a full-page focused slice of it) with its own
// toolbar/legend chrome designed for a dedicated page, which doesn't fit
// inside a tab panel. Clicking anywhere in it hands off to the real
// Network Graph (via focusEntityDisplayId) for actual exploration.
const MINI_GRAPH_TYPE_COLORS: Record<string,string> = {ENTITY:"#6366f1",MARKET:"#8b5cf6",LISTING:"#d97706",WALLET:"#06b6d4",COMM:"#16a34a",TXN:"#ea580c"};
const MINI_GRAPH_MAX_NEIGHBORS = 8; // caps visible neighbors so labels don't overlap; the count below the graph always shows the real total

function EntityMiniGraph({
  centerLabel, relationships, onNodeClick,
}: {
  centerLabel: string;
  relationships: { other: { label: string; type: string; risk?: number }; label: string; direction: string }[];
  onNodeClick: () => void;
}) {
  const W = 400, H = 260;
  const cx = W / 2, cy = H / 2;
  const radius = 92;
  const shown = relationships.slice(0, MINI_GRAPH_MAX_NEIGHBORS);
  const overflow = relationships.length - shown.length;
  const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{maxHeight:280,cursor:"pointer",display:"block"}}
      onClick={onNodeClick}
      role="img"
      aria-label={`Graph of ${centerLabel} and its direct connections`}
    >
      {shown.map((r, i) => {
        const angle = (i / Math.max(shown.length, 1)) * 2 * Math.PI - Math.PI / 2;
        const nx = cx + radius * Math.cos(angle);
        const ny = cy + radius * Math.sin(angle);
        const color = MINI_GRAPH_TYPE_COLORS[r.other.type] || "#888";
        return (
          <g key={i}>
            <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="var(--border)" strokeWidth={1.4}/>
            <circle cx={nx} cy={ny} r={9} fill={color} opacity={0.9}/>
            <text x={nx} y={ny+22} textAnchor="middle" fontSize={9.5} fill="var(--text-3)">
              {truncate(r.other.label, 14)}
            </text>
          </g>
        );
      })}
      {overflow > 0 && (
        <text x={W-10} y={H-10} textAnchor="end" fontSize={10} fill="var(--text-4)">
          +{overflow} more
        </text>
      )}
      {/* Center node */}
      <circle cx={cx} cy={cy} r={16} fill={MINI_GRAPH_TYPE_COLORS.ENTITY} stroke="var(--panel)" strokeWidth={3}/>
      <text x={cx} y={cy+32} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--text-1)">
        {truncate(centerLabel, 20)}
      </text>
    </svg>
  );
}
