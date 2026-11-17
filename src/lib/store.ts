import { create, type StoreApi } from 'zustand'
import { persist } from 'zustand/middleware'
import { useCatalog } from '@/data/catalog'
import { keepLocalUrl, releaseLocalUrl } from '@/data/chatImages'
import { liveActions } from '@/data/live/actions'
import { knownError } from '@/data/live/errors'
import { dayOffset, hhmm } from '@/data/live/time'
import { DEMO_CHATS, DEMO_INTROS, DEMO_ME } from '@/data/mock'
import { demoPairAnswer, MOCHI_LINES, PAIR_ANSWER_MAX, pickPairQuestion } from '@/data/pairQuestions'
import { watchPositionAt, WATCH_LIMITS } from '@/data/watch'
import { t, tx, useLangStore } from '@/lib/i18n'
import { checkEventDraft, EVENT_LIMITS, EVENT_REFUSALS, eventDraftIssueText, eventPhase } from './events'
import type { PreparedImage } from './image'
import { normalizeLifeStages } from './lifeStages'
import { isLive } from './supabase'
import type {
  Chat,
  ChatMessage,
  EventDraft,
  Intent,
  IntroRequest,
  Mood,
  PairAnswer,
  RoomWatch,
  Session,
  User,
  VideoPick,
  WatchAction,
  WaveAnswers,
  WaveChoice,
} from './types'

