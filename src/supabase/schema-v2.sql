-- v2: switch profiles to one-row-per-user, lock driver_type per account
-- Wipe existing test data first (per spec: existing user goes through fresh signup)

delete from loads;
delete from fuel_entries;
delete from weekly_expenses;
drop table if exists profiles;
delete from auth.users;

create table profiles (
  user_id uuid primary key references auth.users on delete cascade,
  driver_type text not null check (driver_type in
    ('owner-op', 'lease', 'company-mile', 'company-commission')),
  name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;
create policy "own row" on profiles for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
