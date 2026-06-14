import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

/**
 * RLS integration test — PROVES that a farmer cannot read or update another
 * farmer's row through the user-scoped (anon key + JWT) client.
 *
 * SELF-GUARDED: skipped unless a reachable database + Supabase test env vars are
 * provided. Requires Docker + `npx supabase start` (local) or a hosted project.
 * Needed env vars when running:
 *   SUPABASE_DB_URL          (presence flips the guard on)
 *   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 *   RLS_TEST_JWT_A, RLS_TEST_USER_A_ID   (a real user A's JWT + id)
 *   RLS_TEST_USER_B_ID                   (a different user B's id)
 */

const enabled = Boolean(process.env.SUPABASE_DB_URL);

describe.skipIf(!enabled)('RLS: cross-user isolation', () => {
  const url = process.env.SUPABASE_URL!;
  const anonKey = process.env.SUPABASE_ANON_KEY!;
  const jwtA = process.env.RLS_TEST_JWT_A!;
  const userBId = process.env.RLS_TEST_USER_B_ID!;

  function userClient(jwt: string) {
    return createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
  }

  it('user A cannot SELECT user B row', async () => {
    const client = userClient(jwtA);
    const { data } = await client.from('farmers').select('*').eq('id', userBId);
    // RLS filters out other users' rows -> empty result, not an error.
    expect(data ?? []).toHaveLength(0);
  });

  it('user A cannot UPDATE user B row', async () => {
    const client = userClient(jwtA);
    const { data } = await client
      .from('farmers')
      .update({ full_name: 'hacked' })
      .eq('id', userBId)
      .select('*');
    expect(data ?? []).toHaveLength(0);
  });
});
