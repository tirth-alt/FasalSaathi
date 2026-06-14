/**
 * CEDA Ashoka client (spec §5) — historical MONTHLY commodity prices, the backbone
 * for the seasonal forecast index (spec §2) and F4 trend charts.
 *
 * STATUS (2026-06-13): host is UP (HTTP 200) at https://api.ceda.ashoka.edu.in/
 * with Swagger UI at /documentation/. The Swagger UI is a JS-rendered single-page
 * app whose underlying OpenAPI spec could NOT be reliably introspected from the
 * build environment (the rendered HTML is an empty shell; spec-JSON paths probed:
 * /documentation/json, /openapi.json — see fetchSpec() which probes them at
 * runtime). So per the task's "do not guess blindly" instruction, the data
 * endpoint + auth requirements are NOT hard-coded. This is a CLIENT SHELL:
 *
 *   - fetchSpec(): pulls the live OpenAPI spec so we can SEE the real paths (used
 *     by scripts/check-external.ts to report what CEDA exposes — real evidence,
 *     not a guess).
 *   - getMonthlyTrend(commodity, region): targets a CONFIGURABLE dataPath. Until
 *     the real path is confirmed from the spec, it is left unset and the method
 *     returns { available: false, reason: 'endpoint not configured' } rather than
 *     hitting a guessed URL.
 *
 * TODO (confirm endpoint): run `npm run check:external` (or open
 * https://api.ceda.ashoka.edu.in/documentation/ in a browser), read the OpenAPI
 * spec, identify the monthly-price path + its params + auth scheme, then set
 * `dataPath` / `responseShape` here and finish mapResponse(). Many CEDA endpoints
 * require an API key / bearer token — capture that in config if so. Once wired,
 * this feeds the offline `build_forecast` data-prep job (spec §2, §3).
 */

const CEDA_BASE = 'https://api.ceda.ashoka.edu.in';
const DEFAULT_TIMEOUT_MS = 8000;
/** OpenAPI spec locations to probe, in order. Swagger UI lives at /documentation/. */
const SPEC_PATHS = ['/documentation/json', '/openapi.json', '/swagger.json', '/documentation/swagger.json'];

export interface MonthlyPricePoint {
  month: string; // YYYY-MM
  modal_price: number;
}

export type CedaTrendResult =
  | { available: true; points: MonthlyPricePoint[] }
  | { available: false; reason: string; status?: number };

export type CedaSpecResult =
  | { available: true; specPath: string; paths: string[]; raw: unknown }
  | { available: false; reason: string };

export interface CedaClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  /** The confirmed data endpoint path for monthly prices. UNSET until verified from the spec. */
  dataPath?: string;
  /** Optional auth header (e.g. Bearer token / api key) if the spec requires it. */
  authHeader?: { name: string; value: string };
  fetchImpl?: typeof fetch;
}

export class CedaClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly dataPath: string | undefined;
  private readonly authHeader: { name: string; value: string } | undefined;
  private readonly fetchImpl: typeof fetch;

  constructor(options: CedaClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? CEDA_BASE;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.dataPath = options.dataPath;
    this.authHeader = options.authHeader;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { accept: 'application/json' };
    if (this.authHeader) h[this.authHeader.name] = this.authHeader.value;
    return h;
  }

  /**
   * Probe the live OpenAPI spec so we can discover the real endpoint paths. Tries
   * the known spec locations in order. Returns the path list on success. Never
   * throws — this is a diagnostic used by the live check script.
   */
  async fetchSpec(): Promise<CedaSpecResult> {
    const tried: string[] = [];
    for (const path of SPEC_PATHS) {
      tried.push(path);
      try {
        const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
          signal: AbortSignal.timeout(this.timeoutMs),
          headers: { accept: 'application/json' },
        });
        if (!res.ok) continue;
        const ct = res.headers.get('content-type') ?? '';
        if (!ct.includes('json')) continue;
        const raw = (await res.json()) as { paths?: Record<string, unknown> };
        const paths = raw && typeof raw.paths === 'object' ? Object.keys(raw.paths) : [];
        return { available: true, specPath: path, paths, raw };
      } catch {
        // try the next candidate
      }
    }
    return {
      available: false,
      reason: `no OpenAPI spec JSON found; probed: ${tried.join(', ')} (Swagger UI at /documentation/ is JS-rendered)`,
    };
  }

  /**
   * Historical monthly modal-price trend for a commodity in a market/state.
   * Returns { available: false } until the data endpoint is confirmed (see the
   * TODO at the top of this file) — we do NOT hit a guessed URL.
   */
  async getMonthlyTrend(commodity: string, region: string): Promise<CedaTrendResult> {
    if (!this.dataPath) {
      return {
        available: false,
        reason:
          'CEDA monthly-price endpoint not configured — confirm the path from the OpenAPI spec (run `npm run check:external`) and set CedaClient { dataPath }',
      };
    }

    const url = `${this.baseUrl}${this.dataPath}?commodity=${encodeURIComponent(commodity)}&region=${encodeURIComponent(region)}`;
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: this.headers(),
      });
    } catch (err) {
      return { available: false, reason: `request failed: ${err instanceof Error ? err.message : 'unknown'}` };
    }
    if (!res.ok) {
      return { available: false, reason: `CEDA returned HTTP ${res.status}`, status: res.status };
    }
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      return { available: false, reason: 'non-JSON response' };
    }
    // TODO: implement mapResponse once the real response shape is known from the spec.
    return mapResponse(json);
  }
}

/**
 * Map the CEDA monthly-price response to MonthlyPricePoint[]. SHAPE UNKNOWN until
 * the endpoint is confirmed — this is a placeholder that fails closed rather than
 * inventing a parse. Replace the body once the spec/response is verified.
 */
function mapResponse(_raw: unknown): CedaTrendResult {
  return {
    available: false,
    reason: 'CEDA response mapping not implemented — confirm response shape from the OpenAPI spec first',
  };
}
