import { useCallback, useEffect, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

import { LoginScreen } from "./components/Login";
import { Sidebar, Topbar } from "./components/Layout";

import { OverviewScreen } from "./screens/OverviewScreen";
import { SearchScreen } from "./screens/SearchScreen";
import { EntityScreen } from "./screens/EntityScreen";
import { GraphScreen } from "./screens/GraphScreen";
import { NetworkRiskScreen } from "./screens/NetworkRiskScreen";
import { AlertsScreen } from "./screens/AlertsScreen";
import { EntitiesScreen } from "./screens/EntitiesScreen";
import { ListingsScreen } from "./screens/ListingsScreen";
import { BlockchainScreen } from "./screens/BlockchainScreen";
import { InvestigationsScreen } from "./screens/InvestigationsScreen";
import { WorkspaceScreen } from "./screens/WorkspaceScreen";
import { TimelineScreen } from "./screens/TimelineScreen";
import { EvidenceScreen } from "./screens/EvidenceScreen";
import { AnalyticsScreen } from "./screens/AnalyticsScreen";
import { ReportsScreen } from "./screens/ReportsScreen";
import { AuditScreen } from "./screens/AuditScreen";
import { AdminScreen } from "./screens/AdminScreen";

// ─── ROOT APP ─────────────────────────────────────────────────────────────
// Every screen now lives at its own real URL (react-router-dom), instead of
// being switched in/out of a single in-memory `screen` state. That means:
//   - the browser's back/forward buttons work
//   - a page can be bookmarked, shared, or opened in a new tab
//   - refreshing the page keeps you where you were, instead of bouncing to
//     Overview
// Every screen file (./screens/*) is UNCHANGED — they all still call the
// `navigate(screen, data)` function they always did. `useCompatNavigate`
// below is the only new piece: it translates that old-style call into a
// real URL change, so nothing else in the app had to be rewritten.
//
// NOTE for deployment: because this is a client-side-routed SPA, your host
// needs to serve index.html for *any* path (so a hard refresh or a shared
// link to e.g. /workspace/CASE-004 doesn't 404). See vercel.json /
// netlify.toml / public/_redirects included in this project for the two
// most common hosts — most others (S3+CloudFront, nginx, Cloudflare Pages)
// just need an equivalent "SPA fallback to index.html" rule.

function extractId(data: any): string | undefined {
  if (data === null || data === undefined) return undefined;
  if (typeof data === "string") return data;
  return data.displayId ?? data.id ?? undefined;
}

/**
 * Builds a real URL for every (screen, data) pair the app's screens already
 * call `navigate(...)` with. Mirrors exactly what the old App.tsx's switch
 * statement used to do with local state — see the removed useState calls
 * this replaced.
 */
function buildPath(screen: string, data?: any): string {
  const enc = (id: string) => encodeURIComponent(id);

  switch (screen) {
    case "overview": return "/overview";
    case "search": return "/search";
    case "entities": return "/entities";
    case "entity": {
      const id = extractId(data);
      return id ? `/entities/${enc(id)}` : "/entities";
    }
    case "alerts": {
      const id = extractId(data);
      return id ? `/alerts/${enc(id)}` : "/alerts";
    }
    case "graph": {
      // Two independent things can arrive in `data`: a plain investigation
      // id to scope the graph to (string, or { investigationId }), or a
      // { focusEntityDisplayId } asking the global graph to auto-select one
      // node. They're mutually exclusive in every call site today, so a
      // focus request always means the *global* (unscoped) graph.
      if (data && typeof data === "object" && "focusEntityDisplayId" in data && data.focusEntityDisplayId) {
        return `/graph?focus=${enc(data.focusEntityDisplayId)}`;
      }
      const investigationId = typeof data === "string" ? data : data?.investigationId ?? undefined;
      return investigationId ? `/graph/${enc(investigationId)}` : "/graph";
    }
    case "network-risk": {
      const id = extractId(data);
      return id ? `/network-risk/${enc(id)}` : "/network-risk";
    }
    case "listings": {
      const id = extractId(data);
      return id ? `/listings/${enc(id)}` : "/listings";
    }
    case "blockchain": {
      const id = extractId(data);
      return id ? `/blockchain/${enc(id)}` : "/blockchain";
    }
    case "investigations":
      return data?.openNew ? "/investigations?new=1" : "/investigations";
    case "workspace": {
      const id = extractId(data);
      return id ? `/workspace/${enc(id)}` : "/workspace";
    }
    case "timeline": {
      const id = extractId(data);
      return id ? `/timeline/${enc(id)}` : "/timeline";
    }
    case "evidence": {
      const id = typeof data === "string" ? data : data?.selectedId ?? undefined;
      return id ? `/evidence/${enc(id)}` : "/evidence";
    }
    case "analytics": return "/analytics";
    case "reports": {
      const id = extractId(data);
      return id ? `/reports/${enc(id)}` : "/reports";
    }
    case "audit": return "/audit";
    case "admin": return "/admin";
    default: return "/overview";
  }
}

/** Old call signature (`navigate("workspace", inv.id)`), new URL underneath. */
function useCompatNavigate() {
  const routerNavigate = useNavigate();
  return useCallback(
    (screen: string, data?: any) => {
      routerNavigate(buildPath(screen, data));
      // Every screen used to scroll `.main` back to top on navigation —
      // preserved so long pages (Workspace, Entity, etc.) don't stay
      // scrolled halfway down when you land on the next one.
      setTimeout(() => {
        document.querySelector(".main")?.scrollTo(0, 0);
      }, 0);
    },
    [routerNavigate]
  );
}

// Which sidebar/topbar nav item should be highlighted for a given path —
// mirrors the old `screen` state key so Sidebar's existing active() logic
// (entities/entity, investigations/workspace/timeline, graph/network-risk)
// keeps working unchanged.
function screenKeyFromPath(pathname: string): string {
  if (pathname.startsWith("/entities/")) return "entity";
  if (pathname.startsWith("/entities")) return "entities";
  if (pathname.startsWith("/search")) return "search";
  if (pathname.startsWith("/alerts")) return "alerts";
  if (pathname.startsWith("/graph")) return "graph";
  if (pathname.startsWith("/network-risk")) return "network-risk";
  if (pathname.startsWith("/listings")) return "listings";
  if (pathname.startsWith("/blockchain")) return "blockchain";
  if (pathname.startsWith("/investigations")) return "investigations";
  if (pathname.startsWith("/workspace")) return "workspace";
  if (pathname.startsWith("/timeline")) return "timeline";
  if (pathname.startsWith("/evidence")) return "evidence";
  if (pathname.startsWith("/analytics")) return "analytics";
  if (pathname.startsWith("/reports")) return "reports";
  if (pathname.startsWith("/audit")) return "audit";
  if (pathname.startsWith("/admin")) return "admin";
  return "overview";
}

/** Shared chrome (topbar + sidebar) around every logged-in page. */
function AppShell() {
  const location = useLocation();
  const navigate = useCompatNavigate();
  const current = screenKeyFromPath(location.pathname);
  const graphFull = current === "graph";

  return (
    <div className="app-shell">
      <Topbar navigate={navigate} />
      <Sidebar current={current} navigate={navigate} />
      <main className="main scroll-reveal" style={graphFull ? { overflow: "hidden" } : {}}>
        <Outlet />
      </main>
    </div>
  );
}

// ─── Per-route pages ────────────────────────────────────────────────────
// Each of these reads its id straight from the URL (via useParams /
// useSearchParams) instead of from lifted-up App state, then renders the
// same screen component with the same props it always got.

function EntityPage() {
  const { id } = useParams();
  const navigate = useCompatNavigate();
  // EntityScreen only ever uses this as a pre-fetch placeholder (it
  // immediately fetches the authoritative record by id) — see
  // EntityScreen.tsx's `source = live ?? entityProp`. So a bare
  // { id, displayId } built straight from the URL is enough for a direct
  // link or a refresh to work, exactly like coming from a click.
  const entityData = { id, displayId: id } as any;
  return <EntityScreen entity={entityData} navigate={navigate} />;
}

function GraphPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useCompatNavigate();
  return (
    <GraphScreen
      navigate={navigate}
      investigationId={id ?? null}
      focusEntityDisplayId={searchParams.get("focus")}
    />
  );
}

