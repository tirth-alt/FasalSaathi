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
  stubWeatherProvider,
  type FakeDbState,
} from '@/lib/test-utils.ts';
import type { ForecastProvider, ForecastResult } from '@/lib/forecast.ts';
import { SeasonalTrendForecastProvider } from '@/lib/forecast.ts';
import type { WeatherForecast, WeatherProvider } from '@/lib/external/weather.ts';

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

/**
 * Deps using the REAL forecaster (so we can observe the live weather modifier's
 * effect on the range) plus a controllable weather provider.
 */
function depsWithRealForecastAndWeather(
  state: FakeDbState,
  weather: WeatherProvider,
): AppDeps {
  const client = createFakeSupabase(state, {
    tokens: { [TOKEN_A]: { id: USER_A, email: 'ramesh@example.in' } },
  });
  const routeDeps = fixtureRouteDeps();
  return {
    auth: { serviceClient: client, verifyToken: makeSupabaseVerifier(client) },
    authRoutes: { serviceClient: client },
    profile: { serviceClient: client, aadhaarKey },
    ...routeDeps,
    decision: {
      ...routeDeps.decision,
      forecaster: new SeasonalTrendForecastProvider(),
      weather,
    },
    weather: { weather },
  };
}

const RAINY_FORECAST: WeatherForecast = {
  daily: [
    { date: '2026-06-13', precipitation_mm: 50, temp_max: 29 },
    { date: '2026-06-14', precipitation_mm: 30, temp_max: 28 },
    { date: '2026-06-15', precipitation_mm: 10, temp_max: 30 },
  ],
  rain_3d_mm: 90,
  quality_risk: 'high',
};

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
  weather_quality_risk: 'low' | 'med' | 'high' | null;
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

  it('per_mandi absent → unchanged aggregate shape (no cards key)', async () => {
    const res = await buildApp(depsWith(state, POSITIVE)).request('/decision', {
      method: 'POST',
      headers: AUTH_HEADER,
      body: JSON.stringify({ commodity: 'soybean', quantity_quintal: 100 }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.cards).toBeUndefined();
    expect(body.recommendation).toBeDefined();
  });
});

interface CurvePoint {
  day: number;
  price: number;
  low: number;
  high: number;
}

