/**
 * Price forecast — explainable, NOT a black box (spec §2).
 *
 * The forecast is computed from two transparent signals and always carries an
 * explicit range + human-readable drivers, never a bare number:
 *   1. Seasonal index — expected % change by horizon, keyed off the current month
 *      (post-harvest months trend up, pre-harvest flatter/down). Encoded here as a
 *      small stand-in table; in production this is the CEDA-derived 5–7yr seasonal
 *      index (we lack the CEDA history in this environment, so the table documents
 *      the shape the data-prep job will fill).
 *   2. Recent momentum — the 30-day slope of recent modal prices, scaled to the
 *      horizon and blended at 0.5 weight with a cap, so a sharp current move tilts
 *      the seasonal baseline without dominating it.
 *
 * The range (low_pct / high_pct) comes from the seasonal spread, widened by the
 * momentum magnitude and forecast uncertainty.
 *
 * TODO (v1 trained model): a TrainedForecastProvider plugs in behind this same
 * ForecastProvider interface once a historical daily-mandi-price dataset is
 * sourced. Features: recent multi-mandi price window + crop + month/seasonality +
 * weather/arrivals. Output stays a forecast WITH A RANGE → decision, never a bare
 * number. Routes depend only on ForecastProvider, so the swap touches nothing else.
 */

export interface PricePoint {
  date: string;
  modal_price: number;
  min_price?: number;
  max_price?: number;
}

export interface ForecastInput {
  commodity: string;
  horizonWeeks: number;
  /** Recent modal history (across one or more mandis), oldest → newest. */
  priceSeries: PricePoint[];
  /** Month-of-year (0 = Jan) the forecast is made in. Defaults to current month. */
  asOfMonth?: number;
  /**
   * Weather/quality-risk signal (spec §2 signal 3), derived from the live
   * Open-Meteo forecast for the farmer's location and injected by the /decision
   * route. Heavy rain → quality risk for open storage + possible supply swing →
   * WIDEN the range + add a risk driver; it does NOT move the centre. Absent when
   * weather is unavailable (the route degrades gracefully), in which case no
   * weather modifier is applied.
   */
  weatherRisk?: 'low' | 'med' | 'high';
  // Future (v1): arrivals, multi-mandi window.
}

export interface ForecastResult {
  horizon_weeks: number;
  expected_change_pct: number;
  low_pct: number;
  high_pct: number;
  drivers: string[];
  confidence: 'low' | 'medium' | 'high';
}

export interface ForecastProvider {
  forecast(input: ForecastInput): ForecastResult;
}

/**
 * Seasonal index stand-in (% change per 4-week month-offset), keyed by the month
 * the forecast is made in. Soybean is harvested Oct–Nov in MP, so post-harvest
 * months (Oct–Jan) carry a positive hold premium; pre-harvest months are flatter.
 * Each entry: { centre, spread } in % per ~4 weeks. spread → the seasonal range.
 *
 * STAND-IN for the CEDA-derived table — documented per spec §2.
 */
interface SeasonalCell {
  centre: number; // expected % change per ~4 weeks
  spread: number; // ± range in %
}

const SOYBEAN_SEASONAL: Record<number, SeasonalCell> = {
  0: { centre: 3, spread: 5 }, // Jan — post-harvest hold still paying
  1: { centre: 2, spread: 5 }, // Feb
  2: { centre: 1, spread: 5 }, // Mar
  3: { centre: 0, spread: 6 }, // Apr
  4: { centre: 0, spread: 6 }, // May
  5: { centre: -1, spread: 6 }, // Jun — pre-monsoon, flatter/soft
  6: { centre: -1, spread: 7 }, // Jul
  7: { centre: 0, spread: 7 }, // Aug
  8: { centre: -2, spread: 7 }, // Sep — new crop pressure approaching
  9: { centre: 4, spread: 6 }, // Oct — harvest; classic post-harvest rise begins
  10: { centre: 5, spread: 6 }, // Nov
  11: { centre: 4, spread: 5 }, // Dec
};

// Wheat is harvested Mar–Apr; its premium sits Apr–Jul. Coarser stand-in.
const WHEAT_SEASONAL: Record<number, SeasonalCell> = {
  0: { centre: 1, spread: 4 },
  1: { centre: 0, spread: 4 },
  2: { centre: -2, spread: 5 }, // Mar — harvest pressure
  3: { centre: 2, spread: 5 }, // Apr — post-harvest
  4: { centre: 3, spread: 5 },
  5: { centre: 3, spread: 5 },
  6: { centre: 2, spread: 4 },
  7: { centre: 1, spread: 4 },
  8: { centre: 1, spread: 4 },
  9: { centre: 1, spread: 4 },
  10: { centre: 0, spread: 4 },
  11: { centre: 1, spread: 4 },
};

const SEASONAL_TABLES: Record<string, Record<number, SeasonalCell>> = {
  soybean: SOYBEAN_SEASONAL,
  wheat: WHEAT_SEASONAL,
};

