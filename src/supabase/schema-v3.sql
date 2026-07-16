-- v3: repeatable named "other" expenses stored as JSONB on the weekly row
alter table weekly_expenses
  add column if not exists other_expenses jsonb not null default '[]'::jsonb;
