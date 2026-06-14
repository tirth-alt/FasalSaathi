import { Hono } from 'hono';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppBindings, FarmerRow } from '@/lib/types.ts';
import { toSafeFarmer } from '@/lib/types.ts';
import { jsonError } from '@/lib/errors.ts';
import { encryptAadhaar, aadhaarLast4 } from '@/lib/crypto.ts';
import {
  createProfileSchema,
  updateProfileSchema,
  REQUIRED_ONBOARDING_FIELDS,
} from '@/routes/profile.schema.ts';

/**
 * Dependencies for the profile routes. Injected so tests can supply a mocked
 * Supabase client and a fixed crypto key without env/DB.
 */
export interface ProfileDeps {
  /** Service-role client. Used AFTER auth verification to read/write the
   *  caller's OWN row (we always scope by the verified auth.uid). */
  serviceClient: SupabaseClient;
  /** Decoded AES-256 key for Aadhaar encryption. */
  aadhaarKey: Buffer;
}

const FARMERS_TABLE = 'farmers';

/**
 * Build the update object for the DB from validated input. Encrypts Aadhaar
 * (storing aadhaar_enc + aadhaar_last4) and never persists plaintext.
 */
function buildWritePatch(
  input: Record<string, unknown>,
  aadhaarKey: Buffer,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (key === 'aadhaar') continue; // handled separately
    if (value !== undefined) {
      patch[key] = value;
    }
  }

  if (typeof input.aadhaar === 'string') {
    // Aadhaar is sensitive (Aadhaar Act 2016 / DPDP Act 2025): encrypt at rest,
    // keep only last-4 for display, and never log the plaintext.
    patch.aadhaar_enc = encryptAadhaar(input.aadhaar, aadhaarKey);
    patch.aadhaar_last4 = aadhaarLast4(input.aadhaar);
  }

  return patch;
}

/**
 * Determine whether onboarding is complete by checking required fields against
 * the merged view of the existing row and the incoming patch.
 */
function computeOnboardingComplete(
  existing: FarmerRow,
  patch: Record<string, unknown>,
): boolean {
  const merged: Record<string, unknown> = { ...existing, ...patch };
  return REQUIRED_ONBOARDING_FIELDS.every((field) => {
    const v = merged[field];
    if (v === null || v === undefined) return false;
    if (Array.isArray(v)) return v.length > 0;
    return true;
  });
}

export function createProfileRoutes(deps: ProfileDeps): Hono<AppBindings> {
  const app = new Hono<AppBindings>();

  // GET /me — the authenticated farmer's profile (safe shape, last4 only).
  app.get('/me', (c) => {
    const { farmer } = c.get('auth');
    return c.json({ farmer: toSafeFarmer(farmer) });
  });

  // POST /me/profile — create/complete the caller's own profile (upsert own row).
  app.post('/me/profile', async (c) => {
    const { farmer } = c.get('auth');

    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      return jsonError(c, 400, 'invalid_json', 'Request body must be valid JSON');
    }

    const parsed = createProfileSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError(c, 400, 'validation_error', 'Invalid profile payload', parsed.error.flatten());
    }

    const patch = buildWritePatch(parsed.data, deps.aadhaarKey);
    patch.onboarding_complete = computeOnboardingComplete(farmer, patch);

    const result = await deps.serviceClient
      .from(FARMERS_TABLE)
      .update(patch)
      .eq('id', farmer.id) // always scoped to the verified caller
      .select('*')
      .single();

    if (result.error || !result.data) {
      return jsonError(c, 500, 'internal_error', 'Could not save profile');
    }

    return c.json({ farmer: toSafeFarmer(result.data as FarmerRow) });
  });

  // PUT /me/profile — partial update of the caller's own profile.
  app.put('/me/profile', async (c) => {
    const { farmer } = c.get('auth');

    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      return jsonError(c, 400, 'invalid_json', 'Request body must be valid JSON');
    }

    const parsed = updateProfileSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError(c, 400, 'validation_error', 'Invalid profile payload', parsed.error.flatten());
    }

    const patch = buildWritePatch(parsed.data, deps.aadhaarKey);
    if (Object.keys(patch).length === 0) {
      return jsonError(c, 400, 'validation_error', 'No fields to update');
    }
    patch.onboarding_complete = computeOnboardingComplete(farmer, patch);

    const result = await deps.serviceClient
      .from(FARMERS_TABLE)
      .update(patch)
      .eq('id', farmer.id)
      .select('*')
      .single();

    if (result.error || !result.data) {
      return jsonError(c, 500, 'internal_error', 'Could not update profile');
    }

    return c.json({ farmer: toSafeFarmer(result.data as FarmerRow) });
  });

  return app;
}