const now = () => new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`

export type MoshiPolicy = 'everyone' | 'rooms' | 'chatted'
export type IntentDraft = Omit<Intent, 'id' | 'userId' | 'postedMinutesAgo' | 'joinedBy'>

export interface MoshiState {
  onboarded: boolean
  /** demo: id 'me' · live: my auth user id */
  me: User
  myIntents: Intent[]
  /** intents I pressed "ฉันด้วย" on */
  joinedIntentIds: string[]
  /** session ids I RSVP'd "ไปด้วย" */
  going: string[]
  /** user ids I sent a moshi (chat request) to */
  sentMoshi: string[]
  /** live chats also carry `status` + `requestedBy` (see pages/chats/lib.ts) */
  chats: Chat[]
  /** demo: my messages + simulated replies per room · live: my messages still on their way */
  roomMessages: Record<string, ChatMessage[]>
  /** question id -> my answer */
  answers: Record<string, string>
  /** message / answer ids I reacted "เหมือนกัน!" to */
  sames: string[]
  /** demo: my lines in event chats · live: my lines still on their way (session id → lines) */
  eventMessages: Record<string, ChatMessage[]>
  /** my "จูนคลื่น" picks (question id → 0 / 1). Live: the server's plus any not saved there yet */
  wave: WaveAnswers
  /** live: whose picks `wave` holds on this device ('' = not known yet); another account's are dropped */
  waveOwner: string
  /** user ids I blocked (hidden everywhere) */
  blocked: string[]
  /** who may send me a moshi */
  moshiPolicy: MoshiPolicy
  /**
   * "ให้โมชิแนะนำให้": intros I asked for (outgoing) and ones about me (incoming), newest first.
   * Live: from the server (one I set aside is gone; one about me that I asked for back opens a chat).
   * Read them through useIntroRequests() / useIntroWith().
   */
  intros: IntroRequest[]
  /** question pair answers per chat id: mine, and theirs once both answered (usePairQuestion) */
  pairAnswers: Record<string, PairAnswer[]>
  mood?: Mood
  /** a small message for the toast (e.g. a write that didn't go through) */
  notice: { id: number; text: string } | null

  completeOnboarding: (me: Partial<User>) => void
  updateMe: (patch: Partial<User>) => void
  resetDemo: () => void
  joinRoom: (roomId: string) => void
  leaveRoom: (roomId: string) => void
  postIntent: (intent: IntentDraft) => Intent
  removeIntent: (id: string) => void
  /** change one of my posts (it keeps its id and who said "ฉันด้วย") */
  updateIntent: (id: string, intent: IntentDraft) => void
  toggleJoinIntent: (id: string) => void
  toggleGoing: (sessionId: string) => void
  /** returns the chat id (live: may be a temporary id until the server answers; useChat resolves it) */
  sendMoshi: (userId: string, opener: string) => string
  /** answer a moshi someone sent me (live only; demo chats have no status) */
  respondMoshi: (chatId: string, accept: boolean) => void
  sendChatMessage: (chatId: string, text: string) => void
  sendRoomMessage: (roomId: string, text: string) => void
  /** prototype: a message from someone else (or a system line) lands in a chat */
  receiveChatMessage: (chatId: string, userId: string, text: string, kind?: ChatMessage['kind']) => void
  markChatRead: (chatId: string) => void
  /** บันไดความไว้ใจ ขั้น 2: my yes/no to photos in a chat (photos unlock when both say yes) */
  setMediaConsent: (chatId: string, on: boolean) => void
  /** prototype: the other person's yes/no to photos (simulated chats) */
  receiveMediaConsent: (chatId: string, on: boolean) => void
  /** send a photo made by prepareImage (lib/image) */
  sendChatImage: (chatId: string, image: PreparedImage) => void
  /** take back one of my messages (a photo) */
  deleteChatMessage: (chatId: string, messageId: string) => void
  /** report one message in a chat (a photo) to the team */
  reportChatMessage: (chatId: string, messageId: string, reason: string, details?: string) => void
  /** report one line in a room's chat to the team (shows its own toast) */
  reportRoomMessage: (roomId: string, messageId: string, reason: string, details?: string) => void
  /** prototype: `userId` reacts "เหมือนกัน!" to a message in a chat */
  reactToChatMessage: (chatId: string, messageId: string, userId: string) => void
  /** prototype: a room member's reply, kept in roomMessages next to mine */
  receiveRoomMessage: (roomId: string, userId: string, text: string) => void
  answerQuestion: (questionId: string, text: string) => void
  /**
   * A line in an event's chat. Only while the event is open (the server holds the clock); a refusal
   * shows a friendly toast ("อีเวนต์จบแล้ว…"). Sending also counts as going ("ไปด้วย").
   */
  sendEventMessage: (sessionId: string, text: string) => void
  /**
   * Set up an event (staff, or a host of that room). Resolves with the new session id, or
   * undefined after a toast saying why not (checkEventDraft's rules, permissions, a taken weekly slot).
   */
  createEvent: (draft: EventDraft) => Promise<string | undefined>
  /** Call an event off (the UI asks first). alsoStopRepeat: no more weeks either. Resolves true when done */
  cancelEvent: (sessionId: string, alsoStopRepeat?: boolean) => Promise<boolean>
  /** A weekly event stops repeating after this one (this one stays). Resolves true when done */
  stopRepeat: (sessionId: string) => Promise<boolean>
  /** "จูนคลื่น": pick a side (picking again changes it). Saved right away; without the server piece it stays on this device */
  answerWave: (questionId: string, choice: WaveChoice) => void
  toggleSame: (id: string) => void
  blockUser: (userId: string) => void
  /** off my blocked list at once (Me → ตั้งค่า → คนที่บล็อกไว้); no toast of its own unless it fails */
  unblockUser: (userId: string) => void
  reportUser: (userId: string, reason: string, details?: string) => void
  setMoshiPolicy: (policy: MoshiPolicy) => void
  /**
   * My "ช่วงชีวิต" (at most 3, normalized with normalizeLifeStages): the list's Thai values or my own
   * text. Saved right away; a toast says "soon" while the server piece is missing.
   */
  setLifeStages: (list: string[]) => void
  /**
   * "ให้โมชิแนะนำให้": ask Mochi to introduce me to someone on my wavelength. Resolves true once the
   * request is in (or already was; if they had asked about me first, the chat opens right away),
   * false after a toast saying why not (3 a day, already chatting, their hello settings, a block…).
   */
  requestIntro: (userId: string) => Promise<boolean>
  /**
   * Answer an intro about me (an incoming IntroRequest's id). `ok`: the answer went through (false
   * after a toast saying why). Accept ("ยินดีรู้จัก"): `chatId` is the chat Mochi opened (go to
   * /app/chats/<id>; also there when it had been accepted already). Decline ("ไว้ก่อนนะ"): it's gone
   * from my list; the other person is never told.
   */
  respondIntro: (introId: string, accept: boolean) => Promise<{ ok: boolean; chatId?: string }>
  /**
   * The question pair: my answer (1–300 characters) to the chat's question. Resolves true once saved;
   * theirs shows when both have answered (usePairQuestion).
   */
  answerPair: (chatId: string, questionId: string, text: string) => Promise<boolean>
  /** Put a clip on in a room for everyone (a member; while one plays, only those who may control it). */
  watchStart: (roomId: string, video: VideoPick) => Promise<boolean>
  /**
   * Play / pause / seek (positionS required) / rate (0.25–2) for the whole room. positionS for play and
   * pause is where my own player is (optional: the server works it out). Resolves false after a toast.
   */
  watchControl: (roomId: string, action: WatchAction, positionS?: number, rate?: number) => Promise<boolean>
  /** Take the clip off for everyone (the UI asks first). */
  watchStop: (roomId: string) => Promise<boolean>
  /**
   * What my player found out about the clip on (`ref`): its length in seconds, or that it's a live
   * stream. Once per clip, from someone who may control it; the room then knows when it ends. Quiet:
   * no toast either way (resolves false when the room didn't take it).
   */
  watchReport: (roomId: string, ref: string, info: { durationS?: number; isLive?: boolean }) => Promise<boolean>
  /** "ให้ทุกคนคุมได้": hosts of the room and staff. */
  watchSetOpen: (roomId: string, open: boolean) => Promise<boolean>
  setMood: (mood: Mood) => void
  notify: (text: string) => void
  clearNotice: () => void
}

type ActionKeys = { [K in keyof MoshiState]-?: MoshiState[K] extends (...a: never[]) => unknown ? K : never }[keyof MoshiState]
export type MoshiData = Omit<MoshiState, ActionKeys>
export type MoshiActions = Pick<MoshiState, ActionKeys>
export type MoshiSet = StoreApi<MoshiState>['setState']
export type MoshiGet = StoreApi<MoshiState>['getState']

/** Live mode before my profile has loaded (and after signing out). */
export const BLANK_ME: User = {
  id: '',
  name: '',
  age: 0,
  color: 'peach',
  province: 'กรุงเทพฯ',
  bio: '',
  tags: [],
  loves: [],
  prompts: [],
  chatStyle: [],
  online: [],
  rooms: [],
  languages: ['ไทย'],
  lastActive: 'ออนไลน์อยู่',
  isOnline: true,
}

const DEMO_DATA: MoshiData = {
  onboarded: false,
  me: DEMO_ME,
  myIntents: [],
  joinedIntentIds: [],
  going: [],
  sentMoshi: [],
  chats: DEMO_CHATS,
  roomMessages: {},
  answers: {},
  sames: [],
  eventMessages: {},
  wave: {},
  waveOwner: '',
  blocked: [],
  moshiPolicy: 'everyone',
  intros: DEMO_INTROS,
  pairAnswers: {},
  mood: undefined,
  notice: null,
}

const LIVE_DATA: MoshiData = { ...DEMO_DATA, me: BLANK_ME, chats: [], intros: [], pairAnswers: {} }

/** A chat as it's saved on this device: no photo still "on its way" (after a reload it never arrives). */
function settled(chat: Chat): Chat {
  if (!chat.messages.some((m) => m.image?.sending)) return chat
  return {
    ...chat,
    messages: chat.messages.map((m) => {
      if (!m.image?.sending) return m
      const { sending: _sending, ...image } = m.image
      return { ...m, image }
    }),
  }
}

let noticeId = 0

/** set by demoActions: answers demo intros whose simulated answer was lost to a reload */
let settleDemo: () => void = () => {}

/** Demo only: intros I asked for get their simulated answer (useIntroRequests calls it). */
export const settleDemoIntros = () => settleDemo()

const MINUTE = 60_000
const WEEK = 7 * 86_400_000

/** A demo event made from the create wizard's answers (live ones come from the server). */
function demoEvent(id: string, draft: EventDraft, startMs: number, me: string, seriesId?: string): Session {
  const startsAt = new Date(startMs).toISOString()
  const description = draft.description?.trim()
  return {
    id,
    roomId: draft.roomId,
    title: draft.title.trim(),
    dayOffset: dayOffset(startsAt),
    time: hhmm(startsAt),
    durationMin: draft.durationMin,
    going: 0,
    goingIds: [],
    hostId: me,
    createdBy: me,
    live: false,
    startsAt,
    endsAt: new Date(startMs + draft.durationMin * MINUTE).toISOString(),
    ...(description ? { description } : {}),
    ...(seriesId ? { repeatsWeekly: true, seriesId } : {}),
  }
}

/** A copy with some fields changed that keeps demo text following the language (loc() getters). */
function withFields<T extends object>(o: T, patch: Partial<T>): T {
  const copy = Object.create(Object.getPrototypeOf(o), Object.getOwnPropertyDescriptors(o)) as T
  for (const [k, v] of Object.entries(patch)) Object.defineProperty(copy, k, { value: v, enumerable: true, configurable: true, writable: true })
  return copy
}

/** Demo: change the catalog's copy of some events. */
function editDemoEvents(fn: (s: Session) => Session) {
  const cat = useCatalog.getState()
  cat.set({ sessions: cat.sessions.map(fn) })
}

/** demo: how long the simulated person takes to answer an intro I asked for, and the question pair */
const DEMO_INTRO_MS = 3500
const DEMO_PAIR_MS = 2600
const INTRO_TTL_MS = 3 * 86_400_000
const DAY_MS = 86_400_000

const isOpenIntro = (i: IntroRequest, t = Date.now()) => i.status === 'pending' && Date.parse(i.expiresAt) > t

/** Demo: change one room's clip in the catalog (null takes it off). */
function editDemoWatch(roomId: string, fn: (w: RoomWatch | undefined) => RoomWatch | null) {
  const cat = useCatalog.getState()
  const next = fn(cat.roomWatch[roomId])
  const roomWatch = { ...cat.roomWatch }
  if (next) roomWatch[roomId] = next
  else delete roomWatch[roomId]
  cat.set({ roomWatch })
}

/** Local-only behaviour: the whole prototype in demo mode, sample people in live mode. */
export function demoActions(set: MoshiSet, get: MoshiGet): MoshiActions {
  /**
   * Demo: an intro gets its "ยินดีรู้จัก": the 1:1 chat (the one we had, or a new one) gets Mochi's
   * intro line and the question pair. Returns the chat id.
   */
  const acceptDemoIntro = (introId: string): string | undefined => {
    const intro = get().intros.find((i) => i.id === introId)
    if (!intro) return undefined
    if (intro.status !== 'pending') return intro.chatId
    const question = pickPairQuestion().id
    const lines: ChatMessage[] = [
      { id: uid('m'), userId: 'system', text: MOCHI_LINES.intro, at: now(), kind: 'mochi' },
      { id: uid('m'), userId: 'system', text: MOCHI_LINES.ask, at: now(), kind: 'mochi' },
    ]
    const existing = get().chats.find((c) => c.withUserId === intro.withUserId)
    const chat: Chat = existing
      ? { ...existing, kind: 'intro', pairQuestion: question, unread: existing.unread + lines.length, messages: [...existing.messages, ...lines] }
      : { id: uid('c'), withUserId: intro.withUserId, kind: 'intro', pairQuestion: question, unread: intro.direction === 'outgoing' ? lines.length : 0, messages: lines }
    set((s) => ({
      chats: existing ? s.chats.map((c) => (c.id === existing.id ? chat : c)) : [chat, ...s.chats],
      intros: s.intros.map((i) => (i.id === introId ? { ...i, status: 'accepted', chatId: chat.id } : i)),
    }))
    return chat.id
  }
  settleDemo = () => {
    const nowMs = Date.now()
    get()
      .intros.filter((i) => i.direction === 'outgoing' && isOpenIntro(i, nowMs) && nowMs - Date.parse(i.createdAt) >= DEMO_INTRO_MS)
      .forEach((i) => acceptDemoIntro(i.id))
  }

  return {
    completeOnboarding: (patch) => set((s) => ({ onboarded: true, me: { ...s.me, ...patch, id: s.me.id } })),
    updateMe: (patch) => set((s) => ({ me: { ...s.me, ...patch, id: s.me.id } })),
    resetDemo: () => set({ ...DEMO_DATA }),
    joinRoom: (roomId) => set((s) => (s.me.rooms.includes(roomId) ? s : { me: { ...s.me, rooms: [...s.me.rooms, roomId] } })),
    leaveRoom: (roomId) => set((s) => ({ me: { ...s.me, rooms: s.me.rooms.filter((r) => r !== roomId) } })),
    postIntent: (draft) => {
      const intent: Intent = { ...draft, id: uid('i'), userId: get().me.id, postedMinutesAgo: 0, joinedBy: [] }
      set((s) => ({ myIntents: [intent, ...s.myIntents].slice(0, 3) }))
      return intent
    },
    removeIntent: (id) => set((s) => ({ myIntents: s.myIntents.filter((i) => i.id !== id) })),
    updateIntent: (id, intent) => set((s) => ({ myIntents: s.myIntents.map((i) => (i.id === id ? { ...i, ...intent } : i)) })),
    toggleJoinIntent: (id) =>
      set((s) => ({
        joinedIntentIds: s.joinedIntentIds.includes(id) ? s.joinedIntentIds.filter((x) => x !== id) : [...s.joinedIntentIds, id],
      })),
    toggleGoing: (sessionId) =>
      set((s) => ({ going: s.going.includes(sessionId) ? s.going.filter((x) => x !== sessionId) : [...s.going, sessionId] })),
    sendMoshi: (userId, opener) => {
      const existing = get().chats.find((c) => c.withUserId === userId)
      if (existing) {
        // the same opener twice in a row (a double tap) only goes out once
        const last = existing.messages.at(-1)
        if (!(last?.userId === get().me.id && last.text === opener)) get().sendChatMessage(existing.id, opener)
        return existing.id
      }
      const mid = uid('m')
      const chat: Chat = {
        id: uid('c'),
        withUserId: userId,
        unread: 0,
        messages: [
          { id: uid('m'), userId: 'system', text: 'ส่งข้อความทักแล้ว! รอเขาตอบรับนะ', at: now(), kind: 'system' },
          { id: mid, localId: mid, userId: get().me.id, text: opener, at: now() },
        ],
      }
      set((s) => ({ chats: [chat, ...s.chats], sentMoshi: [...s.sentMoshi, userId] }))
      return chat.id
    },
    respondMoshi: () => {},
    // my messages carry localId like live ones do (here it never changes)
    sendChatMessage: (chatId, text) => {
      const id = uid('m')
      set((s) => ({
        chats: s.chats.map((c) => (c.id === chatId ? { ...c, messages: [...c.messages, { id, localId: id, userId: s.me.id, text, at: now() }] } : c)),
      }))
    },
    sendRoomMessage: (roomId, text) =>
      set((s) => ({
        roomMessages: {
          ...s.roomMessages,
          [roomId]: [...(s.roomMessages[roomId] ?? []), { id: uid('m'), userId: s.me.id, text, at: now() }],
        },
      })),
    receiveChatMessage: (chatId, userId, text, kind) =>
      set((s) => ({
        chats: s.chats.map((c) =>
          c.id === chatId ? { ...c, messages: [...c.messages, { id: uid('m'), userId, text, at: now(), kind }] } : c,
        ),
      })),
    markChatRead: (chatId) =>
      set((s) =>
        s.chats.some((c) => c.id === chatId && c.unread > 0)
          ? { chats: s.chats.map((c) => (c.id === chatId ? { ...c, unread: 0 } : c)) }
          : s,
      ),
    setMediaConsent: (chatId, on) =>
      set((s) => ({ chats: s.chats.map((c) => (c.id === chatId ? { ...c, consent: { me: on, them: c.consent?.them ?? false } } : c)) })),
    receiveMediaConsent: (chatId, on) =>
      set((s) => ({ chats: s.chats.map((c) => (c.id === chatId ? { ...c, consent: { me: c.consent?.me ?? false, them: on } } : c)) })),
    // demo photos stay on this device: an object URL, gone after a reload (the bubble then says it
    // can't be opened, and the photo can still be deleted from the viewer)
    sendChatImage: (chatId, image) => {
      const id = uid('m')
      keepLocalUrl(image.url)
      set((s) => ({
        chats: s.chats.map((c) =>
          c.id === chatId
            ? {
                ...c,
                messages: [
                  ...c.messages,
                  { id, localId: id, userId: s.me.id, text: '', at: now(), kind: 'image', image: { url: image.url, width: image.width, height: image.height } },
                ],
              }
            : c,
        ),
      }))
    },
    deleteChatMessage: (chatId, messageId) => {
      const gone = (m: ChatMessage) => m.id === messageId || m.localId === messageId
      const url = get().chats.find((c) => c.id === chatId)?.messages.find(gone)?.image?.url
      set((s) => ({ chats: s.chats.map((c) => (c.id === chatId ? { ...c, messages: c.messages.filter((m) => !gone(m)) } : c)) }))
      // let the photo's memory go
      if (url) releaseLocalUrl(url)
    },
    reportChatMessage: () => get().notify(t('ส่งรายงานแล้ว ทีมงานจะดูให้เร็วที่สุดนะ', 'Report sent. The team will look at it soon')),
    reportRoomMessage: () => get().notify(t('ส่งรายงานแล้ว ทีมงานจะดูให้เร็วที่สุดนะ', 'Report sent. The team will look at it soon')),
    reactToChatMessage: (chatId, messageId, userId) =>
      set((s) => ({
        chats: s.chats.map((c) =>
          c.id === chatId
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === messageId && !m.sameBy?.includes(userId) ? { ...m, sameBy: [...(m.sameBy ?? []), userId] } : m,
                ),
              }
            : c,
        ),
      })),
    receiveRoomMessage: (roomId, userId, text) =>
      set((s) => ({
        roomMessages: {
          ...s.roomMessages,
          [roomId]: [...(s.roomMessages[roomId] ?? []), { id: uid('m'), userId, text, at: now() }],
        },
      })),
    answerQuestion: (questionId, text) => set((s) => ({ answers: { ...s.answers, [questionId]: text } })),
    sendEventMessage: (sessionId, text) => {
      const body = text.trim().slice(0, EVENT_LIMITS.messageMax)
      if (!body) return
      const session = useCatalog.getState().sessions.find((x) => x.id === sessionId)
      const phase = session ? eventPhase(session) : 'closed'
      if (phase !== 'open') return get().notify(tx(EVENT_REFUSALS[phase]))
      const id = uid('m')
      set((s) => ({
        eventMessages: { ...s.eventMessages, [sessionId]: [...(s.eventMessages[sessionId] ?? []), { id, localId: id, userId: s.me.id, text: body, at: now() }] },
        going: s.going.includes(sessionId) ? s.going : [...s.going, sessionId],
      }))
    },
    // demo events live in the catalog for this visit (the seeded ones come back on reload)
    createEvent: (draft) => {
      const issue = checkEventDraft(draft)
      if (issue) {
        get().notify(eventDraftIssueText(issue))
        return Promise.resolve(undefined)
      }
      const start = Math.floor(Date.parse(draft.startsAt) / MINUTE) * MINUTE
      const id = uid('e')
      const me = get().me.id
      const series = draft.repeatWeekly ? uid('series') : undefined
      const made = [demoEvent(id, draft, start, me, series), ...(series ? [demoEvent(uid('e'), draft, start + WEEK, me, series)] : [])]
      const cat = useCatalog.getState()
      cat.set({ sessions: [...cat.sessions, ...made].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)) })
      return Promise.resolve(id)
    },
    cancelEvent: (sessionId, alsoStopRepeat = false) => {
      const target = useCatalog.getState().sessions.find((x) => x.id === sessionId)
      if (!target) return Promise.resolve(false)
      const nowMs = Date.now()
      if (eventPhase(target, nowMs) === 'closed' && !alsoStopRepeat) {
        get().notify(tx(EVENT_REFUSALS.closed))
        return Promise.resolve(false)
      }
      const series = alsoStopRepeat ? target.seriesId : undefined
      editDemoEvents((x) => {
        const inSeries = !!series && x.seriesId === series
        const cancel = (x.id === sessionId && eventPhase(x, nowMs) !== 'closed') || (inSeries && Date.parse(x.startsAt) > nowMs)
        if (!cancel && !inSeries) return x
        return withFields(x, { ...(cancel ? { cancelled: true, live: false } : {}), ...(inSeries ? { repeatsWeekly: undefined, seriesId: undefined } : {}) })
      })
      return Promise.resolve(true)
    },
    stopRepeat: (sessionId) => {
      const target = useCatalog.getState().sessions.find((x) => x.id === sessionId)
      const series = target?.seriesId
      if (!target || !series) return Promise.resolve(!!target)
      const nowMs = Date.now()
      editDemoEvents((x) => {
        if (x.seriesId !== series) return x
        const cancel = x.id !== sessionId && Date.parse(x.startsAt) > nowMs
        return withFields(x, { repeatsWeekly: undefined, seriesId: undefined, ...(cancel ? { cancelled: true } : {}) })
      })
      return Promise.resolve(true)
    },
    answerWave: (questionId, choice) => set((s) => ({ wave: { ...s.wave, [questionId]: choice }, waveOwner: s.me.id })),
    toggleSame: (id) => set((s) => ({ sames: s.sames.includes(id) ? s.sames.filter((x) => x !== id) : [...s.sames, id] })),
    blockUser: (userId) =>
      set((s) => ({
        blocked: s.blocked.includes(userId) ? s.blocked : [...s.blocked, userId],
        chats: s.chats.filter((c) => c.withUserId !== userId),
      })),
    // demo: their profile and posts show again (chats that went with the block stay gone)
    unblockUser: (userId) => set((s) => (s.blocked.includes(userId) ? { blocked: s.blocked.filter((x) => x !== userId) } : s)),
    reportUser: () => {},
    setMoshiPolicy: (moshiPolicy) => set({ moshiPolicy }),
    setLifeStages: (list) => set((s) => ({ me: { ...s.me, lifeStages: normalizeLifeStages(list) } })),
    requestIntro: (userId) => {
      const s = get()
      const refuse = (key: string) => {
        get().notify(knownError({ message: key }) ?? t('ตอนนี้ยังทำไม่ได้นะ', "You can't do that just yet"))
        return Promise.resolve(false)
      }
      if (!userId || userId === s.me.id) return refuse('cannot_intro_self')
      if (s.blocked.includes(userId)) return refuse('blocked')
      if (s.chats.some((c) => c.withUserId === userId)) return refuse('already_chatting')
      const nowMs = Date.now()
      if (s.intros.some((i) => i.direction === 'outgoing' && i.withUserId === userId && isOpenIntro(i, nowMs))) return Promise.resolve(true)
      // they asked Mochi about me first: asking back is a yes
      const theirs = s.intros.find((i) => i.direction === 'incoming' && i.withUserId === userId && isOpenIntro(i, nowMs))
      if (theirs) {
        acceptDemoIntro(theirs.id)
        return Promise.resolve(true)
      }
      if (s.intros.filter((i) => i.direction === 'outgoing' && nowMs - Date.parse(i.createdAt) < DAY_MS).length >= 3) return refuse('intro_rate_limited')
      const intro: IntroRequest = {
        id: uid('intro'),
        fromUserId: s.me.id,
        toUserId: userId,
        direction: 'outgoing',
        withUserId: userId,
        status: 'pending',
        createdAt: new Date(nowMs).toISOString(),
        expiresAt: new Date(nowMs + INTRO_TTL_MS).toISOString(),
      }
      set((st) => ({ intros: [intro, ...st.intros] }))
      // the simulated person says yes a moment later (settleDemoIntros catches up after a reload)
      window.setTimeout(() => acceptDemoIntro(intro.id), DEMO_INTRO_MS)
      return Promise.resolve(true)
    },
    respondIntro: (introId, accept) => {
      const intro = get().intros.find((i) => i.id === introId)
      if (!intro || intro.direction !== 'incoming') return Promise.resolve({ ok: false })
      if (!isOpenIntro(intro)) {
        get().notify(knownError({ message: intro.status === 'accepted' ? 'intro_not_pending' : 'intro_expired' }) ?? '')
        return Promise.resolve({ ok: false, ...(intro.chatId ? { chatId: intro.chatId } : {}) })
      }
      if (accept) {
        const chatId = acceptDemoIntro(introId)
        return Promise.resolve({ ok: !!chatId, ...(chatId ? { chatId } : {}) })
      }
      // silent for them: it just leaves my list
      set((s) => ({ intros: s.intros.filter((i) => i.id !== introId) }))
      return Promise.resolve({ ok: true })
    },
    answerPair: (chatId, questionId, text) => {
      const body = text.trim().slice(0, PAIR_ANSWER_MAX)
      const chat = get().chats.find((c) => c.id === chatId)
      if (!body || !chat || chat.pairQuestion !== questionId) return Promise.resolve(false)
      const me = get().me.id
      const list = get().pairAnswers[chatId] ?? []
      if (list.some((a) => a.userId === me && a.questionId === questionId)) return Promise.resolve(true)
      const mine: PairAnswer = { chatId, userId: me, questionId, text: body, at: new Date().toISOString() }
      set((s) => ({ pairAnswers: { ...s.pairAnswers, [chatId]: [...(s.pairAnswers[chatId] ?? []), mine] } }))
      // the simulated person answers a little later, then Mochi steps back
      window.setTimeout(() => {
        const st = get()
        const answers = st.pairAnswers[chatId] ?? []
        if (answers.some((a) => a.userId === chat.withUserId && a.questionId === questionId)) return
        const theirs: PairAnswer = { chatId, userId: chat.withUserId, questionId, text: demoPairAnswer(questionId), at: new Date().toISOString() }
        set((s2) => ({
          pairAnswers: { ...s2.pairAnswers, [chatId]: [...(s2.pairAnswers[chatId] ?? []), theirs] },
          chats: s2.chats.map((c) =>
            c.id === chatId
              ? { ...c, unread: c.unread + 1, messages: [...c.messages, { id: uid('m'), userId: 'system', text: MOCHI_LINES.bye, at: now(), kind: 'mochi' as const }] }
              : c,
          ),
        }))
      }, DEMO_PAIR_MS)
      return Promise.resolve(true)
    },
    watchStart: (roomId, video) => {
      if (!get().me.rooms.includes(roomId)) {
        get().notify(knownError({ message: 'watch_not_member' }) ?? '')
        return Promise.resolve(false)
      }
      const me = get().me.id
      const nowMs = Date.now()
      const open = !!useCatalog.getState().roomWatchOpen[roomId]
      editDemoWatch(roomId, (prev) => ({
        roomId,
        provider: video.provider,
        ref: video.ref,
        ...(video.title?.trim() ? { title: video.title.trim().slice(0, WATCH_LIMITS.titleMax) } : {}),
        ...(video.durationS && video.durationS > 0 ? { durationS: video.durationS } : {}),
        isLive: !!video.isLive,
        playing: true,
        positionS: video.isLive ? 0 : Math.max(0, video.startS ?? 0),
        positionAt: nowMs + WATCH_LIMITS.startLeadMs,
        rate: 1,
        startedBy: me,
        startedAt: nowMs,
        anyoneCanControl: open,
        updatedBy: me,
        updatedAt: nowMs,
        version: (prev?.version ?? 0) + 1,
      }))
      return Promise.resolve(true)
    },
    watchControl: (roomId, action, positionS, rate) => {
      const w = useCatalog.getState().roomWatch[roomId]
      if (!w) {
        get().notify(knownError({ message: 'watch_not_playing' }) ?? '')
        return Promise.resolve(false)
      }
      if (action === 'seek' && (positionS === undefined || positionS < 0)) return Promise.resolve(false)
      if (action === 'rate' && (rate === undefined || rate < WATCH_LIMITS.rateMin || rate > WATCH_LIMITS.rateMax)) return Promise.resolve(false)
      const nowMs = Date.now()
      const here = watchPositionAt(w, nowMs)
      const lead = nowMs + WATCH_LIMITS.startLeadMs
      const clamp = (p: number) => (w.isLive ? 0 : Math.min(Math.max(0, p), w.durationS ?? Number.POSITIVE_INFINITY))
      const me = get().me.id
      editDemoWatch(roomId, (prev) => {
        if (!prev) return null
        const base = { ...prev, updatedBy: me, updatedAt: nowMs, version: prev.version + 1 }
        if (action === 'play') return { ...base, playing: true, positionS: clamp(positionS ?? here), positionAt: lead }
        if (action === 'pause') return { ...base, playing: false, positionS: clamp(positionS ?? here), positionAt: nowMs }
        if (action === 'seek') return { ...base, positionS: clamp(positionS ?? here), positionAt: prev.playing ? lead : nowMs }
        return { ...base, positionS: clamp(here), positionAt: nowMs, rate: rate ?? prev.rate }
      })
      return Promise.resolve(true)
    },
    watchStop: (roomId) => {
      editDemoWatch(roomId, () => null)
      return Promise.resolve(true)
    },
    watchReport: (roomId, ref, info) => {
      const w = useCatalog.getState().roomWatch[roomId]
      const durationS = info.durationS && info.durationS > 0 && info.durationS <= WATCH_LIMITS.durationMax ? info.durationS : undefined
      // as the server: once, for this clip, and a report isn't anyone's play or pause
      if (!w || w.ref !== ref || w.isLive || w.durationS || (!info.isLive && !durationS)) return Promise.resolve(false)
      editDemoWatch(roomId, (prev) => {
        if (!prev) return null
        if (info.isLive) return { ...prev, isLive: true, positionS: 0, positionAt: Date.now(), version: prev.version + 1 }
        return { ...prev, durationS, positionS: Math.min(prev.positionS, durationS ?? prev.positionS), version: prev.version + 1 }
      })
      return Promise.resolve(true)
    },
    watchSetOpen: (roomId, open) => {
      const cat = useCatalog.getState()
      cat.set({ roomWatchOpen: { ...cat.roomWatchOpen, [roomId]: open } })
      editDemoWatch(roomId, (prev) => (prev ? { ...prev, anyoneCanControl: open, version: prev.version + 1 } : null))
      return Promise.resolve(true)
    },
    setMood: (mood) => set({ mood }),
    notify: (text) => set({ notice: { id: ++noticeId, text } }),
    clearNotice: () => set({ notice: null }),
  }
}

export const useMoshi = create<MoshiState>()(
  persist(
    (set, get) => {
      const demo = demoActions(set, get)
      return { ...(isLive ? LIVE_DATA : DEMO_DATA), ...demo, ...(isLive ? liveActions(set, get, demo) : {}) }
    },
    {
      // live data comes from the server: only per-device conveniences are kept locally
      name: isLive ? 'moshimoshi-live' : 'moshimoshi-demo',
      version: 1,
      partialize: (s): Partial<MoshiState> => {
        // live: my "จูนคลื่น" picks too, so they survive a reload before the server keeps them
        if (isLive) return { mood: s.mood, wave: s.wave, waveOwner: s.waveOwner }
        const { notice: _notice, ...data } = s
        return { ...data, chats: data.chats.map(settled) }
      },
    },
  ),
)

// a toast was written in the old language: drop it before the remounted page shows it again
useLangStore.subscribe((s, prev) => {
  if (s.lang !== prev.lang) useMoshi.getState().clearNotice()
})

/** Back to a clean slate (sign-out in live mode). */
export function resetPersonalState() {
  useMoshi.setState(isLive ? { ...LIVE_DATA } : { ...DEMO_DATA })
}

// Dev only (Vite hot reload): swapping this file in place leaves two stores, the live sync still
// filling the old one, and the guards bounce to /onboarding. Reload the page in place instead.
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload())
