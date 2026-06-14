/**
 * Per-mandi decision CARD (F2 flashcard, matches output_format.md). Builds the
 * frontend-facing card from a pure DecisionResult + the mandi's geo. Kept OUT of
 * the route so the curve construction (a v0 stand-in) is isolated: when the v1
 * trained model replaces the forecaster behind the same ForecastProvider
 * interface, the card/curve consume its ForecastResult unchanged — no route edits.
 *
 * All money values are integers (₹). `decision` maps STORE → "HOLD".
 */

import type { DecisionResult } from '@/lib/decision.ts';
import { maxHoldDays } from '@/lib/decision.ts';

/** Forecast horizon for the rendered price curve (days). */
export const CURVE_DAYS = 45;

export interface CurvePoint {
  day: number;
  price: number;
  low: number;
  high: number;
}

export interface MandiCard {
  mandi_id: string;
  mandi_name: string;
  district: string;
  state: string;
  /** Distance from the farm, km (1 decimal). null when not derivable. */
  distance_km: number | null;
  decision: 'HOLD' | 'SELL';
  wait_days: { best: number; range: [number, number] };
  /** Days from today to the best expected sale. */
  good_sale_window_day: number;
  /** Crop shelf-life cap (days) — the ceiling on the hold advice. */
  max_hold_days: number;
  quantity_qtl: number;
  confidence: 'high' | 'low';
  per_quintal: {
    sell_now: number;
    expected_at_D: { mid: number; range: [number, number] };
    storage_cost: number;
    expected_gain: number;
  };
  total: {
    sell_now: number;
    expected_at_D: { mid: number; range: [number, number] };
    storage_cost: number;
    expected_gain: number;
  };
  curve: CurvePoint[];
}

export interface MandiGeo {
  mandi_id: string;
  name: string;
  district: string;
  state: string;
  /** Distance from the farm in km, if the mandi set was derived from a location. */
  distance_km?: number;
}

/**
 * Build the day-1..CURVE_DAYS price curve deterministically from the forecast.
 * Shape: anchor day 1 at `sellNow`, trend linearly toward `midAtD` by the
 * good-sale day, then flatten to the horizon end. The low/high band widens over
 * time from a tight day-1 spread out to the forecast's full low_pct/high_pct band
 * at the good-sale day, and holds that width to the end.
 *
 * This is a v0 stand-in: the v1 model can emit a real path, consumed here the
 * same way. No model assumptions are hard-wired beyond the ForecastResult fields.
 */
export function buildCurve(params: {
  sellNow: number;
  midAtD: number;
  lowPct: number;
  highPct: number;
  goodSaleDay: number;
}): CurvePoint[] {
  const { sellNow, midAtD, lowPct, highPct } = params;
  // Clamp the good-sale day into the rendered window so the trend/flatten split
  // is always well-defined.
  const goodSaleDay = Math.max(1, Math.min(CURVE_DAYS, Math.round(params.goodSaleDay)));

  const curve: CurvePoint[] = [];
  for (let day = 1; day <= CURVE_DAYS; day++) {
    // Centre: linear from sellNow (day 1) to midAtD (good-sale day), then flat.
    const t = day <= goodSaleDay ? (day - 1) / Math.max(1, goodSaleDay - 1) : 1;
    const price = Math.round(sellNow + (midAtD - sellNow) * t);

    // Band: widen from ~0 at day 1 to the full forecast band by the good-sale
    // day, then hold. Width is expressed as a fraction of the day's centre price.
    const bandT = day <= goodSaleDay ? day / goodSaleDay : 1;
    const low = Math.round(price * (1 + (lowPct / 100) * bandT));
    const high = Math.round(price * (1 + (highPct / 100) * bandT));

    curve.push({ day, price, low, high });
  }
  return curve;
}

/**
 * Map the forecaster's three-level confidence onto the card's two-level scale.
 * output_format.md allows only "high"/"low" (low = unfamiliar mandi / high
 * uncertainty). medium is still a familiar, data-backed mandi → "high".
 */
function cardConfidence(c: 'low' | 'medium' | 'high'): 'high' | 'low' {
  return c === 'low' ? 'low' : 'high';
}

/**
 * Days from today to the best expected sale. For HOLD, the soonest profitable
 * week (breakeven) scaled to days, capped at the horizon and shelf-life; for
 * SELL, day 1 (sell now). Falls back to the full horizon when no breakeven.
 */
function goodSaleDay(
  decision: DecisionResult,
  horizonWeeks: number,
  shelfLifeDays: number,
): number {
  if (decision.recommendation === 'SELL') return 1;
  const horizonDays = horizonWeeks * 7;
  const fromBreakeven = decision.breakeven_weeks !== null ? decision.breakeven_weeks * 7 : horizonDays;
  return Math.max(1, Math.min(fromBreakeven, horizonDays, shelfLifeDays));
}

/**
 * Assemble a per-mandi card from a DecisionResult priced for THAT mandi. Money is
 * kept as integers; `total` = per_quintal × quantity.
 */
export function buildMandiCard(params: {
  decision: DecisionResult;
  geo: MandiGeo;
  commodity: string;
  quantityQtl: number;
  horizonWeeks: number;
}): MandiCard {
  const { decision, geo, commodity, quantityQtl, horizonWeeks } = params;
  const forecast = decision.forecast;

  const sellNow = decision.today_price; // ₹/quintal, integer
  const mid = decision.expected_future_price; // ₹/quintal, integer
  const expLow = Math.round(sellNow * (1 + forecast.low_pct / 100));
  const expHigh = Math.round(sellNow * (1 + forecast.high_pct / 100));

  // Per-quintal holding cost, then derive the gain from the card's OWN displayed
  // components so the identity always holds exactly for the frontend:
  //   expected_gain = (mid - sell_now) - storage_cost
  // (Deriving gain from the rounded aggregate store_gain_inr can drift ±1 because
  // mid and the total gain are rounded independently.)
  const storagePerQ = Math.round(decision.holding_cost_inr / quantityQtl);
  const gainPerQ = mid - sellNow - storagePerQ;

  const shelfLife = maxHoldDays(commodity);
  const saleDay = goodSaleDay(decision, horizonWeeks, shelfLife);

  const curve = buildCurve({
    sellNow,
    midAtD: mid,
    lowPct: forecast.low_pct,
    highPct: forecast.high_pct,
    goodSaleDay: saleDay,
  });

  // wait_days range brackets the good-sale day (±~25%, clamped to >= 0).
  const lo = Math.max(0, Math.round(saleDay * 0.75));
  const hi = Math.round(saleDay * 1.25);

  const q = quantityQtl;
  return {
    mandi_id: geo.mandi_id,
    mandi_name: geo.name,
    district: geo.district,
    state: geo.state,
    distance_km: geo.distance_km ?? null,
    decision: decision.recommendation === 'STORE' ? 'HOLD' : 'SELL',
    wait_days: { best: saleDay, range: [lo, hi] },
    good_sale_window_day: saleDay,
    max_hold_days: shelfLife,
    quantity_qtl: q,
    confidence: cardConfidence(forecast.confidence),
    per_quintal: {
      sell_now: sellNow,
      expected_at_D: { mid, range: [expLow, expHigh] },
      storage_cost: storagePerQ,
      expected_gain: gainPerQ,
    },
    total: {
      sell_now: sellNow * q,
      expected_at_D: { mid: mid * q, range: [expLow * q, expHigh * q] },
      storage_cost: storagePerQ * q,
      expected_gain: gainPerQ * q,
    },
    curve,
  };
}
