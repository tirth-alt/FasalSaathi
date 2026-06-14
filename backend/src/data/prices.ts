/**
 * Deterministic daily mandi price generator for the demo. Produces ~30 days of
 * plausible modal prices (with min/max) per commodity per mandi, with a gentle
 * per-mandi trend so the forecast/momentum signal is non-trivial.
 *
 * Why generated (not a static table): keeping it seeded + deterministic gives
 * stable tests while still producing realistic-looking series for ~10 mandis ×
 * 30 days without hand-authoring hundreds of rows. The shape returned matches
 * what a real daily-Agmarknet table would yield, so the PriceRepository can swap
 * to a DB/CSV source later behind the same interface.
 *
 * Realistic anchors (₹/quintal): soybean ≈ 4500–5200, wheat ≈ 2400–2800.
 */

import { MANDIS } from '@/data/mandis.ts';

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

/** Supported commodities and their per-mandi base modal price band (₹/quintal). */
const COMMODITY_BASE: Record<string, { base: number; spread: number; dailyTrend: number }> = {
  // base = anchor modal price; spread = how much the per-mandi base varies;
  // dailyTrend = gentle ₹/day drift applied across the 30-day window.
  soybean: { base: 4800, spread: 350, dailyTrend: 8 },
  wheat: { base: 2600, spread: 150, dailyTrend: 3 },
};

const HISTORY_DAYS = 30;

/**
 * Tiny deterministic PRNG (mulberry32). Seeded per (commodity, mandi, day) so the
 * same inputs always yield the same price — stable across test runs and restarts.
 */
function seededNoise(seedStr: string): number {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  // mulberry32 step → float in [0, 1)
  let t = (h += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Stable per-mandi base price so each mandi trades at a slightly different level. */
function mandiBase(commodity: string, mandiId: string): number {
  const cfg = COMMODITY_BASE[commodity];
  if (!cfg) return 0;
  const offset = (seededNoise(`${commodity}:${mandiId}:base`) - 0.5) * 2 * cfg.spread;
  return Math.round(cfg.base + offset);
}

/**
 * Build the full 30-day series for one commodity at one mandi, ending today
 * (UTC). dayIndex 0 is the oldest day, HISTORY_DAYS-1 is today.
 */
function buildSeries(commodity: string, mandiId: string, today: Date): PricePoint[] {
  const cfg = COMMODITY_BASE[commodity];
  if (!cfg) return [];
  const base = mandiBase(commodity, mandiId);
  // Per-mandi trend direction multiplier in [-1, 1.5] → some mandis trend up,
  // some flat, some gently down, so momentum signals differ across the set.
  const trendMul = seededNoise(`${commodity}:${mandiId}:trend`) * 2.5 - 1;

  const points: PricePoint[] = [];
  for (let i = 0; i < HISTORY_DAYS; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - (HISTORY_DAYS - 1 - i));
    const dateStr = d.toISOString().slice(0, 10);

    const trendComponent = cfg.dailyTrend * trendMul * i;
    // Day-to-day jitter, ±~1.2% of base, deterministic per day.
    const jitter = (seededNoise(`${commodity}:${mandiId}:${dateStr}`) - 0.5) * 2 * (base * 0.012);
    const modal = Math.round(base + trendComponent + jitter);

    // min/max bracket the modal by a small realistic band.
    const halfBand = Math.round(base * 0.025);
    const min = modal - halfBand - Math.round(seededNoise(`${dateStr}:${mandiId}:min`) * 30);
    const max = modal + halfBand + Math.round(seededNoise(`${dateStr}:${mandiId}:max`) * 30);

    points.push({ date: dateStr, modal_price: modal, min_price: min, max_price: max });
  }
  return points;
}

/**
 * Generate the full price dataset: one MandiPriceSeries per (commodity, mandi).
 * `today` is injectable so tests can pin the date; defaults to now (UTC).
 */
export function generatePriceData(today: Date = new Date()): MandiPriceSeries[] {
  const out: MandiPriceSeries[] = [];
  for (const commodity of Object.keys(COMMODITY_BASE)) {
    for (const mandi of MANDIS) {
      out.push({
        mandi_id: mandi.mandi_id,
        commodity,
        series: buildSeries(commodity, mandi.mandi_id, today),
      });
    }
  }
  return out;
}

export const SUPPORTED_COMMODITIES = Object.keys(COMMODITY_BASE);
export const PRICE_HISTORY_DAYS = HISTORY_DAYS;
