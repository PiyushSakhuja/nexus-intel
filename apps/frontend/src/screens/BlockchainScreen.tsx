import { useState, useEffect } from "react";
import { riskColorLight } from "../data";
import { RingScore, RiskBadge, PulseIndicator } from "../components/shared";
import { apiGet } from "../lib/api";

export function BlockchainScreen() {
  const [walletRows, setWalletRows] = useState<any[]>([]);
  const [walletsLoading, setWalletsLoading] = useState(true);
  const [walletsError, setWalletsError] = useState<string|null>(null);
  const [sel, setSel] = useState<any>(null);

  useEffect(() => {
    apiGet<any[]>("/api/wallets")
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
        <p className="page-sub">Wallet analytics and transaction pattern analysis.</p>
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