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

export function OverviewScreen({ navigate }: { navigate:(s:string,d?:any)=>void }) {
  const [liveNetworks, setLiveNetworks] = useState<any[]>(emergingNetworks);

  // ── Live feed state ──────────────────────────────────────────────────────
  const [feedEvents, setFeedEvents] = useState<any[]>([]);
  const [connected, setConnected]   = useState(false);
  const [simulating, setSimulating] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  // ── Fetch initial networks ───────────────────────────────────────────────
  useEffect(() => {
    fetch("http://localhost:4000/api/networks")
      .then(res => { if (!res.ok) throw new Error(); return res.json(); })
      .then(data => {
        const normalised = data.map((n: any) => ({
          ...n,
          id: n.displayId ?? n.id,
          risk: n.risk ?? 0,
          change: n.riskDelta ?? n.change ?? 0,
          entities: n._count?.entities ?? n.entities ?? 0,
          last: n.updatedAt ? new Date(n.updatedAt).toLocaleDateString() : n.last ?? "—",
        }));
        if (normalised.length > 0) setLiveNetworks(normalised);
      })
      .catch(() => {});
  }, []);

  // ── Socket.IO subscription ───────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();

    const onConnect    = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onEvent      = (evt: any) => {
      const now = new Date();
      const meta = EVENT_META[evt.type] ?? { label: evt.type, icon:"◎", color:"var(--text-3)" };

      // Build human-readable description from payload
      let detail = "";
      if (evt.type === "event_detected")  detail = evt.payload?.description ?? "";
      if (evt.type === "correlation")     detail = `${evt.payload?.entity ?? "Entity"} matched at ${evt.payload?.confidence ?? "?"}% confidence`;
      if (evt.type === "risk_updated")    detail = `${evt.payload?.network}: ${evt.payload?.from} → ${evt.payload?.to}`;
      if (evt.type === "alert_generated") detail = evt.payload?.title ?? "New alert created";

      setFeedEvents(prev => [{
        id: `${evt.type}-${now.getTime()}`,
        type: evt.type,
        meta,
        detail,
        time: now.toLocaleTimeString(),
      }, ...prev].slice(0, 50)); // keep last 50

      // If a risk_updated arrived, refresh the networks table
      if (evt.type === "risk_updated" || evt.type === "alert_generated") {
        fetch("http://localhost:4000/api/networks")
          .then(r => r.json())
          .then(data => {
            const n = data.map((n: any) => ({
              ...n,
              id: n.displayId ?? n.id,
              risk: n.risk ?? 0,
              change: n.riskDelta ?? n.change ?? 0,
              entities: n._count?.entities ?? n.entities ?? 0,
              last: n.updatedAt ? new Date(n.updatedAt).toLocaleDateString() : n.last ?? "—",
            }));
            if (n.length > 0) setLiveNetworks(n);
          })
          .catch(() => {});
      }
    };

    if (socket.connected) setConnected(true);
    socket.on("connect",             onConnect);
    socket.on("disconnect",          onDisconnect);
    socket.on("intelligence-event",  onEvent);

    return () => {
      socket.off("connect",            onConnect);
      socket.off("disconnect",         onDisconnect);
      socket.off("intelligence-event", onEvent);
    };
  }, []);

  // Auto-scroll feed to top when new events arrive
  useEffect(() => {
    feedRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [feedEvents.length]);

  // ── Simulate button handler ──────────────────────────────────────────────
  const handleSimulate = async () => {
    setSimulating(true);
    try {
      // Pick the first network from liveNetworks; fall back to N-018
      const targetNetwork = liveNetworks[0]?.id ?? "N-018";
      await fetch("http://localhost:4000/api/simulate/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ networkDisplayId: targetNetwork }),
      });
    } catch (_) { /* socket events will show what happened */ }
    finally { setSimulating(false); }
  };

  return (
    <div style={{padding:"26px 28px"}} className="anim-fade-up">
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:22}}>
        <div>
          <h1 className="section-head">Intelligence Overview</h1>
          <p className="page-sub">Monitor emerging patterns, suspicious entities, and active investigations.</p>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {/* Connection badge */}
          <div style={{display:"flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:6,
            background:connected?"rgba(22,163,74,0.08)":"rgba(100,100,100,0.08)",
            border:connected?"1px solid rgba(22,163,74,0.2)":"1px solid rgba(100,100,100,0.2)"}}>
            <PulseIndicator color={connected?"#16a34a":"#6b7280"}/>
            <span style={{fontSize:10.5,fontWeight:600,color:connected?"var(--low-light)":"var(--text-4)"}}>
              {connected?"Live":"Offline"}
            </span>
          </div>
          <button className="btn btn-ghost btn-sm">Export</button>
          <button
            className={`btn btn-sm ${simulating?"btn-ghost":"btn-primary"}`}
            onClick={handleSimulate}
            disabled={simulating}
            style={{minWidth:200,justifyContent:"center"}}>
            {simulating
              ? <><span style={{width:12,height:12,border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 0.7s linear infinite",display:"inline-block",marginRight:6}}/> Simulating…</>
              : "⚡ Simulate Incoming Intelligence"}
          </button>
          <button className="btn btn-primary btn-sm" onClick={()=>navigate("investigations")}>+ New Investigation</button>
        </div>
      </div>

      {/* KPI row */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:13,marginBottom:22}}>
        {kpis.map((k,i)=>(
          <div key={k.label} className={`card card-hover anim-fade-up delay-${i+1}`} style={{padding:"16px 18px"}}>
            <div style={{fontSize:10,color:"var(--text-3)",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:10}}>{k.label}</div>
            <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between"}}>
              <div>
                <div className="display" style={{fontSize:28,fontWeight:700,color:"var(--text-1)",lineHeight:1}}>{k.value}</div>
                <div style={{fontSize:11,marginTop:5,color:k.up?"var(--low-light)":"var(--critical-light)"}}>{k.change}</div>
              </div>
              <Sparkline data={k.spark} color={k.accent}/>
            </div>
            <div style={{position:"absolute",top:14,right:14,width:5,height:5,borderRadius:"50%",background:k.accent,boxShadow:`0 0 8px ${k.accent}80`}}/>
          </div>
        ))}
      </div>

      {/* Main charts row */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 300px",gap:16,marginBottom:16}}>
        {/* Timeline */}
        <div className="card" style={{padding:20}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:"var(--text-1)"}}>Suspicious Activity Timeline</div>
              <div style={{fontSize:11,color:"var(--text-3)"}}>Risk signal activity — last 30 days</div>
            </div>
            <div style={{display:"flex",gap:6}}>
              {["7D","14D","30D"].map(t=>(
                <button key={t} className={`tab ${t==="30D"?"active":""}`} style={{padding:"3px 9px",fontSize:11}}>{t}</button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <AreaChart data={activityTimeline}>
              <defs>
                <linearGradient id="tl-risk" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.28"/>
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02"/>
                </linearGradient>
                <linearGradient id="tl-alert" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#dc2626" stopOpacity="0.18"/>
                  <stop offset="100%" stopColor="#dc2626" stopOpacity="0.01"/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
              <XAxis dataKey="day" tick={{fill:"var(--text-4)",fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:"var(--text-4)",fontSize:10}} axisLine={false} tickLine={false}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Area type="monotone" dataKey="risk" stroke="#818cf8" strokeWidth={2} fill="url(#tl-risk)" name="Risk Score"/>
              <Area type="monotone" dataKey="alerts" stroke="#f87171" strokeWidth={1.5} fill="url(#tl-alert)" name="Alerts"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Risk donut */}
        <div className="card" style={{padding:20}}>
          <div style={{fontSize:13,fontWeight:600,color:"var(--text-1)",marginBottom:4}}>Risk Distribution</div>
          <div style={{fontSize:11,color:"var(--text-3)",marginBottom:12}}>Entities by risk level</div>
          <ResponsiveContainer width="100%" height={170}>
            <PieChart>
              <Pie data={riskDistribution} cx="50%" cy="50%" innerRadius={52} outerRadius={76} paddingAngle={3} dataKey="value">
                {riskDistribution.map((e,i)=>(
                  <Cell key={i} fill={e.color} stroke="transparent" opacity={0.9}/>
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip/>}/>
            </PieChart>
          </ResponsiveContainer>
          <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:4}}>
            {riskDistribution.map(d=>(
              <div key={d.name} style={{display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:11.5}}>
                <div style={{display:"flex",alignItems:"center",gap:7,color:"var(--text-2)"}}>
                  <div style={{width:8,height:8,borderRadius:2,background:d.color,flexShrink:0}}/>
                  {d.name}
                </div>
                <span style={{color:"var(--text-3)"}}>{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 320px",gap:16}}>
        {/* Emerging threats */}
        <div className="card" style={{padding:20}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:"var(--text-1)"}}>Emerging Threats</div>
              <div style={{fontSize:11,color:"var(--text-3)"}}>Networks with fastest-rising risk scores</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={()=>navigate("alerts")}>All Alerts</button>
          </div>
          <table className="data-table">
            <thead><tr><th>Network ID</th><th>Risk</th><th>Change</th><th>Entities</th><th>Last Activity</th></tr></thead>
            <tbody>
              {liveNetworks.map(n=>(
                <tr key={n.id} onClick={()=>navigate("network-risk", n.id)}>
                  <td><span className="mono" style={{color:"var(--accent-hi)",fontSize:12}}>{n.id}</span></td>
                  <td>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontWeight:700,color:riskColorLight(n.risk),fontFamily:"Manrope,sans-serif",fontSize:15}}>{n.risk}</span>
                      <div className="risk-track" style={{width:44}}>
                        <div className="risk-fill" style={{width:`${n.risk}%`,background:riskColor(n.risk)}}/>
                      </div>
                    </div>
                  </td>
                  <td><span style={{color:"var(--low-light)",fontSize:12}}>▲ +{n.change}</span></td>
                  <td><span>{n.entities}</span></td>
                  <td><span style={{color:"var(--text-4)",fontSize:11}}>{n.last}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Live Intelligence Feed */}
        <div className="card" style={{padding:20,display:"flex",flexDirection:"column"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:"var(--text-1)"}}>Live Intelligence Feed</div>
              <div style={{fontSize:10.5,color:"var(--text-3)",marginTop:1}}>
                {connected
                  ? <><span style={{color:"var(--low-light)"}}>●</span> Real-time events</>
                  : <><span style={{color:"var(--text-4)"}}>○</span> Connecting…</>}
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={()=>navigate("alerts")}>All Alerts</button>
          </div>

          {/* Event stream */}
          <div
            ref={feedRef}
            style={{display:"flex",flexDirection:"column",gap:8,overflowY:"auto",maxHeight:340,
              scrollbarWidth:"thin",scrollbarColor:"rgba(255,255,255,0.08) transparent"}}>

            {feedEvents.length === 0 && (
              <div style={{textAlign:"center",padding:"32px 0",color:"var(--text-4)"}}>
                <div style={{fontSize:22,marginBottom:8,opacity:0.3}}>◎</div>
                <div style={{fontSize:12}}>Waiting for live events…</div>
                <div style={{fontSize:11,marginTop:4,color:"var(--text-4)"}}>
                  Click <span style={{color:"var(--accent-hi)"}}>Simulate Incoming Intelligence</span> to trigger the pipeline
                </div>
              </div>
            )}

            {feedEvents.map((evt, i) => (
              <div
                key={evt.id}
                style={{
                  display:"flex",gap:10,alignItems:"flex-start",
                  padding:"10px 12px",borderRadius:9,
                  background: i === 0
                    ? `${evt.meta.color}10`
                    : "rgba(255,255,255,0.025)",
                  border: i === 0
                    ? `1px solid ${evt.meta.color}30`
                    : "1px solid var(--border)",
                  transition:"all 0.3s",
                  animation: i === 0 ? "anim-alert 0.35s ease-out" : "none",
                }}>
                {/* Icon */}
                <div style={{
                  width:28,height:28,borderRadius:7,flexShrink:0,
                  background:`${evt.meta.color}18`,
                  border:`1px solid ${evt.meta.color}35`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:12,color:evt.meta.color,
                  ...(i===0 ? {boxShadow:`0 0 10px ${evt.meta.color}25`} : {}),
                }}>
                  {evt.meta.icon}
                </div>

                {/* Body */}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:2}}>
                    <span style={{fontSize:10,fontWeight:700,color:evt.meta.color,
                      textTransform:"uppercase",letterSpacing:"0.07em"}}>
                      {evt.meta.label}
                    </span>
                    {i === 0 && (
                      <span style={{fontSize:9,padding:"1px 5px",borderRadius:3,
                        background:`${evt.meta.color}22`,color:evt.meta.color,fontWeight:600}}>
                        NEW
                      </span>
                    )}
                  </div>
                  <div style={{fontSize:11.5,color:"var(--text-2)",lineHeight:1.4,
                    overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {evt.detail || "—"}
                  </div>
                </div>

                {/* Time */}
                <div className="mono" style={{fontSize:10,color:"var(--text-4)",flexShrink:0,marginTop:1}}>
                  {evt.time}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}