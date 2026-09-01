import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";

dotenv.config();

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  },
});

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "NEXUS INTEL Backend",
    timestamp: new Date().toISOString(),
  });
});

io.on("connection", (socket) => {
  console.log(`Frontend connected: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`Frontend disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 4000;

httpServer.listen(PORT, () => {
  console.log(`NEXUS INTEL backend running on http://localhost:${PORT}`);
});