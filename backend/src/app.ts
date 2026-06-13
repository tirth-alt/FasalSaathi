import { Hono } from 'hono';
import { logger } from 'hono/logger';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppConfig } from '@/config/env.ts';
import type { AppBindings } from '@/lib/types.ts';
import { jsonError, AppError } from '@/lib/errors.ts';
import { createServiceClient } from '@/lib/supabase.ts';
import { loadAadhaarKey } from '@/lib/crypto.ts';
import { authMiddleware, makeSupabaseVerifier, type AuthDeps } from '@/middleware/auth.ts';
import { createProfileRoutes, type ProfileDeps } from '@/routes/profile.ts';
import { createAuthRoutes, type AuthRoutesDeps } from '@/routes/auth.ts';

const SERVICE_NAME = 'fasalsaathi-backend';

/**
 * Everything the app needs to run, injectable for tests. In production these are
 * built from config via buildDepsFromConfig(); tests pass mocks directly.
 */
export interface AppDeps {
  auth: AuthDeps;
  authRoutes: AuthRoutesDeps;
  profile: ProfileDeps;
}

/** Wire real Supabase clients + crypto key from validated config. */
export function buildDepsFromConfig(config: AppConfig): AppDeps {
  const serviceClient: SupabaseClient = createServiceClient(config);
  const aadhaarKey = loadAadhaarKey(config.AADHAAR_ENC_KEY);
  return {
    auth: {
      serviceClient,
      verifyToken: makeSupabaseVerifier(serviceClient),
    },
    authRoutes: {
      serviceClient,
    },
    profile: {
      serviceClient,
      aadhaarKey,
    },
  };
}

/**
 * Build the Hono app. Returned (not bound to a port) so tests can call
 * app.request(...) directly. Routes requiring auth are mounted behind the
 * injected auth middleware.
 */
export function buildApp(deps: AppDeps): Hono<AppBindings> {
  const app = new Hono<AppBindings>();

  app.use('*', logger());

  // Centralized error handling — never leak stack traces or sensitive data.
  app.onError((err, c) => {
    if (err instanceof AppError) {
      return jsonError(c, err.status, err.code, err.message, err.details);
    }
    // Unexpected error: log server-side, return a generic message.
    console.error('Unhandled error:', err instanceof Error ? err.message : 'unknown');
    return jsonError(c, 500, 'internal_error', 'An unexpected error occurred');
  });

  app.notFound((c) => jsonError(c, 404, 'not_found', 'Route not found'));

  // Public health check.
  app.get('/health', (c) =>
    c.json({ status: 'ok', service: SERVICE_NAME, time: new Date().toISOString() }),
  );

  // Public auth routes (email/password signup + login). No authMiddleware —
  // these establish a session rather than consuming one.
  app.route('/', createAuthRoutes(deps.authRoutes));

  // Authenticated routes.
  const protectedRoutes = createProfileRoutes(deps.profile);
  app.use('/me', authMiddleware(deps.auth));
  app.use('/me/*', authMiddleware(deps.auth));
  app.route('/', protectedRoutes);

  return app;
}
