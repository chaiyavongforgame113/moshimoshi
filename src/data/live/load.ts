import { db } from '@/lib/supabase'
import { WAVE_IDS } from '@/data/wave'
import {
  latestPerRoom,
  pairKey,
  putAnswerSame,
  putChatMember,
  putChatMessage,
  putChatSame,
  putEventMessage,
  putIntro,
  putJoin,
  putMember,
  putMessageSame,
  putPairAnswer,
  putPromptSame,
  putRoomWatch,
  putRsvp,
  putWave,
  type Cache,
} from './cache'
import { features } from './features'
import type {
  AnswerRow,
  AnswerSameRow,
  ChatMemberRow,
  ChatMessageRow,
  ChatRow,
  ChatSameRow,
  EventMessageRow,
  IntentJoinRow,
  IntentRow,
  IntroRequestRow,
  MessageSameRow,
  PairAnswerRow,
  ProfileRow,
  PromptSameRow,
  QuestionRow,
  RoomMemberRow,
  RoomMessageRow,
  RoomRow,
  RoomWatchRow,
  RsvpRow,
  SessionRow,
  WaveAnswerRow,
} from './rows'
import { ONLINE_WINDOW_MIN } from './map'
import { isServerId } from './sample'
import { bangkokDate } from './time'

// Reads. Every function fills the cache it is given and leaves publishing
// to the caller.

type Res = PromiseLike<{ data: unknown; error: unknown }>

export const ROOM_HISTORY = 50
const CHAT_HISTORY = 200
/** an event chat lasts at most 4 hours: its newest lines up to this many */
const EVENT_HISTORY = 500
/** sessions loaded at sign-in: ended up to this long ago (their chat stays readable 24 h after the end) */
const SESSIONS_BACK_MS = 36 * 3600_000
/** …and starting up to this far ahead (events can be set up to 60 days ahead) */
const SESSIONS_AHEAD_MS = 61 * 86_400_000
const CHUNK = 80
/** the API's default cap on rows per response (anything past it is dropped silently) */
const PAGE = 1000
/** intro requests loaded at sign-in: made up to this long ago (they expire after 3 days) */
const INTROS_BACK_MS = 30 * 86_400_000

async function rows<T>(req: Res): Promise<T[]> {
  const { data, error } = await req
  if (error) throw error
  return (data ?? []) as T[]
}

/** Every row of a query, PAGE at a time. The query needs a stable (unique) order. */
async function allRows<T>(page: (from: number, to: number) => Res): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const part = await rows<T>(page(from, from + PAGE - 1))
    out.push(...part)
    if (part.length < PAGE) return out
  }
}

function slicesOf(ids: string[]): string[][] {
  const slices: string[][] = []
  for (let i = 0; i < ids.length; i += CHUNK) slices.push(ids.slice(i, i + CHUNK))
  return slices
}

/** `in (…)` filters in URL-sized slices, run in parallel. */
async function inChunks<T>(ids: string[], run: (slice: string[]) => Res): Promise<T[]> {
  const parts = await Promise.all(slicesOf(ids).map((s) => rows<T>(run(s))))
  return parts.flat()
}

/** inChunks for lists that can grow past PAGE rows per slice: each slice is paged. */
async function inChunksAll<T>(ids: string[], run: (slice: string[], from: number, to: number) => Res): Promise<T[]> {
  const parts = await Promise.all(slicesOf(ids).map((s) => allRows<T>((from, to) => run(s, from, to))))
  return parts.flat()
}

