import type { SupabaseClient } from '@supabase/supabase-js';
import type { FarmerRow } from '@/lib/types.ts';
import {
  FixtureMandiRepository,
  FixturePriceRepository,
  FixtureWarehouseRepository,
} from '@/lib/repositories.ts';
import { SeasonalTrendForecastProvider } from '@/lib/forecast.ts';
import {
  WeatherUnavailableError,
  type WeatherForecast,
  type WeatherProvider,
} from '@/lib/external/weather.ts';

/**
 * Minimal in-memory fake of the Supabase query builder + auth, scoped to the
 * `farmers` table operations this backend actually uses:
 *   .from('farmers').select('*').eq('id', x).maybeSingle()/.single()
 *   .from('farmers').insert({...}).select('*').single()
 *   .from('farmers').update({...}).eq('id', x).select('*').single()
 *   client.auth.getUser(token)
 *   client.auth.admin.createUser({ email, password, email_confirm })
 *   client.auth.signInWithPassword({ email, password })
 *
 * No real network/DB. Lets us unit-test auth middleware, profile, and the
 * email/password auth routes.
 */

/** An in-memory auth user, mirroring the bits of Supabase Auth this backend uses. */
export interface FakeAuthUser {
  id: string;
  email: string;
  password: string;
}

export interface FakeDbState {
  farmers: Map<string, FarmerRow>;
  /** Auth users keyed by lowercased email. Populated by signup; read by login. */
  authUsers: Map<string, FakeAuthUser>;
}

export function makeFarmer(overrides: Partial<FarmerRow> = {}): FarmerRow {
  const now = new Date().toISOString();
  return {
    id: overrides.id ?? '00000000-0000-0000-0000-000000000001',
    created_at: now,
    updated_at: now,
    full_name: null,
    phone: null,
    preferred_language: 'hi',
    aadhaar_enc: null,
    aadhaar_last4: null,
    farm_lat: null,
    farm_lng: null,
    farm_district: null,
    farm_state: null,
    farm_village: null,
    farm_area_value: null,
    farm_area_unit: null,
    primary_crops: null,
    land_record_id: null,
    onboarding_complete: false,
    ...overrides,
  };
}

interface QueryResult<T> {
  data: T | null;
  error: { message: string } | null;
}

type Operation =
  | { kind: 'select' }
  | { kind: 'insert'; values: Record<string, unknown> }
  | { kind: 'update'; values: Record<string, unknown> };

/**
 * A chainable, thenable query builder over the in-memory state. Only the
 * methods used by the backend are implemented; calling anything else is a no-op
 * that preserves chaining.
 */
class FakeQueryBuilder {
  private filterId: string | null = null;

  constructor(
    private readonly state: FakeDbState,
    private readonly op: Operation,
  ) {}

  select(_cols?: string): this {
    return this;
  }

  eq(column: string, value: string): this {
    if (column === 'id') this.filterId = value;
    return this;
  }

  private resolve(): QueryResult<FarmerRow> {
    if (this.op.kind === 'select') {
      const row = this.filterId ? (this.state.farmers.get(this.filterId) ?? null) : null;
      return { data: row, error: null };
    }
    if (this.op.kind === 'insert') {
      const row = makeFarmer(this.op.values as Partial<FarmerRow>);
      this.state.farmers.set(row.id, row);
      return { data: row, error: null };
    }
    // update
    const id = this.filterId;
    if (!id) return { data: null, error: { message: 'update requires an id filter' } };
    const existing = this.state.farmers.get(id);
    if (!existing) return { data: null, error: { message: 'row not found' } };
    const updated: FarmerRow = {
      ...existing,
      ...(this.op.values as Partial<FarmerRow>),
      updated_at: new Date().toISOString(),
    };
    this.state.farmers.set(id, updated);
    return { data: updated, error: null };
  }

  async maybeSingle(): Promise<QueryResult<FarmerRow>> {
    return this.resolve();
  }

  async single(): Promise<QueryResult<FarmerRow>> {
    const result = this.resolve();
    if (result.data === null && result.error === null) {
      return { data: null, error: { message: 'no rows' } };
    }
    return result;
  }

  // Thenable so `await builder` (without single/maybeSingle) also works.
  then<TResult1 = QueryResult<FarmerRow>>(
    onfulfilled?: ((value: QueryResult<FarmerRow>) => TResult1 | PromiseLike<TResult1>) | null,
  ): Promise<TResult1> {
    return Promise.resolve(this.resolve()).then(onfulfilled);
  }
}

class FakeFrom {
  constructor(private readonly state: FakeDbState) {}

  select(_cols?: string): FakeQueryBuilder {
    return new FakeQueryBuilder(this.state, { kind: 'select' });
  }

  insert(values: Record<string, unknown>): FakeQueryBuilder {
    return new FakeQueryBuilder(this.state, { kind: 'insert', values });
  }

