-- moshimoshi · life stages, wave cards, Mochi's warm intros and watching clips together in rooms
-- (runs after 20261116000001_owner_admin.sql; re-runnable as a whole in the SQL Editor)
--
-- 1) Life stages ("ช่วงชีวิต"): profiles.life_stages text[], at most 3, each 1–40 characters (no
--    spaces around, no repeats). The app's list keeps stable Thai values (src/lib/lifeStages.ts) and
--    people may type their own ("อื่นๆ"). Everyone signed in reads them like tags (profiles_select),
--    and a suspended person can't rewrite them (they show on the profile), like name, bio and tags.
-- 2) Wave cards: public.wave_card_preview(user) is the teaser a shared card's link shows before
--    sign-in: the person's first name and mochi look (colour, face, accessory), nothing else. Open to
--    anyone with the link (anon too). No row for an unknown id, someone who never finished
--    onboarding, (signed out) a suspended account, or (signed in) anyone in a block relation with
--    the caller. Signed in, a suspended account's teaser shows like their profile does.
--    Comparing waves after sign-in uses the normal reads (profiles, wave_answers) under their RLS.
--    public.server_now(): the database's clock, so a phone can work out how far its own clock is off.
-- 3) Mochi's warm intros ("ให้โมชิแนะนำให้"), double opt-in:
--    - public.request_intro(target, question): A asks Mochi to introduce them to B. One row in
--      public.intro_requests (pending, expires after 3 days). B sees it ("โมชิอยากแนะนำ A ให้รู้จัก",
--      the app adds the reasons from what B can see). A sees their own request. Nobody else does.
--      Refused across a block, while A is suspended, to oneself, when the pair already has a chat
--      going or waiting (already_chatting), when B's hello settings wouldn't let A say hi either
--      (moshi_not_allowed), after B turned A's hello down (moshi_declined), and past 3 new requests
--      per person per day (intro_rate_limited). A request already waiting comes back as is (no
--      stacking). If B had already asked Mochi about A, asking back is a yes: the chat opens.
--    - public.respond_intro(intro, accept, question): only B. "ยินดีรู้จัก" opens the 1:1 chat (kind
--      'intro', active at once; the pair's earlier chat is reused, so there is one chat per pair) with
--      Mochi's lines: the intro, and the question pair when a question id is given. "ไว้ก่อนนะ" is
--      silent for A: it goes to private.intro_declines, which A can't read, B stops seeing the
--      request, and A keeps seeing it waiting until it expires like any other. A new request from A
--      within 30 days of that is filed as declined at once (B never sees it, A just sees it wait).
--    - Mochi's lines are chat_messages of kind 'mochi' (user_id null), written only by the database,
--      in Thai (the app shows them with known()). No Mochi account.
--    - The question pair: chats.pair_question (a question id from src/data/pairQuestions.ts). Each
--      person answers once (public.chat_pair_answers, 1–300 characters). Row-level security shows the
--      other person's answer only to someone who answered the same question in that chat, so the
--      answers open for both at once. When both have answered, Mochi steps back with one last line.
--    - private.expire_intros() marks waiting requests past their time 'expired' (pg_cron, hourly)
--      and clears unanswered ones after 90 days. The app treats expires_at as the truth meanwhile.
-- 4) Watch together ("ดูคลิปด้วยกัน"): public.room_watch, one row per room, written only by the RPCs
--    below. It holds what plays (provider + ref: a YouTube video id, a Vimeo video id, or an https
--    link to an .mp4 / .webm file on a public host name), its title and length if known, live or not, playing or paused,
--    the position at a moment on the database's clock (position_s at position_at), the speed, who
--    started it, whether everyone may control it, and a version number that grows with every change.
--    Each phone works out the position itself: position_s + (now - position_at) * rate while playing
--    (position_at can sit up to a second ahead: everyone gets the change before it starts).
--    - Reading: everyone signed in (like the room's chat). Realtime streams changes.
--    - public.watch_start(room, provider, ref, title, duration_s, is_live, position_s): a member of the
--      room (or staff), not suspended, when nothing is on; while something plays, only those who may
--      control it can switch it (watch_busy).
--    - Control = whoever started what's on, the room's hosts and staff; everyone in the room when a
--      host switched on anyone_can_control, or once the clip no longer holds the room
--      (private.watch_free: played to its end, paused 10 minutes, nobody watching for 2 minutes, no
--      known end after 12 hours, or whoever put it on left the room). public.watch_control(room,
--      play|pause|seek|rate, position_s, rate), public.watch_stop(room).
--    - public.watch_report(room, ref, duration_s, is_live): a controller's player tells the room the
--      clip's length (YouTube gives none up front) or that it's live, once.
--    - public.watch_set_open(room, open): hosts of the room and staff ("ให้ทุกคนคุมได้").
--    - At most 12 starts an hour and 40 controls a minute per person (watch_rate_limited).
--    - Suspended people can watch (and show up as watching) but not start or control.
--    - public.watch_viewers + public.watch_heartbeat(room) / public.watch_leave(room): who's watching
--      right now (a heartbeat every ~30 s; readers see people seen in the last 60 s, never anyone in a
--      block relation with them). Members only, and only while something is on. Not streamed.
--
-- Errors are raised with a short key as the message:
--   not_authenticated, suspended, blocked, target_not_found, moshi_not_allowed, moshi_declined,
--   cannot_intro_self, already_chatting, intro_rate_limited, intro_not_found, intro_not_pending,
--   intro_expired, intro_unavailable, question_invalid,
--   room_not_found, watch_not_member, watch_link_invalid, watch_busy, watch_not_playing,
--   watch_not_allowed, watch_action_invalid, watch_position_invalid, watch_rate_invalid,
--   watch_rate_limited
-- A pair answer that isn't allowed (not this chat's question, chat not active, a block, suspended)
-- gets the plain row-level security "no".
-- Run this file again after any re-run of 20261108000004_chat_images.sql (it writes the old
-- chat_messages kind check back, without 'mochi') or of 20261108000001_guard_chat_style.sql (the
-- suspension guard without life_stages).