function NetworkRiskPage() {
  const { id } = useParams();
  const navigate = useCompatNavigate();
  return <NetworkRiskScreen navigate={navigate} displayId={id ?? null} />;
}

function AlertsPage() {
  const { id } = useParams();
  const navigate = useCompatNavigate();
  return <AlertsScreen navigate={navigate} highlightId={id ?? null} />;
}

function ListingsPage() {
  const { id } = useParams();
  return <ListingsScreen selectedId={id ?? null} />;
}

function BlockchainPage() {
  return <BlockchainScreen />;
}

function InvestigationsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useCompatNavigate();
  return <InvestigationsScreen navigate={navigate} autoOpenNew={searchParams.get("new") === "1"} />;
}

function WorkspacePage() {
  const { id } = useParams();
  const navigate = useCompatNavigate();
  return <WorkspaceScreen navigate={navigate} displayId={id ?? null} />;
}

function TimelinePage() {
  const { id } = useParams();
  const navigate = useCompatNavigate();
  return <TimelineScreen navigate={navigate} displayId={id ?? null} />;
}

function EvidencePage() {
  const { id } = useParams();
  return <EvidenceScreen selectedId={id ?? null} />;
}

function ReportsPage() {
  const { id } = useParams();
  const navigate = useCompatNavigate();
  return <ReportsScreen navigate={navigate} preselectedDisplayId={id ?? null} />;
}

