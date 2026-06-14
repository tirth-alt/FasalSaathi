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

interface NearbyBody {
  mandis: { mandi_id: string; name: string; distance_km: number; state: string }[];
}

describe('GET /mandis/nearby', () => {
  it('is PUBLIC (no auth) and returns nearest mandis with distance_km', async () => {
    // Indore coordinates.
    const res = await buildApp(deps()).request('/mandis/nearby?lat=22.7196&lng=75.8577&limit=3');
    expect(res.status).toBe(200);
    const body = (await res.json()) as NearbyBody;
    expect(body.mandis).toHaveLength(3);
    // Sorted nearest-first.
    expect(body.mandis[0]!.distance_km).toBeLessThanOrEqual(body.mandis[1]!.distance_km);
    expect(body.mandis[1]!.distance_km).toBeLessThanOrEqual(body.mandis[2]!.distance_km);
    // Nearest to Indore coords should be an Indore mandi.
    expect(body.mandis[0]!.mandi_id.startsWith('IND')).toBe(true);
    expect(body.mandis[0]!.state).toBe('Madhya Pradesh');
  });

  it('defaults limit to 10', async () => {
    const res = await buildApp(deps()).request('/mandis/nearby?lat=22.7196&lng=75.8577');
    expect(res.status).toBe(200);
    const body = (await res.json()) as NearbyBody;
    expect(body.mandis.length).toBe(10);
  });

  it('400s on missing/invalid lat', async () => {
    const res = await buildApp(deps()).request('/mandis/nearby?lng=75.8577');
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('validation_error');
  });

  it('400s on out-of-range lat', async () => {
    const res = await buildApp(deps()).request('/mandis/nearby?lat=200&lng=75');
    expect(res.status).toBe(400);
  });
});