interface MandiCard {
  mandi_id: string;
  mandi_name: string;
  district: string;
  state: string;
  distance_km: number | null;
  decision: 'HOLD' | 'SELL';
  wait_days: { best: number; range: [number, number] };
  good_sale_window_day: number;
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

describe('POST /decision — per_mandi cards (F2, output_format.md)', () => {
  let state: FakeDbState;

  beforeEach(() => {
    state = emptyDb();
    state.farmers.set(
      USER_A,
      makeFarmer({ id: USER_A, farm_lat: 22.7196, farm_lng: 75.8577 }),
    );
  });

  it('returns one card per resolved mandi, each matching the output_format shape', async () => {
    const res = await buildApp(depsWith(state, POSITIVE)).request('/decision', {
      method: 'POST',
      headers: AUTH_HEADER,
      body: JSON.stringify({
        commodity: 'soybean',
        quantity_quintal: 50,
        mandi_ids: ['IND-001', 'DEW-001'],
        per_mandi: true,
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { cards: MandiCard[] };
    expect(Array.isArray(body.cards)).toBe(true);
    expect(body.cards.length).toBe(2);

    for (const card of body.cards) {
      expect(['HOLD', 'SELL']).toContain(card.decision);
      expect(['high', 'low']).toContain(card.confidence);
      expect(card.quantity_qtl).toBe(50);
      expect(card.curve.length).toBe(45);
      // Curve anchored at sell_now on day 1, ordered low <= price <= high.
      expect(card.curve[0]!.day).toBe(1);
      expect(card.curve[44]!.day).toBe(45);
      for (const pt of card.curve) {
        expect(pt.low).toBeLessThanOrEqual(pt.high);
      }
      // wait_days.best matches the good-sale day; range brackets it.
      expect(card.wait_days.best).toBe(card.good_sale_window_day);
      expect(card.wait_days.range[0]).toBeLessThanOrEqual(card.wait_days.best);
      expect(card.wait_days.range[1]).toBeGreaterThanOrEqual(card.wait_days.best);
      // max_hold_days is the soybean shelf-life cap.
      expect(card.max_hold_days).toBe(180);
      // total = per_quintal × quantity (integers).
      expect(card.total.sell_now).toBe(card.per_quintal.sell_now * 50);
      expect(card.total.expected_at_D.mid).toBe(card.per_quintal.expected_at_D.mid * 50);
      expect(card.total.storage_cost).toBe(card.per_quintal.storage_cost * 50);
      expect(card.total.expected_gain).toBe(card.per_quintal.expected_gain * 50);
      expect(Number.isInteger(card.per_quintal.sell_now)).toBe(true);
      // expected_gain reconciles: (mid - sell_now) - storage_cost.
      expect(card.per_quintal.expected_gain).toBe(
        card.per_quintal.expected_at_D.mid - card.per_quintal.sell_now - card.per_quintal.storage_cost,
      );
      // distance_km present (mandi set derivable from farm location).
      expect(card.distance_km).not.toBeNull();
    }
  });

  it('STORE maps to HOLD with a positive forecast', async () => {
    const res = await buildApp(depsWith(state, POSITIVE)).request('/decision', {
      method: 'POST',
      headers: AUTH_HEADER,
      body: JSON.stringify({
        commodity: 'soybean',
        quantity_quintal: 100,
        mandi_ids: ['IND-001'],
        per_mandi: true,
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { cards: MandiCard[] };
    expect(body.cards[0]!.decision).toBe('HOLD');
  });

  it('negative forecast yields SELL cards', async () => {
    const res = await buildApp(depsWith(state, NEGATIVE)).request('/decision', {
      method: 'POST',
      headers: AUTH_HEADER,
      body: JSON.stringify({
        commodity: 'soybean',
        quantity_quintal: 100,
        mandi_ids: ['IND-001'],
        per_mandi: true,
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { cards: MandiCard[] };
    expect(body.cards[0]!.decision).toBe('SELL');
    // SELL → sell now, good-sale day is day 1.
    expect(body.cards[0]!.good_sale_window_day).toBe(1);
  });

  it('prices each mandi independently (cards can differ across mandis)', async () => {
    // Real forecaster so per-mandi price/series differences flow through.
    const res = await buildApp(
      depsWithRealForecastAndWeather(state, stubWeatherProvider()),
    ).request('/decision', {
      method: 'POST',
      headers: AUTH_HEADER,
      body: JSON.stringify({
        commodity: 'soybean',
        quantity_quintal: 50,
        mandi_ids: ['IND-001', 'DEW-001', 'UJJ-001'],
        per_mandi: true,
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { cards: MandiCard[] };
    expect(body.cards.length).toBe(3);
    // The fixtures give each mandi its own price level → distinct sell_now.
    const sellNows = body.cards.map((c) => c.per_quintal.sell_now);
    expect(new Set(sellNows).size).toBeGreaterThan(1);
  });

  it('skips mandis with no price data; 400 when none have data', async () => {
    const res = await buildApp(depsWith(state, POSITIVE)).request('/decision', {
      method: 'POST',
      headers: AUTH_HEADER,
      body: JSON.stringify({
        commodity: 'dragonfruit', // no fixture price for this commodity
        quantity_quintal: 50,
        mandi_ids: ['IND-001', 'DEW-001'],
        per_mandi: true,
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('no_price_data');
  });
});

describe('POST /decision — live weather modifier (spec §2 signal 3)', () => {
  let state: FakeDbState;

  beforeEach(() => {
    state = emptyDb();
    state.farmers.set(
      USER_A,
      makeFarmer({ id: USER_A, farm_lat: 22.7196, farm_lng: 75.8577 }),
    );
  });

  it('heavy rain at the farm location widens the forecast range and surfaces a quality-risk', async () => {
    // Dry baseline vs rainy: same everything else, real forecaster.
    const dryRes = await buildApp(
      depsWithRealForecastAndWeather(state, stubWeatherProvider()),
    ).request('/decision', {
      method: 'POST',
      headers: AUTH_HEADER,
      body: JSON.stringify({ commodity: 'soybean', quantity_quintal: 100 }),
    });
    const wetRes = await buildApp(
      depsWithRealForecastAndWeather(state, stubWeatherProvider(RAINY_FORECAST)),
    ).request('/decision', {
      method: 'POST',
      headers: AUTH_HEADER,
      body: JSON.stringify({ commodity: 'soybean', quantity_quintal: 100 }),
    });

    expect(dryRes.status).toBe(200);
    expect(wetRes.status).toBe(200);
    const dry = (await dryRes.json()) as DecisionBody;
    const wet = (await wetRes.json()) as DecisionBody;

    expect(dry.weather_quality_risk).toBe('low');
    expect(wet.weather_quality_risk).toBe('high');

    // Centre unchanged; range strictly wider under rain.
    expect(wet.forecast.expected_change_pct).toBe(dry.forecast.expected_change_pct);
    expect(wet.forecast.high_pct).toBeGreaterThan(dry.forecast.high_pct);
    expect(wet.forecast.low_pct).toBeLessThan(dry.forecast.low_pct);

    // The quality-risk driver propagates into the decision's risks.
    expect(wet.risks.some((r) => /quality risk for open storage/i.test(r))).toBe(true);
  });

  it('degrades gracefully when the weather provider is unavailable (weather_quality_risk = null)', async () => {
    const res = await buildApp(
      depsWithRealForecastAndWeather(state, stubWeatherProvider('unavailable')),
    ).request('/decision', {
      method: 'POST',
      headers: AUTH_HEADER,
      body: JSON.stringify({ commodity: 'soybean', quantity_quintal: 100 }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as DecisionBody;
    expect(body.weather_quality_risk).toBeNull();
    // A decision is still produced.
    expect(['STORE', 'SELL']).toContain(body.recommendation);
  });
});
