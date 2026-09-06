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
      case "alerts": return <AlertsScreen navigate={navigate} />;
      case "entities": return <EntitiesScreen navigate={navigate} />;
      case "entity": return <EntityScreen entity={entityData} navigate={navigate} />;
      case "graph": return <GraphScreen navigate={navigate} investigationId={graphInvestigationId} />;
      case "network-risk": return <NetworkRiskScreen navigate={navigate} displayId={networkDisplayId} />;
      case "listings": return <ListingsScreen />;
      case "blockchain": return <BlockchainScreen />;
      case "investigations": return <InvestigationsScreen navigate={navigate} />;
      case "workspace":
        return (
          <WorkspaceScreen
            navigate={navigate}
            displayId={workspaceDisplayId}
          />
        );
      case "timeline": return <TimelineScreen navigate={navigate} />;
      case "evidence": return <EvidenceScreen />;
      case "analytics": return <AnalyticsScreen />;
      case "reports": return <ReportsScreen />;
      case "audit": return <AuditScreen />;
      case "admin": return <AdminScreen />;
      default: return <OverviewScreen navigate={navigate} />;
    }
  };

  const graphFull = screen === "graph";

  return (
    <div className="app-shell">
      <Topbar />
      <Sidebar current={screen} navigate={navigate} />
      <main className="main scroll-reveal" style={graphFull ? { overflow: "hidden" } : {}}>
        {renderScreen()}
      </main>
    </div>
  );
}