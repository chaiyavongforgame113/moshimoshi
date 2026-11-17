import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { resetCatalog, useCatalog } from '@/data/catalog'
import { resetPersonalState, useMoshi } from '@/lib/store'
import { db, supabase } from '@/lib/supabase'
import { applyToCache } from './apply'
import { clearAliases, clearPending, onChange, onReload, pendingWave, resolveId } from './bus'
import { createCache, putChatMember, putRoomWatch, putWave, type Cache } from './cache'
import { isNetworkError, isRefusal } from './errors'
import { features } from './features'
import {
  ensureProfiles,
  loadAll,
  loadChat,
  loadEventMessages,
  loadPairAnswers,
  loadRecentlySeen,
  loadRoomHistory,
  loadRoomWatch,
  loadRoomWatchAll,
  loadSessions,
  loadWave,
} from './load'
import {
  apply,
  chatsPatch,
  eventMessagesPatch,
  intentsPatch,
  myGoingPatch,
  myIntentsPatch,
  mySamesPatch,
  pairAnswersPatch,
  peoplePatch,
  publishAll,
  questionsPatch,
  roomMessagesPatch,
  roomsPatch,
  roomWatchPatch,
  sessionsPatch,
  wavePatch,
} from './publish'
import type { Change, LiveTable } from './rows'
import { isServerId } from './sample'
import { markChatRead, touchLastSeen, upsertWave } from './writes'

/*
 * One live session per signed-in user: realtime → first load → heartbeat.
 * Realtime events and our own writes (via the change bus) update the cache,
 * then only the affected slices are re-published.
 * No realtime presence on purpose: a presence channel ignores blocks (anyone
 * could watch who's online). Online dots come from last_seen_at, which the
 * heartbeat writes and profiles RLS hides across a block.
 */

const REALTIME: LiveTable[] = [
  'room_messages',
  'room_message_sames',
  'chat_messages',
  'chats',
  'chat_members',
  'intents',
  'intent_joins',
  'daily_answers',
]
/**
 * "เหมือนกัน!" on a 1:1 message, an answer or a profile story, so the other person sees it
 * right away. On a channel of their own: a database without 20261108000003_live_reactions.sql
 * refuses these tables, and that must not take chats and rooms down with it. The first load
 * tells which (prompt_sames is there or not); without them a reaction still shows up for the
 * other person after a reload, as before.
 */
const REALTIME_REACTIONS: LiveTable[] = ['chat_message_sames', 'daily_answer_sames', 'prompt_sames']
/**
 * New and cancelled events, and who's going, as they happen (20261114000001_room_events.sql adds
 * them to the publication). Their own channel, dropped when the first load finds no events yet.
 * Each open event chat streams on a channel of its own (watchEvent).
 */
const REALTIME_EVENTS: LiveTable[] = ['sessions', 'session_rsvps']
/**
 * Mochi's intros and the question pair (20261117000001_lifestage_intro_watch.sql adds them to the
 * publication). Their own channel, dropped when the first load finds no intro_requests yet. RLS
 * decides who gets each change. A room's clip streams on a channel of its own while it's on screen
 * (watchRoom); the rest of the rooms' clips are read again with the heartbeat.
 */
const REALTIME_SOCIAL: LiveTable[] = ['intro_requests', 'chat_pair_answers']
/** "จูนคลื่น" ids are slugs (the database checks the same) */
const WAVE_ID = /^[a-z0-9-]{1,40}$/
const HEARTBEAT_MS = 2 * 60_000
const TICK_MS = 60_000
/** how long the first load waits for realtime before going ahead (a later SUBSCRIBED catches up) */
const SUBSCRIBE_WAIT_MS = 4000
/** a tab hidden longer than this reloads everything when it comes back */
const STALE_MS = 3 * 60_000

/** A room whose clip is on screen: its row streams in while anyone shows it. */
interface RoomWatchSub {
  users: number
  channel: RealtimeChannel | null
}

/** An event chat on screen: its history is loaded and its lines stream in while anyone watches. */
interface EventWatch {
  users: number
  channel: RealtimeChannel | null
  loading: boolean
  /** asked to load again while a load was running */
  again: boolean
}

