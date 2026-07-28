-- v10: let a signed-in user delete their own account and all of its data.
-- Required by Google Play policy for apps with account creation.
--
-- SECURITY DEFINER so the function may touch auth.users, but it only ever acts
-- on auth.uid() — the caller's own row — so one user can never delete another.

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;

  delete from public.loads            where user_id = uid;
  delete from public.fuel_entries     where user_id = uid;
  delete from public.weekly_expenses  where user_id = uid;
  delete from public.period_payments  where user_id = uid;
  delete from public.profiles         where user_id = uid;
  delete from auth.users              where id = uid;
end;
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
