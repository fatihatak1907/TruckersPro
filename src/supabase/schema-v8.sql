-- v8: toll as a first-class recurring expense (own frequency, like the others).

alter table public.weekly_expenses
  add column if not exists toll numeric not null default 0,
  add column if not exists toll_frequency text not null default 'weekly';