-- =================================================================
-- 1) Life stages
-- =================================================================
-- at most 3, each 1–40 characters with no spaces around it, no repeats
create or replace function private.life_stages_ok(p text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p is null or (
    cardinality(p) <= 3
    and not exists (
      select 1 from unnest(p) as x(v)
      where x.v is null or char_length(x.v) not between 1 and 40 or x.v <> btrim(x.v)
    )
    and (select count(distinct x.v) from unnest(p) as x(v)) = cardinality(p)
  );
$$;

revoke all on function private.life_stages_ok(text[]) from public, anon;
grant execute on function private.life_stages_ok(text[]) to authenticated, service_role;

alter table public.profiles add column if not exists life_stages text[] not null default '{}';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_life_stages_check' and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_life_stages_check check (private.life_stages_ok(life_stages));
  end if;
end;
$$;

-- Same guard as 20261108000001_guard_chat_style.sql, plus life stages (they show on the profile).
-- Runs as the caller on purpose.
create or replace function private.profiles_guard_suspension()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated')
    and (new.name, new.bio, new.prompts, new.tags, new.chat_style, new.life_stages)
      is distinct from (old.name, old.bio, old.prompts, old.tags, old.chat_style, old.life_stages)
    and private.is_suspended(old.id)
    and not public.is_admin() then
    raise exception 'suspended';
  end if;
  return new;
end;
$$;

-- =================================================================
-- 2) Wave card teaser + the server's clock
-- =================================================================
create or replace function public.wave_card_preview(p_user uuid)
returns table (name text, color text, face text, accessory text)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(btrim(p.name), ''), 'เพื่อนใหม่'), p.color, p.face, p.accessory
  from public.profiles p
  where p.id = p_user
    and (p.onboarded or p.birth_year is not null)
    -- signed out, someone suspended reads like an unknown link. Signed in, their profile shows
    -- anyway, so leaving them out here would only tell the caller they're suspended.
    and ((select auth.uid()) is not null or not private.is_suspended(p.id))
    and ((select auth.uid()) is null or not private.is_blocked((select auth.uid()), p.id));
$$;

-- the database's clock (clock_timestamp: the moment of the call, not the transaction's start)
create or replace function public.server_now()
returns timestamptz
language sql
volatile
set search_path = ''
as $$
  select clock_timestamp();
$$;

revoke all on function public.wave_card_preview(uuid), public.server_now() from public;
grant execute on function public.wave_card_preview(uuid), public.server_now() to anon, authenticated, service_role;

