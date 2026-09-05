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

export function EntityScreen({ entity: entityProp, navigate }: { entity: Entity; navigate:(s:string,d?:any)=>void }) {
  const [tab, setTab] = useState("Overview");
  const tabs = ["Overview","Relationships","Activity","Evidence","Timeline"];

  // Start with whatever was passed in from the list row (list rows already
  // come from the API in EntitiesScreen, so this is never blank) so the
  // page never flashes empty. Once the fuller detail record lands — with
  // network.riskPoints, alertLinks, investigationLinks, events, and the
  // real `computed` risk explanation — swap it in.
  const [entity, setEntity] = useState<any>(entityProp);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const displayId = (entityProp as any)?.displayId ?? entityProp?.id;
    if (!displayId) { setLoading(false); return; }

    setLoading(true);
    fetch(`http://localhost:4000/api/entities/${displayId}`)
      .then(res => {
        if (!res.ok) throw new Error(`API returned ${res.status}`);
        return res.json();
      })
      .then(data => { setEntity(data); setError(null); })
      .catch(err => setError(err.message)) // keep showing entityProp on failure
      .finally(() => setLoading(false));
  }, [(entityProp as any)?.displayId, entityProp?.id]);

  // Relationships tab: the entity detail endpoint doesn't include the graph
  // node, so we find it ourselves (GraphNode.entityId === Entity.id), then
  // ask the graph API to expand it into real edges. Fetched lazily, once,
  // the first time the tab is opened.
  const [graphNode, setGraphNode] = useState<any>(null);
  const [relLoading, setRelLoading] = useState(false);
  const [relError, setRelError] = useState<string | null>(null);

  useEffect(() => {
    if (tab !== "Relationships" || graphNode || relLoading) return;
    setRelLoading(true);
    fetch("http://localhost:4000/api/graph")
      .then(res => { if (!res.ok) throw new Error(`API ${res.status}`); return res.json(); })
      .then(({ nodes }) => {
        const match = (nodes || []).find((n: any) => n.entityId === entity.id);
        if (!match) throw new Error("No graph node linked to this entity yet");
        return fetch(`http://localhost:4000/api/graph/${match.id}/expand`);
      })
      .then(res => { if (!res.ok) throw new Error(`API ${res.status}`); return res.json(); })
      .then(data => { setGraphNode(data); setRelError(null); })
      .catch(err => setRelError(err.message))
      .finally(() => setRelLoading(false));
  }, [tab, entity?.id]);

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
          <span style={{fontSize:12,color:"var(--text-3)"}}>{entity.alias}</span>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:6}}>
              <h1 className="section-head display" style={{fontSize:24}}>{entity.alias}</h1>
              <RiskBadge score={entity.risk}/>
            </div>
            <div style={{display:"flex",gap:18,fontSize:12,color:"var(--text-3)"}}>
              <span>First seen: <span style={{color:"var(--text-2)"}}>{entity.firstSeen}</span></span>
              <span>Last seen: <span style={{color:"var(--text-2)"}}>{entity.lastSeen}</span></span>
              <span>Risk change: <span style={{color:"var(--low-light)"}}>+{entity.riskChange} pts</span></span>
              <span>Confidence: <span style={{color:"var(--text-2)"}}>{entity.confidence}%</span></span>
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button className="btn btn-primary" onClick={()=>navigate("workspace")}>Investigate</button>
            <button className="btn btn-ghost">Add to Case</button>
            <button className="btn btn-ghost" onClick={()=>navigate("reports")}>Generate Report</button>
          </div>
        </div>
      </div>

      {loading && <p className="page-sub" style={{marginBottom:12}}>Loading full profile…</p>}
      {error && <p className="page-sub" style={{marginBottom:12,color:"var(--high-light)"}}>Couldn't reach the API ({error}) — showing the summary already in hand.</p>}

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
              <div style={{display:"flex",justifyContent:"center",marginBottom:12}}><RingScore score={entity.risk} size={140}/></div>
              <div style={{fontSize:13,fontWeight:700,color:riskColorLight(entity.risk),marginBottom:4}}>{riskLabel(entity.risk)} RISK</div>
              <div style={{fontSize:11,color:"var(--text-3)"}}>Confidence: {entity.confidence}%</div>
            </div>

            {/* Risk dimensions */}
            <div className="card" style={{padding:18}}>
              <div style={{fontSize:12,fontWeight:600,color:"var(--text-1)",marginBottom:14}}>Risk Dimensions</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                {[
                  {label:"Entity",score:entity.risk},
                  {label:"Relationship",score:79},
                  {label:"Network",score:91},
                  {label:"Temporal",score:68},
                ].map(r=>(
                  <div key={r.label} style={{textAlign:"center",background:"rgba(255,255,255,0.03)",borderRadius:8,padding:"12px 6px"}}>
                    <RingScore score={r.score} size={68}/>
                    <div style={{fontSize:10,color:"var(--text-4)",marginTop:4}}>{r.label}</div>
                  </div>
                ))}
              </div>
              <div style={{marginTop:14,padding:"9px 12px",background:"rgba(99,102,241,0.07)",border:"1px solid rgba(99,102,241,0.18)",borderRadius:8}}>
                <div style={{fontSize:11,color:"var(--accent-hi)",fontWeight:600}}>Overall Network Risk: 91</div>
              </div>
            </div>

            {/* Cross-source resolution */}
            <div className="card" style={{padding:18}}>
              <div style={{fontSize:10.5,color:"var(--accent-hi)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:12}}>Cross-Source Entity Resolution</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {entity.identifiers.map((id: { id?: string; type: string; value: string; confidence: number })=>(
                  <div key={id.id ?? `${id.type}-${id.value}`} style={{background:"rgba(255,255,255,0.03)",borderRadius:7,padding:"9px 12px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                      <span style={{fontSize:10,color:"var(--text-4)"}}>{id.type}</span>
                      <span style={{fontSize:10,color:"var(--low-light)",fontWeight:600}}>{id.confidence}%</span>
                    </div>
                    <div className="mono-sm" style={{color:"var(--text-2)"}}>{id.value}</div>
                  </div>
                ))}
              </div>
              <div style={{marginTop:12,padding:"9px 12px",background:"rgba(99,102,241,0.08)",borderRadius:7,border:"1px solid rgba(99,102,241,0.22)"}}>
                <div style={{fontSize:11,color:"var(--accent-hi)",fontWeight:700}}>Potential Entity Match — 93% confidence</div>
              </div>
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
              {flagContributions.map(c=>(
                <BarContrib key={c.label} label={c.label} value={c.value} color={c.color}/>
              ))}
              <div className="divider" style={{margin:"16px 0"}}/>
              <div style={{background:"rgba(255,255,255,0.03)",borderRadius:9,padding:"14px 16px",borderLeft:"3px solid var(--accent)",marginBottom:14}}>
                <div style={{fontSize:12.5,color:"var(--text-2)",lineHeight:1.65}}>
                  {entity.computed?.explanation ??
                    "Risk increased due to repeated identifiers across multiple intelligence sources, association with high-risk network entities, and an abnormal activity pattern consistent with coordinated behaviour over a 4-day window."}
                </div>
              </div>
              <div className="ai-strip">
                <span style={{color:"var(--medium-light)",fontSize:14}}>⚠</span>
                <div>
                  <div style={{fontSize:10.5,color:"var(--medium-light)",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em"}}>AI-Generated Assessment — Investigator Review Required</div>
                  <div style={{fontSize:11,color:"var(--text-3)",marginTop:2}}>This assessment is generated by automated analysis. No AI output constitutes a criminal determination. All decisions require investigator review.</div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{display:"flex",gap:10}}>
              <button className="btn btn-primary" style={{flex:1,justifyContent:"center"}} onClick={()=>navigate("graph")}>View Network Graph</button>
              <button className="btn btn-ghost" style={{flex:1,justifyContent:"center"}} onClick={()=>navigate("network-risk")}>Network Risk Analysis</button>
              <button className="btn btn-ghost" style={{flex:1,justifyContent:"center"}} onClick={()=>navigate("evidence")}>Evidence</button>
            </div>

            {/* Activity summary */}
            <div className="card" style={{padding:20}}>
              <div style={{fontSize:13,fontWeight:600,color:"var(--text-1)",marginBottom:14}}>Activity Summary</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
                {[
                  {label:"Marketplaces",val:entity.marketplaces ?? "—",icon:"▤"},
                  {label:"Wallets",val:entity.wallets ?? "—",icon:"◇"},
                  {label:"Listings",val:entity.listings ?? "—",icon:"▣"},
                  {label:"Comm IDs",val:entity.comms ?? "—",icon:"◉"},
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

      {tab==="Timeline" && <TimelineView events={caseTimeline}/>}

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
              <button className="btn btn-ghost" style={{marginTop:16}} onClick={()=>navigate("graph")}>Open in Network Graph</button>
            </>
          )}
        </div>
      )}

      {(tab==="Activity"||tab==="Evidence") && (
        <div style={{textAlign:"center",padding:"60px 0",color:"var(--text-4)"}}>
          <div style={{fontSize:32,marginBottom:12,opacity:0.3}}>◫</div>
          <div>Navigate to the dedicated <button onClick={()=>navigate(tab==="Evidence"?"evidence":"graph")} style={{background:"none",border:"none",color:"var(--accent-hi)",cursor:"pointer",fontSize:13,textDecoration:"underline"}}>{tab==="Evidence"?"Evidence Repository":"Network Graph"}</button> for this view.</div>
        </div>
      )}
    </div>
  );
}
