-- Schema voor de gedeelde opslag van de Vakantiekas.
-- Uitvoeren in de SQL Editor van een Supabase-project.

create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  trip_id text not null default 'vakantie',
  name text not null,
  size integer not null check (size > 0),
  created_at timestamptz not null default now()
);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id text not null default 'vakantie',
  date date not null,
  description text not null,
  -- Bedragen in eurocent: gehele getallen, geen afrondingsverrassingen.
  amount_cents bigint not null check (amount_cents > 0),
  paid_by uuid not null references households (id) on delete restrict,
  split_mode text not null check (split_mode in ('per-person', 'per-household')),
  participants uuid[] not null,
  created_at timestamptz not null default now()
);

create index if not exists households_trip_idx on households (trip_id);
create index if not exists expenses_trip_idx on expenses (trip_id);

alter table households enable row level security;
alter table expenses enable row level security;

-- LET OP — bewuste afweging.
-- Deze policies geven iedereen met de publieke anon-sleutel volledige toegang.
-- Die sleutel zit in de gebouwde JavaScript en is dus niet geheim: wie de URL
-- van de app heeft, kan alle uitgaven lezen en aanpassen. Voor een reis met
-- familie is dat doorgaans prima. Wil je het dichter: zet Supabase Auth aan en
-- vervang 'using (true)' door een controle op auth.uid().
drop policy if exists households_open_access on households;
create policy households_open_access on households
  for all using (true) with check (true);

drop policy if exists expenses_open_access on expenses;
create policy expenses_open_access on expenses
  for all using (true) with check (true);

-- Zorgt dat elk toestel wijzigingen van de anderen binnenkrijgt.
-- 'add table' klaagt als de tabel er al in zit, vandaar de controle: zo kun je
-- dit bestand gerust een tweede keer draaien.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'households'
  ) then
    alter publication supabase_realtime add table households;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'expenses'
  ) then
    alter publication supabase_realtime add table expenses;
  end if;
end
$$;
