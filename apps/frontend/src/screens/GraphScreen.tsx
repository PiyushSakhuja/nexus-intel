import { useState, useEffect, useRef, useCallback } from "react";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  riskColor, riskColorLight, riskLabel, riskBg, riskBorder,
  activityTimeline, riskDistribution, networkRiskEvolution,
  alertsByDay, entityTypeDist, sourceContrib, walletClusterData,
  kpis, alerts, emergingNetworks, listings, wallets,
  investigations, evidenceRecords, graphNodes, graphEdges,
  auditLog, flagContributions, networkSignals, caseTimeline,
  type Entity, type Alert, type Investigation, type EvidenceRecord,
} from "../data";
import {
  RingScore, RiskBadge,
} from "../components/shared";

const DEFAULT_VIEWBOX = { x: 0, y: 0, w: 900, h: 620 };
const MIN_VIEWBOX_SIZE = 220; // most zoomed-in
const MAX_VIEWBOX_SIZE = 1800; // most zoomed-out
const ZOOM_FACTOR = 1.25;

const typeColors: Record<string, string> = { entity: "#6366f1", market: "#8b5cf6", listing: "#d97706", wallet: "#06b6d4", comm: "#16a34a", txn: "#ea580c" };
const typeIcons: Record<string, string> = { entity: "◈", market: "▤", listing: "▣", wallet: "◇", comm: "◉", txn: "◫" };
const ALL_TYPES = Object.keys(typeColors);
const toolbarIconStyle: React.CSSProperties = {
  background: "none", border: "none", color: "var(--text-3)", cursor: "pointer",
  padding: "5px 8px", borderRadius: 5, fontSize: 16, transition: "color 0.12s",
};


interface GraphScreenProps {
  navigate: (s: string, d?: any) => void;
  // When set, the graph is scoped to a single investigation
  // (GET /api/investigations/:displayId/graph) instead of the global graph
  // (GET /api/graph). See Phase 5/Phase 10 of the Person 2 brief — the
  // global graph's endpoint and fallback behavior are UNCHANGED.
  investigationId?: string | null;
}

export function GraphScreen({ navigate, investigationId }: GraphScreenProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedEdgeKey, setSelectedEdgeKey] = useState<string | null>(null);
  const [riskOverlay, setRiskOverlay] = useState(true);
const [focusMode, setFocusMode] = useState(true);
const [mode, setMode] = useState<"entity" | "network">("entity");
const [liveNodes, setLiveNodes] = useState<any[]>(
  investigationId ? [] : graphNodes
);
const [liveEdges, setLiveEdges] = useState<any[]>(
  investigationId ? [] : graphEdges
);
const [visibleTypes, setVisibleTypes] = useState<Set<string>>(
  new Set(ALL_TYPES)
);