interface LiveSession {
  cache: Cache
  channels: RealtimeChannel[]
  /** the reaction tables' own channel (dropped if the database can't stream them) */
  reactions: RealtimeChannel | null
  /** sessions + RSVPs (dropped if the database has no events yet) */
  events: RealtimeChannel | null
  /** intros + question pair answers (dropped if the database has no intros yet) */
  social: RealtimeChannel | null
  roomWatches: Map<string, RoomWatchSub>
  pairLoads: Map<string, Promise<void>>
  eventWatches: Map<string, EventWatch>
  /** sessions fetched by id (outside the sign-in window): a full reload fetches them again */
  extraSessions: Set<string>
  sessionLoads: Map<string, Promise<void>>
  stops: (() => void)[]
  /** changes that arrive while a full reload is running */
  buffer: Change[] | null
  /** a reload was asked for while one was running: run another when it ends */
  again: boolean
  /** profiles the next reload fetches by id (e.g. someone I just unblocked, past the newest 1000) */
  wanted: Set<string>
  roomLoads: Map<string, Promise<void>>
  chatLoads: Map<string, Promise<void>>
  connected: boolean
  dropped: boolean
  attempts: number
  hiddenAt: number
}

let current: LiveSession | null = null
const alive = (s: LiveSession) => current === s

export function startSync(userId: string) {
  if (current?.cache.me === userId) return
  // someone else was signed in on this tab: start from a clean slate
  if (current) stopSync({ clear: true })
  const s: LiveSession = {
    cache: createCache(userId),
    channels: [],
    reactions: null,
    events: null,
    social: null,
    roomWatches: new Map(),
    pairLoads: new Map(),
    eventWatches: new Map(),
    extraSessions: new Set(),
    sessionLoads: new Map(),
    stops: [],
    buffer: null,
    again: false,
    wanted: new Set(),
    roomLoads: new Map(),
    chatLoads: new Map(),
    connected: false,
    dropped: false,
    attempts: 0,
    hiddenAt: 0,
  }
  current = s
  s.stops.push(onChange((ch) => applyChange(s, ch)))
  // the store's way to ask for a full reload (e.g. after an unblock)
  s.stops.push(
    onReload((profiles) => {
      profiles?.forEach((id) => s.wanted.add(id))
      return refresh(s).catch((err) => console.warn('[moshi] refresh failed', err))
    }),
  )
  useCatalog.getState().set({ mode: 'live', ready: false, error: null })
  void firstLoad(s)
}

export function stopSync(opts: { clear?: boolean } = {}) {
  const s = current
  current = null
  if (s) {
    s.stops.forEach((stop) => stop())
    s.channels.forEach((ch) => void supabase?.removeChannel(ch))
  }
  if (opts.clear) {
    clearAliases()
    clearPending()
    resetCatalog()
    resetPersonalState()
  }
}

/** After the first load failed for good: the retry button. */
export function retrySync() {
  const s = current
  if (!s) return
  s.attempts = 0
  useCatalog.getState().set({ error: null })
  void firstLoad(s)
}

async function firstLoad(s: LiveSession) {
  try {
    // listen first, then load: changes committed while loading are buffered and replayed
    if (!s.channels.length) await subscribe(s)
    if (!alive(s)) return
    await refresh(s)
    if (!alive(s)) return
    // no prompt_sames: the reactions migration hasn't run, so its tables can't stream either
    if (!features.promptSames) dropReactions(s)
    if (!features.events) dropEvents(s)
    if (!features.intros) dropSocial(s)
    if (s.connected) return
    s.connected = true
    startTimers(s)
  } catch (err) {
    if (!alive(s)) return
    console.warn('[moshi] first sync failed', err)
    if (++s.attempts < 3) window.setTimeout(() => alive(s) && void firstLoad(s), 1500 * s.attempts)
    else
      useCatalog.getState().set({
        error: isNetworkError(err) ? 'network' : 'load',
      })
  }
}

