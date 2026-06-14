/**
 * Store-vs-sell arithmetic (spec §2). Pure function — the same deterministic math
 * the on-device app runs in airplane mode. Given today's price, quantity, and a
 * ForecastResult, decide SELL vs STORE and show the full workings.
 *
 *   expected_future_price = today_price * (1 + expected_change_pct/100)
 *   store_gain = (expected_future_price - today_price) * qty
 *              - storage_per_q_month * months * qty
 *              - interest_rate * (LTV * today_price * qty) * (months/12)
 *   recommendation = SELL if store_gain <= 0 OR cash_need forces sale, else STORE
 *
 * The interest term models the cost of an eNWR pledge loan taken against stored
 * grain (you borrow LTV × value and pay interest for the holding period).
 */

import type { ForecastResult } from '@/lib/forecast.ts';

// eNWR loan / storage constants (spec §5 — these are constants, not an API).
export const ENWR_LTV = 0.7; // loan-to-value of pledged grain
export const ENWR_INTEREST_RATE_ANNUAL = 0.1; // 10% per year
export const STORAGE_PER_QUINTAL_MONTH = 20; // ₹/quintal/month

export interface DecisionInput {
  todayPrice: number; // ₹/quintal
  quantityQuintal: number;
  forecast: ForecastResult;
  horizonWeeks: number;
  /** Cash the farmer needs now (₹). Forces a sell if the pledge loan can't cover it. */
  cashNeedInr?: number;
}

export interface DecisionResult {
  recommendation: 'STORE' | 'SELL';
  today_price: number;
  sell_now_inr: number;
  expected_future_price: number;
  store_gain_inr: number;
  /** Weeks until store_gain crosses zero, if the forecast is positive. */
  breakeven_weeks: number | null;
  forecast: ForecastResult;
  risks: string[];
}

function weeksToMonths(weeks: number): number {
  return weeks / 4.345; // average weeks per month
}

/** Net store gain (₹) for a given horizon in weeks. */
function storeGainFor(
  todayPrice: number,
  qty: number,
  expectedChangePct: number,
  weeks: number,
): number {
  const months = weeksToMonths(weeks);
  const expectedFuturePrice = todayPrice * (1 + expectedChangePct / 100);
  const priceGain = (expectedFuturePrice - todayPrice) * qty;
  const storageCost = STORAGE_PER_QUINTAL_MONTH * months * qty;
  const interestCost =
    ENWR_INTEREST_RATE_ANNUAL * (ENWR_LTV * todayPrice * qty) * (months / 12);
  return priceGain - storageCost - interestCost;
}

export function computeDecision(input: DecisionInput): DecisionResult {
  const { todayPrice, quantityQuintal: qty, forecast, horizonWeeks, cashNeedInr } = input;

  const sellNow = Math.round(todayPrice * qty);
  const expectedFuturePrice = Math.round(
    todayPrice * (1 + forecast.expected_change_pct / 100),
  );
  const storeGain = Math.round(
    storeGainFor(todayPrice, qty, forecast.expected_change_pct, horizonWeeks),
  );

  // Pledge loan available against the stored grain. If the farmer's cash need
  // exceeds what they can borrow while holding, they must sell now.
  const pledgeLoanAvailable = ENWR_LTV * todayPrice * qty;
  const cashForcesSale = cashNeedInr !== undefined && cashNeedInr > pledgeLoanAvailable;

  const recommendation: 'STORE' | 'SELL' =
    storeGain <= 0 || cashForcesSale ? 'SELL' : 'STORE';

  const risks = buildRisks(forecast, cashForcesSale, cashNeedInr, pledgeLoanAvailable);
  const breakeven = breakevenWeeks(todayPrice, qty, forecast.expected_change_pct);

  return {
    recommendation,
    today_price: todayPrice,
    sell_now_inr: sellNow,
    expected_future_price: expectedFuturePrice,
    store_gain_inr: storeGain,
    breakeven_weeks: breakeven,
    forecast,
    risks,
  };
}

/**
 * Smallest whole-week horizon (1–52) at which store_gain turns positive, given
 * the expected change applies pro-rata. null if it never does (non-positive
 * forecast) within a year.
 */
function breakevenWeeks(
  todayPrice: number,
  qty: number,
  expectedChangePct: number,
): number | null {
  if (expectedChangePct <= 0) return null;
  for (let w = 1; w <= 52; w++) {
    // Assume the expected change accrues pro-rata to the horizon it was quoted at.
    // Here we approximate the per-week change as expectedChangePct spread over the
    // standard 4-week quote, scaled linearly — enough for a directional breakeven.
    const proRataPct = (expectedChangePct / 4) * w;
    if (storeGainFor(todayPrice, qty, proRataPct, w) > 0) return w;
  }
  return null;
}

function buildRisks(
  forecast: ForecastResult,
  cashForcesSale: boolean,
  cashNeedInr: number | undefined,
  pledgeLoanAvailable: number,
): string[] {
  const risks: string[] = [];

  // A range that crosses zero means storing could lose money.
  if (forecast.low_pct < 0 && forecast.high_pct > 0) {
    risks.push('forecast range crosses zero — price could fall while stored');
  }
  // Wide range = high uncertainty.
  if (forecast.high_pct - forecast.low_pct > 14) {
    risks.push('wide forecast range — high price uncertainty');
  }
  if (forecast.confidence === 'low') {
    risks.push('low forecast confidence');
  }
  if (cashForcesSale) {
    risks.push(
      `immediate cash need (₹${Math.round(cashNeedInr ?? 0)}) exceeds pledge-loan availability (₹${Math.round(pledgeLoanAvailable)}) — must sell now`,
    );
  }
  // Carry weather/quality drivers from the forecast into the decision risks.
  for (const d of forecast.drivers) {
    if (/risk|monsoon|rain/i.test(d)) risks.push(d);
  }
  return risks;
}
