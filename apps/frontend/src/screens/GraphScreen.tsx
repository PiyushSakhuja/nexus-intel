import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  investigations, evidenceRecords,
  auditLog, flagContributions, networkSignals, caseTimeline,
  type Entity, type Alert, type Investigation, type EvidenceRecord,
} from "../data";
import {
  RingScore, RiskBadge,
} from "../components/shared";
import { apiGet } from "@/lib/api";

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

// ─────────────────────────────────────────────────────────────────────────
// Deterministic force-directed layout
//
// Replaces trusting whatever x/y the API returned. Positions are derived
// entirely client-side from the actual node/edge topology so that:
//   - connected nodes are pulled into visually coherent clusters
//   - disconnected components are kept apart, never interleaved
//   - a minimum center-to-center distance is enforced (no overlap)
//   - the same graph data always produces the exact same layout — no
//     Math.random anywhere; initial placement is derived from a hash of
//     each node's own id
//   - the simulation runs a bounded number of iterations with a cooling
//     schedule and stops early on convergence, rather than animating
//     forever
//
// This is a plain, dependency-free Fruchterman-Reingold-style simulation
// (attraction along real edges + global repulsion + a final collision
// pass), not a general physics engine — graphs here are small (tens of
// nodes), so the O(n^2)-per-iteration cost is negligible.
//
// This does not change what the API returns or what x/y mean in the graph
// data model — it only changes which coordinates the screen renders with.
// ─────────────────────────────────────────────────────────────────────────

const LAYOUT_LINK_DISTANCE = 70;    // ideal spring length along a real edge, and
                                     // the shared "k" for both spring attraction and
                                     // node repulsion below. Lower k simultaneously
                                     // strengthens attraction (force ∝ dist²/k) and
                                     // weakens repulsion (force ∝ k²/dist) for the
                                     // same pair of nodes, which is exactly the
                                     // "connected things should read as a group"
                                     // balance this graph needs — a single shared
                                     // constant, not two competing ones to tune.
const LAYOUT_MIN_GAP = 56;          // minimum center-to-center distance — clears
                                     // the largest node radius (~18px, max risk) on
                                     // both sides plus room for its label
const LAYOUT_COMPONENT_GAP = 40;    // ring spacing enforced between the main
                                     // component, its satellites, and the outer
                                     // ring of isolated nodes — tightened from
                                     // 65 alongside the initial-radius change
                                     // above so components stay visually
                                     // distinct without pushing the overall
                                     // composition out onto huge empty rings
const LAYOUT_MAX_ITERATIONS = 300;
const LAYOUT_CONVERGENCE_EPSILON = 0.03;
const LAYOUT_PADDING = 70;          // outer padding when fitting the viewport

type LayoutPoint = { x: number; y: number };
type LayoutEdge = { from: string; to: string };

// Deterministic string hash -> [0,1). Same node id always yields the same
// starting angle, so re-syncing identical underlying data never reshuffles
// the layout.
function layoutHash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 10000) / 10000;
}

// Undirected BFS over the real edge set to find connected components,
// including isolated nodes as their own size-1 component. Dangling edges
// (endpoint not in the node set) are ignored — same convention already
// used server-side in graphTraversal.ts.
function findConnectedComponents(nodeIds: string[], edges: LayoutEdge[]): string[][] {
  const adjacency = new Map<string, string[]>();
  nodeIds.forEach((id) => adjacency.set(id, []));
  edges.forEach((e) => {
    if (!adjacency.has(e.from) || !adjacency.has(e.to)) return;
    adjacency.get(e.from)!.push(e.to);
    adjacency.get(e.to)!.push(e.from);
  });

  const visited = new Set<string>();
  const components: string[][] = [];
  // Fixed sort order (not fetch/insertion order) so component discovery —
  // and therefore packing order — never depends on API response ordering.
  const orderedIds = [...nodeIds].sort();

  for (const id of orderedIds) {
    if (visited.has(id)) continue;
    const queue = [id];
    visited.add(id);
    const comp: string[] = [];
    let head = 0;
    while (head < queue.length) {
      const current = queue[head++];
      comp.push(current);
      for (const n of adjacency.get(current) ?? []) {
        if (!visited.has(n)) { visited.add(n); queue.push(n); }
      }
    }
    comp.sort();
    components.push(comp);
  }

  // Largest / most-connected clusters first, tie-broken by lowest id — keeps
  // hub clusters near the center of the packed layout and keeps packing
  // order stable across re-syncs of identical data.
  components.sort((a, b) => b.length - a.length || (a[0] < b[0] ? -1 : 1));
  return components;
}

