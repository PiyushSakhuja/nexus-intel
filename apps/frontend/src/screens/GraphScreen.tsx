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

export function GraphScreen({ navigate }: { navigate:(s:string,d?:any)=>void }) {
  const [selected, setSelected] = useState<string|null>("wallet-w1");
  const [riskOverlay, setRiskOverlay] = useState(true);
  const [mode, setMode] = useState<"entity"|"network">("entity");
  const [liveNodes, setLiveNodes] = useState<any[]>(graphNodes);
  const [liveEdges, setLiveEdges] = useState<any[]>(graphEdges);

  useEffect(() => {
    fetch("http://localhost:4000/api/graph")
      .then(res => { if (!res.ok) throw new Error(`API ${res.status}`); return res.json(); })
      .then(({ nodes, edges }) => {
        // GraphNode.type comes back as the Prisma enum ("ENTITY", "WALLET"...)
        // but typeColors/typeIcons below are keyed lowercase — without this
        // the node color/icon lookups silently miss and every node renders
        // with undefined styling.
        if (nodes?.length) setLiveNodes(nodes.map((n: any) => ({ ...n, type: n.type?.toLowerCase() })));
        if (edges?.length) {
          // DB uses fromId/toId; normalise to from/to for SVG rendering
          setLiveEdges(edges.map((e: any) => ({
            ...e,
            from: e.from ?? e.fromId,
            to: e.to ?? e.toId,
            label: e.label ?? e.type ?? "",
          })));
        }
      })
      .catch(() => { /* keep mock data on failure */ });
  }, []);

  const typeColors: Record<string,string> = {entity:"#6366f1",market:"#8b5cf6",listing:"#d97706",wallet:"#06b6d4",comm:"#16a34a",txn:"#ea580c"};
  const typeIcons: Record<string,string> = {entity:"◈",market:"▤",listing:"▣",wallet:"◇",comm:"◉",txn:"◫"};

  const selNode = liveNodes.find(n=>n.id===selected);
  const connectedEdges = liveEdges.filter(e=>e.from===selected||e.to===selected);
  const connectedIds = new Set(connectedEdges.flatMap(e=>[e.from,e.to]));

  const getPos = (id: string) => liveNodes.find(n=>n.id===id)||{x:0,y:0};

  return (
    <div style={{display:"flex",height:"calc(100vh - 52px)",overflow:"hidden"}}>
      {/* Graph SVG area */}
      <div className="graph-root" style={{background:"radial-gradient(ellipse at 40% 45%, rgba(99,102,241,0.04) 0%, transparent 65%)"}}>
        {/* Toolbar */}
        <div style={{position:"absolute",top:14,left:14,zIndex:10,display:"flex",gap:8}}>
          <div className="glass" style={{borderRadius:9,padding:"5px 8px",display:"flex",gap:4}}>
            {["⊕","⊖","⊡","⟲"].map((ic,i)=>(
              <button key={i} style={{background:"none",border:"none",color:"var(--text-3)",cursor:"pointer",padding:"5px 8px",borderRadius:5,fontSize:16,transition:"color 0.12s"}}
                onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.color="var(--accent-hi)"}}
                onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.color="var(--text-3)"}}>{ic}</button>
            ))}
          </div>
          <div className="glass" style={{borderRadius:9,padding:"5px 12px",display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:11,color:"var(--text-3)"}}>Risk Overlay</span>
            <div className={`toggle-track ${riskOverlay?"on":"off"}`} onClick={()=>setRiskOverlay(!riskOverlay)} style={{cursor:"pointer"}}>
              <div className="toggle-thumb"/>
            </div>
          </div>
          <div className="glass" style={{borderRadius:9,padding:"4px",display:"flex"}}>
            {(["entity","network"] as const).map(m=>(
              <button key={m} onClick={()=>setMode(m)} style={{background:mode===m?"rgba(99,102,241,0.2)":"none",border:"none",color:mode===m?"var(--accent-hi)":"var(--text-3)",cursor:"pointer",padding:"5px 12px",borderRadius:6,fontSize:11,fontWeight:500,fontFamily:"Inter,sans-serif",transition:"all 0.13s"}}>
                {m==="entity"?"Entity Risk":"Network Risk"}
              </button>
            ))}
          </div>
          <div className="glass" style={{borderRadius:9,padding:"5px 12px"}}>
            <select style={{background:"none",border:"none",color:"var(--text-2)",fontSize:11,fontFamily:"Inter,sans-serif",outline:"none",cursor:"pointer"}}>
              <option style={{background:"#0f1420"}}>Time: Last 7 Days</option>
              <option style={{background:"#0f1420"}}>Time: Last 30 Days</option>
            </select>
          </div>
        </div>

        {/* Legend */}
        <div style={{position:"absolute",bottom:14,left:14,zIndex:10}}>
          <div className="glass" style={{borderRadius:9,padding:"10px 14px"}}>
            <div style={{fontSize:9.5,color:"var(--text-4)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Node Types</div>
            {Object.entries(typeColors).map(([type,color])=>(
              <div key={type} style={{display:"flex",alignItems:"center",gap:7,fontSize:11,color:"var(--text-3)",marginBottom:4}}>
                <div style={{width:9,height:9,borderRadius:"50%",background:color,boxShadow:`0 0 5px ${color}70`,flexShrink:0}}/>
                {type.charAt(0).toUpperCase()+type.slice(1)}
              </div>
            ))}
          </div>
        </div>

        <svg className="graph-svg" viewBox="0 0 900 620">
          <defs>
            <radialGradient id="g-bg" cx="40%" cy="45%" r="50%">
              <stop offset="0%" stopColor="rgba(99,102,241,0.06)"/>
              <stop offset="100%" stopColor="transparent"/>
            </radialGradient>
            {Object.entries(typeColors).map(([type,color])=>(
              <radialGradient key={type} id={`g-${type}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={color} stopOpacity="0.28"/>
                <stop offset="100%" stopColor={color} stopOpacity="0"/>
              </radialGradient>
            ))}
            <filter id="glow-f">
              <feGaussianBlur stdDeviation="3" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          <rect width="900" height="620" fill="url(#g-bg)"/>

          {/* Edges */}
          {liveEdges.map((edge,i)=>{
            const f = getPos(edge.from); const t = getPos(edge.to);
            const isHighlighted = selected && (edge.from===selected||edge.to===selected);
            const mx=(f.x+t.x)/2; const my=(f.y+t.y)/2;
            return (
              <g key={i}>
                <line x1={f.x} y1={f.y} x2={t.x} y2={t.y}
                  stroke={isHighlighted?"rgba(99,102,241,0.55)":"rgba(255,255,255,0.07)"}
                  strokeWidth={isHighlighted?1.5:1}
                  strokeDasharray={isHighlighted?"none":"5 4"}
                  style={isHighlighted?{}:{animation:`dash-flow ${7+i*0.5}s linear infinite`}}
                />
                <text x={mx} y={my-5} textAnchor="middle" fill="rgba(255,255,255,0.18)" fontSize="7.5" fontFamily="Inter,sans-serif">{edge.label}</text>
              </g>
            );
          })}

          {/* Nodes */}
          {liveNodes.map((n,i)=>{
            const color = typeColors[n.type];
            const isSel = n.id===selected;
            const isDimmed = selected && !connectedIds.has(n.id) && n.id!==selected;
            const r = riskOverlay ? 10+(n.risk/100)*12 : 13;
            return (
              <g key={n.id} style={{cursor:"pointer"}} onClick={()=>setSelected(n.id===selected?null:n.id)}>
                {/* Glow halo */}
                <circle cx={n.x} cy={n.y} r={r+12} fill={`url(#g-${n.type})`}
                  style={{animation:`node-glow ${2.5+i*0.22}s ease-in-out infinite`,opacity:isDimmed?0.2:1}}/>
                {/* Selection ring */}
                {isSel && (
                  <circle cx={n.x} cy={n.y} r={r+5} fill="none" stroke={color} strokeWidth="1.5"
                    strokeDasharray="4 3" style={{animation:"dash-flow 3s linear infinite"}}/>
                )}
                {/* Main node */}
                <circle cx={n.x} cy={n.y} r={r} fill={isSel?color:`${color}cc`}
                  stroke={isSel?"rgba(255,255,255,0.6)":color} strokeWidth={isSel?2:1}
                  opacity={isDimmed?0.25:1}
                  style={{filter:`drop-shadow(0 0 ${isSel?10:5}px ${color}${isSel?"bb":"50"})`,transition:"all 0.2s"}}/>
                {/* Icon */}
                <text x={n.x} y={n.y+4} textAnchor="middle" fill="rgba(255,255,255,0.95)" fontSize="11" style={{userSelect:"none",pointerEvents:"none"}}>{typeIcons[n.type]}</text>
                {/* Label */}
                <text x={n.x} y={n.y+r+14} textAnchor="middle" fill={isSel?"var(--text-1)":"rgba(255,255,255,0.38)"} fontSize="9" fontFamily="Inter,sans-serif" style={{transition:"fill 0.2s"}}>{n.label}</text>
                {/* Risk label */}
                {riskOverlay && (
                  <text x={n.x} y={n.y+r+24} textAnchor="middle" fill={riskColorLight(n.risk)} fontSize="8" fontFamily="JetBrains Mono,monospace" fontWeight="600">{n.risk}</text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Right panel */}
      {selNode && (
        <div className="anim-slide-r" style={{width:288,background:"var(--panel)",borderLeft:"1px solid var(--border)",padding:20,overflowY:"auto",display:"flex",flexDirection:"column",gap:14}}>
          <div>
            <div style={{fontSize:9.5,color:"var(--text-4)",textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:6}}>{selNode.type.toUpperCase()} NODE</div>
            <div className="display" style={{fontSize:17,fontWeight:700,color:"var(--text-1)",marginBottom:8}}>{selNode.label}</div>
            <RiskBadge score={selNode.risk}/>
          </div>

          <div style={{display:"flex",justifyContent:"center"}}>
            <RingScore score={selNode.risk} size={110}/>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {[{label:"Connections",val:"14"},{label:"Transactions",val:"37"},{label:"Associated",val:"6"},{label:"Risk Δ",val:"+29"}].map(item=>(
              <div key={item.label} style={{background:"rgba(255,255,255,0.04)",borderRadius:8,padding:"10px 8px",textAlign:"center"}}>
                <div className="display" style={{fontSize:19,fontWeight:700,color:"var(--text-1)"}}>{item.val}</div>
                <div style={{fontSize:10,color:"var(--text-4)",marginTop:2}}>{item.label}</div>
              </div>
            ))}
          </div>

          {/* Connected nodes */}
          <div>
            <div style={{fontSize:11,color:"var(--text-4)",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>Connected To</div>
            {connectedEdges.map((e,i)=>{
              const otherId = e.from===selNode.id?e.to:e.from;
              const other = liveNodes.find(n=>n.id===otherId);
              if(!other) return null;
              const color = typeColors[other.type];
              return (
                <div key={i} style={{display:"flex",alignItems:"center",gap:9,padding:"7px 0",borderBottom:"1px solid var(--border)",cursor:"pointer"}} onClick={()=>setSelected(otherId)}>
                  <div style={{width:7,height:7,borderRadius:"50%",background:color,flexShrink:0,boxShadow:`0 0 5px ${color}70`}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,color:"var(--text-1)",fontWeight:500}}>{other.label}</div>
                    <div style={{fontSize:10,color:"var(--text-4)"}}>{e.label}</div>
                  </div>
                  <RiskBadge score={other.risk}/>
                </div>
              );
            })}
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:7}}>
            <button className="btn btn-primary" style={{justifyContent:"center"}} onClick={()=>navigate("entity",entities[0])}>View Full Profile</button>
            <button className="btn btn-ghost" style={{justifyContent:"center"}} onClick={()=>navigate("network-risk")}>Network Risk Analysis</button>
            <button className="btn btn-ghost" style={{justifyContent:"center"}} onClick={()=>navigate("workspace")}>Add to Investigation</button>
          </div>
        </div>
      )}
    </div>
  );
}
