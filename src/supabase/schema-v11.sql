-- v11: per-load mileage for owner-op/lease RPM (rate per mile).
-- loaded_miles = paid haul miles; deadhead_miles = empty miles to the pickup.
-- RPM is computed in-app as earnings / (loaded_miles + deadhead_miles).

alter table public.loads
  add column if not exists loaded_miles numeric,
  add column if not exists deadhead_miles numeric;