// Lays out a single connected component in its own local coordinate space
// (centered near the origin). A lone node short-circuits to (0,0).
function layoutComponent(ids: string[], edges: LayoutEdge[]): Map<string, LayoutPoint> {
  const positions = new Map<string, LayoutPoint>();
  if (ids.length === 1) {
    positions.set(ids[0], { x: 0, y: 0 });
    return positions;
  }

  // Deterministic initial placement: a ring whose radius grows with
  // component size, so the starting layout is never more cramped than the
  // simulation can reasonably untangle. Previously scaled as sqrt(n) with a
  // floor of 1x LAYOUT_LINK_DISTANCE, which made large components start out
  // (and, since the repulsion/spring balance only ever contracts so far,
  // largely stay) enormous. Scaling by 0.55x brings the starting ring in
  // substantially tighter while the 0.8 floor still keeps small components
  // from starting cramped enough to fight the simulation.
  const initialRadius =
    LAYOUT_LINK_DISTANCE * Math.max(0.8, Math.sqrt(ids.length) * 0.55);
  ids.forEach((id) => {
    const angle = layoutHash(id) * 2 * Math.PI;
    positions.set(id, { x: initialRadius * Math.cos(angle), y: initialRadius * Math.sin(angle) });
  });

  const k = LAYOUT_LINK_DISTANCE;
  let temperature = LAYOUT_LINK_DISTANCE * 0.6;
  const cooling = temperature / LAYOUT_MAX_ITERATIONS;

  for (let iter = 0; iter < LAYOUT_MAX_ITERATIONS; iter++) {
    const disp = new Map<string, LayoutPoint>();
    ids.forEach((id) => disp.set(id, { x: 0, y: 0 }));

    // Global repulsion — every pair pushes apart (inverse-linear in
    // distance, standard FR repulsion). This is what spreads unrelated
    // nodes out instead of letting them collapse together.
    for (let a = 0; a < ids.length; a++) {
      for (let b = a + 1; b < ids.length; b++) {
        const pa = positions.get(ids[a])!;
        const pb = positions.get(ids[b])!;
        const dx = pa.x - pb.x;
        const dy = pa.y - pb.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const force = (k * k) / dist;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        const da = disp.get(ids[a])!; da.x += fx; da.y += fy;
        const db = disp.get(ids[b])!; db.x -= fx; db.y -= fy;
      }
    }

    // Spring attraction along real edges only — this is what pulls
    // connected nodes into a coherent cluster. No edge is invented here;
    // this only consumes edges that were passed in.
    for (const e of edges) {
      const pa = positions.get(e.from);
      const pb = positions.get(e.to);
      if (!pa || !pb) continue;
      const dx = pa.x - pb.x;
      const dy = pa.y - pb.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const force = (dist * dist) / k;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      const da = disp.get(e.from)!; da.x -= fx; da.y -= fy;
      const db = disp.get(e.to)!; db.x += fx; db.y += fy;
    }

    // Integrate with a cooling cap on per-step displacement (FR's
    // "temperature") so the simulation settles instead of oscillating
    // forever.
    let maxDisp = 0;
    ids.forEach((id) => {
      const d = disp.get(id)!;
      const dist = Math.sqrt(d.x * d.x + d.y * d.y) || 0.0001;
      const capped = Math.min(dist, temperature);
      const p = positions.get(id)!;
      p.x += (d.x / dist) * capped;
      p.y += (d.y / dist) * capped;
      maxDisp = Math.max(maxDisp, capped);
    });
    temperature = Math.max(0.01, temperature - cooling);

    // Convergence check — stop iterating once nothing is moving
    // meaningfully rather than always burning the full iteration budget.
    if (maxDisp < LAYOUT_CONVERGENCE_EPSILON) break;
  }

  // Final collision-resolution pass: guarantees the hard minimum-distance
  // requirement even where the spring/repulsion balance alone doesn't fully
  // satisfy it (e.g. dense small components).
  for (let pass = 0; pass < 6; pass++) {
    let moved = false;
    for (let a = 0; a < ids.length; a++) {
      for (let b = a + 1; b < ids.length; b++) {
        const pa = positions.get(ids[a])!;
        const pb = positions.get(ids[b])!;
        const dx = pb.x - pa.x;
        const dy = pb.y - pa.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        if (dist < LAYOUT_MIN_GAP) {
          const push = (LAYOUT_MIN_GAP - dist) / 2;
          const ux = dx / dist;
          const uy = dy / dist;
          pa.x -= ux * push; pa.y -= uy * push;
          pb.x += ux * push; pb.y += uy * push;
          moved = true;
        }
      }
    }
    if (!moved) break;
  }

  return positions;
}

