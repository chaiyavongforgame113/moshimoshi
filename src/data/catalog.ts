import { create } from 'zustand'
import { isLive } from '@/lib/supabase'
import type { ChatMessage, DailyQuestion, Intent, Room, RoomWatch, ServerFeatures, Session, User, WaveAnswers } from '@/lib/types'
import { DAILY_QUESTIONS, DEMO_ROOM_WATCH, EVENT_MESSAGES, INTENTS, ROOM_MESSAGES, ROOMS, SESSIONS, USERS, WAVE_ANSWERS } from './mock'

/**
 * Shared, read-mostly data that comes from the server in live mode
 * (rooms, other people, their intents, sessions, daily questions, room chat).
 * Demo mode (no Supabase env) starts from the mock data and never syncs.
 * Pages never import '@/data/mock' directly — they use the hooks in
 * '@/data/hooks', which read this store plus the personal store (useMoshi).
 */
export type DataMode = 'demo' | 'live'

export interface CatalogData {
  mode: DataMode
  /** live mode: first sync finished (pages show skeletons until then) */
  ready: boolean
  /** live mode: the first sync failed (shown with a retry): no connection, or the load itself failed */
  error: 'network' | 'load' | null
  rooms: Room[]
  /** everyone except me */
  people: User[]
  /** intents posted by other people (mine live in useMoshi.myIntents) */
  intents: Intent[]
  /**
   * Sessions / events: every one loaded, cancelled and finished ones too (an event page needs them
   * until its chat hides, 24 h after the end). useSessions() keeps the old view: upcoming and live only.
   */
  sessions: Session[]
  /** live mode: sessions fetched by id that the server doesn't have (or won't show) */
  missingSessions: string[]
  /** live mode: sessions whose fetch by id failed (offline): the event page offers a retry, a reconnect retries */
  failedSessions: string[]
  questions: DailyQuestion[]
  /** room chat history per room (server rows in live mode, seeded lines in demo) */
  roomMessages: Record<string, ChatMessage[]>
  /** member counts per room, maintained by sync in live mode */
  roomStats: Record<string, { members: number; online: number }>
  /** live mode: who said "เหมือนกัน!" to each of my profile stories (prompt key → user ids) */
  storySames: Record<string, string[]>
  /** event chat history per session (live: the ones opened, from the server; demo: seeded lines) */
  eventMessages: Record<string, ChatMessage[]>
  /** other people's "จูนคลื่น" picks by user id (mine live in useMoshi.wave) */
  waveAnswers: Record<string, WaveAnswers>
  /** rooms' clips that are on, by room id (rooms with nothing on aren't listed). Demo: local only */
  roomWatch: Record<string, RoomWatch>
  /** room id → a host switched on "ให้ทุกคนคุมได้" (kept while nothing is on, too) */
  roomWatchOpen: Record<string, boolean>
  /** server pieces from newer migrations (live: switched on by the first load that finds them; demo: all on) */
  features: ServerFeatures
}

export interface CatalogState extends CatalogData {
  set: (patch: Partial<CatalogData>) => void
}

const DEMO: CatalogData = {
  mode: 'demo',
  ready: true,
  error: null,
  rooms: ROOMS,
  people: USERS,
  intents: INTENTS,
  sessions: SESSIONS,
  missingSessions: [],
  failedSessions: [],
  questions: DAILY_QUESTIONS,
  roomMessages: ROOM_MESSAGES,
  roomStats: Object.fromEntries(ROOMS.map((r) => [r.id, { members: r.memberCount, online: r.onlineCount }])),
  storySames: {},
  eventMessages: EVENT_MESSAGES,
  waveAnswers: WAVE_ANSWERS,
  roomWatch: DEMO_ROOM_WATCH,
  roomWatchOpen: {},
  features: { events: true, waveQuiz: true, lifeStages: true, intros: true, watch: true, waveCard: true },
}

/** live mode starts empty and fills in after sign-in */
export const LIVE_EMPTY: CatalogData = {
  mode: 'live',
  ready: false,
  error: null,
  rooms: [],
  people: [],
  intents: [],
  sessions: [],
  missingSessions: [],
  failedSessions: [],
  questions: [],
  roomMessages: {},
  roomStats: {},
  storySames: {},
  eventMessages: {},
  waveAnswers: {},
  roomWatch: {},
  roomWatchOpen: {},
  features: { events: false, waveQuiz: false, lifeStages: false, intros: false, watch: false, waveCard: false },
}

export const useCatalog = create<CatalogState>()((set) => ({
  ...(isLive ? LIVE_EMPTY : DEMO),
  set: (patch) => set(patch),
}))

/** Forget everything synced (sign-out). */
export function resetCatalog() {
  useCatalog.getState().set(isLive ? LIVE_EMPTY : DEMO)
}

// Dev only (Vite hot reload): a fresh copy of this store starts empty and never finishes loading.
// Reload the page instead.
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload())
