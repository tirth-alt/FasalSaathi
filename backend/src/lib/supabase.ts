import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AppConfig } from '@/config/env.ts';

/**
 * Two client shapes are used in this backend:
 *
 * 1. SERVICE-ROLE client (createServiceClient): authenticated with the
 *    service_role key. It BYPASSES Row Level Security by design. We use it only
 *    AFTER the caller's JWT has been verified and we know their auth uid, to
 *    load-or-create and read/write that farmer's own row. Never reachable from
 *    untrusted input paths.
 *
 * 2. USER-SCOPED client (createUserClient): authenticated with the anon key but
 *    carrying the caller's JWT in the Authorization header, so RLS policies
 *    apply (auth.uid() resolves to the caller). Used for the RLS-respecting path
 *    and the RLS integration test. Provided even though profile routes use the
 *    service-role client after verification.
 */

export function createServiceClient(config: AppConfig): SupabaseClient {
  return createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function createUserClient(config: AppConfig, accessToken: string): SupabaseClient {
  return createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}