/** Reload everything into a fresh cache, then swap it in (changes meanwhile are replayed). */
async function refresh(s: LiveSession) {
  if (s.buffer) {
    s.again = true
    return
  }
  s.buffer = []
  try {
    const fresh = createCache(s.cache.me)
    const wanted = [...s.wanted]
    await loadAll(fresh)
    // keep the history of rooms opened earlier in this session
    await Promise.all([...s.cache.roomMsgs.keys()].filter((r) => !fresh.roomMsgs.has(r)).map((r) => loadRoomHistory(fresh, r)))
    // events opened from a link (outside the sign-in window), and the event chats on screen
    const extra = [...s.extraSessions].filter((id) => !fresh.sessions.has(id))
    if (extra.length) await loadSessions(fresh, extra)
    if (features.events) {
      await Promise.all(
        [...s.eventWatches.keys()].map((id) => loadEventMessages(fresh, id).catch((err) => console.warn('[moshi] event chat reload failed', err))),
      )
    }
    if (wanted.length) await ensureProfiles(fresh, wanted)
    if (!alive(s)) return
    wanted.forEach((id) => s.wanted.delete(id))
    s.cache = fresh
    publishAll(fresh)
    // picks this device holds that the server doesn't (made offline, or before wave_answers): every
    // reload sends them, and reconnecting runs a reload
    if (features.waveQuiz) uploadLocalWave(s)
    // events whose fetch by id failed earlier get another go
    useCatalog.getState().failedSessions.forEach((id) => void retrySession(id))
  } finally {
    const buffered = s.buffer ?? []
    s.buffer = null
    if (alive(s)) buffered.forEach((ch) => applyChange(s, ch))
    if (s.again && alive(s)) {
      s.again = false
      void refresh(s).catch((err) => console.warn('[moshi] refresh failed', err))
    }
  }
}

// ------------------------------------------------------------------ lazy loads

/** Load a room's last messages the first time it is opened (no-op in demo mode). */
export function ensureRoomHistory(roomId: string): Promise<void> {
  const s = current
  if (!s || !roomId || s.cache.roomMsgs.has(roomId)) return Promise.resolve()
  let p = s.roomLoads.get(roomId)
  if (!p) {
    const cache = s.cache
    p = loadRoomHistory(cache, roomId)
      .then(() => {
        if (!alive(s)) return
        // a full reload swapped the cache meanwhile: load into the new one
        if (s.cache !== cache) return void window.setTimeout(() => void ensureRoomHistory(roomId))
        const r = roomMessagesPatch(s.cache, [roomId])
        apply({ ...r.cat, ...peoplePatch(s.cache) }, { ...r.mine, ...mySamesPatch(s.cache) })
      })
      .catch((err) => console.warn('[moshi] room history failed', err))
      .finally(() => s.roomLoads.delete(roomId))
    s.roomLoads.set(roomId, p)
  }
  return p
}

function needChat(s: LiveSession, chatId: string) {
  if (s.chatLoads.has(chatId)) return
  const cache = s.cache
  const p = loadChat(cache, chatId)
    .then((ok) => {
      if (!alive(s) || !ok) return
      if (s.cache !== cache) return void window.setTimeout(() => alive(s) && needChat(s, chatId))
      apply(peoplePatch(s.cache), { ...chatsPatch(s.cache), ...mySamesPatch(s.cache) })
    })
    .catch((err) => console.warn('[moshi] chat load failed', err))
    .finally(() => s.chatLoads.delete(chatId))
  s.chatLoads.set(chatId, p)
}

/** Fetch an intro chat's question pair answers again (Mochi spoke: both may have answered). */
function needPair(s: LiveSession, chatId: string) {
  if (!features.intros || s.pairLoads.has(chatId)) return
  const cache = s.cache
  const p = loadPairAnswers(cache, [chatId])
    .then(() => {
      if (alive(s) && s.cache === cache) apply({}, pairAnswersPatch(cache))
    })
    .catch((err) => console.warn('[moshi] question pair load failed', err))
    .finally(() => s.pairLoads.delete(chatId))
  s.pairLoads.set(chatId, p)
}

function needProfiles(s: LiveSession, ids: string[]) {
  ensureProfiles(s.cache, ids)
    .then((changed) => {
      if (!changed || !alive(s)) return
      // someone hidden (a block) may have just written, posted or answered: drop it
      const c = s.cache
      const r = roomMessagesPatch(c, c.roomMsgs.keys())
      const e = eventMessagesPatch(c, c.eventMsgs.keys())
      apply(
        { ...peoplePatch(c), ...intentsPatch(c), ...questionsPatch(c), ...sessionsPatch(c), ...wavePatch(c), ...r.cat, ...e.cat },
        { ...r.mine, ...e.mine, ...myIntentsPatch(c) },
      )
    })
    .catch((err) => console.warn('[moshi] profile load failed', err))
}

// ------------------------------------------------------------------ events

/**
 * One session by id, for an event page opened from a link outside the sign-in window (no-op in
 * demo mode or when it's loaded already). Not found: its id goes on the catalog's missingSessions.
 */
