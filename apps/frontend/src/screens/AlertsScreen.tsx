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

export function AlertsScreen({ navigate }: { navigate:(s:string,d?:any)=>void }) {
  const [tab, setTab] = useState("All");
  const tabs = ["All","Critical","High","Medium","Resolved"];
  const [alertRows, setAlertRows] = useState<any[]>(alerts);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [alertsError, setAlertsError] = useState<string|null>(null);

  const loadAlerts = () => {
    fetch("http://localhost:4000/api/alerts")
      .then(res => { if (!res.ok) throw new Error(`API ${res.status}`); return res.json(); })
      .then(data => {
        // normalise DB rows to match the shape the UI expects. Note:
        // a.severity is the historical value at alert-creation time and is
        // NEVER replaced with a linked entity's current computed risk —
        // only the per-entity display (below) uses the live number.
        const normalised = data.map((a: any) => ({
          ...a,
          severity: a.severity ?? 50,
          status: (a.status ?? "NEW").toLowerCase(),
          time: a.createdAt ? new Date(a.createdAt).toLocaleString() : a.time ?? "",
          network: a.network?.displayId ?? a.network ?? null,
          entities: (a.entities ?? []).map((ae: any) => ({
            alias: ae.entity?.alias ?? ae.entity?.displayId ?? String(ae),
            currentRisk: ae.entity?.risk ?? null,
          })),
          title: a.title ?? a.type ?? "Alert",
          reason: a.reason ?? a.description ?? "",
        }));
        setAlertRows(normalised);
        setAlertsError(null);
      })
      .catch(err => setAlertsError(err.message))
      .finally(() => setAlertsLoading(false));
  };

  useEffect(() => { loadAlerts(); }, []);

  // Live pipeline events can create new alerts or change entity risk — never
  // fabricate/duplicate an alert locally, just re-pull the authoritative list.
  useEffect(() => {
    const socket = getSocket();
    const onEvent = (evt: any) => {
      if (evt.type === "alert_generated" || evt.type === "risk_updated") loadAlerts();
    };
    socket.on("intelligence-event", onEvent);
    return () => { socket.off("intelligence-event", onEvent); };
  }, []);

  const filtered = alertRows.filter(a=>{
    if(tab==="All") return true;
    if(tab==="Resolved") return a.status==="resolved";
    if(tab==="Critical") return a.severity>=80&&a.status!=="resolved";
    if(tab==="High") return a.severity>=60&&a.severity<80&&a.status!=="resolved";
    if(tab==="Medium") return a.severity>=40&&a.severity<60&&a.status!=="resolved";
    return true;
  });

  return (
    <div style={{padding:"26px 28px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
        <div>
          <h1 className="section-head">Alert Center</h1>
          <p className="page-sub">Monitor and triage intelligence alerts by severity and status.</p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <select className="input" style={{width:"auto",padding:"7px 12px",fontSize:12}}>
            <option style={{background:"#0f1420"}}>Sort: Newest First</option>
            <option style={{background:"#0f1420"}}>Sort: Risk High→Low</option>
          </select>
          <button className="btn btn-ghost btn-sm">Export</button>
          <button className="btn btn-ghost btn-sm">Mark All Read</button>
        </div>
      </div>

      {alertsLoading && <p className="page-sub" style={{marginBottom:12}}>Loading alerts…</p>}
      {alertsError && <p className="page-sub" style={{marginBottom:12,color:"var(--high-light)"}}>Couldn't reach the API ({alertsError}) — showing demo data.</p>}
      <div className="tab-strip" style={{marginBottom:18}}>
        {tabs.map(t=>{
          const count = t==="All"?alertRows.length:t==="Resolved"?alertRows.filter(a=>a.status==="resolved").length:t==="Critical"?alertRows.filter(a=>a.severity>=80&&a.status!=="resolved").length:t==="High"?alertRows.filter(a=>a.severity>=60&&a.severity<80&&a.status!=="resolved").length:alertRows.filter(a=>a.severity>=40&&a.severity<60&&a.status!=="resolved").length;
          return (
            <button key={t} className={`tab ${tab===t?"active":""}`} onClick={()=>setTab(t)}>
              {t} <span style={{marginLeft:4,fontSize:10,opacity:0.7}}>({count})</span>
            </button>
          );
        })}
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:11}}>
        {filtered.map((a,i)=>(
          <div key={a.id} className={`card anim-alert delay-${Math.min(i+1,5)}`} style={{padding:"18px 20px",transition:"border-color 0.13s,box-shadow 0.13s",cursor:"pointer"}}
            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor=`${riskColor(a.severity)}35`;(e.currentTarget as HTMLElement).style.boxShadow=`0 4px 20px ${riskColor(a.severity)}0a`;}}
            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor="var(--border)";(e.currentTarget as HTMLElement).style.boxShadow="none";}}>
            <div style={{display:"flex",gap:16,alignItems:"flex-start"}}>
              {/* Severity icon */}
              <div style={{width:44,height:44,borderRadius:10,background:riskBg(a.severity),border:`1px solid ${riskBorder(a.severity)}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <PulseIndicator color={riskColor(a.severity)}/>
              </div>

              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:6}}>
                  <RiskBadge score={a.severity}/>
                  <span className="mono-sm" style={{color:"var(--text-4)"}}>{a.id}</span>
                  {a.status==="resolved"&&<span className="badge badge-low">RESOLVED</span>}
                  {a.network&&<span className="badge badge-accent">{a.network}</span>}
                </div>
                <div style={{fontSize:14,fontWeight:600,color:"var(--text-1)",marginBottom:6}}>{a.title}</div>
                <div style={{fontSize:12,color:"var(--text-3)",lineHeight:1.5,marginBottom:10}}>{a.reason}</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {a.entities.map((e: any, idx: number)=>{
                    const alias = typeof e === "string" ? e : e.alias;
                    const currentRisk = typeof e === "string" ? null : e.currentRisk;
                    return (
                      <span key={`${alias}-${idx}`} className="mono-sm" style={{background:"rgba(99,102,241,0.09)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:4,padding:"2px 8px",color:"var(--accent-hi)"}}>
                        {alias}{currentRisk != null && <span style={{color:"var(--text-4)"}}> · current risk {currentRisk}</span>}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8,flexShrink:0}}>
                <div style={{textAlign:"right"}}>
                  <div className="display" style={{fontSize:22,fontWeight:700,color:riskColorLight(a.severity)}}>{a.severity}</div>
                  <div style={{fontSize:10,color:"var(--text-4)"}}>Risk Score</div>
                </div>
                <div style={{fontSize:11,color:"var(--text-4)"}}>{a.time}</div>
                <div style={{display:"flex",gap:6}}>
                  <button className="btn btn-primary btn-sm" onClick={()=>navigate("workspace")}>Investigate</button>
                  <button className="btn btn-ghost btn-sm" onClick={()=>navigate("graph")}>View Graph</button>
                  <button className="btn btn-ghost btn-sm">Dismiss</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}