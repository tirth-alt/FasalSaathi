/**
 * LIVE network tests — these ACTUALLY CALL the external APIs.
 *
 * Skipped by default so `npm test` stays deterministic + offline. Run on demand:
 *   RUN_LIVE_TESTS=1 npm test -- external.live
 * or use the dedicated script `npm run check:external` for human-readable output.
 *
 * Expected as of 2026-06-13: Open-Meteo LIVE; Agmarknet 502/unavailable;
 * CEDA host up (spec endpoint reported, may not be machine-readable).
 */

import { describe, it, expect } from 'vitest';
import { OpenMeteoWeatherProvider } from '@/lib/external/weather.ts';
import { AgmarknetClient } from '@/lib/external/agmarknet.ts';
import { CedaClient } from '@/lib/external/ceda.ts';

const LIVE = process.env.RUN_LIVE_TESTS === '1';
const d = LIVE ? describe : describe.skip;

const INDORE = { lat: 22.7196, lng: 75.8577 };

d('LIVE: Open-Meteo', () => {
  it('returns a real multi-day forecast for Indore', async () => {
    const fc = await new OpenMeteoWeatherProvider().getForecast(INDORE.lat, INDORE.lng);
    console.info('[live] Open-Meteo:', JSON.stringify({ rain_3d_mm: fc.rain_3d_mm, quality_risk: fc.quality_risk, days: fc.daily.length }));
    expect(fc.daily.length).toBeGreaterThan(0);
    expect(typeof fc.rain_3d_mm).toBe('number');
    expect(['low', 'med', 'high']).toContain(fc.quality_risk);
  }, 15000);
});

d('LIVE: Agmarknet (data.gov.in)', () => {
  it('reports its current state (expected 502/unavailable today) without throwing', async () => {
    const client = new AgmarknetClient();
    const health = await client.checkHealth();
    const result = await client.getPrices({ commodity: 'Soybean', limit: 3 });
    console.info('[live] Agmarknet health:', JSON.stringify(health));
    console.info('[live] Agmarknet getPrices.available:', result.available);
    // We assert behaviour, not availability: the call must resolve to a typed
    // result either way (never throw).
    expect(typeof result.available).toBe('boolean');
  }, 15000);
});

d('LIVE: CEDA Ashoka', () => {
  it('reports whether the OpenAPI spec is reachable + the trend endpoint state', async () => {
    const client = new CedaClient();
    const spec = await client.fetchSpec();
    console.info('[live] CEDA spec:', JSON.stringify(spec.available ? { specPath: spec.specPath, paths: spec.paths } : { reason: spec.reason }));
    const trend = await client.getMonthlyTrend('soybean', 'Indore');
    console.info('[live] CEDA getMonthlyTrend.available:', trend.available);
    expect(typeof spec.available).toBe('boolean');
  }, 15000);
});
