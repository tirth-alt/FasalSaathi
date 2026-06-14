-- Price-reference schema: mandis + daily_prices.
--
-- DOCUMENTATION / FUTURE-SWAP PATH ONLY. The backend currently serves this data
-- from in-app fixtures behind the repository interfaces (src/lib/repositories.ts),
-- because Docker is not available in the build environment to boot a local
-- Postgres. Routes and tests run purely off the fixture-backed repos and do NOT
-- depend on these tables. When a real daily-price dataset is sourced, a
-- DB-backed repository implements the same MandiRepository / PriceRepository
-- interface and reads from here — no route changes required.
--
-- This is PUBLIC reference data (no farmer PII): both tables are world-readable
-- via RLS, writable only by the service role (the data-prep job).

create table if not exists public.mandis (
  mandi_id   text primary key,
  name       text not null,
  district   text not null,
  state      text not null,
  lat        double precision not null,
  lng        double precision not null,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_prices (
  id          bigint generated always as identity primary key,
  commodity   text not null,
  mandi_id    text not null references public.mandis (mandi_id) on delete cascade,
  price_date  date not null,
  modal_price integer not null,
  min_price   integer,
  max_price   integer,
  created_at  timestamptz not null default now(),
  unique (commodity, mandi_id, price_date)
);

-- Fast lookups for "recent N days of a commodity at a mandi".
create index if not exists daily_prices_lookup_idx
  on public.daily_prices (commodity, mandi_id, price_date desc);

-- RLS: public read, service-role write.
alter table public.mandis enable row level security;
alter table public.daily_prices enable row level security;

drop policy if exists mandis_public_read on public.mandis;
create policy mandis_public_read on public.mandis
  for select using (true);

drop policy if exists daily_prices_public_read on public.daily_prices;
create policy daily_prices_public_read on public.daily_prices
  for select using (true);

-- (No insert/update/delete policies → only the service role, which bypasses RLS,
--  can write. The data-prep job uses the service-role key.)
