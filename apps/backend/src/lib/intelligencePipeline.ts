// src/lib/intelligencePipeline.ts
//
// The real pipeline behind both the manual "Simulate Incoming
// Intelligence" button (routes/simulate.ts) and, going forward, the real
// push-ingestion endpoint (routes/ingest.ts):
//
//   entity correlation -> network risk recalculated -> risk point
//   recorded -> threshold check -> alert created if crossed -> wallet
//   evidence recorded -> everything broadcast live over Socket.IO.
//
// This is routes/simulate.ts's original pipeline body, unchanged in
// behavior, with one addition: the wallet step (see "Wallet" below).
// Pulled out so the ingestion endpoint doesn't have to duplicate this
// logic — it will call the exact same function once it exists.
//
// What the CALLER is still responsible for (kept here on purpose,
// deliberately NOT absorbed into this function, because the two callers
// disagree on it):
//   - Resolving/creating the `network` and `entity` rows themselves.
//     The button picks an existing entity; real ingestion will create
//     new ones as vendors are first observed.
//   - The cosmetic "event_detected" emit and its type/description text —
//     the button alternates a label deterministically; real ingestion
//     will just describe the real event.
//   - The "action" audit log entry for the outer request (e.g.
//     "Simulated Incoming Intelligence" vs. a future "Live Intelligence
//     Ingested") — only the ALERT-specific audit entry below stays in
//     this file, since it's intrinsic to what this function just did,
//     not to who called it.
//
// Wallet: attributes this event to the entity's most recently observed
// REAL listing (never an invented one) so the transaction amount is
// always traceable to an actual row. If the entity has no listing
// evidence yet, priceUsd is null and processWalletForListing() records
// a 0 BTC-eq transaction rather than skipping the event — see that
// file's header for why. No wallet step runs at all when there's no
// entity, since a wallet can't be honestly attributed to nobody.

import type { Alert, Entity, Network, RiskEvent, Wallet, WalletTransaction } from "@prisma/client";
import { prisma } from "./prisma.js";
import { getIo } from "../sockets/io.js";
import { computeSimulateScoreDelta } from "./riskEngine.js";
import { riskToStatus, RISK_THRESHOLDS } from "./riskStatus.js";
import { computeVendorRisk } from "./vendorRisk.js";
import { computeEntityRisk } from "./entityRisk.js";
import { correlateListings, getCorrelationForAlias, normalizeVendorAlias } from "./entityCorrelation.js";
import type { ListingInput } from "./riskEngine.js";
import { processWalletForListing } from "./walletUpdate.js";
import { logAudit } from "./audit.js";

export interface IntelligencePipelineInput {
  network: Network;
  entity: Entity | null;
  triggerType: string; // e.g. "listing_detected" | "transaction_detected"
  triggerDescription: string; // human-readable, used in the RiskEvent/Alert text
  ip: string; // for the Alert-Generated audit entry
}

export interface CorrelationSummary {
  entity: string;
  confidence: number;
  method: string;
}

export interface RiskChangeSummary {
  previousRisk: number;
  currentRisk: number;
  change: number;
  trigger: string;
  correlation: CorrelationSummary | null;
  alertGenerated: boolean;
}

export interface WalletUpdateSummary {
  wallet: Wallet;
  transaction: WalletTransaction;
}

export interface IntelligencePipelineResult {
  riskEvent: RiskEvent;
  network: Network; // updated
  alert: Alert | null;
  deltaInputSource: "computed" | "legacy" | "none";
  riskChange: RiskChangeSummary;
  wallet: WalletUpdateSummary | null;
}

