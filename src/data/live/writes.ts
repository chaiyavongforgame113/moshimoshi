import type { Database } from '@/lib/database.types'
import { db } from '@/lib/supabase'
import { CHAT_IMAGES, LINK_SECONDS } from '@/data/chatImages'
import type { EventDraft, VideoPick, WatchAction } from '@/lib/types'
import type {
  AnswerRow,
  BlockedPersonRow,
  ChatMemberRow,
  ChatMessageRow,
  EventMessageRow,
  IntentRow,
  IntroRequestRow,
  PairAnswerRow,
  ProfileRow,
  PromptSameRow,
  RoomMemberRow,
  RoomMessageRow,
  RoomWatchRow,
  SessionRow,
  WaveAnswerRow,
} from './rows'

// Thin Supabase writes for the store actions. Each one throws on failure so
// the caller can roll its optimistic update back.

type Tables = Database['public']['Tables']
type Insert<T extends keyof Tables> = Tables[T]['Insert']
type Update<T extends keyof Tables> = Tables[T]['Update']

function check<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw res.error
  return res.data
}

export async function saveProfile(id: string, patch: Record<string, unknown>): Promise<ProfileRow> {
  const res = await db()
    .from('profiles')
    .upsert({ ...patch, id } as Insert<'profiles'>, { onConflict: 'id' })
    .select()
    .single()
  return check(res) as ProfileRow
}

/** When my suspension ends (null when I'm not suspended). Only I can read it, never other people. */
export async function mySuspendedUntil(): Promise<string | null> {
  return check(await db().rpc('my_suspended_until')) ?? null
}

export async function touchLastSeen(id: string) {
  check(await db().from('profiles').update({ last_seen_at: new Date().toISOString() } as Update<'profiles'>).eq('id', id))
}

export async function joinRoom(roomId: string, userId: string): Promise<RoomMemberRow> {
  const res = await db()
    .from('room_members')
    .upsert({ room_id: roomId, user_id: userId } as Insert<'room_members'>, { onConflict: 'room_id,user_id', ignoreDuplicates: true })
    .select()
  const rows = (check(res) ?? []) as RoomMemberRow[]
  return rows[0] ?? { room_id: roomId, user_id: userId, role: 'member' }
}

export async function leaveRoom(roomId: string, userId: string) {
  check(await db().from('room_members').delete().eq('room_id', roomId).eq('user_id', userId))
}

export async function insertIntent(cols: Omit<Insert<'intents'>, 'user_id'>, userId: string): Promise<IntentRow> {
  const res = await db()
    .from('intents')
    .insert({ ...cols, user_id: userId } as Insert<'intents'>)
    .select()
    .single()
  return check(res) as IntentRow
}

export async function setIntentStatus(id: string, status: 'active' | 'paused' | 'fulfilled' | 'expired'): Promise<IntentRow> {
  const res = await db().from('intents').update({ status } as Update<'intents'>).eq('id', id).select().single()
  return check(res) as IntentRow
}

/** An edited post. expires_at null lets the database count its time again from the new "when". */
export async function updateIntent(id: string, cols: Update<'intents'>): Promise<IntentRow> {
  const res = await db().from('intents').update(cols).eq('id', id).select().single()
  return check(res) as IntentRow
}

export async function deleteIntent(id: string) {
  check(await db().from('intents').delete().eq('id', id))
}

export async function joinIntent(intentId: string, userId: string) {
  check(
    await db()
      .from('intent_joins')
      .upsert({ intent_id: intentId, user_id: userId } as Insert<'intent_joins'>, { onConflict: 'intent_id,user_id', ignoreDuplicates: true }),
  )
}

export async function leaveIntent(intentId: string, userId: string) {
  check(await db().from('intent_joins').delete().eq('intent_id', intentId).eq('user_id', userId))
}

export async function rsvp(sessionId: string, userId: string) {
  check(
    await db()
      .from('session_rsvps')
      .upsert({ session_id: sessionId, user_id: userId } as Insert<'session_rsvps'>, { onConflict: 'session_id,user_id', ignoreDuplicates: true }),
  )
}

