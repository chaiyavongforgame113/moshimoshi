-- moshimoshi · events: a session with its own chat that opens and closes on time
-- (runs after 20261110000002_host_remove_room_photo.sql; re-runnable as a whole in the SQL Editor)
--
-- An event is a row of public.sessions (RSVPs "ไปด้วย" in public.session_rsvps, weekly repeats in
-- private.session_plan, which the daily job turns into sessions). This file gives it:
--
-- 1) More about the event on public.sessions: description (up to 300 characters), cancelled_at (set
--    by cancel_event; the row stays so the app can show "ยกเลิกแล้ว", and the weekly job doesn't make
--    the same week again), created_by (who set it up) and plan_id (the weekly plan row it came from,
--    so the app can say "รอบหน้า ศุกร์ 21:00"). Sessions the plan made before this file ran get their
--    plan_id here. private.session_plan gains description, created_by and starts_on (a plan made
--    for a later date doesn't fill the weeks before it).
-- 2) public.event_messages: the event's chat. The server keeps the clock:
--    - posting: my own line, while the event is open (starts_at ≤ now < starts_at + duration_min),
--      not cancelled, not while suspended. A modified app can't post before or after, and the
--      times come from the database's clock, not the phone's. A refusal names the reason
--      (event_not_started, event_ended, event_cancelled, suspended).
--    - reading: everyone signed in, except lines from people in a block relation with me (either
--      way), until 24 hours after the event ends. After that the thread is hidden from everyone
--      (the app shows "จบแล้ว"), and the daily job deletes it 30 days after the event.
--    - deleting: my own lines; staff can take down anyone's (no edits).
--    - at most 10 lines in 30 seconds per person in one event (event_rate_limited): event chats are
--      open to everyone signed in, not only room members, so one account mustn't flood them.
-- 3) Events made in the app (not just by the weekly job):
--    - public.create_event(room, title, description, starts_at, duration_min, repeat_weekly):
--      staff (public.is_admin()) or a host of that room. Title 1–120 characters, description up to
--      300, 15–240 minutes, starting from now (5 minutes of slack for phone clocks) up to 60 days
--      ahead. Hosts keep at most 20 at a time (staff have no cap): their one-off events that aren't over
--      yet, open ones included, plus their weekly series (a series counts once). repeat_weekly
--      also writes a private.session_plan row for the same weekday and time in Asia/Bangkok and makes
--      next week's session right away; the daily job (pg_cron, as for every weekly session) keeps
--      making the weeks after. One plan per room, weekday and time (slot_taken).
--    - public.cancel_event(session, stop_repeat): staff or a host of the room who isn't suspended
--      (same for stop_repeat). Marks it cancelled
--      (an open one closes its chat at once). stop_repeat also deletes the weekly plan and cancels
--      the weeks already made. An event that is already over can't be cancelled (event_ended), but
--      stopping its repeat still works.
--    - public.stop_repeat(session): only stops the weekly repeat, keeps this one.
-- 4) No "ไปด้วย" for a cancelled event or one that is over (a restrictive policy on session_rsvps).
-- 5) Realtime: event_messages, sessions (new and cancelled events) and session_rsvps (who's going)
--    join the publication. RLS decides who gets each change.
--
-- Errors are raised with a short key as the message:
--   not_authenticated, room_not_found, not_allowed, suspended, title_invalid, description_invalid,
--   duration_invalid, starts_at_invalid, event_limit, slot_taken, event_not_found, event_ended,
--   event_not_started, event_cancelled, event_rate_limited

-- ------------------------------------------------------------------ 1) sessions + the weekly plan
alter table public.sessions add column if not exists description text;
alter table public.sessions add column if not exists cancelled_at timestamptz;
alter table public.sessions add column if not exists created_by uuid;
alter table public.sessions add column if not exists plan_id bigint;