export function ensureSession(sessionId: string): Promise<void> {
  const s = current
  if (!s || !isServerId(sessionId) || s.cache.sessions.has(sessionId)) return Promise.resolve()
  let p = s.sessionLoads.get(sessionId)
  if (!p) {
    const cache = s.cache
    p = loadSessions(cache, [sessionId])
      .then((found) => {
        if (!alive(s)) return
        if (s.cache !== cache) return void window.setTimeout(() => void ensureSession(sessionId))
        if (found.length) s.extraSessions.add(sessionId)
        const missing = useCatalog.getState().missingSessions
        apply(
          { ...sessionsPatch(cache), ...(found.length || missing.includes(sessionId) ? {} : { missingSessions: [...missing, sessionId] }) },
          myGoingPatch(cache),
        )
      })
      .catch((err) => {
        console.warn('[moshi] event load failed', err)
        if (!alive(s)) return
        // the event page shows a retry instead of loading for good; a reconnect retries by itself
        const failed = useCatalog.getState().failedSessions
        if (!failed.includes(sessionId)) useCatalog.getState().set({ failedSessions: [...failed, sessionId] })
      })
      .finally(() => s.sessionLoads.delete(sessionId))
    s.sessionLoads.set(sessionId, p)
  }
  return p
}

/** Try again to fetch an event whose fetch failed (the event page's retry button, and every reload). */
export function retrySession(sessionId: string): Promise<void> {
  const failed = useCatalog.getState().failedSessions
  if (failed.includes(sessionId)) useCatalog.getState().set({ failedSessions: failed.filter((id) => id !== sessionId) })
  return ensureSession(sessionId)
}

/** (Re)load an event chat's history into the cache and publish it. One load at a time per chat. */
function loadEventHistory(s: LiveSession, sessionId: string, w: EventWatch) {
  if (w.loading) {
    w.again = true
    return
  }
  w.loading = true
  const cache = s.cache
  loadEventMessages(cache, sessionId)
    .then(() => {
      // a full reload swapped the cache meanwhile: it loads the chats on screen itself
      if (!alive(s) || s.cache !== cache || s.eventWatches.get(sessionId) !== w) return
      const r = eventMessagesPatch(cache, [sessionId])
      apply({ ...r.cat, ...peoplePatch(cache) }, r.mine)
    })
    .catch((err) => console.warn('[moshi] event chat failed', err))
    .finally(() => {
      w.loading = false
      if (w.again && alive(s) && s.eventWatches.get(sessionId) === w) {
        w.again = false
        loadEventHistory(s, sessionId, w)
      }
    })
}

/**
 * An event chat is on screen: load its history and stream its lines until the returned function
 * is called (several screens may watch one chat; the last one out closes it). No-op in demo mode,
 * before the first load, or while the database has no events yet.
 */
