import { describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { buildApp, type AppDeps } from '@/app.ts';
import { loadAadhaarKey } from '@/lib/crypto.ts';
import { createFakeSupabase, emptyDb } from '@/lib/test-utils.ts';

function deps(): AppDeps {
  const client = createFakeSupabase(emptyDb());
  return {
    auth: { serviceClient: client, verifyToken: async () => null },
    profile: { serviceClient: client, aadhaarKey: loadAadhaarKey(randomBytes(32).toString('base64')) },
  };
}

describe('GET /health', () => {
  it('returns ok with service name and ISO time', async () => {
    const res = await buildApp(deps()).request('/health');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; service: string; time: string };
    expect(body.status).toBe('ok');
    expect(body.service).toBe('fasalsaathi-backend');
    expect(() => new Date(body.time).toISOString()).not.toThrow();
  });
});

describe('unknown route', () => {
  it('returns 404 JSON', async () => {
    const res = await buildApp(deps()).request('/does-not-exist');
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('not_found');
  });
});
