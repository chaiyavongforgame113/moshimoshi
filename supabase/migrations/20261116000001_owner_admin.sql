-- moshimoshi · the owner's new account is an admin too
-- chaiyavongforgame113@gmail.com joins the admins: right away if the account already exists,
-- otherwise the moment it signs up. Replaces the trigger function from
-- 20261108000002_second_admin.sql (keeping its two addresses) and recreates its trigger,
-- so this file also works on its own.

create or replace function private.grant_founder_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if lower(new.email) in ('chaiyavongforwork001@gmail.com', 'chaiyavongboy1@gmail.com', 'chaiyavongforgame113@gmail.com') then
    insert into private.app_admins (user_id) values (new.id) on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function private.grant_founder_admin() from public, anon, authenticated;

drop trigger if exists grant_founder_admin on auth.users;
create trigger grant_founder_admin
  after insert on auth.users
  for each row execute function private.grant_founder_admin();

insert into private.app_admins (user_id)
select id from auth.users where lower(email) = 'chaiyavongforgame113@gmail.com'
on conflict (user_id) do nothing;