export function watchEvent(sessionId: string): () => void {
  const s = current
  if (!s || !isServerId(sessionId) || !features.events) return () => {}
  let w = s.eventWatches.get(sessionId)
  if (!w) {
    const watch: EventWatch = { users: 0, channel: null, loading: false, again: false }
    w = watch
    s.eventWatches.set(sessionId, watch)
    void ensureSession(sessionId)
    try {
      const ch = db()
        .channel(`event:${sessionId}:${Math.random().toString(36).slice(2, 10)}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'event_messages', filter: `session_id=eq.${sessionId}` },
          (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
            if (!alive(s) || s.eventWatches.get(sessionId) !== watch) return
            const row = payload.eventType === 'DELETE' ? payload.old : payload.new
            applyChange(s, { table: 'event_messages', type: payload.eventType, row } as unknown as Change)
          },
        )
      watch.channel = ch
      s.channels.push(ch)
      // every (re)join catches up on what was said meanwhile
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED' && alive(s) && s.eventWatches.get(sessionId) === watch) loadEventHistory(s, sessionId, watch)
      })
    } catch (err) {
      console.warn('[moshi] event chat stream failed', err)
    }
    // the history shows without waiting for realtime
    loadEventHistory(s, sessionId, watch)
  }
  const watch = w
  watch.users++
  let done = false
  return () => {
    if (done) return
    done = true
    if (--watch.users > 0 || s.eventWatches.get(sessionId) !== watch) return
    s.eventWatches.delete(sessionId)
    const ch = watch.channel
    if (ch) {
      s.channels = s.channels.filter((x) => x !== ch)
      void supabase?.removeChannel(ch)
    }
  }
}

/**
 * Picks on this device the server doesn't have yet: made before wave_answers existed, or made while
 * offline (pendingWave marks those `waiting`; they win over an older pick the server has). Any
 * other pick the server already has stays as the server has it. One upload at a time.
 */
let uploadingWave = false
function uploadLocalWave(s: LiveSession) {
  if (uploadingWave) return
  const c = s.cache
  const { wave, waveOwner } = useMoshi.getState()
  if (waveOwner && waveOwner !== c.me) return
  const server = c.wave.get(c.me)
  const missing = Object.entries(wave).filter(([q]) => WAVE_ID.test(q) && (!server?.has(q) || !!pendingWave.get(q)?.waiting))
  if (!missing.length) return
  // the taps this upload carries: a newer tap meanwhile keeps its own entry
  const taps = new Map(missing.map(([q]) => [q, pendingWave.get(q)] as const))
  const settle = () =>
    taps.forEach((tap, q) => {
      if (tap && pendingWave.get(q) === tap) pendingWave.delete(q)
    })
  uploadingWave = true
  upsertWave(
    c.me,
    missing.map(([question_id, choice]) => ({ question_id, choice })),
  )
    .then((rows) => {
      settle()
      if (alive(s)) rows.forEach((row) => applyChange(s, { table: 'wave_answers', type: 'INSERT', row }))
    })
    .catch((err) => {
      console.warn('[moshi] could not save the "จูนคลื่น" picks from this device', err)
      // refused: the server's picks show again on the next publish. Lost on the way: they wait.
      if (isRefusal(err)) settle()
    })
    .finally(() => {
      uploadingWave = false
    })
}

/** A message landed in the chat that's open on screen: it's read already. */
function readIfOpen(s: LiveSession, chatId: string, createdAt: string) {
  const m = window.location.pathname.match(/^\/app\/chats\/([^/]+)/)
  if (!m || resolveId(decodeURIComponent(m[1])) !== chatId || document.visibilityState !== 'visible') return
  const at = new Date(Math.max(Date.now(), Date.parse(createdAt) || 0)).toISOString()
  putChatMember(s.cache, { chat_id: chatId, user_id: s.cache.me, last_read_at: at }, true)
  markChatRead(chatId).catch(() => {})
}

// ------------------------------------------------------------------ changes

function applyChange(s: LiveSession, ch: Change) {
  if (s.buffer) {
    s.buffer.push(ch)
    return
  }
  applyToCache(s.cache, ch, {
    needChat: (id) => needChat(s, id),
    needProfiles: (ids) => needProfiles(s, ids),
    readIfOpen: (id, at) => readIfOpen(s, id, at),
    needPair: (id) => needPair(s, id),
  })
}

// ------------------------------------------------------------------ people, intros, watching together

/**
 * Someone's profile and "จูนคลื่น" picks, for a comparison opened from their wave card (they may be
 * outside the newest 1000 profiles). Resolves 'found', or 'missing' (no such person, a block either
 * way, or demo mode / before the first load: then the catalog is all there is).
 */
export async function ensurePerson(userId: string): Promise<'found' | 'missing'> {
  const s = current
  if (!s || !isServerId(userId)) return 'missing'
  const cache = s.cache
  if (!cache.profiles.has(userId) && !cache.hidden.has(userId)) await ensureProfiles(cache, [userId])
  if (!cache.profiles.has(userId)) return 'missing'
  if (features.waveQuiz && !cache.wave.has(userId)) {
    const picks = await loadWave([userId]).catch(() => undefined)
    picks?.forEach((r) => putWave(cache, r, true))
  }
  if (alive(s) && s.cache === cache) apply({ ...peoplePatch(cache), ...wavePatch(cache) }, {})
  return 'found'
}

/** Read one room's clip again and publish it (a channel (re)joined, or after a refused control). */
export function reloadRoomWatch(roomId: string): Promise<void> {
  const s = current
  if (!s || !features.watch) return Promise.resolve()
  const cache = s.cache
  return loadRoomWatch(cache, roomId)
    .then(() => {
      if (alive(s) && s.cache === cache) apply(roomWatchPatch(cache), {})
    })
    .catch((err) => console.warn('[moshi] room clip load failed', err))
}

/**
 * A room's clip is on screen: stream its row (play, pause, seek…) until the returned function is
 * called (several screens may show one room; the last one out closes it). No-op in demo mode,
 * before the first load, or while the database has no room_watch yet.
 */
export function watchRoom(roomId: string): () => void {
  const s = current
  if (!s || !roomId || !features.watch) return () => {}
  let sub = s.roomWatches.get(roomId)
  if (!sub) {
    const fresh: RoomWatchSub = { users: 0, channel: null }
    sub = fresh
    s.roomWatches.set(roomId, fresh)
    try {
      const ch = db()
        .channel(`watch:${roomId}:${Math.random().toString(36).slice(2, 10)}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'room_watch', filter: `room_id=eq.${roomId}` },
          (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
            if (!alive(s) || s.roomWatches.get(roomId) !== fresh) return
            const row = payload.eventType === 'DELETE' ? payload.old : payload.new
            applyChange(s, { table: 'room_watch', type: payload.eventType, row } as unknown as Change)
          },
        )
      fresh.channel = ch
      s.channels.push(ch)
      // every (re)join catches up on what changed meanwhile
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED' && alive(s) && s.roomWatches.get(roomId) === fresh) void reloadRoomWatch(roomId)
      })
    } catch (err) {
      console.warn('[moshi] room clip stream failed', err)
    }
    void reloadRoomWatch(roomId)
  }
  const held = sub
  held.users++
  let done = false
  return () => {
    if (done) return
    done = true
    if (--held.users > 0 || s.roomWatches.get(roomId) !== held) return
    s.roomWatches.delete(roomId)
    const ch = held.channel
    if (ch) {
      s.channels = s.channels.filter((x) => x !== ch)
      void supabase?.removeChannel(ch)
    }
  }
}

