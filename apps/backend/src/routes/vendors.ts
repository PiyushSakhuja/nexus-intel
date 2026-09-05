import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { computeVendorRisk } from "../lib/vendorRisk.js";
import type { ListingInput } from "../lib/riskEngine.js";

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
vendorsRouter.get("/", async (_req, res) => {
  const inputs = await loadListingInputs();
  const vendors = Array.from(computeVendorRisk(inputs).values()).sort((a, b) => b.risk - a.risk);
  res.json(vendors);
});

// GET /api/vendors/:vendorAlias — single vendor profile
vendorsRouter.get("/:vendorAlias", async (req, res) => {
  const inputs = await loadListingInputs();
  const vendor = computeVendorRisk(inputs).get(req.params.vendorAlias);
  if (!vendor) return res.status(404).json({ error: "Vendor not found" });
  res.json(vendor);
});