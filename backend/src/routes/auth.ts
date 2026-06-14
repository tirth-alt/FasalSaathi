import { Hono } from 'hono';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppBindings, FarmerRow } from '@/lib/types.ts';
import { toSafeFarmer } from '@/lib/types.ts';
import { jsonError } from '@/lib/errors.ts';
import { signupSchema, loginSchema } from '@/routes/auth.schema.ts';

/**
 * Email/password auth routes. These are PUBLIC (no authMiddleware): they ESTABLISH
 * a session rather than consuming one.
 *
 * The existing Google-OAuth path remains the primary flow (signup is implicit on
 * first authenticated request via load-or-create in middleware/auth.ts). This adds
 * an explicit email/password path for clients that want it.
 *
 * Passwords are never logged and never echoed back. Supabase Auth owns the
 * password hash; this backend never persists it. Farmer responses always go
 * through toSafeFarmer so aadhaar_enc can never leak.
 */
export interface AuthRoutesDeps {
  /** Service-role client. Carries auth.admin.createUser (admin) and
   *  auth.signInWithPassword. The service_role key authorizes the admin call;
   *  no user JWT exists yet at signup/login time. */
  serviceClient: SupabaseClient;
}

const FARMERS_TABLE = 'farmers';

/** Session shape returned to clients. A subset of the Supabase session. */
interface SessionResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number | null;
}

function toSessionResponse(session: {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
}): SessionResponse {
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at ?? null,
  };
}

async function parseJsonBody(c: {
  req: { json: () => Promise<unknown> };
}): Promise<{ ok: true; value: unknown } | { ok: false }> {
  try {
    return { ok: true, value: await c.req.json() };
  } catch {
    return { ok: false };
  }
}

export function createAuthRoutes(deps: AuthRoutesDeps): Hono<AppBindings> {
  const app = new Hono<AppBindings>();

  // POST /auth/signup — create an email/password auth user + farmer row, return a session.
  app.post('/auth/signup', async (c) => {
    const body = await parseJsonBody(c);
    if (!body.ok) {
      return jsonError(c, 400, 'invalid_json', 'Request body must be valid JSON');
    }

    const parsed = signupSchema.safeParse(body.value);
    if (!parsed.success) {
      // Never include the raw body (it holds the password) in the error details —
      // Zod's flatten() reports field names + messages only, not values.
      return jsonError(
        c,
        400,
        'validation_error',
        'Invalid signup payload',
        parsed.error.flatten(),
      );
    }

    const { email, password, full_name, phone } = parsed.data;

    // 1. Create the Supabase auth user via the admin API. email_confirm: true so
    //    no confirmation email is required for the demo (see docs/api.md).
    const created = await deps.serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (created.error || !created.data.user) {
      const message = created.error?.message ?? '';
      // Supabase reports an already-registered email; surface it as 409.
      if (/already.*registered|already been registered|already exists/i.test(message)) {
        return jsonError(c, 409, 'email_taken', 'An account with this email already exists');
      }
      // Any other failure: do not leak the underlying message to the client.
      return jsonError(c, 500, 'internal_error', 'Could not create account');
    }

    const userId = created.data.user.id;

    // 2. Create the matching farmers row (id = auth user id). onboarding_complete
    //    starts false, matching the load-or-create path in middleware/auth.ts.
    const insertResult = await deps.serviceClient
      .from(FARMERS_TABLE)
      .insert({
        id: userId,
        full_name: full_name ?? null,
        phone: phone ?? null,
        onboarding_complete: false,
      })
      .select('*')
      .single();

    if (insertResult.error || !insertResult.data) {
      // The auth user now exists without a farmer row (partial-failure window —
      // there is no cross-system transaction across Supabase Auth + Postgres).
      // For the demo we surface a 500; the orphaned auth user is documented as a
      // known limitation rather than compensated here.
      return jsonError(c, 500, 'internal_error', 'Could not create farmer profile');
    }

    // 3. Sign in to return a session (admin createUser does not issue one).
    const signIn = await deps.serviceClient.auth.signInWithPassword({ email, password });
    if (signIn.error || !signIn.data.session) {
      return jsonError(c, 500, 'internal_error', 'Account created but sign-in failed');
    }

    return c.json(
      {
        user: toSafeFarmer(insertResult.data as FarmerRow),
        session: toSessionResponse(signIn.data.session),
      },
      201,
    );
  });

  // POST /auth/login — verify email/password and return a session + safe farmer.
  app.post('/auth/login', async (c) => {
    const body = await parseJsonBody(c);
    if (!body.ok) {
      return jsonError(c, 400, 'invalid_json', 'Request body must be valid JSON');
    }

    const parsed = loginSchema.safeParse(body.value);
    if (!parsed.success) {
      return jsonError(c, 400, 'validation_error', 'Invalid login payload', parsed.error.flatten());
    }

    const { email, password } = parsed.data;

    const signIn = await deps.serviceClient.auth.signInWithPassword({ email, password });
    if (signIn.error || !signIn.data.session || !signIn.data.user) {
      // Generic 401 — do not reveal whether the email exists.
      return jsonError(c, 401, 'invalid_credentials', 'Invalid email or password');
    }

    // Load the farmer row for the signed-in user (load-or-create, mirroring the
    // middleware so an OAuth-first user logging in via password still resolves).
    const userId = signIn.data.user.id;
    const userEmail = signIn.data.user.email ?? null;

    const existing = await deps.serviceClient
      .from(FARMERS_TABLE)
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (existing.error) {
      return jsonError(c, 500, 'internal_error', 'Could not resolve farmer profile');
    }

    let farmer = existing.data as FarmerRow | null;
    if (!farmer) {
      const fallbackName = userEmail ? (userEmail.split('@')[0] ?? null) : null;
      const inserted = await deps.serviceClient
        .from(FARMERS_TABLE)
        .insert({ id: userId, full_name: fallbackName, onboarding_complete: false })
        .select('*')
        .single();
      if (inserted.error || !inserted.data) {
        return jsonError(c, 500, 'internal_error', 'Could not resolve farmer profile');
      }
      farmer = inserted.data as FarmerRow;
    }

    return c.json({
      user: toSafeFarmer(farmer),
      session: toSessionResponse(signIn.data.session),
    });
  });

  return app;
}
