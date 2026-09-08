// producer.mjs
//
// Standalone "live simulation" producer for NEXUS INTEL.
//
// Every PRODUCER_INTERVAL_MS, this script:
//   1. Reads the staging pool (a local JSON file — see below).
//   2. Finds the next row that hasn't been sent yet.
//   3. POSTs it to the backend's POST /api/ingest/event, authenticated
//      with INGEST_SECRET_KEY (sent as the x-ingest-key header).
//   4. On success, marks that row sent (with a timestamp) and rewrites
//      the pool file.
//
// This process talks to the backend over HTTP only — never to the
// database directly — so it can run on the same box as the backend today
// and move to a completely separate machine later with no changes beyond
// setting BACKEND_URL to wherever the backend is reachable from.
//
// The staging pool itself lives entirely on THIS machine (staging-pool.json
// next to this script by default). If it doesn't exist yet, this script
// builds it once by calling GET /api/networks on the backend (a normal,
// already-existing read endpoint — no secret required) and generating a
// queue of events across every network it finds. Delete staging-pool.json
// and restart to rebuild it (e.g. after seeding new demo data).
//
// Run it:
//   npm install
//   cp .env.example .env   # fill in INGEST_SECRET_KEY to match the backend
//   npm start

import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";

const BACKEND_URL = (process.env.BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const INGEST_SECRET_KEY = process.env.INGEST_SECRET_KEY;
const INTERVAL_MS = Number(process.env.PRODUCER_INTERVAL_MS ?? 5000);
const ROWS_PER_NETWORK = Number(process.env.ROWS_PER_NETWORK ?? 5);
const POOL_PATH = process.env.STAGING_POOL_PATH
  ? path.resolve(process.env.STAGING_POOL_PATH)
  : path.join(process.cwd(), "staging-pool.json");

if (!INGEST_SECRET_KEY) {
  console.error("[producer] INGEST_SECRET_KEY is not set (check your .env) — refusing to start.");
  process.exit(1);
}

const EVENT_TYPES = [
  { type: "listing_detected", description: "New listing detected on monitored source" },
  { type: "transaction_detected", description: "New blockchain transaction detected" },
];

let running = false; // simple re-entrancy guard in case a tick overruns the interval

async function loadPool() {
  try {
    const raw = await fs.readFile(POOL_PATH, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

async function savePool(pool) {
  await fs.writeFile(POOL_PATH, JSON.stringify(pool, null, 2));
}

// Round-robins across networks so the feed looks like activity spread
// across the whole map, instead of draining one network at a time.
function interleaveByNetwork(rows) {
  const byNetwork = new Map();
  for (const row of rows) {
    if (!byNetwork.has(row.networkDisplayId)) byNetwork.set(row.networkDisplayId, []);
    byNetwork.get(row.networkDisplayId).push(row);
  }
  const buckets = [...byNetwork.values()];
  const out = [];
  let i = 0;
  while (out.length < rows.length) {
    for (const bucket of buckets) {
      if (bucket[i]) out.push(bucket[i]);
    }
    i++;
  }
  return out;
}

async function buildPool() {
  console.log(`[producer] no staging pool at ${POOL_PATH} — building one from ${BACKEND_URL}/api/networks`);

  const res = await fetch(`${BACKEND_URL}/api/networks`);
  if (!res.ok) {
    throw new Error(`GET /api/networks failed: ${res.status} ${res.statusText}`);
  }
  const networks = await res.json();
  if (!Array.isArray(networks) || networks.length === 0) {
    throw new Error("Backend returned no networks — nothing to build a staging pool from.");
  }

  let rows = [];
  let seq = 0;
  for (const network of networks) {
    for (let i = 0; i < ROWS_PER_NETWORK; i++) {
      const eventType = EVENT_TYPES[seq % EVENT_TYPES.length];
      rows.push({
        id: seq,
        networkDisplayId: network.displayId,
        eventType: eventType.type,
        description: eventType.description,
        sent: false,
        sentAt: null,
      });
      seq++;
    }
  }
  rows = interleaveByNetwork(rows);

  const pool = { builtAt: new Date().toISOString(), rows };
  await savePool(pool);
  console.log(`[producer] staging pool built: ${rows.length} rows across ${networks.length} networks -> ${POOL_PATH}`);
  return pool;
}

async function sendRow(row) {
  const res = await fetch(`${BACKEND_URL}/api/ingest/event`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-ingest-key": INGEST_SECRET_KEY,
    },
    body: JSON.stringify({
      networkDisplayId: row.networkDisplayId,
      eventType: row.eventType,
      description: row.description,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`POST /api/ingest/event -> ${res.status}: ${body}`);
  }
  return res.json();
}

async function tick() {
  if (running) return; // previous tick still in flight — skip this one
  running = true;
  try {
    let pool = await loadPool();
    if (!pool) pool = await buildPool();

    const next = pool.rows.find((r) => !r.sent);
    if (!next) {
      console.log("[producer] staging pool exhausted — rebuilding from current backend state.");
      await buildPool();
      return; // next tick picks up the fresh pool
    }

    await sendRow(next);
    next.sent = true;
    next.sentAt = new Date().toISOString();
    await savePool(pool);
    console.log(`[producer] sent row #${next.id} -> ${next.networkDisplayId} (${next.eventType})`);
  } catch (err) {
    console.error(`[producer] tick failed, will retry next interval:`, err.message);
    // Row (if any) is deliberately left unmarked so it's retried.
  } finally {
    running = false;
  }
}

console.log(`[producer] starting — backend=${BACKEND_URL} interval=${INTERVAL_MS}ms pool=${POOL_PATH}`);
tick();
const timer = setInterval(tick, INTERVAL_MS);

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    console.log(`[producer] received ${sig}, stopping.`);
    clearInterval(timer);
    process.exit(0);
  });
}
