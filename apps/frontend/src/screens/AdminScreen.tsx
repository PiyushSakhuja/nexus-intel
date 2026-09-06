import { useState, useEffect } from "react";
import { riskBg } from "../data";
import { PulseIndicator } from "../components/shared";
import { apiGet } from "../lib/api";

export function AdminScreen() {
  const roles = ["Administrator","Investigator","Analyst"];
  const perms = ["Search Intelligence","View Evidence","Manage Cases","Generate Reports","Manage Users","View Audit Logs"];
  const matrix: Record<string,boolean[]> = {
    Administrator:[true,true,true,true,true,true],
    Investigator:[true,true,true,true,false,false],
    Analyst:[true,true,false,true,false,false],
  };

  // NOTE: there is no authentication/session system in this app yet (see
  // backend route comments) — the User model exists in the schema but no
  // route reads/writes it, and no route tracks online/idle/offline status.
  // Rather than invent activity data that doesn't exist, the roster below
  // is shown as a static illustration of the intended role structure, not
  // live presence data. It's not pulled from data.ts and not claimed as
  // real-time — see MOCK_DATA_AUDIT.md.
  const users = [
    {name:"Administrator",role:"Admin"},
    {name:"Investigator A",role:"Investigator"},
    {name:"Investigator B",role:"Investigator"},
    {name:"Investigator C",role:"Investigator"},
    {name:"Analyst D",role:"Analyst"},
  ];

  const [sources, setSources] = useState<any[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [sourcesError, setSourcesError] = useState<string|null>(null);

  useEffect(() => {
    apiGet<any[]>("/api/sources")
      .then(data => { setSources(data); setSourcesError(null); })
      .catch(err => setSourcesError(err.message))
      .finally(() => setSourcesLoading(false));
  }, []);

  return (
    <div style={{padding:"26px 28px"}}>
      <div style={{marginBottom:22}}>
        <h1 className="section-head">Administration</h1>
        <p className="page-sub">User management, access control, permissions, and system status.</p>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        {/* Users — illustrative role roster; no live auth/session backend exists yet */}
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
                <div style={{fontSize:10.5,color:"var(--text-4)"}}>{u.role}</div>
              </div>
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

        {/* Data sources — real Source rows, with a real listing count per
            source (there is no "last sync" timestamp in the schema, so
            that field is intentionally omitted rather than fabricated). */}
        <div className="card" style={{padding:20}}>
          <div style={{fontSize:13,fontWeight:600,color:"var(--text-1)",marginBottom:14}}>Data Sources</div>
          {sourcesLoading && <p className="page-sub" style={{fontSize:12}}>Loading sources…</p>}
          {sourcesError && <p className="page-sub" style={{fontSize:12,color:"var(--high-light)"}}>Couldn't reach the API ({sourcesError}).</p>}
          {!sourcesLoading && !sourcesError && sources.length === 0 && <p className="page-sub" style={{fontSize:12}}>No sources configured yet.</p>}
          {sources.map((src)=>(
            <div key={src.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:"1px solid var(--border)"}}>
              <div style={{fontSize:12,color:"var(--text-2)"}}>{src.name}</div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:10.5,color:"var(--text-4)"}}>{src._count?.listings ?? 0} listings</span>
                <PulseIndicator color="var(--low)"/>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
