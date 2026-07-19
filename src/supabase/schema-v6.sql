-- schema-v6: per-driver pay schedule on profiles.
-- Additive and idempotent — safe to run on a live database.
alter table profiles add column if not exists schedule_start_date date;
alter table profiles add column if not exists schedule_frequency text not null default 'weekly';
alter table profiles add column if not exists schedule_pay_day int not null default 5;
