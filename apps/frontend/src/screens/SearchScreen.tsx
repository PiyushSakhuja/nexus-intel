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

export function SearchScreen({ navigate }: { navigate:(s:string,d?:any)=>void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [hasResults, setHasResults] = useState(false);

  const chips = ["All","Entities","Listings","Wallets","Transactions","Marketplaces","Communications"];

  const search = () => { if (query.trim()) setHasResults(true); };

  return (
    <div style={{padding:"26px 28px"}}>
      <div style={{marginBottom:22}}>
        <h1 className="section-head">Intelligence Search</h1>
        <p className="page-sub">Search across all intelligence sources, entities, wallets, and identifiers.</p>
      </div>

      {/* Search bar */}
      <div style={{position:"relative",marginBottom:14}}>
        <span style={{position:"absolute",left:16,top:"50%",transform:"translateY(-50%)",fontSize:18,color:"var(--text-4)"}}>⌕</span>
        <input className="input" style={{paddingLeft:46,paddingTop:13,paddingBottom:13,fontSize:14,borderRadius:10}}
          placeholder="Search username, alias, wallet, email, identifier, keyword…"
          value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&search()}/>
        <button className="btn btn-primary" style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)"}} onClick={search}>Search</button>
      </div>

      {/* Chips */}
      <div style={{display:"flex",gap:7,marginBottom:18,flexWrap:"wrap"}}>
        {chips.map(c=>(
          <div key={c} className={`chip ${filter===c?"active":""}`} onClick={()=>setFilter(c)}>{c}</div>
        ))}
      </div>

      {/* Advanced filters */}
      <div className="card" style={{padding:"14px 18px",marginBottom:22}}>
        <div style={{fontSize:10.5,color:"var(--text-4)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:11}}>Advanced Filters</div>
        <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
          {[
            {label:"Date Range",   opts:["All Time","Last 7 Days","Last 30 Days","Custom Range"]},
            {label:"Risk Level",   opts:["Any Risk","Critical","High","Medium","Low"]},
            {label:"Source",       opts:["All Sources","Source Alpha","Source Beta","Source Gamma","Source Delta"]},
            {label:"Entity Type",  opts:["All Types","Alias","Wallet","Listing","Marketplace","Comm ID"]},
            {label:"Confidence",   opts:["Any","≥ 90%","≥ 80%","≥ 70%"]},
            {label:"Investigation",opts:["Any","INV-2026-042","INV-2026-039","INV-2026-031"]},
          ].map(f=>(
            <div key={f.label} style={{display:"flex",flexDirection:"column",gap:4,minWidth:148}}>
              <label style={{fontSize:10,color:"var(--text-4)",textTransform:"uppercase",letterSpacing:"0.07em"}}>{f.label}</label>
              <select className="input" style={{padding:"6px 10px",fontSize:12}}>
                {f.opts.map(o=><option key={o} style={{background:"#0f1420"}}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      {hasResults ? (
        <div>
          <div style={{fontSize:12,color:"var(--text-3)",marginBottom:14}}>
            Found <span style={{color:"var(--accent-hi)",fontWeight:600}}>{entities.length}</span> results for "<span style={{color:"var(--text-1)"}}>{query}</span>"
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:11}}>
            {entities.map((e,i)=>(
              <div key={e.id} className={`card card-hover anim-fade-up delay-${Math.min(i+1,5)}`} style={{padding:"18px 20px"}}>
                <div style={{display:"flex",gap:18,alignItems:"flex-start"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                      <span style={{fontSize:9,color:"var(--accent-hi)",textTransform:"uppercase",letterSpacing:"0.1em",background:"var(--accent-dim)",padding:"2px 7px",borderRadius:3,fontWeight:600}}>ENTITY</span>
                      <span className="display" style={{fontSize:17,fontWeight:700,color:"var(--text-1)"}}>{e.alias}</span>
                      <RiskBadge score={e.risk}/>
                    </div>
                    <div style={{display:"flex",gap:16,fontSize:12,color:"var(--text-3)",marginBottom:12}}>
                      <span>Risk: <span style={{color:riskColorLight(e.risk),fontWeight:700}}>{e.risk}/100</span></span>
                      <span>Confidence: <span style={{color:"var(--text-2)"}}>{e.confidence}%</span></span>
                      <span>First seen: <span style={{color:"var(--text-2)"}}>{e.firstSeen}</span></span>
                    </div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      {[
                        {label:"Marketplaces",val:e.marketplaces},{label:"Wallets",val:e.wallets},
                        {label:"Listings",val:e.listings},{label:"Comm IDs",val:e.comms},
                      ].map(item=>(
                        <div key={item.label} style={{background:"rgba(255,255,255,0.04)",border:"1px solid var(--border)",borderRadius:6,padding:"4px 10px",fontSize:11,color:"var(--text-2)"}}>
                          <span style={{color:"var(--text-1)",fontWeight:700}}>{item.val}</span> {item.label}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:7,flexShrink:0}}>
                    <button className="btn btn-primary btn-sm" onClick={()=>navigate("entity",e)}>View Entity</button>
                    <button className="btn btn-ghost btn-sm" onClick={()=>navigate("graph")}>View Network</button>
                    <button className="btn btn-ghost btn-sm" onClick={()=>navigate("investigations")}>Add to Case</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{textAlign:"center",padding:"70px 0",color:"var(--text-4)"}}>
          <div style={{fontSize:44,marginBottom:14,opacity:0.4}}>⌕</div>
          <div style={{fontSize:14}}>Enter a search term and press Enter or click Search</div>
          <div style={{fontSize:12,marginTop:6,color:"var(--text-4)"}}>Searches across entities, wallets, listings, identifiers, and cases</div>
        </div>
      )}
    </div>
  );
}
