import type { MiddlewareHandler } from 'hono';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppBindings, FarmerRow } from '@/lib/types.ts';
import { jsonError } from '@/lib/errors.ts';

/**
 * Dependencies the auth middleware needs. Injected (not module-level singletons)
 * so unit tests can supply a mocked Supabase client and verifier with no DB.
 */
export interface AuthDeps {
  /** Verifies a Supabase JWT and returns the user, or null on any failure.
   *  Default implementation uses supabase.auth.getUser(token). */
  verifyToken: (token: string) => Promise<{ id: string; email: string | null } | null>;
  /** Service-role client used post-verification to load-or-create the farmer row. */
  serviceClient: SupabaseClient;
}

const FARMERS_TABLE = 'farmers';

/** Default JWT verifier backed by Supabase Auth. getUser validates the token
 *  server-side without needing the JWT secret. */
export function makeSupabaseVerifier(
  client: SupabaseClient,
): (token: string) => Promise<{ id: string; email: string | null } | null> {
  return async (token: string) => {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) {
      return null;
    }
    return { id: data.user.id, email: data.user.email ?? null };
  };
}

function extractBearer(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/.exec(header.trim());
  if (!match || !match[1]) return null;
  return match[1].trim();
}

/**
 * Load the farmer row by auth uid, creating it if absent (load-or-create).
 * New rows start with onboarding_complete=false and full_name from the email
 * local-part when available. Uses the service-role client (RLS bypassed) because
 * the caller's identity is already proven by JWT verification.
 */
async function loadOrCreateFarmer(
  client: SupabaseClient,
  userId: string,
  email: string | null,
): Promise<FarmerRow> {
  const existing = await client
    .from(FARMERS_TABLE)
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (existing.error) {
    throw new Error(`Failed to load farmer: ${existing.error.message}`);
  }
  if (existing.data) {
    return existing.data as FarmerRow;
  }

  const fallbackName = email ? (email.split('@')[0] ?? null) : null;
  const inserted = await client
    .from(FARMERS_TABLE)
    .insert({
      id: userId,
      full_name: fallbackName,
      onboarding_complete: false,
    })
    .select('*')
    .single();

  if (inserted.error) {
    throw new Error(`Failed to create farmer: ${inserted.error.message}`);
  }
  return inserted.data as FarmerRow;
}

/**
 * Auth middleware: verify the Bearer Supabase JWT, resolve the user, load-or-create
 * the farmer row, and attach { userId, email, farmer } to the context.
 * Any failure yields a generic 401 — never echoes the token or Aadhaar.
 */
export function authMiddleware(deps: AuthDeps): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    const token = extractBearer(c.req.header('Authorization'));
    if (!token) {
      return jsonError(c, 401, 'unauthorized', 'Missing or malformed Authorization header');
    }

    let user: { id: string; email: string | null } | null;
    try {
      user = await deps.verifyToken(token);
    } catch {
      return jsonError(c, 401, 'unauthorized', 'Invalid or expired token');
    }
    if (!user) {
      return jsonError(c, 401, 'unauthorized', 'Invalid or expired token');
    }

    let farmer: FarmerRow;
    try {
      farmer = await loadOrCreateFarmer(deps.serviceClient, user.id, user.email);
    } catch {
      // Do not leak internal error details (could include row data) to the client.
      return jsonError(c, 500, 'internal_error', 'Could not resolve farmer profile');
    }

    c.set('auth', { userId: user.id, email: user.email, farmer });
    await next();
  };
}
