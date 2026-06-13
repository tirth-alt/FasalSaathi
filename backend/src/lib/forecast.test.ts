import { describe, it, expect } from 'vitest';
import { SeasonalTrendForecastProvider, type PricePoint } from '@/lib/forecast.ts';

/** Build a synthetic series with a fixed daily slope. */
function makeSeries(start: number, dailySlope: number, days = 30): PricePoint[] {
  const points: PricePoint[] = [];
  const today = new Date('2026-06-13T00:00:00Z');
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - (days - 1 - i));
    points.push({
      date: d.toISOString().slice(0, 10),
      modal_price: Math.round(start + dailySlope * i),
    });
  }
  return points;
}

describe('SeasonalTrendForecastProvider', () => {
  const provider = new SeasonalTrendForecastProvider();

  it('returns a range where low_pct <= expected_change_pct <= high_pct', () => {
    const result = provider.forecast({
      commodity: 'soybean',
      horizonWeeks: 4,
      priceSeries: makeSeries(4800, 0),
      asOfMonth: 5, // June (0-indexed)
    });
    expect(result.low_pct).toBeLessThanOrEqual(result.expected_change_pct);
    expect(result.expected_change_pct).toBeLessThanOrEqual(result.high_pct);
    expect(result.horizon_weeks).toBe(4);
  });

  it('a strong upward recent slope raises expected_change_pct vs a flat series', () => {
    const flat = provider.forecast({
      commodity: 'soybean',
      horizonWeeks: 4,
      priceSeries: makeSeries(4800, 0),
      asOfMonth: 5,
    });
    const rising = provider.forecast({
      commodity: 'soybean',
      horizonWeeks: 4,
      priceSeries: makeSeries(4800, 12), // ~+₹12/day → strong upward momentum
      asOfMonth: 5,
    });
    expect(rising.expected_change_pct).toBeGreaterThan(flat.expected_change_pct);
  });

  it('a strong downward slope lowers expected_change_pct vs flat', () => {
    const flat = provider.forecast({
      commodity: 'soybean',
      horizonWeeks: 4,
      priceSeries: makeSeries(4800, 0),
      asOfMonth: 5,
    });
    const falling = provider.forecast({
      commodity: 'soybean',
      horizonWeeks: 4,
      priceSeries: makeSeries(4800, -12),
      asOfMonth: 5,
    });
    expect(falling.expected_change_pct).toBeLessThan(flat.expected_change_pct);
  });

  it('populates drivers and a confidence level', () => {
    const result = provider.forecast({
      commodity: 'soybean',
      horizonWeeks: 4,
      priceSeries: makeSeries(4800, 6),
      asOfMonth: 5,
    });
    expect(result.drivers.length).toBeGreaterThan(0);
    expect(['low', 'medium', 'high']).toContain(result.confidence);
  });

  it('weather quality_risk widens the range but does NOT move the centre (spec §2 signal 3)', () => {
    const base = {
      commodity: 'soybean',
      horizonWeeks: 4,
      priceSeries: makeSeries(4800, 0),
      asOfMonth: 5,
    } as const;
    const dry = provider.forecast({ ...base, weatherRisk: 'low' });
    const wet = provider.forecast({ ...base, weatherRisk: 'high' });

    // Centre unchanged.
    expect(wet.expected_change_pct).toBe(dry.expected_change_pct);
    // Range strictly wider on both sides.
    expect(wet.high_pct).toBeGreaterThan(dry.high_pct);
    expect(wet.low_pct).toBeLessThan(dry.low_pct);
  });

  it('high weather risk adds an open-storage quality-risk driver', () => {
    const wet = provider.forecast({
      commodity: 'soybean',
      horizonWeeks: 4,
      priceSeries: makeSeries(4800, 0),
      asOfMonth: 5,
      weatherRisk: 'high',
    });
    expect(wet.drivers.some((d) => /quality risk for open storage/i.test(d))).toBe(true);
  });

  it('omitting weatherRisk (weather unavailable) applies no modifier', () => {
    const none = provider.forecast({
      commodity: 'soybean',
      horizonWeeks: 4,
      priceSeries: makeSeries(4800, 0),
      asOfMonth: 5,
    });
    const low = provider.forecast({
      commodity: 'soybean',
      horizonWeeks: 4,
      priceSeries: makeSeries(4800, 0),
      asOfMonth: 5,
      weatherRisk: 'low',
    });
    // 'low' and absent both mean "no widening".
    expect(none.high_pct).toBe(low.high_pct);
    expect(none.low_pct).toBe(low.low_pct);
  });

  it('longer horizon widens or shifts the seasonal baseline', () => {
    const oneWeek = provider.forecast({
      commodity: 'soybean',
      horizonWeeks: 1,
      priceSeries: makeSeries(4800, 0),
      asOfMonth: 9, // October — post-harvest for soybean
    });
    const eightWeeks = provider.forecast({
      commodity: 'soybean',
      horizonWeeks: 8,
      priceSeries: makeSeries(4800, 0),
      asOfMonth: 9,
    });
    // Post-harvest hold longer → larger expected rise.
    expect(eightWeeks.expected_change_pct).toBeGreaterThanOrEqual(oneWeek.expected_change_pct);
  });
});
