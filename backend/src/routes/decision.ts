import { Hono } from 'hono';
import type { AppBindings } from '@/lib/types.ts';
import { jsonError } from '@/lib/errors.ts';
import { nearestByDistance } from '@/lib/geo.ts';
import type { MandiRepository, PriceRepository } from '@/lib/repositories.ts';
import type { ForecastProvider, PricePoint } from '@/lib/forecast.ts';
import type { WeatherProvider, QualityRisk } from '@/lib/external/weather.ts';
import { computeDecision } from '@/lib/decision.ts';
import { buildMandiCard, type MandiCard, type MandiGeo } from '@/lib/card.ts';
import { haversineKm } from '@/lib/geo.ts';
import type { Mandi } from '@/data/mandis.ts';
import { decisionBodySchema } from '@/routes/decision.schema.ts';

/**
 * Hold-or-sell decision route. AUTH-PROTECTED (mounted behind authMiddleware,
 * same as /me): it reads the authenticated farmer's location to derive the
 * mandi set, so it operates on the caller's profile.
 *
 * The forecast is produced by the injected ForecastProvider (v0 = explainable
 * seasonal+trend, see lib/forecast.ts). A v1 TrainedForecastProvider swaps in
 * behind the same interface with NO route changes. The store-vs-sell arithmetic
 * is the pure deterministic function in lib/decision.ts (mirrors the on-device math).
 */
export interface DecisionDeps {
  mandis: MandiRepository;
  prices: PriceRepository;
  forecaster: ForecastProvider;
  /**
   * Live weather provider (Open-Meteo). Optional + degradable: when present, the
   * farmer's farm location is used to fetch the rain forecast and the derived
   * quality_risk is fed into the forecaster as a range-widening modifier (spec §2
   * signal 3, replacing the old seasonal-month monsoon stand-in). If the provider
   * is absent OR the call fails, the decision is still produced without it — the
   * on-device app must work offline, so weather is an enhancer, never required.
   */
  weather?: WeatherProvider;
}

/** How many nearest mandis to price against when deriving from farm location. */
const DERIVED_MANDI_COUNT = 8;
/** Days of history fed to the forecaster's momentum signal. */
const FORECAST_HISTORY_DAYS = 30;

export function createDecisionRoutes(deps: DecisionDeps): Hono<AppBindings> {
  const app = new Hono<AppBindings>();

  // POST /decision
  app.post('/decision', async (c) => {
    const { farmer } = c.get('auth');

    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      return jsonError(c, 400, 'invalid_json', 'Request body must be valid JSON');
    }

    const parsed = decisionBodySchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError(c, 400, 'validation_error', 'Invalid decision payload', parsed.error.flatten());
    }

    const { commodity, quantity_quintal, mandi_ids, cash_need_inr, horizon_weeks, per_mandi } =
      parsed.data;

    // Resolve the mandi set: explicit mandi_ids win; otherwise derive from the
    // farmer's pinned farm location (the stable nearest-mandi set per spec F1/F2).
    let mandiIds: string[];
    if (mandi_ids && mandi_ids.length > 0) {
      mandiIds = mandi_ids.filter((id) => deps.mandis.getById(id) !== null);
      if (mandiIds.length === 0) {
        return jsonError(c, 400, 'unknown_mandi', 'None of the provided mandi_ids are known');
      }
    } else {
      if (farmer.farm_lat === null || farmer.farm_lng === null) {
        return jsonError(
          c,
          400,
          'location_required',
          'No mandi_ids provided and the farmer has no farm location set; provide mandi_ids or set farm_lat/farm_lng',
        );
      }
      mandiIds = nearestByDistance(
        deps.mandis.listAll(),
        farmer.farm_lat,
        farmer.farm_lng,
        DERIVED_MANDI_COUNT,
      ).map((m) => m.mandi_id);
    }

    // today_price = AVERAGE of the latest modal across the chosen mandis. Averaging
    // (vs nearest) smooths single-mandi noise and reflects the multi-mandi price
    // compass the farmer actually faces. Mandis with no data for this commodity
    // are skipped.
    const latestModals = mandiIds
      .map((id) => deps.prices.getLatestModal(commodity, id))
      .filter((p): p is number => p !== null);

    if (latestModals.length === 0) {
      return jsonError(c, 400, 'no_price_data', `No price data for commodity "${commodity}" at the selected mandis`);
    }

    const todayPrice = Math.round(
      latestModals.reduce((a, b) => a + b, 0) / latestModals.length,
    );

    // Build the momentum series: the per-day AVERAGE modal across the chosen mandis.
    const priceSeries = buildAveragedSeries(deps.prices, commodity, mandiIds, FORECAST_HISTORY_DAYS);

    // Signal 3 — live weather. Best-effort: if the farmer has a pinned location
    // and a weather provider is wired, fetch the rain forecast and derive
    // quality_risk to widen the forecast range. Any failure degrades silently —
    // the decision must still be produced (offline-first).
    const weatherRisk = await resolveWeatherRisk(
      deps.weather,
      farmer.farm_lat,
      farmer.farm_lng,
    );

    // Per-mandi mode (F2 flashcards, matches output_format.md): price EACH mandi
    // independently and return one card per mandi. The aggregate path below is
    // left unchanged for the default mode.
    if (per_mandi) {
      const cards = buildPerMandiCards({
        deps,
        mandiIds,
        commodity,
        quantityQuintal: quantity_quintal,
        horizonWeeks: horizon_weeks,
        weatherRisk,
        farmLat: farmer.farm_lat,
        farmLng: farmer.farm_lng,
        ...(cash_need_inr !== undefined ? { cashNeedInr: cash_need_inr } : {}),
      });
      if (cards.length === 0) {
        return jsonError(
          c,
          400,
          'no_price_data',
          `No price data for commodity "${commodity}" at the selected mandis`,
        );
      }
      return c.json({ cards });
    }

    // Forecast via the swappable provider (v0 seasonal+trend; v1 trained model
    // plugs in behind this same interface).
    const forecast = deps.forecaster.forecast({
      commodity,
      horizonWeeks: horizon_weeks,
      priceSeries,
      ...(weatherRisk !== null ? { weatherRisk } : {}),
    });

    const decision = computeDecision({
      todayPrice,
      quantityQuintal: quantity_quintal,
      forecast,
      horizonWeeks: horizon_weeks,
      ...(cash_need_inr !== undefined ? { cashNeedInr: cash_need_inr } : {}),
    });

    return c.json({
      recommendation: decision.recommendation,
      commodity,
      quantity_quintal,
      mandi_ids: mandiIds,
      today_price: decision.today_price,
      sell_now_inr: decision.sell_now_inr,
      expected_future_price: decision.expected_future_price,
      forecast: decision.forecast,
      store_gain_inr: decision.store_gain_inr,
      breakeven_weeks: decision.breakeven_weeks,
      risks: decision.risks,
      // null when weather was unavailable or no farm location — the decision is
      // still valid, it just lacks the weather modifier.
      weather_quality_risk: weatherRisk,
    });
  });

  return app;
}

