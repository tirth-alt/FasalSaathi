import { Hono } from 'hono';
import { logger } from 'hono/logger';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppConfig } from '@/config/env.ts';
import type { AppBindings } from '@/lib/types.ts';
import { jsonError, AppError } from '@/lib/errors.ts';
import { createServiceClient } from '@/lib/supabase.ts';
import { loadAadhaarKey } from '@/lib/crypto.ts';
import { authMiddleware, makeSupabaseVerifier, type AuthDeps } from '@/middleware/auth.ts';
import { createProfileRoutes, type ProfileDeps } from '@/routes/profile.ts';
import { createAuthRoutes, type AuthRoutesDeps } from '@/routes/auth.ts';
import { createMandiRoutes, type MandiDeps } from '@/routes/mandis.ts';
import { createPriceRoutes, type PriceDeps } from '@/routes/prices.ts';
import { createWarehouseRoutes, type WarehouseDeps } from '@/routes/warehouses.ts';
import { createDecisionRoutes, type DecisionDeps } from '@/routes/decision.ts';
import { createWeatherRoutes, type WeatherDeps } from '@/routes/weather.ts';
import {
  FixtureMandiRepository,
  FixturePriceRepository,
  FixtureWarehouseRepository,
} from '@/lib/repositories.ts';
import { SeasonalTrendForecastProvider } from '@/lib/forecast.ts';
import { OpenMeteoWeatherProvider } from '@/lib/external/weather.ts';

const SERVICE_NAME = 'fasalsaathi-backend';

/**
 * Everything the app needs to run, injectable for tests. In production these are
 * built from config via buildDepsFromConfig(); tests pass mocks directly.
 */
export interface AppDeps {
  auth: AuthDeps;
  authRoutes: AuthRoutesDeps;
  profile: ProfileDeps;
  mandi: MandiDeps;
  price: PriceDeps;
  warehouse: WarehouseDeps;
  decision: DecisionDeps;
  weather: WeatherDeps;
}

/** Wire real Supabase clients + crypto key from validated config. */
export function buildDepsFromConfig(config: AppConfig): AppDeps {
  const serviceClient: SupabaseClient = createServiceClient(config);
  const aadhaarKey = loadAadhaarKey(config.AADHAAR_ENC_KEY);

  // Reference-data repositories. Fixture-backed for the demo (Docker is down → no
  // local Postgres); a DB/CSV-backed implementation swaps in behind the same
  // interface later (see lib/repositories.ts TODOs + supabase/migrations).
  const mandiRepo = new FixtureMandiRepository();
  const priceRepo = new FixturePriceRepository();
  const warehouseRepo = new FixtureWarehouseRepository();
  // v0 explainable forecast; v1 trained model plugs in behind ForecastProvider.
  const forecaster = new SeasonalTrendForecastProvider();
  // Live Open-Meteo (keyless). Feeds the /weather endpoint AND the /decision
  // forecast's quality-risk modifier (spec §2 signal 3). Degradable in /decision.
  const weather = new OpenMeteoWeatherProvider();

  return {
    auth: {
      serviceClient,
      verifyToken: makeSupabaseVerifier(serviceClient),
    },
    authRoutes: {
      serviceClient,
    },
    profile: {
      serviceClient,
      aadhaarKey,
    },
    mandi: { mandis: mandiRepo },
    price: { prices: priceRepo, mandis: mandiRepo },
    warehouse: { warehouses: warehouseRepo },
    decision: { mandis: mandiRepo, prices: priceRepo, forecaster, weather },
    weather: { weather },
  };
}

/**
 * Build the Hono app. Returned (not bound to a port) so tests can call
 * app.request(...) directly. Routes requiring auth are mounted behind the
 * injected auth middleware.
 */
export function buildApp(deps: AppDeps): Hono<AppBindings> {
  const app = new Hono<AppBindings>();

  app.use('*', logger());

  // Centralized error handling — never leak stack traces or sensitive data.
  app.onError((err, c) => {
    if (err instanceof AppError) {
      return jsonError(c, err.status, err.code, err.message, err.details);
    }
    // Unexpected error: log server-side, return a generic message.
    console.error('Unhandled error:', err instanceof Error ? err.message : 'unknown');
    return jsonError(c, 500, 'internal_error', 'An unexpected error occurred');
  });

  app.notFound((c) => jsonError(c, 404, 'not_found', 'Route not found'));

  // Public health check.
  app.get('/health', (c) =>
    c.json({ status: 'ok', service: SERVICE_NAME, time: new Date().toISOString() }),
  );

  // Public auth routes (email/password signup + login). No authMiddleware —
  // these establish a session rather than consuming one.
  app.route('/', createAuthRoutes(deps.authRoutes));

  // Public reference-data routes (no auth): mandi lookup, price history, and
  // warehouses are non-sensitive reference data with no farmer data involved.
  app.route('/', createMandiRoutes(deps.mandi));
  app.route('/', createPriceRoutes(deps.price));
  app.route('/', createWarehouseRoutes(deps.warehouse));
  app.route('/', createWeatherRoutes(deps.weather));

  // Authenticated routes.
  const protectedRoutes = createProfileRoutes(deps.profile);
  app.use('/me', authMiddleware(deps.auth));
  app.use('/me/*', authMiddleware(deps.auth));
  app.route('/', protectedRoutes);

  // POST /decision — auth-protected the same way /me is (reads the farmer's
  // location to derive the mandi set).
  app.use('/decision', authMiddleware(deps.auth));
  app.route('/', createDecisionRoutes(deps.decision));

  return app;
}
