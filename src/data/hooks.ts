import { useEffect, useMemo, useState } from 'react'
import { eventChatVisible } from '@/lib/events'
import { useNow } from '@/lib/hooks'
import { known, useLang } from '@/lib/i18n'
import { questionInLang, roomInLang, sessionInLang } from '@/lib/i18n/catalog'
import { matchAll, matchUser, MIN_LEVEL, onWavelength, type MatchExtras } from '@/lib/matching'
import { sharedLifeStages } from '@/lib/lifeStages'
import { settleDemoIntros, useMoshi } from '@/lib/store'
import type {
  Chat,
  ChatMessage,
  ComparePreview,
  DailyQuestion,
  Intent,
  IntroRequest,
  MatchResult,
  PairState,
  Room,
  RoomWatch,
  ServerFeatures,
  SharedTag,
  SignalLevel,
  Session,
  User,
  WaveAnswers,
} from '@/lib/types'
import { agreement, answeredCount, type WaveAgreement } from '@/lib/waveQuiz'
import { useCatalog } from './catalog'
import { clearCompareInvite } from './compare'
import { resolveId } from './live/bus'
import { onServerClock, serverOffset, syncServerClock } from './live/clock'
import { toComparePreview, type LiveChat } from './live/map'
import { isSample, isServerId } from './live/sample'
import { ensurePerson, ensureRoomHistory, ensureSession, retrySession, watchEvent, watchRoom } from './live/sync'
import { isStaff, watchHeartbeat, watchLeave, watchViewers, waveCardPreview } from './live/writes'
import { DEMO_CHATS } from './mock'
import { pairQuestion } from './pairQuestions'
import { sameTag } from './tags'
import { WATCH_LIMITS, watchReleaseAt } from './watch'

/*
 * The ONLY way pages read app data. Same shapes in demo and live mode, so a
 * page never needs to know where data comes from. Writes go through the
 * actions on useMoshi (which call Supabase in live mode).
 */

export const useDataMode = () => useCatalog((s) => s.mode)
export const useDataReady = () => useCatalog((s) => s.ready)
/** live mode: why the first sync failed (null when fine) */
export const useDataError = () => useCatalog((s) => s.error)

/** My user id: 'me' in demo mode, my auth id in live mode. */
export const useMyId = () => useMoshi((s) => s.me.id)

/** Mock people merged in live mode by VITE_DEMO_PEOPLE (their chats stay on this device). */
export { isSample }

/** Rooms with their name / tagline / vibe in the current language. */
export function useRooms(): Room[] {
  const rooms = useCatalog((s) => s.rooms)
  const lang = useLang()
  return useMemo(() => (lang === 'en' ? rooms.map(roomInLang) : rooms), [rooms, lang])
}

export function useRoom(id: string | undefined): Room | undefined {
  const rooms = useRooms()
  return useMemo(() => rooms.find((r) => r.id === id), [rooms, id])
}

export const useRoomStats = (id: string) => useCatalog((s) => s.roomStats[id])

const useBlocked = () => useMoshi((s) => s.blocked)

/** Everyone except me (and anyone I blocked). */
export function usePeople(): User[] {
  const people = useCatalog((s) => s.people)
  const blocked = useBlocked()
  return useMemo(() => (blocked.length ? people.filter((u) => !blocked.includes(u.id)) : people), [people, blocked])
}

/** Direct lookup (still finds someone I just blocked, so an open sheet doesn't vanish). */
export function usePerson(id: string | undefined): User | undefined {
  const people = useCatalog((s) => s.people)
  return useMemo(() => people.find((u) => u.id === id), [people, id])
}

/** Other people's intents plus mine, newest first; optional filters. */
export function useIntents(filter?: { roomId?: string; userId?: string }): Intent[] {
  const others = useCatalog((s) => s.intents)
  const mine = useMoshi((s) => s.myIntents)
  const blocked = useBlocked()
  const roomId = filter?.roomId
  const userId = filter?.userId
  return useMemo(() => {
    let all = [...mine, ...others]
    if (blocked.length) all = all.filter((i) => !blocked.includes(i.userId))
    if (roomId) all = all.filter((i) => i.roomId === roomId)
    if (userId) all = all.filter((i) => i.userId === userId)
    return all.sort((a, b) => a.postedMinutesAgo - b.postedMinutesAgo)
  }, [mine, others, blocked, roomId, userId])
}

/** One of my own posts; a temporary id from a post still being saved follows the real one. */
export function useMyIntent(id: string | undefined): Intent | undefined {
  const mine = useMoshi((s) => s.myIntents)
  return useMemo(() => (id ? mine.find((i) => i.id === id || i.id === resolveId(id)) : undefined), [mine, id])
}

/**
 * Server pieces from newer migrations: events (event chats, create / cancel), the shared "จูนคลื่น",
 * life stages, Mochi's intros and watching together. Demo: all on. Hide a feature's UI while it's off.
 */
export const useServerFeatures = (): ServerFeatures => useCatalog((s) => s.features)

