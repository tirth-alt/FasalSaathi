import { describe, it, expect } from 'vitest';
import { CedaClient } from '@/lib/external/ceda.ts';

function jsonFetch(status: number, body: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch;
}

describe('CedaClient.getMonthlyTrend', () => {
  it('returns { available: false } when the data endpoint is not configured (shell state)', async () => {
    const client = new CedaClient({ fetchImpl: jsonFetch(200, {}) });
    const result = await client.getMonthlyTrend('soybean', 'Indore');
    expect(result.available).toBe(false);
    if (result.available) return;
    expect(result.reason).toMatch(/not configured/i);
  });

  it('does not throw even with a configured (but unmapped) endpoint — fails closed', async () => {
    const client = new CedaClient({
      dataPath: '/some/guessed/path',
      fetchImpl: jsonFetch(200, { data: [] }),
    });
    const result = await client.getMonthlyTrend('soybean', 'Indore');
    // mapResponse is a deliberate placeholder until the shape is confirmed.
    expect(result.available).toBe(false);
  });
});

describe('CedaClient.fetchSpec', () => {
  it('extracts path names from an OpenAPI spec', async () => {
    const spec = {
      openapi: '3.0.0',
      paths: { '/v1/prices/monthly': {}, '/v1/commodities': {} },
    };
    const client = new CedaClient({ fetchImpl: jsonFetch(200, spec) });
    const result = await client.fetchSpec();
    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.paths).toContain('/v1/prices/monthly');
  });

  it('reports unavailable when no spec JSON is served (Swagger UI shell)', async () => {
    // 404 on every probed path.
    const client = new CedaClient({ fetchImpl: jsonFetch(404, {}) });
    const result = await client.fetchSpec();
    expect(result.available).toBe(false);
  });
});