/** Every room's clip again (the room cards' "กำลังดูด้วยกัน"; runs with the heartbeat). */
function refreshRoomWatchAll(s: LiveSession) {
  if (!features.watch) return
  const cache = s.cache
  loadRoomWatchAll()
    .then((list) => {
      if (!list || !alive(s) || s.cache !== cache) return
      const seen = new Set(list.map((r) => r.room_id))
      // rooms that went with their row (a deleted room) drop out
      ;[...cache.roomWatch.keys()].filter((id) => !seen.has(id)).forEach((id) => cache.roomWatch.delete(id))
      list.forEach((r) => putRoomWatch(cache, r))
      apply(roomWatchPatch(cache), {})
    })
    .catch((err) => console.warn('[moshi] room clips refresh failed', err))
}

// ------------------------------------------------------------------ realtime

/** Stop asking for intros and the question pair (the database has no intros yet). */
function dropSocial(s: LiveSession) {
  const ch = s.social
  if (!ch) return
  s.social = null
  s.channels = s.channels.filter((c) => c !== ch)
  void db().removeChannel(ch)
}

/** Stop asking for sessions and RSVPs (the database has no events yet, so they aren't published). */
function dropEvents(s: LiveSession) {
  const ch = s.events
  if (!ch) return
  s.events = null
  s.channels = s.channels.filter((c) => c !== ch)
  void db().removeChannel(ch)
}

/** Stop asking for the reaction tables (the database can't stream them). */
function dropReactions(s: LiveSession) {
  const ch = s.reactions
  if (!ch) return
  console.info('[moshi] live reactions are off until 20261108000003_live_reactions.sql runs')
  s.reactions = null
  s.channels = s.channels.filter((c) => c !== ch)
  void db().removeChannel(ch)
}

