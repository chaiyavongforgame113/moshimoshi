import { useSyncExternalStore } from 'react'
import { useCatalog } from '@/data/catalog'
import { useMoshi } from './store'
import type { ChatMessage } from './types'

/*
 * Small "how far along am I" notes kept on this device:
 *  - per person (keyed by user id): sent a first room message, the home's first steps
 *    card closed (finished or hidden)
 *  - per device: which first-visit tips (one Mochi bubble per main tab) were already shown
 * Storage can be missing or full (private windows, blocked site data), so every read and write
 * is wrapped; the in-memory copy keeps things right for this visit either way.
 */

export interface Progress {
  /** Favorite chats for this account on this device. */
  starredChats?: string[]
  /** I typed something in a room at least once */
  roomMessage?: boolean
  /** The first steps card is closed for good (completed or previously hidden). */
  stepsClosed?: boolean
  /** The follow-up after completing first steps has been dismissed or acted on. */
  stepsFollowUpSeen?: boolean
  wavelengthExplored?: boolean
  firstEventDone?: boolean
}

const EMPTY: Progress = {}
const listeners = new Set<() => void>()
const cache = new Map<string, Progress>()

const progressKey = (userId: string) => `moshimoshi-progress:${userId}`

function emit() {
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The same object until it changes (useSyncExternalStore compares by reference). */
function readProgress(userId: string): Progress {
  if (!userId) return EMPTY
  const hit = cache.get(userId)
  if (hit) return hit
  let value: Progress = EMPTY
  try {
    const raw = window.localStorage.getItem(progressKey(userId))
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (parsed && typeof parsed === 'object') value = parsed as Progress
  } catch {
    // no storage here: start fresh for this visit
  }
  cache.set(userId, value)
  return value
}

function writeProgress(userId: string, patch: Progress) {
  if (!userId) return
  const prev = readProgress(userId)
  if (Object.entries(patch).every(([k, v]) => prev[k as keyof Progress] === v)) return
  const next = { ...prev, ...patch }
  cache.set(userId, next)
  try {
    window.localStorage.setItem(progressKey(userId), JSON.stringify(next))
  } catch {
    // storage blocked or full: the in-memory copy still holds for this visit
  }
  emit()
}

export const markRoomMessageSent = (userId: string) => writeProgress(userId, { roomMessage: true })
export const closeFirstSteps = (userId: string) => writeProgress(userId, { stepsClosed: true })
export const dismissFirstStepsFollowUp = (userId: string) => writeProgress(userId, { stepsFollowUpSeen: true })
export const markWavelengthExplored = (userId: string) => writeProgress(userId, { wavelengthExplored: true })
export const markFirstEventDone = (userId: string) => writeProgress(userId, { firstEventDone: true })

export function toggleChatStar(userId: string, chatId: string) {
  const stored = readProgress(userId).starredChats
  const starred = Array.isArray(stored) ? stored : []
  writeProgress(userId, { starredChats: starred.includes(chatId) ? starred.filter((id) => id !== chatId) : [...starred, chatId] })
}

export function useProgress(userId: string): Progress {
  return useSyncExternalStore(
    subscribe,
    () => readProgress(userId),
    () => EMPTY,
  )
}

const said = (myId: string) => (m: ChatMessage) => (m.userId === myId || m.userId === 'me') && m.kind !== 'system' && m.kind !== 'welcome'
const anySaid = (rooms: Record<string, ChatMessage[]>, myId: string) => {
  const mine = said(myId)
  return Object.values(rooms).some((list) => list.some(mine))
}

/**
 * Have I ever said something in a room? The note from the send path, or a line of mine that
 * room data already holds (my lines on their way, or loaded history).
 */
export function useSaidInRoom(userId: string): boolean {
  const noted = useProgress(userId).roomMessage === true
  const local = useMoshi((s) => !noted && !!userId && anySaid(s.roomMessages, userId))
  const history = useCatalog((s) => !noted && !!userId && anySaid(s.roomMessages, userId))
  return noted || local || history
}

// ------------------------------------------------------------------ first-visit tips (per device)

/** The main tabs that greet a first visit with one Mochi line. */
export type TipKey = 'rooms' | 'people' | 'chats' | 'me'

const TIPS_KEY = 'moshimoshi-tips-seen'
let tipsSeen: TipKey[] | null = null

function readTips(): TipKey[] {
  if (tipsSeen) return tipsSeen
  let value: TipKey[] = []
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(TIPS_KEY) ?? '[]')
    if (Array.isArray(parsed)) value = parsed.filter((k): k is TipKey => typeof k === 'string')
  } catch {
    // no storage: every tip counts as new for this visit only
  }
  tipsSeen = value
  return value
}

export const tipSeen = (key: TipKey) => readTips().includes(key)

/** Remember that this tab's tip has been shown (it never comes back on this device). */
export function markTipSeen(key: TipKey) {
  const seen = readTips()
  if (seen.includes(key)) return
  tipsSeen = [...seen, key]
  try {
    window.localStorage.setItem(TIPS_KEY, JSON.stringify(tipsSeen))
  } catch {
    // storage blocked: remembered until the page reloads
  }
}
