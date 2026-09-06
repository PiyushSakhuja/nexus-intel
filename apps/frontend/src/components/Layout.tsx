import { useState, useEffect } from "react";
import { PulseIndicator } from "./shared";

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
        <div style={{margin:"8px 4px 0",padding:"9px 12px",background:"rgba(99,102,241,0.08)",borderRadius:8,border:"1px solid rgba(99,102,241,0.14)"}}>
          <div style={{fontSize:12,fontWeight:600,color:"var(--text-1)"}}>Investigator A</div>
          <div style={{fontSize:10,color:"var(--accent-hi)",marginTop:1}}>Senior Investigator</div>
        </div>
      </div>
    </div>
  );
}

export function Topbar() {
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