/** Resolves once realtime is listening (or failed, or SUBSCRIBE_WAIT_MS passed — then a later SUBSCRIBED reloads). */
function subscribe(s: LiveSession): Promise<void> {
  // a fresh topic per session: an old channel that never got its unsubscribe ack can't be handed back
  const topic = `${s.cache.me}:${Math.random().toString(36).slice(2, 10)}`
  const listen = (ch: RealtimeChannel, tables: LiveTable[]) => {
    for (const table of tables) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table }, (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
        // a channel that outlived its session (no unsubscribe ack) must not write into the stores
        if (!alive(s)) return
        const row = payload.eventType === 'DELETE' ? payload.old : payload.new
        applyChange(s, { table, type: payload.eventType, row } as unknown as Change)
      })
    }
  }
  const channel = db().channel(`db:${topic}`)
  listen(channel, REALTIME)
  s.channels.push(channel)

  // best effort: an error here only means reactions wait for a reload. A dropped socket errors
  // this channel too; it rejoins by itself, and the main channel's reload covers the gap.
  const reactions = db().channel(`db-reactions:${topic}`)
  listen(reactions, REALTIME_REACTIONS)
  s.channels.push(reactions)
  s.reactions = reactions
  try {
    reactions.subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR' && alive(s)) console.info('[moshi] live reactions: channel error, rejoining', err)
    })
  } catch (err) {
    console.warn('[moshi] live reactions failed', err)
  }

  // best effort too: without it, new events and RSVPs show after a reload, as before
  const events = db().channel(`db-events:${topic}`)
  listen(events, REALTIME_EVENTS)
  s.channels.push(events)
  s.events = events
  try {
    events.subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR' && alive(s)) console.info('[moshi] live events: channel error, rejoining', err)
    })
  } catch (err) {
    console.warn('[moshi] live events failed', err)
  }

  // best effort too: without it, an intro (or the other person's answer) shows after a reload
  const social = db().channel(`db-social:${topic}`)
  listen(social, REALTIME_SOCIAL)
  s.channels.push(social)
  s.social = social
  try {
    social.subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR' && alive(s)) console.info('[moshi] live intros: channel error, rejoining', err)
    })
  } catch (err) {
    console.warn('[moshi] live intros failed', err)
  }

  return new Promise((resolve) => {
    let waiting = true
    const done = () => {
      if (!waiting) return
      waiting = false
      window.clearTimeout(timer)
      resolve()
    }
    const timer = window.setTimeout(() => {
      s.dropped = true
      done()
    }, SUBSCRIBE_WAIT_MS)
    s.stops.push(done)
    try {
      channel.subscribe((status) => {
        if (!alive(s)) return done()
        if (status === 'SUBSCRIBED') {
          // back after a drop (or later than the first load went ahead): we may have missed changes
          if (s.dropped && !waiting) void refresh(s).catch((err) => console.warn('[moshi] refresh failed', err))
          s.dropped = false
          done()
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          s.dropped = true
          done()
        }
      })
    } catch (err) {
      console.warn('[moshi] realtime failed', err)
      s.dropped = true
      done()
    }
  })
}

function startTimers(s: LiveSession) {
  const me = s.cache.me
  /** fresh online dots (nobody streams other people's last_seen_at to us) */
  const seen = () => {
    const cache = s.cache
    loadRecentlySeen(cache)
      .then((changed) => {
        if (changed && alive(s) && s.cache === cache) apply({ ...peoplePatch(cache), ...roomsPatch(cache) }, {})
      })
      .catch((err) => console.warn('[moshi] online refresh failed', err))
  }
  const beat = () => {
    if (document.visibilityState !== 'visible') return
    touchLastSeen(me).catch(() => {})
    seen()
    refreshRoomWatchAll(s)
  }
  beat()
  let ticks = 0
  const hb = window.setInterval(beat, HEARTBEAT_MS)
  // relative labels ("5 นาทีที่แล้ว"), the 5-minute online window, expiring posts
  const tick = window.setInterval(() => {
    const c = s.cache
    const slow = ++ticks % 5 === 0
    apply(
      { ...peoplePatch(c), ...roomsPatch(c), ...(slow ? { ...intentsPatch(c), ...sessionsPatch(c) } : {}) },
      slow ? myIntentsPatch(c) : {},
    )
  }, TICK_MS)

  const onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      s.hiddenAt = Date.now()
      return
    }
    beat()
    if (s.hiddenAt && Date.now() - s.hiddenAt > STALE_MS) void refresh(s).catch((err) => console.warn('[moshi] refresh failed', err))
    s.hiddenAt = 0
  }
  const onOnline = () => void refresh(s).catch((err) => console.warn('[moshi] refresh failed', err))
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('online', onOnline)

  // my own joins/leaves change room counts right away (and the new room's chat should stay in sync)
  const unsub = useMoshi.subscribe((st, prev) => {
    if (st.me.rooms === prev.me.rooms || !alive(s)) return
    apply(roomsPatch(s.cache), {})
    st.me.rooms.filter((r) => !prev.me.rooms.includes(r)).forEach((r) => void ensureRoomHistory(r))
  })

  s.stops.push(() => {
    window.clearInterval(hb)
    window.clearInterval(tick)
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('online', onOnline)
    unsub()
  })
}