export async function unrsvp(sessionId: string, userId: string) {
  check(await db().from('session_rsvps').delete().eq('session_id', sessionId).eq('user_id', userId))
}

export async function insertRoomMessage(roomId: string, userId: string, body: string): Promise<RoomMessageRow> {
  const res = await db()
    .from('room_messages')
    .insert({ room_id: roomId, user_id: userId, body } as Insert<'room_messages'>)
    .select()
    .single()
  return check(res) as RoomMessageRow
}

// ------------------------------------------------------------------ events (20261114000001_room_events.sql)

/** A line in an event's chat; the server refuses it outside the event's open window (event_* keys). */
export async function insertEventMessage(sessionId: string, userId: string, body: string): Promise<EventMessageRow> {
  const res = await db()
    .from('event_messages')
    .insert({ session_id: sessionId, user_id: userId, body } as Insert<'event_messages'>)
    .select()
    .single()
  return check(res) as EventMessageRow
}

export async function deleteEventMessage(id: string) {
  check(await db().from('event_messages').delete().eq('id', id))
}

/** create_event: staff or a host of the room. Returns the new session's id. */
export async function createEvent(d: EventDraft): Promise<string> {
  const res = await db().rpc('create_event', {
    p_room: d.roomId,
    p_title: d.title.trim(),
    p_description: d.description?.trim() || null,
    p_starts_at: d.startsAt,
    p_duration_min: d.durationMin,
    p_repeat_weekly: d.repeatWeekly,
  })
  return check(res) as string
}

export async function cancelEvent(sessionId: string, stopRepeat: boolean) {
  check(await db().rpc('cancel_event', { p_session: sessionId, p_stop_repeat: stopRepeat }))
}

export async function stopRepeat(sessionId: string) {
  check(await db().rpc('stop_repeat', { p_session: sessionId }))
}

/** Sessions as the server has them now (after a create / cancel). */
export async function sessionRows(ids: string[]): Promise<SessionRow[]> {
  if (!ids.length) return []
  return (check(await db().from('sessions').select('*').in('id', ids)) ?? []) as SessionRow[]
}

/** Every session one weekly plan made that hasn't ended (next week's, after a weekly create). */
export async function sessionsOfPlan(planId: number): Promise<SessionRow[]> {
  const res = await db().from('sessions').select('*').eq('plan_id', planId).gte('starts_at', new Date(Date.now() - 86_400_000).toISOString())
  return (check(res) ?? []) as SessionRow[]
}

/** Am I staff? (public.is_admin(); false on any error) */
export async function isStaff(): Promise<boolean> {
  const res = await db().rpc('is_admin')
  return !res.error && res.data === true
}

// ------------------------------------------------------------------ "จูนคลื่น" (20261114000002_wave_quiz.sql)

/** Save picks (a new pick or a changed one). Returns the stored rows. */
export async function upsertWave(userId: string, picks: { question_id: string; choice: number }[]): Promise<WaveAnswerRow[]> {
  if (!picks.length) return []
  const res = await db()
    .from('wave_answers')
    .upsert(picks.map((p) => ({ ...p, user_id: userId })) as Insert<'wave_answers'>[], { onConflict: 'user_id,question_id' })
    .select('user_id,question_id,choice')
  return (check(res) ?? []) as WaveAnswerRow[]
}

export async function insertChatMessage(chatId: string, userId: string, body: string): Promise<ChatMessageRow> {
  const res = await db()
    .from('chat_messages')
    .insert({ chat_id: chatId, user_id: userId, body } as Insert<'chat_messages'>)
    .select()
    .single()
  return check(res) as ChatMessageRow
}

export async function upsertAnswer(questionId: string, userId: string, body: string): Promise<AnswerRow> {
  const res = await db()
    .from('daily_answers')
    .upsert({ question_id: questionId, user_id: userId, body } as Insert<'daily_answers'>, { onConflict: 'question_id,user_id' })
    .select()
    .single()
  return check(res) as AnswerRow
}

export type SameTarget =
  | { kind: 'room'; messageId: string }
  | { kind: 'chat'; messageId: string }
  | { kind: 'answer'; questionId: string; answerUserId: string }
  | { kind: 'prompt'; profileId: string; promptKey: string }