alter table private.session_plan add column if not exists description text;
alter table private.session_plan add column if not exists created_by uuid;
alter table private.session_plan add column if not exists starts_on date; -- null = every week, as before

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sessions_description_check' and conrelid = 'public.sessions'::regclass) then
    alter table public.sessions add constraint sessions_description_check check (char_length(description) <= 300);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sessions_created_by_fkey' and conrelid = 'public.sessions'::regclass) then
    alter table public.sessions add constraint sessions_created_by_fkey
      foreign key (created_by) references public.profiles (id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sessions_plan_id_fkey' and conrelid = 'public.sessions'::regclass) then
    alter table public.sessions add constraint sessions_plan_id_fkey
      foreign key (plan_id) references private.session_plan (id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'session_plan_description_check' and conrelid = 'private.session_plan'::regclass) then
    alter table private.session_plan add constraint session_plan_description_check check (char_length(description) <= 300);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'session_plan_created_by_fkey' and conrelid = 'private.session_plan'::regclass) then
    alter table private.session_plan add constraint session_plan_created_by_fkey
      foreign key (created_by) references public.profiles (id) on delete set null;
  end if;
end;
$$;

create index if not exists sessions_created_by_idx on public.sessions (created_by);
create index if not exists session_plan_created_by_idx on private.session_plan (created_by);

-- sessions the plan already made: link them to their plan row (same room, title, weekday and time in
-- Bangkok). One session per plan and start. Only rows from before this file (no plan_id, no
-- created_by, not cancelled: those columns are new here), so a re-run can't tie an event made in the
-- app, or a cancelled one, to a weekly plan and make the plan skip that week.
with m as (
  select distinct on (sp.id, s.starts_at) s.id, sp.id as plan_id
  from public.sessions s
  join private.session_plan sp
    on sp.room_id = s.room_id
   and sp.title = s.title
   and sp.weekday = extract(dow from s.starts_at at time zone 'Asia/Bangkok')::int
   and sp.at_time = (s.starts_at at time zone 'Asia/Bangkok')::time
  where s.plan_id is null
    and s.created_by is null
    and s.cancelled_at is null
    and not exists (select 1 from public.sessions y where y.plan_id = sp.id and y.starts_at = s.starts_at)
  order by sp.id, s.starts_at, s.created_at, s.id
)
update public.sessions s set plan_id = m.plan_id from m where s.id = m.id;

-- one session per plan and start, whoever makes it (the daily job, create_event)
create unique index if not exists sessions_plan_starts_key on public.sessions (plan_id, starts_at) where plan_id is not null;