  update(values: Record<string, unknown>): FakeQueryBuilder {
    return new FakeQueryBuilder(this.state, { kind: 'update', values });
  }
}

export interface FakeSupabaseOptions {
  /** Map of token -> user returned by auth.getUser. Unknown tokens yield an error. */
  tokens?: Record<string, { id: string; email: string | null }>;
  /** Generates ids for newly created auth users. Defaults to a counter-based uuid-ish id. */
  newUserId?: () => string;
}

/** Build a fake session object in the shape the backend reads from Supabase Auth. */
function fakeSession(user: FakeAuthUser): {
  access_token: string;
  refresh_token: string;
  expires_at: number;
} {
  return {
    access_token: `fake-access-${user.id}`,
    refresh_token: `fake-refresh-${user.id}`,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  };
}

export function createFakeSupabase(
  state: FakeDbState,
  options: FakeSupabaseOptions = {},
): SupabaseClient {
  const tokens = options.tokens ?? {};
  let counter = 0;
  const nextId =
    options.newUserId ??
    (() => {
      counter += 1;
      return `00000000-0000-0000-0000-0000000000${counter.toString().padStart(2, '0')}`;
    });

  const client = {
    from: (table: string) => {
      if (table !== 'farmers') throw new Error(`Unexpected table: ${table}`);
      return new FakeFrom(state);
    },
    auth: {
      getUser: async (token: string) => {
        const user = tokens[token];
        if (!user) {
          return { data: { user: null }, error: { message: 'invalid token' } };
        }
        return { data: { user: { id: user.id, email: user.email ?? undefined } }, error: null };
      },

      signInWithPassword: async (creds: { email: string; password: string }) => {
        const key = creds.email.trim().toLowerCase();
        const user = state.authUsers.get(key);
        if (!user || user.password !== creds.password) {
          return {
            data: { user: null, session: null },
            error: { message: 'Invalid login credentials' },
          };
        }
        return {
          data: {
            user: { id: user.id, email: user.email },
            session: fakeSession(user),
          },
          error: null,
        };
      },

      admin: {
        createUser: async (params: {
          email: string;
          password: string;
          email_confirm?: boolean;
        }) => {
          const key = params.email.trim().toLowerCase();
          if (state.authUsers.has(key)) {
            // Mirrors Supabase's already-registered error.
            return {
              data: { user: null },
              error: { message: 'A user with this email address has already been registered' },
            };
          }
          const user: FakeAuthUser = {
            id: nextId(),
            email: params.email.trim(),
            password: params.password,
          };
          state.authUsers.set(key, user);
          return {
            data: { user: { id: user.id, email: user.email } },
            error: null,
          };
        },
      },
    },
  };
  // Cast through unknown: this fake implements only the surface the backend uses.
  return client as unknown as SupabaseClient;
}

export function emptyDb(): FakeDbState {
  return { farmers: new Map(), authUsers: new Map() };
}

/**
 * Fixture-backed deps for the reference-data + decision routes. These carry no
 * DB/network — they read the in-app fixtures behind the repository interfaces.
 * Tests spread this into their AppDeps so they don't repeat the wiring; the
 * `today` parameter pins the generated price window for deterministic assertions.
 */
export function fixtureRouteDeps(today?: Date) {
  const mandiRepo = new FixtureMandiRepository();
  const priceRepo = new FixturePriceRepository(today);
  const warehouseRepo = new FixtureWarehouseRepository();
  const forecaster = new SeasonalTrendForecastProvider();
  const weather = stubWeatherProvider();
  return {
    mandi: { mandis: mandiRepo },
    price: { prices: priceRepo, mandis: mandiRepo },
    warehouse: { warehouses: warehouseRepo },
    decision: { mandis: mandiRepo, prices: priceRepo, forecaster, weather },
    weather: { weather },
    ask: {},
  };
}

/**
 * Deterministic fake WeatherProvider for tests — no network. Defaults to a dry,
 * low-risk forecast so the weather modifier is a no-op unless a test opts into
 * one. Pass a forecast (or a function of lat/lng) to control the result, or pass
 * 'unavailable' to simulate the provider failing (so the route's graceful
 * degradation can be exercised).
 */
export function stubWeatherProvider(
  forecast?: WeatherForecast | 'unavailable',
): WeatherProvider {
  return {
    getForecast: async () => {
      if (forecast === 'unavailable') {
        throw new WeatherUnavailableError('weather unavailable (stub)');
      }
      return forecast ?? dryForecast();
    },
  };
}

function dryForecast(): WeatherForecast {
  return {
    daily: Array.from({ length: 7 }, (_, i) => ({
      date: `2026-06-${String(13 + i).padStart(2, '0')}`,
      precipitation_mm: 0,
      temp_max: 38,
    })),
    rain_3d_mm: 0,
    quality_risk: 'low',
  };
}
