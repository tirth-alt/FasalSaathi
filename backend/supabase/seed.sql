-- ============================================================================
-- FasalSaathi — local dev seed. FAKE PII ONLY.
-- ============================================================================
-- Runs on `npx supabase db reset` (requires Docker + local Supabase).
--
-- farmers.id is a FK to auth.users(id). For local dev we insert matching FAKE
-- auth.users rows first, then the farmer profiles. These ids are fixed UUIDs so
-- they are easy to reference. The Aadhaar values below are CLEARLY FAKE and are
-- intentionally NOT encrypted here (aadhaar_enc is left null) — real Aadhaar is
-- only ever written through the app's encryption path. NEVER put a real Aadhaar
-- anywhere.
-- ============================================================================

-- Fake auth users (local dev only). On hosted Supabase, users come from real
-- Google OAuth sign-ins; do NOT run this seed against production.
insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'ramesh.demo@example.in'),
  ('22222222-2222-2222-2222-222222222222', 'sunita.demo@example.in'),
  ('33333333-3333-3333-3333-333333333333', 'arjun.demo@example.in')
on conflict (id) do nothing;

insert into public.farmers (
  id, full_name, phone, preferred_language,
  aadhaar_enc, aadhaar_last4,
  farm_lat, farm_lng, farm_district, farm_state, farm_village,
  farm_area_value, farm_area_unit, primary_crops, land_record_id,
  onboarding_complete
)
values
  (
    '11111111-1111-1111-1111-111111111111', 'Ramesh Kumar', '+919812345670', 'hi',
    null, '0000',  -- FAKE last4 placeholder; no real Aadhaar
    19.9975, 73.7898, 'Nashik', 'Maharashtra', 'Pimpalgaon',
    2.5, 'acre', array['onion', 'grapes'], 'MH-NSK-DEMO-001',
    true
  ),
  (
    '22222222-2222-2222-2222-222222222222', 'Sunita Devi', '+919812345671', 'hi',
    null, '0001',
    25.5941, 85.1376, 'Patna', 'Bihar', 'Danapur',
    1.0, 'hectare', array['wheat', 'maize'], 'BR-PAT-DEMO-002',
    true
  ),
  (
    '33333333-3333-3333-3333-333333333333', 'Arjun Reddy', '+919812345672', 'te',
    null, '0002',
    17.3850, 78.4867, 'Rangareddy', 'Telangana', 'Shamshabad',
    3.0, 'acre', array['cotton', 'paddy'], 'TG-RR-DEMO-003',
    false
  )
on conflict (id) do nothing;
