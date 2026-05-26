-- loads
create table if not exists loads (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  week_key text not null,
  driver_type text not null,
  start_location text not null,
  end_location text not null,
  earnings numeric,
  tonu numeric,
  commission_rate numeric,
  paid_mileage numeric,
  cents_per_mile numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists loads_user_week_idx on loads (user_id, week_key);

-- fuel_entries
create table if not exists fuel_entries (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  week_key text not null,
  driver_type text not null,
  type text not null,
  cost numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists fuel_user_week_idx on fuel_entries (user_id, week_key);

-- weekly_expenses
create table if not exists weekly_expenses (
  user_id uuid not null references auth.users on delete cascade,
  driver_type text not null,
  week_key text not null,
  truck_payment numeric not null default 0,
  truck_payment_frequency text not null default 'weekly',
  truck_insurance numeric not null default 0,
  trailer_insurance numeric not null default 0,
  trailer_lease numeric not null default 0,
  ifta_cost numeric not null default 0,
  admin_fee numeric not null default 0,
  other numeric not null default 0,
  start_odometer numeric not null default 0,
  end_odometer numeric not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, driver_type, week_key)
);

-- profiles
create table if not exists profiles (
  user_id uuid not null references auth.users on delete cascade,
  driver_type text not null,
  name text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, driver_type)
);

-- RLS
alter table loads enable row level security;
alter table fuel_entries enable row level security;
alter table weekly_expenses enable row level security;
alter table profiles enable row level security;

create policy "own rows" on loads for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on fuel_entries for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on weekly_expenses for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on profiles for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