const DAY_MS = 86_400_000
/** what useSessions() has always shown: starting within this long */
const SESSIONS_AHEAD_MS = 8 * DAY_MS

/** A session's title (and description, when it's one we know) in the current language. */
function eventInLang(s: Session): Session {
  const out = sessionInLang(s)
  return out.description ? { ...out, description: known(out.description) } : out
}

/**
 * Upcoming and live sessions (not cancelled, starting within 8 days): the list every screen had
 * before events. Event screens use useEvents() / useSession() instead. One drops off by itself the
 * moment it ends (a re-render right then), not only when the list changes.
 */
export function useSessions(): Session[] {
  const sessions = useCatalog((s) => s.sessions)
  const lang = useLang()
  const [endAt, setEndAt] = useState<number | undefined>(undefined)
  const now = useNow(null, endAt)
  const list = useMemo(() => {
    const kept = sessions.filter((s) => !s.cancelled && Date.parse(s.endsAt) > now && Date.parse(s.startsAt) <= now + SESSIONS_AHEAD_MS)
    return lang === 'en' ? kept.map(eventInLang) : kept
  }, [sessions, lang, now])
  // the soonest end among them: the clock above ticks right then (the "adjust state while rendering" pattern)
  let next: number | undefined
  for (const s of list) {
    const end = Date.parse(s.endsAt)
    if (next === undefined || end < next) next = end
  }
  if (next !== endAt) setEndAt(next)
  return list
}

/**
 * Every event we know, soonest first: upcoming (up to 60 days ahead), open, finished in the last
 * day or so (their chat is still readable for 24 hours) and cancelled ones. Optionally one room's.
 * Sort or split them with eventPhase (lib/events).
 */
export function useEvents(filter?: { roomId?: string }): Session[] {
  const sessions = useCatalog((s) => s.sessions)
  const lang = useLang()
  const roomId = filter?.roomId
  return useMemo(() => {
    const list = (roomId ? sessions.filter((s) => s.roomId === roomId) : [...sessions]).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
    return lang === 'en' ? list.map(eventInLang) : list
  }, [sessions, lang, roomId])
}

/**
 * One event by id, whatever its phase. Live mode fetches one we don't hold yet (a link to an
 * event further out); useSessionStatus tells loading from not found.
 */
export function useSession(id: string | undefined): Session | undefined {
  const real = id ? resolveId(id) : undefined
  const session = useCatalog((s) => (real ? s.sessions.find((x) => x.id === real) : undefined))
  const mode = useDataMode()
  const ready = useDataReady()
  const lang = useLang()
  useEffect(() => {
    if (mode === 'live' && ready && real && !session) void ensureSession(real)
  }, [mode, ready, real, session])
  return useMemo(() => (session && lang === 'en' ? eventInLang(session) : session), [session, lang])
}

/**
 * 'loading' while an event is on its way, 'missing' when there's no such event (or it went with its
 * room), 'failed' when fetching it didn't get through (offline): offer retrySessionLoad then.
 */
export function useSessionStatus(id: string | undefined): 'loading' | 'ready' | 'missing' | 'failed' {
  const real = id ? resolveId(id) : undefined
  const found = useCatalog((s) => !!real && s.sessions.some((x) => x.id === real))
  const missing = useCatalog((s) => !!real && s.missingSessions.includes(real))
  const failed = useCatalog((s) => !!real && s.failedSessions.includes(real))
  const mode = useDataMode()
  const ready = useDataReady()
  if (found) return 'ready'
  if (mode === 'live' && !ready) return 'loading'
  if (!real || missing || mode === 'demo' || !isServerId(real)) return 'missing'
  return failed ? 'failed' : 'loading'
}

/** Fetch an event again after useSessionStatus said 'failed' (no-op in demo mode). */
export const retrySessionLoad = (id: string) => void retrySession(resolveId(id))

const NO_LINES: ChatMessage[] = []

/**
 * An event's chat: history (server lines live, seeded lines in demo) plus my lines on their way,
 * in time order, leaving out people I blocked. Empty once the chat is hidden (24 hours after the
 * event ends). Live mode loads it and streams new lines while a screen uses this hook; until the
 * database has events (useServerFeatures().events) it stays empty, so show "เร็วๆ นี้" then.
 */
export function useEventMessages(sessionId: string | undefined): ChatMessage[] {
  const real = sessionId ? resolveId(sessionId) : undefined
  const history = useCatalog((s) => (real ? s.eventMessages[real] : undefined))
  const local = useMoshi((s) => (real ? s.eventMessages[real] : undefined))
  const session = useCatalog((s) => (real ? s.sessions.find((x) => x.id === real) : undefined))
  const blocked = useBlocked()
  const mode = useDataMode()
  const ready = useDataReady()
  const on = useCatalog((s) => s.features.events)
  useEffect(() => {
    if (mode === 'live' && ready && on && real) return watchEvent(real)
  }, [mode, ready, on, real])
  const lines = useMemo(() => {
    const all = [...(history ?? []), ...(local ?? [])]
    return blocked.length ? all.filter((m) => !blocked.includes(m.userId)) : all
  }, [history, local, blocked])
  return session && !eventChatVisible(session) ? NO_LINES : lines
}

