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

export function AdminScreen() {
  const roles = ["Administrator","Investigator","Analyst"];
  const perms = ["Search Intelligence","View Evidence","Manage Cases","Generate Reports","Manage Users","View Audit Logs"];
  const matrix: Record<string,boolean[]> = {
    Administrator:[true,true,true,true,true,true],
    Investigator:[true,true,true,true,false,false],
    Analyst:[true,true,false,true,false,false],
  };

  const users = [
    {name:"Administrator",role:"Admin",status:"Active",last:"Just now"},
    {name:"Investigator A",role:"Investigator",status:"Active",last:"2m ago"},
    {name:"Investigator B",role:"Investigator",status:"Active",last:"1h ago"},
    {name:"Investigator C",role:"Investigator",status:"Idle",last:"3h ago"},
    {name:"Analyst D",role:"Analyst",status:"Offline",last:"Yesterday"},
  ];

  return (
    <div style={{padding:"26px 28px"}}>
      <div style={{marginBottom:22}}>
        <h1 className="section-head">Administration</h1>
        <p className="page-sub">User management, access control, permissions, and system status.</p>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        {/* Users */}
        <div className="card" style={{padding:20}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div style={{fontSize:13,fontWeight:600,color:"var(--text-1)"}}>Users</div>
            <button className="btn btn-primary btn-sm">+ Add User</button>
          </div>
          {users.map((u,i)=>(
            <div key={u.name} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid var(--border)"}}>
              <div style={{width:34,height:34,borderRadius:"50%",background:`hsl(${220+i*44},50%,22%)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:`hsl(${220+i*44},70%,65%)`,flexShrink:0}}>
                {u.name[0]}
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:12.5,color:"var(--text-1)",fontWeight:500}}>{u.name}</div>
                <div style={{fontSize:10.5,color:"var(--text-4)"}}>{u.role} · Last active: {u.last}</div>
              </div>
              <span style={{fontSize:10,padding:"2px 8px",borderRadius:4,background:u.status==="Active"?riskBg(20):u.status==="Idle"?riskBg(40):"rgba(255,255,255,0.04)",color:u.status==="Active"?"var(--low-light)":u.status==="Idle"?"var(--medium-light)":"var(--text-4)"}}>
                {u.status}
              </span>
            </div>
          ))}
        </div>

        {/* Permission matrix */}
        <div className="card" style={{padding:20}}>
          <div style={{fontSize:13,fontWeight:600,color:"var(--text-1)",marginBottom:16}}>Permission Matrix</div>
          <table className="data-table" style={{fontSize:12}}>
            <thead>
              <tr>
                <th style={{width:160}}>Permission</th>
                {roles.map(r=><th key={r} style={{textAlign:"center"}}>{r}</th>)}
              </tr>
            </thead>
            <tbody>
              {perms.map((p,pi)=>(
                <tr key={p}>
                  <td style={{color:"var(--text-2)"}}>{p}</td>
                  {roles.map(r=>(
                    <td key={r} style={{textAlign:"center"}}>
                      <span style={{color:matrix[r][pi]?"var(--low-light)":"var(--text-4)",fontSize:15}}>{matrix[r][pi]?"✓":"○"}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* System status */}
        <div className="card" style={{padding:20}}>
          <div style={{fontSize:13,fontWeight:600,color:"var(--text-1)",marginBottom:14}}>System Status</div>
          {[
            {name:"Intelligence Ingestion",status:"Operational",uptime:"99.98%"},
            {name:"Risk Scoring Engine",status:"Operational",uptime:"99.95%"},
            {name:"Entity Resolution",status:"Operational",uptime:"99.99%"},
            {name:"Alert Engine",status:"Operational",uptime:"99.97%"},
            {name:"Blockchain Connector",status:"Degraded",uptime:"97.2%"},
          ].map(s=>(
            <div key={s.name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:"1px solid var(--border)"}}>
              <div style={{fontSize:12,color:"var(--text-2)"}}>{s.name}</div>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <span className="mono-sm" style={{color:"var(--text-4)"}}>{s.uptime}</span>
                <div style={{display:"flex",alignItems:"center",gap:5}}>
                  <PulseIndicator color={s.status==="Operational"?"var(--low)":"var(--medium)"}/>
                  <span style={{fontSize:11,color:s.status==="Operational"?"var(--low-light)":"var(--medium-light)",fontWeight:500}}>{s.status}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Data sources */}
        <div className="card" style={{padding:20}}>
          <div style={{fontSize:13,fontWeight:600,color:"var(--text-1)",marginBottom:14}}>Data Sources</div>
          {["Source Alpha","Source Beta","Source Gamma","Source Delta","Blockchain Data"].map((src,i)=>(
            <div key={src} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:"1px solid var(--border)"}}>
              <div style={{fontSize:12,color:"var(--text-2)"}}>{src}</div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:10.5,color:"var(--text-4)"}}>Last sync: {["2m","14m","1h","2h","5m"][i]} ago</span>
                <PulseIndicator color={i===2?"var(--medium)":"var(--low)"}/>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
