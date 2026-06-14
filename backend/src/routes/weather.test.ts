import { describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { buildApp, type AppDeps } from '@/app.ts';
import { loadAadhaarKey } from '@/lib/crypto.ts';
import {
  createFakeSupabase,
  emptyDb,
  fixtureRouteDeps,
  stubWeatherProvider,
} from '@/lib/test-utils.ts';
import type { WeatherForecast } from '@/lib/external/weather.ts';

function depsWith(weather: ReturnType<typeof stubWeatherProvider>): AppDeps {
  const client = createFakeSupabase(emptyDb());
  return {
    auth: { serviceClient: client, verifyToken: async () => null },
    authRoutes: { serviceClient: client },
    profile: { serviceClient: client, aadhaarKey: loadAadhaarKey(randomBytes(32).toString('base64')) },
    ...fixtureRouteDeps(),
    weather: { weather },
  };
}

const RAINY: WeatherForecast = {
  daily: [
    { date: '2026-06-13', precipitation_mm: 40, temp_max: 30 },
    { date: '2026-06-14', precipitation_mm: 30, temp_max: 29 },
    { date: '2026-06-15', precipitation_mm: 10, temp_max: 31 },
  ],
  rain_3d_mm: 80,
  quality_risk: 'high',
};

interface WeatherBody {
  lat: number;
  lng: number;
  quality_risk: string;
  rain_3d_mm: number;
  daily: { date: string; precipitation_mm: number; temp_max: number }[];
}

describe('GET /weather', () => {
  it('is PUBLIC (no auth) and returns the forecast + quality_risk', async () => {
    const res = await buildApp(depsWith(stubWeatherProvider(RAINY))).request(
      '/weather?lat=22.72&lng=75.86',
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as WeatherBody;
    expect(body.quality_risk).toBe('high');
    expect(body.rain_3d_mm).toBe(80);
    expect(body.daily.length).toBe(3);
    expect(body.lat).toBe(22.72);
  });

  it('400s on missing/invalid lat', async () => {
    const res = await buildApp(depsWith(stubWeatherProvider())).request('/weather?lng=75.86');
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('validation_error');
  });

  it('503s when the upstream weather provider is unavailable', async () => {
    const res = await buildApp(depsWith(stubWeatherProvider('unavailable'))).request(
      '/weather?lat=22.72&lng=75.86',
    );
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('weather_unavailable');
  });
});