/** Has this event chat's history arrived? (demo, or without the server piece: always) */
export const useEventHistoryReady = (sessionId: string | undefined) =>
  useCatalog((s) => s.mode === 'demo' || !s.features.events || (!!sessionId && resolveId(sessionId) in s.eventMessages))

/** Who's going to an event: me first when I am, then the others I can see. Its `going` counts everyone else. */
export function useEventAttendees(sessionId: string | undefined): User[] {
  const session = useSession(sessionId)
  const people = usePeople()
  const me = useMoshi((s) => s.me)
  const imGoing = useMoshi((s) => !!sessionId && s.going.includes(resolveId(sessionId)))
  return useMemo(() => {
    const byId = new Map(people.map((u) => [u.id, u]))
    const others = (session?.goingIds ?? []).flatMap((id) => byId.get(id) ?? [])
    return imGoing ? [me, ...others] : others
  }, [session, people, me, imGoing])
}

/** staff check per signed-in user (asked once per session) */
const staffChecks = new Map<string, Promise<boolean>>()

/** Am I on the team (public.is_admin())? Live only; false in demo mode and until the answer arrives. */
export function useIsStaff(): boolean {
  const myId = useMyId()
  const mode = useDataMode()
  const [staff, setStaff] = useState<{ id: string; yes: boolean } | null>(null)
  useEffect(() => {
    if (mode !== 'live' || !myId) return
    let alive = true
    let check = staffChecks.get(myId)
    if (!check) {
      check = isStaff().catch(() => false)
      staffChecks.set(myId, check)
    }
    void check.then((yes) => alive && setStaff({ id: myId, yes }))
    return () => {
      alive = false
    }
  }, [mode, myId])
  return mode === 'live' && staff?.id === myId && staff.yes
}

/**
 * May I set up or cancel events in this room (a host of the room, or staff)? Without a room: in
 * any room. Demo: yes (so the whole flow can be tried). The server checks again either way.
 */
export function useCanManageEvents(roomId?: string): boolean {
  const mode = useDataMode()
  const myId = useMyId()
  const rooms = useCatalog((s) => s.rooms)
  const staff = useIsStaff()
  return useMemo(() => {
    if (mode === 'demo') return true
    if (staff) return true
    if (!myId) return false
    return rooms.some((r) => (!roomId || r.id === roomId) && r.hostIds.includes(myId))
  }, [mode, staff, myId, rooms, roomId])
}

/** Today's question for a room, falling back to the lobby question. */
export function useDailyQuestion(roomId: string): DailyQuestion | undefined {
  const questions = useCatalog((s) => s.questions)
  const lang = useLang()
  return useMemo(() => {
    const q = questions.find((q) => q.roomId === roomId) ?? questions.find((q) => q.roomId === 'lobby')
    return q && lang === 'en' ? questionInLang(q) : q
  }, [questions, roomId, lang])
}

/**
 * Room chat: server/seeded history plus my local additions, in time order
 * (lines from people I blocked are left out).
 * In live mode, opening a room loads its last 50 messages on first use.
 */
export function useRoomMessages(roomId: string): ChatMessage[] {
  const history = useCatalog((s) => s.roomMessages[roomId])
  const local = useMoshi((s) => s.roomMessages[roomId])
  const blocked = useBlocked()
  const mode = useDataMode()
  const ready = useDataReady()
  useEffect(() => {
    if (mode === 'live' && ready) void ensureRoomHistory(roomId)
  }, [mode, ready, roomId])
  return useMemo(() => {
    const all = [...(history ?? []), ...(local ?? [])]
    return blocked.length ? all.filter((m) => !blocked.includes(m.userId)) : all
  }, [history, local, blocked])
}

/** live mode: has this room's history arrived yet? (demo: always) */
export const useRoomHistoryReady = (roomId: string) => useCatalog((s) => s.mode === 'demo' || roomId in s.roomMessages)

export function useChats(): Chat[] {
  const chats = useMoshi((s) => s.chats)
  const blocked = useBlocked()
  return useMemo(() => (blocked.length ? chats.filter((c) => !blocked.includes(c.withUserId)) : chats), [chats, blocked])
}

/** demo mode's ready-made lines: they were "said" before this visitor ever arrived */
const SEEDED_LINES = new Set(DEMO_CHATS.flatMap((c) => c.messages.map((m) => m.id)))

/**
 * Have I said hi to someone myself? A hello I sent, or a line I wrote in any chat. Someone
 * saying hi to me doesn't count until I answer, and demo mode's seeded chats never do.
 */
export function useSaidHi(): boolean {
  const chats = useChats()
  const myId = useMyId()
  const sentHello = useMoshi((s) => s.sentMoshi.length > 0)
  return useMemo(() => {
    if (sentHello) return true
    const mine = (id: string | undefined) => id === myId || id === 'me'
    return chats.some(
      (c) => mine(c.requestedBy) || c.messages.some((m) => mine(m.userId) && m.kind !== 'system' && !SEEDED_LINES.has(m.id)),
    )
  }, [chats, myId, sentHello])
}