// Investigation-scoped fetch state...
const [loading, setLoading] = useState(!!investigationId);
const [error, setError] = useState<string | null>(null);
const [meta, setMeta] = useState<any | null>(null);

  useEffect(() => {
    setSelected(investigationId ? null : "wallet-w1");
    setSelectedEdgeKey(null);
    setError(null);
    setMeta(null);

    if (investigationId) {
      setLoading(true);
      fetch(`http://localhost:4000/api/investigations/${investigationId}/graph`)
        .then(res => { if (!res.ok) throw new Error(`API ${res.status}`); return res.json(); })
        .then((data) => {
          setMeta(data);
          setLiveNodes((data.nodes ?? []).map(normalizeNode));
          setLiveEdges((data.edges ?? []).map(normalizeEdge));
        })
        .catch((err) => {
          // Explicit failure state — never silently show the global/mock
          // graph in place of a requested investigation graph.
          setError(err.message ?? "Unable to load investigation graph.");
          setLiveNodes([]);
          setLiveEdges([]);
        })
        .finally(() => setLoading(false));
      return;
    }

    // Global graph — unchanged behavior from before this change: on
    // failure, silently keep whatever's already in state (mock data on
    // first load), so the existing screen never regresses.
    setLoading(false);
    fetch("http://localhost:4000/api/graph")
      .then(res => { if (!res.ok) throw new Error(`API ${res.status}`); return res.json(); })
      .then(({ nodes, edges }) => {
        if (nodes?.length) setLiveNodes(nodes.map(normalizeNode));
        if (edges?.length) setLiveEdges(edges.map(normalizeEdge));
      })
      .catch(() => { /* keep existing/mock data on failure — unchanged */ });
  }, [investigationId]);

  // ─── Zoom / pan (Phase 6) ────────────────────────────────────────────────
  const [viewBox, setViewBox] = useState(DEFAULT_VIEWBOX);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragState = useRef<{ startX: number; startY: number; startViewBox: typeof DEFAULT_VIEWBOX } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const zoomBy = useCallback((factor: number) => {
    setViewBox((vb) => {
      const newW = Math.min(MAX_VIEWBOX_SIZE, Math.max(MIN_VIEWBOX_SIZE, vb.w * factor));
      const newH = Math.min(MAX_VIEWBOX_SIZE, Math.max(MIN_VIEWBOX_SIZE, vb.h * factor));
      const cx = vb.x + vb.w / 2;
      const cy = vb.y + vb.h / 2;
      return { x: cx - newW / 2, y: cy - newH / 2, w: newW, h: newH };
    });
  }, []);
  const resetView = useCallback(() => setViewBox(DEFAULT_VIEWBOX), []);

  const onSvgMouseDown = (e: React.MouseEvent) => {
    if (e.target !== svgRef.current && (e.target as HTMLElement).tagName !== "rect") return; // only drag on empty background
    dragState.current = { startX: e.clientX, startY: e.clientY, startViewBox: viewBox };
    setIsDragging(true);
  };
  const onSvgMouseMove = (e: React.MouseEvent) => {
    if (!dragState.current || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = dragState.current.startViewBox.w / rect.width;
    const scaleY = dragState.current.startViewBox.h / rect.height;
    const dx = (e.clientX - dragState.current.startX) * scaleX;
    const dy = (e.clientY - dragState.current.startY) * scaleY;
    setViewBox({ ...dragState.current.startViewBox, x: dragState.current.startViewBox.x - dx, y: dragState.current.startViewBox.y - dy });
  };
  const endDrag = () => { dragState.current = null; setIsDragging(false); };

  const toggleType = (type: string) => {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  };

  const filteredNodes = liveNodes.filter((n) => visibleTypes.has(n.type));
  const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
  const filteredEdges = liveEdges.filter((e) => filteredNodeIds.has(e.from) && filteredNodeIds.has(e.to));

const selNode = filteredNodes.find(n => n.id === selected);

const connectedEdges = filteredEdges.filter(
  e => e.from === selected || e.to === selected
);

const connectedIds = new Set(
  connectedEdges.flatMap(e => [e.from, e.to])
);

const selEdge = selectedEdgeKey
  ? filteredEdges.find(
      (e, i) => edgeKey(e, i) === selectedEdgeKey
    )
  : null;

// Focus mode: when a node is selected, render only that node and its
// direct neighborhood instead of the full graph.
const isFocused = focusMode && !!selected;

const renderedNodes = isFocused
  ? filteredNodes.filter(
      n => n.id === selected || connectedIds.has(n.id)
    )
  : filteredNodes;

const renderedEdges = isFocused
  ? connectedEdges
  : filteredEdges;

  const getPos = (id: string) => liveNodes.find(n => n.id === id) || { x: 0, y: 0 };

  const investigationScoped = !!investigationId;

  return (
    <div style={{ display: "flex", height: "calc(100vh - 52px)", overflow: "hidden" }}>
      {/* Graph SVG area */}
      <div className="graph-root" style={{ background: "radial-gradient(ellipse at 40% 45%, rgba(99,102,241,0.04) 0%, transparent 65%)" }}>
        {/* Investigation-scope banner (Phase 5) */}
        {investigationScoped && (
          <div style={{ position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)", zIndex: 10 }}>
            <div className="glass" style={{ borderRadius: 9, padding: "6px 14px", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--accent-hi)" }}>
                Investigation Graph — {investigationId}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate("graph")}>View Full Graph</button>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div style={{ position: "absolute", top: 14, left: 14, zIndex: 10, display: "flex", gap: 8 }}>
          <div className="glass" style={{ borderRadius: 9, padding: "5px 8px", display: "flex", gap: 4 }}>
            <button title="Zoom in" onClick={() => zoomBy(1 / ZOOM_FACTOR)} style={toolbarIconStyle}>⊕</button>
            <button title="Zoom out" onClick={() => zoomBy(ZOOM_FACTOR)} style={toolbarIconStyle}>⊖</button>
            <button title="Reset view" onClick={resetView} style={toolbarIconStyle}>⊡</button>
          </div>
          <div className="glass" style={{ borderRadius: 9, padding: "5px 12px", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>Risk Overlay</span>
            <div className={`toggle-track ${riskOverlay ? "on" : "off"}`} onClick={() => setRiskOverlay(!riskOverlay)} style={{ cursor: "pointer" }}>
              <div className="toggle-thumb" />
            </div>
          </div>
          <div className="glass" style={{borderRadius:9,padding:"5px 12px",display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:11,color:"var(--text-3)"}} title="When on, selecting a node shows only that node and its direct connections instead of the entire graph">Focus Mode</span>
            <div className={`toggle-track ${focusMode?"on":"off"}`} onClick={()=>setFocusMode(!focusMode)} style={{cursor:"pointer"}}>
              <div className="toggle-thumb"/>
            </div>
          </div>
          <div className="glass" style={{ borderRadius: 9, padding: "4px", display: "flex" }}>
            {(["entity", "network"] as const).map(m => (
              <button key={m} onClick={() => setMode(m)} style={{ background: mode === m ? "rgba(99,102,241,0.2)" : "none", border: "none", color: mode === m ? "var(--accent-hi)" : "var(--text-3)", cursor: "pointer", padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 500, fontFamily: "Inter,sans-serif", transition: "all 0.13s" }}>
                {m === "entity" ? "Entity Risk" : "Network Risk"}
              </button>
            ))}
          </div>
        </div>

        {/* Type filter (Phase 6) */}
        <div style={{ position: "absolute", top: 62, left: 14, zIndex: 10 }}>
          <div className="glass" style={{ borderRadius: 9, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ fontSize: 9, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>Filter by type</div>
            {ALL_TYPES.map((type) => (
              <label key={type} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: "var(--text-3)", cursor: "pointer" }}>
                <input type="checkbox" checked={visibleTypes.has(type)} onChange={() => toggleType(type)} style={{ accentColor: typeColors[type], cursor: "pointer" }} />
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: typeColors[type], flexShrink: 0 }} />
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </label>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div style={{ position: "absolute", bottom: 14, left: 14, zIndex: 10 }}>
          <div className="glass" style={{ borderRadius: 9, padding: "10px 14px" }}>
            <div style={{ fontSize: 9.5, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Node Types</div>
            {Object.entries(typeColors).map(([type, color]) => (
              <div key={type} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>
                <div style={{ width: 9, height: 9, borderRadius: "50%", background: color, boxShadow: `0 0 5px ${color}70`, flexShrink: 0 }} />
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </div>
            ))}
          </div>
        </div>

        {/* Loading state (investigation graph only) */}
        {investigationScoped && loading && (
          <CenteredMessage title="Loading investigation graph…" />
        )}

        {/* Error state — never falls back to mock/global data (Phase 9) */}
        {investigationScoped && !loading && error && (
          <CenteredMessage title="Unable to load investigation graph." detail={error} />
        )}

        {/* Empty/not-calculable state — real backend explanation, not a fabricated graph */}
        {investigationScoped && !loading && !error && meta && meta.calculable === false && (
          <CenteredMessage title="No investigation-specific graph available yet." detail={meta.explanation} />
        )}

        {(!investigationScoped || (!loading && !error && (!meta || meta.calculable !== false))) && (
          <svg
            ref={svgRef}
            className="graph-svg"
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
            style={{ cursor: isDragging ? "grabbing" : "grab" }}
            onMouseDown={onSvgMouseDown}
            onMouseMove={onSvgMouseMove}
            onMouseUp={endDrag}
            onMouseLeave={endDrag}
          >
            <defs>
              <radialGradient id="g-bg" cx="40%" cy="45%" r="50%">
                <stop offset="0%" stopColor="rgba(99,102,241,0.06)" />
                <stop offset="100%" stopColor="transparent" />
              </radialGradient>
              {Object.entries(typeColors).map(([type, color]) => (
                <radialGradient key={type} id={`g-${type}`} cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor={color} stopOpacity="0.28" />
                  <stop offset="100%" stopColor={color} stopOpacity="0" />
                </radialGradient>
              ))}
              <filter id="glow-f">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <rect x={viewBox.x - 200} y={viewBox.y - 200} width={viewBox.w + 400} height={viewBox.h + 400} fill="url(#g-bg)" />

{/* Edges */}
{renderedEdges.map((edge, i) => {
  const f = getPos(edge.from);
  const t = getPos(edge.to);

  // Keep the edge key consistent with the filtered graph so
  // focus-mode rendering doesn't change the selected-edge identity.
  const filteredIndex = filteredEdges.indexOf(edge);
  const key = edgeKey(edge, filteredIndex >= 0 ? filteredIndex : i);

  const isHighlighted =
    (selected && (edge.from === selected || edge.to === selected)) ||
    selectedEdgeKey === key;

  const mx = (f.x + t.x) / 2;
  const my = (f.y + t.y) / 2;

  return (
    <g
      key={key}
      style={{ cursor: "pointer" }}
      onClick={() => {
        setSelectedEdgeKey(
          key === selectedEdgeKey ? null : key
        );
        setSelected(null);
      }}
    >
      {/* Wide invisible hit-area so thin edges are easy to click */}
      <line
        x1={f.x}
        y1={f.y}
        x2={t.x}
        y2={t.y}
        stroke="transparent"
        strokeWidth={14}
      />

      <line
        x1={f.x}
        y1={f.y}
        x2={t.x}
        y2={t.y}
        stroke={
          isHighlighted
            ? "rgba(99,102,241,0.55)"
            : "rgba(255,255,255,0.07)"
        }
        strokeWidth={isHighlighted ? 1.5 : 1}
        strokeDasharray={isHighlighted ? "none" : "5 4"}
        style={
          isHighlighted
            ? {}
            : {
                animation: `dash-flow ${7 + i * 0.5}s linear infinite`,
              }
        }
      />

      {/* Only show labels for relevant edges in focus mode */}
      {(isHighlighted || isFocused) && (
        <text
          x={mx}
          y={my - 5}
          textAnchor="middle"
          fill="rgba(255,255,255,0.45)"
          fontSize="7.5"
          fontFamily="Inter,sans-serif"
        >
          {edge.label}
        </text>
      )}
    </g>
  );
})}

        {/* Nodes */}
{renderedNodes.map((n, i) => {
  const color = typeColors[n.type];
  const isSel = n.id === selected;

  const isDimmed =
    !isFocused &&
    selected &&
    !connectedIds.has(n.id) &&
    n.id !== selected;

  const r = riskOverlay
    ? 10 + (n.risk / 100) * 12
    : 13;

  return (
    <g
      key={n.id}
      style={{ cursor: "pointer" }}
      onClick={() => {
        setSelected(n.id === selected ? null : n.id);
        setSelectedEdgeKey(null);
      }}
    >
      {/* Glow halo */}
      <circle
        cx={n.x}
        cy={n.y}
        r={r + 12}
        fill={`url(#g-${n.type})`}
        style={{
          animation: `node-glow ${2.5 + i * 0.22}s ease-in-out infinite`,
          opacity: isDimmed ? 0.2 : 1,
        }}
      />

      {/* Selection ring */}
      {isSel && (
        <circle
          cx={n.x}
          cy={n.y}
          r={r + 5}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeDasharray="4 3"
          style={{ animation: "dash-flow 3s linear infinite" }}
        />
      )}

      {/* Investigation-entity ring, when scoped */}
      {investigationScoped && n.isInvestigationEntity && !isSel && (
        <circle
          cx={n.x}
          cy={n.y}
          r={r + 4}
          fill="none"
          stroke={color}
          strokeWidth="1"
          strokeDasharray="2 3"
          opacity={0.7}
        />
      )}

      {/* Main node */}
      <circle
        cx={n.x}
        cy={n.y}
        r={r}
        fill={isSel ? color : `${color}cc`}
        stroke={isSel ? "rgba(255,255,255,0.6)" : color}
        strokeWidth={isSel ? 2 : 1}
        opacity={isDimmed ? 0.25 : 1}
        style={{
          filter: `drop-shadow(0 0 ${isSel ? 10 : 5}px ${color}${isSel ? "bb" : "50"})`,
          transition: "all 0.2s",
        }}
      />

      {/* Icon */}
      <text
        x={n.x}
        y={n.y + 4}
        textAnchor="middle"
        fill="rgba(255,255,255,0.95)"
        fontSize="11"
        style={{
          userSelect: "none",
          pointerEvents: "none",
        }}
      >
        {typeIcons[n.type]}
      </text>

      {/* Label */}
      <text
        x={n.x}
        y={n.y + r + 14}
        textAnchor="middle"
        fill={
          isSel
            ? "var(--text-1)"
            : "rgba(255,255,255,0.38)"
        }
        fontSize="9"
        fontFamily="Inter,sans-serif"
        style={{ transition: "fill 0.2s" }}
      >
        {n.label}
      </text>

      {/* Risk label */}
      {riskOverlay && (
        <text
          x={n.x}
          y={n.y + r + 24}
          textAnchor="middle"
          fill={riskColorLight(n.risk)}
          fontSize="8"
          fontFamily="JetBrains Mono,monospace"
          fontWeight="600"
        >
          {n.risk}
        </text>
      )}
    </g>
  );
})}
</svg>
)}
</div>
</div>
  );

      {/* Right panel — node details */}
      {selNode && (
        <div className="anim-slide-r" style={{ width: 288, background: "var(--panel)", borderLeft: "1px solid var(--border)", padding: 20, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div style={{ fontSize: 9.5, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 6 }}>{selNode.type.toUpperCase()} NODE</div>
            <div className="display" style={{ fontSize: 17, fontWeight: 700, color: "var(--text-1)", marginBottom: 8 }}>{selNode.label}</div>
            <RiskBadge score={selNode.risk} />
          </div>

          <div style={{ display: "flex", justifyContent: "center" }}>
            <RingScore score={selNode.risk} size={110} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {(() => {
              // All derived live from connectedEdges/liveNodes — no mock data, no extra API call.
              const others = connectedEdges
                .map(e => liveNodes.find(n => n.id === (e.from === selNode.id ? e.to : e.from)))
                .filter(Boolean) as any[];
              const txnCount = others.filter(n => n.type === "txn").length;
              const associatedCount = connectedEdges.filter(e =>
                (e.label ?? "").toLowerCase().includes("associated")
              ).length;
              const riskiest = others.length
                ? others.reduce((a, b) => (b.risk ?? 0) > (a.risk ?? 0) ? b : a)
                : null;

              const stats = [
                { label: "Connections", val: String(connectedEdges.length) },
                { label: "Transactions", val: String(txnCount) },
                { label: "Associated", val: String(associatedCount) },
                {
                  label: "Riskiest Link",
                  val: riskiest ? String(riskiest.risk) : "—",
                  color: riskiest ? riskColorLight(riskiest.risk) : undefined,
                  title: riskiest ? riskiest.label : undefined,
                },
              ];

              return stats.map(item => (
                <div key={item.label} title={item.title} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "10px 8px", textAlign: "center" }}>
                  <div className="display" style={{ fontSize: 19, fontWeight: 700, color: item.color ?? "var(--text-1)" }}>{item.val}</div>
                  <div style={{ fontSize: 10, color: "var(--text-4)", marginTop: 2 }}>{item.label}</div>
                </div>
              ));
            })()}
          </div>

          {/* Connected nodes */}
          <div>
            <div style={{ fontSize: 11, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Connected To</div>
            {connectedEdges.map((e, i) => {
              const otherId = e.from === selNode.id ? e.to : e.from;
              const other = liveNodes.find(n => n.id === otherId);
              if (!other) return null;
              const color = typeColors[other.type];
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 0", borderBottom: "1px solid var(--border)", cursor: "pointer" }} onClick={() => setSelected(otherId)}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0, boxShadow: `0 0 5px ${color}70` }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: "var(--text-1)", fontWeight: 500 }}>{other.label}</div>
                    <div style={{ fontSize: 10, color: "var(--text-4)" }}>{e.label}</div>
                  </div>
                  <RiskBadge score={other.risk} />
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
  <button
    className="btn btn-primary"
    style={{
      justifyContent: "center",
      opacity: selNode.type === "entity" ? 1 : 0.5,
      cursor: selNode.type === "entity" ? "pointer" : "not-allowed",
    }}
    disabled={selNode.type !== "entity"}
    title={
      selNode.type === "entity"
        ? undefined
        : "Full profile is only available for entity nodes"
    }
    onClick={() => {
      if (selNode.type === "entity") {
        navigate("entity", selNode);
      }
    }}
  >
    View Full Profile
  </button>

  <button
    className="btn btn-ghost"
    style={{ justifyContent: "center" }}
    onClick={() => navigate("network-risk")}
  >
    Network Risk Analysis
  </button>

  <button
    className="btn btn-ghost"
    style={{ justifyContent: "center" }}
    onClick={() => navigate("workspace")}
  >
    Add to Investigation
  </button>
          </div>
        </div>
      )}

            {!selNode && selEdge && (
        <div
          className="anim-slide-r"
          style={{
            width: 288,
            background: "var(--panel)",
            borderLeft: "1px solid var(--border)",
            padding: 20,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 9.5,
                color: "var(--text-4)",
                textTransform: "uppercase",
                letterSpacing: "0.09em",
                marginBottom: 6,
              }}
            >
              RELATIONSHIP
            </div>

            <div
              className="display"
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: "var(--text-1)",
                marginBottom: 8,
              }}
            >
              {selEdge.label || "Unlabeled relationship"}
            </div>
          </div>

          {(() => {
            const fromNode = liveNodes.find(
              n => n.id === selEdge.from
            );

            const toNode = liveNodes.find(
              n => n.id === selEdge.to
            );

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <RelRow
                  label="From"
                  node={fromNode}
                  onClick={() => {
                    setSelected(fromNode?.id ?? null);
                    setSelectedEdgeKey(null);
                  }}
                />

                <RelRow
                  label="To"
                  node={toNode}
                  onClick={() => {
                    setSelected(toNode?.id ?? null);
                    setSelectedEdgeKey(null);
                  }}
                />
              </div>
            );
          })()}

          <div
            style={{
              fontSize: 10.5,
              color: "var(--text-4)",
              lineHeight: 1.5,
            }}
          >
            No separate evidence/source record is persisted for this
            relationship. The relationship is derived from the graph data.
          </div>
        </div>
      )}

function RelRow({ label, node, onClick }: { label: string; node: any; onClick: () => void }) {
  if (!node) return null;
  const color = typeColors[node.type];
  return (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 9px", background: "rgba(255,255,255,0.03)", borderRadius: 7, cursor: "pointer" }}>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0, boxShadow: `0 0 5px ${color}70` }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 9.5, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
        <div style={{ fontSize: 12, color: "var(--text-1)", fontWeight: 500 }}>{node.label}</div>
      </div>
      <RiskBadge score={node.risk} />
    </div>
  );
}

function CenteredMessage({ title, detail }: { title: string; detail?: string }) {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 5 }}>
      <div className="glass" style={{ borderRadius: 12, padding: "20px 26px", maxWidth: 360, textAlign: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", marginBottom: detail ? 6 : 0 }}>{title}</div>
        {detail && <div style={{ fontSize: 11.5, color: "var(--text-4)", lineHeight: 1.5 }}>{detail}</div>}
      </div>
    </div>
  );
}
// GraphNode.type comes back from Prisma as the enum ("ENTITY", "WALLET"...)
// but typeColors/typeIcons above are keyed lowercase — without this every
// node would render with undefined styling.
function normalizeNode(n: any) {
  return { ...n, type: (n.type ?? "").toLowerCase() };
}

// DB uses fromId/toId; normalize to from/to for SVG rendering.
function normalizeEdge(e: any) {
  return { ...e, from: e.from ?? e.fromId, to: e.to ?? e.toId, label: e.label ?? e.type ?? "" };
}

function edgeKey(edge: any, index: number) {
  return edge.id ?? `${edge.from}-${edge.to}-${index}`;
}
}