import { describe, it, expect } from 'vitest';
import {
  OpenMeteoWeatherProvider,
  WeatherUnavailableError,
  deriveQualityRisk,
  parseOpenMeteo,
} from '@/lib/external/weather.ts';

/** A realistic Open-Meteo daily payload (shape verified against the live API). */
function meteoPayload(precip: number[], tmax?: number[]): unknown {
  const time = precip.map((_, i) => `2026-06-${String(13 + i).padStart(2, '0')}`);
  return {
    latitude: 22.72,
    longitude: 75.86,
    daily_units: { time: 'iso8601', precipitation_sum: 'mm', temperature_2m_max: '°C' },
    daily: {
      time,
      precipitation_sum: precip,
      temperature_2m_max: tmax ?? precip.map(() => 35),
    },
  };
}

/** Minimal fake fetch returning a given status + JSON body. */
function fakeFetch(status: number, body: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch;
}

describe('deriveQualityRisk', () => {
  it('low when 3-day rain under the med threshold', () => {
    expect(deriveQualityRisk(0)).toBe('low');
    expect(deriveQualityRisk(24.9)).toBe('low');
  });
  it('med at/above 25mm, high at/above 60mm', () => {
    expect(deriveQualityRisk(25)).toBe('med');
    expect(deriveQualityRisk(59.9)).toBe('med');
    expect(deriveQualityRisk(60)).toBe('high');
    expect(deriveQualityRisk(200)).toBe('high');
  });
});

describe('parseOpenMeteo', () => {
  it('maps daily arrays and sums the first 3 days for rain_3d_mm', () => {
    const fc = parseOpenMeteo(meteoPayload([10, 20, 5, 0, 0, 0, 0]));
    expect(fc.daily).toHaveLength(7);
    expect(fc.daily[0]).toEqual({ date: '2026-06-13', precipitation_mm: 10, temp_max: 35 });
    expect(fc.rain_3d_mm).toBe(35); // 10 + 20 + 5
    expect(fc.quality_risk).toBe('med');
  });

  it('flags high quality_risk on heavy 3-day rain', () => {
    const fc = parseOpenMeteo(meteoPayload([40, 30, 10, 0, 0, 0, 0]));
    expect(fc.rain_3d_mm).toBe(80);
    expect(fc.quality_risk).toBe('high');
  });

  it('treats null precipitation values as 0 (Open-Meteo can return null)', () => {
    const fc = parseOpenMeteo(meteoPayload([null as unknown as number, 5, 5, 0, 0, 0, 0]));
    expect(fc.daily[0]!.precipitation_mm).toBe(0);
    expect(fc.rain_3d_mm).toBe(10);
  });

  it('throws WeatherUnavailableError when daily arrays are missing', () => {
    expect(() => parseOpenMeteo({ daily: {} })).toThrow(WeatherUnavailableError);
    expect(() => parseOpenMeteo({})).toThrow(WeatherUnavailableError);
  });

  it('throws on an empty series', () => {
    expect(() => parseOpenMeteo(meteoPayload([]))).toThrow(WeatherUnavailableError);
  });
});

describe('OpenMeteoWeatherProvider.getForecast', () => {
  it('fetches and parses a live-shaped 200 response', async () => {
    const provider = new OpenMeteoWeatherProvider({
      fetchImpl: fakeFetch(200, meteoPayload([0, 0, 0, 0, 0, 0, 0])),
    });
    const fc = await provider.getForecast(22.72, 75.86);
    expect(fc.quality_risk).toBe('low');
    expect(fc.daily).toHaveLength(7);
  });

  it('throws WeatherUnavailableError on a non-200 status', async () => {
    const provider = new OpenMeteoWeatherProvider({ fetchImpl: fakeFetch(500, {}) });
    await expect(provider.getForecast(22.72, 75.86)).rejects.toBeInstanceOf(
      WeatherUnavailableError,
    );
  });

  it('throws WeatherUnavailableError when fetch rejects (network/timeout)', async () => {
    const failing = (async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    const provider = new OpenMeteoWeatherProvider({ fetchImpl: failing });
    await expect(provider.getForecast(22.72, 75.86)).rejects.toBeInstanceOf(
      WeatherUnavailableError,
    );
  });
});
