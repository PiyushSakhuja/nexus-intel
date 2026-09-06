import { useState, useEffect } from "react";
import { PulseIndicator } from "../components/shared";
import { apiGet } from "../lib/api";

export function InvestigationsScreen({ navigate }: { navigate:(s:string,d?:any)=>void }) {
  const statusColor: Record<string,string> = {
    "UNDER INVESTIGATION":"var(--medium-light)",
    "UNDER REVIEW":"var(--accent-hi)",
    "MONITORING":"#22d3ee",
    "CLOSED":"var(--text-4)",
  };
  const [invRows, setInvRows] = useState<any[]>([]);
  const [invLoading, setInvLoading] = useState(true);
  const [invError, setInvError] = useState<string|null>(null);

  useEffect(() => {
    apiGet<any[]>("/api/investigations")
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
      {invError && <p className="page-sub" style={{marginBottom:12,color:"var(--high-light)"}}>Couldn't reach the API ({invError}).</p>}
      {!invLoading && !invError && invRows.length === 0 && <p className="page-sub" style={{marginBottom:12}}>No investigations yet.</p>}
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
