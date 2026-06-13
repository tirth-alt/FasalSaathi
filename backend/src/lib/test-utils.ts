import type { SupabaseClient } from '@supabase/supabase-js';
import type { FarmerRow } from '@/lib/types.ts';

/**
 * Minimal in-memory fake of the Supabase query builder + auth, scoped to the
 * `farmers` table operations this backend actually uses:
 *   .from('farmers').select('*').eq('id', x).maybeSingle()/.single()
 *   .from('farmers').insert({...}).select('*').single()
 *   .from('farmers').update({...}).eq('id', x).select('*').single()
 *   client.auth.getUser(token)
 *
 * No real network/DB. Lets us unit-test auth middleware and profile routes.
 */

export interface FakeDbState {
  farmers: Map<string, FarmerRow>;
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
}

export function createFakeSupabase(
  state: FakeDbState,
  options: FakeSupabaseOptions = {},
): SupabaseClient {
  const tokens = options.tokens ?? {};
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
    },
  };
  // Cast through unknown: this fake implements only the surface the backend uses.
  return client as unknown as SupabaseClient;
}

export function emptyDb(): FakeDbState {
  return { farmers: new Map() };
}