/** Returns the stored row for a story reaction (its id lets a realtime delete find it later). */
export async function setSame(target: SameTarget, userId: string, on: boolean): Promise<PromptSameRow | null> {
  const q = db()
  if (target.kind === 'prompt') {
    const row = { profile_id: target.profileId, prompt_key: target.promptKey, user_id: userId }
    if (!on) {
      check(await q.from('prompt_sames').delete().match(row))
      return row
    }
    const saved = check(
      await q
        .from('prompt_sames')
        .upsert(row as Insert<'prompt_sames'>, { onConflict: 'profile_id,prompt_key,user_id', ignoreDuplicates: true })
        .select('id,profile_id,prompt_key,user_id'),
    ) as PromptSameRow[] | null
    return saved?.[0] ?? row
  }
  if (target.kind === 'answer') {
    const row = { question_id: target.questionId, answer_user_id: target.answerUserId, user_id: userId }
    check(
      on
        ? await q.from('daily_answer_sames').upsert(row as Insert<'daily_answer_sames'>, { onConflict: 'question_id,answer_user_id,user_id', ignoreDuplicates: true })
        : await q.from('daily_answer_sames').delete().match(row),
    )
    return null
  }
  const table = target.kind === 'room' ? 'room_message_sames' : 'chat_message_sames'
  const row = { message_id: target.messageId, user_id: userId }
  check(
    on
      ? await q.from(table).upsert(row as Insert<typeof table>, { onConflict: 'message_id,user_id', ignoreDuplicates: true })
      : await q.from(table).delete().match(row),
  )
  return null
}

export async function sendMoshi(target: string, opener: string): Promise<string> {
  const res = await db().rpc('send_moshi', { target, opener })
  return check(res) as string
}

export async function respondMoshi(chatId: string, accept: boolean) {
  check(await db().rpc('respond_moshi', { p_chat: chatId, accept }))
}

export async function markChatRead(chatId: string) {
  check(await db().rpc('mark_chat_read', { p_chat: chatId }))
}

export async function blockUser(blocker: string, blocked: string) {
  check(
    await db()
      .from('blocks')
      .upsert({ blocker, blocked } as Insert<'blocks'>, { onConflict: 'blocker,blocked', ignoreDuplicates: true }),
  )
}

/** Only my own blocks can go (blocks_delete). Unblocking twice deletes nothing, which is no error. */
export async function unblockUser(blocker: string, blocked: string) {
  check(await db().from('blocks').delete().eq('blocker', blocker).eq('blocked', blocked))
}

/**
 * The people I blocked, newest first, with the name and look the profiles table won't show me
 * (my_blocked_people, 20261108000006_rooms_and_blocks.sql). A database without that file yet:
 * my blocks rows alone, without names, so the list still opens.
 */
export async function myBlockedPeople(): Promise<BlockedPersonRow[]> {
  const res = await db().rpc('my_blocked_people')
  if (!res.error) return (res.data ?? []) as BlockedPersonRow[]
  const code = (res.error as { code?: string }).code
  if (code !== 'PGRST202' && code !== '42883') throw res.error
  const rows = check(await db().from('blocks').select('blocked, created_at').order('created_at', { ascending: false })) as
    | { blocked: string; created_at: string }[]
    | null
  return (rows ?? []).map((b) => ({ user_id: b.blocked, name: null, color: null, face: null, accessory: null, blocked_at: b.created_at }))
}

/** Am I in this room as the server has it? Room lines need it (20261108000006_rooms_and_blocks.sql). */
export async function isRoomMember(roomId: string, userId: string): Promise<boolean> {
  return !!check(await db().from('room_members').select('room_id').eq('room_id', roomId).eq('user_id', userId).maybeSingle())
}

/** บันไดความไว้ใจ ขั้น 2: my own yes/no to photos in this chat (returns my updated row). */
export async function setMediaConsent(chatId: string, userId: string, on: boolean): Promise<ChatMemberRow> {
  const res = await db()
    .from('chat_members')
    .update({ consent_media: on } as Update<'chat_members'>)
    .eq('chat_id', chatId)
    .eq('user_id', userId)
    .select()
    .single()
  return check(res) as ChatMemberRow
}

