-- ============================================================================
-- FasalSaathi — initial schema: farmers
-- ============================================================================
-- The farmer row is keyed by the Supabase Auth user id (auth.users.id).
-- Aadhaar is stored ENCRYPTED (app-layer AES-256-GCM ciphertext, text) — never
-- in plaintext — per India's Aadhaar Act 2016 and the DPDP Act 2025. Only the
-- last-4 digits are kept for display. This is a DEMO; no real UIDAI integration.
-- ============================================================================

-- updated_at maintenance trigger function.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- farmers
-- ----------------------------------------------------------------------------
create table if not exists public.farmers (
  id                  uuid primary key references auth.users (id) on delete cascade,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  full_name           text,
  phone               text,
  preferred_language  text not null default 'hi',

  -- Encrypted Aadhaar ciphertext (base64 iv:tag:ct). NEVER store plaintext here.
  aadhaar_enc         text,
  aadhaar_last4       text,

  farm_lat            double precision,
  farm_lng            double precision,
  farm_district       text,
  farm_state          text,
  farm_village        text,

  farm_area_value     numeric,
  farm_area_unit      text check (farm_area_unit in ('acre', 'hectare', 'bigha')),

  primary_crops       text[],
  land_record_id      text,

  onboarding_complete boolean not null default false
);

comment on column public.farmers.aadhaar_enc is
  'SENSITIVE: AES-256-GCM ciphertext of the Aadhaar number. Never plaintext. Aadhaar Act 2016 / DPDP Act 2025.';
comment on column public.farmers.aadhaar_last4 is
  'Last 4 digits of Aadhaar for display only. Safe to expose to the owning user.';

-- Bump updated_at on every update.
drop trigger if exists trg_farmers_updated_at on public.farmers;
create trigger trg_farmers_updated_at
  before update on public.farmers
  for each row
  execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
-- A farmer may only see and modify their OWN row (auth.uid() = id).
-- The backend's service-role client BYPASSES RLS by design and is used only
-- AFTER the caller's JWT has been verified, scoped to that verified uid.
alter table public.farmers enable row level security;

drop policy if exists farmers_select_own on public.farmers;
create policy farmers_select_own
  on public.farmers
  for select
  using (auth.uid() = id);

drop policy if exists farmers_insert_own on public.farmers;
create policy farmers_insert_own
  on public.farmers
  for insert
  with check (auth.uid() = id);

drop policy if exists farmers_update_own on public.farmers;
create policy farmers_update_own
  on public.farmers
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
