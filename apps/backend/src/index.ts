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
import { simulateRouter } from "./routes/simulate.js";
import { vendorsRouter } from "./routes/vendors.js";
import {
  evidenceRouter,
  walletsRouter,
  listingsRouter,
  auditRouter,
  sourcesRouter,
} from "./routes/misc.js";

const PORT = process.env.PORT ?? 4000;
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";

const app = express();
app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "nexus-intel-backend" }));

app.use("/api/entities", entitiesRouter);
app.use("/api/alerts", alertsRouter);
app.use("/api/networks", networksRouter);
app.use("/api/investigations", investigationsRouter);
app.use("/api/graph", graphRouter);
app.use("/api/simulate", simulateRouter);
app.use("/api/evidence", evidenceRouter);
app.use("/api/wallets", walletsRouter);
app.use("/api/listings", listingsRouter);
app.use("/api/vendors", vendorsRouter);
app.use("/api/audit-log", auditRouter);
app.use("/api/sources", sourcesRouter);

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: FRONTEND_URL } });
setIo(io);

io.on("connection", (socket) => {
  console.log(`[socket] client connected: ${socket.id}`);
  socket.on("disconnect", () => console.log(`[socket] client disconnected: ${socket.id}`));
});

httpServer.listen(PORT, () => {
  console.log(`NEXUS INTEL backend running on http://localhost:${PORT}`);
  console.log(`Socket.IO ready — Live Intelligence Feed will broadcast on "intelligence-event"`);
});