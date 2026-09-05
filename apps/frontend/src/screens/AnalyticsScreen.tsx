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

export function AnalyticsScreen() {
  const [range, setRange] = useState("30D");

  return (
    <div style={{padding:"26px 28px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
        <div>
          <h1 className="section-head">Analytics</h1>
          <p className="page-sub">Intelligence pattern analysis and trend visualization.</p>
        </div>
        <div className="tab-strip">
          {["7D","30D","90D","Custom"].map(r=>(
            <button key={r} className={`tab ${range===r?"active":""}`} onClick={()=>setRange(r)}>{r}</button>
          ))}
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        <div className="card" style={{padding:20}}>
          <div style={{fontSize:13,fontWeight:600,color:"var(--text-1)",marginBottom:3}}>Suspicious Activity Over Time</div>
          <div style={{fontSize:11,color:"var(--text-3)",marginBottom:14}}>Risk and alert frequency by day</div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={activityTimeline}>
              <defs>
                <linearGradient id="an-risk" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.28"/>
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02"/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
              <XAxis dataKey="day" tick={{fill:"var(--text-4)",fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:"var(--text-4)",fontSize:10}} axisLine={false} tickLine={false}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Area type="monotone" dataKey="risk" stroke="#818cf8" strokeWidth={2} fill="url(#an-risk)" name="Risk"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card" style={{padding:20}}>
          <div style={{fontSize:13,fontWeight:600,color:"var(--text-1)",marginBottom:3}}>Alert Frequency</div>
          <div style={{fontSize:11,color:"var(--text-3)",marginBottom:14}}>Alerts by day of week — generated vs. resolved</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={alertsByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
              <XAxis dataKey="day" tick={{fill:"var(--text-4)",fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:"var(--text-4)",fontSize:10}} axisLine={false} tickLine={false}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Bar dataKey="alerts" fill="#f87171" radius={[3,3,0,0]} name="Alerts" opacity={0.85}/>
              <Bar dataKey="resolved" fill="#4ade80" radius={[3,3,0,0]} name="Resolved" opacity={0.7}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginBottom:16}}>
        <div className="card" style={{padding:20}}>
          <div style={{fontSize:13,fontWeight:600,color:"var(--text-1)",marginBottom:3}}>Risk Distribution</div>
          <div style={{fontSize:11,color:"var(--text-3)",marginBottom:10}}>Entity risk breakdown</div>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie data={riskDistribution} cx="50%" cy="50%" innerRadius={40} outerRadius={64} paddingAngle={3} dataKey="value">
                {riskDistribution.map((e,i)=><Cell key={i} fill={e.color} stroke="transparent"/>)}
              </Pie>
              <Tooltip content={<CustomTooltip/>}/>
            </PieChart>
          </ResponsiveContainer>
          {riskDistribution.map(d=>(
            <div key={d.name} style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4}}>
              <div style={{display:"flex",alignItems:"center",gap:6,color:"var(--text-2)"}}>
                <div style={{width:7,height:7,borderRadius:2,background:d.color}}/>{d.name}
              </div>
              <span style={{color:"var(--text-3)"}}>{d.value}</span>
            </div>
          ))}
        </div>

        <div className="card" style={{padding:20}}>
          <div style={{fontSize:13,fontWeight:600,color:"var(--text-1)",marginBottom:3}}>Entity Type Distribution</div>
          <div style={{fontSize:11,color:"var(--text-3)",marginBottom:10}}>Count by entity category</div>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={entityTypeDist} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
              <XAxis type="number" tick={{fill:"var(--text-4)",fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis type="category" dataKey="type" tick={{fill:"var(--text-4)",fontSize:10}} axisLine={false} tickLine={false} width={50}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Bar dataKey="value" radius={[0,3,3,0]} name="Count">
                {entityTypeDist.map((e,i)=><Cell key={i} fill={e.color} opacity={0.85}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card" style={{padding:20}}>
          <div style={{fontSize:13,fontWeight:600,color:"var(--text-1)",marginBottom:3}}>Source Contribution</div>
          <div style={{fontSize:11,color:"var(--text-3)",marginBottom:14}}>Intelligence records by source</div>
          {sourceContrib.map(s=>(
            <div key={s.source} style={{marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4}}>
                <span style={{color:"var(--text-2)"}}>{s.source}</span>
                <span style={{color:"var(--text-3)"}}>{s.records.toLocaleString()}</span>
              </div>
              <div className="risk-track">
                <div className="risk-fill" style={{width:`${(s.records/2000)*100}%`,background:`linear-gradient(90deg,var(--accent),var(--accent-hi))`}}/>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <div className="card" style={{padding:20}}>
          <div style={{fontSize:13,fontWeight:600,color:"var(--text-1)",marginBottom:3}}>Network Risk Growth</div>
          <div style={{fontSize:11,color:"var(--text-3)",marginBottom:14}}>N-042 risk evolution — early warning trajectory</div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={networkRiskEvolution}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
              <XAxis dataKey="day" tick={{fill:"var(--text-4)",fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:"var(--text-4)",fontSize:10}} axisLine={false} tickLine={false} domain={[0,100]}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Line type="monotone" dataKey="score" stroke="#f87171" strokeWidth={2.5} name="Risk Score" dot={{fill:"#f87171",r:5,stroke:"var(--card)",strokeWidth:2}}/>
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card" style={{padding:20}}>
          <div style={{fontSize:13,fontWeight:600,color:"var(--text-1)",marginBottom:14}}>Emerging Network Ranking</div>
          {(emergingNetworks).map((n,i)=>(
            <div key={n.id} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 0",borderBottom:"1px solid var(--border)"}}>
              <span style={{fontSize:12,color:"var(--text-4)",fontWeight:700,width:18,textAlign:"center"}}>{i+1}</span>
              <span className="mono-sm" style={{color:"var(--accent-hi)",width:50}}>{n.id}</span>
              <div className="risk-track" style={{flex:1}}>
                <div className="risk-fill" style={{width:`${n.risk}%`,background:riskColor(n.risk)}}/>
              </div>
              <span className="display" style={{fontWeight:700,color:riskColorLight(n.risk),fontSize:15,width:28}}>{n.risk}</span>
              <span style={{fontSize:11,color:"var(--low-light)",width:36,textAlign:"right"}}>+{n.change}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