/** Default seasonal cell when commodity/month is unknown — neutral, wide range. */
const DEFAULT_CELL: SeasonalCell = { centre: 0, spread: 7 };

/** Momentum blend weight and cap (spec §2: 0.5 weight, capped). */
const MOMENTUM_WEIGHT = 0.5;
const MOMENTUM_CAP_PCT = 8; // momentum contribution capped at ±8% per horizon

/**
 * Estimate the recent daily slope as a % of the latest price, via a simple linear
 * least-squares fit over the series index. Returns % change per day.
 */
function recentDailySlopePct(series: PricePoint[]): number {
  const n = series.length;
  if (n < 2) return 0;
  const xs = series.map((_, i) => i);
  const ys = series.map((p) => p.modal_price);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i]! - meanX) * (ys[i]! - meanY);
    den += (xs[i]! - meanX) ** 2;
  }
  if (den === 0 || meanY === 0) return 0;
  const slopePerDay = num / den; // ₹/day
  return (slopePerDay / meanY) * 100; // %/day relative to mean price
}

export class SeasonalTrendForecastProvider implements ForecastProvider {
  forecast(input: ForecastInput): ForecastResult {
    const { commodity, horizonWeeks, priceSeries } = input;
    const month = input.asOfMonth ?? new Date().getUTCMonth();
    const monthOffsets = Math.max(1, horizonWeeks / 4); // ~4-week units

    const table = SEASONAL_TABLES[commodity.toLowerCase()];
    const cell = table?.[month] ?? DEFAULT_CELL;

    // Signal 1 — seasonal baseline scaled to the horizon.
    const seasonalChange = cell.centre * monthOffsets;
    const seasonalSpread = cell.spread * Math.sqrt(monthOffsets); // range grows sub-linearly

    // Signal 2 — recent momentum scaled to the horizon, weighted + capped.
    const dailyPct = recentDailySlopePct(priceSeries);
    const horizonDays = horizonWeeks * 7;
    let momentum = dailyPct * horizonDays * MOMENTUM_WEIGHT;
    momentum = Math.max(-MOMENTUM_CAP_PCT, Math.min(MOMENTUM_CAP_PCT, momentum));

    const expected = round1(seasonalChange + momentum);

    // Range: seasonal spread, widened by momentum magnitude (uncertainty rises
    // when current move is sharp), centred on expected.
    const widen = Math.min(4, Math.abs(momentum) * 0.5);
    // Signal 3 — weather/quality risk (live Open-Meteo, injected by the route).
    // Per spec §2: widen the range, DON'T move the centre. med = +2%, high = +5%.
    const weatherWiden = weatherWidenPct(input.weatherRisk);
    const halfRange = round1(seasonalSpread + widen + weatherWiden);
    const low = round1(expected - halfRange);
    const high = round1(expected + halfRange);

    const drivers = buildDrivers(cell.centre, dailyPct, input.weatherRisk);
    const confidence = pickConfidence(priceSeries.length, halfRange, !!table);

    return {
      horizon_weeks: horizonWeeks,
      expected_change_pct: expected,
      low_pct: low,
      high_pct: high,
      drivers,
      confidence,
    };
  }
}

/** Weather range-widening (% half-range) by quality_risk band. Centre unchanged. */
function weatherWidenPct(risk: 'low' | 'med' | 'high' | undefined): number {
  if (risk === 'high') return 5;
  if (risk === 'med') return 2;
  return 0; // 'low' or absent (weather unavailable) → no widening
}

function buildDrivers(
  seasonalCentre: number,
  dailyPct: number,
  weatherRisk: 'low' | 'med' | 'high' | undefined,
): string[] {
  const drivers: string[] = [];
  if (seasonalCentre > 1) {
    drivers.push('seasonal post-harvest rise');
  } else if (seasonalCentre < -0.5) {
    drivers.push('seasonal pre-harvest / new-crop pressure');
  } else {
    drivers.push('flat seasonal baseline');
  }

  if (dailyPct > 0.05) {
    drivers.push('upward 30-day price trend');
  } else if (dailyPct < -0.05) {
    drivers.push('downward 30-day price trend');
  } else {
    drivers.push('stable recent prices');
  }

  // Signal 3 — live weather/quality risk for open storage (Open-Meteo, injected
  // by the route). Replaces the old seasonal-month monsoon STAND-IN: this reflects
  // the ACTUAL rain forecast at the farmer's location, not a calendar guess.
  if (weatherRisk === 'high') {
    drivers.push('heavy rain forecast — high quality risk for open storage');
  } else if (weatherRisk === 'med') {
    drivers.push('rain forecast — moderate quality risk for open storage');
  }
  return drivers;
}

function pickConfidence(
  seriesLen: number,
  halfRange: number,
  haveSeasonalTable: boolean,
): 'low' | 'medium' | 'high' {
  if (!haveSeasonalTable || seriesLen < 7) return 'low';
  if (halfRange > 9) return 'low';
  if (halfRange > 5) return 'medium';
  return 'high';
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