/** A chat by id; a temporary id from a moshi still being sent resolves to the real chat. */
export function useChat(id: string | undefined): Chat | undefined {
  const chats = useChats()
  return useMemo(() => {
    if (!id) return undefined
    const real = resolveId(id)
    return chats.find((c) => c.id === real) ?? chats.find((c) => c.id === id)
  }, [chats, id])
}

/** live mode: 'pending' | 'active' | 'ended' + who rang; demo chats have no status. */
export function useChatStatus(id: string | undefined): Pick<LiveChat, 'status' | 'requestedBy'> | undefined {
  const chat = useChat(id)
  const status = chat?.status
  const requestedBy = chat?.requestedBy
  return useMemo(() => (status && requestedBy ? { status, requestedBy } : undefined), [status, requestedBy])
}

/** My "จูนคลื่น" picks (question id → 0 / 1; questions in data/wave). */
export const useMyWaveAnswers = (): WaveAnswers => useMoshi((s) => s.wave)

/** Someone's "จูนคลื่น" picks (mine for my id); undefined when they haven't played or I blocked them. */
export function usePersonWaveAnswers(userId: string | undefined): WaveAnswers | undefined {
  const all = useWaveAnswers()
  return userId ? all[userId] : undefined
}

/**
 * "จูนคลื่น" picks by user id (mine under my id, everyone else's I can see): the quiz part of the
 * wave. The wave leaves that part out for anyone who hasn't played. Live mode: other people's come
 * from the server once wave_answers exists; before that only mine (kept on this device).
 */
export function useWaveAnswers(): Record<string, WaveAnswers> {
  const others = useCatalog((s) => s.waveAnswers)
  const mine = useMoshi((s) => s.wave)
  const myId = useMyId()
  const blocked = useBlocked()
  return useMemo(() => {
    const out: Record<string, WaveAnswers> = { ...others }
    blocked.forEach((id) => delete out[id])
    if (myId && Object.keys(mine).length) out[myId] = mine
    return out
  }, [others, mine, myId, blocked])
}

/** What the matcher needs beyond profiles and posts: quiz picks and the events I'm going to. */
export function useMatchExtras(): MatchExtras {
  const quiz = useWaveAnswers()
  const going = useMoshi((s) => s.going)
  return useMemo(() => ({ quiz, going }), [quiz, going])
}

/** Everyone ranked by "สัญญาณถูกคอ" against me (my posts only add a small bonus). */
export function useMatches(): MatchResult[] {
  const me = useMoshi((s) => s.me)
  const myIntents = useMoshi((s) => s.myIntents)
  const people = usePeople()
  const intents = useCatalog((s) => s.intents)
  const extras = useMatchExtras()
  return useMemo(() => matchAll(me, myIntents, people, intents, extras), [me, myIntents, people, intents, extras])
}

/**
 * The people to suggest: only "ถูกคอ" (MIN_LEVEL) and up, best first. Screens that
 * recommend people use this; useMatches() stays for looking up anyone's signal.
 */
export function useWavelengthMatches(min?: SignalLevel): MatchResult[] {
  const matches = useMatches()
  return useMemo(() => onWavelength(matches, min), [matches, min])
}

/** 'YYYY-MM-DD' in Bangkok, so the daily pick turns over at local midnight. */
const bangkokDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date())

function hashText(text: string): number {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0
  return Math.abs(h)
}

const PICK_KEY = 'moshi-daily-pick'

interface KeptPick {
  day: string
  me: string
  id: string
}

/** Today's pick as this browser remembers it (null in a private window or with storage blocked). */
function keptPick(): KeptPick | null {
  try {
    const raw = localStorage.getItem(PICK_KEY)
    return raw ? (JSON.parse(raw) as KeptPick) : null
  } catch {
    return null
  }
}

/**
 * "คลื่นของวันนี้": one person a day, drawn from the top five on my wavelength that I'm not
 * already chatting with. Same pick all day (on every screen), a new one tomorrow. Saying hi
 * to them doesn't swap them out: the pick is remembered for the day while they stay on my wavelength.
 */
export function useDailyPick(): MatchResult | undefined {
  const matches = useWavelengthMatches()
  const chats = useChats()
  const myId = useMyId()
  const day = bangkokDay()
  const pick = useMemo(() => {
    const kept = keptPick()
    const same = kept && kept.day === day && kept.me === myId ? matches.find((m) => m.userId === kept.id) : undefined
    if (same) return same
    const talking = new Set(chats.map((c) => c.withUserId))
    const pool = matches.filter((m) => !talking.has(m.userId)).slice(0, 5)
    return pool.length ? pool[hashText(`${day}:${myId}`) % pool.length] : undefined
  }, [matches, chats, myId, day])
  const pickId = pick?.userId
  useEffect(() => {
    if (!pickId) return
    try {
      localStorage.setItem(PICK_KEY, JSON.stringify({ day, me: myId, id: pickId } satisfies KeptPick))
    } catch {
      // storage blocked: the pick is still the same all day, it may just change after saying hi
    }
  }, [pickId, day, myId])
  return pick
}

