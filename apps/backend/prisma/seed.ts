// Seeds the database using the SAME data your existing frontend already
// displays (apps/frontend/src/data.ts), so Day 1 you have believable,
// already-designed demo data instead of empty tables.
//
// Run with: pnpm --filter backend run db:seed

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding NEXUS INTEL database...");

  // ─── Sources (data governance panel) ──────────────────────────────────
  const [sourceAlpha, sourceBeta, sourceGamma, sourceDelta, blockchainSrc, demoSrc] =
    await Promise.all([
      prisma.source.create({ data: { name: "Source Alpha", type: "Intelligence feed", access: "AUTHORIZED" } }),
      prisma.source.create({ data: { name: "Source Beta", type: "Public information", access: "PUBLIC" } }),
      prisma.source.create({ data: { name: "Source Gamma", type: "Intelligence feed", access: "AUTHORIZED" } }),
      prisma.source.create({ data: { name: "Source Delta", type: "Public information", access: "PUBLIC" } }),
      prisma.source.create({ data: { name: "Blockchain Data", type: "Blockchain data", access: "PUBLIC" } }),
      prisma.source.create({ data: { name: "Demo Stream", type: "Synthetic", access: "SYNTHETIC" } }),
    ]);

  // ─── Network N-042 + risk trajectory (the early-warning centerpiece) ──
  const n042 = await prisma.network.create({
    data: { displayId: "N-042", risk: 91, change: 59, status: "CRITICAL", lastActivity: new Date() },
  });
  const n018 = await prisma.network.create({
    data: { displayId: "N-018", risk: 78, change: 31, status: "HIGH" },
  });
  const n067 = await prisma.network.create({
    data: { displayId: "N-067", risk: 72, change: 24, status: "HIGH" },
  });

  const trajectory = [
    { label: "Day 1", score: 32 },
    { label: "Day 5", score: 47 },
    { label: "Day 10", score: 63 },
    { label: "Day 15", score: 81 },
    { label: "Day 20", score: 91 },
  ];
  for (const point of trajectory) {
    await prisma.networkRiskPoint.create({ data: { networkId: n042.id, label: point.label, score: point.score } });
  }

  // ─── Entities + identifiers ─────────────────────────────────────────
  const entityData = [
    {
      displayId: "ENT-001", alias: "Alias_X", risk: 84, confidence: 91, riskChange: 22, networkId: n042.id,
      identifiers: [
        { type: "Primary Alias", value: "Alias_X", confidence: 100 },
        { type: "Username", value: "Username_X23", confidence: 94 },
        { type: "Wallet", value: "WALLET-W1", confidence: 91 },
        { type: "Comm ID", value: "Email_ID_04", confidence: 87 },
      ],
    },
    {
      displayId: "ENT-002", alias: "Alias_Y", risk: 71, confidence: 87, riskChange: 18, networkId: n018.id,
      identifiers: [
        { type: "Primary Alias", value: "Alias_Y", confidence: 100 },
        { type: "Username", value: "Vendor_YY9", confidence: 88 },
        { type: "Wallet", value: "WALLET-W3", confidence: 82 },
      ],
    },
    {
      displayId: "ENT-003", alias: "Username_X23", risk: 68, confidence: 83, riskChange: 12, networkId: n042.id,
      identifiers: [
        { type: "Primary Alias", value: "Username_X23", confidence: 100 },
        { type: "Alias", value: "Alias_X", confidence: 94 },
        { type: "Wallet", value: "WALLET-W2", confidence: 79 },
      ],
    },
    {
      displayId: "ENT-004", alias: "Alias_Z", risk: 52, confidence: 74, riskChange: 8, networkId: n067.id,
      identifiers: [
        { type: "Primary Alias", value: "Alias_Z", confidence: 100 },
        { type: "Comm ID", value: "Tel_ID_17", confidence: 71 },
      ],
    },
    {
      displayId: "ENT-005", alias: "Alias_Q", risk: 44, confidence: 69, riskChange: 3, networkId: null,
      identifiers: [
        { type: "Primary Alias", value: "Alias_Q", confidence: 100 },
        { type: "Email", value: "anon_hash_7a3f", confidence: 67 },
      ],
    },
  ];

  const entities: Record<string, Awaited<ReturnType<typeof prisma.entity.create>>> = {};
  for (const e of entityData) {
    const created = await prisma.entity.create({
      data: {
        displayId: e.displayId,
        alias: e.alias,
        risk: e.risk,
        confidence: e.confidence,
        riskChange: e.riskChange,
        networkId: e.networkId,
        identifiers: { create: e.identifiers },
      },
    });
    entities[e.displayId] = created;
  }

  // ─── Alerts ─────────────────────────────────────────────────────────
  const alt089 = await prisma.alert.create({
    data: {
      displayId: "ALT-089", severity: 91, status: "NEW", networkId: n042.id,
      title: "Network N-042 crossed critical risk threshold",
      reason: "3 connected high-risk entities, 2 recurring identifiers, abnormal transaction pattern",
      entities: { create: [{ entityId: entities["ENT-001"].id }] },
    },
  });
  await prisma.alert.create({
    data: {
      displayId: "ALT-088", severity: 74, status: "NEW", networkId: n018.id,
      title: "New wallet relationship detected in tracked cluster",
      reason: "Wallet linked to known high-risk cluster; cross-source identifier match confidence 87%",
      entities: { create: [{ entityId: entities["ENT-002"].id }] },
    },
  });
  await prisma.alert.create({
    data: {
      displayId: "ALT-087", severity: 58, status: "REVIEWED",
      title: "Repeated identifier observed across 3 intelligence sources",
      reason: "Same communication identifier appeared across Source Alpha, Beta, and Gamma independently",
      entities: { create: [{ entityId: entities["ENT-004"].id }] },
    },
  });

  // ─── Investigation INV-2026-042 (the demo spine) ───────────────────
  const inv042 = await prisma.investigation.create({
    data: {
      displayId: "INV-2026-042",
      title: "Emerging Network Investigation",
      status: "UNDER_INVESTIGATION",
      priority: "HIGH",
      assignee: "Investigator A",
      networkId: n042.id,
      description:
        "Cross-source network N-042 investigation following early-warning trigger on Aug 16, 2026. Primary entity Alias_X resolved with 93% confidence across 4 sources.",
      entities: { create: [{ entityId: entities["ENT-001"].id }, { entityId: entities["ENT-003"].id }] },
      timeline: {
        create: [
          { occurredAt: new Date("2026-08-12T09:14:00Z"), label: "Entity Detected", type: "DETECTION", source: "Source Alpha", agent: "System", description: "Initial detection of Alias_X during intelligence ingestion pipeline" },
          { occurredAt: new Date("2026-08-13T14:32:00Z"), label: "Suspicious Activity", type: "ALERT", source: "Source Beta", agent: "System", description: "Anomalous behavioral pattern identified across two independent sources" },
          { occurredAt: new Date("2026-08-14T10:05:00Z"), label: "Wallet Relationship", type: "DISCOVERY", source: "Blockchain Data", agent: "System", description: "Wallet_W1 linked to entity through transaction pattern analysis" },
          { occurredAt: new Date("2026-08-15T16:22:00Z"), label: "Network Risk Increase", type: "ESCALATION", source: "Risk Engine", agent: "System", description: "Network N-042 risk score escalated from 63 -> 81 over monitored period" },
          { occurredAt: new Date("2026-08-16T08:47:00Z"), label: "Early Warning Triggered", type: "WARNING", source: "Alert Engine", agent: "System", description: "Critical threshold crossed - automatic alert generated, investigator notified" },
          { occurredAt: new Date("2026-08-16T19:21:00Z"), label: "Investigation Opened", type: "ACTION", source: "Investigation Platform", agent: "Investigator A", description: "Case INV-2026-042 created; primary entity Alias_X added as lead subject" },
        ],
      },
      aiAssessments: {
        create: [
          {
            riskScore: 91,
            signals: [
              { label: "Behavioral anomaly", value: 24 },
              { label: "Entity connectivity", value: 21 },
              { label: "Repeated identifiers", value: 18 },
              { label: "Wallet relationships", value: 15 },
              { label: "Suspicious activity concentration", value: 13 },
            ],
            explanation:
              "Risk increased due to repeated identifiers across multiple intelligence sources, association with high-risk network entities, and abnormal activity concentration over the monitored period. AI-assisted assessment — investigator review required.",
            recommendedNext: "Review wallet transaction history for Wallet_W1 and expand entity resolution to unresolved Comm_ID_04.",
          },
        ],
      },
    },
  });

  await prisma.investigation.create({
    data: {
      displayId: "INV-2026-039", title: "Cross-Source Entity Resolution", status: "UNDER_INVESTIGATION",
      priority: "HIGH", assignee: "Investigator B",
      description: "Entity resolution case for Username_X23 cluster. Multiple aliases identified with high confidence.",
      entities: { create: [{ entityId: entities["ENT-003"].id }] },
    },
  });

  // ─── Evidence ───────────────────────────────────────────────────────
  await prisma.evidenceRecord.create({
    data: { displayId: "EV-1029", type: "Intelligence Record", hash: "7A9F3C2D1B4E8A6F93C0D5B2E7F1A4C8", uploadedBy: "Investigator A", status: "VERIFIED", investigationId: inv042.id, sourceId: sourceAlpha.id },
  });
  await prisma.evidenceRecord.create({
    data: { displayId: "EV-1028", type: "Wallet Transaction Log", hash: "B2E4F8A1C6D9E3B72A5C8F0D4E7B1A9C", uploadedBy: "Investigator A", status: "VERIFIED", investigationId: inv042.id, sourceId: blockchainSrc.id },
  });

  // ─── Wallets ────────────────────────────────────────────────────────
  await prisma.wallet.createMany({
    data: [
      { displayId: "WALLET-W1", risk: 87, txnCount: 42, entityCount: 8, cluster: "Cluster-C1", totalVolume: "4.73 BTC-eq", flagged: true },
      { displayId: "WALLET-W2", risk: 74, txnCount: 28, entityCount: 5, cluster: "Cluster-C1", totalVolume: "2.18 BTC-eq", flagged: true },
      { displayId: "WALLET-W3", risk: 61, txnCount: 15, entityCount: 3, cluster: "Cluster-C2", totalVolume: "0.94 BTC-eq", flagged: false },
    ],
  });

  // ─── Listings ───────────────────────────────────────────────────────
  await prisma.listing.create({
    data: { displayId: "REC-1024", category: "Category A", risk: 88, status: "Flagged", sourceId: sourceAlpha.id, signals: ["Repeated identifier", "Abnormal pricing pattern", "Cross-source correlation"] },
  });
  await prisma.listing.create({
    data: { displayId: "REC-1017", category: "Category B", risk: 72, status: "Flagged", sourceId: sourceBeta.id, signals: ["Volume spike", "Known vendor alias"] },
  });

  // ─── Network graph ─────────────────────────────────────────────────
  const nodeDefs = [
    { key: "alias-x", label: "Alias_X", type: "ENTITY" as const, risk: 84, x: 420, y: 240, entityId: entities["ENT-001"].id },
    { key: "alias-y", label: "Alias_Y", type: "ENTITY" as const, risk: 71, x: 680, y: 180, entityId: entities["ENT-002"].id },
    { key: "market-a", label: "Marketplace_A", type: "MARKET" as const, risk: 72, x: 240, y: 340 },
    { key: "wallet-w1", label: "Wallet_W1", type: "WALLET" as const, risk: 87, x: 560, y: 350 },
    { key: "wallet-w2", label: "Wallet_W2", type: "WALLET" as const, risk: 74, x: 620, y: 480 },
    { key: "comm-04", label: "Comm_ID_04", type: "COMM" as const, risk: 62, x: 520, y: 130 },
  ];
  const nodes: Record<string, Awaited<ReturnType<typeof prisma.graphNode.create>>> = {};
  for (const n of nodeDefs) {
    nodes[n.key] = await prisma.graphNode.create({
      data: { label: n.label, type: n.type, risk: n.risk, x: n.x, y: n.y, entityId: n.entityId },
    });
  }
  const edgeDefs = [
    ["alias-x", "market-a", "Appeared On"],
    ["alias-x", "wallet-w1", "Transacted With"],
    ["alias-x", "comm-04", "Linked To"],
    ["wallet-w1", "wallet-w2", "Transacted With"],
    ["wallet-w1", "alias-y", "Associated With"],
  ] as const;
  for (const [from, to, label] of edgeDefs) {
    await prisma.graphEdge.create({ data: { fromId: nodes[from].id, toId: nodes[to].id, label } });
  }

  // ─── Audit log ──────────────────────────────────────────────────────
  await prisma.auditLogEntry.createMany({
    data: [
      { user: "Investigator A", action: "Generated Report", resource: "INV-042", ip: "10.0.1.47", type: "export" },
      { user: "Investigator A", action: "Added Evidence", resource: "EV-1029", ip: "10.0.1.47", type: "write" },
      { user: "Investigator A", action: "Viewed Entity", resource: "Alias_X", ip: "10.0.1.47", type: "read" },
      { user: "System", action: "Alert Generated", resource: "ALT-089", ip: "Internal", type: "system" },
    ],
  });

  console.log("Seed complete:");
  console.log(`  ${Object.keys(entities).length} entities, 3 networks, alerts, 1 full investigation (INV-2026-042)`);
  console.log(`  Try: POST /api/simulate/event { "networkDisplayId": "N-018" } to watch it cross to CRITICAL live.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
