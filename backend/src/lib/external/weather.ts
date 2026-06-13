/**
 * Open-Meteo weather client (spec §5, §2 signal 3 — weather/quality-risk modifier).
 *
 * Open-Meteo is LIVE and KEYLESS (verified 2026-06-13, HTTP 200). We pull the
 * 7-day daily precipitation + max-temp forecast for a lat/lng and derive:
 *   - rain_3d_mm: total precipitation over the next 3 days (open-storage horizon)
 *   - quality_risk: low | med | high, thresholded on rain_3d_mm
 *
 * quality_risk feeds two things downstream:
 *   1. The /weather endpoint (B5) returns it directly.
 *   2. The /decision flow passes it into the forecaster as a range-widening
 *      modifier (replacing the old seasonal-month monsoon STAND-IN). Heavy rain
 *      → quality risk for open storage + possible supply-driven swing → WIDEN the
 *      forecast range / add a risk note; it does NOT move the forecast centre
 *      (spec §2: "widen the range, don't move the centre").
 *
 * Network discipline: short timeout, and a typed result rather than throwing, so
 * the route can degrade gracefully (the on-device app must work offline anyway —
 * weather is an enhancer, never a hard dependency).
 */

const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast';
const DEFAULT_TIMEOUT_MS = 8000;
const FORECAST_DAYS = 7;
/** Window over which open-storage quality risk is judged (spec §2). */
const RAIN_WINDOW_DAYS = 3;

/** Rain thresholds (mm over the 3-day window) → quality_risk band. */
const RAIN_MED_MM = 25;
const RAIN_HIGH_MM = 60;

export type QualityRisk = 'low' | 'med' | 'high';

export interface DailyWeather {
  date: string; // YYYY-MM-DD
  precipitation_mm: number;
  temp_max: number;
}

export interface WeatherForecast {
  daily: DailyWeather[];
  /** Total precipitation over the next RAIN_WINDOW_DAYS days (mm). */
  rain_3d_mm: number;
  quality_risk: QualityRisk;
}

/** Provider seam so the /weather route + /decision flow can inject a mock. */
export interface WeatherProvider {
  getForecast(lat: number, lng: number): Promise<WeatherForecast>;
}

/** Shape of the Open-Meteo daily payload we consume (others ignored). */
interface OpenMeteoResponse {
  daily?: {
    time?: unknown;
    precipitation_sum?: unknown;
    temperature_2m_max?: unknown;
  };
}

export class WeatherUnavailableError extends Error {
  constructor(
    message: string,
    public readonly reason?: unknown,
  ) {
    super(message);
    this.name = 'WeatherUnavailableError';
  }
}

/**
 * Derive the quality-risk band from total 3-day rainfall. Pure + exported so the
 * threshold logic is unit-tested directly.
 */
export function deriveQualityRisk(rain3dMm: number): QualityRisk {
  if (rain3dMm >= RAIN_HIGH_MM) return 'high';
  if (rain3dMm >= RAIN_MED_MM) return 'med';
  return 'low';
}

/**
 * Map a raw Open-Meteo response to our WeatherForecast. Pure + exported so
 * parsing is unit-tested with a fixture without touching the network. Throws
 * WeatherUnavailableError if the daily arrays are missing/misaligned.
 */
export function parseOpenMeteo(raw: unknown): WeatherForecast {
  const daily = (raw as OpenMeteoResponse)?.daily;
  const time = daily?.time;
  const precip = daily?.precipitation_sum;
  const tmax = daily?.temperature_2m_max;

  if (!Array.isArray(time) || !Array.isArray(precip) || !Array.isArray(tmax)) {
    throw new WeatherUnavailableError('Open-Meteo response missing daily arrays');
  }
  const n = Math.min(time.length, precip.length, tmax.length);
  if (n === 0) {
    throw new WeatherUnavailableError('Open-Meteo returned empty daily series');
  }

  const days: DailyWeather[] = [];
  for (let i = 0; i < n; i++) {
    days.push({
      date: String(time[i]),
      // Open-Meteo may return null for a field on a given day; treat as 0/NaN-safe.
      precipitation_mm: toNumber(precip[i]),
      temp_max: toNumber(tmax[i]),
    });
  }

  const rain3d = days
    .slice(0, RAIN_WINDOW_DAYS)
    .reduce((sum, d) => sum + d.precipitation_mm, 0);
  const rain3dMm = Math.round(rain3d * 10) / 10;

  return {
    daily: days,
    rain_3d_mm: rain3dMm,
    quality_risk: deriveQualityRisk(rain3dMm),
  };
}

function toNumber(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export interface OpenMeteoClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

/**
 * Live Open-Meteo client. Keyless. Throws WeatherUnavailableError on any network
 * / timeout / parse failure so callers can decide how to degrade — the route
 * catches it and the /decision flow simply omits the weather modifier.
 */
export class OpenMeteoWeatherProvider implements WeatherProvider {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OpenMeteoClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? OPEN_METEO_BASE;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async getForecast(lat: number, lng: number): Promise<WeatherForecast> {
    const url =
      `${this.baseUrl}?latitude=${encodeURIComponent(lat)}` +
      `&longitude=${encodeURIComponent(lng)}` +
      `&daily=precipitation_sum,temperature_2m_max` +
      `&forecast_days=${FORECAST_DAYS}&timezone=auto`;

    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: { accept: 'application/json' },
      });
    } catch (err) {
      throw new WeatherUnavailableError('Open-Meteo request failed (network/timeout)', err);
    }

    if (!res.ok) {
      throw new WeatherUnavailableError(`Open-Meteo returned HTTP ${res.status}`);
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch (err) {
      throw new WeatherUnavailableError('Open-Meteo returned non-JSON body', err);
    }

    return parseOpenMeteo(json);
  }
}
