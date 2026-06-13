import { describe, it, expect, beforeEach } from 'vitest';
import { randomBytes } from 'node:crypto';
import { buildApp, type AppDeps } from '@/app.ts';
import { loadAadhaarKey } from '@/lib/crypto.ts';
import { makeSupabaseVerifier } from '@/middleware/auth.ts';
import { createFakeSupabase, emptyDb, fixtureRouteDeps, type FakeDbState } from '@/lib/test-utils.ts';

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const EMAIL = 'ramesh@example.in';
const PASSWORD = 'correct-horse-1';

const aadhaarKey = loadAadhaarKey(randomBytes(32).toString('base64'));

function depsFor(state: FakeDbState): AppDeps {
  const client = createFakeSupabase(state);
  return {
    auth: { serviceClient: client, verifyToken: makeSupabaseVerifier(client) },
    authRoutes: { serviceClient: client },
    profile: { serviceClient: client, aadhaarKey },
    ...fixtureRouteDeps(),
  };
}

async function signup(state: FakeDbState, body: Record<string, unknown>): Promise<Response> {
  return buildApp(depsFor(state)).request('/auth/signup', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
}

async function login(state: FakeDbState, body: Record<string, unknown>): Promise<Response> {
  return buildApp(depsFor(state)).request('/auth/login', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
}

describe('POST /auth/signup', () => {
  let state: FakeDbState;

  beforeEach(() => {
    state = emptyDb();
  });

  it('creates an auth user + farmer row and returns a session + safe farmer', async () => {
    const res = await signup(state, {
      email: EMAIL,
      password: PASSWORD,
      full_name: 'Ramesh Kumar',
      phone: '+919812345670',
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      user: { id: string; full_name: string; onboarding_complete: boolean };
      session: { access_token: string; refresh_token: string; expires_at: number };
    };

    expect(body.user.full_name).toBe('Ramesh Kumar');
    expect(body.user.onboarding_complete).toBe(false);
    expect(body.session.access_token).toBeTruthy();
    expect(body.session.refresh_token).toBeTruthy();
    expect(typeof body.session.expires_at).toBe('number');

    // The farmer row was actually persisted, keyed by the new auth user id.
    expect(state.farmers.has(body.user.id)).toBe(true);
    expect(state.authUsers.has(EMAIL)).toBe(true);
  });

  it('never returns the password or aadhaar_enc in the response', async () => {
    const res = await signup(state, {
      email: EMAIL,
      password: PASSWORD,
      full_name: 'Ramesh Kumar',
    });
    const text = await res.text();
    expect(text).not.toContain(PASSWORD);
    expect(text).not.toContain('password');
    expect(text).not.toContain('aadhaar_enc');
  });

  it('returns 409 when the email is already registered', async () => {
    await signup(state, { email: EMAIL, password: PASSWORD });
    const res = await signup(state, { email: EMAIL, password: 'another-pass-9' });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('email_taken');
  });

  it('treats email case-insensitively for duplicate detection', async () => {
    await signup(state, { email: EMAIL, password: PASSWORD });
    const res = await signup(state, { email: EMAIL.toUpperCase(), password: PASSWORD });
    expect(res.status).toBe(409);
  });

  it('returns 400 for a weak password', async () => {
    const res = await signup(state, { email: EMAIL, password: 'short' });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('validation_error');
  });

  it('returns 400 for an invalid email', async () => {
    const res = await signup(state, { email: 'not-an-email', password: PASSWORD });
    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid phone', async () => {
    const res = await signup(state, { email: EMAIL, password: PASSWORD, phone: '12345' });
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/login', () => {
  let state: FakeDbState;

  beforeEach(async () => {
    state = emptyDb();
    // Seed an account via the signup path so login has a real user to match.
    await signup(state, { email: EMAIL, password: PASSWORD, full_name: 'Ramesh Kumar' });
  });

  it('returns a session + safe farmer on valid credentials', async () => {
    const res = await login(state, { email: EMAIL, password: PASSWORD });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      user: { full_name: string };
      session: { access_token: string };
    };
    expect(body.user.full_name).toBe('Ramesh Kumar');
    expect(body.session.access_token).toBeTruthy();
  });

  it('never returns the password or aadhaar_enc', async () => {
    const res = await login(state, { email: EMAIL, password: PASSWORD });
    const text = await res.text();
    expect(text).not.toContain(PASSWORD);
    expect(text).not.toContain('aadhaar_enc');
  });

  it('returns 401 on a wrong password', async () => {
    const res = await login(state, { email: EMAIL, password: 'wrong-password' });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('invalid_credentials');
  });

  it('returns 401 for an unknown email (does not reveal existence)', async () => {
    const res = await login(state, { email: 'nobody@example.in', password: PASSWORD });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('invalid_credentials');
  });

  it('returns 400 for a missing password', async () => {
    const res = await login(state, { email: EMAIL });
    expect(res.status).toBe(400);
  });
});