/** Everything the app shows right after sign-in. */
export async function loadAll(c: Cache): Promise<void> {
  const q = db()
  const now = Date.now()
  const nowIso = new Date(now).toISOString()
  const [rooms, myMemberships, members, profiles, intents, sessions, questions, myChats, blocks] = await Promise.all([
    rows<RoomRow>(q.from('rooms').select('*').order('sort', { ascending: true })),
    // mine on their own: my room list must never depend on paging the whole table
    rows<RoomMemberRow>(q.from('room_members').select('room_id,user_id,role').eq('user_id', c.me)),
    allRows<RoomMemberRow>((from, to) => q.from('room_members').select('room_id,user_id,role').order('room_id').order('user_id').range(from, to)),
    rows<ProfileRow>(q.from('profiles').select('*').order('last_seen_at', { ascending: false }).limit(1000)),
    rows<IntentRow>(
      q.from('intents').select('*').eq('status', 'active').or(`expires_at.is.null,expires_at.gt."${nowIso}"`).order('created_at', { ascending: false }).limit(300),
    ),
    rows<SessionRow>(
      q
        .from('sessions')
        .select('*')
        .gte('starts_at', new Date(now - SESSIONS_BACK_MS).toISOString())
        .lte('starts_at', new Date(now + SESSIONS_AHEAD_MS).toISOString())
        .order('starts_at'),
    ),
    rows<QuestionRow>(q.from('daily_questions').select('*').lte('day', bangkokDate(now)).order('day', { ascending: false }).limit(100)),
    rows<ChatMemberRow>(q.from('chat_members').select('*').eq('user_id', c.me)),
    rows<{ blocked: string }>(q.from('blocks').select('blocked').eq('blocker', c.me)),
  ])

  c.rooms = rooms
  blocks.forEach((b) => c.blocked.add(b.blocked))
  members.forEach((m) => putMember(c, m, true))
  myMemberships.forEach((m) => putMember(c, m, true))
  profiles.forEach((p) => c.profiles.set(p.id, p))
  intents.forEach((i) => c.intents.set(i.id, i))
  sessions.forEach((s) => c.sessions.set(s.id, s))
  c.questions = latestPerRoom(questions)

  const intentIds = intents.map((i) => i.id)
  const sessionIds = sessions.map((s) => s.id)
  const questionIds = [...c.questions.values()].map((x) => x.id)
  const chatIds = myChats.map((m) => m.chat_id)
  const myRooms = myMemberships.map((m) => m.room_id)

  const [joins, rsvps, answers, answerSames, chats, chatMembers, chatMsgs, promptSames, events, wave, intros, watch, waveCards] = await Promise.all([
    inChunksAll<IntentJoinRow>(intentIds, (s, from, to) =>
      q.from('intent_joins').select('intent_id,user_id').in('intent_id', s).order('intent_id').order('user_id').range(from, to),
    ),
    inChunksAll<RsvpRow>(sessionIds, (s, from, to) =>
      q.from('session_rsvps').select('session_id,user_id').in('session_id', s).order('session_id').order('user_id').range(from, to),
    ),
    inChunksAll<AnswerRow>(questionIds, (s, from, to) =>
      q.from('daily_answers').select('*').in('question_id', s).order('created_at').order('question_id').order('user_id').range(from, to),
    ),
    inChunksAll<AnswerSameRow>(questionIds, (s, from, to) =>
      q
        .from('daily_answer_sames')
        .select('question_id,answer_user_id,user_id')
        .in('question_id', s)
        .order('question_id')
        .order('answer_user_id')
        .order('user_id')
        .range(from, to),
    ),
    inChunks<ChatRow>(chatIds, (s) => q.from('chats').select('*').in('id', s)),
    inChunks<ChatMemberRow>(chatIds, (s) => q.from('chat_members').select('*').in('chat_id', s)),
    inChunks<ChatMessageRow>(chatIds, (s) => q.from('chat_messages').select('*').in('chat_id', s).order('created_at', { ascending: false }).limit(1000)),
    loadPromptSames(),
    hasEventChats(),
    loadWave([c.me, ...profiles.map((p) => p.id)]),
    loadIntros(),
    loadRoomWatchAll(),
    hasWaveCards(c.me),
    ...myRooms.map((r) => loadRoomHistory(c, r)),
  ])

  joins.forEach((j) => putJoin(c, j, true))
  rsvps.forEach((r) => putRsvp(c, r, true))
  answers.forEach((a) => c.answers.set(pairKey(a.question_id, a.user_id), a))
  answerSames.forEach((s) => putAnswerSame(c, s, true))
  chats.forEach((ch) => c.chats.set(ch.id, ch))
  chatMembers.forEach((m) => putChatMember(c, m, true))
  chatMsgs.forEach((m) => putChatMessage(c, m))
  promptSames?.forEach((r) => putPromptSame(c, r, true))
  features.promptSames = !!promptSames
  features.events = events
  wave?.forEach((r) => putWave(c, r, true))
  features.waveQuiz = !!wave
  // the column comes back with every profile once it exists ('{}' when empty)
  features.lifeStages = profiles.some((p) => 'life_stages' in p)
  intros?.forEach((r) => putIntro(c, r, true))
  features.intros = !!intros
  watch?.forEach((r) => putRoomWatch(c, r))
  features.watch = !!watch
  features.waveCard = waveCards

  const msgIds = chatMsgs.map((m) => m.id)
  const introChats = chats.filter((ch) => ch.kind === 'intro').map((ch) => ch.id)
  const [sames] = await Promise.all([
    inChunks<ChatSameRow>(msgIds, (s) => q.from('chat_message_sames').select('id,message_id,user_id').in('message_id', s)),
    features.intros ? loadPairAnswers(c, introChats) : Promise.resolve([]),
  ])
  sames.forEach((s) => putChatSame(c, s, true))

  // people I chat with, post authors, answerers and who joined my posts may be outside the
  // newest 1000 profiles; ids the server won't return are a block relation and become hidden
  const mine = new Set(intents.filter((i) => i.user_id === c.me).map((i) => i.id))
  await ensureProfiles(c, [
    ...chatMembers.map((m) => m.user_id),
    ...intents.map((i) => i.user_id),
    ...answers.map((a) => a.user_id),
    ...joins.filter((j) => mine.has(j.intent_id)).map((j) => j.user_id),
    ...(promptSames ?? []).filter((r) => r.profile_id === c.me).map((r) => r.user_id),
    ...(intros ?? []).map((r) => (r.from_user === c.me ? r.to_user : r.from_user)),
  ])
}

