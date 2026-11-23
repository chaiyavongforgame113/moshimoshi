-- A participant can permanently close a 1:1 chat while keeping its history readable.
alter table public.chats add column closed_at timestamptz;
alter table public.chats add constraint chats_closed_status_check check (closed_at is null or status = 'ended');

create or replace function private.guard_closed_chat()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.closed_at is not null and (new.status <> 'ended' or new.closed_at is distinct from old.closed_at) then
    raise exception 'chat_closed';
  end if;
  return new;
end;
$$;

create trigger guard_closed_chat before update of status, closed_at on public.chats
for each row execute function private.guard_closed_chat();

-- Take the same pair lock as send_moshi and request/respond_intro. The chat row update
-- also serializes with messages, answers and reactions already being written.
create or replace function public.close_chat(p_chat uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_other uuid;
  v_closed timestamptz;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select other.user_id into v_other
  from public.chat_members mine
  join public.chat_members other on other.chat_id = mine.chat_id and other.user_id <> mine.user_id
  where mine.chat_id = p_chat and mine.user_id = v_me;
  if v_other is null then
    raise exception 'chat_not_found';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('moshi:' || least(v_me, v_other)::text || greatest(v_me, v_other)::text, 0)
  );
  update public.chats
  set status = 'ended', closed_at = clock_timestamp()
  where id = p_chat and status = 'active'
  returning closed_at into v_closed;
  if not found then
    select closed_at into v_closed from public.chats where id = p_chat;
    if v_closed is null then
      raise exception 'chat_not_active';
    end if;
  end if;
  return v_closed;
end;
$$;

revoke all on function public.close_chat(uuid) from public, anon;
grant execute on function public.close_chat(uuid) to authenticated;

-- Keep a stale client from writing to the chat during a concurrent close.
create or replace function private.guard_closed_chat_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chat uuid;
  v_closed timestamptz;
begin
  if tg_table_name = 'chat_message_sames' then
    select chat_id into v_chat from public.chat_messages where id = new.message_id;
  else
    v_chat := new.chat_id;
  end if;
  select closed_at into v_closed from public.chats where id = v_chat for share;
  if v_closed is not null then
    raise exception 'chat_closed';
  end if;
  return new;
end;
$$;

create trigger guard_closed_chat_messages before insert on public.chat_messages
for each row execute function private.guard_closed_chat_activity();

create trigger guard_closed_chat_answers before insert on public.chat_pair_answers
for each row execute function private.guard_closed_chat_activity();

create trigger guard_closed_chat_reactions before insert on public.chat_message_sames
for each row execute function private.guard_closed_chat_activity();

-- New intro requests use the same pair lock as closure. The chat update guard
-- also stops an introduction that was already pending from reopening the chat.
create or replace function private.guard_closed_chat_intro()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.chats c
    join public.chat_members a on a.chat_id = c.id and a.user_id = new.from_user
    join public.chat_members b on b.chat_id = c.id and b.user_id = new.to_user
    where c.closed_at is not null
  ) then
    raise exception 'chat_closed';
  end if;
  return new;
end;
$$;

create trigger guard_closed_chat_intro before insert on public.intro_requests
for each row execute function private.guard_closed_chat_intro();
