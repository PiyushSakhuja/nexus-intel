import "dotenv/config";

import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";

import { setIo } from "./sockets/io.js";

import { entitiesRouter } from "./routes/entities.js";
import { alertsRouter } from "./routes/alerts.js";
import { networksRouter } from "./routes/networks.js";
import { investigationsRouter } from "./routes/investigations.js";
import { graphRouter } from "./routes/graph.js";
import { reportsRouter } from "./routes/reports.js";
import { simulateRouter } from "./routes/simulate.js";
import { ingestRouter } from "./routes/ingest.js";
import { vendorsRouter } from "./routes/vendors.js";

import { dashboardRouter, analyticsRouter } from "./routes/dashboard.js";
import { searchRouter } from "./routes/search.js";

import {
  evidenceRouter,
  walletsRouter,
  listingsRouter,
  auditRouter,
  sourcesRouter,
} from "./routes/misc.js";

const PORT = process.env.PORT ?? 4000;

const FRONTEND_URL =
  process.env.FRONTEND_URL ?? "http://localhost:5173";

const app = express();

app.use(cors({ origin: FRONTEND_URL }));
// Default 100kb limit is too small for base64-encoded evidence images
// (POST /api/evidence's imageBase64 field) — bump it.
app.use(express.json({ limit: "15mb" }));

app.get("/api/health", (_req, res) =>
  res.json({
    status: "ok",
    service: "nexus-intel-backend",
  })
);

app.use("/api/entities", entitiesRouter);
app.use("/api/alerts", alertsRouter);
app.use("/api/networks", networksRouter);
app.use("/api/investigations", investigationsRouter);
app.use("/api/graph", graphRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/simulate", simulateRouter);
app.use("/api/ingest", ingestRouter);
app.use("/api/evidence", evidenceRouter);
app.use("/api/wallets", walletsRouter);
app.use("/api/listings", listingsRouter);
app.use("/api/vendors", vendorsRouter);
app.use("/api/audit-log", auditRouter);
app.use("/api/sources", sourcesRouter);

app.use("/api/dashboard", dashboardRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/search", searchRouter);

// Global error handler — without this, an unhandled exception in any route
// (e.g. a DB outage, a bad Prisma query) crashes out to Express's bare
// default handler, which sends an HTML stack trace instead of the JSON
// error shape every frontend fetch() call already expects and handles.
app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("[error]", err);

    if (res.headersSent) return;

    res.status(500).json({
      error: "Internal server error. Please try again.",
    });
  }
);

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: FRONTEND_URL,
  },
});

setIo(io);

io.on("connection", (socket) => {
  console.log(`[socket] client connected: ${socket.id}`);

  socket.on("disconnect", () =>
    console.log(`[socket] client disconnected: ${socket.id}`)
  );
});

httpServer.listen(PORT, () => {
  console.log(
    `NEXUS INTEL backend running on http://localhost:${PORT}`
  );

  console.log(
    `Socket.IO ready — Live Intelligence Feed will broadcast on "intelligence-event"`
  );
});