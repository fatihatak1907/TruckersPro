-- schema-v4: per-week custom mileage deduction rate (lease drivers).
-- Additive and idempotent — safe to run on a live database.
alter table weekly_expenses
  add column if not exists mileage_rate numeric not null default 0.14;