/**
 * "ให้โมชิแนะนำให้" requests I asked for or that are about me, from the last 30 days. undefined:
 * intro_requests isn't there yet (20261117000001_lifestage_intro_watch.sql), so intros stay off.
 */
async function loadIntros(): Promise<IntroRequestRow[] | undefined> {
  try {
    return await rows<IntroRequestRow>(
      db()
        .from('intro_requests')
        .select('*')
        .gte('created_at', new Date(Date.now() - INTROS_BACK_MS).toISOString())
        .order('created_at', { ascending: false })
        .limit(300),
    )
  } catch (err) {
    if (!missingTable(err)) throw err
    console.info('[moshi] intros are off until 20261117000001_lifestage_intro_watch.sql runs', err)
    return undefined
  }
}

/** Intro requests by id, as the server has them now (after a request or an answer). */
export async function loadIntrosById(c: Cache, ids: string[]): Promise<IntroRequestRow[]> {
  const wanted = [...new Set(ids)].filter(isServerId)
  if (!wanted.length) return []
  const found = await inChunks<IntroRequestRow>(wanted, (s) => db().from('intro_requests').select('*').in('id', s))
  found.forEach((r) => putIntro(c, r, true))
  // one RLS hides now (set aside, a block) is gone for me
  wanted.filter((id) => !found.some((r) => r.id === id)).forEach((id) => c.intros.delete(id))
  await ensureProfiles(
    c,
    found.map((r) => (r.from_user === c.me ? r.to_user : r.from_user)),
  )
  return found
}

/** The question pair answers I can see in these chats (mine; theirs once I answered too). */
export async function loadPairAnswers(c: Cache, chatIds: string[]): Promise<PairAnswerRow[]> {
  const ids = [...new Set(chatIds)].filter(isServerId)
  if (!ids.length) return []
  const list = await inChunks<PairAnswerRow>(ids, (s) => db().from('chat_pair_answers').select('*').in('chat_id', s).order('created_at'))
  // a fresh copy for these chats
  ids.forEach((id) => {
    c.pairAnswers.get(id)?.forEach((_, aid) => c.pairChat.delete(aid))
    c.pairAnswers.delete(id)
  })
  list.forEach((r) => putPairAnswer(c, r))
  return list
}

/**
 * Every room's clip (one row per room, so a small read). undefined: room_watch isn't there yet
 * (20261117000001_lifestage_intro_watch.sql), so watching together stays off.
 */
export async function loadRoomWatchAll(): Promise<RoomWatchRow[] | undefined> {
  try {
    return await allRows<RoomWatchRow>((from, to) => db().from('room_watch').select('*').order('room_id').range(from, to))
  } catch (err) {
    if (!missingTable(err)) throw err
    console.info('[moshi] watching together is off until 20261117000001_lifestage_intro_watch.sql runs', err)
    return undefined
  }
}

