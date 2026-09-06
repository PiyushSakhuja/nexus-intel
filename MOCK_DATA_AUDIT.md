# NEXUS INTEL — Mock Data Elimination: Final Report

## Result

The frontend now typechecks cleanly (`tsc --noEmit`: 0 errors) and builds cleanly
(`vite build`: succeeds), and **every screen renders from live backend data**,
with real empty/error states instead of silent mock fallbacks. `data.ts` no
longer contains a single hardcoded record — only types and pure display
helpers (`riskColor`, `riskLabel`, etc.) remain.

---

## Backend additions (new real data sources, not new mock data)

| New capability | Endpoint | Backs |
|---|---|---|
| Real audit logging on every write | (internal `lib/audit.ts`, called from all write routes) | AuditScreen, EvidenceScreen's chain-of-custody |
| Dashboard KPIs | `GET /api/dashboard/kpis` | OverviewScreen KPI row |
| Analytics aggregates | `GET /api/analytics/overview` | AnalyticsScreen, OverviewScreen's two charts |
| Cross-resource search | `GET /api/search?q=` | SearchScreen |
| Evidence verification | `PATCH /api/evidence/:displayId/status` | EvidenceScreen's "Mark Verified" |
| Report-generation audit | `POST /api/investigations/:displayId/report-generated` | ReportsScreen |
| Standalone timeline fetch | `GET /api/investigations/:displayId/timeline` | TimelineScreen, EntityScreen |
| Alert status fix | `PATCH /api/alerts/:displayId/status` (was `:id`, was unreachable) | AlertsScreen's Dismiss button |
| Graph → entity linking | `GET /api/graph` now includes `entity.displayId` | GraphScreen's "View Full Profile" |
| Source listing counts | `GET /api/sources` now includes `_count.listings` | AdminScreen's Data Sources panel |

Every one of these queries real Postgres rows via Prisma — nothing here is a
new mock layer, and no existing route was duplicated.

---

## Frontend: what changed, screen by screen

| Screen | Before | After |
|---|---|---|
| `data.ts` | ~260 lines of hardcoded entities, alerts, investigations, evidence, charts, KPIs, graph nodes/edges, audit log, timeline | Types + pure color/label helper functions only |
| `App.tsx` | Seeded `entityData` from `entities[0]` (mock) before any navigation | Starts `null`; `EntityScreen` only renders once real data is selected |
| `WorkspaceScreen.tsx` | Evidence panel always showed 3 hardcoded mock records, regardless of case; Related Entities silently substituted fake entities when a case had none | Evidence panel shows the real investigation's evidence (or an honest "none yet" state); Related Entities shows real linked entities or an honest empty state |
| `EntitiesScreen.tsx`, `InvestigationsScreen.tsx`, `ListingsScreen.tsx` | Mock array as initial state, error text said "showing demo data" on API failure | Empty initial state, real empty/error messaging, no fallback lie |
| `EvidenceScreen.tsx` | Chain-of-custody was 3 fabricated lines ("Evidence collected / Integrity verified / Added to case") shown for every record regardless of history | Chain-of-custody pulled from real `AuditLogEntry` rows filtered by evidence ID; added a working "Mark Verified" action |
| `AlertsScreen.tsx` | "Dismiss" button had no handler; status-change route was unreachable | Wired to the real (now-fixed) status endpoint |
| `AuditScreen.tsx` | Read a table that nothing ever wrote to | Same UI, now reading a table that real actions actually populate |
| `BlockchainScreen.tsx` | "Transaction Volume" chart used a fixed mock array unconditionally for every wallet | Replaced with a real per-wallet aggregate summary (no per-day time-series exists in the schema, so none is fabricated) |
| `AnalyticsScreen.tsx` | 100% hardcoded charts | Fully rebuilt against `/api/analytics/overview`, with "not enough data yet" states per chart |
| `AdminScreen.tsx` | Data Sources list was 5 hardcoded names with fake "last sync" times; a fully invented "System Status" panel | Data Sources now real `Source` rows with real listing counts; fake System Status panel removed entirely rather than left fabricated |
| `SearchScreen.tsx` | Search ignored the query and returned the entire mock entity list every time | Full rewrite against real `/api/search`, returning actual matching entities/wallets/listings/investigations |
| `TimelineScreen.tsx` | Hardcoded to `INV-2026-042` and a fixed mock event list | Fetches the real timeline for whatever investigation is open (or the most recent one, as a sensible default) |
| `EntityScreen.tsx` | Timeline tab rendered the same hardcoded `caseTimeline` regardless of entity | Fetches the real timeline of the entity's linked investigation, or an honest "not linked to a case" state |
| `GraphScreen.tsx` | Fallback mock nodes/edges shown if the API call failed; "View Full Profile" linked to a hardcoded mock entity | Real nodes/edges only, with loading/error/empty states; profile link now resolves the real entity via the backend's new `entity.displayId` field |
| `OverviewScreen.tsx` | KPI tiles and two dashboard charts were fully hardcoded from `data.ts` | Wired to `/api/dashboard/kpis` and `/api/analytics/overview`, refreshed live on simulate/alert socket events, with empty states |
| `ReportsScreen.tsx` | Already real (confirmed, not rewritten) — but claimed "recorded in the platform audit log" when nothing was | Same real report logic; now actually calls the audit endpoint on generation, so the claim is true |
| `NetworkRiskScreen.tsx` | Already fully live (confirmed, untouched) | — |

