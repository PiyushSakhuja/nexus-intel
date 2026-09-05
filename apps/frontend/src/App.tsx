import { useState, useEffect, useRef, useCallback } from "react";
import { io as socketIo } from "socket.io-client";
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
} from "./data";

// Kept so every OTHER screen (search, dashboard, investigations, etc.) that
// still reads the hardcoded demo array keeps working unchanged. Only
// EntitiesScreen below has been switched over to the real API.
const entities = mockEntities;

// ─── Shared micro-components ─────────────────────────────────────────────────

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 56},${18 - (v / max) * 16}`).join(" ");
  return (
    <svg width={56} height={18} viewBox="0 0 56 18" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={`sg-${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={pts} opacity="0.9" />
    </svg>
  );
}

function RingScore({ score, size = 100, animate = true }: { score: number; size?: number; animate?: boolean }) {
  const r = (size - 20) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const col = riskColor(score);
  const colLight = riskColorLight(score);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <radialGradient id={`rg-${score}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={col} stopOpacity="0.15" />
          <stop offset="100%" stopColor={col} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={size/2} cy={size/2} r={r+6} fill={`url(#rg-${score})`} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={7} />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={colLight} strokeWidth={7} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={animate ? { transition: "stroke-dashoffset 1.1s cubic-bezier(0.22,1,0.36,1)", filter: `drop-shadow(0 0 5px ${col}80)` } : { filter: `drop-shadow(0 0 5px ${col}80)` }}
      />
      <text x={size/2} y={size/2 + 6} textAnchor="middle" fill={colLight} fontSize={size > 90 ? 22 : 15} fontWeight="700" fontFamily="Manrope, sans-serif">{score}</text>
      <text x={size/2} y={size/2 + 18} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="8" fontFamily="Inter, sans-serif">/100</text>
    </svg>
  );
}

function RiskBadge({ score }: { score: number }) {
  const label = riskLabel(score);
  const cls = label === "CRITICAL" ? "badge-critical" : label === "HIGH" ? "badge-high" : label === "MEDIUM" ? "badge-medium" : "badge-low";
  return <span className={`badge ${cls}`}>{label}</span>;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="c-tooltip">
      <div className="c-label">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="c-value" style={{ color: p.color }}>{p.name}: {p.value}</div>
      ))}
    </div>
  );
}

function Section({ title, sub, children, action }: { title: string; sub?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>{title}</div>
          {sub && <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>{sub}</div>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function PulseIndicator({ color }: { color: string }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", width: 8, height: 8 }}>
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color, animation: "pulse-dot 2s ease-in-out infinite", opacity: 0.6 }} />
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "block", boxShadow: `0 0 6px ${color}80` }} />
    </span>
  );
}

function BarContrib({ label, value, max = 28, color }: { label: string; value: number; max?: number; color: string }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 12 }}>
        <span style={{ color: "var(--text-2)" }}>{label}</span>
        <span style={{ color, fontWeight: 700 }}>+{value}</span>
      </div>
      <div className="risk-track">
        <div className="risk-fill" style={{ width: `${(value / max) * 100}%`, background: `linear-gradient(90deg, ${color}60, ${color})` }} />
      </div>
    </div>
  );
}

// ─── Login ────────────────────────────────────────────────────────────────────

