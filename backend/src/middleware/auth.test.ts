import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { AppBindings } from '@/lib/types.ts';
import { authMiddleware, makeSupabaseVerifier, type AuthDeps } from '@/middleware/auth.ts';
import { createFakeSupabase, emptyDb, makeFarmer, type FakeDbState } from '@/lib/test-utils.ts';

const USER_A = '00000000-0000-0000-0000-00000000000a';
const TOKEN_A = 'token-a';

function buildTestApp(deps: AuthDeps): Hono<AppBindings> {
  const app = new Hono<AppBindings>();
  app.use('/me', authMiddleware(deps));
  app.get('/me', (c) => c.json(c.get('auth')));
  return app;
}

function depsFor(state: FakeDbState): AuthDeps {
  const client = createFakeSupabase(state, {
    tokens: { [TOKEN_A]: { id: USER_A, email: 'ramesh@example.in' } },
  });
  return { serviceClient: client, verifyToken: makeSupabaseVerifier(client) };
}

describe('authMiddleware', () => {
  let state: FakeDbState;

  beforeEach(() => {
    state = emptyDb();
  });

  it('401 when Authorization header is missing', async () => {
    const res = await buildTestApp(depsFor(state)).request('/me');
    expect(res.status).toBe(401);
  });

  it('401 when Authorization header is malformed', async () => {
    const res = await buildTestApp(depsFor(state)).request('/me', {
      headers: { Authorization: 'NotBearer xyz' },
    });
    expect(res.status).toBe(401);
  });

  it('401 when token is invalid', async () => {
    const res = await buildTestApp(depsFor(state)).request('/me', {
      headers: { Authorization: 'Bearer bogus-token' },
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('unauthorized');
  });

  it('loads an existing farmer row on a valid token', async () => {
    state.farmers.set(USER_A, makeFarmer({ id: USER_A, full_name: 'Ramesh Kumar' }));
    const res = await buildTestApp(depsFor(state)).request('/me', {
      headers: { Authorization: `Bearer ${TOKEN_A}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { userId: string; farmer: { full_name: string } };
    expect(body.userId).toBe(USER_A);
    expect(body.farmer.full_name).toBe('Ramesh Kumar');
  });

  it('creates a farmer row when none exists (load-or-create)', async () => {
    expect(state.farmers.has(USER_A)).toBe(false);
    const res = await buildTestApp(depsFor(state)).request('/me', {
      headers: { Authorization: `Bearer ${TOKEN_A}` },
    });
    expect(res.status).toBe(200);
    expect(state.farmers.has(USER_A)).toBe(true);
    const created = state.farmers.get(USER_A);
    expect(created?.onboarding_complete).toBe(false);
    // full_name defaults to the email local-part.
    expect(created?.full_name).toBe('ramesh');
  });

  it('never echoes the token in the error body', async () => {
    const res = await buildTestApp(depsFor(state)).request('/me', {
      headers: { Authorization: 'Bearer super-secret-token' },
    });
    const text = await res.text();
    expect(text).not.toContain('super-secret-token');
  });
});