export function useMatch(userId: string | undefined): MatchResult | undefined {
  const me = useMoshi((s) => s.me)
  const myIntents = useMoshi((s) => s.myIntents)
  const people = useCatalog((s) => s.people)
  const intents = useCatalog((s) => s.intents)
  const extras = useMatchExtras()
  return useMemo(() => {
    const them = people.find((u) => u.id === userId)
    return them ? matchUser(me, them, myIntents, people, intents, extras) : undefined
  }, [me, myIntents, people, intents, extras, userId])
}

/** One post on the "ชวนเล่น" board, with who posted it and their signal with me. */
export interface Invite {
  intent: Intent
  poster: User
  match: MatchResult
}

/**
 * The "ชวนเล่น" board: other people's posts (never mine, never from anyone I blocked) from people
 * on my wavelength (MIN_LEVEL and up: the board suggests the people who posted, so it follows the
 * same cutoff as every other suggestion). Strongest signal first, posts about things I like next, then newest.
 */
export function useInviteBoard(): Invite[] {
  const intents = useIntents()
  const people = usePeople()
  const matches = useMatches()
  const myId = useMyId()
  const myTags = useMoshi((s) => s.me.tags)
  return useMemo(() => {
    const byId = new Map(people.map((u) => [u.id, u]))
    const signal = new Map(matches.map((m) => [m.userId, m]))
    return intents
      .flatMap((intent) => {
        const poster = byId.get(intent.userId)
        const match = signal.get(intent.userId)
        if (!poster || !match || intent.userId === myId || intent.userId === 'me') return []
        if (match.level < MIN_LEVEL) return []
        return [{ intent, poster, match, likeIt: myTags.some((t) => sameTag(t, intent.tagId)) }]
      })
      .sort(
        (a, b) =>
          b.match.level - a.match.level || Number(b.likeIt) - Number(a.likeIt) || a.intent.postedMinutesAgo - b.intent.postedMinutesAgo,
      )
      .map(({ intent, poster, match }) => ({ intent, poster, match }))
  }, [intents, people, matches, myId, myTags])
}

// ------------------------------------------------------------------ the server's clock

export interface ServerClock {
  /** server time − this phone's time (ms); 0 in demo mode or before the first measurement */
  offsetMs: number
  /** now on the server's clock (ms since epoch): use it for every watch-together position */
  now: () => number
}

/** The database's clock (measured once and every 10 minutes while used; demo: the phone's own). */
export function useServerClock(): ServerClock {
  const [offset, setOffset] = useState(serverOffset)
  // only watching together needs it: no server_now calls before that server piece is there
  const enabled = useCatalog((s) => s.features.watch)
  useEffect(() => {
    const off = onServerClock(() => setOffset(serverOffset()))
    if (enabled) void syncServerClock().then(() => setOffset(serverOffset()))
    return off
  }, [enabled])
  return useMemo(() => ({ offsetMs: offset, now: () => Date.now() + offset }), [offset])
}

// ------------------------------------------------------------------ watching together

export interface RoomWatchView {
  /** what's on (null: nothing) */
  watch: RoomWatch | null
  /** the server piece is there (live; demo: always): show the watch panel only then */
  enabled: boolean
  /** I may put a clip on now: in the room, and nothing is on or I may control what's on */
  canStart: boolean
  /** I may play / pause / seek / change speed / stop what's on */
  canControl: boolean
  /**
   * The clip on no longer holds the room (played to its end, paused 10 minutes, no known end after
   * 12 hours, or whoever put it on left the room): every member may switch, stop or replay it.
   */
  released: boolean
  /** I may switch "ให้ทุกคนคุมได้" (a host of the room, or staff) */
  canOpen: boolean
  /** a host switched on "ให้ทุกคนคุมได้" */
  anyoneCanControl: boolean
}

/**
 * A room's clip, live: while a screen uses this hook its row streams in (play, pause, seek…). Work
 * the position out with watchPositionAt(watch, useServerClock().now()) from data/watch. Control
 * rights mirror the server (whoever put it on, the room's hosts and staff; every member when opened
 * up or once the clip no longer holds the room); the server checks again either way, and also frees
 * a room nobody has watched for 2 minutes (not mirrored here). Demo: I may do everything.
 */