function OverviewPage() {
  const navigate = useCompatNavigate();
  return <OverviewScreen navigate={navigate} />;
}
function SearchPage() {
  const navigate = useCompatNavigate();
  return <SearchScreen navigate={navigate} />;
}
function EntitiesPage() {
  const navigate = useCompatNavigate();
  return <EntitiesScreen navigate={navigate} />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/overview" replace />} />
        <Route path="overview" element={<OverviewPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="alerts/:id" element={<AlertsPage />} />
        <Route path="entities" element={<EntitiesPage />} />
        <Route path="entities/:id" element={<EntityPage />} />
        <Route path="graph" element={<GraphPage />} />
        <Route path="graph/:id" element={<GraphPage />} />
        <Route path="network-risk" element={<NetworkRiskPage />} />
        <Route path="network-risk/:id" element={<NetworkRiskPage />} />
        <Route path="listings" element={<ListingsPage />} />
        <Route path="listings/:id" element={<ListingsPage />} />
        <Route path="blockchain" element={<BlockchainPage />} />
        <Route path="blockchain/:id" element={<BlockchainPage />} />
        <Route path="investigations" element={<InvestigationsPage />} />
        <Route path="workspace" element={<WorkspacePage />} />
        <Route path="workspace/:id" element={<WorkspacePage />} />
        <Route path="timeline" element={<TimelinePage />} />
        <Route path="timeline/:id" element={<TimelinePage />} />
        <Route path="evidence" element={<EvidencePage />} />
        <Route path="evidence/:id" element={<EvidencePage />} />
        <Route path="analytics" element={<AnalyticsScreen />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="reports/:id" element={<ReportsPage />} />
        <Route path="audit" element={<AuditScreen />} />
        <Route path="admin" element={<AdminScreen />} />
        <Route path="*" element={<Navigate to="/overview" replace />} />
      </Route>
    </Routes>
  );
}

const AUTH_KEY = "nexus.loggedIn";

export default function App() {
  // Login is still a local/demo gate (no real backend auth yet — see
  // components/Login.tsx), just persisted across refreshes now so that
  // reloading a deep link like /workspace/CASE-004 doesn't bounce you back
  // to the login screen.
  const [loggedIn, setLoggedIn] = useState(() => sessionStorage.getItem(AUTH_KEY) === "1");

  useEffect(() => {
    if (loggedIn) sessionStorage.setItem(AUTH_KEY, "1");
    else sessionStorage.removeItem(AUTH_KEY);
  }, [loggedIn]);

  if (!loggedIn) return <LoginScreen onLogin={() => setLoggedIn(true)} />;

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
