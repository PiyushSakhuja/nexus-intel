import { useState, useCallback } from "react";
import { entities } from "./data";

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
// This file is now just routing + top-level auth state. Every screen lives
// in its own file under ./screens — see README-SPLIT.md for the map of
// who owns what.

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [screen, setScreen] = useState("overview");
  const [entityData, setEntityData] = useState(entities[0]);
  const [workspaceDisplayId, setWorkspaceDisplayId] = useState<string | null>(null);
  const [networkDisplayId, setNetworkDisplayId] = useState<string | null>(null);
  const [graphInvestigationId, setGraphInvestigationId] = useState<string | null>(null);
  const [timelineDisplayId, setTimelineDisplayId] = useState<string | null>(null);
  const [reportsDisplayId, setReportsDisplayId] = useState<string | null>(null);
  const [alertsHighlightId, setAlertsHighlightId] = useState<string | null>(null);
  const [blockchainSelectedId, setBlockchainSelectedId] = useState<string | null>(null);
  const [listingsSelectedId, setListingsSelectedId] = useState<string | null>(null);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
  const [autoOpenNewInvestigation, setAutoOpenNewInvestigation] = useState(false);
  const navigate = useCallback((s: string, data?: any) => {
    if (s === "entity" && data) {
      setEntityData(data);
    }

    if (s === "workspace" && data) {
      const displayId =
        typeof data === "string"
          ? data
          : data.displayId ?? data.id;

      if (displayId) {
        setWorkspaceDisplayId(displayId);
      }
    }

    if (s === "timeline") {
      // Timeline must always operate on the investigation the user came
      // from — never fall back to "the first investigation" or stale
      // state from a previous case. No `data` (or no displayId within it)
      // means "no case context", and TimelineScreen resolves that itself
      // with an honest empty/first-available state rather than this
      // silently reusing whatever was viewed last.
      const timelineId = data
        ? typeof data === "string"
          ? data
          : data.displayId ?? data.id ?? null
        : null;
      setTimelineDisplayId(timelineId);
    }

    if (s === "reports") {
      // Same principle as timeline: which investigation's report to
      // preselect must come from where the user navigated from, not be
      // left to ReportsScreen to guess.
      const reportsId = data
        ? typeof data === "string"
          ? data
          : data.displayId ?? data.id ?? null
        : null;
      setReportsDisplayId(reportsId);
    }

    if (s === "evidence" && data?.selectedId) {
      setSelectedEvidenceId(data.selectedId);
    } else if (s !== "evidence") {
      // Reset selection when navigating away from evidence
      setSelectedEvidenceId(null);
    }

    if (s === "graph") {
      // No `data` (or data with no investigationId) -> global graph, same
      // as before. Passing a displayId string or { investigationId } scopes
      // GraphScreen to that investigation. Reset (rather than leaving
      // stale) whenever "graph" is navigated to without one, so clicking
      // the sidebar's generic Graph link never keeps a previous
      // investigation's scoping around.
      const investigationId = data
        ? typeof data === "string"
          ? data
          : data.investigationId ?? null
        : null;
      setGraphInvestigationId(investigationId);
    }

    if (s === "investigations") {
      // Only auto-open the "New Investigation" modal when explicitly requested
      // (e.g. from the Overview screen's "+ New Investigation" button).
      setAutoOpenNewInvestigation(!!data?.openNew);
    }

    if (s === "alerts") {
      // Same principle as timeline/reports: which alert to jump to and
      // highlight must come from where the user navigated from (e.g. the
      // Overview screen's Live Intelligence Feed) — never left stale from
      // a previous visit. No data (or no displayId within it) means "just
      // open the alert list", same as clicking Alerts in the sidebar.
      const alertId = data
        ? typeof data === "string"
          ? data
          : data.displayId ?? data.id ?? null
        : null;
      setAlertsHighlightId(alertId);
    }

    if (s === "blockchain") {
      // Same principle as alerts/timeline/reports: which wallet to
      // pre-select must come from where the user navigated from (e.g. a
      // "Wallet Updated" row in Overview's Live Intelligence Feed).
      const walletId = data
        ? typeof data === "string"
          ? data
          : data.displayId ?? data.id ?? null
        : null;
      setBlockchainSelectedId(walletId);
    }

    if (s === "listings") {
      // Same principle — which listing to pre-select comes from the
      // event that linked here (e.g. a feed item with a resolved
      // listingId), never left stale from a previous visit.
      const listingId = data
        ? typeof data === "string"
          ? data
          : data.displayId ?? data.id ?? null
        : null;
      setListingsSelectedId(listingId);
    }

    if (s === "network-risk" && data) {
      const displayId =
        typeof data === "string"
          ? data
          : data.displayId ?? data.id;

      if (displayId) {
        setNetworkDisplayId(displayId);
      }
    }

    setScreen(s);

    setTimeout(() => {
      document.querySelector(".main")?.scrollTo(0, 0);
    }, 0);
  }, []);

  if (!loggedIn) return <LoginScreen onLogin={() => setLoggedIn(true)} />;

  const renderScreen = () => {
    switch (screen) {
      case "overview": return <OverviewScreen navigate={navigate} />;
      case "search": return <SearchScreen navigate={navigate} />;
      case "alerts": return <AlertsScreen navigate={navigate} highlightId={alertsHighlightId} />;
      case "entities": return <EntitiesScreen navigate={navigate} />;
      case "entity": return <EntityScreen entity={entityData} navigate={navigate} />;
      case "graph": return <GraphScreen navigate={navigate} investigationId={graphInvestigationId} />;
      case "network-risk": return <NetworkRiskScreen navigate={navigate} displayId={networkDisplayId} />;
      case "listings": return <ListingsScreen selectedId={listingsSelectedId} />;
      case "blockchain": return <BlockchainScreen selectedId={blockchainSelectedId} />;
      case "investigations": return <InvestigationsScreen navigate={navigate} autoOpenNew={autoOpenNewInvestigation} />;
      case "workspace":
        return (
          <WorkspaceScreen
            navigate={navigate}
            displayId={workspaceDisplayId}
          />
        );
      case "timeline": return <TimelineScreen navigate={navigate} displayId={timelineDisplayId} />;
      case "evidence": return <EvidenceScreen selectedId={selectedEvidenceId} />;
      case "analytics": return <AnalyticsScreen />;
      case "reports": return <ReportsScreen navigate={navigate} preselectedDisplayId={reportsDisplayId} />;
      case "audit": return <AuditScreen />;
      case "admin": return <AdminScreen />;
      default: return <OverviewScreen navigate={navigate} />;
    }
  };

  const graphFull = screen === "graph";

  return (
    <div className="app-shell">
      <Topbar navigate={navigate} />
      <Sidebar current={screen} navigate={navigate} />
      <main className="main scroll-reveal" style={graphFull ? { overflow: "hidden" } : {}}>
        {renderScreen()}
      </main>
    </div>
  );
}