// Arranges each connected component's own internal layout (still produced
// by layoutComponent's force simulation below) into an overall composition
// centered on the single largest/most-connected component, instead of
// shelf-packing every component into rows like a dashboard grid.
//
//   - the largest component is placed at the origin and becomes the visual
//     center of gravity, exactly like the reference's hub-and-cluster feel
//   - smaller connected components ("satellites") are placed on a ring
//     immediately around it
//   - fully isolated nodes (no real edges at all) go on a further-out ring
//     around the whole composition — visibly peripheral, never mixed into
//     the network, never stacked into a long column
//   - a short deterministic pass nudges apart any components whose rings
//     still overlap; it is a safety net, not the primary placement logic
//
// No relationship is fabricated here — this only decides where each
// component (as computed by the real edge-based force simulation) sits
// relative to the others.
function arrangeComponents(
  components: string[][],
  edgesByComponent: Map<number, LayoutEdge[]>
): { positions: Map<string, LayoutPoint>; bounds: { minX: number; minY: number; maxX: number; maxY: number } } {
  const positions = new Map<string, LayoutPoint>();
  if (components.length === 0) return { positions, bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 } };

  const items = components.map((comp, idx) => {
    const local = layoutComponent(comp, edgesByComponent.get(idx) ?? []);
    let cx = 0, cy = 0;
    local.forEach((p) => { cx += p.x; cy += p.y; });
    cx /= local.size; cy /= local.size;
    let radius = LAYOUT_MIN_GAP / 2;
    local.forEach((p) => { radius = Math.max(radius, Math.hypot(p.x - cx, p.y - cy)); });
    // Re-center this component's own local positions on (0,0) so it can be
    // translated as a single rigid unit once its ring position is decided.
    const centered = new Map<string, LayoutPoint>();
    local.forEach((p, id) => centered.set(id, { x: p.x - cx, y: p.y - cy }));
    return { idx, ids: comp, local: centered, radius, isIsolated: comp.length === 1 };
  });

  const main = items[0];
  const satellites = items.slice(1).filter((it) => !it.isIsolated);
  const isolates = items.slice(1).filter((it) => it.isIsolated);

  const centers = new Map<number, LayoutPoint>();
  centers.set(main.idx, { x: 0, y: 0 });

  const ringGap = LAYOUT_COMPONENT_GAP;
  const satelliteRingRadius = main.radius + ringGap;

  satellites.forEach((item, i) => {
    const angle = (i / satellites.length) * 2 * Math.PI;
    const dist = satelliteRingRadius + item.radius;
    centers.set(item.idx, { x: dist * Math.cos(angle), y: dist * Math.sin(angle) });
  });

  // Isolated nodes sit on their own ring, further out than every satellite —
  // this is what keeps unrelated entities from crowding the actual network.
  const satelliteOuterReach = satellites.reduce((max, item) => {
    const c = centers.get(item.idx)!;
    return Math.max(max, Math.hypot(c.x, c.y) + item.radius);
  }, main.radius);
  const isolateRingRadius = satelliteOuterReach + ringGap;

  isolates.forEach((item, i) => {
    // Half-slice offset from the satellite ring's angles is a fixed,
    // deterministic cosmetic choice (not randomness) so an isolated node
    // doesn't land in the exact radial shadow of a satellite component.
    const angle = ((i + 0.5) / isolates.length) * 2 * Math.PI;
    const dist = isolateRingRadius + item.radius;
    centers.set(item.idx, { x: dist * Math.cos(angle), y: dist * Math.sin(angle) });
  });

  // Bounded relaxation pass: treat every item as a circle (its own bounding
  // radius) and separate any pair that still overlaps. With items already
  // placed on two clean rings this rarely has to move anything — it exists
  // to handle unusual size distributions, not as the primary layout step.
  // The main component (index 0 in placement order) stays anchored at the
  // center; only the other item in a colliding pair yields.
  for (let pass = 0; pass < 8; pass++) {
    let moved = false;
    for (let a = 0; a < items.length; a++) {
      for (let b = a + 1; b < items.length; b++) {
        const ca = centers.get(items[a].idx)!;
        const cb = centers.get(items[b].idx)!;
        const dx = cb.x - ca.x;
        const dy = cb.y - ca.y;
        const dist = Math.hypot(dx, dy) || 0.01;
        const minDist = items[a].radius + items[b].radius + ringGap;
        if (dist < minDist) {
          const push = (minDist - dist) / 2;
          const ux = dx / dist, uy = dy / dist;
          if (a === 0) {
            cb.x += ux * push * 2; cb.y += uy * push * 2;
          } else {
            ca.x -= ux * push; ca.y -= uy * push;
            cb.x += ux * push; cb.y += uy * push;
          }
          moved = true;
        }
      }
    }
    if (!moved) break;
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  items.forEach((item) => {
    const c = centers.get(item.idx)!;
    item.local.forEach((p, id) => {
      const gx = p.x + c.x;
      const gy = p.y + c.y;
      positions.set(id, { x: gx, y: gy });
      minX = Math.min(minX, gx); maxX = Math.max(maxX, gx);
      minY = Math.min(minY, gy); maxY = Math.max(maxY, gy);
    });
  });

  if (!isFinite(minX)) { minX = minY = maxX = maxY = 0; }
  return { positions, bounds: { minX, minY, maxX, maxY } };
}

