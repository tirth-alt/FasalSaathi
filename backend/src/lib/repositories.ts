/**
 * Repository interfaces + fixture-backed implementations for mandi, price, and
 * warehouse reference data.
 *
 * DESIGN: routes depend only on these interfaces, never on the fixtures directly.
 * The fixture implementations are the demo data source (Docker is down here, so no
 * local Postgres). A DB/CSV-backed implementation swaps in behind the same
 * interface later — see the TODOs below and supabase/migrations for the documented
 * future schema. Tests and routes run purely off the fixture repos.
 */

import { MANDIS, type Mandi } from '@/data/mandis.ts';
import { generatePriceData, type MandiPriceSeries, type PricePoint } from '@/data/prices.ts';
import { WAREHOUSES, type Warehouse } from '@/data/warehouses.ts';

export interface MandiRepository {
  listAll(): Mandi[];
  getById(id: string): Mandi | null;
}

export interface PriceRepository {
  /** Recent modal-price history (oldest → newest) for one mandi, up to `days`. */
  getHistory(commodity: string, mandiId: string, days: number): PricePoint[];
  /** Latest modal price for one mandi, or null if unknown commodity/mandi. */
  getLatestModal(commodity: string, mandiId: string): number | null;
}

export interface WarehouseRepository {
  listAll(): Warehouse[];
}

// --- Fixture-backed implementations -----------------------------------------

export class FixtureMandiRepository implements MandiRepository {
  // TODO: swap for a DbMandiRepository reading the `mandis` table (see
  // supabase/migrations) behind this same interface — no route changes needed.
  listAll(): Mandi[] {
    return [...MANDIS];
  }

  getById(id: string): Mandi | null {
    return MANDIS.find((m) => m.mandi_id === id) ?? null;
  }
}

export class FixturePriceRepository implements PriceRepository {
  private readonly data: MandiPriceSeries[];
  private readonly index: Map<string, MandiPriceSeries>;

  /** `today` is injectable so tests can pin the generated window. */
  constructor(today: Date = new Date()) {
    // TODO: swap for a DbPriceRepository reading the `daily_prices` table (or a
    // cached Agmarknet snapshot / sourced historical CSV) behind this interface.
    this.data = generatePriceData(today);
    this.index = new Map(this.data.map((s) => [`${s.commodity}:${s.mandi_id}`, s]));
  }

  getHistory(commodity: string, mandiId: string, days: number): PricePoint[] {
    const series = this.index.get(`${commodity.toLowerCase()}:${mandiId}`);
    if (!series) return [];
    const n = Math.max(1, Math.floor(days));
    return series.series.slice(-n);
  }

  getLatestModal(commodity: string, mandiId: string): number | null {
    const series = this.index.get(`${commodity.toLowerCase()}:${mandiId}`);
    if (!series || series.series.length === 0) return null;
    return series.series[series.series.length - 1]!.modal_price;
  }
}

export class FixtureWarehouseRepository implements WarehouseRepository {
  // TODO: swap for a DB-backed repository if the curated list ever moves to a table.
  listAll(): Warehouse[] {
    return [...WAREHOUSES];
  }
}
