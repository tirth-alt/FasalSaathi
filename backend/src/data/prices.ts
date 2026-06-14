/**
 * Committed synthetic mandi-price dataset (typed accessor).
 *
 * The data lives in `prices.generated.json` — a SAVED, deterministic snapshot
 * shaped like real June Agmarknet (data.gov.in) daily modal prices. It is the
 * source of truth ("this is what the gov API returned"): the app loads it as-is
 * and NEVER regenerates at runtime.
 *
 * The JSON is produced by `scripts/gen-prices.ts` (run: `npx tsx
 * scripts/gen-prices.ts`). Re-running that script yields byte-identical output
 * (seeded PRNG), so the committed file and a fresh generation always agree.
 *
 * Shape: one series per (commodity, mandi). Each series covers the 30 calendar
 * days ending 2026-06-13 inclusive, with SUNDAYS ABSENT (APMC mandis are closed
 * on Sundays → the series has gaps). Dates are oldest → newest; the latest entry
 * is the Saturday 2026-06-13. Prices are integers in ₹/quintal.
 *
 * This is served behind the PriceRepository interface (see lib/repositories.ts),
 * so a DB/CSV/live-Agmarknet-backed implementation can swap in later with no
 * route changes.
 */

import pricesJson from '@/data/prices.generated.json';

export interface PricePoint {
  date: string; // ISO date (YYYY-MM-DD)
  modal_price: number;
  min_price: number;
  max_price: number;
}

export interface MandiPriceSeries {
  mandi_id: string;
  commodity: string;
  series: PricePoint[];
}

/** The committed dataset: one series per (commodity, mandi). */
export const PRICE_DATA: MandiPriceSeries[] = pricesJson as MandiPriceSeries[];

/** Provenance label for the dataset (surfaced by /prices/history as `source`). */
export const PRICE_SOURCE = 'Agmarknet (data.gov.in)';

/** Distinct commodities present in the dataset. */
export const SUPPORTED_COMMODITIES: string[] = [
  ...new Set(PRICE_DATA.map((s) => s.commodity)),
];

/** Longest series length in the dataset (max trading days available). */
export const PRICE_HISTORY_DAYS: number = PRICE_DATA.reduce(
  (max, s) => Math.max(max, s.series.length),
  0,
);
