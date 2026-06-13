import { describe, it, expect, beforeEach } from 'vitest';
import { randomBytes } from 'node:crypto';
import { buildApp, type AppDeps } from '@/app.ts';
import { loadAadhaarKey } from '@/lib/crypto.ts';
import { makeSupabaseVerifier } from '@/middleware/auth.ts';
import { createFakeSupabase, emptyDb, makeFarmer, type FakeDbState } from '@/lib/test-utils.ts';

const USER_A = '00000000-0000-0000-0000-00000000000a';
const TOKEN_A = 'token-a';
const AUTH_HEADER = { Authorization: `Bearer ${TOKEN_A}`, 'Content-Type': 'application/json' };
const PLAINTEXT_AADHAAR = '123456789012';

const aadhaarKey = loadAadhaarKey(randomBytes(32).toString('base64'));

function depsFor(state: FakeDbState): AppDeps {
  const client = createFakeSupabase(state, {
    tokens: { [TOKEN_A]: { id: USER_A, email: 'ramesh@example.in' } },
  });
  return {
    auth: { serviceClient: client, verifyToken: makeSupabaseVerifier(client) },
    authRoutes: { serviceClient: client },
    profile: { serviceClient: client, aadhaarKey },
  };
}

describe('profile routes', () => {
  let state: FakeDbState;

  beforeEach(() => {
    state = emptyDb();
    state.farmers.set(USER_A, makeFarmer({ id: USER_A }));
  });

  it('GET /me returns the safe shape (no aadhaar_enc / no plaintext)', async () => {
    state.farmers.set(
      USER_A,
      makeFarmer({ id: USER_A, aadhaar_enc: 'iv:tag:ct', aadhaar_last4: '9012' }),
    );
    const res = await buildApp(depsFor(state)).request('/me', { headers: AUTH_HEADER });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain('aadhaar_enc');
    expect(text).not.toContain('iv:tag:ct');
    const body = JSON.parse(text) as { farmer: { aadhaar_last4: string } };
    expect(body.farmer.aadhaar_last4).toBe('9012');
  });

  it('POST /me/profile encrypts Aadhaar, sets last4, and onboarding_complete', async () => {
    const res = await buildApp(depsFor(state)).request('/me/profile', {
      method: 'POST',
      headers: AUTH_HEADER,
      body: JSON.stringify({
        full_name: 'Ramesh Kumar',
        aadhaar: PLAINTEXT_AADHAAR,
        farm_district: 'Nashik',
        farm_state: 'Maharashtra',
        farm_area_value: 2.5,
        farm_area_unit: 'acre',
        primary_crops: ['onion', 'grapes'],
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      farmer: { aadhaar_last4: string; onboarding_complete: boolean };
    };
    expect(body.farmer.aadhaar_last4).toBe('9012');
    expect(body.farmer.onboarding_complete).toBe(true);

    // DB stores ciphertext, not plaintext.
    const stored = state.farmers.get(USER_A);
    expect(stored?.aadhaar_enc).toBeTruthy();
    expect(stored?.aadhaar_enc).not.toContain(PLAINTEXT_AADHAAR);
  });

  it('AUTHENTICATED ROUND-TRIP: POST then GET never leaks plaintext or aadhaar_enc', async () => {
    const app = buildApp(depsFor(state));

    const postRes = await app.request('/me/profile', {
      method: 'POST',
      headers: AUTH_HEADER,
      body: JSON.stringify({ full_name: 'Ramesh Kumar', aadhaar: PLAINTEXT_AADHAAR }),
    });
    const postText = await postRes.text();
    expect(postText).not.toContain(PLAINTEXT_AADHAAR);
    expect(postText).not.toContain('aadhaar_enc');

    const getRes = await app.request('/me', { headers: AUTH_HEADER });
    const getText = await getRes.text();
    expect(getText).not.toContain(PLAINTEXT_AADHAAR);
    expect(getText).not.toContain('aadhaar_enc');
    const body = JSON.parse(getText) as { farmer: { aadhaar_last4: string } };
    expect(body.farmer.aadhaar_last4).toBe('9012');
  });

  it('PUT /me/profile applies a partial update', async () => {
    const res = await buildApp(depsFor(state)).request('/me/profile', {
      method: 'PUT',
      headers: AUTH_HEADER,
      body: JSON.stringify({ preferred_language: 'mr' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { farmer: { preferred_language: string } };
    expect(body.farmer.preferred_language).toBe('mr');
  });

  it('rejects an invalid farm_area_unit (400 validation)', async () => {
    const res = await buildApp(depsFor(state)).request('/me/profile', {
      method: 'POST',
      headers: AUTH_HEADER,
      body: JSON.stringify({ full_name: 'X', farm_area_unit: 'square_feet' }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('validation_error');
  });

  it('rejects a non-12-digit Aadhaar (400 validation)', async () => {
    const res = await buildApp(depsFor(state)).request('/me/profile', {
      method: 'POST',
      headers: AUTH_HEADER,
      body: JSON.stringify({ full_name: 'X', aadhaar: '123' }),
    });
    expect(res.status).toBe(400);
  });

  it('GET /me without auth is 401', async () => {
    const res = await buildApp(depsFor(state)).request('/me');
    expect(res.status).toBe(401);
  });
});
