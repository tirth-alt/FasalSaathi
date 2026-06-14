import { describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { buildApp, type AppDeps } from '@/app.ts';
import { loadAadhaarKey } from '@/lib/crypto.ts';
import { createFakeSupabase, emptyDb, fixtureRouteDeps } from '@/lib/test-utils.ts';

const JSON_HEADER = { 'Content-Type': 'application/json' };

function deps(): AppDeps {
  const client = createFakeSupabase(emptyDb());
  return {
    auth: { serviceClient: client, verifyToken: async () => null },
    authRoutes: { serviceClient: client },
    profile: { serviceClient: client, aadhaarKey: loadAadhaarKey(randomBytes(32).toString('base64')) },
    ...fixtureRouteDeps(),
  };
}

interface AskBody {
  answer: string;
  has_image: boolean;
  disclaimer: string;
  stub: boolean;
}

describe('POST /ask', () => {
  it('is PUBLIC (no auth) and echoes the question in Hindi by default', async () => {
    const res = await buildApp(deps()).request('/ask', {
      method: 'POST',
      headers: JSON_HEADER,
      body: JSON.stringify({ question: 'सोयाबीन कब बेचूं?' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as AskBody;
    expect(body.stub).toBe(true);
    expect(body.has_image).toBe(false);
    expect(body.answer).toContain('सोयाबीन कब बेचूं?');
    expect(body.disclaimer.length).toBeGreaterThan(0);
  });

  it('echoes in English when lang=en', async () => {
    const res = await buildApp(deps()).request('/ask', {
      method: 'POST',
      headers: JSON_HEADER,
      body: JSON.stringify({ question: 'When should I sell soybean?', lang: 'en' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as AskBody;
    expect(body.answer).toContain('When should I sell soybean?');
    expect(body.answer).toMatch(/coming soon/i);
    expect(body.disclaimer).toMatch(/demo placeholder/i);
  });

  it('sets has_image and notes lab-report analysis when an image is attached', async () => {
    const res = await buildApp(deps()).request('/ask', {
      method: 'POST',
      headers: JSON_HEADER,
      body: JSON.stringify({
        question: 'Read my soil report',
        lang: 'en',
        image_base64: 'ZmFrZS1pbWFnZQ==',
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as AskBody;
    expect(body.has_image).toBe(true);
    expect(body.answer).toMatch(/lab-report/i);
  });

  it('400 validation_error on empty question', async () => {
    const res = await buildApp(deps()).request('/ask', {
      method: 'POST',
      headers: JSON_HEADER,
      body: JSON.stringify({ question: '   ' }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('validation_error');
  });

  it('400 invalid_json on a malformed body', async () => {
    const res = await buildApp(deps()).request('/ask', {
      method: 'POST',
      headers: JSON_HEADER,
      body: '{ not json',
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('invalid_json');
  });
});
