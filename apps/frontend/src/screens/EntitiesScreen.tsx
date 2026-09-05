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

export function EntitiesScreen({ navigate }: { navigate:(s:string,d?:any)=>void }) {
  // Start with the demo array so the screen isn't blank while the fetch is
  // in flight, then swap in real rows from Postgres once they arrive.
  const [entities, setEntities] = useState<any[]>(mockEntities);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);

  useEffect(() => {
    fetch("http://localhost:4000/api/entities")
      .then(res => {
        if (!res.ok) throw new Error(`API returned ${res.status}`);
        return res.json();
      })
      .then(data => { setEntities(data); setError(null); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{padding:"26px 28px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
        <div>
          <h1 className="section-head">Entities</h1>
          <p className="page-sub">All resolved intelligence entities with cross-source correlation.</p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <input className="input" style={{width:220,padding:"7px 12px",fontSize:12}} placeholder="Filter entities…"/>
          <button className="btn btn-ghost btn-sm">Export</button>
        </div>
      </div>
      {loading && <p className="page-sub" style={{marginBottom:12}}>Loading entities…</p>}
      {error && <p className="page-sub" style={{marginBottom:12,color:"var(--high-light)"}}>Couldn't reach the API ({error}) — showing demo data instead.</p>}
      <div className="card">
        <table className="data-table">
          <thead>
            <tr><th>Entity</th><th>Risk Score</th><th>Confidence</th><th>Sources</th><th>First Seen</th><th>Last Seen</th><th>Risk Δ</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {entities.map(e=>(
              <tr key={e.id} onClick={()=>navigate("entity",e)}>
                <td>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:32,height:32,borderRadius:"50%",background:"rgba(99,102,241,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"var(--accent-hi)",flexShrink:0}}>◈</div>
                    <div>
                      <div style={{fontSize:13,color:"var(--text-1)",fontWeight:500}}>{e.alias}</div>
                      <div className="mono-sm" style={{color:"var(--text-4)"}}>{e.displayId ?? e.id}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div style={{display:"flex",alignItems:"center",gap:9}}>
                    <span className="display" style={{fontWeight:700,color:riskColorLight(e.risk),fontSize:16}}>{e.risk}</span>
                    <RiskBadge score={e.risk}/>
                  </div>
                </td>
                <td>{e.confidence}%</td>
                <td><span style={{fontSize:11,color:"var(--text-3)"}}>{e.identifiers?.length ?? 0} identifiers</span></td>
                <td>{new Date(e.firstSeen).toLocaleDateString()}</td>
                <td>{new Date(e.lastSeen).toLocaleDateString()}</td>
                <td><span style={{color:"var(--low-light)",fontWeight:600}}>+{e.riskChange}</span></td>
                <td onClick={ev=>ev.stopPropagation()}>
                  <div style={{display:"flex",gap:6}}>
                    <button className="btn btn-primary btn-sm" onClick={()=>navigate("entity",e)}>Profile</button>
                    <button className="btn btn-ghost btn-sm" onClick={()=>navigate("graph")}>Network</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