export function useRoomWatch(roomId: string | undefined): RoomWatchView {
  const watch = useCatalog((s) => (roomId ? s.roomWatch[roomId] : undefined)) ?? null
  const opened = useCatalog((s) => !!roomId && !!s.roomWatchOpen[roomId])
  const enabled = useCatalog((s) => s.features.watch)
  const room = useRoom(roomId)
  const myId = useMyId()
  const member = useMoshi((s) => !!roomId && s.me.rooms.includes(roomId))
  const starter = usePerson(watch?.startedBy)
  const staff = useIsStaff()
  const mode = useDataMode()
  const ready = useDataReady()
  const { offsetMs } = useServerClock()
  useEffect(() => {
    if (mode === 'live' && ready && enabled && roomId) return watchRoom(roomId)
  }, [mode, ready, enabled, roomId])
  // the moment the clip stops holding the room by time (its end, 10 minutes paused…): look again then
  const releaseAt = watch ? watchReleaseAt(watch) : Number.POSITIVE_INFINITY
  const now = useNow(null, releaseAt - offsetMs)
  const released =
    !!watch &&
    (now + offsetMs >= releaseAt ||
      !watch.startedBy ||
      // whoever put it on left the room (only when they're known here: blocked or not loaded, it holds)
      (watch.startedBy === myId ? !member : !!starter && !!roomId && !starter.rooms.includes(roomId)))
  return useMemo(() => {
    const anyone = watch ? watch.anyoneCanControl : opened
    const host = !!myId && !!room?.hostIds.includes(myId)
    const demo = mode === 'demo'
    // demo lets any member drive (there's no one else to ask), but like live mode you join the room first
    const canControl = !!watch && (staff || (member && (demo || host || anyone || released || watch.startedBy === myId)))
    return {
      watch,
      enabled,
      canStart: (demo ? member : member || staff) && (!watch || canControl),
      canControl,
      released,
      canOpen: demo ? member : staff || (member && host),
      anyoneCanControl: anyone,
    }
  }, [watch, opened, enabled, room, myId, member, staff, mode, released])
}

/**
 * Rooms where a clip is on right now, by room id (room cards: "กำลังดูด้วยกัน"). Leaves out clips
 * that no longer hold their room by time: played to their end (also when a player reported the
 * length), paused for 10 minutes, or with no known end and on for 12 hours.
 */
export function useWatchingRooms(): Record<string, RoomWatch> {
  const all = useCatalog((s) => s.roomWatch)
  const { offsetMs } = useServerClock()
  // re-read every minute (a clip reaching its end drops off)
  const tick = useNow(60_000)
  return useMemo(() => {
    const t = tick + offsetMs
    const out: Record<string, RoomWatch> = {}
    for (const [id, w] of Object.entries(all)) {
      if (t >= watchReleaseAt(w)) continue
      out[id] = w
    }
    return out
  }, [all, offsetMs, tick])
}

/**
 * Who's watching a room's clip (me first when I'm counted, then the people I can see; never anyone
 * in a block relation with me). While `active` (the player is on screen) this also tells the server
 * I'm watching, every 30 seconds while the tab is visible, and stops when it isn't. Members only, and
 * only while something is on. Demo: a few of the room's members who are online.
 */
export function useWatchViewers(roomId: string | undefined, active: boolean): User[] {
  const mode = useDataMode()
  const ready = useDataReady()
  const enabled = useCatalog((s) => s.features.watch)
  const on = useCatalog((s) => !!roomId && !!s.roomWatch[roomId])
  const people = usePeople()
  const me = useMoshi((s) => s.me)
  const member = useMoshi((s) => !!roomId && s.me.rooms.includes(roomId))
  const [ids, setIds] = useState<{ room: string; list: string[] } | null>(null)
  useEffect(() => {
    if (mode !== 'live' || !ready || !enabled || !roomId || !on) return
    let alive = true
    let counted = false
    const beat = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        if (active && member) counted = (await watchHeartbeat(roomId)) || counted
        const list = await watchViewers(roomId)
        if (alive) setIds({ room: roomId, list })
      } catch (err) {
        console.warn('[moshi] watch heartbeat failed', err)
      }
    }
    void beat()
    const timer = window.setInterval(() => void beat(), WATCH_LIMITS.heartbeatMs)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void beat()
      else if (counted) watchLeave(roomId).catch(() => {})
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      if (counted) watchLeave(roomId).catch(() => {})
    }
  }, [mode, ready, enabled, roomId, on, active, member])
  return useMemo(() => {
    if (!roomId || !on) return []
    if (mode === 'demo') {
      const others = people.filter((u) => u.rooms.includes(roomId) && u.isOnline).slice(0, 6)
      return active && member ? [me, ...others] : others
    }
    const list = ids?.room === roomId ? ids.list : []
    const byId = new Map(people.map((u) => [u.id, u]))
    const others = list.filter((id) => id !== me.id).flatMap((id) => byId.get(id) ?? [])
    return list.includes(me.id) ? [me, ...others] : others
  }, [roomId, on, mode, people, active, member, me, ids])
}

// ------------------------------------------------------------------ Mochi's warm intros

export interface IntroLists {
  /** someone asked Mochi about me and it's still waiting for my answer (newest first) */
  incoming: IntroRequest[]
  /** the ones I asked for: waiting, accepted (chatId) or expired (show a kind note, never "rejected") */
  outgoing: IntroRequest[]
}