-- Sessions from the weekly plan for today and the next `p_days` days (Asia/Bangkok), for one plan or
-- (p_plan null) all of them. Skips weeks that already have their session (cancelled ones too, so a
-- cancelled week stays cancelled) and days before the plan's starts_on. Like before, a session
-- added by hand with the same room, title and start also counts, unless it was cancelled (a series
-- stopped earlier mustn't block a new one at the same time).
create or replace function private.plan_sessions_for(p_plan bigint, p_days integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Asia/Bangkok')::date;
  n integer;
begin
  -- one run at a time, so two runs can't both see a week as missing
  perform pg_advisory_xact_lock(hashtextextended('plan_sessions', 0));
  insert into public.sessions (room_id, title, description, starts_at, duration_min, host_id, host_name, created_by, plan_id)
  select
    sp.room_id, sp.title, sp.description, (d.day + sp.at_time) at time zone 'Asia/Bangkok', sp.duration_min,
    sp.created_by, sp.host_name, sp.created_by, sp.id
  from (
    select g::date as day
    from generate_series(today::timestamp, (today + greatest(coalesce(p_days, 0), 0))::timestamp, interval '1 day') as g
  ) d
  join private.session_plan sp on sp.weekday = extract(dow from d.day)::int
  where (p_plan is null or sp.id = p_plan)
    and (sp.starts_on is null or d.day >= sp.starts_on)
    and not exists (
      select 1 from public.sessions x
      where x.starts_at = (d.day + sp.at_time) at time zone 'Asia/Bangkok'
        and (
          x.plan_id = sp.id
          or (x.plan_id is null and x.cancelled_at is null and x.room_id = sp.room_id and x.title = sp.title)
        )
    );
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Same signature as 20261025000001_init.sql (the daily job and supabase/seed.sql call it), now
-- through plan_sessions_for: it also copies the description and links each session to its plan.
create or replace function private.plan_sessions(days integer default 7)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.plan_sessions_for(null, days);
end;
$$;

-- ------------------------------------------------------------------ 2) the event's chat
create table if not exists public.event_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists event_messages_session_created_idx on public.event_messages (session_id, created_at);
create index if not exists event_messages_user_id_idx on public.event_messages (user_id);

-- the server's clock (same trigger as every other table people write)
create or replace trigger event_messages_stamp
  before insert or update on public.event_messages
  for each row execute function private.stamp_created_at();

-- the event is open right now: started, not over, not cancelled (the database's clock)
create or replace function private.event_is_open(p_session uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.sessions s
    where s.id = p_session
      and s.cancelled_at is null
      and now() >= s.starts_at
      and now() < s.starts_at + make_interval(mins => s.duration_min)
  );
$$;

-- the event's chat can still be read: until 24 hours after the event ends
create or replace function private.event_chat_visible(p_session uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.sessions s
    where s.id = p_session
      and now() < s.starts_at + make_interval(mins => s.duration_min) + interval '24 hours'
  );
$$;

-- A refused line says why (the insert policy below is what actually holds the line; this only gives
-- the app a key to show), and it holds the send limit. Runs as the caller on purpose: sessions are
-- readable by everyone signed in, and it only looks at my own suspension and my own lines.
create or replace function private.event_messages_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  s record;
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  select starts_at, duration_min, cancelled_at into s from public.sessions where id = new.session_id;
  if not found then
    raise exception 'event_not_found';
  end if;
  if s.cancelled_at is not null then
    raise exception 'event_cancelled';
  end if;
  if now() < s.starts_at then
    raise exception 'event_not_started';
  end if;
  if now() >= s.starts_at + make_interval(mins => s.duration_min) then
    raise exception 'event_ended';
  end if;
  if new.user_id = (select auth.uid()) then
    if private.is_suspended(new.user_id) then
      raise exception 'suspended';
    end if;
    -- at most 10 lines in 30 seconds per person in one event. One person's lines go in one at a
    -- time, so two at once can't both slip under the limit. Only my own lines count (one in someone
    -- else's name fails the insert policy anyway).
    perform pg_advisory_xact_lock(hashtextextended('event_messages:' || new.user_id::text, 0));
    if (
      select count(*) from public.event_messages m
      where m.session_id = new.session_id
        and m.user_id = new.user_id
        and m.created_at > now() - interval '30 seconds'
    ) >= 10 then
      raise exception 'event_rate_limited';
    end if;
  end if;
  return new;
end;
$$;

create or replace trigger event_messages_before_insert
  before insert on public.event_messages
  for each row execute function private.event_messages_before_insert();

alter table public.event_messages enable row level security;

-- read: signed in, not across a block (either way), until 24 hours after the event ends
drop policy if exists event_messages_select on public.event_messages;
create policy event_messages_select on public.event_messages for select to authenticated
  using (private.event_chat_visible(session_id) and not private.is_blocked_with(user_id));

-- post: my own line, while the event is open
drop policy if exists event_messages_insert on public.event_messages;
create policy event_messages_insert on public.event_messages for insert to authenticated
  with check (user_id = (select auth.uid()) and private.event_is_open(session_id));

-- suspended people can read but not post (like room and chat messages)
drop policy if exists event_messages_not_suspended on public.event_messages;
create policy event_messages_not_suspended on public.event_messages
  as restrictive for insert to authenticated
  with check (not (select private.is_suspended((select auth.uid()))));

-- delete: my own lines; staff take down anyone's
drop policy if exists event_messages_delete on public.event_messages;
create policy event_messages_delete on public.event_messages for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- event chats are deleted 30 days after their event ends (hidden from everyone after 24 hours).
-- Called by pg_cron when available (see the end of this file).
create or replace function private.purge_event_messages()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  delete from public.event_messages m
  using public.sessions s
  where s.id = m.session_id
    and s.starts_at + make_interval(mins => s.duration_min) < now() - interval '30 days';
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ------------------------------------------------------------------ 3) making and cancelling events
-- stop a weekly plan: the weeks already made (and not started) are cancelled, except p_keep
create or replace function private.stop_plan(p_plan bigint, p_keep uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.sessions
  set cancelled_at = now()
  where plan_id = p_plan
    and cancelled_at is null
    and starts_at > now()
    and id is distinct from p_keep;
  delete from private.session_plan where id = p_plan;
end;
$$;

create or replace function public.create_event(
  p_room text,
  p_title text,
  p_description text,
  p_starts_at timestamptz,
  p_duration_min integer,
  p_repeat_weekly boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_admin boolean := public.is_admin();
  v_title text := btrim(coalesce(p_title, ''));
  v_desc text := nullif(btrim(coalesce(p_description, '')), '');
  v_start timestamptz := date_trunc('minute', p_starts_at);
  v_local timestamp;
  v_plan bigint;
  v_id uuid;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not exists (select 1 from public.rooms where id = p_room) then
    raise exception 'room_not_found';
  end if;
  if not (v_admin or private.is_room_host(p_room)) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if private.is_suspended(v_me) then
    raise exception 'suspended';
  end if;
  if char_length(v_title) not between 1 and 120 then
    raise exception 'title_invalid';
  end if;
  if coalesce(char_length(v_desc), 0) > 300 then
    raise exception 'description_invalid';
  end if;
  if p_duration_min is null or p_duration_min not between 15 and 240 then
    raise exception 'duration_invalid';
  end if;
  -- from now (a few minutes of slack: "start now" on a phone whose clock runs behind) up to 60 days
  if v_start is null or v_start < now() - interval '5 minutes' or v_start > now() + interval '60 days' then
    raise exception 'starts_at_invalid';
  end if;
  -- hosts: at most 20 at a time: one-off events they set up that aren't over yet (open ones too,
  -- so "start now" events can't pile up) plus their weekly series (each counts once, its weeks
  -- don't add up). One create at a time per person, so two at once can't both slip under it.
  if not v_admin then
    perform pg_advisory_xact_lock(hashtextextended('create_event:' || v_me::text, 0));
    if (
      select count(*) from public.sessions s
      where s.created_by = v_me
        and s.plan_id is null
        and s.cancelled_at is null
        and now() < s.starts_at + make_interval(mins => s.duration_min)
    ) + (
      select count(*) from private.session_plan sp where sp.created_by = v_me
    ) >= 20 then
      raise exception 'event_limit';
    end if;
  end if;

  v_local := v_start at time zone 'Asia/Bangkok';
  if coalesce(p_repeat_weekly, false) then
    insert into private.session_plan (room_id, title, description, weekday, at_time, duration_min, created_by, starts_on)
    values (p_room, v_title, v_desc, extract(dow from v_local)::int, v_local::time, p_duration_min, v_me, v_local::date)
    on conflict (room_id, weekday, at_time) do nothing
    returning id into v_plan;
    if v_plan is null then
      raise exception 'slot_taken';
    end if;
  end if;

  insert into public.sessions (room_id, title, description, starts_at, duration_min, host_id, created_by, plan_id)
  values (p_room, v_title, v_desc, v_start, p_duration_min, v_me, v_me, v_plan)
  returning id into v_id;

  -- next week's is there right away ("รอบหน้า"); the daily job makes the weeks after
  if v_plan is not null then
    perform private.plan_sessions_for(v_plan, (v_local::date - (now() at time zone 'Asia/Bangkok')::date) + 7);
  end if;
  return v_id;
end;
$$;

create or replace function public.cancel_event(p_session uuid, p_stop_repeat boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  s public.sessions%rowtype;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into s from public.sessions where id = p_session for update;
  if not found then
    raise exception 'event_not_found';
  end if;
  if not (public.is_admin() or private.is_room_host(s.room_id)) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  -- suspension doesn't take the host role away, so it's checked here too (as in create_event)
  if not public.is_admin() and private.is_suspended(v_me) then
    raise exception 'suspended';
  end if;
  if now() >= s.starts_at + make_interval(mins => s.duration_min) then
    -- already over: nothing left to cancel, but stopping its weekly repeat still works
    if not coalesce(p_stop_repeat, false) then
      raise exception 'event_ended';
    end if;
  elsif s.cancelled_at is null then
    update public.sessions set cancelled_at = now() where id = p_session;
  end if;
  if coalesce(p_stop_repeat, false) and s.plan_id is not null then
    perform private.stop_plan(s.plan_id);
  end if;
end;
$$;

-- stops the weekly repeat after this one (this one stays as it is)
create or replace function public.stop_repeat(p_session uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.sessions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into s from public.sessions where id = p_session;
  if not found then
    raise exception 'event_not_found';
  end if;
  if not (public.is_admin() or private.is_room_host(s.room_id)) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if not public.is_admin() and private.is_suspended(auth.uid()) then
    raise exception 'suspended';
  end if;
  if s.plan_id is not null then
    perform private.stop_plan(s.plan_id, p_session);
  end if;
end;
$$;

-- ------------------------------------------------------------------ 4) no "ไปด้วย" for a cancelled or finished event
drop policy if exists session_rsvps_open on public.session_rsvps;
create policy session_rsvps_open on public.session_rsvps
  as restrictive for insert to authenticated
  with check (exists (
    select 1 from public.sessions s
    where s.id = session_rsvps.session_id
      and s.cancelled_at is null
      and now() < s.starts_at + make_interval(mins => s.duration_min)
  ));

-- ------------------------------------------------------------------ grants
revoke all on table public.event_messages from anon, authenticated;
grant select, insert, delete on public.event_messages to authenticated;
grant all on table public.event_messages to service_role;

revoke all on function
  private.plan_sessions_for(bigint, integer),
  private.plan_sessions(integer),
  private.event_is_open(uuid),
  private.event_chat_visible(uuid),
  private.event_messages_before_insert(),
  private.purge_event_messages(),
  private.stop_plan(bigint, uuid),
  public.create_event(text, text, text, timestamptz, integer, boolean),
  public.cancel_event(uuid, boolean),
  public.stop_repeat(uuid)
from public, anon;

-- internal: the database calls these itself (functions and the daily job)
revoke all on function
  private.plan_sessions_for(bigint, integer),
  private.plan_sessions(integer),
  private.event_messages_before_insert(),
  private.purge_event_messages(),
  private.stop_plan(bigint, uuid)
from authenticated;
grant execute on function
  private.plan_sessions_for(bigint, integer),
  private.plan_sessions(integer),
  private.purge_event_messages(),
  private.stop_plan(bigint, uuid)
to service_role;

-- policies call these as the signed-in user
grant execute on function private.event_is_open(uuid), private.event_chat_visible(uuid) to authenticated, service_role;

grant execute on function
  public.create_event(text, text, text, timestamptz, integer, boolean),
  public.cancel_event(uuid, boolean),
  public.stop_repeat(uuid)
to authenticated, service_role;

-- ------------------------------------------------------------------ 5) realtime
do $$
declare
  t text;
begin
  foreach t in array array['event_messages', 'sessions', 'session_rsvps'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;

-- daily at 00:20 Bangkok (17:20 UTC) when pg_cron is enabled: delete event chats 30 days after their event
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('moshi-purge-event-messages', '20 17 * * *', 'select private.purge_event_messages()');
  end if;
end;
$$;

notify pgrst, 'reload schema';