/** One room's clip as the server has it now (null: the room never had one). */
export async function loadRoomWatch(c: Cache, roomId: string): Promise<RoomWatchRow | null> {
  const list = await rows<RoomWatchRow>(db().from('room_watch').select('*').eq('room_id', roomId).limit(1))
  if (list[0]) putRoomWatch(c, list[0])
  return list[0] ?? null
}

/**
 * Story reactions I gave or got (RLS returns only those). undefined: the table isn't there
 * yet (20261108000003_live_reactions.sql hasn't run), so they stay on this device as before.
 */
async function loadPromptSames(): Promise<PromptSameRow[] | undefined> {
  try {
    return await allRows<PromptSameRow>((from, to) => db().from('prompt_sames').select('id,profile_id,prompt_key,user_id').order('id').range(from, to))
  } catch (err) {
    // only "no such table" means it isn't set up yet; anything else is a failed load (retried like the rest)
    if (!missingTable(err)) throw err
    console.info('[moshi] story reactions stay on this device until prompt_sames is set up', err)
    return undefined
  }
}

/** Only "no such table" means a later migration hasn't run yet; anything else is a failed load. */
function missingTable(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code
  return code === 'PGRST205' || code === '42P01'
}

/**
 * Is wave_card_preview() there (20261117000001_lifestage_intro_watch.sql)? Asked about me (my own
 * teaser): until it is, a shared card's link couldn't open for anyone signed out, so there's no card.
 */
async function hasWaveCards(me: string): Promise<boolean> {
  try {
    await rows(db().rpc('wave_card_preview', { p_user: me }))
    return true
  } catch (err) {
    const code = (err as { code?: string } | null)?.code
    // no such function (PostgREST's schema cache, or Postgres itself)
    if (code !== 'PGRST202' && code !== '42883') throw err
    console.info('[moshi] wave cards are off until 20261117000001_lifestage_intro_watch.sql runs', err)
    return false
  }
}

/** Is event_messages there (20261114000001_room_events.sql)? It comes with the new sessions columns. */
async function hasEventChats(): Promise<boolean> {
  try {
    await rows(db().from('event_messages').select('id').limit(1))
    return true
  } catch (err) {
    if (!missingTable(err)) throw err
    console.info('[moshi] event chats are off until 20261114000001_room_events.sql runs', err)
    return false
  }
}

/**
 * "จูนคลื่น" picks of these people (the bank's questions only). undefined: wave_answers isn't there
 * yet (20261114000002_wave_quiz.sql), so picks stay on this device.
 */
export async function loadWave(userIds: string[]): Promise<WaveAnswerRow[] | undefined> {
  const ids = [...new Set(userIds)].filter(isServerId)
  if (!ids.length) return []
  const q = db()
  try {
    return await inChunksAll<WaveAnswerRow>(ids, (s, from, to) =>
      q
        .from('wave_answers')
        .select('user_id,question_id,choice')
        .in('user_id', s)
        .in('question_id', [...WAVE_IDS])
        .order('user_id')
        .order('question_id')
        .range(from, to),
    )
  } catch (err) {
    if (!missingTable(err)) throw err
    console.info('[moshi] "จูนคลื่น" picks stay on this device until wave_answers is set up', err)
    return undefined
  }
}

/** Sessions by id (an event opened from a link, outside the sign-in window) with their RSVPs. Returns the ids found. */
export async function loadSessions(c: Cache, ids: string[]): Promise<string[]> {
  const wanted = [...new Set(ids)].filter(isServerId)
  if (!wanted.length) return []
  const q = db()
  const found = await inChunks<SessionRow>(wanted, (s) => q.from('sessions').select('*').in('id', s))
  found.forEach((s) => c.sessions.set(s.id, s))
  const rsvps = await inChunksAll<RsvpRow>(
    found.map((s) => s.id),
    (s, from, to) => q.from('session_rsvps').select('session_id,user_id').in('session_id', s).order('session_id').order('user_id').range(from, to),
  )
  rsvps.forEach((r) => putRsvp(c, r, true))
  return found.map((s) => s.id)
}

/** An event's chat: its newest EVENT_HISTORY lines (the server hides it 24 h after the event ends). */
export async function loadEventMessages(c: Cache, sessionId: string): Promise<EventMessageRow[]> {
  const list = await rows<EventMessageRow>(
    db().from('event_messages').select('*').eq('session_id', sessionId).order('created_at', { ascending: false }).limit(EVENT_HISTORY),
  )
  // a fresh copy: lines deleted meanwhile go
  c.eventMsgs.get(sessionId)?.forEach((_, id) => c.msgEvent.delete(id))
  c.eventMsgs.set(sessionId, new Map())
  list.forEach((m) => putEventMessage(c, m))
  await ensureProfiles(
    c,
    list.map((m) => m.user_id),
  )
  return list
}