/** Intro requests, with expiry applied as of now (people I blocked left out). */
export function useIntroRequests(): IntroLists {
  const intros = useMoshi((s) => s.intros)
  const blocked = useBlocked()
  const people = useCatalog((s) => s.people)
  const mode = useDataMode()
  const now = useNow(60_000)
  // demo: intros I asked for before a reload still get their simulated answer
  useEffect(() => {
    if (mode === 'demo') settleDemoIntros()
  }, [mode, intros])
  return useMemo(() => {
    const visible = new Set(people.map((u) => u.id))
    const list = intros
      .map((i) => (i.status === 'pending' && Date.parse(i.expiresAt) <= now ? { ...i, status: 'expired' as const } : i))
      .filter((i) => !blocked.includes(i.withUserId))
    return {
      incoming: list.filter((i) => i.direction === 'incoming' && i.status === 'pending' && visible.has(i.withUserId)),
      outgoing: list.filter((i) => i.direction === 'outgoing'),
    }
  }, [intros, blocked, people, now])
}

/**
 * What "ให้โมชิแนะนำให้" can do for one person:
 * off (server piece missing) · self · below (not on my wavelength: don't offer it) · chatting (we
 * have a chat: open it) · incoming (they asked Mochi about me: answer with respondIntro; asking back
 * also says yes) · waiting (mine is out) · accepted (done; `chatId`) · limit (3 today already)
 * · ready (tap = requestIntro). `expired`: my last one to them ran out (a kind note if asking again).
 */
export type IntroState = 'off' | 'self' | 'below' | 'chatting' | 'incoming' | 'waiting' | 'accepted' | 'limit' | 'ready'

export interface IntroView {
  state: IntroState
  /** the request behind the state (incoming / waiting / accepted) */
  intro?: IntroRequest
  expired?: IntroRequest
  /** the chat to open for 'chatting' / 'accepted' */
  chatId?: string
}

export function useIntroWith(userId: string | undefined): IntroView {
  const { incoming, outgoing } = useIntroRequests()
  const all = useMoshi((s) => s.intros)
  const enabled = useCatalog((s) => s.features.intros)
  const myId = useMyId()
  const chats = useChats()
  const match = useMatch(userId)
  const now = useNow(60_000)
  return useMemo((): IntroView => {
    if (!userId || userId === myId || userId === 'me') return { state: 'self' }
    if (!enabled) return { state: 'off' }
    const mine = outgoing.filter((i) => i.withUserId === userId)
    const expired = mine.find((i) => i.status === 'expired')
    const accepted = all.find((i) => i.withUserId === userId && i.status === 'accepted')
    const chat = chats.find((c) => c.withUserId === userId)
    if (chat) return { state: accepted ? 'accepted' : 'chatting', ...(accepted ? { intro: accepted } : {}), chatId: chat.id }
    const theirs = incoming.find((i) => i.withUserId === userId)
    if (theirs) return { state: 'incoming', intro: theirs }
    const waiting = mine.find((i) => i.status === 'pending')
    if (waiting) return { state: 'waiting', intro: waiting }
    if (accepted) return { state: 'accepted', intro: accepted, ...(accepted.chatId ? { chatId: accepted.chatId } : {}) }
    if (!match || match.level < MIN_LEVEL) return { state: 'below', ...(expired ? { expired } : {}) }
    const today = outgoing.filter((i) => now - Date.parse(i.createdAt) < 86_400_000).length
    if (today >= 3) return { state: 'limit', ...(expired ? { expired } : {}) }
    return { state: 'ready', ...(expired ? { expired } : {}) }
  }, [userId, myId, enabled, outgoing, incoming, all, chats, match, now])
}

/**
 * An intro chat's question pair, from my side: the question (bank in data/pairQuestions), my
 * answer, theirs once both answered, and the step. Answer with useMoshi().answerPair(chatId,
 * question.id, text). Chats without a question pair: step 'none'.
 */
export function usePairQuestion(chatId: string | undefined): PairState {
  const chat = useChat(chatId)
  const answers = useMoshi((s) => (chat ? s.pairAnswers[chat.id] : undefined))
  const myId = useMyId()
  return useMemo((): PairState => {
    const question = pairQuestion(chat?.pairQuestion)
    if (!chat || !question) return { step: 'none' }
    const forQ = (answers ?? []).filter((a) => a.questionId === question.id)
    const mine = forQ.find((a) => a.userId === myId)
    // the server holds theirs back until I answered; demo holds it back here the same way
    const theirs = mine ? forQ.find((a) => a.userId === chat.withUserId) : undefined
    return {
      question,
      ...(mine ? { mine } : {}),
      ...(theirs ? { theirs } : {}),
      step: !mine ? 'ask' : theirs ? 'revealed' : 'waiting',
    }
  }, [chat, answers, myId])
}

// ------------------------------------------------------------------ wave cards + comparing waves

export interface ComparePreviewView {
  /** failed: couldn't ask (offline): offer retry() */
  status: 'loading' | 'ready' | 'missing' | 'failed'
  /** name + mochi only (what anyone with the link may see) */
  preview?: ComparePreview
  retry: () => void
}