// Top-level entry point: raw nodes/edges in, final { id -> {x,y} } out, plus
// the bounding box so the viewport can be fit to whatever was computed.
// Called from a useMemo keyed on the raw node/edge arrays — it only runs
// when the graph data itself changes (a new fetch or investigation switch),
// never on selection, filter, focus-mode, or risk-overlay toggles, and
// never as part of the per-node/per-edge render loop.
function computeGraphLayout(
  nodes: { id: string; x?: number; y?: number }[],
  edges: LayoutEdge[]
): {
  positions: Map<string, LayoutPoint>;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
} {
  if (nodes.length === 0) return { positions: new Map(), bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 } };
  // Large graphs are too expensive for the O(n²) force simulation.
// The backend already provides deterministic coordinates, so use those
// once the graph becomes large enough. This keeps the UI responsive.
const LARGE_GRAPH_THRESHOLD = 250;

if (nodes.length > LARGE_GRAPH_THRESHOLD) {
  const positions = new Map<string, LayoutPoint>();

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  nodes.forEach((node, index) => {
    // Prefer the backend coordinates.
    // Fall back to a deterministic grid if either coordinate is missing.
    const x = Number.isFinite(node.x)
      ? node.x!
      : (index % 20) * 80;

    const y = Number.isFinite(node.y)
      ? node.y!
      : Math.floor(index / 20) * 80;

    positions.set(node.id, { x, y });

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  });

  return {
    positions,
    bounds: {
      minX,
      minY,
      maxX,
      maxY,
    },
  };
}
  const nodeIds = nodes.map((n) => n.id);
  const validEdges = edges.filter((e) => e.from && e.to && e.from !== e.to);
  const components = findConnectedComponents(nodeIds, validEdges);
  const edgesByComponent = new Map<number, LayoutEdge[]>();
  components.forEach((comp, i) => {
    const compSet = new Set(comp);
    edgesByComponent.set(i, validEdges.filter((e) => compSet.has(e.from) && compSet.has(e.to)));
  });
  return arrangeComponents(components, edgesByComponent);
}

// Dedicated compact layout for Focus Mode's 1-hop neighborhood: the
// selected node at the center, its direct neighbors placed evenly around
// it. Reusing the full-graph coordinates here would leave a small
// neighborhood scattered across whatever space the full layout happened to
// place it in — a fresh radial layout for just this subset is simpler and
// safer than trying to make one force simulation serve both views. Only
// ever consumes the selected node's real neighbor set — no relationship is
// added or invented, and the neighbor set itself is untouched (still a
// strict 1-hop neighborhood).
function computeFocusLayout(centerId: string, neighborIds: string[]): Map<string, LayoutPoint> {
  const positions = new Map<string, LayoutPoint>();
  positions.set(centerId, { x: 0, y: 0 });
  const n = neighborIds.length;
  if (n === 0) return positions;
  const radius = Math.max(LAYOUT_MIN_GAP, LAYOUT_LINK_DISTANCE);
  // Deterministic angle offset derived from the center node's own id, so
  // re-selecting the same node always reproduces the same arrangement.
  const angleOffset = layoutHash(centerId) * 2 * Math.PI;
  neighborIds.forEach((id, i) => {
    const angle = angleOffset + (i / n) * 2 * Math.PI;
    positions.set(id, { x: radius * Math.cos(angle), y: radius * Math.sin(angle) });
  });
  return positions;
}

