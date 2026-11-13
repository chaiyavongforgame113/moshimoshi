import { useEffect, useMemo, useState } from 'react'
import { eventChatVisible } from '@/lib/events'
import { useNow } from '@/lib/hooks'
import { known, useLang } from '@/lib/i18n'
import { questionInLang, roomInLang, sessionInLang } from '@/lib/i18n/catalog'
import { matchAll, matchUser, MIN_LEVEL, onWavelength, type MatchExtras } from '@/lib/matching'
import { useMoshi } from '@/lib/store'
import type {
  Chat,
  ChatMessage,
  DailyQuestion,
  Intent,
  MatchResult,
  Room,
  ServerFeatures,
  SignalLevel,
  Session,
  User,
  WaveAnswers,
} from '@/lib/types'
import { useCatalog } from './catalog'
import { resolveId } from './live/bus'
import type { LiveChat } from './live/map'
import { isSample, isServerId } from './live/sample'
import { ensureRoomHistory, ensureSession, retrySession, watchEvent } from './live/sync'
import { isStaff } from './live/writes'
import { DEMO_CHATS } from './mock'
import { sameTag } from './tags'

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

/** Server pieces from newer migrations: events (event chats, create / cancel) and the shared "จูนคลื่น". Demo: both on. */
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
