// Screen-side helpers for events: one clock that flips exactly when an event opens or closes,
// how lists split events by phase, and which event a room puts forward.
import { useState } from 'react'
import { useServerFeatures } from '@/data/hooks'
import { eventChatVisible, eventPhase, nextEventChange } from '@/lib/events'
import { getLang } from '@/lib/i18n'
import { useNow } from '@/lib/hooks'
import type { Session } from '@/lib/types'

type Times = Pick<Session, 'startsAt' | 'endsAt'> & { cancelled?: boolean }

const DAY = 86_400_000
const BKK = 7 * 3_600_000
/** Bangkok calendar day of a moment */
const bkkDay = (ms: number) => Math.floor((ms + BKK) / DAY)

/** How far ahead home and the room pin look for an upcoming event. */
export const SOON_MS = DAY

/**
 * The current time for screens showing these events: a re-render every `intervalMs` (countdown
 * minutes) and right at the next moment any of them opens, closes or hides its chat.
 */
export function useEventsNow(sessions: readonly Times[], intervalMs: number | null = 60_000): number {
  const [at, setAt] = useState<number | undefined>(undefined)
  const now = useNow(intervalMs, at)
  let next: number | undefined
  for (const s of sessions) {
    const n = nextEventChange(s, now)
    if (n !== undefined && (next === undefined || n < next)) next = n
  }
  // remembered for the next render's timer (the "adjust state while rendering" pattern)
  if (next !== at) setAt(next)
  return now
}

const startOf = (s: Session) => Date.parse(s.startsAt)

/** Open first (ending soonest first), then upcoming by start. */
export function bySoonest(now: number) {
  return (a: Session, b: Session) => {
    const pa = eventPhase(a, now) === 'open' ? 0 : 1
    const pb = eventPhase(b, now) === 'open' ? 0 : 1
    return pa - pb || startOf(a) - startOf(b)
  }
}

export interface EventGroups {
  open: Session[]
  /** not started yet; cancelled ones only when I was going (so I see it was called off) */
  upcoming: Session[]
  /** finished (or called off) today, Bangkok time, newest first */
  endedToday: Session[]
}

/** Split events for a list ("เปิดอยู่ตอนนี้", "กำลังจะเปิด", "จบแล้ววันนี้"). */
export function groupEvents(sessions: readonly Session[], now: number, going: readonly string[]): EventGroups {
  const open: Session[] = []
  const upcoming: Session[] = []
  const endedToday: Session[] = []
  const today = bkkDay(now)
  for (const s of sessions) {
    const phase = eventPhase(s, now)
    if (phase === 'open') open.push(s)
    else if (phase === 'upcoming') upcoming.push(s)
    else if (phase === 'cancelled') {
      if (startOf(s) > now) {
        if (going.includes(s.id)) upcoming.push(s)
      } else if (bkkDay(startOf(s)) === today) endedToday.push(s)
    } else if (bkkDay(Date.parse(s.endsAt)) === today && eventChatVisible(s, now)) endedToday.push(s)
  }
  open.sort((a, b) => Date.parse(a.endsAt) - Date.parse(b.endsAt))
  upcoming.sort((a, b) => startOf(a) - startOf(b))
  endedToday.sort((a, b) => Date.parse(b.endsAt) - Date.parse(a.endsAt))
  return { open, upcoming, endedToday }
}

/** Events worth showing now: open, or starting within `ahead` (never cancelled), soonest first. */
export function liveOrSoon(sessions: readonly Session[], now: number, ahead = Infinity): Session[] {
  return sessions
    .filter((s) => {
      const phase = eventPhase(s, now)
      return phase === 'open' || (phase === 'upcoming' && startOf(s) - now <= ahead)
    })
    .sort(bySoonest(now))
}

/** The open event of each room (the one ending last, if a room has two). */
export function openByRoom(sessions: readonly Session[], now: number): Map<string, Session> {
  const out = new Map<string, Session>()
  for (const s of sessions) {
    if (eventPhase(s, now) !== 'open') continue
    const had = out.get(s.roomId)
    if (!had || Date.parse(s.endsAt) > Date.parse(had.endsAt)) out.set(s.roomId, s)
  }
  return out
}

/** "30 นาที", "1 ชม.", "1 ชม. 30 นาที" for a duration in minutes. */
export function durationLabel(min: number): string {
  const en = getLang() === 'en'
  const h = Math.floor(min / 60)
  const m = min % 60
  if (en) return [h ? `${h} hr` : '', m ? `${m} min` : ''].filter(Boolean).join(' ')
  return [h ? `${h} ชม.` : '', m ? `${m} นาที` : ''].filter(Boolean).join(' ')
}

/** Where an event lives in the app. */
export const eventPath = (id: string) => `/app/events/${id}`

/**
 * Where a link into an event goes: its page. While the database has no event chats yet
 * (useServerFeatures().events off), an open event's link goes to its room's chat instead, as
 * before events: its page would only say "แชทอีเวนต์กำลังจะมาเร็วๆ นี้" and point there.
 */
export function useEventHref(): (s: Session, now?: number) => string {
  const chats = useServerFeatures().events
  return (s, now = Date.now()) => (!chats && eventPhase(s, now) === 'open' ? `/app/rooms/${s.roomId}` : eventPath(s.id))
}
