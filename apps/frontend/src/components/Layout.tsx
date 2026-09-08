import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { PulseIndicator } from "./shared";

// Bare (no-id) URL for each sidebar nav key — kept in sync with App.tsx's
// buildPath() for these same screen keys. Sidebar items never carry an id,
// so this is just the subset of buildPath that applies to them.
const NAV_PATH: Record<string, string> = {
  overview: "/overview",
  search: "/search",
  alerts: "/alerts",
  entities: "/entities",
  graph: "/graph",
  listings: "/listings",
  blockchain: "/blockchain",
  investigations: "/investigations",
  evidence: "/evidence",
  analytics: "/analytics",
  reports: "/reports",
  audit: "/audit",
  admin: "/admin",
  scraper: "/scraper",
};

export const NAV = [
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
  {key:"scraper",    icon:"🕷", label:"Web Scraper"},
];

export function Sidebar({ current, navigate }: { current: string; navigate: (s: string) => void }) {
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
          <Link key={n.key} to={NAV_PATH[n.key] ?? "/overview"} className={`nav-item ${active(n.key)?"active":""}`} style={{textDecoration:"none"}}>
            <span style={{fontSize:13,flexShrink:0,opacity:active(n.key)?1:0.7}}>{n.icon}</span>
            <span className="label" style={{fontSize:12.5}}>{n.label}</span>
          </Link>
        ))}
      </div>

      {/* Bottom */}
      <div style={{borderTop:"1px solid var(--border)",padding:"10px 8px"}}>
        <Link to="/admin" className={`nav-item ${current==="admin"?"active":""}`} style={{textDecoration:"none"}}>
          <span style={{fontSize:13}}>⊞</span><span className="label">Admin</span>
        </Link>
        <div style={{margin:"8px 4px 0",padding:"9px 12px",background:"rgba(99,102,241,0.08)",borderRadius:8,border:"1px solid rgba(99,102,241,0.14)"}}>
          <div style={{fontSize:12,fontWeight:600,color:"var(--text-1)"}}>Investigator A</div>
          <div style={{fontSize:10,color:"var(--accent-hi)",marginTop:1}}>Senior Investigator</div>
        </div>
      </div>
    </div>
  );
}

export function Topbar({
  navigate,
  feedEvents = [],
}: {
  navigate: (s: string, d?: any) => void;
  feedEvents?: any[];
}) {
  const [time, setTime] = useState(new Date());
  const [showNotifications, setShowNotifications] = useState(false);
  useEffect(()=>{ const t = setInterval(()=>setTime(new Date()),1000); return ()=>clearInterval(t); },[]);

  return (
    <div className="topbar" style={{gridColumn:"1/-1"}}>
      {/* Logo zone */}
      <div style={{width:216,flexShrink:0,paddingLeft:20,borderRight:"1px solid var(--border)",height:"100%",display:"flex",alignItems:"center"}}>
        <div className="display grad-text" style={{fontSize:15,fontWeight:800,letterSpacing:"-0.02em"}}>NEXUS INTEL</div>
      </div>

      <div style={{flex:1}}/>

      {/* Clock */}
      <div className="mono" style={{fontSize:11.5,color:"var(--text-3)"}}>
        {time.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})} · {time.toLocaleTimeString()}
      </div>

