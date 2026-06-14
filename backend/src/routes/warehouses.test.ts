import { describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { buildApp, type AppDeps } from '@/app.ts';
import { loadAadhaarKey } from '@/lib/crypto.ts';
import { createFakeSupabase, emptyDb, fixtureRouteDeps } from '@/lib/test-utils.ts';

function deps(): AppDeps {
  const client = createFakeSupabase(emptyDb());
  return {
    auth: { serviceClient: client, verifyToken: async () => null },
    authRoutes: { serviceClient: client },
    profile: { serviceClient: client, aadhaarKey: loadAadhaarKey(randomBytes(32).toString('base64')) },
    ...fixtureRouteDeps(),
  };
}

interface WarehousesBody {
  warehouses: {
    warehouse_id: string;
    district: string;
    cost_per_quintal_month: number;
    distance_km?: number;
  }[];
}

describe('GET /warehouses', () => {
  it('sorts by distance when lat/lng given (PUBLIC)', async () => {
    const res = await buildApp(deps()).request('/warehouses?lat=22.7196&lng=75.8577');
    expect(res.status).toBe(200);
    const body = (await res.json()) as WarehousesBody;
    expect(body.warehouses.length).toBeGreaterThan(0);
    expect(body.warehouses[0]!.distance_km).toBeDefined();
    // nearest-first
    for (let i = 1; i < body.warehouses.length; i++) {
      expect(body.warehouses[i]!.distance_km!).toBeGreaterThanOrEqual(
        body.warehouses[i - 1]!.distance_km!,
      );
    }
  });

  it('filters by district when only district given', async () => {
    const res = await buildApp(deps()).request('/warehouses?district=Dewas');
    expect(res.status).toBe(200);
    const body = (await res.json()) as WarehousesBody;
    expect(body.warehouses.length).toBeGreaterThan(0);
    expect(body.warehouses.every((w) => w.district === 'Dewas')).toBe(true);
  });

  it('returns full curated list when no params', async () => {
    const res = await buildApp(deps()).request('/warehouses');
    expect(res.status).toBe(200);
    const body = (await res.json()) as WarehousesBody;
    expect(body.warehouses.length).toBeGreaterThanOrEqual(5);
    // cost is in the ₹20/q/mo family.
    expect(body.warehouses.every((w) => w.cost_per_quintal_month >= 15 && w.cost_per_quintal_month <= 30)).toBe(true);
  });

  it('400s when lat is given without lng', async () => {
    const res = await buildApp(deps()).request('/warehouses?lat=22.7');
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('validation_error');
  });
});
