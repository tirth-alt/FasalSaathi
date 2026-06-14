import { describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { buildApp, type AppDeps } from '@/app.ts';
import { loadAadhaarKey } from '@/lib/crypto.ts';
import { createFakeSupabase, emptyDb, fixtureRouteDeps } from '@/lib/test-utils.ts';

function deps(): AppDeps {
  const client = createFakeSupabase(emptyDb());
  return {
    auth: { serviceClient: client, verifyToken: async () => null },
    authRoutes: { serviceClient: client },
    profile: { serviceClient: client, aadhaarKey: loadAadhaarKey(randomBytes(32).toString('base64')) },
    ...fixtureRouteDeps(),
  };
}

interface HistoryBody {
  source: string;
  series: {
    mandi_id: string;
    commodity: string;
    series: { date: string; modal_price: number; min_price?: number; max_price?: number }[];
  }[];
  unknown_mandi_ids?: string[];
}

/** Latest trading day in the committed dataset (Saturday; 2026-06-14 is a skipped Sunday). */
const LATEST_TRADING_DATE = '2026-06-13';

describe('GET /prices/history', () => {
  it('returns 5-day modal history for a single mandi (PUBLIC, default days=5)', async () => {
    const res = await buildApp(deps()).request('/prices/history?commodity=soybean&mandi_id=IND-001');
    expect(res.status).toBe(200);
    const body = (await res.json()) as HistoryBody;
    expect(body.series).toHaveLength(1);
    expect(body.series[0]!.mandi_id).toBe('IND-001');
    expect(body.series[0]!.commodity).toBe('soybean');
    expect(body.series[0]!.series).toHaveLength(5);
    const point = body.series[0]!.series[0]!;
    expect(typeof point.modal_price).toBe('number');
    expect(point.modal_price).toBeGreaterThan(3000); // realistic soybean band
    expect(point.min_price).toBeLessThanOrEqual(point.modal_price);
    expect(point.max_price).toBeGreaterThanOrEqual(point.modal_price);
  });

  it('accepts comma-separated mandi_id (one entry per mandi)', async () => {
    const res = await buildApp(deps()).request(
      '/prices/history?commodity=soybean&mandi_id=IND-001,DEW-001,UJJ-001&days=7',
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as HistoryBody;
    expect(body.series.map((s) => s.mandi_id)).toEqual(['IND-001', 'DEW-001', 'UJJ-001']);
    expect(body.series[0]!.series).toHaveLength(7);
  });

  it('returns known mandis and reports unknown ones when SOME are unknown', async () => {
    const res = await buildApp(deps()).request(
      '/prices/history?commodity=soybean&mandi_id=IND-001,NOPE-999',
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as HistoryBody;
    expect(body.series.map((s) => s.mandi_id)).toEqual(['IND-001']);
    expect(body.unknown_mandi_ids).toEqual(['NOPE-999']);
  });

  it('400s when ALL mandi_ids are unknown', async () => {
    const res = await buildApp(deps()).request('/prices/history?commodity=soybean&mandi_id=NOPE-1,NOPE-2');
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('unknown_mandi');
  });

  it('400s on missing commodity', async () => {
    const res = await buildApp(deps()).request('/prices/history?mandi_id=IND-001');
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('validation_error');
  });

  it('reports the Agmarknet provenance source (additive field)', async () => {
    const res = await buildApp(deps()).request('/prices/history?commodity=onion&mandi_id=NSK-PIM');
    expect(res.status).toBe(200);
    const body = (await res.json()) as HistoryBody;
    expect(body.source).toBe('Agmarknet (data.gov.in)');
  });

  it('serves the Nashik mandis with realistic June onion prices', async () => {
    const res = await buildApp(deps()).request('/prices/history?commodity=onion&mandi_id=NSK-PIM&days=30');
    expect(res.status).toBe(200);
    const body = (await res.json()) as HistoryBody;
    const series = body.series[0]!.series;
    // Onion June band ≈ 1600 ₹/qtl ± offset/volatility — sanity bounds.
    for (const pt of series) {
      expect(pt.modal_price).toBeGreaterThan(1200);
      expect(pt.modal_price).toBeLessThan(2200);
      expect(pt.min_price!).toBeLessThanOrEqual(pt.modal_price);
      expect(pt.max_price!).toBeGreaterThanOrEqual(pt.modal_price);
    }
  });

  it('latest entry is the Saturday 2026-06-13 and Sundays are absent (APMC closed)', async () => {
    const res = await buildApp(deps()).request('/prices/history?commodity=onion&mandi_id=NSK-PIM&days=30');
    expect(res.status).toBe(200);
    const body = (await res.json()) as HistoryBody;
    const dates = body.series[0]!.series.map((p) => p.date);
    // Oldest → newest, latest pinned to the dataset's last trading day.
    expect(dates).toEqual([...dates].sort());
    expect(dates.at(-1)).toBe(LATEST_TRADING_DATE);
    // No Sunday (UTC day 0) anywhere in the series.
    const sundays = dates.filter((d) => new Date(`${d}T00:00:00Z`).getUTCDay() === 0);
    expect(sundays).toEqual([]);
    // 30-calendar-day window with Sundays removed → ~26 trading days.
    expect(dates.length).toBeGreaterThanOrEqual(25);
    expect(dates.length).toBeLessThanOrEqual(27);
  });
});