-- =================================================================
-- 3) Mochi's warm intros + the question pair
-- =================================================================
alter table public.chats add column if not exists kind text not null default 'hello';
alter table public.chats add column if not exists pair_question text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chats_kind_check' and conrelid = 'public.chats'::regclass) then
    alter table public.chats add constraint chats_kind_check check (kind in ('hello', 'intro'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chats_pair_question_check' and conrelid = 'public.chats'::regclass) then
    alter table public.chats add constraint chats_pair_question_check check (pair_question ~ '^[a-z0-9-]{1,40}$');
  end if;
end;
$$;

-- Mochi's lines: written by the database only (the insert policy still takes text and image)
alter table public.chat_messages drop constraint if exists chat_messages_kind_check;
alter table public.chat_messages
  add constraint chat_messages_kind_check check (kind in ('text', 'system', 'welcome', 'image', 'mochi'));

create table if not exists public.intro_requests (
  -- an opaque key: realtime sends deletes to every subscriber with the key alone
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles (id) on delete cascade,
  to_user uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired')),
  chat_id uuid references public.chats (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '3 days',
  responded_at timestamptz,
  check (from_user <> to_user)
);

create index if not exists intro_requests_from_idx on public.intro_requests (from_user, created_at desc);
create index if not exists intro_requests_to_idx on public.intro_requests (to_user, created_at desc);
create index if not exists intro_requests_chat_idx on public.intro_requests (chat_id);

-- "ไว้ก่อนนะ": kept away from the person who asked
create table if not exists private.intro_declines (
  intro_id uuid primary key references public.intro_requests (id) on delete cascade,
  from_user uuid not null references public.profiles (id) on delete cascade,
  to_user uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists intro_declines_pair_idx on private.intro_declines (from_user, to_user, created_at desc);
create index if not exists intro_declines_to_idx on private.intro_declines (to_user);

alter table private.intro_declines enable row level security; -- no policies: internal only
revoke all on table private.intro_declines from public, anon, authenticated;
grant all on table private.intro_declines to service_role;

create table if not exists public.chat_pair_answers (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  question_id text not null check (question_id ~ '^[a-z0-9-]{1,40}$'),
  body text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now(),
  unique (chat_id, user_id, question_id)
);

create index if not exists chat_pair_answers_user_idx on public.chat_pair_answers (user_id);
create index if not exists chat_pair_answers_question_idx on public.chat_pair_answers (chat_id, question_id);

create or replace trigger chat_pair_answers_stamp
  before insert or update on public.chat_pair_answers
  for each row execute function private.stamp_created_at();

-- ------------------------------------------------------------------ helpers
-- I said "ไว้ก่อนนะ" to this request. Only answers for its receiver (the caller), so the person who
-- asked can't find out.
create or replace function private.intro_declined(p_intro uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.intro_declines d
    where d.intro_id = p_intro and d.to_user = (select auth.uid())
  );
$$;

-- this is the chat's question pair question
create or replace function private.pair_question_is(p_chat uuid, p_question text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.chats c where c.id = p_chat and c.pair_question = p_question);
$$;

-- I answered this question in this chat (only ever about the caller)
create or replace function private.pair_answered(p_chat uuid, p_question text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.chat_pair_answers a
    where a.chat_id = p_chat and a.question_id = p_question and a.user_id = (select auth.uid())
  );
$$;

-- Mochi's lines (the app keeps the same Thai text in src/data/pairQuestions.ts, English in known.ts).
-- Each gets its own clock_timestamp(), so lines written together keep their order.
create or replace function private.mochi_line(p_chat uuid, p_step text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.chat_messages (chat_id, user_id, kind, body, created_at)
  values (
    p_chat, null, 'mochi',
    case p_step
      when 'intro' then 'โมชิแนะนำให้ทั้งคู่รู้จักกันแล้วนะ ลองดูกันว่าคลื่นตรงกันตรงไหนบ้าง'
      when 'ask' then 'โมชิมีคำถามมาให้ทั้งคู่ตอบ คำตอบจะเปิดให้เห็นพร้อมกันตอนที่ตอบครบทั้งสองคนนะ'
      else 'โมชิขอตัวก่อนนะ คุยกันให้สนุก'
    end,
    clock_timestamp()
  );
end;
$$;

-- Opens the chat for an intro (the caller checked who may). One chat per pair: the pair's latest
-- chat is reused, otherwise a new one. Returns the chat id.
create or replace function private.accept_intro(p_intro uuid, p_question text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.intro_requests%rowtype;
  v_q text := nullif(btrim(coalesce(p_question, '')), '');
  v_chat uuid;
begin
  if v_q is not null and v_q !~ '^[a-z0-9-]{1,40}$' then
    raise exception 'question_invalid';
  end if;
  select * into r from public.intro_requests where id = p_intro for update;

  select c.id into v_chat
  from public.chats c
  join public.chat_members a on a.chat_id = c.id and a.user_id = r.from_user
  join public.chat_members b on b.chat_id = c.id and b.user_id = r.to_user
  order by c.created_at desc
  limit 1
  for update of c;

  if v_chat is null then
    insert into public.chats (requested_by, status, kind, pair_question)
    values (r.from_user, 'active', 'intro', v_q)
    returning id into v_chat;
    insert into public.chat_members (chat_id, user_id) values (v_chat, r.from_user), (v_chat, r.to_user);
  else
    update public.chats
    set status = 'active', kind = 'intro', requested_by = r.from_user, pair_question = coalesce(v_q, pair_question)
    where id = v_chat;
  end if;

  perform private.mochi_line(v_chat, 'intro');
  if v_q is not null then
    perform private.mochi_line(v_chat, 'ask');
  end if;

  update public.intro_requests
  set status = 'accepted', chat_id = v_chat, responded_at = now()
  where id = p_intro;
  -- the one who said yes has seen Mochi's lines already
  update public.chat_members set last_read_at = clock_timestamp() where chat_id = v_chat and user_id = r.to_user;
  return v_chat;
end;
$$;

-- ------------------------------------------------------------------ RPCs
create or replace function public.request_intro(p_target uuid, p_question text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_policy text;
  v_ready boolean;
  v_chat_status text;
  v_chat_by uuid;
  v_id uuid;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_target is null or p_target = v_me then
    raise exception 'cannot_intro_self';
  end if;
  if private.is_suspended(v_me) then
    raise exception 'suspended';
  end if;
  select moshi_policy, (onboarded or birth_year is not null) into v_policy, v_ready
  from public.profiles where id = p_target;
  if not found or not v_ready then
    raise exception 'target_not_found';
  end if;
  if private.is_blocked(v_me, p_target) then
    raise exception 'blocked';
  end if;

  -- the pair's lock (the same one send_moshi takes), then mine (the daily count)
  perform pg_advisory_xact_lock(
    hashtextextended('moshi:' || least(v_me, p_target)::text || greatest(v_me, p_target)::text, 0)
  );
  perform pg_advisory_xact_lock(hashtextextended('intro:' || v_me::text, 0));

  -- already talking, or a hello waiting: no introduction needed
  select c.status, c.requested_by into v_chat_status, v_chat_by
  from public.chats c
  join public.chat_members a on a.chat_id = c.id and a.user_id = v_me
  join public.chat_members b on b.chat_id = c.id and b.user_id = p_target
  order by c.created_at desc
  limit 1;
  if v_chat_status in ('active', 'pending') then
    raise exception 'already_chatting';
  end if;
  if v_chat_status = 'ended' and v_chat_by = v_me then
    raise exception 'moshi_declined';
  end if;

  -- mine is still waiting: the same request
  select id into v_id from public.intro_requests
  where from_user = v_me and to_user = p_target and status = 'pending' and expires_at > now()
  order by created_at desc
  limit 1;
  if v_id is not null then
    return v_id;
  end if;

  -- they asked Mochi about me first (and I haven't said "ไว้ก่อนนะ"): asking back is a yes
  select r.id into v_id from public.intro_requests r
  where r.from_user = p_target and r.to_user = v_me and r.status = 'pending' and r.expires_at > now()
    and not exists (select 1 from private.intro_declines d where d.intro_id = r.id)
  order by r.created_at desc
  limit 1;
  if v_id is not null then
    if private.is_suspended(p_target) then
      raise exception 'intro_unavailable';
    end if;
    perform private.accept_intro(v_id, p_question);
    return v_id;
  end if;

  -- their hello settings apply to intros too (a chat they had with me counts as "chatted")
  if v_chat_status is null and (
    v_policy = 'chatted'
    or (v_policy = 'rooms' and not exists (
      select 1
      from public.room_members a
      join public.room_members b on b.room_id = a.room_id and b.user_id = p_target
      join public.rooms r on r.id = a.room_id and not r.is_lobby
      where a.user_id = v_me
    ))
  ) then
    raise exception 'moshi_not_allowed';
  end if;

  if (select count(*) from public.intro_requests
      where from_user = v_me and created_at > now() - interval '1 day') >= 3 then
    raise exception 'intro_rate_limited';
  end if;

  insert into public.intro_requests (from_user, to_user) values (v_me, p_target) returning id into v_id;

  -- they said "ไว้ก่อนนะ" to me in the last 30 days: this one quietly waits out its time too
  if exists (
    select 1 from private.intro_declines d
    where d.from_user = v_me and d.to_user = p_target and d.created_at > now() - interval '30 days'
  ) then
    insert into private.intro_declines (intro_id, from_user, to_user) values (v_id, v_me, p_target);
  end if;
  return v_id;
end;
$$;

-- Only the person Mochi wants to introduce answers. Accept: returns the chat id. Decline: null.
create or replace function public.respond_intro(p_intro uuid, p_accept boolean, p_question text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_from uuid;
  r public.intro_requests%rowtype;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select from_user into v_from from public.intro_requests where id = p_intro and to_user = v_me;
  if v_from is null then
    raise exception 'intro_not_found';
  end if;
  -- the pair's lock before the row's (request_intro takes them in that order too)
  perform pg_advisory_xact_lock(
    hashtextextended('moshi:' || least(v_me, v_from)::text || greatest(v_me, v_from)::text, 0)
  );
  select * into r from public.intro_requests where id = p_intro for update;
  if exists (select 1 from private.intro_declines d where d.intro_id = p_intro) then
    raise exception 'intro_not_found';
  end if;
  if r.status <> 'pending' then
    raise exception 'intro_not_pending';
  end if;
  if r.expires_at <= now() then
    raise exception 'intro_expired';
  end if;

  if not coalesce(p_accept, false) then
    insert into private.intro_declines (intro_id, from_user, to_user)
    values (r.id, r.from_user, r.to_user)
    on conflict (intro_id) do nothing;
    return null;
  end if;

  if private.is_blocked(v_me, r.from_user) then
    raise exception 'blocked';
  end if;
  if private.is_suspended(r.from_user) then
    raise exception 'intro_unavailable';
  end if;
  return private.accept_intro(r.id, p_question);
end;
$$;

-- both answered: Mochi steps back. One answer at a time per chat, so two at once still end with
-- exactly one goodbye (the later one sees the earlier, committed answer).
create or replace function private.chat_pair_answers_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('pair:' || new.chat_id::text, 0));
  if (
    select count(distinct a.user_id) from public.chat_pair_answers a
    where a.chat_id = new.chat_id and a.question_id = new.question_id
  ) >= 2 then
    perform private.mochi_line(new.chat_id, 'bye');
  end if;
  return null;
end;
$$;

create or replace trigger chat_pair_answers_after_insert
  after insert on public.chat_pair_answers
  for each row execute function private.chat_pair_answers_after_insert();

-- waiting requests past their time read 'expired'; unanswered ones go after 90 days.
-- Called by pg_cron when available (see the end of this file).
create or replace function private.expire_intros()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  update public.intro_requests set status = 'expired' where status = 'pending' and expires_at <= now();
  get diagnostics n = row_count;
  delete from public.intro_requests where status <> 'accepted' and created_at < now() - interval '90 days';
  return n;
end;
$$;

-- ------------------------------------------------------------------ row level security
alter table public.intro_requests enable row level security;
alter table public.chat_pair_answers enable row level security;

-- the one who asked sees their request (a "ไว้ก่อนนะ" never shows); the one asked sees it unless
-- they set it aside; nobody across a block; nobody else
drop policy if exists intro_requests_select on public.intro_requests;
create policy intro_requests_select on public.intro_requests for select to authenticated
  using (
    (from_user = (select auth.uid()) and not private.is_blocked_with(to_user))
    or (to_user = (select auth.uid()) and not private.is_blocked_with(from_user) and not private.intro_declined(id))
  );

-- mine always; the other person's once I answered the same question in that chat
drop policy if exists chat_pair_answers_select on public.chat_pair_answers;
create policy chat_pair_answers_select on public.chat_pair_answers for select to authenticated
  using (
    user_id = (select auth.uid())
    or (
      private.is_chat_member(chat_id)
      and private.pair_answered(chat_id, question_id)
      and not private.is_blocked_with(user_id)
    )
  );

-- my own answer to this chat's question, in an active chat without a block
drop policy if exists chat_pair_answers_insert on public.chat_pair_answers;
create policy chat_pair_answers_insert on public.chat_pair_answers for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and private.can_post_in_chat(chat_id)
    and private.pair_question_is(chat_id, question_id)
  );

-- an answer is a line the other person reads: not while suspended (like chat messages)
drop policy if exists chat_pair_answers_not_suspended on public.chat_pair_answers;
create policy chat_pair_answers_not_suspended on public.chat_pair_answers
  as restrictive for insert to authenticated
  with check (not (select private.is_suspended((select auth.uid()))));

-- =================================================================
-- 4) Watch together
-- =================================================================
-- YouTube: the 11-character video id · Vimeo: the numeric video id · file: an https link to an
-- .mp4 or .webm file (no spaces, quotes, angle brackets or backslashes) on a public host name: two
-- labels or more and a top-level domain of letters (or xn--). So no IP addresses (browsers read a
-- numeric last label, 0x7f.1 too, as one), no single-label names (localhost) and no local suffixes
-- (.local, .internal, .lan, .home.arpa…). parseVideoUrl in src/data/watch.ts checks the same.
create or replace function private.watch_ref_ok(p_provider text, p_ref text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(case p_provider
    when 'youtube' then p_ref ~ '^[A-Za-z0-9_-]{11}$'
    when 'vimeo' then p_ref ~ '^[0-9]{1,12}$'
    when 'file' then char_length(p_ref) <= 2000
      and p_ref ~* '^https://([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+([a-z]{2,63}|xn--[a-z0-9-]{1,59})(:[0-9]{1,5})?/[^[:space:]"''<>\\?#]*\.(mp4|webm)([?#][^[:space:]"''<>\\]*)?$'
      and p_ref !~* '^https://[^/:]*\.(local|localhost|localdomain|internal|intranet|lan|home|corp|arpa)(:[0-9]{1,5})?/'
    else false
  end, false);
$$;

revoke all on function private.watch_ref_ok(text, text) from public, anon;
grant execute on function private.watch_ref_ok(text, text) to authenticated, service_role;

create table if not exists public.room_watch (
  room_id text primary key references public.rooms (id) on delete cascade,
  provider text check (provider in ('youtube', 'vimeo', 'file')),
  ref text,
  title text check (char_length(title) <= 200),
  duration_s double precision check (duration_s > 0 and duration_s <= 86400),
  is_live boolean not null default false,
  playing boolean not null default false,
  position_s double precision not null default 0 check (position_s >= 0 and position_s <= 864000),
  position_at timestamptz not null default now(),
  rate real not null default 1 check (rate between 0.25 and 2),
  started_by uuid references public.profiles (id) on delete set null,
  started_at timestamptz,
  anyone_can_control boolean not null default false,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  version bigint not null default 0,
  check ((provider is null) = (ref is null)),
  check (provider is null or private.watch_ref_ok(provider, ref))
);

create index if not exists room_watch_started_by_idx on public.room_watch (started_by);
create index if not exists room_watch_updated_by_idx on public.room_watch (updated_by);

-- starts and controls per person (insert-only; each call prunes my rows older than an hour)
create table if not exists private.watch_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  is_start boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists watch_log_user_created_idx on private.watch_log (user_id, created_at);

alter table private.watch_log enable row level security; -- no policies: internal only
revoke all on table private.watch_log from public, anon, authenticated;
grant all on table private.watch_log to service_role;

create table if not exists public.watch_viewers (
  -- an opaque key, like intro_requests (this table isn't streamed, but stays safe if it ever is)
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  seen_at timestamptz not null default now(),
  unique (room_id, user_id)
);

create index if not exists watch_viewers_user_idx on public.watch_viewers (user_id);
create index if not exists watch_viewers_room_seen_idx on public.watch_viewers (room_id, seen_at desc);

-- ------------------------------------------------------------------ helpers
-- where the clip is now by the database's clock (paused: where it stopped)
create or replace function private.watch_position(w public.room_watch)
returns double precision
language sql
stable
set search_path = ''
as $$
  select least(
    greatest(
      w.position_s + case
        when w.playing then greatest(extract(epoch from (now() - w.position_at)), 0) * w.rate
        else 0
      end,
      0
    ),
    coalesce(w.duration_s, 864000)
  );
$$;

-- The clip on no longer holds the room, so any member may switch it, stop it or play it again:
-- nothing is on; it has played to its end (known length: Vimeo's oEmbed, or what a player reported
-- through watch_report); it has sat paused for 10 minutes; nobody has watched it for 2 minutes (no
-- heartbeat, and no change either); it has no known end and went on 12 hours ago; or whoever put it
-- on has left the room (or their account is gone). The app mirrors this (watchReleaseAt in
-- src/data/watch.ts, and useRoomWatch).
create or replace function private.watch_free(w public.room_watch)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select w.ref is null
    or w.started_by is null
    or not exists (select 1 from public.room_members m where m.room_id = w.room_id and m.user_id = w.started_by)
    or (not w.is_live and w.duration_s is not null and private.watch_position(w) >= w.duration_s - 1)
    or (not w.playing and w.updated_at < now() - interval '10 minutes')
    or (w.duration_s is null and w.started_at < now() - interval '12 hours')
    or (
      w.updated_at < now() - interval '2 minutes'
      and not exists (
        select 1 from public.watch_viewers v
        where v.room_id = w.room_id and v.seen_at > now() - interval '2 minutes'
      )
    );
$$;

-- may I control what plays in this room right now (staff; or a member who is its host, who started
-- what's on, or anyone while a host has opened it up or once the clip no longer holds the room)
create or replace function private.can_control_watch(p_room text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin()
    or (
      private.is_room_member(p_room)
      and (
        private.is_room_host(p_room)
        or exists (
          select 1 from public.room_watch w
          where w.room_id = p_room
            and (
              w.anyone_can_control
              or (w.ref is not null and w.started_by = (select auth.uid()))
              or private.watch_free(w)
            )
        )
      )
    );
$$;

-- one more start or control by me, or watch_rate_limited
create or replace function private.watch_count(p_start boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
begin
  perform pg_advisory_xact_lock(hashtextextended('watch:' || v_me::text, 0));
  delete from private.watch_log where user_id = v_me and created_at <= now() - interval '1 hour';
  if p_start and (
    select count(*) from private.watch_log where user_id = v_me and is_start
  ) >= 12 then
    raise exception 'watch_rate_limited';
  end if;
  if not p_start and (
    select count(*) from private.watch_log
    where user_id = v_me and not is_start and created_at > now() - interval '1 minute'
  ) >= 40 then
    raise exception 'watch_rate_limited';
  end if;
  insert into private.watch_log (user_id, is_start) values (v_me, p_start);
end;
$$;

-- ------------------------------------------------------------------ RPCs
create or replace function public.watch_start(
  p_room text,
  p_provider text,
  p_ref text,
  p_title text default null,
  p_duration_s double precision default null,
  p_is_live boolean default false,
  p_position_s double precision default 0
)
returns public.room_watch
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_ref text := btrim(coalesce(p_ref, ''));
  v_title text := nullif(left(btrim(regexp_replace(coalesce(p_title, ''), '[[:space:]]+', ' ', 'g')), 200), '');
  v_dur double precision := case when p_duration_s > 0 and p_duration_s <= 86400 then p_duration_s end;
  v_live boolean := coalesce(p_is_live, false);
  v_pos double precision;
  w public.room_watch%rowtype;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not exists (select 1 from public.rooms where id = p_room) then
    raise exception 'room_not_found';
  end if;
  if private.is_suspended(v_me) then
    raise exception 'suspended';
  end if;
  if not public.is_admin() and not private.is_room_member(p_room) then
    raise exception 'watch_not_member';
  end if;
  if p_provider is null or not private.watch_ref_ok(p_provider, v_ref) then
    raise exception 'watch_link_invalid';
  end if;
  if p_position_s is not null and (p_position_s < 0 or p_position_s > 864000) then
    raise exception 'watch_position_invalid';
  end if;
  v_pos := case when v_live then 0 else least(coalesce(p_position_s, 0), coalesce(v_dur, 864000)) end;

  insert into public.room_watch (room_id) values (p_room) on conflict (room_id) do nothing;
  select * into w from public.room_watch where room_id = p_room for update;
  if w.ref is not null and not private.can_control_watch(p_room) then
    raise exception 'watch_busy';
  end if;
  perform private.watch_count(true);

  -- position_at a second ahead: everyone gets the change before the clip starts
  update public.room_watch
  set provider = p_provider,
      ref = v_ref,
      title = v_title,
      duration_s = v_dur,
      is_live = v_live,
      playing = true,
      position_s = v_pos,
      position_at = now() + interval '1 second',
      rate = 1,
      started_by = v_me,
      started_at = now(),
      updated_by = v_me,
      updated_at = now(),
      version = version + 1
  where room_id = p_room
  returning * into w;
  return w;
end;
$$;

create or replace function public.watch_control(
  p_room text,
  p_action text,
  p_position_s double precision default null,
  p_rate real default null
)
returns public.room_watch
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  w public.room_watch%rowtype;
  v_pos double precision;
  v_at timestamptz := now();
  v_playing boolean;
  v_rate real;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if private.is_suspended(v_me) then
    raise exception 'suspended';
  end if;
  if p_action is null or p_action not in ('play', 'pause', 'seek', 'rate') then
    raise exception 'watch_action_invalid';
  end if;
  select * into w from public.room_watch where room_id = p_room for update;
  if not found or w.ref is null then
    raise exception 'watch_not_playing';
  end if;
  if not private.can_control_watch(p_room) then
    raise exception 'watch_not_allowed' using errcode = '42501';
  end if;
  if p_position_s is not null and (p_position_s < 0 or p_position_s > 864000) then
    raise exception 'watch_position_invalid';
  end if;
  if p_action = 'seek' and p_position_s is null then
    raise exception 'watch_position_invalid';
  end if;
  if p_action = 'rate' and (p_rate is null or p_rate not between 0.25 and 2) then
    raise exception 'watch_rate_invalid';
  end if;
  perform private.watch_count(false);

  v_pos := private.watch_position(w);
  v_playing := w.playing;
  v_rate := w.rate;
  case p_action
    when 'play' then
      v_pos := coalesce(p_position_s, v_pos);
      v_playing := true;
      v_at := now() + interval '1 second';
    when 'pause' then
      v_pos := coalesce(p_position_s, v_pos);
      v_playing := false;
    when 'seek' then
      v_pos := p_position_s;
      if v_playing then
        v_at := now() + interval '1 second';
      end if;
    when 'rate' then
      v_rate := p_rate;
  end case;
  if w.is_live then
    v_pos := 0;
  end if;

  update public.room_watch
  set playing = v_playing,
      position_s = least(greatest(v_pos, 0), coalesce(duration_s, 864000)),
      position_at = v_at,
      rate = v_rate,
      updated_by = v_me,
      updated_at = now(),
      version = version + 1
  where room_id = p_room
  returning * into w;
  return w;
end;
$$;

create or replace function public.watch_stop(p_room text)
returns public.room_watch
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  w public.room_watch%rowtype;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.is_admin() and private.is_suspended(v_me) then
    raise exception 'suspended';
  end if;
  select * into w from public.room_watch where room_id = p_room for update;
  if not found or w.ref is null then
    raise exception 'watch_not_playing';
  end if;
  if not private.can_control_watch(p_room) then
    raise exception 'watch_not_allowed' using errcode = '42501';
  end if;
  perform private.watch_count(false);

  update public.room_watch
  set provider = null,
      ref = null,
      title = null,
      duration_s = null,
      is_live = false,
      playing = false,
      position_s = 0,
      position_at = now(),
      rate = 1,
      started_by = null,
      started_at = null,
      updated_by = v_me,
      updated_at = now(),
      version = version + 1
  where room_id = p_room
  returning * into w;
  delete from public.watch_viewers where room_id = p_room;
  return w;
end;
$$;

-- What a player found out about the clip on, once: its length (YouTube's oEmbed has none, so the
-- room can't tell when it ends otherwise) or that it's a live stream. Whoever may control the clip;
-- for a different clip: watch_not_playing. Once the room knows, later reports change nothing.
create or replace function public.watch_report(
  p_room text,
  p_ref text,
  p_duration_s double precision default null,
  p_is_live boolean default false
)
returns public.room_watch
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_dur double precision := case when p_duration_s > 0 and p_duration_s <= 86400 then p_duration_s end;
  v_live boolean := coalesce(p_is_live, false);
  w public.room_watch%rowtype;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if private.is_suspended(v_me) then
    raise exception 'suspended';
  end if;
  select * into w from public.room_watch where room_id = p_room for update;
  if not found or w.ref is null or w.ref <> btrim(coalesce(p_ref, '')) then
    raise exception 'watch_not_playing';
  end if;
  if not private.can_control_watch(p_room) then
    raise exception 'watch_not_allowed' using errcode = '42501';
  end if;
  -- known already, or nothing to tell
  if w.is_live or w.duration_s is not null or (not v_live and v_dur is null) then
    return w;
  end if;
  perform private.watch_count(false);

  -- a report isn't anyone's play or pause: updated_at / updated_by stay as they were
  update public.room_watch
  set is_live = v_live,
      duration_s = case when v_live then null else v_dur end,
      position_s = case when v_live then 0 else least(position_s, v_dur) end,
      position_at = case when v_live then now() else position_at end,
      version = version + 1
  where room_id = p_room
  returning * into w;
  return w;
end;
$$;

-- "ให้ทุกคนคุมได้": hosts of the room and staff
create or replace function public.watch_set_open(p_room text, p_open boolean)
returns public.room_watch
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_admin boolean := public.is_admin();
  w public.room_watch%rowtype;
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
  -- suspension doesn't take the host role away, so it's checked here (as in cancel_event)
  if not v_admin and private.is_suspended(v_me) then
    raise exception 'suspended';
  end if;
  perform private.watch_count(false);

  insert into public.room_watch (room_id) values (p_room) on conflict (room_id) do nothing;
  update public.room_watch
  set anyone_can_control = coalesce(p_open, false),
      updated_by = v_me,
      updated_at = now(),
      version = version + 1
  where room_id = p_room
  returning * into w;
  return w;
end;
$$;

-- I'm watching (every ~30 s while the clip is on screen). Members only, and only while something is
-- on; returns false when not counted (not a member, nothing on).
create or replace function public.watch_heartbeat(p_room text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not private.is_room_member(p_room)
    or not exists (select 1 from public.room_watch w where w.room_id = p_room and w.ref is not null) then
    delete from public.watch_viewers where room_id = p_room and user_id = v_me;
    return false;
  end if;
  insert into public.watch_viewers (room_id, user_id, seen_at) values (p_room, v_me, now())
  on conflict (room_id, user_id) do update set seen_at = excluded.seen_at;
  -- tidy up: nobody keeps a room's list long after they left
  delete from public.watch_viewers where room_id = p_room and seen_at < now() - interval '10 minutes';
  return true;
end;
$$;

create or replace function public.watch_leave(p_room text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.watch_viewers where room_id = p_room and user_id = (select auth.uid());
$$;

-- ------------------------------------------------------------------ row level security
alter table public.room_watch enable row level security;
alter table public.watch_viewers enable row level security;

-- what a room is watching: everyone signed in, like the room's chat
drop policy if exists room_watch_select on public.room_watch;
create policy room_watch_select on public.room_watch for select to authenticated using (true);

-- who's watching: seen in the last minute, never anyone in a block relation with me
drop policy if exists watch_viewers_select on public.watch_viewers;
create policy watch_viewers_select on public.watch_viewers for select to authenticated
  using (
    seen_at > now() - interval '60 seconds'
    and (user_id = (select auth.uid()) or not private.is_blocked_with(user_id))
  );

-- =================================================================
-- Grants (RLS still applies on top of these)
-- =================================================================
revoke all on table public.intro_requests, public.chat_pair_answers, public.room_watch, public.watch_viewers
from anon, authenticated;
grant select on public.intro_requests to authenticated;
grant select, insert on public.chat_pair_answers to authenticated;
grant select on public.room_watch to authenticated;
grant select on public.watch_viewers to authenticated;
grant all on table public.intro_requests, public.chat_pair_answers, public.room_watch, public.watch_viewers to service_role;

revoke all on function
  private.intro_declined(uuid),
  private.pair_question_is(uuid, text),
  private.pair_answered(uuid, text),
  private.mochi_line(uuid, text),
  private.accept_intro(uuid, text),
  private.chat_pair_answers_after_insert(),
  private.expire_intros(),
  private.can_control_watch(text),
  private.watch_free(public.room_watch),
  private.watch_count(boolean),
  private.watch_position(public.room_watch),
  public.request_intro(uuid, text),
  public.respond_intro(uuid, boolean, text),
  public.watch_start(text, text, text, text, double precision, boolean, double precision),
  public.watch_control(text, text, double precision, real),
  public.watch_stop(text),
  public.watch_report(text, text, double precision, boolean),
  public.watch_set_open(text, boolean),
  public.watch_heartbeat(text),
  public.watch_leave(text)
from public, anon;

-- internal: the database calls these itself
revoke all on function
  private.mochi_line(uuid, text),
  private.accept_intro(uuid, text),
  private.chat_pair_answers_after_insert(),
  private.expire_intros(),
  private.can_control_watch(text),
  private.watch_free(public.room_watch),
  private.watch_count(boolean),
  private.watch_position(public.room_watch)
from authenticated;
grant execute on function
  private.mochi_line(uuid, text),
  private.accept_intro(uuid, text),
  private.expire_intros(),
  private.can_control_watch(text),
  private.watch_free(public.room_watch),
  private.watch_count(boolean),
  private.watch_position(public.room_watch)
to service_role;

-- policies call these as the signed-in user
grant execute on function
  private.intro_declined(uuid),
  private.pair_question_is(uuid, text),
  private.pair_answered(uuid, text)
to authenticated, service_role;

grant execute on function
  public.request_intro(uuid, text),
  public.respond_intro(uuid, boolean, text),
  public.watch_start(text, text, text, text, double precision, boolean, double precision),
  public.watch_control(text, text, double precision, real),
  public.watch_stop(text),
  public.watch_report(text, text, double precision, boolean),
  public.watch_set_open(text, boolean),
  public.watch_heartbeat(text),
  public.watch_leave(text)
to authenticated, service_role;

-- =================================================================
-- Realtime (RLS decides who gets each change; deletes carry opaque ids or a room id)
-- =================================================================
do $$
declare
  t text;
begin
  foreach t in array array['intro_requests', 'chat_pair_answers', 'room_watch'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;

-- hourly when pg_cron is enabled: waiting intros past their time read 'expired'
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('moshi-expire-intros', '17 * * * *', 'select private.expire_intros()');
  end if;
end;
$$;

notify pgrst, 'reload schema';