export async function uploadChatImage(path: string, blob: Blob) {
  // browsers and the CDN keep a copy no longer than a signed link lives (not after an unsend)
  const { error } = await db().storage.from(CHAT_IMAGES).upload(path, blob, { contentType: 'image/jpeg', upsert: false, cacheControl: String(LINK_SECONDS) })
  if (error) throw error
}

/**
 * Best effort: a file left behind is only wasted space (the bucket is private, and once no
 * message points at it only its sender can open it). While a report about the photo is open
 * the server keeps the file for the team: remove() then deletes nothing, which is no error.
 */
export async function removeChatImageFile(path: string) {
  const { error } = await db().storage.from(CHAT_IMAGES).remove([path])
  if (error) console.warn('[moshi] could not remove a chat photo', error)
}

/** Can I still see this person? Not across a block (either way), nor once their account is gone. */
export async function canSeeProfile(id: string): Promise<boolean> {
  return !!check(await db().from('profiles').select('id').eq('id', id).maybeSingle())
}

/** A chat as the server has it now: still active, and both people said yes to photos (null: not found). */
export async function chatPhotoState(chatId: string): Promise<{ active: boolean; bothSaidYes: boolean } | null> {
  const res = await db().from('chats').select('status, chat_members(consent_media)').eq('id', chatId).maybeSingle()
  const row = check(res) as { status: string; chat_members: { consent_media: boolean | null }[] } | null
  if (!row) return null
  const members = row.chat_members ?? []
  return { active: row.status === 'active', bothSaidYes: members.length > 0 && members.every((m) => !!m.consent_media) }
}

export async function insertChatImage(chatId: string, userId: string, path: string): Promise<ChatMessageRow> {
  const res = await db()
    .from('chat_messages')
    .insert({ chat_id: chatId, user_id: userId, kind: 'image', body: path } as Insert<'chat_messages'>)
    .select()
    .single()
  return check(res) as ChatMessageRow
}

export async function deleteChatMessage(id: string) {
  check(await db().from('chat_messages').delete().eq('id', id))
}

/** A report about one chat message (the server copies the message and its author). */
export async function reportChatMessage(messageId: string, reason: string, details?: string) {
  check(await db().from('reports').insert({ chat_message_id: messageId, reason, details: details ?? null } as Insert<'reports'>))
}

/**
 * A report about one line in a room's chat. Insert only, no .select(): nobody reads reports back.
 * The server copies the line, its author (target_user) and the room's name.
 */
export async function reportRoomMessage(reporter: string, messageId: string, reason: string, details?: string) {
  // no id yet (still signing in): the column's default is the signed-in user anyway
  const who = reporter ? { reporter } : {}
  check(await db().from('reports').insert({ ...who, room_message_id: messageId, reason, details: details ?? null } as Insert<'reports'>))
}

export async function reportUser(target: string, reason: string, details?: string) {
  check(await db().from('reports').insert({ target_user: target, reason, details: details ?? null } as Insert<'reports'>))
}

export async function setMoshiPolicy(id: string, policy: 'everyone' | 'rooms' | 'chatted') {
  check(await db().from('profiles').update({ moshi_policy: policy } as Update<'profiles'>).eq('id', id))
}

// ------------------------------------------------------------------ life stages, intros, watching together
// (20261117000001_lifestage_intro_watch.sql)

/** The wave card teaser: name + mochi only (anyone may ask, signed in or not). null: nobody to show. */
export async function waveCardPreview(userId: string): Promise<{ name: string; color: string; face: string | null; accessory: string | null } | null> {
  const res = await db().rpc('wave_card_preview', { p_user: userId })
  const list = check(res) as { name: string; color: string; face: string | null; accessory: string | null }[] | null
  return list?.[0] ?? null
}

/** Ask Mochi to introduce me (returns the request's id; asking back on theirs opens the chat at once). */
export async function requestIntro(target: string, question?: string): Promise<string> {
  return check(await db().rpc('request_intro', { p_target: target, p_question: question ?? null })) as string
}