export async function runIntelligencePipeline(
  input: IntelligencePipelineInput
): Promise<IntelligencePipelineResult> {
  const { network, entity, triggerType, triggerDescription, ip } = input;

  const io = getIo();
  const emit = (type: string, payload: unknown) =>
    io.emit("intelligence-event", { type, payload, at: new Date() });

  let deltaInput: { risk: number; confidence: number } | null = null;
  let deltaInputSource: "computed" | "legacy" | "none" = "none";
  let correlationSummary: CorrelationSummary | null = null;
  let wallet: WalletUpdateSummary | null = null;

  if (entity) {
    // Listings loaded once, reused for correlation, risk, AND (new) the
    // wallet step's "most recent real listing" lookup below.
    const listings = await prisma.listing.findMany();
    const inputs: ListingInput[] = listings.map((l) => ({
      id: l.id,
      category: l.category,
      title: l.title,
      priceUsd: l.priceUsd,
      marketplace: l.marketplace,
      vendorAlias: l.vendorAlias,
      firstSeen: l.firstSeen,
      lastSeen: l.lastSeen,
      shipsFrom: l.shipsFrom,
    }));

    const correlationGroup = getCorrelationForAlias(entity.alias, correlateListings(inputs));
    correlationSummary = {
      entity: entity.alias,
      confidence: correlationGroup?.confidence ?? entity.confidence,
      method: correlationGroup?.method ?? "none",
    };
    emit("correlation", {
      entity: entity.alias,
      confidence: correlationSummary.confidence,
      method: correlationSummary.method,
      matchedSignals: correlationGroup?.matchedSignals ?? [],
    });

    const vendorRiskByAlias = computeVendorRisk(inputs);
    const computed = computeEntityRisk(entity.alias, vendorRiskByAlias);
    if (computed.risk !== null && computed.confidence !== null) {
      deltaInput = { risk: computed.risk, confidence: computed.confidence };
      deltaInputSource = "computed";
    } else {
      deltaInput = { risk: entity.risk, confidence: entity.confidence };
      deltaInputSource = "legacy";
    }

    // ── Wallet step (new) ──────────────────────────────────────────────
    const normalizedAlias = normalizeVendorAlias(entity.alias);
    const ownListings = listings.filter(
      (l) => normalizeVendorAlias(l.vendorAlias ?? "") === normalizedAlias
    );
    const mostRecentOwnListing =
      ownListings.length > 0
        ? ownListings.reduce((latest, l) => (l.lastSeen > latest.lastSeen ? l : latest))
        : null;

    wallet = await processWalletForListing({
      vendorAlias: entity.alias,
      entityId: entity.id,
      networkId: network.id,
      priceUsd: mostRecentOwnListing?.priceUsd ?? null,
    });
    emit("wallet_updated", {
      wallet: wallet.wallet.displayId,
      entity: entity.alias,
      transactionId: wallet.transaction.id,
      amountBtcEq: wallet.transaction.amountBtcEq,
      direction: wallet.transaction.direction,
    });
  }
  // else: no entity at all — preserves the original behavior of not
  // emitting a correlation event, and now also skips the wallet step
  // (nothing to honestly attribute a wallet to).

  const { delta: scoreDelta, explanation: deltaExplanation } = computeSimulateScoreDelta(deltaInput);
  const newNetworkRisk = Math.min(100, network.risk + scoreDelta);
  const status = riskToStatus(newNetworkRisk);

  const riskEvent = await prisma.riskEvent.create({
    data: {
      entityId: entity ? entity.id : undefined,
      type: triggerType,
      description: `${triggerDescription} — ${deltaExplanation} (delta input: ${deltaInputSource})`,
      scoreDelta,
    },
  });

  const updatedNetwork = await prisma.network.update({
    where: { id: network.id },
    data: {
      risk: newNetworkRisk,
      change: newNetworkRisk - network.risk,
      status,
      lastActivity: new Date(),
    },
  });

  await prisma.networkRiskPoint.create({
    data: { networkId: network.id, label: new Date().toISOString(), score: newNetworkRisk },
  });

  emit("risk_updated", { network: network.displayId, from: network.risk, to: newNetworkRisk });

  // Threshold check -> alert generation (the "killer moment")
  let alert: Alert | null = null;
  if (network.risk < RISK_THRESHOLDS.CRITICAL && newNetworkRisk >= RISK_THRESHOLDS.CRITICAL) {
    const count = await prisma.alert.count();
    alert = await prisma.alert.create({
      data: {
        displayId: `ALT-${100 + count}`,
        severity: newNetworkRisk,
        title: `Network ${network.displayId} crossed critical risk threshold`,
        reason: `Risk escalated to ${newNetworkRisk} following ${triggerDescription.toLowerCase()} and entity correlation`,
        status: "NEW",
        networkId: network.id,
        ...(entity ? { entities: { create: { entityId: entity.id } } } : {}),
      },
    });
    emit("alert_generated", alert);
    await logAudit({
      user: "System",
      action: "Alert Generated",
      resource: alert.displayId,
      type: "system",
      ip,
    });
  }

  const riskChange: RiskChangeSummary = {
    previousRisk: network.risk,
    currentRisk: newNetworkRisk,
    change: scoreDelta,
    trigger: triggerDescription,
    correlation: correlationSummary,
    alertGenerated: alert !== null,
  };

  return { riskEvent, network: updatedNetwork, alert, deltaInputSource, riskChange, wallet };
}