// Fits a viewBox to a computed bounding box (with padding), clamped to the
// same zoom limits the toolbar already respects — this is what keeps every
// node inside the viewport on load instead of scattering some of them
// outside the visible canvas. Optional overrides let Focus Mode use a
// gentler floor/padding than the full-graph fit (see FOCUS_* constants
// below) so zooming into a small or single-node neighborhood doesn't blow
// it up to fill nearly the whole screen.
function fitViewBox(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  options?: { padding?: number; minSize?: number }
) {
  const padding = options?.padding ?? LAYOUT_PADDING;
  const minSize = options?.minSize ?? MIN_VIEWBOX_SIZE;
  const spanX = Math.max(bounds.maxX - bounds.minX, 0);
  const spanY = Math.max(bounds.maxY - bounds.minY, 0);
  const w = Math.min(MAX_VIEWBOX_SIZE, Math.max(minSize, spanX + padding * 2));
  const h = Math.min(MAX_VIEWBOX_SIZE, Math.max(minSize, spanY + padding * 2));
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

// Focus Mode's neighborhood is often tiny (sometimes a single isolated
// node with zero neighbors), so it needs its own, larger floor than the
// full-graph fit — otherwise fitViewBox clamps down to MIN_VIEWBOX_SIZE,
// which crops in tight enough that one node's glow/label fills most of
// the screen. These give a comfortably zoomed, not maximally zoomed, view.
const FOCUS_MIN_VIEWBOX_SIZE = 420;
const FOCUS_PADDING = 110;

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
const [liveNodes, setLiveNodes] = useState<any[]>([]);
const [liveEdges, setLiveEdges] = useState<any[]>([]);
const [visibleTypes, setVisibleTypes] = useState<Set<string>>(
  new Set(ALL_TYPES)
);

// Fetch state — shared by both the global graph (/api/graph) and the
// investigation-scoped graph (/api/investigations/:id/graph). Neither path
// falls back to mock data on failure or on an empty response; both clear
// liveNodes/liveEdges explicitly so the screen never keeps stale data.
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
const [meta, setMeta] = useState<any | null>(null);

useEffect(() => {
  setSelected(null);
  setSelectedEdgeKey(null);
  setError(null);
  setMeta(null);
  setLoading(true);

  if (investigationId) {
    apiGet<any>(`/api/investigations/${investigationId}/graph`)
      .then((data) => {
        setMeta(data);
        setLiveNodes((data.nodes ?? []).map(normalizeNode));
        setLiveEdges((data.edges ?? []).map(normalizeEdge));
      })
      .catch((err) => {
        setError(err.message ?? "Unable to load investigation graph.");
        setLiveNodes([]);
        setLiveEdges([]);
      })
      .finally(() => setLoading(false));

    return;
  }

  apiGet<any>("/api/graph")
    .then(({ nodes, edges }) => {
      // Explicit replace, not a length-gated merge — an empty API response
      // must clear whatever graph was previously shown, not leave it in place.
      setLiveNodes((nodes ?? []).map(normalizeNode));
      setLiveEdges((edges ?? []).map(normalizeEdge));
    })
    .catch((err) => {
      setError(err.message ?? "Unable to load graph.");
      setLiveNodes([]);
      setLiveEdges([]);
    })
    .finally(() => setLoading(false));
}, [investigationId]);

  // ─── Type filter, applied BEFORE layout ─────────────────────────────────
  // Previously the layout ran once on the full, unfiltered graph, and the
  // type filter was applied afterward on top of those positions — so hiding
  // a node type left the remaining visible nodes sitting wherever the FULL
  // graph's force simulation had put them, gaps and all. Filtering first
  // means the layout only ever sees the nodes that will actually be drawn.
  const typeFilteredNodes = useMemo(
    () => liveNodes.filter((n) => visibleTypes.has(n.type)),
    [liveNodes, visibleTypes]
  );
  const typeFilteredNodeIds = useMemo(
    () => new Set(typeFilteredNodes.map((n) => n.id)),
    [typeFilteredNodes]
  );
  // Filtered edges must still contain only visible endpoints.
  const typeFilteredEdges = useMemo(
    () =>
      liveEdges.filter(
        (e) =>
          typeFilteredNodeIds.has(e.from ?? e.fromId) &&
          typeFilteredNodeIds.has(e.to ?? e.toId)
      ),
    [liveEdges, typeFilteredNodeIds]
  );

  // ─── Deterministic layout ────────────────────────────────────────────────
  // Recomputed whenever the VISIBLE graph changes — a new fetch, an
  // investigation switch, or a type-filter toggle — so a filtered view is
  // always re-centered and compacted for exactly the subset being shown,
  // never left as a crop of the full-graph layout. Not recomputed on
  // selection, focus-mode, or risk-overlay toggles, which don't change what
  // set of nodes/edges is visible.
  const { positions: layoutPositions, bounds: layoutBounds } = useMemo(
    () =>
      computeGraphLayout(
        typeFilteredNodes,
        typeFilteredEdges.map((e) => ({ from: e.from ?? e.fromId, to: e.to ?? e.toId }))
      ),
    [typeFilteredNodes, typeFilteredEdges]
  );

  // Same (already type-filtered) nodes, positions swapped for the computed
  // layout. Every other field (id, type, risk, label, alias...) passes
  // through untouched — this never mutates liveNodes, so the raw API
  // response shape is unaffected.
  const positionedNodes = useMemo(
    () =>
      typeFilteredNodes.map((n) => {
        const p = layoutPositions.get(n.id);
        return p ? { ...n, x: p.x, y: p.y } : n;
      }),
    [typeFilteredNodes, layoutPositions]
  );

  // ─── Zoom / pan (Phase 6) ────────────────────────────────────────────────
  const [viewBox, setViewBox] = useState(DEFAULT_VIEWBOX);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragState = useRef<{ startX: number; startY: number; startViewBox: typeof DEFAULT_VIEWBOX } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Fit the viewport to whatever the layout just computed. Only fires when
  // layoutBounds itself changes (i.e. new graph data), so it never fights
  // with a user's manual pan/zoom in between loads.
  useEffect(() => {
    if (liveNodes.length === 0) return;
    setViewBox(fitViewBox(layoutBounds));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutBounds]);

  const zoomBy = useCallback((factor: number) => {
    setViewBox((vb) => {
      const newW = Math.min(MAX_VIEWBOX_SIZE, Math.max(MIN_VIEWBOX_SIZE, vb.w * factor));
      const newH = Math.min(MAX_VIEWBOX_SIZE, Math.max(MIN_VIEWBOX_SIZE, vb.h * factor));
      const cx = vb.x + vb.w / 2;
      const cy = vb.y + vb.h / 2;
      return { x: cx - newW / 2, y: cy - newH / 2, w: newW, h: newH };
    });
  }, []);
  const resetView = useCallback(() => setViewBox(fitViewBox(layoutBounds)), [layoutBounds]);

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

  // positionedNodes/typeFilteredEdges above are already restricted to
  // visibleTypes (filtering now happens before layout — see above), so
  // these are just the post-layout aliases the rest of the render logic
  // already expects.
  const filteredNodes = positionedNodes;
  const filteredNodeIds = typeFilteredNodeIds;
  const filteredEdges = typeFilteredEdges;

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

// Dedicated compact layout for the focused neighborhood (Part 10): the
// full-graph coordinates above were never designed to make a small 1-hop
// slice of the graph look good on its own, so Focus Mode gets its own tiny
// radial layout instead — selected node at the center, its real neighbors
// (and only its real neighbors) placed evenly around it.
const focusNeighborIds = isFocused
  ? Array.from(connectedIds).filter(id => id !== selected).sort()
  : [];
const focusPositions =
  isFocused && selected ? computeFocusLayout(selected, focusNeighborIds) : null;

// Nodes as actually drawn: full-graph coordinates, swapped for the focus
// layout's coordinates when Focus Mode is showing a neighborhood. Leaves
// positionedNodes/liveNodes themselves untouched.
const displayNodes = renderedNodes.map((n) => {
  const p = focusPositions?.get(n.id);
  return p ? { ...n, x: p.x, y: p.y } : n;
});

// Focus-mode viewport fit: fits to the dedicated focus layout's own bounds
// (computed above) rather than the full-graph layout bounds, so a small
// neighborhood actually reads as compact instead of just being a crop of
// wherever the full graph happened to place those nodes. Only refits on
// entering/updating/leaving an actual focus (tracked via focusedRef), so
// normal node selection with Focus Mode off never fights the user's manual
// pan/zoom. Restores the full-graph fit when focus is left.
const focusedRef = useRef(false);
useEffect(() => {
  if (isFocused && focusPositions) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    focusPositions.forEach((p) => {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    });
    if (isFinite(minX)) {
      setViewBox(fitViewBox({ minX, minY, maxX, maxY }, { padding: FOCUS_PADDING, minSize: FOCUS_MIN_VIEWBOX_SIZE }));
    }
    focusedRef.current = true;
  } else if (focusedRef.current) {
    setViewBox(fitViewBox(layoutBounds));
    focusedRef.current = false;
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [isFocused, selected]);

// Position lookup used for edge endpoints — same focus-layout override as
// displayNodes, so edges connect to where the nodes are actually drawn.
const getPos = (id: string) =>
  focusPositions?.get(id) ?? positionedNodes.find(n => n.id === id) ?? { x: 0, y: 0 };

const investigationScoped = !!investigationId;

if (loading) {
  return (
    <div style={{ padding: "26px 28px" }}>
      <p className="page-sub">Loading network graph…</p>
    </div>
  );
}

if (error) {
  return (
    <div style={{ padding: "26px 28px" }}>
      <p
        className="page-sub"
        style={{ color: "var(--high-light)" }}
      >
        Couldn't reach the API ({error}).
      </p>
    </div>
  );
}

if (liveNodes.length === 0) {
  return (
    <div style={{ padding: "26px 28px" }}>
      <p className="page-sub">No graph data available yet.</p>
    </div>
  );
}

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

  // Push the label off the line itself (perpendicular offset) rather than
  // stamping it at the raw midpoint. On a short, steep edge — exactly what
  // Focus Mode zooms into — the midpoint sits almost on top of one of the
  // endpoint nodes' own label pills, since those pills are drawn directly
  // below each node on the same line the edge follows. Offsetting sideways
  // moves the edge label off that shared vertical/near-vertical axis.
  const dx = t.x - f.x;
  const dy = t.y - f.y;
  const edgeLen = Math.sqrt(dx * dx + dy * dy) || 1;
  const EDGE_LABEL_OFFSET = 13;
  const px = (-dy / edgeLen) * EDGE_LABEL_OFFSET;
  const py = (dx / edgeLen) * EDGE_LABEL_OFFSET;
  const labelX = mx + px;
  const labelY = my + py;
  const labelWidth = Math.max(30, (edge.label?.length ?? 0) * 4.4);

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
            ? "rgba(99,102,241,0.65)"
            : "rgba(255,255,255,0.20)"
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

      {/* Normal full-graph view stays clean with labels hidden by default;
          a label only appears for the specific edge the user selected, or
          for every edge in the (already small) focused neighborhood. Just
          selecting a node — without selecting one of its edges — no longer
          pops open every label around it. */}
      {(isFocused || selectedEdgeKey === key) && edge.label && (
        <>
          {/* Background pill so the label stays legible over nodes, other
              edges, or a node's own label pill sitting nearby. */}
          <rect
            x={labelX - labelWidth / 2}
            y={labelY - 10}
            width={labelWidth}
            height={13}
            rx={3}
            fill="rgba(8,10,18,0.75)"
            style={{ pointerEvents: "none" }}
          />
          <text
            x={labelX}
            y={labelY}
            textAnchor="middle"
            fill="rgba(255,255,255,0.75)"
            fontSize="7.5"
            fontFamily="Inter,sans-serif"
            style={{ pointerEvents: "none" }}
          >
            {edge.label}
          </text>
        </>
      )}
    </g>
  );
})}

        {/* Nodes */}
{displayNodes.map((n, i) => {
  const color = typeColors[n.type];
  const isSel = n.id === selected;

  const isDimmed =
    !isFocused &&
    selected &&
    !connectedIds.has(n.id) &&
    n.id !== selected;

  // Entity Risk mode reads each node's own individual risk (n.risk, as
  // before). Network Risk mode reads n.networkRisk instead — the real
  // aggregate computed risk of the criminal Network an entity belongs to
  // (attached by GET /api/graph, same value NetworkRiskScreen shows) — so
  // the two toggle states now genuinely differ instead of both drawing
  // from n.risk. Non-entity nodes (market/listing/wallet/txn) never belong
  // to a Network, and an entity outside any tracked network has none
  // either — both cases correctly fall through to null. Nothing here is
  // invented: networkRisk is either the API's real value or absent.
  const modeRisk = mode === "network" ? n.networkRisk : n.risk;

  // A missing/non-numeric risk value (e.g. a node type that doesn't carry a
  // computed score in the current mode) is represented as null — never
  // fabricated. Previously this produced NaN (radius broke silently); it
  // must not become a made-up score either.
  const safeRisk = Number.isFinite(modeRisk) ? Math.min(100, Math.max(0, modeRisk)) : null;
  // Base radius in the 13–16 unit range asked for, with a tighter risk-driven
  // spread (12–18) than before so high-risk nodes still read as bigger
  // without the overall graph feeling wildly uneven in scale.
  const r = riskOverlay && safeRisk !== null
    ? 12 + (safeRisk / 100) * 6
    : 14;

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

      {/* Network Risk mode ring — the same graph-only treatment used for
          selection/investigation-scope rings, applied here so a node whose
          size/color just changed to reflect its NETWORK's risk (rather than
          its own) reads as visibly different from Entity Risk mode, not
          just numerically different in a value the user has to look up. */}
      {mode === "network" && safeRisk !== null && (
        <circle
          cx={n.x}
          cy={n.y}
          r={r + 8}
          fill="none"
          stroke={riskColorLight(safeRisk)}
          strokeWidth="1.25"
          strokeOpacity={isDimmed ? 0.25 : 0.55}
        >
          <title>Network risk: {safeRisk}</title>
        </circle>
      )}

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

      {/* Icon + label + risk value — grouped so dimming (non-selected nodes
          while something else is selected) is consistent across all three,
          matching the dimmed main circle instead of staying full-bright. */}
      <g opacity={isDimmed ? 0.35 : 1} style={{ transition: "opacity 0.2s" }}>
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

        {/* Label background — a soft pill behind the text keeps labels
            readable when nodes/edges sit close together, without needing a
            full text-collision engine. Width is an approximation from
            character count (no DOM text measurement available here), which
            is enough margin for legibility purposes. */}
        <rect
          x={n.x - Math.max(20, n.label.length * 3.0)}
          y={n.y + r + 3}
          width={Math.max(40, n.label.length * 6.0)}
          height={16}
          rx={4}
          fill="rgba(8,10,18,0.65)"
          style={{ pointerEvents: "none" }}
        />

        {/* Label */}
        <text
          x={n.x}
          y={n.y + r + 15}
          textAnchor="middle"
          fill={
            isSel
              ? "var(--text-1)"
              : "rgba(255,255,255,0.82)"
          }
          fontSize="10.5"
          fontFamily="Inter,sans-serif"
          style={{ transition: "fill 0.2s" }}
        >
          {n.label}
        </text>

        {/* Risk value */}
        {riskOverlay && (
          <text
            x={n.x}
            y={n.y + r + 27}
            textAnchor="middle"
            fill={safeRisk !== null ? riskColorLight(safeRisk) : "var(--text-4)"}
            fontSize="8.5"
            fontFamily="JetBrains Mono,monospace"
            fontWeight="600"
          >
            {safeRisk !== null ? safeRisk : "—"}
          </text>
        )}
      </g>
    </g>
  );
})}
</svg>
)}
</div>

      {/* Right panel — node details */}
      {selNode && (
        <div className="anim-slide-r" style={{ width: 288, background: "var(--panel)", borderLeft: "1px solid var(--border)", padding: 20, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div style={{ fontSize: 9.5, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 6 }}>{selNode.type.toUpperCase()} NODE</div>
            <div className="display" style={{ fontSize: 17, fontWeight: 700, color: "var(--text-1)", marginBottom: 8 }}>{selNode.label}</div>
            <RiskBadge score={selNode.risk} />
            {/* Network Risk mode supplement: the entity risk badge above is
                unchanged (Problem 2 asks to preserve the current
                entity/node visualization), this just adds the real
                network-level number alongside it when that mode is active
                and the node actually has one. */}
            {mode === "network" && Number.isFinite(selNode.networkRisk) && (
              <div style={{ fontSize: 10.5, color: "var(--text-4)", marginTop: 6 }}>
                Network risk: <span style={{ color: "var(--text-1)", fontWeight: 600 }}>{selNode.networkRisk}</span>
              </div>
            )}
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
      </div>
  );
}

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