function LoginNetworkViz() {
  const nodes = [
    {x:200,y:180,r:7,t:"entity"},{x:360,y:120,r:9,t:"market"},{x:480,y:240,r:6,t:"wallet"},
    {x:310,y:320,r:8,t:"entity"},{x:160,y:370,r:5,t:"comm"},{x:450,y:400,r:7,t:"wallet"},
    {x:560,y:160,r:5,t:"listing"},{x:250,y:250,r:5,t:"listing"},{x:390,y:480,r:4,t:"comm"},
    {x:130,y:500,r:3,t:"market"},{x:600,y:340,r:6,t:"entity"},{x:520,y:70,r:4,t:"wallet"},
  ];
  const edges = [[0,1],[1,2],[2,5],[1,3],[3,4],[3,5],[1,6],[0,7],[5,8],[4,9],[2,10],[6,11],[10,5]];
  const colors: Record<string,string> = {entity:"#6366f1",market:"#8b5cf6",wallet:"#06b6d4",comm:"#16a34a",listing:"#d97706"};

  return (
    <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:0.75}} viewBox="0 0 680 600" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="lv-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.08"/>
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0"/>
        </radialGradient>
        {Object.entries(colors).map(([k,v])=>(
          <radialGradient key={k} id={`lv-n-${k}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={v} stopOpacity="0.3"/>
            <stop offset="100%" stopColor={v} stopOpacity="0"/>
          </radialGradient>
        ))}
      </defs>
      <ellipse cx="340" cy="300" rx="240" ry="210" fill="url(#lv-glow)"/>
      {edges.map(([a,b],i)=>(
        <line key={i} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y}
          stroke="rgba(99,102,241,0.18)" strokeWidth="1" strokeDasharray="5 4"
          style={{animation:`dash-flow ${7+i*0.4}s linear infinite`}}/>
      ))}
      {nodes.map((n,i)=>(
        <g key={i} style={{cursor:"default"}}>
          <circle cx={n.x} cy={n.y} r={n.r+9} fill={`url(#lv-n-${n.t})`} style={{animation:`node-glow ${2.5+i*0.25}s ease-in-out infinite`}}/>
          <circle cx={n.x} cy={n.y} r={n.r} fill={colors[n.t]} opacity="0.9" style={{filter:`drop-shadow(0 0 5px ${colors[n.t]}90)`}}/>
        </g>
      ))}
    </svg>
  );
}

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => { setLoading(false); onLogin(); }, 1400);
  };

  return (
    <div className="login-root">
      {/* Left */}
      <div className="login-left">
        <LoginNetworkViz />
        <div className="scan-line" />
        <div style={{position:"absolute",bottom:40,left:44,zIndex:2}}>
          <div style={{fontSize:10,color:"var(--text-4)",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:6}}>Intelligence Platform</div>
          <div className="display grad-text" style={{fontSize:32,fontWeight:800,letterSpacing:"-0.03em"}}>NEXUS</div>
          <div style={{fontSize:12,color:"var(--text-3)",marginTop:4}}>From signals to intelligence.</div>
        </div>
        {/* Corner grid decoration */}
        <div style={{position:"absolute",top:0,right:0,width:200,height:200,opacity:0.04,backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 23px,rgba(99,102,241,1) 23px,rgba(99,102,241,1) 24px),repeating-linear-gradient(90deg,transparent,transparent 23px,rgba(99,102,241,1) 23px,rgba(99,102,241,1) 24px)"}}/>
      </div>

      {/* Right */}
      <div className="login-right">
        <div style={{width:"100%",maxWidth:340}}>
          <div style={{textAlign:"center",marginBottom:40}}>
            <div className="display" style={{fontSize:24,fontWeight:800,letterSpacing:"-0.03em",marginBottom:4}}>
              <span className="grad-text">NEXUS</span>
              <span style={{color:"var(--text-1)"}}> INTEL</span>
            </div>
            <div style={{fontSize:12.5,color:"var(--text-3)"}}>Secure Investigative Intelligence</div>
          </div>

          <form onSubmit={submit}>
            <div style={{marginBottom:14}}>
              <label style={{display:"block",fontSize:10.5,color:"var(--text-3)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>Investigator ID</label>
              <input className="input" placeholder="Enter investigator ID" value={id} onChange={e=>setId(e.target.value)} autoComplete="username"/>
            </div>
            <div style={{marginBottom:22}}>
              <label style={{display:"block",fontSize:10.5,color:"var(--text-3)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>Password</label>
              <input className="input" type="password" placeholder="••••••••••••" value={pw} onChange={e=>setPw(e.target.value)} autoComplete="current-password"/>
            </div>
            <button type="submit" className="btn btn-primary btn-lg" style={{width:"100%",justifyContent:"center",marginBottom:16}}>
              {loading
                ? <><span style={{width:14,height:14,border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 0.7s linear infinite",display:"inline-block"}}/> Authenticating…</>
                : "Sign In Securely"}
            </button>
          </form>

          <div style={{textAlign:"center",marginBottom:28}}>
            <span style={{fontSize:10.5,color:"var(--text-4)",letterSpacing:"0.06em",textTransform:"uppercase"}}>Authorised Personnel Only</span>
          </div>

          <div style={{display:"flex",gap:10}}>
            {[
              {icon:"⚿",label:"Encrypted Connection"},
              {icon:"☰",label:"Audit Logging"},
              {icon:"⊕",label:"Access Controlled"},
            ].map(item=>(
              <div key={item.label} style={{flex:1,background:"rgba(255,255,255,0.03)",border:"1px solid var(--border)",borderRadius:8,padding:"9px 6px",textAlign:"center"}}>
                <div style={{fontSize:15,marginBottom:4,color:"var(--text-3)"}}>{item.icon}</div>
                <div style={{fontSize:9,color:"var(--text-4)",lineHeight:1.4,letterSpacing:"0.03em"}}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar + Topbar ─────────────────────────────────────────────────────────

const NAV = [
  {key:"overview",   icon:"◈", label:"Overview"},
  {key:"search",     icon:"⌕", label:"Intelligence Search"},
  {key:"alerts",     icon:"◉", label:"Alerts"},
  {key:"entities",   icon:"◫", label:"Entities"},
  {key:"graph",      icon:"⬡", label:"Network Graph"},
  {key:"listings",   icon:"▤", label:"Listings Intelligence"},
  {key:"blockchain", icon:"◇", label:"Blockchain Intelligence"},
  {key:"investigations",icon:"◑",label:"Investigations"},
  {key:"evidence",   icon:"◳", label:"Evidence"},
  {key:"analytics",  icon:"▩", label:"Analytics"},
  {key:"reports",    icon:"◫", label:"Reports"},
  {key:"audit",      icon:"◻", label:"Audit Logs"},
];

function Sidebar({ current, navigate }: { current: string; navigate: (s: string) => void }) {
  const active = (key: string) =>
    key === current ||
    (key === "entities" && current === "entity") ||
    (key === "investigations" && (current === "workspace" || current === "timeline")) ||
    (key === "graph" && current === "network-risk");

  return (
    <div className="sidebar" style={{gridRow:2}}>
      {/* Logo */}
      <div style={{padding:"18px 16px 14px",borderBottom:"1px solid var(--border)"}}>
        <div className="display grad-text" style={{fontSize:17,fontWeight:800,letterSpacing:"-0.02em"}}>NEXUS</div>
        <div style={{fontSize:9,color:"var(--text-4)",letterSpacing:"0.1em",textTransform:"uppercase",marginTop:2}}>Intelligence Platform</div>
      </div>

      {/* Nav items */}
      <div style={{flex:1,padding:"8px 8px",overflowY:"auto"}} className="scroll-reveal">
        <div style={{fontSize:9,color:"var(--text-4)",letterSpacing:"0.1em",textTransform:"uppercase",padding:"6px 12px 4px"}}>Navigation</div>
        {NAV.map(n=>(
          <div key={n.key} className={`nav-item ${active(n.key)?"active":""}`} onClick={()=>navigate(n.key)}>
            <span style={{fontSize:13,flexShrink:0,opacity:active(n.key)?1:0.7}}>{n.icon}</span>
            <span className="label" style={{fontSize:12.5}}>{n.label}</span>
          </div>
        ))}
      </div>

      {/* Bottom */}
      <div style={{borderTop:"1px solid var(--border)",padding:"10px 8px"}}>
        <div className={`nav-item ${current==="admin"?"active":""}`} onClick={()=>navigate("admin")}>
          <span style={{fontSize:13}}>⊞</span><span className="label">Admin</span>
        </div>
        <div className="nav-item">
          <span style={{fontSize:13}}>⚙</span><span className="label">Settings</span>
        </div>
        <div style={{margin:"8px 4px 0",padding:"9px 12px",background:"rgba(99,102,241,0.08)",borderRadius:8,border:"1px solid rgba(99,102,241,0.14)"}}>
          <div style={{fontSize:12,fontWeight:600,color:"var(--text-1)"}}>Investigator A</div>
          <div style={{fontSize:10,color:"var(--accent-hi)",marginTop:1}}>Senior Investigator</div>
        </div>
      </div>
    </div>
  );
}

function Topbar() {
  const [time, setTime] = useState(new Date());
  useEffect(()=>{ const t = setInterval(()=>setTime(new Date()),1000); return ()=>clearInterval(t); },[]);

  return (
    <div className="topbar" style={{gridColumn:"1/-1"}}>
      {/* Logo zone */}
      <div style={{width:216,flexShrink:0,paddingLeft:20,borderRight:"1px solid var(--border)",height:"100%",display:"flex",alignItems:"center"}}>
        <div className="display grad-text" style={{fontSize:15,fontWeight:800,letterSpacing:"-0.02em"}}>NEXUS INTEL</div>
      </div>

      {/* Search */}
      <div style={{flex:1,maxWidth:420,marginLeft:8}}>
        <div style={{display:"flex",alignItems:"center",gap:9,background:"rgba(255,255,255,0.04)",border:"1px solid var(--border-mid)",borderRadius:8,padding:"7px 13px"}}>
          <span style={{color:"var(--text-4)",fontSize:14}}>⌕</span>
          <input style={{background:"none",border:"none",outline:"none",color:"var(--text-2)",fontSize:12.5,flex:1,fontFamily:"Inter,sans-serif"}} placeholder="Global search — entity, wallet, case, alert…"/>
        </div>
      </div>

      <div style={{flex:1}}/>

      {/* Clock */}
      <div className="mono" style={{fontSize:11.5,color:"var(--text-3)"}}>
        {time.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})} · {time.toLocaleTimeString()}
      </div>

      {/* Bell */}
      <div style={{position:"relative",cursor:"pointer",padding:"4px 6px"}}>
        <span style={{fontSize:17,color:"var(--text-3)"}}>🔔</span>
        <span style={{position:"absolute",top:2,right:2,width:8,height:8,borderRadius:"50%",background:"var(--critical)",boxShadow:"0 0 6px var(--critical-glow)",display:"block"}}/>
      </div>

      {/* Status */}
      <div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 11px",background:"rgba(22,163,74,0.08)",border:"1px solid rgba(22,163,74,0.2)",borderRadius:6}}>
        <PulseIndicator color="#16a34a"/>
        <span style={{fontSize:11,color:"var(--low-light)",fontWeight:600}}>Secure</span>
      </div>

      {/* Avatar */}
      <div style={{display:"flex",alignItems:"center",gap:8,paddingLeft:4}}>
        <div style={{width:30,height:30,borderRadius:"50%",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#fff",flexShrink:0}}>IA</div>
      </div>
    </div>
  );
}

// ─── OVERVIEW ─────────────────────────────────────────────────────────────────

// ─── Event type metadata ─────────────────────────────────────────────────────

const EVENT_META: Record<string,{label:string;icon:string;color:string}> = {
  event_detected:  { label:"Event Detected",   icon:"◉", color:"#06b6d4" },
  correlation:     { label:"Entity Correlated", icon:"◈", color:"#6366f1" },
  risk_updated:    { label:"Risk Updated",      icon:"▲", color:"#f59e0b" },
  alert_generated: { label:"Alert Generated",   icon:"⚠", color:"#dc2626" },
};

// ─── Shared socket singleton (created once, reused across mounts) ────────────

let _socket: ReturnType<typeof socketIo> | null = null;
function getSocket() {
  if (!_socket) {
    _socket = socketIo("http://localhost:4000", { transports: ["websocket","polling"] });
  }
  return _socket;
}

function OverviewScreen({ navigate }: { navigate:(s:string,d?:any)=>void }) {
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
                <tr key={n.id} onClick={()=>navigate("network-risk")}>
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

// ─── SEARCH ───────────────────────────────────────────────────────────────────

function SearchScreen({ navigate }: { navigate:(s:string,d?:any)=>void }) {
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

// ─── ENTITY PROFILE ───────────────────────────────────────────────────────────

function EntityScreen({ entity, navigate }: { entity: Entity; navigate:(s:string,d?:any)=>void }) {
  const [tab, setTab] = useState("Overview");
  const tabs = ["Overview","Relationships","Activity","Evidence","Timeline"];

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
                {entity.identifiers.map(id=>(
                  <div key={id.type} style={{background:"rgba(255,255,255,0.03)",borderRadius:7,padding:"9px 12px"}}>
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
                  "Risk increased due to repeated identifiers across multiple intelligence sources, association with high-risk network entities, and an abnormal activity pattern consistent with coordinated behaviour over a 4-day window."
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
                  {label:"Marketplaces",val:entity.marketplaces,icon:"▤"},
                  {label:"Wallets",val:entity.wallets,icon:"◇"},
                  {label:"Listings",val:entity.listings,icon:"▣"},
                  {label:"Comm IDs",val:entity.comms,icon:"◉"},
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

      {(tab==="Relationships"||tab==="Activity"||tab==="Evidence") && (
        <div style={{textAlign:"center",padding:"60px 0",color:"var(--text-4)"}}>
          <div style={{fontSize:32,marginBottom:12,opacity:0.3}}>◫</div>
          <div>Navigate to the dedicated <button onClick={()=>navigate(tab==="Evidence"?"evidence":"graph")} style={{background:"none",border:"none",color:"var(--accent-hi)",cursor:"pointer",fontSize:13,textDecoration:"underline"}}>{tab==="Evidence"?"Evidence Repository":"Network Graph"}</button> for this view.</div>
        </div>
      )}
    </div>
  );
}

// ─── NETWORK GRAPH ────────────────────────────────────────────────────────────

function GraphScreen({ navigate }: { navigate:(s:string,d?:any)=>void }) {
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

// ─── NETWORK RISK ─────────────────────────────────────────────────────────────

function NetworkRiskScreen({ navigate }: { navigate:(s:string,d?:any)=>void }) {
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

// ─── ALERTS ───────────────────────────────────────────────────────────────────

function AlertsScreen({ navigate }: { navigate:(s:string,d?:any)=>void }) {
  const [tab, setTab] = useState("All");
  const tabs = ["All","Critical","High","Medium","Resolved"];
  const [alertRows, setAlertRows] = useState<any[]>(alerts);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [alertsError, setAlertsError] = useState<string|null>(null);

  useEffect(() => {
    fetch("http://localhost:4000/api/alerts")
      .then(res => { if (!res.ok) throw new Error(`API ${res.status}`); return res.json(); })
      .then(data => {
        // normalise DB rows to match the shape the UI expects
        const normalised = data.map((a: any) => ({
          ...a,
          severity: a.severity ?? a.risk ?? 50,
          status: (a.status ?? "NEW").toLowerCase(),
          time: a.createdAt ? new Date(a.createdAt).toLocaleString() : a.time ?? "",
          network: a.network?.displayId ?? a.network ?? null,
          entities: (a.entities ?? []).map((ae: any) => ae.entity?.alias ?? ae.entity?.displayId ?? ae),
          title: a.title ?? a.type ?? "Alert",
          reason: a.reason ?? a.description ?? "",
        }));
        setAlertRows(normalised);
        setAlertsError(null);
      })
      .catch(err => setAlertsError(err.message))
      .finally(() => setAlertsLoading(false));
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
                  {a.entities.map(e=>(
                    <span key={e} className="mono-sm" style={{background:"rgba(99,102,241,0.09)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:4,padding:"2px 8px",color:"var(--accent-hi)"}}>{e}</span>
                  ))}
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

// ─── ENTITIES LIST ────────────────────────────────────────────────────────────

function EntitiesScreen({ navigate }: { navigate:(s:string,d?:any)=>void }) {
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

// ─── LISTINGS ─────────────────────────────────────────────────────────────────

function ListingsScreen() {
  const [rows, setRows] = useState<any[]>(listings);
  const [sel, setSel] = useState<any|null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);

  useEffect(() => {
    fetch("http://localhost:4000/api/listings")
      .then(res => { if (!res.ok) throw new Error(`API returned ${res.status}`); return res.json(); })
      .then(data => { setRows(data); setError(null); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const fmtDate = (v:any) => {
    if (!v) return "—";
    const d = new Date(v);
    return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString();
  };
  const signalsList = (v:any): string[] => Array.isArray(v) ? v : [];
  const signalsLabel = (v:any) => Array.isArray(v) ? (v.length ? v.join(", ") : "—") : (v!=null ? `${v} detected` : "—");
  const priceLabel = (v:any) => v!=null ? `$${Number(v).toFixed(2)}` : "—";

  return (
    <div style={{padding:"26px 28px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
        <div>
          <h1 className="section-head">Listings Intelligence</h1>
          <p className="page-sub">Flagged intelligence records — synthetic/demo data only. No purchase functionality.</p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <input className="input" style={{width:200,padding:"7px 12px",fontSize:12}} placeholder="Filter records…"/>
          <button className="btn btn-ghost btn-sm">Export</button>
        </div>
      </div>
      {loading && <p className="page-sub" style={{marginBottom:12}}>Loading listings…</p>}
      {error && <p className="page-sub" style={{marginBottom:12,color:"var(--high-light)"}}>Couldn't reach the API ({error}) — showing demo data instead.</p>}
      <div style={{display:"grid",gridTemplateColumns:sel?"1fr 360px":"1fr",gap:16,transition:"all 0.25s"}}>
        <div className="card">
          <table className="data-table">
            <thead><tr><th>Record ID</th><th>Marketplace</th><th>Vendor</th><th>Title</th><th>Category</th><th>Risk</th><th>Price</th><th>First Seen</th><th>Last Seen</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map(l=>(
                <tr key={l.id} className={sel?.id===l.id?"selected":""} onClick={()=>setSel(l.id===sel?.id?null:l)}>
                  <td><span className="mono" style={{color:"var(--accent-hi)",fontSize:12}}>{l.displayId ?? l.id}</span></td>
                  <td>{l.marketplace ?? (typeof l.source === "string" ? l.source : l.source?.name) ?? "—"}</td>
                  <td>{l.vendorAlias ?? "—"}</td>
                  <td style={{maxWidth:220,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={l.title ?? undefined}>{l.title ?? "—"}</td>
                  <td><span className="badge badge-accent" style={{fontSize:9}}>{l.category}</span></td>
                  <td>
                    <div style={{display:"flex",alignItems:"center",gap:7}}>
                      <span style={{fontWeight:700,color:riskColorLight(l.risk)}}>{l.risk}</span>
                      <RiskBadge score={l.risk}/>
                    </div>
                  </td>
                  <td>{priceLabel(l.priceUsd)}</td>
                  <td>{fmtDate(l.firstSeen ?? l.first)}</td>
                  <td>{fmtDate(l.lastSeen ?? l.last)}</td>
                  <td>
                    <span style={{fontSize:11,padding:"2px 8px",borderRadius:4,background:l.status==="Flagged"||l.status==="flagged"?riskBg(80):l.status==="Under Review"?riskBg(60):l.status==="Monitoring"?riskBg(40):"rgba(255,255,255,0.04)",color:l.status==="Flagged"||l.status==="flagged"?riskColorLight(80):l.status==="Under Review"?riskColorLight(60):l.status==="Monitoring"?riskColorLight(40):"var(--text-3)",border:`1px solid ${l.status==="Flagged"||l.status==="flagged"?riskBorder(80):l.status==="Under Review"?riskBorder(60):l.status==="Monitoring"?riskBorder(40):"var(--border)"}`}}>{l.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sel && (
          <div className="card anim-slide-r" style={{padding:20,height:"fit-content"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}>
              <div style={{fontSize:13,fontWeight:600,color:"var(--text-1)"}}>Record Details</div>
              <button onClick={()=>setSel(null)} style={{background:"none",border:"none",color:"var(--text-4)",cursor:"pointer",fontSize:20,lineHeight:1}}>×</button>
            </div>
            <div className="mono" style={{fontSize:11,color:"var(--accent-hi)",marginBottom:4}}>{sel.displayId ?? sel.id}</div>
            {sel.title && <div style={{fontSize:13,color:"var(--text-1)",marginBottom:12}}>{sel.title}</div>}
            <div style={{display:"flex",justifyContent:"center",marginBottom:16}}><RingScore score={sel.risk} size={100}/></div>

            {[
              {l:"Marketplace",v:sel.marketplace ?? (typeof sel.source === "string" ? sel.source : sel.source?.name) ?? "—"},
              {l:"Vendor",v:sel.vendorAlias ?? "—"},
              {l:"Category",v:sel.category},
              {l:"Risk Score",v:`${sel.risk} / 100`},
              {l:"Price (USD)",v:priceLabel(sel.priceUsd)},
              {l:"Ships From",v:sel.shipsFrom ?? "—"},
              {l:"First Seen",v:fmtDate(sel.firstSeen ?? sel.first)},{l:"Last Seen",v:fmtDate(sel.lastSeen ?? sel.last)},{l:"Status",v:sel.status},
            ].map(item=>(
              <div key={item.l} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--border)"}}>
                <span style={{fontSize:11,color:"var(--text-4)"}}>{item.l}</span>
                <span style={{fontSize:12,color:"var(--text-2)"}}>{item.v}</span>
              </div>
            ))}

            {(sel.patterns ?? signalsList(sel.signals)).length>0 && (
              <div style={{marginTop:14}}>
                <div style={{fontSize:11,color:"var(--text-4)",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>Detected Patterns</div>
                {(sel.patterns ?? signalsList(sel.signals)).map((p:string)=>(
                  <div key={p} style={{display:"flex",gap:7,alignItems:"center",marginBottom:6}}>
                    <div style={{width:5,height:5,borderRadius:"50%",background:"var(--accent)",flexShrink:0}}/>
                    <span style={{fontSize:12,color:"var(--text-2)"}}>{p}</span>
                  </div>
                ))}
              </div>
            )}

            {(sel.entities ?? []).length>0 && (
              <div style={{marginTop:12}}>
                <div style={{fontSize:11,color:"var(--text-4)",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>Related Entities</div>
                {sel.entities.map((e:string)=>(
                  <span key={e} className="mono-sm" style={{display:"inline-block",margin:"0 6px 6px 0",background:"var(--accent-dim)",border:"1px solid rgba(99,102,241,0.22)",borderRadius:4,padding:"2px 8px",color:"var(--accent-hi)"}}>{e}</span>
                ))}
              </div>
            )}

            <button className="btn btn-primary" style={{width:"100%",justifyContent:"center",marginTop:16}}>Add to Investigation</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── BLOCKCHAIN ───────────────────────────────────────────────────────────────

function BlockchainScreen() {
  const [walletRows, setWalletRows] = useState<any[]>(wallets);
  const [walletsLoading, setWalletsLoading] = useState(true);
  const [walletsError, setWalletsError] = useState<string|null>(null);
  const [sel, setSel] = useState<any>(wallets[0]);

  useEffect(() => {
    fetch("http://localhost:4000/api/wallets")
      .then(res => { if (!res.ok) throw new Error(`API ${res.status}`); return res.json(); })
      .then(data => {
        const normalised = data.map((w: any) => ({
          ...w,
          txns: w.txns ?? w.txnCount ?? 0,
          entities: w.entities ?? w.entityCount ?? 0,
          cluster: w.cluster ?? w.clusterId ?? "—",
          totalVol: w.totalVol ?? w.totalVolume ?? "—",
          first: w.first ?? (w.firstSeen ? new Date(w.firstSeen).toLocaleDateString() : "—"),
          last: w.last ?? (w.lastSeen ? new Date(w.lastSeen).toLocaleDateString() : "—"),
          flagged: w.flagged ?? w.risk >= 70,
        }));
        setWalletRows(normalised);
        if (normalised.length > 0) setSel(normalised[0]);
        setWalletsError(null);
      })
      .catch(err => setWalletsError(err.message))
      .finally(() => setWalletsLoading(false));
  }, []);

  // Derived from walletRows (real once the /api/wallets fetch lands, mock
  // data otherwise) instead of hardcoded numbers that never matched what
  // the table below actually showed.
  const totalTxns = walletRows.reduce((sum, w) => sum + (w.txns ?? 0), 0);
  const blockKpis = [
    {label:"Tracked Wallets",val:String(walletRows.length),color:"#6366f1"},
    {label:"High-Risk Wallets",val:String(walletRows.filter(w=>w.risk>=70).length),color:"var(--critical)"},
    {label:"Transactions Analysed",val: totalTxns>=1000 ? `${(totalTxns/1000).toFixed(1)}K` : String(totalTxns), color:"var(--cyan)"},
    {label:"Emerging Clusters",val:String(new Set(walletRows.map(w=>w.cluster)).size),color:"var(--purple)"},
  ];

  return (
    <div style={{padding:"26px 28px"}}>
      <div style={{marginBottom:22}}>
        <h1 className="section-head">Blockchain Intelligence</h1>
        <p className="page-sub">Wallet analytics and transaction pattern analysis — synthetic demo data only.</p>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:13,marginBottom:20}}>
        {blockKpis.map(k=>(
          <div key={k.label} className="card" style={{padding:"16px 18px"}}>
            <div style={{fontSize:10,color:"var(--text-4)",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>{k.label}</div>
            <div className="display" style={{fontSize:28,fontWeight:700,color:k.color}}>{k.val}</div>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 300px",gap:16}}>
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          {/* Wallet table */}
          {walletsLoading && <p className="page-sub" style={{marginBottom:8,paddingLeft:16}}>Loading wallets…</p>}
          {walletsError && <p className="page-sub" style={{marginBottom:8,paddingLeft:16,color:"var(--high-light)"}}>Couldn't reach the API — showing demo data.</p>}
          <div className="card">
            <table className="data-table">
              <thead><tr><th>Wallet ID</th><th>Risk</th><th>Transactions</th><th>Entities</th><th>Cluster</th><th>Volume</th><th>Last Active</th></tr></thead>
              <tbody>
                {walletRows.map(w=>(
                  <tr key={w.id} className={sel?.id===w.id?"selected":""} onClick={()=>setSel(w)}>
                    <td>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        {w.flagged&&<div style={{width:6,height:6,borderRadius:"50%",background:"var(--critical)",boxShadow:"0 0 5px var(--critical-glow)",flexShrink:0}}/>}
                        <span className="mono" style={{color:"var(--cyan)",fontSize:12}}>{w.id}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{display:"flex",alignItems:"center",gap:7}}>
                        <span style={{fontWeight:700,color:riskColorLight(w.risk)}}>{w.risk}</span>
                        <RiskBadge score={w.risk}/>
                      </div>
                    </td>
                    <td>{w.txns}</td>
                    <td>{w.entities}</td>
                    <td><span className="mono-sm" style={{color:"var(--accent-hi)"}}>{w.cluster}</span></td>
                    <td><span className="mono-sm" style={{color:"var(--text-3)"}}>{w.totalVol}</span></td>
                    <td><span style={{fontSize:11}}>{w.last.split(",")[0]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Transaction timeline */}
          <div className="card" style={{padding:20}}>
            <div style={{fontSize:13,fontWeight:600,color:"var(--text-1)",marginBottom:4}}>Transaction Volume — {sel.id}</div>
            <div style={{fontSize:11,color:"var(--text-3)",marginBottom:16}}>Synthetic volume by date (BTC-equivalent)</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={walletClusterData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                <XAxis dataKey="date" tick={{fill:"var(--text-4)",fontSize:10}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:"var(--text-4)",fontSize:10}} axisLine={false} tickLine={false}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Bar dataKey="vol" fill="var(--cyan)" radius={[4,4,0,0]} name="Volume" opacity={0.85}/>
                <Bar dataKey="txns" fill="var(--accent)" radius={[4,4,0,0]} name="Txns" opacity={0.6}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Wallet detail */}
        <div className="card" style={{padding:20,height:"fit-content"}}>
          <div style={{fontSize:10.5,color:"var(--text-4)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>Selected Wallet</div>
          <div className="mono" style={{fontSize:14,fontWeight:600,color:"var(--cyan)",marginBottom:8}}>{sel.id}</div>
          <RiskBadge score={sel.risk}/>
          <div style={{display:"flex",justifyContent:"center",margin:"18px 0"}}><RingScore score={sel.risk} size={110}/></div>

          {sel.flagged && (
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:"rgba(220,38,38,0.07)",border:"1px solid rgba(220,38,38,0.2)",borderRadius:7,marginBottom:14}}>
              <PulseIndicator color="var(--critical)"/>
              <span style={{fontSize:11.5,color:"var(--critical-light)",fontWeight:600}}>Network association detected</span>
            </div>
          )}

          {[
            {l:"Transactions",v:sel.txns},{l:"Connected Entities",v:sel.entities},
            {l:"Cluster",v:sel.cluster},{l:"Total Volume",v:sel.totalVol},
            {l:"First Observed",v:sel.first},{l:"Last Observed",v:sel.last},
          ].map(item=>(
            <div key={item.l} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--border)"}}>
              <span style={{fontSize:11,color:"var(--text-4)"}}>{item.l}</span>
              <span style={{fontSize:12,color:"var(--text-2)",fontFamily:typeof item.v==="string"&&item.v.includes("Cluster")?"JetBrains Mono,monospace":"Inter,sans-serif"}}>{item.v}</span>
            </div>
          ))}
          <button className="btn btn-primary" style={{width:"100%",justifyContent:"center",marginTop:16}}>Add to Investigation</button>
        </div>
      </div>
    </div>
  );
}

// ─── INVESTIGATIONS ───────────────────────────────────────────────────────────

function InvestigationsScreen({ navigate }: { navigate:(s:string,d?:any)=>void }) {
  const statusColor: Record<string,string> = {
    "UNDER INVESTIGATION":"var(--medium-light)",
    "UNDER REVIEW":"var(--accent-hi)",
    "MONITORING":"#22d3ee",
    "CLOSED":"var(--text-4)",
  };
  const [invRows, setInvRows] = useState<any[]>(investigations);
  const [invLoading, setInvLoading] = useState(true);
  const [invError, setInvError] = useState<string|null>(null);

  useEffect(() => {
    fetch("http://localhost:4000/api/investigations")
      .then(res => { if (!res.ok) throw new Error(`API ${res.status}`); return res.json(); })
      .then(data => {
        const normalised = data.map((inv: any) => ({
          ...inv,
          // DB rows carry both a cuid `id` and a readable `displayId`
          // ("INV-2026-042") — the UI expects the latter wherever it shows
          // `inv.id`.
          id: inv.displayId ?? inv.id,
          entities: inv._count?.entities ?? inv.entities ?? 0,
          evidence: inv._count?.evidence ?? inv.evidence ?? 0,
          // InvestigationStatus enum values use underscores ("UNDER_REVIEW");
          // the status pill colours/labels are keyed on spaced text.
          status: (inv.status ?? "UNDER_INVESTIGATION").replace(/_/g, " "),
          priority: inv.priority ?? "MEDIUM",
          assignee: inv.assignee ?? "Unassigned",
          updated: inv.updatedAt ? new Date(inv.updatedAt).toLocaleDateString() : inv.updated ?? "",
          description: inv.description ?? "",
        }));
        setInvRows(normalised);
        setInvError(null);
      })
      .catch(err => setInvError(err.message))
      .finally(() => setInvLoading(false));
  }, []);

  return (
    <div style={{padding:"26px 28px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
        <div>
          <h1 className="section-head">Investigations</h1>
          <p className="page-sub">Active and historical investigation case management.</p>
        </div>
        <button className="btn btn-primary">+ New Investigation</button>
      </div>
      {invLoading && <p className="page-sub" style={{marginBottom:12}}>Loading investigations…</p>}
      {invError && <p className="page-sub" style={{marginBottom:12,color:"var(--high-light)"}}>Couldn't reach the API ({invError}) — showing demo data.</p>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
        {invRows.map((inv,i)=>(
          <div key={inv.id} className={`card card-hover anim-fade-up delay-${i+1}`} style={{padding:20}} onClick={()=>navigate("workspace",inv.id)}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
              <span className="mono-sm" style={{color:"var(--accent-hi)"}}>{inv.id}</span>
              <span className={`badge ${inv.priority==="HIGH"?"badge-high":inv.priority==="MEDIUM"?"badge-medium":"badge-low"}`}>{inv.priority}</span>
            </div>
            <div className="display" style={{fontSize:15,fontWeight:700,color:"var(--text-1)",marginBottom:8,lineHeight:1.35}}>{inv.title}</div>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:14}}>
              <PulseIndicator color={statusColor[inv.status]||"var(--text-4)"}/>
              <span style={{fontSize:11,color:statusColor[inv.status]||"var(--text-4)",fontWeight:600}}>{inv.status}</span>
            </div>
            <div style={{fontSize:12,color:"var(--text-3)",lineHeight:1.5,marginBottom:14}}>{inv.description.slice(0,100)}…</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
              {[{l:"Entities",v:inv.entities},{l:"Evidence",v:inv.evidence}].map(item=>(
                <div key={item.l} style={{textAlign:"center",background:"rgba(255,255,255,0.03)",borderRadius:7,padding:"9px 0"}}>
                  <div className="display" style={{fontSize:20,fontWeight:700,color:"var(--text-1)"}}>{item.v}</div>
                  <div style={{fontSize:10,color:"var(--text-4)"}}>{item.l}</div>
                </div>
              ))}
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--text-4)"}}>
              <span>{inv.assignee}</span>
              <span>{inv.updated}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── WORKSPACE ────────────────────────────────────────────────────────────────

function WorkspaceScreen({ navigate, displayId }: { navigate:(s:string,d?:any)=>void; displayId?: string|null }) {
  const [note, setNote] = useState("");
  const [accepted, setAccepted] = useState(false);

  // ─── Real investigation data ────────────────────────────────────────────
  // Falls back to the demo array (and shows a banner) if the API can't be
  // reached, or while we don't yet know which investigation to load.
  const [inv, setInv] = useState<any>(investigations[0]);
  const [invLoading, setInvLoading] = useState(true);
  const [invError, setInvError] = useState<string|null>(null);

  useEffect(() => {
    let cancelled = false;
    setInvLoading(true);
    setInvError(null);

    const load = async () => {
      // No specific case was passed in (e.g. navigated here from a screen
      // that doesn't carry an investigation) — fall back to the most
      // recently updated real investigation so the workspace still shows
      // live data instead of only ever the mock case.
      let targetId = displayId;
      if (!targetId) {
        const listRes = await fetch("http://localhost:4000/api/investigations");
        if (!listRes.ok) throw new Error(`API ${listRes.status}`);
        const list = await listRes.json();
        targetId = list[0]?.displayId;
        if (!targetId) throw new Error("No investigations found");
      }

      const res = await fetch(`http://localhost:4000/api/investigations/${targetId}`);
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      if (cancelled) return;

      setInv({
        ...data,
        id: data.displayId,
        entities: data.entities?.length ?? data._count?.entities ?? 0,
        evidence: data.evidence?.length ?? data._count?.evidence ?? 0,
        status: (data.status ?? "UNDER_INVESTIGATION").replace(/_/g, " "),
        priority: data.priority ?? "MEDIUM",
        assignee: data.assignee ?? "Unassigned",
        updated: data.updatedAt ? new Date(data.updatedAt).toLocaleString() : data.updated ?? "",
        description: data.description ?? "",
        relatedEntities: (data.entities ?? []).map((ie: any) => ie.entity),
        // AiAssessment rows come back newest-first (see GET /:displayId).
        latestAssessment: data.aiAssessments?.[0] ?? null,
      });
    };

    load()
      .catch((err) => { if (!cancelled) setInvError(err.message); })
      .finally(() => { if (!cancelled) setInvLoading(false); });

    return () => { cancelled = true; };
  }, [displayId]);

  // ─── AI Assessment ───────────────────────────────────────────────────────
  // Signals -> Gemini -> explanation -> stored -> displayed. The button
  // below triggers the whole pipeline server-side; we just render whatever
  // comes back (or whatever's already stored on the investigation).
  const [assessment, setAssessment] = useState<any>(null);
  const [assessLoading, setAssessLoading] = useState(false);
  const [assessError, setAssessError] = useState<string|null>(null);

  useEffect(() => {
    setAssessment(inv?.latestAssessment ?? null);
  }, [inv?.latestAssessment]);

  const runAiAssessment = async () => {
    if (!inv?.id) return;
    setAssessLoading(true);
    setAssessError(null);
    try {
      const res = await fetch(`http://localhost:4000/api/investigations/${inv.id}/ai-assessment`, { method: "POST" });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      setAssessment(data);
      setAccepted(false);
    } catch (err: any) {
      setAssessError(err.message);
    } finally {
      setAssessLoading(false);
    }
  };

  const recommendations: string[] = assessment?.recommendedNext
    ? (() => { try { return JSON.parse(assessment.recommendedNext); } catch { return [assessment.recommendedNext]; } })()
    : [
        "Expand network analysis to include second-degree connections of Alias_Y",
        "Request blockchain transaction records for Wallet_W1 and Wallet_W2",
        "Cross-reference communication identifiers with Source Gamma dataset",
        "Review temporal correlation between listing activity spikes and wallet transactions",
      ];

  return (
    <div style={{padding:"26px 28px"}}>
      {invLoading && <p className="page-sub" style={{marginBottom:12}}>Loading case…</p>}
      {invError && <p className="page-sub" style={{marginBottom:12,color:"var(--high-light)"}}>Couldn't reach the API ({invError}) — showing demo data.</p>}
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:22}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <button onClick={()=>navigate("investigations")} style={{background:"none",border:"none",color:"var(--text-3)",cursor:"pointer",fontSize:12,padding:0}}>← Investigations</button>
            <span style={{color:"var(--text-4)"}}>/</span>
            <span className="mono-sm" style={{color:"var(--accent-hi)"}}>{inv.id}</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:6}}>
            <h1 className="section-head display" style={{fontSize:20}}>{inv.title}</h1>
            <span className="badge badge-pending">{inv.status}</span>
            <span className={`badge ${inv.priority==="HIGH"?"badge-high":inv.priority==="MEDIUM"?"badge-medium":"badge-low"}`}>{inv.priority}</span>
          </div>
          <div style={{fontSize:12,color:"var(--text-3)"}}>Assigned to <span style={{color:"var(--text-2)"}}>{inv.assignee}</span> · Updated {inv.updated}</div>
        </div>
        <div style={{display:"flex",gap:7}}>
          <button className="btn btn-ghost btn-sm">Add Evidence</button>
          <button className="btn btn-ghost btn-sm">Add Note</button>
          <button className="btn btn-ghost btn-sm">Assign</button>
          <button className="btn btn-primary btn-sm" onClick={()=>navigate("reports")}>Generate Report</button>
          <button className="btn btn-danger btn-sm">Close Case</button>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 310px",gap:18}}>
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          {/* Summary */}
          <div className="card" style={{padding:20}}>
            <div style={{fontSize:13,fontWeight:600,color:"var(--text-1)",marginBottom:10}}>Case Summary</div>
            <div style={{fontSize:12.5,color:"var(--text-2)",lineHeight:1.7}}>{inv.description}</div>
          </div>

          {/* Entities */}
          <div className="card" style={{padding:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{fontSize:13,fontWeight:600,color:"var(--text-1)"}}>Related Entities ({inv.entities})</div>
              <button className="btn btn-ghost btn-sm" onClick={()=>navigate("entities")}>View All</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {(inv.relatedEntities?.length ? inv.relatedEntities : entities).slice(0,4).map((e:any)=>(
                <div key={e.displayId ?? e.id} style={{display:"flex",alignItems:"center",gap:11,padding:"10px 12px",background:"rgba(255,255,255,0.03)",borderRadius:8,cursor:"pointer",transition:"background 0.13s"}}
                  onMouseEnter={el=>{(el.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.05)";}}
                  onMouseLeave={el=>{(el.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.03)";}}>
                  <div style={{width:28,height:28,borderRadius:"50%",background:"rgba(99,102,241,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"var(--accent-hi)",flexShrink:0}}>◈</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12.5,fontWeight:500,color:"var(--text-1)"}}>{e.alias}</div>
                    <div className="mono-sm" style={{color:"var(--text-4)"}}>{e.displayId ?? e.id}</div>
                  </div>
                  <RiskBadge score={e.risk}/>
                  <button className="btn btn-ghost btn-sm" onClick={()=>navigate("entity",e)}>View</button>
                </div>
              ))}
            </div>
          </div>

          {/* Evidence */}
          <div className="card" style={{padding:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{fontSize:13,fontWeight:600,color:"var(--text-1)"}}>Evidence ({inv.evidence})</div>
              <button className="btn btn-ghost btn-sm" onClick={()=>navigate("evidence")}>View All</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              {evidenceRecords.slice(0,3).map(ev=>(
                <div key={ev.id} style={{display:"flex",alignItems:"center",gap:11,padding:"9px 12px",background:"rgba(255,255,255,0.03)",borderRadius:7}}>
                  <span className="mono-sm" style={{color:"var(--text-4)"}}>{ev.id}</span>
                  <span style={{flex:1,fontSize:12,color:"var(--text-2)"}}>{ev.type}</span>
                  <span style={{fontSize:11,color:"var(--text-4)"}}>{ev.ts.split("·")[0].trim()}</span>
                  <span className={`badge ${ev.status==="Verified"?"badge-verified":"badge-pending"}`}>{ev.status}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="card" style={{padding:20}}>
            <div style={{fontSize:13,fontWeight:600,color:"var(--text-1)",marginBottom:12}}>Investigator Notes</div>
            <textarea className="input" style={{minHeight:80,resize:"vertical",fontSize:12.5}} placeholder="Add investigation notes…" value={note} onChange={e=>setNote(e.target.value)}/>
            <button className="btn btn-ghost btn-sm" style={{marginTop:8}}>Save Note</button>
          </div>
        </div>

        {/* Right rail */}
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          {/* AI assessment */}
          <div className="card card-glow-accent" style={{padding:20}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <PulseIndicator color="var(--accent)"/>
                <div style={{fontSize:13,fontWeight:700,color:"var(--text-1)"}}>AI Assessment</div>
                {assessment && <RiskBadge score={assessment.riskScore}/>}
              </div>
              <button className="btn btn-ghost btn-sm" disabled={assessLoading} onClick={runAiAssessment}>
                {assessLoading ? "Running…" : assessment ? "Re-run" : "Run AI Assessment"}
              </button>
            </div>

            {assessError && (
              <div style={{fontSize:11.5,color:"var(--high-light)",marginBottom:12}}>Couldn't reach the API ({assessError}).</div>
            )}

            {!assessment && !assessLoading && !assessError && (
              <div style={{fontSize:12,color:"var(--text-3)",lineHeight:1.65,marginBottom:12}}>
                No assessment yet for this case. Click "Run AI Assessment" to generate one from the case's live signals.
              </div>
            )}

            {assessment && (
              <>
                <div style={{fontSize:12,color:"var(--text-2)",lineHeight:1.65,marginBottom:12}}>
                  {assessment.explanation}
                </div>
                {assessment.aiGenerated===false && (
                  <div style={{fontSize:10.5,color:"var(--text-4)",marginBottom:12}}>
                    Gemini was unreachable when this ran — showing a deterministic fallback summary instead of a generated narrative.
                  </div>
                )}
              </>
            )}

            <div className="ai-strip" style={{marginBottom:14}}>
              <span style={{color:"var(--medium-light)",fontSize:14,flexShrink:0}}>⚠</span>
              <div style={{fontSize:10.5,color:"var(--medium-light)"}}>AI-generated — all conclusions require investigator review. This assessment does not constitute a criminal determination.</div>
            </div>
            <div style={{fontSize:12,fontWeight:600,color:"var(--text-1)",marginBottom:10}}>Recommended Next Steps</div>
            {recommendations.map((r,i)=>(
              <div key={i} style={{display:"flex",gap:8,marginBottom:8,padding:"8px 10px",background:"rgba(255,255,255,0.03)",borderRadius:7}}>
                <span style={{color:"var(--accent-hi)",fontSize:11,flexShrink:0,fontWeight:700,minWidth:14}}>{i+1}.</span>
                <span style={{fontSize:11.5,color:"var(--text-2)",lineHeight:1.5}}>{r}</span>
              </div>
            ))}
            <div className="divider" style={{margin:"14px 0"}}/>
            <div style={{fontSize:11,color:"var(--text-4)",marginBottom:8}}>Investigator Decision</div>
            {accepted ? (
              <div className="integrity-banner"><span>✓</span> Recommendations accepted</div>
            ) : (
              <div style={{display:"flex",gap:7}}>
                <button className="btn btn-primary" style={{flex:1,justifyContent:"center",fontSize:11}} onClick={()=>setAccepted(true)}>Accept</button>
                <button className="btn btn-ghost" style={{flex:1,justifyContent:"center",fontSize:11}}>Modify</button>
                <button className="btn btn-ghost" style={{flex:1,justifyContent:"center",fontSize:11}}>Reject</button>
              </div>
            )}
          </div>

          {/* Case meta */}
          <div className="card" style={{padding:20}}>
            <div style={{fontSize:12,fontWeight:600,color:"var(--text-1)",marginBottom:12}}>Case Information</div>
            {[
              {l:"Case ID",v:inv.id,mono:true},{l:"Assigned To",v:inv.assignee},
              {l:"Status",v:inv.status},{l:"Priority",v:inv.priority},
              {l:"Entities",v:inv.entities},{l:"Evidence",v:inv.evidence},
              {l:"Last Updated",v:inv.updated},
            ].map(item=>(
              <div key={item.l} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid var(--border)"}}>
                <span style={{fontSize:11,color:"var(--text-4)"}}>{item.l}</span>
                <span style={{fontSize:11,color:"var(--text-2)",fontFamily:item.mono?"JetBrains Mono,monospace":"inherit"}}>{item.v}</span>
              </div>
            ))}
          </div>

          <button className="btn btn-ghost" style={{justifyContent:"center"}} onClick={()=>navigate("timeline")}>
            View Investigation Timeline
          </button>
          <button className="btn btn-ghost" style={{justifyContent:"center"}} onClick={()=>navigate("graph")}>
            View Network Graph
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TIMELINE ─────────────────────────────────────────────────────────────────

function TimelineView({ events = caseTimeline }: { events?: typeof caseTimeline }) {
  return (
    <div style={{maxWidth:680}}>
      {events.map((ev,i)=>(
        <div key={i} style={{display:"flex",gap:16,paddingBottom:i<events.length-1?0:0}}>
          {/* Left connector */}
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",width:36,flexShrink:0}}>
            <div style={{width:34,height:34,borderRadius:"50%",background:`rgba(${ev.color.startsWith("var")?ev.color.includes("critical")?"220,38,38":ev.color.includes("medium")?"217,119,6":ev.color.includes("cyan")?"6,182,212":"99,102,241":"99,102,241"},0.14)`,border:`1.5px solid ${ev.color.startsWith("var")?ev.color:ev.color}40`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:ev.color.startsWith("var")?"var(--accent)":ev.color,boxShadow:`0 0 6px ${ev.color.startsWith("var")?"var(--accent-glow)":ev.color+"60"}`}}/>
            </div>
            {i<events.length-1&&<div style={{width:1,flex:1,background:"var(--border)",minHeight:32,margin:"4px 0"}}/>}
          </div>
          {/* Card */}
          <div className="card" style={{flex:1,padding:"13px 16px",marginBottom:i<events.length-1?10:0}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
              <div>
                <span style={{fontSize:9.5,color:ev.color.startsWith("var")?"var(--accent-hi)":ev.color,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:700}}>{ev.type}</span>
                <div style={{fontSize:13,color:"var(--text-1)",fontWeight:500,marginTop:2}}>{ev.desc}</div>
              </div>
              <div style={{textAlign:"right",flexShrink:0,marginLeft:12}}>
                <div className="mono" style={{fontSize:11.5,color:"var(--text-3)"}}>{ev.date}</div>
                <div className="mono" style={{fontSize:10,color:"var(--text-4)"}}>{ev.time}</div>
              </div>
            </div>
            <div style={{display:"flex",gap:14,fontSize:11,color:"var(--text-4)"}}>
              <span>Source: <span style={{color:"var(--text-3)"}}>{ev.source}</span></span>
              <span>By: <span style={{color:"var(--text-3)"}}>{ev.agent}</span></span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TimelineScreen({ navigate }: { navigate:(s:string,d?:any)=>void }) {
  return (
    <div style={{padding:"26px 28px"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
        <button onClick={()=>navigate("workspace")} style={{background:"none",border:"none",color:"var(--text-3)",cursor:"pointer",fontSize:12,padding:0}}>← Case Workspace</button>
        <span style={{color:"var(--text-4)"}}>/</span>
        <span className="mono-sm" style={{color:"var(--accent-hi)"}}>INV-2026-042</span>
      </div>
      <h1 className="section-head" style={{marginBottom:22}}>Investigation Timeline</h1>
      <TimelineView/>
    </div>
  );
}

// ─── EVIDENCE ─────────────────────────────────────────────────────────────────

function EvidenceScreen() {
  const [evidenceRows, setEvidenceRows] = useState<any[]>(evidenceRecords);
  const [evidenceLoading, setEvidenceLoading] = useState(true);
  const [evidenceError, setEvidenceError] = useState<string|null>(null);
  const [sel, setSel] = useState<any|null>(null);

  useEffect(() => {
    fetch("http://localhost:4000/api/evidence")
      .then(res => { if (!res.ok) throw new Error(`API ${res.status}`); return res.json(); })
      .then(data => {
        const normalised = data.map((ev: any) => ({
          ...ev,
          // Same displayId vs cuid issue as Investigations ("EV-1029" vs a
          // raw cuid).
          id: ev.displayId ?? ev.id,
          type: ev.type ?? "Document",
          source: ev.source?.name ?? ev.source ?? "Unknown",
          ts: ev.createdAt ? new Date(ev.createdAt).toLocaleString() : ev.ts ?? "",
          hash: ev.hash ?? "—",
          // ev.investigationId is the raw FK (a cuid) — use the readable
          // displayId from the now-included investigation relation instead.
          caseRef: ev.investigation?.displayId ?? ev.investigationId ?? ev.caseRef ?? "—",
          by: ev.uploadedBy ?? ev.by ?? "System",
          // EvidenceStatus enum is "VERIFIED"/"PENDING"/"REJECTED"; the badge
          // check below compares against title-case "Verified".
          status: ev.status ? ev.status.charAt(0) + ev.status.slice(1).toLowerCase() : "Pending",
        }));
        setEvidenceRows(normalised);
        setEvidenceError(null);
      })
      .catch(err => setEvidenceError(err.message))
      .finally(() => setEvidenceLoading(false));
  }, []);

  return (
    <div style={{padding:"26px 28px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
        <div>
          <h1 className="section-head">Evidence Repository</h1>
          <p className="page-sub">Verified evidence with integrity tracking and chain-of-custody audit trail.</p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button className="btn btn-ghost btn-sm">Import</button>
          <button className="btn btn-primary btn-sm">+ Add Evidence</button>
        </div>
      </div>

      {evidenceLoading && <p className="page-sub" style={{marginBottom:12}}>Loading evidence…</p>}
      {evidenceError && <p className="page-sub" style={{marginBottom:12,color:"var(--high-light)"}}>Couldn't reach the API ({evidenceError}) — showing demo data.</p>}
      <div style={{display:"grid",gridTemplateColumns:sel?"1fr 380px":"1fr",gap:16,transition:"all 0.25s"}}>
        <div className="card">
          <table className="data-table">
            <thead><tr><th>ID</th><th>Type</th><th>Source</th><th>Timestamp</th><th>SHA-256 (partial)</th><th>Case</th><th>By</th><th>Status</th></tr></thead>
            <tbody>
              {evidenceRows.map(ev=>(
                <tr key={ev.id} className={sel?.id===ev.id?"selected":""} onClick={()=>setSel(ev.id===sel?.id?null:ev)}>
                  <td><span className="mono" style={{color:"var(--accent-hi)",fontSize:12}}>{ev.id}</span></td>
                  <td>{ev.type}</td>
                  <td>{ev.source}</td>
                  <td style={{fontSize:11}}>{ev.ts}</td>
                  <td><span className="mono-sm" style={{color:"var(--text-4)"}}>{ev.hash.slice(0,14)}…</span></td>
                  <td><span className="mono-sm" style={{color:"var(--accent-hi)"}}>{ev.caseRef}</span></td>
                  <td>{ev.by}</td>
                  <td><span className={`badge ${ev.status==="Verified"?"badge-verified":"badge-pending"}`}>{ev.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sel && (
          <div className="card anim-slide-r" style={{padding:20,height:"fit-content"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}>
              <div style={{fontSize:13,fontWeight:600,color:"var(--text-1)"}}>Evidence Details</div>
              <button onClick={()=>setSel(null)} style={{background:"none",border:"none",color:"var(--text-4)",cursor:"pointer",fontSize:20}}>×</button>
            </div>

            <div className="mono" style={{fontSize:11,color:"var(--accent-hi)",marginBottom:12}}>{sel.id}</div>

            <div className="integrity-banner" style={{marginBottom:14}}>
              <span style={{fontSize:15}}>✓</span> Integrity Verified
            </div>

            {[
              {l:"Type",v:sel.type},{l:"Source",v:sel.source},
              {l:"Timestamp",v:sel.ts},{l:"Related Case",v:sel.caseRef,mono:true},
              {l:"Uploaded By",v:sel.by},{l:"Status",v:sel.status},
            ].map(item=>(
              <div key={item.l} style={{display:"flex",flexDirection:"column",gap:3,padding:"8px 0",borderBottom:"1px solid var(--border)"}}>
                <span style={{fontSize:10,color:"var(--text-4)"}}>{item.l}</span>
                <span style={{fontSize:12,color:"var(--text-2)",fontFamily:item.mono?"JetBrains Mono,monospace":"inherit"}}>{item.v}</span>
              </div>
            ))}

            <div style={{padding:"8px 0",borderBottom:"1px solid var(--border)"}}>
              <div style={{fontSize:10,color:"var(--text-4)",marginBottom:4}}>SHA-256 Hash</div>
              <div className="hash-block">{sel.hash}</div>
            </div>

            <div style={{marginTop:14}}>
              <div style={{fontSize:11,color:"var(--text-4)",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:10}}>Chain of Custody</div>
              {[
                {ev:"Evidence collected",by:sel.by,ts:sel.ts.split("·")[0].trim()},
                {ev:"Integrity verified (SHA-256)",by:"System",ts:"Automated"},
                {ev:"Added to case",by:sel.by,ts:sel.ts.split("·")[0].trim()},
              ].map((c,i)=>(
                <div key={i} style={{display:"flex",gap:10,marginBottom:8}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:"var(--accent)",marginTop:4,flexShrink:0}}/>
                  <div>
                    <div style={{fontSize:11.5,color:"var(--text-2)"}}>{c.ev}</div>
                    <div style={{fontSize:10.5,color:"var(--text-4)"}}>{c.by} · {c.ts}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ANALYTICS ────────────────────────────────────────────────────────────────

function AnalyticsScreen() {
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

// ─── REPORTS ──────────────────────────────────────────────────────────────────

function ReportsScreen() {
  const [generated, setGenerated] = useState(false);
  const sections = ["Executive Summary","Risk Assessment","Entity Analysis","Network Analysis","Evidence Summary","Investigation Timeline","AI Explanation","Audit Information"];
  const [checked, setChecked] = useState<Record<string,boolean>>(Object.fromEntries(sections.map(s=>[s,true])));

  return (
    <div style={{padding:"26px 28px"}}>
      <div style={{marginBottom:22}}>
        <h1 className="section-head">Generate Intelligence Report</h1>
        <p className="page-sub">Compile and export a structured, auditable intelligence assessment.</p>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"360px 1fr",gap:24}}>
        {/* Config */}
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div className="card" style={{padding:20}}>
            <div style={{fontSize:13,fontWeight:600,color:"var(--text-1)",marginBottom:14}}>Report Configuration</div>
            {[
              {l:"Investigation",opts:["INV-2026-042","INV-2026-039","INV-2026-031"]},
              {l:"Report Type",opts:["Intelligence Assessment","Executive Summary","Technical Analysis"]},
              {l:"Classification",opts:["RESTRICTED","CONFIDENTIAL","OFFICIAL"]},
            ].map(f=>(
              <div key={f.l} style={{marginBottom:12}}>
                <label style={{display:"block",fontSize:10,color:"var(--text-4)",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:5}}>{f.l}</label>
                <select className="input" style={{padding:"7px 10px",fontSize:12}}>
                  {f.opts.map(o=><option key={o} style={{background:"#0f1420"}}>{o}</option>)}
                </select>
              </div>
            ))}
            <div className="divider" style={{margin:"14px 0"}}/>
            <div style={{fontSize:11.5,fontWeight:600,color:"var(--text-1)",marginBottom:10}}>Include Sections</div>
            {sections.map(s=>(
              <label key={s} style={{display:"flex",alignItems:"center",gap:10,marginBottom:9,cursor:"pointer"}}>
                <div onClick={()=>setChecked(c=>({...c,[s]:!c[s]}))} style={{width:16,height:16,borderRadius:4,background:checked[s]?"var(--accent)":"rgba(255,255,255,0.05)",border:checked[s]?"none":"1px solid var(--border-mid)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer",transition:"all 0.13s"}}>
                  {checked[s]&&<span style={{color:"#fff",fontSize:10,lineHeight:1}}>✓</span>}
                </div>
                <span style={{fontSize:12,color:checked[s]?"var(--text-2)":"var(--text-4)",transition:"color 0.13s"}}>{s}</span>
              </label>
            ))}
            <button className="btn btn-primary btn-lg" style={{width:"100%",justifyContent:"center",marginTop:16}} onClick={()=>setGenerated(true)}>
              Generate Secure Report
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="card" style={{padding:32}}>
          <div style={{textAlign:"center",marginBottom:28,paddingBottom:22,borderBottom:"2px solid rgba(99,102,241,0.3)"}}>
            <div style={{fontSize:9.5,color:"var(--text-4)",letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:8}}>NEXUS INTELLIGENCE PLATFORM</div>
            <div className="display" style={{fontSize:22,fontWeight:800,color:"var(--text-1)",letterSpacing:"-0.02em",marginBottom:6}}>INTELLIGENCE ASSESSMENT REPORT</div>
            <div style={{display:"flex",justifyContent:"center",gap:22,fontSize:11,color:"var(--text-3)"}}>
              <span>Case: <span className="mono" style={{color:"var(--accent-hi)"}}>INV-2026-042</span></span>
              <span>Risk: <span style={{color:"var(--critical-light)",fontWeight:600}}>CRITICAL</span></span>
              <span>Generated: <span style={{color:"var(--text-2)"}}>Aug 16, 2026</span></span>
            </div>
          </div>

          {generated ? (
            <div>
              {[
                {t:"Executive Summary",c:"Investigation INV-2026-042 concerns an emerging network (N-042) detected through cross-source intelligence correlation. The network's risk score increased from 32 to 91 over a 20-day period, triggering an early-warning alert on 16 August 2026. Primary entity Alias_X has been resolved across 4 intelligence sources with 93% confidence."},
                {t:"Risk Assessment",c:"Overall network risk: CRITICAL (91/100). Entity risk: HIGH (84/100). Contributing factors include behavioural anomalies (+24), entity connectivity (+21), repeated identifiers (+18), wallet associations (+15), and suspicious activity concentration (+13). Risk escalated 59 points over the monitored window."},
                {t:"Entity Analysis",c:"5 entities identified and partially resolved. Primary entity Alias_X cross-referenced with Username_X23, Wallet_W1, and Email_ID_04 at 93% confidence. Associated with 4 marketplaces, 3 wallets, 7 listings, 2 communication identifiers across 4 independent sources."},
                {t:"Evidence Summary",c:`${evidenceRecords.length} evidence records collected and integrity-verified. All primary records passed SHA-256 hash verification. Chain of custody maintained for all items. 1 record pending verification (EV-1025).`},
              ].map(s=>(
                <div key={s.t} style={{marginBottom:20}}>
                  <div style={{fontSize:10.5,fontWeight:700,color:"var(--accent-hi)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:7}}>{s.t}</div>
                  <div style={{fontSize:12.5,color:"var(--text-2)",lineHeight:1.72}}>{s.c}</div>
                </div>
              ))}
              <div className="ai-strip" style={{marginTop:24}}>
                <span style={{color:"var(--medium-light)",fontSize:14,flexShrink:0}}>⚠</span>
                <div>
                  <div style={{fontSize:10,color:"var(--medium-light)",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em"}}>AI-Assisted Analysis Notice</div>
                  <div style={{fontSize:11,color:"var(--text-3)",marginTop:3}}>Portions of this report were generated with AI assistance. All conclusions and determinations are the responsibility of the assigned investigator. No AI assessment constitutes a criminal determination.</div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{textAlign:"center",padding:"60px 0",color:"var(--text-4)"}}>
              <div style={{fontSize:36,marginBottom:14,opacity:0.3}}>◫</div>
              <div style={{fontSize:14}}>Configure and generate a report to see preview</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── AUDIT LOG ────────────────────────────────────────────────────────────────

function AuditScreen() {
  const typeColors: Record<string,string> = {read:"var(--accent)",write:"var(--low-light)",export:"var(--cyan)",admin:"var(--medium-light)",system:"var(--text-3)",search:"var(--purple)"};
  const [auditRows, setAuditRows] = useState<any[]>(auditLog);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditError, setAuditError] = useState<string|null>(null);

  useEffect(() => {
    fetch("http://localhost:4000/api/audit-log")
      .then(res => { if (!res.ok) throw new Error(`API ${res.status}`); return res.json(); })
      .then(data => {
        const normalised = data.map((entry: any) => ({
          ...entry,
          ts: entry.ts ?? (entry.createdAt ? new Date(entry.createdAt).toLocaleString() : "—"),
          user: entry.user ?? entry.userId ?? "System",
          type: (entry.type ?? entry.actionType ?? "system").toLowerCase(),
          action: entry.action ?? entry.description ?? "—",
          resource: entry.resource ?? entry.resourceId ?? "—",
          ip: entry.ip ?? entry.ipAddress ?? "—",
          status: entry.status ?? "OK",
        }));
        setAuditRows(normalised);
        setAuditError(null);
      })
      .catch(err => setAuditError(err.message))
      .finally(() => setAuditLoading(false));
  }, []);

  return (
    <div style={{padding:"26px 28px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
        <div>
          <h1 className="section-head">Audit Logs</h1>
          <p className="page-sub">Complete activity audit trail for compliance, accountability, and security review.</p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <input className="input" style={{width:220,padding:"7px 12px",fontSize:12}} placeholder="Filter by user or action…"/>
          <button className="btn btn-ghost btn-sm">Export CSV</button>
        </div>
      </div>

      {/* Filter chips */}
      <div style={{display:"flex",gap:7,marginBottom:16}}>
        {["All","Read","Write","Export","Admin","System"].map(f=>(
          <div key={f} className={`chip ${f==="All"?"active":""}`}>{f}</div>
        ))}
      </div>

      {auditLoading && <p className="page-sub" style={{marginBottom:12}}>Loading audit log…</p>}
      {auditError && <p className="page-sub" style={{marginBottom:12,color:"var(--high-light)"}}>Couldn't reach the API ({auditError}) — showing demo data.</p>}
      <div className="card">
        <table className="data-table">
          <thead>
            <tr><th>Timestamp</th><th>User</th><th>Action Type</th><th>Action</th><th>Resource</th><th>IP / Session</th><th>Status</th></tr>
          </thead>
          <tbody>
            {auditRows.map((log,i)=>(
              <tr key={i}>
                <td><span className="mono" style={{fontSize:11.5,color:"var(--text-3)"}}>{log.ts}</span></td>
                <td><span style={{color:"var(--text-1)",fontWeight:500}}>{log.user}</span></td>
                <td>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <div style={{width:6,height:6,borderRadius:"50%",background:typeColors[log.type]||"var(--text-4)",flexShrink:0}}/>
                    <span style={{fontSize:11,color:typeColors[log.type]||"var(--text-3)",textTransform:"capitalize"}}>{log.type}</span>
                  </div>
                </td>
                <td><span style={{color:"var(--text-1)"}}>{log.action}</span></td>
                <td><span className="mono" style={{fontSize:11.5,color:"var(--accent-hi)"}}>{log.resource}</span></td>
                <td><span className="mono" style={{fontSize:11,color:"var(--text-4)"}}>{log.ip}</span></td>
                <td><span className="badge badge-verified">{log.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── ADMIN ────────────────────────────────────────────────────────────────────

function AdminScreen() {
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

// ─── ROOT APP ─────────────────────────────────────────────────────────────────

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [screen, setScreen] = useState("overview");
  const [entityData, setEntityData] = useState(entities[0]);
  // The investigation displayId ("INV-2026-042") that WorkspaceScreen should
  // load from the real API. Set whenever navigate("workspace", data) is
  // called with either a plain displayId string or an investigation-like
  // object carrying one. Falls back to null (WorkspaceScreen loads the
  // most recent investigation) when navigated to without one.
  const [workspaceDisplayId, setWorkspaceDisplayId] = useState<string | null>(null);

  const navigate = useCallback((s: string, data?: any) => {
    if (s === "entity" && data) setEntityData(data);
    if (s === "workspace" && data) {
      const displayId = typeof data === "string" ? data : data.displayId ?? data.id;
      if (displayId) setWorkspaceDisplayId(displayId);
    }
    setScreen(s);
    // Scroll main to top
    setTimeout(() => {
      document.querySelector(".main")?.scrollTo(0, 0);
    }, 0);
  }, []);

  if (!loggedIn) return <LoginScreen onLogin={() => setLoggedIn(true)}/>;

  const renderScreen = () => {
    switch (screen) {
      case "overview":      return <OverviewScreen navigate={navigate}/>;
      case "search":        return <SearchScreen navigate={navigate}/>;
      case "alerts":        return <AlertsScreen navigate={navigate}/>;
      case "entities":      return <EntitiesScreen navigate={navigate}/>;
      case "entity":        return <EntityScreen entity={entityData} navigate={navigate}/>;
      case "graph":         return <GraphScreen navigate={navigate}/>;
      case "network-risk":  return <NetworkRiskScreen navigate={navigate}/>;
      case "listings":      return <ListingsScreen/>;
      case "blockchain":    return <BlockchainScreen/>;
      case "investigations":return <InvestigationsScreen navigate={navigate}/>;
      case "workspace":     return <WorkspaceScreen navigate={navigate} displayId={workspaceDisplayId}/>;
      case "timeline":      return <TimelineScreen navigate={navigate}/>;
      case "evidence":      return <EvidenceScreen/>;
      case "analytics":     return <AnalyticsScreen/>;
      case "reports":       return <ReportsScreen/>;
      case "audit":         return <AuditScreen/>;
      case "admin":         return <AdminScreen/>;
      default:              return <OverviewScreen navigate={navigate}/>;
    }
  };

  const graphFull = screen === "graph";

  return (
    <div className="app-shell">
      <Topbar/>
      <Sidebar current={screen} navigate={navigate}/>
      <main className={`main ${graphFull ? "scroll-reveal" : "scroll-reveal"}`} style={graphFull ? {overflow:"hidden"} : {}}>
        {renderScreen()}
      </main>
    </div>
  );
}