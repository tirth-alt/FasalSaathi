/**
 * Synthetic mandi-price dataset generator (run on demand):
 *   npx tsx scripts/gen-prices.ts
 *
 * Builds a COMMITTED, deterministic dataset that looks like real June Agmarknet
 * (data.gov.in) daily modal prices and WRITES it to:
 *   src/data/prices.generated.json
 *
 * That JSON is the saved source of truth ("this is what the gov API returned").
 * FixturePriceRepository imports it directly — the app NEVER regenerates at
 * runtime. Re-running this script yields byte-identical output (seeded PRNG), so
 * the committed file and a fresh run always agree.
 *
 * Dataset shape (per spec):
 *   - For EVERY mandi (MP + Nashik) × EVERY commodity below, a daily series over
 *     the 30 calendar days ENDING 2026-06-13 (inclusive).
 *   - SUNDAYS ARE SKIPPED — APMC mandis are closed on Sunday, so the series has
 *     gaps. 2026-06-14 is a Sunday and is NOT included; latest entry is the
 *     Saturday 2026-06-13.
 *   - Each entry: { date, modal_price, min_price, max_price } — integers, ₹/qtl.
 *   - Realistic June price bands with a deterministic per-mandi offset (±~6%), a
 *     gentle trend across the window, and per-day volatility per the table below.
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { MANDIS } from '../src/data/mandis.ts';

interface PricePoint {
  date: string; // YYYY-MM-DD
  modal_price: number;
  min_price: number;
  max_price: number;
}

interface MandiPriceSeries {
  mandi_id: string;
  commodity: string;
  series: PricePoint[];
}

/**
 * Per-commodity price model (₹/quintal). `base` is the anchor modal price;
 * `volatility` is the day-to-day jitter as a fraction of base; `trendPct` is the
 * total gentle drift applied linearly across the whole 30-day window (per-mandi
 * sign/magnitude is scaled by a seeded factor so mandis don't all move together).
 * Commodity keys are EXACTLY the spec set.
 */
const COMMODITIES: Record<string, { base: number; volatility: number; trendPct: number }> = {
  onion: { base: 1600, volatility: 0.04, trendPct: 0.06 }, // volatile
  tomato: { base: 1850, volatility: 0.06, trendPct: 0.08 }, // very volatile
  soybean: { base: 4500, volatility: 0.015, trendPct: 0.03 },
  maize: { base: 2150, volatility: 0.015, trendPct: 0.02 },
  wheat: { base: 2650, volatility: 0.01, trendPct: 0.015 },
  bajra: { base: 2500, volatility: 0.015, trendPct: 0.02 },
  gram: { base: 5400, volatility: 0.012, trendPct: 0.02 },
  pomegranate: { base: 6000, volatility: 0.03, trendPct: 0.04 },
};

/** Last trading day of the window (Saturday). The window is the 30 calendar days ending here, inclusive. */
const END_DATE = '2026-06-13';
const WINDOW_CALENDAR_DAYS = 30;

/** Per-mandi base offset magnitude: ±~6% of the commodity base. */
const MANDI_OFFSET_PCT = 0.06;
/** min/max band half-width around modal: ~3%. */
const MINMAX_BAND_PCT = 0.03;

/**
 * Tiny deterministic PRNG (mulberry32-style hash → float in [0, 1)). Seeded per
 * string so identical seeds always yield identical output — stable across runs.
 */
function seededUnit(seedStr: string): number {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let t = (h += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Signed deterministic noise in [-1, 1). */
function seededSigned(seedStr: string): number {
  return seededUnit(seedStr) * 2 - 1;
}

/** All calendar dates (YYYY-MM-DD) in the window, EXCLUDING Sundays, oldest → newest. */
function tradingDates(): string[] {
  const end = new Date(`${END_DATE}T00:00:00Z`);
  const dates: string[] = [];
  for (let i = WINDOW_CALENDAR_DAYS - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i);
    if (d.getUTCDay() === 0) continue; // 0 = Sunday → mandi closed, skip
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

/** Stable per-mandi base modal price (anchor + seeded ±~6% offset). */
function mandiBase(commodity: string, base: number, mandiId: string): number {
  const offset = seededSigned(`${commodity}|${mandiId}|base`) * base * MANDI_OFFSET_PCT;
  return base + offset;
}

function buildSeries(commodity: string, mandiId: string, dates: string[]): PricePoint[] {
  const cfg = COMMODITIES[commodity]!;
  const base = mandiBase(commodity, cfg.base, mandiId);

  // Per-mandi trend direction/magnitude in [-1, 1.4): some up, some flat, some
  // down, so momentum signals differ across the mandi set. Trend is applied
  // linearly from 0 (oldest) to full trendPct (newest).
  const trendMul = seededUnit(`${commodity}|${mandiId}|trend`) * 2.4 - 1;
  const lastIdx = Math.max(1, dates.length - 1);

  return dates.map((date, i) => {
    const trendFactor = (i / lastIdx) * cfg.trendPct * trendMul;
    const jitter = seededSigned(`${commodity}|${mandiId}|${date}`) * cfg.volatility;
    const modal = Math.round(base * (1 + trendFactor + jitter));

    // min/max bracket modal by ~3% ± a small seeded wiggle, clamped to order.
    const minWiggle = seededUnit(`${commodity}|${mandiId}|${date}|min`) * 0.01;
    const maxWiggle = seededUnit(`${commodity}|${mandiId}|${date}|max`) * 0.01;
    const min = Math.round(modal * (1 - MINMAX_BAND_PCT - minWiggle));
    const max = Math.round(modal * (1 + MINMAX_BAND_PCT + maxWiggle));

    return { date, modal_price: modal, min_price: min, max_price: max };
  });
}

function generate(): MandiPriceSeries[] {
  const dates = tradingDates();
  const out: MandiPriceSeries[] = [];
  // Commodity-major, then mandi — stable, readable ordering in the committed file.
  for (const commodity of Object.keys(COMMODITIES)) {
    for (const mandi of MANDIS) {
      out.push({ mandi_id: mandi.mandi_id, commodity, series: buildSeries(commodity, mandi.mandi_id, dates) });
    }
  }
  return out;
}

function main(): void {
  const data = generate();
  const dates = tradingDates();
  const totalRows = data.reduce((n, s) => n + s.series.length, 0);

  const outPath = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/prices.generated.json');
  writeFileSync(outPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

  // eslint-disable-next-line no-console
  console.log(
    [
      `Wrote ${outPath}`,
      `commodities: ${Object.keys(COMMODITIES).length}`,
      `mandis: ${MANDIS.length}`,
      `trading days: ${dates.length} (${dates[0]} … ${dates[dates.length - 1]}, Sundays skipped)`,
      `series: ${data.length}`,
      `total rows: ${totalRows}`,
    ].join('\n'),
  );
}

main();