/** Answer an intro about me. Accept: the chat id. Decline: null. */
export async function respondIntro(introId: string, accept: boolean, question?: string): Promise<string | null> {
  return (check(await db().rpc('respond_intro', { p_intro: introId, p_accept: accept, p_question: question ?? null })) as string | null) ?? null
}

export async function insertPairAnswer(chatId: string, userId: string, questionId: string, body: string): Promise<PairAnswerRow> {
  const res = await db()
    .from('chat_pair_answers')
    .insert({ chat_id: chatId, user_id: userId, question_id: questionId, body } as Insert<'chat_pair_answers'>)
    .select()
    .single()
  return check(res) as PairAnswerRow
}

export async function watchStart(roomId: string, v: VideoPick): Promise<RoomWatchRow> {
  const res = await db().rpc('watch_start', {
    p_room: roomId,
    p_provider: v.provider,
    p_ref: v.ref,
    p_title: v.title?.trim() || null,
    p_duration_s: v.durationS && v.durationS > 0 ? v.durationS : null,
    p_is_live: !!v.isLive,
    p_position_s: v.startS && v.startS > 0 ? v.startS : 0,
  })
  return check(res) as RoomWatchRow
}

export async function watchControl(roomId: string, action: WatchAction, positionS?: number, rate?: number): Promise<RoomWatchRow> {
  const res = await db().rpc('watch_control', {
    p_room: roomId,
    p_action: action,
    p_position_s: positionS === undefined ? null : Math.max(0, positionS),
    p_rate: rate ?? null,
  })
  return check(res) as RoomWatchRow
}

export async function watchStop(roomId: string): Promise<RoomWatchRow> {
  return check(await db().rpc('watch_stop', { p_room: roomId })) as RoomWatchRow
}

/** What my player found out about the clip on (its length, or that it's live), once: controllers only. */
export async function watchReport(roomId: string, ref: string, info: { durationS?: number; isLive?: boolean }): Promise<RoomWatchRow> {
  const res = await db().rpc('watch_report', {
    p_room: roomId,
    p_ref: ref,
    p_duration_s: info.durationS && info.durationS > 0 ? info.durationS : null,
    p_is_live: !!info.isLive,
  })
  return check(res) as RoomWatchRow
}

export async function watchSetOpen(roomId: string, open: boolean): Promise<RoomWatchRow> {
  return check(await db().rpc('watch_set_open', { p_room: roomId, p_open: open })) as RoomWatchRow
}

/** I'm watching (false: not counted, e.g. not a member or nothing on). */
export async function watchHeartbeat(roomId: string): Promise<boolean> {
  return !!check(await db().rpc('watch_heartbeat', { p_room: roomId }))
}

export async function watchLeave(roomId: string) {
  check(await db().rpc('watch_leave', { p_room: roomId }))
}

/** Who's watching now (seen in the last minute; RLS leaves out anyone in a block relation with me). */
export async function watchViewers(roomId: string): Promise<string[]> {
  const res = await db().from('watch_viewers').select('user_id').eq('room_id', roomId).order('seen_at', { ascending: false }).limit(200)
  return ((check(res) ?? []) as { user_id: string }[]).map((r) => r.user_id)
}

/** Intro requests by id as the server shows them to me now (one I set aside isn't there). */
export async function introRows(ids: string[]): Promise<IntroRequestRow[]> {
  if (!ids.length) return []
  return (check(await db().from('intro_requests').select('*').in('id', ids)) ?? []) as IntroRequestRow[]
}

/** The question pair answers I can see in one chat (mine; theirs once I answered too). */
export async function pairAnswerRows(chatId: string): Promise<PairAnswerRow[]> {
  return (check(await db().from('chat_pair_answers').select('*').eq('chat_id', chatId).order('created_at')) ?? []) as PairAnswerRow[]
}

/** One room's clip as the server has it now (null: it never had one). */
export async function roomWatchRow(roomId: string): Promise<RoomWatchRow | null> {
  return (check(await db().from('room_watch').select('*').eq('room_id', roomId).maybeSingle()) as RoomWatchRow | null) ?? null
}