/**
 * Per-mandi decision cards (F2 flashcards). Prices EACH mandi on its own latest
 * modal + its own momentum series (NOT the cross-mandi average), runs the
 * swappable forecaster and the store-vs-sell math per mandi, and assembles a
 * card. The weather quality-risk is the farm's (one location) so it is shared
 * across mandis as a range modifier. Mandis with no price data are skipped.
 */
function buildPerMandiCards(params: {
  deps: DecisionDeps;
  mandiIds: string[];
  commodity: string;
  quantityQuintal: number;
  horizonWeeks: number;
  weatherRisk: QualityRisk | null;
  farmLat: number | null;
  farmLng: number | null;
  cashNeedInr?: number;
}): MandiCard[] {
  const {
    deps,
    mandiIds,
    commodity,
    quantityQuintal,
    horizonWeeks,
    weatherRisk,
    farmLat,
    farmLng,
    cashNeedInr,
  } = params;

  const cards: MandiCard[] = [];
  for (const id of mandiIds) {
    const mandi = deps.mandis.getById(id);
    if (mandi === null) continue; // unknown id (defensive; already filtered upstream)

    const todayPrice = deps.prices.getLatestModal(commodity, id);
    if (todayPrice === null) continue; // no price for this commodity at this mandi

    const priceSeries = deps.prices.getHistory(commodity, id, FORECAST_HISTORY_DAYS);

    const forecast = deps.forecaster.forecast({
      commodity,
      horizonWeeks,
      priceSeries,
      ...(weatherRisk !== null ? { weatherRisk } : {}),
    });

    const decision = computeDecision({
      todayPrice,
      quantityQuintal,
      forecast,
      horizonWeeks,
      ...(cashNeedInr !== undefined ? { cashNeedInr } : {}),
    });

    cards.push(
      buildMandiCard({
        decision,
        geo: toMandiGeo(mandi, farmLat, farmLng),
        commodity,
        quantityQtl: quantityQuintal,
        horizonWeeks,
      }),
    );
  }
  return cards;
}

/** Mandi geo for a card, with distance_km when a farm location is available. */
function toMandiGeo(mandi: Mandi, farmLat: number | null, farmLng: number | null): MandiGeo {
  const geo: MandiGeo = {
    mandi_id: mandi.mandi_id,
    name: mandi.name,
    district: mandi.district,
    state: mandi.state,
  };
  if (farmLat !== null && farmLng !== null) {
    geo.distance_km = Math.round(haversineKm(farmLat, farmLng, mandi.lat, mandi.lng) * 10) / 10;
  }
  return geo;
}

/**
 * Best-effort weather quality-risk lookup. Returns the QualityRisk band, or null
 * if weather can't be determined (no provider, no location, or the call failed).
 * Never throws — weather is an enhancer, not a hard dependency.
 */
async function resolveWeatherRisk(
  weather: WeatherProvider | undefined,
  lat: number | null,
  lng: number | null,
): Promise<QualityRisk | null> {
  if (!weather || lat === null || lng === null) return null;
  try {
    const forecast = await weather.getForecast(lat, lng);
    return forecast.quality_risk;
  } catch {
    // WeatherUnavailableError or any unexpected failure → degrade gracefully.
    return null;
  }
}

/**
 * Average the per-day modal price across the chosen mandis into a single series,
 * aligned by date. Used as the momentum signal input to the forecaster.
 */
function buildAveragedSeries(
  prices: PriceRepository,
  commodity: string,
  mandiIds: string[],
  days: number,
): PricePoint[] {
  const byDate = new Map<string, { sum: number; count: number }>();
  for (const id of mandiIds) {
    for (const point of prices.getHistory(commodity, id, days)) {
      const acc = byDate.get(point.date) ?? { sum: 0, count: 0 };
      acc.sum += point.modal_price;
      acc.count += 1;
      byDate.set(point.date, acc);
    }
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { sum, count }]) => ({ date, modal_price: Math.round(sum / count) }));
}
