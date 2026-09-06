import { useState, useEffect } from "react";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { CustomTooltip } from "../components/shared";
import { apiGet } from "../lib/api";

export function AnalyticsScreen() {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<any>("/api/analytics/overview")
      .then(d => { setData(d); setError(null); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{padding:"26px 28px"}}><p className="page-sub">Loading analytics…</p></div>;
  }
  if (error || !data) {
    return <div style={{padding:"26px 28px"}}><p className="page-sub" style={{color:"var(--high-light)"}}>Couldn't reach the API ({error}).</p></div>;
  }

  const {
    activityTimeline, alertsByDay, riskDistribution,
    entityTypeDist, sourceContrib, networkRiskEvolution,
    networkRiskEvolutionNetworkId,
  } = data;

  return (
    <div style={{padding:"26px 28px"}}>
      <h1 className="section-head" style={{marginBottom:4}}>Analytics</h1>
      <p className="page-sub" style={{marginBottom:22}}>Trends and patterns derived live from current investigations, alerts, entities, and listings.</p>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        <div className="card" style={{padding:20}}>
          <div style={{fontSize:13,fontWeight:600,color:"var(--text-1)",marginBottom:4}}>Suspicious Activity — Last 30 Days</div>
          <div style={{fontSize:11,color:"var(--text-3)",marginBottom:16}}>Average alert severity and alert count per day</div>
          {activityTimeline.every((d:any)=>d.alerts===0) ? (
            <div style={{padding:"30px 0",textAlign:"center",color:"var(--text-4)",fontSize:12}}>No alert activity recorded in this window yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={activityTimeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                <XAxis dataKey="day" tick={{fill:"var(--text-4)",fontSize:10}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:"var(--text-4)",fontSize:10}} axisLine={false} tickLine={false}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Area type="monotone" dataKey="risk" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.15} name="Avg Severity"/>
                <Area type="monotone" dataKey="alerts" stroke="var(--cyan)" fill="var(--cyan)" fillOpacity={0.1} name="Alert Count"/>
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card" style={{padding:20}}>
          <div style={{fontSize:13,fontWeight:600,color:"var(--text-1)",marginBottom:4}}>Alert Frequency — Last 7 Days</div>
          <div style={{fontSize:11,color:"var(--text-3)",marginBottom:16}}>Generated vs resolved, by day</div>
          {alertsByDay.every((d:any)=>d.alerts===0) ? (
            <div style={{padding:"30px 0",textAlign:"center",color:"var(--text-4)",fontSize:12}}>No alerts generated in this window yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={alertsByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                <XAxis dataKey="day" tick={{fill:"var(--text-4)",fontSize:10}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:"var(--text-4)",fontSize:10}} axisLine={false} tickLine={false}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Bar dataKey="alerts" fill="var(--critical)" radius={[4,4,0,0]} name="Generated" opacity={0.85}/>
                <Bar dataKey="resolved" fill="var(--low)" radius={[4,4,0,0]} name="Resolved" opacity={0.7}/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginBottom:16}}>
        <div className="card" style={{padding:20}}>
          <div style={{fontSize:13,fontWeight:600,color:"var(--text-1)",marginBottom:14}}>Entity Risk Distribution</div>
          {riskDistribution.every((d:any)=>d.value===0) ? (
            <div style={{padding:"20px 0",textAlign:"center",color:"var(--text-4)",fontSize:12}}>No entities recorded yet.</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={riskDistribution} dataKey="value" nameKey="name" innerRadius={40} outerRadius={65} paddingAngle={3}>
                    {riskDistribution.map((d:any,i:number)=><Cell key={i} fill={d.color}/>)}
                  </Pie>
                  <Tooltip content={<CustomTooltip/>}/>
                </PieChart>
              </ResponsiveContainer>
              <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:8,justifyContent:"center"}}>
                {riskDistribution.map((d:any)=>(
                  <div key={d.name} style={{display:"flex",alignItems:"center",gap:5,fontSize:10.5,color:"var(--text-3)"}}>
                    <div style={{width:8,height:8,borderRadius:2,background:d.color}}/>{d.name} ({d.value})
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="card" style={{padding:20}}>
          <div style={{fontSize:13,fontWeight:600,color:"var(--text-1)",marginBottom:14}}>Graph Node Type Breakdown</div>
          {entityTypeDist.length === 0 ? (
            <div style={{padding:"20px 0",textAlign:"center",color:"var(--text-4)",fontSize:12}}>No graph nodes recorded yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={entityTypeDist} dataKey="value" nameKey="type" innerRadius={40} outerRadius={65} paddingAngle={3}>
                  {entityTypeDist.map((d:any,i:number)=><Cell key={i} fill={d.color}/>)}
                </Pie>
                <Tooltip content={<CustomTooltip/>}/>
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card" style={{padding:20}}>
          <div style={{fontSize:13,fontWeight:600,color:"var(--text-1)",marginBottom:14}}>Listings by Source</div>
          {sourceContrib.length === 0 ? (
            <div style={{padding:"20px 0",textAlign:"center",color:"var(--text-4)",fontSize:12}}>No sourced listings yet.</div>
          ) : (
            <div>
              {sourceContrib.slice(0,6).map((s:any)=>(
                <div key={s.source} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid var(--border)"}}>
                  <span style={{fontSize:11.5,color:"var(--text-2)"}}>{s.source}</span>
                  <span className="mono-sm" style={{color:"var(--accent-hi)"}}>{s.records}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{padding:20}}>
        <div style={{fontSize:13,fontWeight:600,color:"var(--text-1)",marginBottom:4}}>
          Network Risk Trend {networkRiskEvolutionNetworkId ? `— ${networkRiskEvolutionNetworkId}` : ""}
        </div>
        <div style={{fontSize:11,color:"var(--text-3)",marginBottom:16}}>Highest-risk network's recorded risk history</div>
        {networkRiskEvolution.length === 0 ? (
          <div style={{padding:"30px 0",textAlign:"center",color:"var(--text-4)",fontSize:12}}>
            No risk history yet — run a simulation from the Overview screen to generate trajectory points.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={networkRiskEvolution}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
              <XAxis dataKey="day" tick={{fill:"var(--text-4)",fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:"var(--text-4)",fontSize:10}} axisLine={false} tickLine={false} domain={[0,100]}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Line type="monotone" dataKey="score" stroke="var(--critical)" strokeWidth={2} dot={{r:3}} name="Risk Score"/>
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}