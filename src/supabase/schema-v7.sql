-- v7: period payment confirmations ("I got paid" per pay period).
-- One row per confirmed period; absence of a row = not paid.

create table if not exists public.period_payments (
  user_id uuid not null references auth.users(id) on delete cascade,
  driver_type text not null,
  period_key text not null, -- start date (YYYY-MM-DD) of the pay period
  paid_at timestamptz not null default now(),
  primary key (user_id, driver_type, period_key)
);

alter table public.period_payments enable row level security;

create policy "period_payments own rows"
  on public.period_payments
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
