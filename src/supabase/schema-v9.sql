-- v9: per-load customer commission (extra % the customer charges on earnings).
-- Stored as a fraction (0.05 = 5%), nullable: absent means none.

alter table public.loads
  add column if not exists customer_commission_rate numeric;