{/* Bell */}
{/* Notifications */}
<div style={{ position:"relative" }}>
  <button
    onClick={() => navigate("alerts")}
    aria-label="Notifications"
    style={{
      position:"relative",
      cursor:"pointer",
      padding:"4px 6px",
      background:"transparent",
      border:"none",
      color:"var(--text-3)",
      fontSize:17,
      lineHeight:1,
    }}
  >
    🔔

    {feedEvents.length > 0 && (
      <span
        style={{
          position:"absolute",
          top:2,
          right:2,
          width:8,
          height:8,
          borderRadius:"50%",
          background:"var(--critical)",
          boxShadow:"0 0 6px var(--critical-glow)",
        }}
      />
    )}
  </button>

  {showNotifications && (
    <div
      style={{
        position:"absolute",
        top:34,
        right:0,
        width:340,
        background:"var(--surface)",
        border:"1px solid var(--border)",
        borderRadius:10,
        boxShadow:"0 14px 40px rgba(0,0,0,0.35)",
        zIndex:1000,
        overflow:"hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display:"flex",
          justifyContent:"space-between",
          alignItems:"center",
          padding:"13px 15px",
          borderBottom:"1px solid var(--border)",
        }}
      >
        <div>
          <div
            style={{
              fontSize:12.5,
              fontWeight:700,
              color:"var(--text-1)",
            }}
          >
            Notifications
          </div>

          <div
            style={{
              fontSize:10,
              color:"var(--text-4)",
              marginTop:2,
            }}
          >
            {feedEvents.length} recent event{feedEvents.length === 1 ? "" : "s"}
          </div>
        </div>

        <button
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setShowNotifications(false);
            navigate("alerts");
          }}
          style={{ fontSize:10 }}
        >
          View all
        </button>
      </div>

      {/* Notifications */}
      <div style={{ maxHeight:360, overflowY:"auto" }}>
        {feedEvents.length === 0 ? (
          <div
            style={{
              padding:"35px 20px",
              textAlign:"center",
              color:"var(--text-4)",
            }}
          >
            <div style={{ fontSize:22, marginBottom:8 }}>🔔</div>
            <div style={{ fontSize:11.5 }}>
              No new notifications
            </div>
          </div>
        ) : (
          feedEvents.slice(0, 8).map((evt, i) => (
            <button
              key={evt.id}
              onClick={() => {
                setShowNotifications(false);
                navigate("alerts");
              }}
              style={{
                width:"100%",
                display:"flex",
                gap:10,
                alignItems:"flex-start",
                padding:"11px 14px",
                background:i === 0
                  ? `${evt.meta.color}08`
                  : "transparent",
                border:"none",
                borderBottom:"1px solid var(--border)",
                cursor:"pointer",
                textAlign:"left",
              }}
            >
              {/* Event icon */}
              <div
                style={{
                  width:27,
                  height:27,
                  borderRadius:7,
                  flexShrink:0,
                  background:`${evt.meta.color}18`,
                  border:`1px solid ${evt.meta.color}35`,
                  display:"flex",
                  alignItems:"center",
                  justifyContent:"center",
                  fontSize:12,
                  color:evt.meta.color,
                }}
              >
                {evt.meta.icon}
              </div>

              {/* Event content */}
              <div style={{ flex:1, minWidth:0 }}>
                <div
                  style={{
                    fontSize:10,
                    fontWeight:700,
                    color:evt.meta.color,
                    textTransform:"uppercase",
                    letterSpacing:"0.06em",
                    marginBottom:3,
                  }}
                >
                  {evt.meta.label}
                </div>

                <div
                  style={{
                    fontSize:11,
                    color:"var(--text-2)",
                    lineHeight:1.4,
                    overflow:"hidden",
                    textOverflow:"ellipsis",
                    whiteSpace:"nowrap",
                  }}
                >
                  {evt.detail || "New intelligence event detected."}
                </div>

                <div
                  className="mono"
                  style={{
                    fontSize:9.5,
                    color:"var(--text-4)",
                    marginTop:4,
                  }}
                >
                  {evt.time}
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Footer */}
      {feedEvents.length > 8 && (
        <button
          onClick={() => {
            setShowNotifications(false);
            navigate("alerts");
          }}
          style={{
            width:"100%",
            padding:"10px",
            border:"none",
            background:"transparent",
            color:"var(--accent-hi)",
            fontSize:10.5,
            fontWeight:600,
            cursor:"pointer",
          }}
        >
          View all {feedEvents.length} events →
        </button>
      )}
    </div>
  )}
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