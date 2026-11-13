-- moshimoshi · "จูนคลื่น" (this or that): one pick per person per question
-- (runs after 20261114000001_room_events.sql; re-runnable as a whole in the SQL Editor)
--
-- The questions live in the app (both languages); the database keeps only which side each person
-- picked: public.wave_answers (user_id, question_id, choice 0 or 1, answered_at). Matching compares
-- picks, and a profile shows "จูนคลื่นตรงกัน 6/8".
--
-- - Reading: everyone signed in, like profiles, except people in a block relation with me (either
--   way). My own picks always.
-- - Writing: my own rows only (pick, change my pick, take it back). answered_at is the server's
--   clock. question_id is a short slug ([a-z0-9-], up to 40 characters).
-- - Every client loads these in bulk to match people, so each person keeps at most 200 picks: a new
--   question past that replaces their oldest pick (weekly rounds of 8 are about four years' worth).
-- - Suspended people can still play: a pick is never shown as text to anyone.
-- No error keys of its own: a row in someone else's name gets the plain row-level security "no".

create table if not exists public.wave_answers (
  user_id uuid not null references public.profiles (id) on delete cascade,
  question_id text not null check (question_id ~ '^[a-z0-9-]{1,40}$'),
  choice smallint not null check (choice in (0, 1)),
  answered_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

create index if not exists wave_answers_question_idx on public.wave_answers (question_id);

-- the server's clock, and at most 200 picks per person (a new question replaces their oldest pick)
create or replace function private.wave_answers_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.answered_at := now();
  if tg_op = 'INSERT' then
    -- one person's picks change one insert at a time (same pattern as prompt_sames)
    perform pg_advisory_xact_lock(hashtextextended('wave_answers:' || new.user_id::text, 0));
    if not exists (
      select 1 from public.wave_answers
      where user_id = new.user_id and question_id = new.question_id
    ) then
      delete from public.wave_answers
      where user_id = new.user_id
        and question_id in (
          select question_id from public.wave_answers
          where user_id = new.user_id
          order by answered_at desc, question_id desc
          offset 199
        );
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.wave_answers_before_write() from public, anon, authenticated;

create or replace trigger wave_answers_before_write
  before insert or update on public.wave_answers
  for each row execute function private.wave_answers_before_write();

alter table public.wave_answers enable row level security;

drop policy if exists wave_answers_select on public.wave_answers;
create policy wave_answers_select on public.wave_answers for select to authenticated
  using (user_id = (select auth.uid()) or not private.is_blocked_with(user_id));
drop policy if exists wave_answers_insert on public.wave_answers;
create policy wave_answers_insert on public.wave_answers for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists wave_answers_update on public.wave_answers;
create policy wave_answers_update on public.wave_answers for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists wave_answers_delete on public.wave_answers;
create policy wave_answers_delete on public.wave_answers for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.wave_answers from anon, authenticated;
grant select, insert, update, delete on public.wave_answers to authenticated;
grant all on table public.wave_answers to service_role;

notify pgrst, 'reload schema';