/**
 * Who has been around lately (the online dots): fresh last_seen_at for people we know,
 * whole profiles for newcomers. Returns true if anything changed.
 */
export async function loadRecentlySeen(c: Cache): Promise<boolean> {
  const since = new Date(Date.now() - ONLINE_WINDOW_MIN * 60_000).toISOString()
  const list = await rows<Pick<ProfileRow, 'id' | 'last_seen_at'>>(
    db().from('profiles').select('id,last_seen_at').gt('last_seen_at', since).order('last_seen_at', { ascending: false }).limit(PAGE),
  )
  let changed = false
  const unknown: string[] = []
  for (const r of list) {
    const p = c.profiles.get(r.id)
    if (!p) unknown.push(r.id)
    else if (p.last_seen_at !== r.last_seen_at) {
      c.profiles.set(r.id, { ...p, last_seen_at: r.last_seen_at })
      changed = true
    }
  }
  return (await ensureProfiles(c, unknown)) || changed
}

/** The last ROOM_HISTORY messages of a room (+ their "เหมือนกัน!"s). */
export async function loadRoomHistory(c: Cache, roomId: string): Promise<RoomMessageRow[]> {
  const q = db()
  const list = await rows<RoomMessageRow>(
    q.from('room_messages').select('*').eq('room_id', roomId).order('created_at', { ascending: false }).limit(ROOM_HISTORY),
  )
  const sames = await inChunksAll<MessageSameRow>(
    list.map((m) => m.id),
    (s, from, to) => q.from('room_message_sames').select('message_id,user_id').in('message_id', s).order('message_id').order('user_id').range(from, to),
  )
  const map = c.roomMsgs.get(roomId) ?? new Map<string, RoomMessageRow>()
  list.forEach((m) => {
    map.set(m.id, m)
    c.msgRoom.set(m.id, roomId)
  })
  c.roomMsgs.set(roomId, map)
  sames.forEach((s) => putMessageSame(c.roomSames, s, true))
  // reactors too: a block either way hides them, and the ones we know get their faces
  await ensureProfiles(c, [...list.map((m) => m.user_id ?? ''), ...sames.map((s) => s.user_id)])
  return list
}

/** One chat with its members, recent messages and reactions (e.g. a new moshi). */
export async function loadChat(c: Cache, chatId: string): Promise<boolean> {
  const q = db()
  const [chat, members, msgs] = await Promise.all([
    rows<ChatRow>(q.from('chats').select('*').eq('id', chatId).limit(1)),
    rows<ChatMemberRow>(q.from('chat_members').select('*').eq('chat_id', chatId)),
    rows<ChatMessageRow>(q.from('chat_messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: false }).limit(CHAT_HISTORY)),
  ])
  if (!chat[0]) return false
  const sames = await inChunks<ChatSameRow>(
    msgs.map((m) => m.id),
    (s) => q.from('chat_message_sames').select('id,message_id,user_id').in('message_id', s),
  )
  c.chats.set(chatId, chat[0])
  members.forEach((m) => putChatMember(c, m, true))
  msgs.forEach((m) => putChatMessage(c, m))
  sames.forEach((s) => putChatSame(c, s, true))
  await ensureProfiles(
    c,
    members.map((m) => m.user_id),
  )
  return true
}

/**
 * Fetch profiles we haven't seen yet (new members, chat partners). Ids the
 * server won't return are in a block relation with me and become `hidden`.
 * Returns true if anything changed.
 */
export async function ensureProfiles(c: Cache, ids: string[]): Promise<boolean> {
  const missing = [...new Set(ids)].filter((id) => isServerId(id) && !c.profiles.has(id) && !c.hidden.has(id))
  if (!missing.length) return false
  const q = db()
  const found = await inChunks<ProfileRow>(missing, (s) => q.from('profiles').select('*').in('id', s))
  found.forEach((p) => c.profiles.set(p.id, p))
  missing.filter((id) => !c.profiles.has(id)).forEach((id) => c.hidden.add(id))
  return true
}
