/**
 * Agmarknet client via the data.gov.in OGD platform (spec §5).
 *
 * STATUS (verified 2026-06-13): the gateway is DOWN — persistent HTTP 502. This
 * client is built "ready for when the gateway recovers", NOT as a live dependency.
 * Every call returns a typed result and NEVER throws uncaught: on failure it
 * returns { available: false, ... } with a clear reason. No endpoint should block
 * on this being up — daily prices come from a cached snapshot / sourced dataset
 * (see the Kaggle-import TODO below).
 *
 * API shape (documented data.gov.in resource API):
 *   GET https://api.data.gov.in/resource/{resourceId}
 *     ?api-key=<key>&format=json&limit=<n>&offset=<n>
 *     &filters[state]=...&filters[district]=...&filters[commodity]=...
 *   → { records: [ { state, district, market, commodity, modal_price,
 *                    min_price, max_price, arrival_date, ... }, ... ], ... }
 *
 * The public sample api-key (579b...) is rate-limited and meant for trials; a real
 * key goes in DATA_GOV_IN_API_KEY. Field names in the raw records vary by snake_case
 * vs Title Case across datasets, so the mapper is tolerant of both.
 *
 * TODO (post-Supabase, daily-price backfill): the LIVE daily price feed is down,
 * so the real daily dataset is imported from the Kaggle dataset "Daily Market
 * Prices of Commodity India 2001-2026" (khandelwalmanas) into a DbPriceRepository
 * behind the existing PriceRepository interface. This client remains the
 * best-effort live-refresh path once the gateway recovers (spec §3 B3).
 */

/** Default documented resource id for the Agmarknet daily price dataset. */
export const AGMARKNET_RESOURCE_ID = '9ef84268-d588-465a-a308-a864a43d0070';
/** Public sample key (rate-limited). Overridden by DATA_GOV_IN_API_KEY in config. */
export const DATA_GOV_IN_SAMPLE_KEY = '579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b';

const DATA_GOV_IN_BASE = 'https://api.data.gov.in/resource';
const DEFAULT_TIMEOUT_MS = 6000;
const DEFAULT_LIMIT = 50;

export interface AgmarknetRecord {
  state: string;
  district: string;
  market: string;
  commodity: string;
  modal_price: number;
  min_price: number;
  max_price: number;
  arrival_date: string;
}

export interface AgmarknetQuery {
  state?: string;
  district?: string;
  commodity?: string;
  market?: string;
  limit?: number;
  offset?: number;
}

/** Discriminated result — callers branch on `available` and never see a throw. */
export type AgmarknetResult =
  | { available: true; records: AgmarknetRecord[]; total?: number }
  | { available: false; reason: string; status?: number };

export interface AgmarknetHealth {
  up: boolean;
  status?: number;
  detail: string;
}

export interface AgmarknetClientOptions {
  apiKey?: string;
  resourceId?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

interface RawDataGovResponse {
  records?: unknown;
  total?: unknown;
  count?: unknown;
}

export class AgmarknetClient {
  private readonly apiKey: string;
  private readonly resourceId: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: AgmarknetClientOptions = {}) {
    this.apiKey = options.apiKey ?? DATA_GOV_IN_SAMPLE_KEY;
    this.resourceId = options.resourceId ?? AGMARKNET_RESOURCE_ID;
    this.baseUrl = options.baseUrl ?? DATA_GOV_IN_BASE;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private buildUrl(query: AgmarknetQuery): string {
    const params = new URLSearchParams();
    params.set('api-key', this.apiKey);
    params.set('format', 'json');
    params.set('limit', String(query.limit ?? DEFAULT_LIMIT));
    if (query.offset !== undefined) params.set('offset', String(query.offset));
    if (query.state) params.set('filters[state]', query.state);
    if (query.district) params.set('filters[district]', query.district);
    if (query.commodity) params.set('filters[commodity]', query.commodity);
    if (query.market) params.set('filters[market]', query.market);
    return `${this.baseUrl}/${this.resourceId}?${params.toString()}`;
  }

  /**
   * Fetch daily price records. Returns a typed result; never throws. On any
   * network/timeout/HTTP/parse failure → { available: false, reason }.
   */
  async getPrices(query: AgmarknetQuery = {}): Promise<AgmarknetResult> {
    const url = this.buildUrl(query);

    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: { accept: 'application/json' },
      });
    } catch (err) {
      return {
        available: false,
        reason: `request failed (network/timeout): ${errMsg(err)}`,
      };
    }

    if (!res.ok) {
      // The known-current state is 502 from the gateway — surface it clearly.
      return {
        available: false,
        reason: `data.gov.in returned HTTP ${res.status}`,
        status: res.status,
      };
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch (err) {
      return { available: false, reason: `non-JSON response: ${errMsg(err)}` };
    }

    const raw = json as RawDataGovResponse;
    if (!Array.isArray(raw.records)) {
      return { available: false, reason: 'response missing a records array' };
    }

    const records = raw.records
      .map(mapRecord)
      .filter((r): r is AgmarknetRecord => r !== null);

    const total = typeof raw.total === 'number' ? raw.total : undefined;
    return total !== undefined
      ? { available: true, records, total }
      : { available: true, records };
  }

  /** Lightweight up/down probe (a 1-record fetch). Never throws. */
  async checkHealth(): Promise<AgmarknetHealth> {
    const result = await this.getPrices({ limit: 1 });
    if (result.available) {
      return { up: true, detail: `ok — ${result.records.length} sample record(s)` };
    }
    return result.status !== undefined
      ? { up: false, status: result.status, detail: result.reason }
      : { up: false, detail: result.reason };
  }
}

/**
 * Map one raw data.gov.in record to our AgmarknetRecord. Tolerant of snake_case
 * and Title Case field names (datasets vary). Returns null if it can't extract a
 * usable modal price (a row with no price is useless downstream).
 */
function mapRecord(raw: unknown): AgmarknetRecord | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;

  const modal = num(pick(r, 'modal_price', 'Modal_Price', 'modal_x0020_price'));
  if (modal === null) return null;

  return {
    state: str(pick(r, 'state', 'State')),
    district: str(pick(r, 'district', 'District')),
    market: str(pick(r, 'market', 'Market')),
    commodity: str(pick(r, 'commodity', 'Commodity')),
    modal_price: modal,
    min_price: num(pick(r, 'min_price', 'Min_Price', 'min_x0020_price')) ?? modal,
    max_price: num(pick(r, 'max_price', 'Max_Price', 'max_x0020_price')) ?? modal,
    arrival_date: str(pick(r, 'arrival_date', 'Arrival_Date')),
  };
}

function pick(r: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (r[k] !== undefined && r[k] !== null && r[k] !== '') return r[k];
  }
  return undefined;
}

function num(v: unknown): number | null {
  if (v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string {
  return v === undefined ? '' : String(v);
}

function errMsg(err: unknown): string {
  if (err instanceof Error) {
    // AbortSignal.timeout throws a DOMException named "TimeoutError".
    if (err.name === 'TimeoutError') return 'timeout';
    return err.message;
  }
  return 'unknown error';
}
