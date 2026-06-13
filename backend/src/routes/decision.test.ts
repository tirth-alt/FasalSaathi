import { describe, it, expect, beforeEach } from 'vitest';
import { randomBytes } from 'node:crypto';
import { buildApp, type AppDeps } from '@/app.ts';
import { loadAadhaarKey } from '@/lib/crypto.ts';
import { makeSupabaseVerifier } from '@/middleware/auth.ts';
import {
  createFakeSupabase,
  emptyDb,
  makeFarmer,
  fixtureRouteDeps,
  type FakeDbState,
} from '@/lib/test-utils.ts';
import type { ForecastProvider, ForecastResult } from '@/lib/forecast.ts';

const USER_A = '00000000-0000-0000-0000-00000000000a';
const TOKEN_A = 'token-a';
const AUTH_HEADER = { Authorization: `Bearer ${TOKEN_A}`, 'Content-Type': 'application/json' };
const aadhaarKey = loadAadhaarKey(randomBytes(32).toString('base64'));

/** A forecaster stub returning a fixed result, so we control SELL vs STORE. */
function stubForecaster(result: ForecastResult): ForecastProvider {
  return { forecast: () => result };
}

const POSITIVE: ForecastResult = {
  horizon_weeks: 4,
  expected_change_pct: 8,
  low_pct: 3,
  high_pct: 13,
  drivers: ['seasonal post-harvest rise', 'upward 30-day price trend'],
  confidence: 'medium',
};

const NEGATIVE: ForecastResult = {
  horizon_weeks: 4,
  expected_change_pct: -8,
  low_pct: -14,
  high_pct: -2,
  drivers: ['seasonal pre-harvest / new-crop pressure', 'downward 30-day price trend'],
  confidence: 'medium',
};

function depsWith(state: FakeDbState, forecast: ForecastResult): AppDeps {
  const client = createFakeSupabase(state, {
    tokens: { [TOKEN_A]: { id: USER_A, email: 'ramesh@example.in' } },
  });
  const routeDeps = fixtureRouteDeps();
  return {
    auth: { serviceClient: client, verifyToken: makeSupabaseVerifier(client) },
    authRoutes: { serviceClient: client },
    profile: { serviceClient: client, aadhaarKey },
    ...routeDeps,
    // Swap in the stub forecaster behind the same ForecastProvider interface.
    decision: { ...routeDeps.decision, forecaster: stubForecaster(forecast) },
  };
}

interface DecisionBody {
  recommendation: 'STORE' | 'SELL';
  commodity: string;
  today_price: number;
  sell_now_inr: number;
  forecast: ForecastResult;
  store_gain_inr: number;
  breakeven_weeks: number | null;
  risks: string[];
  mandi_ids: string[];
}

describe('POST /decision', () => {
  let state: FakeDbState;

  beforeEach(() => {
    state = emptyDb();
    // Farmer with a farm location near Indore so mandi_ids can be derived.
    state.farmers.set(
      USER_A,
      makeFarmer({ id: USER_A, farm_lat: 22.7196, farm_lng: 75.8577 }),
    );
  });

  it('401 without auth', async () => {
    const res = await buildApp(depsWith(state, POSITIVE)).request('/decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commodity: 'soybean', quantity_quintal: 100 }),
    });
    expect(res.status).toBe(401);
  });

  it('STORE outcome: positive forecast, derives mandi_ids from farm location, returns a forecast RANGE', async () => {
    const res = await buildApp(depsWith(state, POSITIVE)).request('/decision', {
      method: 'POST',
      headers: AUTH_HEADER,
      body: JSON.stringify({ commodity: 'soybean', quantity_quintal: 100 }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as DecisionBody;
    expect(body.recommendation).toBe('STORE');
    expect(body.store_gain_inr).toBeGreaterThan(0);
    expect(body.mandi_ids.length).toBeGreaterThan(0);
    // forecast range present and ordered.
    expect(body.forecast.low_pct).toBeLessThanOrEqual(body.forecast.expected_change_pct);
    expect(body.forecast.expected_change_pct).toBeLessThanOrEqual(body.forecast.high_pct);
    expect(body.sell_now_inr).toBe(body.today_price * 100);
  });

  it('SELL outcome: negative forecast flips the recommendation', async () => {
    const res = await buildApp(depsWith(state, NEGATIVE)).request('/decision', {
      method: 'POST',
      headers: AUTH_HEADER,
      body: JSON.stringify({ commodity: 'soybean', quantity_quintal: 100 }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as DecisionBody;
    expect(body.recommendation).toBe('SELL');
    expect(body.store_gain_inr).toBeLessThanOrEqual(0);
  });

  it('cash_need forces SELL even with a positive forecast', async () => {
    const res = await buildApp(depsWith(state, POSITIVE)).request('/decision', {
      method: 'POST',
      headers: AUTH_HEADER,
      body: JSON.stringify({
        commodity: 'soybean',
        quantity_quintal: 100,
        cash_need_inr: 600000, // exceeds pledge-loan availability
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as DecisionBody;
    expect(body.recommendation).toBe('SELL');
    expect(body.risks.some((r) => /cash/i.test(r))).toBe(true);
  });

  it('accepts explicit mandi_ids', async () => {
    const res = await buildApp(depsWith(state, POSITIVE)).request('/decision', {
      method: 'POST',
      headers: AUTH_HEADER,
      body: JSON.stringify({
        commodity: 'soybean',
        quantity_quintal: 50,
        mandi_ids: ['IND-001', 'DEW-001'],
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as DecisionBody;
    expect(body.mandi_ids).toEqual(['IND-001', 'DEW-001']);
  });

  it('400 when no mandi_ids and farmer has no farm location', async () => {
    state.farmers.set(USER_A, makeFarmer({ id: USER_A, farm_lat: null, farm_lng: null }));
    const res = await buildApp(depsWith(state, POSITIVE)).request('/decision', {
      method: 'POST',
      headers: AUTH_HEADER,
      body: JSON.stringify({ commodity: 'soybean', quantity_quintal: 100 }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('location_required');
  });

  it('400 on validation error (missing quantity)', async () => {
    const res = await buildApp(depsWith(state, POSITIVE)).request('/decision', {
      method: 'POST',
      headers: AUTH_HEADER,
      body: JSON.stringify({ commodity: 'soybean' }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('validation_error');
  });
});
