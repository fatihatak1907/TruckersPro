-- schema-v5: optional extra paid mileage on loads (company per-mile).
-- Additive and idempotent — safe to run on a live database.
alter table loads add column if not exists extra_mileage numeric;
