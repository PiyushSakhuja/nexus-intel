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

export function NetworkRiskScreen({ navigate }: { navigate:(s:string,d?:any)=>void }) {
  return (
    <div style={{padding:"26px 28px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:22}}>
        <div>
          <div style={{fontSize:10.5,color:"var(--accent-hi)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6}}>Network Analysis</div>
          <h1 className="section-head display" style={{fontSize:22}}>Emerging Network Detection</h1>
          <div style={{fontSize:12,color:"var(--text-3)",marginTop:3}}>
            Network ID: <span className="mono" style={{color:"var(--accent-hi)"}}>N-042</span>
          </div>
        </div>
        <button className="btn btn-primary btn-lg" onClick={()=>navigate("workspace")}>Create Investigation</button>
      </div>

      {/* Early warning banner */}
      <div style={{background:"rgba(220,38,38,0.07)",border:"1px solid rgba(220,38,38,0.22)",borderRadius:12,padding:"16px 20px",marginBottom:22,display:"flex",alignItems:"center",gap:16}}>
        <div style={{width:42,height:42,borderRadius:"50%",background:"rgba(220,38,38,0.12)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <PulseIndicator color="var(--critical)"/>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:14,fontWeight:700,color:"var(--critical-light)",marginBottom:3}}>Early Warning Detected</div>
          <div style={{fontSize:12,color:"var(--text-2)",lineHeight:1.5}}>Network risk has increased <strong style={{color:"var(--critical-light)"}}>59 points</strong> over the monitored period. Critical threshold crossed at 19:28 UTC on Aug 16, 2026. Immediate investigator review recommended.</div>
        </div>
        <div style={{textAlign:"right",flexShrink:0}}>
          <div style={{fontSize:10,color:"var(--text-4)",marginBottom:2}}>Detected</div>
          <div className="mono" style={{fontSize:12,color:"var(--text-2)"}}>Aug 16 · 19:28 UTC</div>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"240px 1fr",gap:18,marginBottom:18}}>
        {/* Big score */}
        <div className="card" style={{padding:24,textAlign:"center",border:"1px solid rgba(220,38,38,0.2)",boxShadow:"0 0 28px rgba(220,38,38,0.06)"}}>
          <div style={{fontSize:10.5,color:"var(--text-4)",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:16}}>Network Risk Score</div>
          <div style={{display:"flex",justifyContent:"center",marginBottom:12}}><RingScore score={91} size={150}/></div>
          <span className="badge badge-critical" style={{fontSize:11}}>CRITICAL — EMERGING NETWORK</span>
          <div style={{marginTop:14,padding:"8px 12px",background:"rgba(220,38,38,0.06)",borderRadius:8}}>
            <div style={{fontSize:11,color:"var(--critical-light)"}}>+59 pts over 20 days</div>
          </div>
        </div>

        {/* Risk evolution */}
        <div className="card" style={{padding:20}}>
          <div style={{fontSize:13,fontWeight:600,color:"var(--text-1)",marginBottom:4}}>Risk Evolution</div>
          <div style={{fontSize:11,color:"var(--text-3)",marginBottom:16}}>Network risk progression over monitored period</div>
          <ResponsiveContainer width="100%" height={196}>
            <AreaChart data={networkRiskEvolution}>
              <defs>
                <linearGradient id="nr-g" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#dc2626" stopOpacity="0.28"/>
                  <stop offset="100%" stopColor="#dc2626" stopOpacity="0.02"/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
              <XAxis dataKey="day" tick={{fill:"var(--text-4)",fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:"var(--text-4)",fontSize:10}} axisLine={false} tickLine={false} domain={[0,100]}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Area type="monotone" dataKey="score" stroke="#f87171" strokeWidth={2.5} fill="url(#nr-g)" name="Risk Score"
                dot={{fill:"#f87171",r:5,stroke:"var(--card)",strokeWidth:2}}/>
            </AreaChart>
          </ResponsiveContainer>
          {/* Score milestones */}
          <div style={{display:"flex",gap:8,marginTop:12,justifyContent:"center"}}>
            {networkRiskEvolution.map(d=>(
              <div key={d.day} style={{textAlign:"center",background:`rgba(${d.score>80?"220,38,38":d.score>60?"234,88,12":"99,102,241"},0.08)`,borderRadius:7,padding:"6px 12px",border:`1px solid rgba(${d.score>80?"220,38,38":d.score>60?"234,88,12":"99,102,241"},0.18)`}}>
                <div className="display" style={{fontSize:16,fontWeight:700,color:riskColorLight(d.score)}}>{d.score}</div>
                <div style={{fontSize:9,color:"var(--text-4)"}}>{d.day}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Signals */}
      <div className="card" style={{padding:22}}>
        <div style={{fontSize:13,fontWeight:600,color:"var(--text-1)",marginBottom:18}}>Contributing Risk Signals</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12}}>
          {networkSignals.map((s,i)=>(
            <div key={i} style={{background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"16px 14px",borderTop:`3px solid ${s.color}`,transition:"all 0.15s"}}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.05)";}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.03)";}}>
              <div className="display" style={{fontSize:28,fontWeight:700,color:s.color,marginBottom:6}}>+{s.value}</div>
              <div style={{fontSize:11,color:"var(--text-3)",lineHeight:1.4}}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
