import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { computeVendorRisk } from "../lib/vendorRisk.js";
import { normalizeVendorAlias } from "../lib/entityCorrelation.js";
import type { ListingInput } from "../lib/riskEngine.js";
import { logAudit, ipFromRequest } from "../lib/audit.js";

export const vendorsRouter = Router();

async function loadListingInputs(): Promise<ListingInput[]> {
  const listings = await prisma.listing.findMany();
  return listings.map((l) => ({
    id: l.id,
    category: l.category,
    title: l.title,
    priceUsd: l.priceUsd,
    marketplace: l.marketplace,
    vendorAlias: l.vendorAlias,
    shipsFrom: l.shipsFrom,
    firstSeen: l.firstSeen,
    lastSeen: l.lastSeen,
  }));
}

// GET /api/vendors — vendor-level intelligence, derived at request time
// from Listing rows (same pattern as GET /api/listings: no stored/cached
// vendor table, riskEngine-backed computation stays the single source of
// truth — see lib/vendorRisk.ts).
//
// vendorAlias is the correlation key. This is ALIAS CORRELATION, not
// identity resolution — see lib/vendorRisk.ts for the full caveat.
vendorsRouter.get("/", async (req, res) => {
  const inputs = await loadListingInputs();
  const vendors = Array.from(computeVendorRisk(inputs).values()).sort((a, b) => b.risk - a.risk);

  await logAudit({
    user: "System",
    action: "Viewed Vendors List",
    resource: `${vendors.length} vendors`,
    type: "read",
    ip: ipFromRequest(req),
  });

  res.json(vendors);
});

// GET /api/vendors/:vendorAlias — single vendor profile
vendorsRouter.get("/:vendorAlias", async (req, res) => {
  const inputs = await loadListingInputs();
  const vendor = computeVendorRisk(inputs).get(normalizeVendorAlias(req.params.vendorAlias));
  if (!vendor) return res.status(404).json({ error: "Vendor not found" });

  await logAudit({
    user: "System",
    action: "Viewed Vendor",
    resource: vendor.vendorAlias,
    type: "read",
    ip: ipFromRequest(req),
  });

  res.json(vendor);
});