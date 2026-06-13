import { describe, it, expect } from 'vitest';
import { AgmarknetClient } from '@/lib/external/agmarknet.ts';

function fakeFetch(
  status: number,
  body: unknown,
  capture?: (url: string) => void,
): typeof fetch {
  return (async (url: string) => {
    capture?.(url);
    const ok = status >= 200 && status < 300;
    return new Response(ok ? JSON.stringify(body) : 'gateway error', {
      status,
      headers: { 'content-type': ok ? 'application/json' : 'text/plain' },
    });
  }) as unknown as typeof fetch;
}

/** A data.gov.in-style record set, mixing Title_Case and snake_case keys. */
const SAMPLE_RECORDS = {
  total: 2,
  records: [
    {
      state: 'Madhya Pradesh',
      district: 'Indore',
      market: 'Indore',
      commodity: 'Soybean',
      min_price: '4500',
      max_price: '5200',
      modal_price: '4850',
      arrival_date: '13/06/2026',
    },
    {
      State: 'Madhya Pradesh',
      District: 'Dewas',
      Market: 'Dewas',
      Commodity: 'Soybean',
      Min_Price: '4400',
      Max_Price: '5100',
      Modal_Price: '4750',
      Arrival_Date: '13/06/2026',
    },
  ],
};

describe('AgmarknetClient.getPrices', () => {
  it('parses records and maps both snake_case and Title_Case fields', async () => {
    const client = new AgmarknetClient({ fetchImpl: fakeFetch(200, SAMPLE_RECORDS) });
    const result = await client.getPrices({ commodity: 'soybean', state: 'Madhya Pradesh' });
    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.records).toHaveLength(2);
    expect(result.records[0]).toMatchObject({
      district: 'Indore',
      commodity: 'Soybean',
      modal_price: 4850,
      min_price: 4500,
      max_price: 5200,
    });
    // Title_Case row mapped too.
    expect(result.records[1]!.modal_price).toBe(4750);
    expect(result.total).toBe(2);
  });

  it('builds the documented URL with api-key, format, filters, limit', async () => {
    let seen = '';
    const client = new AgmarknetClient({
      apiKey: 'TESTKEY',
      fetchImpl: fakeFetch(200, { records: [] }, (u) => (seen = u)),
    });
    await client.getPrices({ commodity: 'Soybean', district: 'Indore', limit: 10 });
    expect(seen).toContain('/9ef84268-d588-465a-a308-a864a43d0070?');
    expect(seen).toContain('api-key=TESTKEY');
    expect(seen).toContain('format=json');
    expect(seen).toContain('limit=10');
    expect(seen).toContain('filters%5Bcommodity%5D=Soybean'); // filters[commodity]
    expect(seen).toContain('filters%5Bdistrict%5D=Indore');
  });

  it('returns { available: false, status } on a 502 (the current gateway state) — never throws', async () => {
    const client = new AgmarknetClient({ fetchImpl: fakeFetch(502, null) });
    const result = await client.getPrices();
    expect(result.available).toBe(false);
    if (result.available) return;
    expect(result.status).toBe(502);
    expect(result.reason).toMatch(/502/);
  });

  it('returns { available: false } on a network/timeout failure — never throws', async () => {
    const failing = (async () => {
      throw new Error('socket hang up');
    }) as unknown as typeof fetch;
    const client = new AgmarknetClient({ fetchImpl: failing });
    const result = await client.getPrices();
    expect(result.available).toBe(false);
    if (result.available) return;
    expect(result.reason).toMatch(/request failed/);
  });

  it('drops records that have no modal price', async () => {
    const client = new AgmarknetClient({
      fetchImpl: fakeFetch(200, { records: [{ state: 'MP', commodity: 'X' }] }),
    });
    const result = await client.getPrices();
    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.records).toHaveLength(0);
  });
});

describe('AgmarknetClient.checkHealth', () => {
  it('reports up on a 200', async () => {
    const client = new AgmarknetClient({ fetchImpl: fakeFetch(200, { records: [] }) });
    const health = await client.checkHealth();
    expect(health.up).toBe(true);
  });

  it('reports down with the status on a 502', async () => {
    const client = new AgmarknetClient({ fetchImpl: fakeFetch(502, null) });
    const health = await client.checkHealth();
    expect(health.up).toBe(false);
    expect(health.status).toBe(502);
  });
});
