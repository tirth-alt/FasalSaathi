import { Hono } from 'hono';
import type { AppBindings } from '@/lib/types.ts';
import { jsonError } from '@/lib/errors.ts';
import type { WeatherProvider } from '@/lib/external/weather.ts';
import { WeatherUnavailableError } from '@/lib/external/weather.ts';
import { weatherQuerySchema } from '@/routes/weather.schema.ts';

/**
 * Weather route (spec §3 B5). PUBLIC (no auth): a lat/lng forecast is
 * non-sensitive reference data and the client may need it during onboarding
 * before a session exists. Proxies Open-Meteo and returns the 7-day daily
 * forecast plus the derived quality_risk band.
 *
 * Open-Meteo is LIVE + keyless; on the rare failure we return 503 so the client
 * can fall back, rather than a misleading empty 200.
 */
export interface WeatherDeps {
  weather: WeatherProvider;
}

export function createWeatherRoutes(deps: WeatherDeps): Hono<AppBindings> {
  const app = new Hono<AppBindings>();

  // GET /weather?lat=&lng=
  app.get('/weather', async (c) => {
    const parsed = weatherQuerySchema.safeParse(
      Object.fromEntries(new URL(c.req.url).searchParams),
    );
    if (!parsed.success) {
      return jsonError(c, 400, 'validation_error', 'Invalid query parameters', parsed.error.flatten());
    }

    const { lat, lng } = parsed.data;
    try {
      const forecast = await deps.weather.getForecast(lat, lng);
      return c.json({
        lat,
        lng,
        quality_risk: forecast.quality_risk,
        rain_3d_mm: forecast.rain_3d_mm,
        daily: forecast.daily,
      });
    } catch (err) {
      if (err instanceof WeatherUnavailableError) {
        return jsonError(c, 503, 'weather_unavailable', 'Weather service is temporarily unavailable');
      }
      throw err; // unexpected — let the centralized handler log + 500
    }
  });

  return app;
}