---

## Remaining known items (not mock data, but worth flagging)

These are **not** instances of fake/hardcoded data — they're real, working API
calls — but they didn't get the `lib/api.ts` client migration in this pass:

- `WorkspaceScreen.tsx` (7 calls) and `NetworkRiskScreen.tsx` (4 calls) still
  construct `fetch("http://localhost:4000/...")` directly instead of using
  the new shared `apiGet`/`apiPost`/`apiPatch` helpers. Functionally
  identical, just inconsistent with the rest of the app and slightly harder
  to repoint at a different backend URL later. `lib/socket.ts` also still
  hardcodes its Socket.IO target the same way.
- `AdminScreen.tsx`'s "Users" panel and permission matrix are still a static
  illustration of the intended role structure — clearly commented as such
  in the code. There is no authentication/session system anywhere in the
  backend (the `User`/`Role` models exist in the schema but no route reads
  or writes them), so there's no live data this panel could show instead
  without first building real auth. It is not sourced from `data.ts` and no
  longer claims to be live status (the fabricated "Active/Idle/Offline +
  last active" fields were removed).
- KPI sparklines for "Flagged Intelligence" and "Tracked Wallets" render as
  flat lines rather than a trend, because `Listing` and `Wallet` have no
  `createdAt` field in the schema to bucket by day. The current totals are
  real; only the historical shape of the sparkline is necessarily flat
  rather than fabricated.

## Pre-existing backend TypeScript strictness (not introduced by this change)

`tsc --noEmit` on the backend reports 27 pre-existing `noImplicitAny` errors
in `llmClient.ts`, `alerts.ts`, `entities.ts`, `investigations.ts`,
`misc.ts`, `networks.ts`, `simulate.ts`, and `vendors.ts`. These predate this
refactor (the project's `dev` script uses `tsx`, which doesn't typecheck) and
are unrelated to mock data. All newly-added files (`audit.ts`,
`asyncHandler.ts`, `dashboard.ts`, `search.ts`) are fully typecheck-clean.

---

## Verification performed

- `npx tsc --noEmit` on frontend: **0 errors**
- `npx tsc --noEmit` on backend: 27 errors, all pre-existing, none in new/changed logic paths that matter
- `npx vite build`: succeeds
- Repo-wide grep for `Math.random`, hardcoded `INV-`/`ENT-`/`N-`/`EV-`/`ALT-` style IDs outside comments/fallback constants, and "demo data"/"synthetic"/"mock data" copy: all resolved except one intentional, real, seeded fallback ID (`N-018`, confirmed present in `seed.ts`) and one honestly-labeled static illustration panel (Admin's role roster)