const previews = new Map<string, Promise<ComparePreview | null>>()

/**
 * The teaser a wave card's link shows before sign-in: the card owner's name and mochi, nothing else.
 * Works signed out (live: wave_card_preview). missing: no such person (or they can't be shown).
 */
export function useComparePreview(userId: string | undefined): ComparePreviewView {
  const mode = useDataMode()
  const person = usePerson(userId)
  const me = useMoshi((s) => s.me)
  const [state, setState] = useState<{ id: string; status: ComparePreviewView['status']; preview?: ComparePreview } | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (mode !== 'live' || !userId || !isServerId(userId)) return
    let alive = true
    let p = previews.get(userId)
    if (!p) {
      const ask = waveCardPreview(userId).then((row) => (row ? toComparePreview(userId, row) : null))
      previews.set(userId, ask)
      // a failure isn't kept: the next try asks again
      ask.catch(() => previews.delete(userId))
      p = ask
    }
    p.then(
      (preview) => alive && setState({ id: userId, status: preview ? 'ready' : 'missing', ...(preview ? { preview } : {}) }),
      (err) => {
        console.warn('[moshi] wave card preview failed', err)
        if (alive) setState({ id: userId, status: 'failed' })
      },
    )
    return () => {
      alive = false
    }
  }, [mode, userId, attempt])
  const retry = useMemo(() => () => setAttempt((n) => n + 1), [])
  return useMemo((): ComparePreviewView => {
    if (!userId) return { status: 'missing', retry }
    if (mode === 'demo') {
      const who = userId === me.id ? me : person
      return who
        ? {
            status: 'ready',
            preview: { userId, name: who.name, color: who.color, ...(who.face ? { face: who.face } : {}), ...(who.accessory ? { accessory: who.accessory } : {}) },
            retry,
          }
        : { status: 'missing', retry }
    }
    if (!isServerId(userId)) return { status: 'missing', retry }
    if (!state || state.id !== userId) return { status: 'loading', retry }
    return { status: state.status, ...(state.preview ? { preview: state.preview } : {}), retry }
  }, [userId, mode, me, person, state, retry])
}

export interface CompareView {
  /** self: my own card (show it, nothing to compare) · missing: no such person, or a block either way */
  status: 'loading' | 'ready' | 'missing' | 'self'
  person?: User
  /** the wave (show `level` with SignalMeter: never as a percentage) */
  match?: MatchResult
  /** "จูนคลื่นตรงกัน same/common"; mine / theirs = questions each has answered */
  quiz: WaveAgreement & { mine: number; theirs: number }
  sharedTags: SharedTag[]
  /** "ช่วงชีวิตเดียวกัน" (stored values: show with lifeStageLabel) */
  sharedLifeStages: string[]
}

/**
 * Comparing my wave with someone's, signed in (the page a wave card's link leads to after sign-in).
 * Any level shows here: it's a comparison someone invited me to, not a suggestion. Live: fetches
 * the person (and their picks) when they aren't loaded yet. Reaching it forgets the pending invite.
 */
export function useCompare(userId: string | undefined): CompareView {
  const myId = useMyId()
  const me = useMoshi((s) => s.me)
  const person = usePerson(userId)
  const blocked = useMoshi((s) => !!userId && s.blocked.includes(userId))
  const match = useMatch(userId)
  const myWave = useMyWaveAnswers()
  const theirWave = usePersonWaveAnswers(userId)
  const mode = useDataMode()
  const ready = useDataReady()
  const [lookup, setLookup] = useState<{ id: string; found: boolean } | null>(null)
  useEffect(() => {
    if (mode !== 'live' || !ready || !userId || userId === myId || person) return
    let alive = true
    void ensurePerson(userId).then((r) => alive && setLookup({ id: userId, found: r === 'found' }))
    return () => {
      alive = false
    }
  }, [mode, ready, userId, myId, person])
  // reaching the comparison is the end of the invite's road (found or not)
  useEffect(() => {
    if (userId) clearCompareInvite(userId)
  }, [userId])
  return useMemo((): CompareView => {
    const base = {
      quiz: { ...agreement(myWave, theirWave), mine: answeredCount(myWave), theirs: answeredCount(theirWave) },
      sharedTags: match?.sharedTags ?? [],
      sharedLifeStages: sharedLifeStages(me.lifeStages, person?.lifeStages),
    }
    if (!userId) return { status: 'missing', ...base }
    if (userId === myId || userId === 'me') return { status: 'self', ...base }
    if (blocked) return { status: 'missing', ...base }
    if (person) return { status: 'ready', person, ...(match ? { match } : {}), ...base }
    if (mode === 'demo') return { status: 'missing', ...base }
    if (!ready || lookup?.id !== userId) return { status: 'loading', ...base }
    return { status: 'missing', ...base }
  }, [userId, myId, blocked, person, match, myWave, theirWave, me.lifeStages, mode, ready, lookup])
}
