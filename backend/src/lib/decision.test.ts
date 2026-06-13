import { describe, it, expect } from 'vitest';
import { computeDecision } from '@/lib/decision.ts';
import type { ForecastResult } from '@/lib/forecast.ts';

function forecast(expected: number, low = expected - 5, high = expected + 5): ForecastResult {
  return {
    horizon_weeks: 4,
    expected_change_pct: expected,
    low_pct: low,
    high_pct: high,
    drivers: ['seasonal post-harvest rise'],
    confidence: 'medium',
  };
}

describe('computeDecision', () => {
  it('recommends STORE when the forecast is strongly positive', () => {
    const d = computeDecision({
      todayPrice: 4800,
      quantityQuintal: 100,
      forecast: forecast(8),
      horizonWeeks: 4,
    });
    expect(d.recommendation).toBe('STORE');
    expect(d.store_gain_inr).toBeGreaterThan(0);
    expect(d.sell_now_inr).toBe(480000);
  });

  it('FLIPS to SELL when the forecast turns negative', () => {
    const store = computeDecision({
      todayPrice: 4800,
      quantityQuintal: 100,
      forecast: forecast(8),
      horizonWeeks: 4,
    });
    const sell = computeDecision({
      todayPrice: 4800,
      quantityQuintal: 100,
      forecast: forecast(-8),
      horizonWeeks: 4,
    });
    expect(store.recommendation).toBe('STORE');
    expect(sell.recommendation).toBe('SELL');
    expect(sell.store_gain_inr).toBeLessThanOrEqual(0);
  });

  it('FLIPS to SELL when cash_need forces immediate sale despite positive store_gain', () => {
    const withoutCash = computeDecision({
      todayPrice: 4800,
      quantityQuintal: 100,
      forecast: forecast(8),
      horizonWeeks: 4,
    });
    const withCash = computeDecision({
      todayPrice: 4800,
      quantityQuintal: 100,
      forecast: forecast(8),
      horizonWeeks: 4,
      cashNeedInr: 400000, // needs cash now; pledge loan LTV won't cover it
    });
    expect(withoutCash.recommendation).toBe('STORE');
    expect(withCash.recommendation).toBe('SELL');
    expect(withCash.risks.some((r) => /cash/i.test(r))).toBe(true);
  });

  it('does NOT force a sell when cash need is met by the pledge loan', () => {
    // Pledge loan = LTV(0.70) * value = 0.70 * 480000 = 336000 available.
    const d = computeDecision({
      todayPrice: 4800,
      quantityQuintal: 100,
      forecast: forecast(8),
      horizonWeeks: 4,
      cashNeedInr: 100000, // well within loan availability
    });
    expect(d.recommendation).toBe('STORE');
  });

  it('exposes the forecast and computes a positive sell_now_inr', () => {
    const d = computeDecision({
      todayPrice: 5000,
      quantityQuintal: 50,
      forecast: forecast(6),
      horizonWeeks: 4,
    });
    expect(d.sell_now_inr).toBe(250000);
    expect(d.forecast.expected_change_pct).toBe(6);
  });
});
