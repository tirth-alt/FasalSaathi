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
  series: {
    mandi_id: string;
    commodity: string;
    series: { date: string; modal_price: number; min_price?: number; max_price?: number }[];
  }[];
  unknown_mandi_ids?: string[];
}

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
});
