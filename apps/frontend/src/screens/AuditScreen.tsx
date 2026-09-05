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

export function AuditScreen() {
  const typeColors: Record<string,string> = {read:"var(--accent)",write:"var(--low-light)",export:"var(--cyan)",admin:"var(--medium-light)",system:"var(--text-3)",search:"var(--purple)"};
  const [auditRows, setAuditRows] = useState<any[]>(auditLog);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditError, setAuditError] = useState<string|null>(null);
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchText, setSearchText] = useState("");

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

  const filterChips = ["All","Read","Write","Export","Admin","System"];

  // Chip filters by log.type (e.g. "Read" chip -> type === "read"); "All"
  // shows everything. Search box filters on top of that by user or action
  // text, case-insensitive.
  const filteredRows = auditRows.filter(log => {
    const matchesChip = activeFilter === "All" || log.type === activeFilter.toLowerCase();
    const q = searchText.trim().toLowerCase();
    const matchesSearch = !q ||
      (log.user ?? "").toLowerCase().includes(q) ||
      (log.action ?? "").toLowerCase().includes(q) ||
      (log.resource ?? "").toLowerCase().includes(q);
    return matchesChip && matchesSearch;
  });

  return (
    <div style={{padding:"26px 28px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
        <div>
          <h1 className="section-head">Audit Logs</h1>
          <p className="page-sub">Complete activity audit trail for compliance, accountability, and security review.</p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <input
            className="input"
            style={{width:220,padding:"7px 12px",fontSize:12}}
            placeholder="Filter by user or action…"
            value={searchText}
            onChange={e=>setSearchText(e.target.value)}
          />
          <button className="btn btn-ghost btn-sm">Export CSV</button>
        </div>
      </div>

      {/* Filter chips */}
      <div style={{display:"flex",gap:7,marginBottom:16}}>
        {filterChips.map(f=>(
          <div
            key={f}
            className={`chip ${activeFilter===f?"active":""}`}
            style={{cursor:"pointer"}}
            onClick={()=>setActiveFilter(f)}
          >
            {f}
            <span style={{marginLeft:5,fontSize:10,opacity:0.65}}>
              ({f==="All" ? auditRows.length : auditRows.filter(r=>r.type===f.toLowerCase()).length})
            </span>
          </div>
        ))}
      </div>

      {auditLoading && <p className="page-sub" style={{marginBottom:12}}>Loading audit log…</p>}
      {auditError && <p className="page-sub" style={{marginBottom:12,color:"var(--high-light)"}}>Couldn't reach the API ({auditError}) — showing demo data.</p>}
      {!auditLoading && filteredRows.length === 0 && (
        <p className="page-sub" style={{marginBottom:12}}>No audit entries match this filter.</p>
      )}
      <div className="card">
        <table className="data-table">
          <thead>
            <tr><th>Timestamp</th><th>User</th><th>Action Type</th><th>Action</th><th>Resource</th><th>IP / Session</th><th>Status</th></tr>
          </thead>
          <tbody>
            {filteredRows.map((log,i)=>(
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
