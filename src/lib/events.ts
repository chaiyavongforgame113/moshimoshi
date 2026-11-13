// Events ("อีเวนต์"): a session whose chat opens at startsAt and closes at endsAt. Pure helpers for
// any screen that shows one: where it is now, how long until it changes, the countdown line, and
// the next week of a weekly event. Times people read are Asia/Bangkok (UTC+7 all year, no DST).
//
// The database holds the same clock (supabase/migrations/20261114000001_room_events.sql): posting
// only while open, the chat hidden 24 hours after the end. These helpers only decide what to show.
import { getLang, L, t, tx, type Txt } from '@/lib/i18n'
import type { EventDraft, EventPhase, Session } from '@/lib/types'

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR
const WEEK = 7 * DAY
const BKK = 7 * HOUR

/** How long an event's chat stays readable after it ends (then it's hidden, as on the server). */
export const EVENT_CHAT_KEEP_MS = DAY

/** The same limits create_event checks on the server. */
export const EVENT_LIMITS = {
  titleMax: 120,
  descriptionMax: 300,
  minDuration: 15,
  maxDuration: 240,
  maxDaysAhead: 60,
  /** lines in an event chat */
  messageMax: 500,
} as const

type Times = Pick<Session, 'startsAt' | 'endsAt'> & { cancelled?: boolean }

const startOf = (s: Times) => Date.parse(s.startsAt)
const endOf = (s: Times) => Date.parse(s.endsAt)

/** upcoming → open → closed (or cancelled, whenever it was called off). */
export function eventPhase(s: Times, now = Date.now()): EventPhase {
  if (s.cancelled) return 'cancelled'
  if (now < startOf(s)) return 'upcoming'
  if (now < endOf(s)) return 'open'
  return 'closed'
}

/** 0 once it has started. */
export const msUntilOpen = (s: Times, now = Date.now()) => Math.max(0, startOf(s) - now)

/** 0 once it has ended. */
export const msUntilClose = (s: Times, now = Date.now()) => Math.max(0, endOf(s) - now)

/** The chat can still be read: until 24 hours after the end (cancelled ones too, if anyone wrote). */
export const eventChatVisible = (s: Times, now = Date.now()) => now < endOf(s) + EVENT_CHAT_KEEP_MS

/**
 * The next moment something about this event changes on screen (it opens, it closes, its chat
 * hides); undefined when nothing will. Hand it to useNow so the page re-renders right then.
 */
export function nextEventChange(s: Times, now = Date.now()): number | undefined {
  if (s.cancelled) return eventChatVisible(s, now) ? endOf(s) + EVENT_CHAT_KEEP_MS : undefined
  return [startOf(s), endOf(s), endOf(s) + EVENT_CHAT_KEEP_MS].find((at) => at > now)
}

/** "1 ชม. 20 นาที" / "1 hr 20 min" (whole minutes, rounded up; days once it's a day or more). */
export function formatSpan(ms: number): string {
  const mins = Math.max(1, Math.ceil(ms / MIN))
  const d = Math.floor(mins / (24 * 60))
  const h = Math.floor((mins % (24 * 60)) / 60)
  const m = mins % 60
  const en = getLang() === 'en'
  if (d > 0) {
    const days = en ? `${d} ${d === 1 ? 'day' : 'days'}` : `${d} วัน`
    return h ? `${days} ${en ? `${h} hr` : `${h} ชม.`}` : days
  }
  const parts: string[] = []
  if (h) parts.push(en ? `${h} hr` : `${h} ชม.`)
  if (m || !h) parts.push(en ? `${m} min` : `${m} นาที`)
  return parts.join(' ')
}

/**
 * The countdown line: "เปิดในอีก 1 ชม. 20 นาที / Opens in 1 hr 20 min", "เหลืออีก 35 นาที / 35 min left",
 * "จบแล้ว / Ended", "ยกเลิกแล้ว / Canceled". Re-render it with useNow (a minute is enough; pass
 * nextEventChange so the phase flips on time). For a screen reader, announce eventPhaseLabel when
 * the phase changes rather than this line every minute.
 */
export function formatCountdown(s: Times, now = Date.now()): string {
  switch (eventPhase(s, now)) {
    case 'upcoming': {
      const span = formatSpan(msUntilOpen(s, now))
      return t(`เปิดในอีก ${span}`, `Opens in ${span}`)
    }
    case 'open': {
      const span = formatSpan(msUntilClose(s, now))
      return t(`เหลืออีก ${span}`, `${span} left`)
    }
    case 'closed':
      return t('จบแล้ว', 'Ended')
    case 'cancelled':
      return t('ยกเลิกแล้ว', 'Canceled')
  }
}

/** Why a line can't go into an event's chat right now (read with tx()); the server's refusals use the same words. */
export const EVENT_REFUSALS: Record<Exclude<EventPhase, 'open'>, Txt> = {
  upcoming: L('อีเวนต์ยังไม่เริ่มนะ รออีกนิดแล้วค่อยมาคุยกัน', "The event hasn't started yet. Hang tight and chat once it opens"),
  closed: L('อีเวนต์จบแล้ว แชทนี้อ่านได้อย่างเดียวนะ', 'This event has ended, so its chat is read-only now'),
  cancelled: L('อีเวนต์นี้ยกเลิกแล้วนะ', 'This event was canceled'),
}

/** One word or two for the phase (badges, aria-live announcements). */
export function eventPhaseLabel(phase: EventPhase): string {
  switch (phase) {
    case 'upcoming':
      return t('ยังไม่เริ่ม', 'Not started yet')
    case 'open':
      return t('เปิดอยู่ตอนนี้', 'Open now')
    case 'closed':
      return t('จบแล้ว', 'Ended')
    case 'cancelled':
      return t('ยกเลิกแล้ว', 'Canceled')
  }
}

// ------------------------------------------------------------------ weekly events

/**
 * When a weekly event comes back next: the first week after `now` (or after this one, if it hasn't
 * ended yet) on the same weekday and time. undefined for a one-off or a cancelled series. The row
 * itself may not exist yet; findNextInSeries finds it once it does (to RSVP to it).
 */
export function nextOccurrence(s: Session, now = Date.now()): { startsAt: string; endsAt: string } | undefined {
  if (!s.repeatsWeekly) return undefined
  const start = startOf(s)
  const length = endOf(s) - start
  const after = Math.max(now, endOf(s))
  const weeks = Math.max(1, Math.ceil((after - start) / WEEK))
  const next = start + weeks * WEEK
  return { startsAt: new Date(next).toISOString(), endsAt: new Date(next + length).toISOString() }
}

/** The next session of the same weekly series that isn't cancelled (from a list such as useEvents()). */
export function findNextInSeries(s: Session, sessions: Session[]): Session | undefined {
  if (!s.seriesId) return undefined
  const start = startOf(s)
  return sessions
    .filter((x) => x.seriesId === s.seriesId && x.id !== s.id && !x.cancelled && startOf(x) > start)
    .sort((a, b) => startOf(a) - startOf(b))[0]
}

/**
 * What comes after this week of a weekly event: `next`, the next week that's on (a row to RSVP
 * to). Without one, `later`: when it comes back (its row isn't made yet), past `skipped`, the weeks
 * after this one that were called off (soonest first). Nothing for a one-off.
 */
export function nextRound(
  s: Session,
  sessions: Session[],
  now = Date.now(),
): { next?: Session; later?: { startsAt: string; endsAt: string }; skipped: Session[] } {
  const next = findNextInSeries(s, sessions)
  if (next || !s.seriesId) return { next, skipped: [] }
  const start = startOf(s)
  const skipped = sessions
    .filter((x) => x.seriesId === s.seriesId && x.id !== s.id && x.cancelled && startOf(x) > start)
    .sort((a, b) => startOf(a) - startOf(b))
  const last = skipped[skipped.length - 1]
  return { later: nextOccurrence(s, last ? Math.max(now, endOf(last)) : now), skipped }
}

// ------------------------------------------------------------------ labels (Bangkok time)

const TH_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์']
const EN_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const pad = (n: number) => String(n).padStart(2, '0')
const bkkDay = (ms: number) => Math.floor((ms + BKK) / DAY)

/** "วันนี้ 21:00", "พรุ่งนี้ 21:00", "ศุกร์ 21:00", "21 พ.ย. 21:00" (English: Today / Tomorrow / Fri / Nov 21). */
export function eventWhenLabel(iso: string, now = Date.now()): string {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return ''
  const wall = new Date(ms + BKK)
  const time = `${pad(wall.getUTCHours())}:${pad(wall.getUTCMinutes())}`
  const days = bkkDay(ms) - bkkDay(now)
  const en = getLang() === 'en'
  if (days === 0) return en ? `Today ${time}` : `วันนี้ ${time}`
  if (days === 1) return en ? `Tomorrow ${time}` : `พรุ่งนี้ ${time}`
  if (days === -1) return en ? `Yesterday ${time}` : `เมื่อวาน ${time}`
  if (days > 1 && days < 7) return en ? `${EN_DAYS[wall.getUTCDay()]} ${time}` : `${TH_DAYS[wall.getUTCDay()]} ${time}`
  return en
    ? `${EN_MONTHS[wall.getUTCMonth()]} ${wall.getUTCDate()}, ${time}`
    : `${wall.getUTCDate()} ${TH_MONTHS[wall.getUTCMonth()]} ${time}`
}

// ------------------------------------------------------------------ the create wizard

/** Which answer create_event would refuse (undefined: fine). The same rules the server checks. */
export type EventDraftIssue = 'title' | 'description' | 'duration' | 'startsAt'

export function checkEventDraft(d: EventDraft, now = Date.now()): EventDraftIssue | undefined {
  const title = d.title.trim()
  if (!title || title.length > EVENT_LIMITS.titleMax) return 'title'
  if ((d.description?.trim().length ?? 0) > EVENT_LIMITS.descriptionMax) return 'description'
  if (!Number.isInteger(d.durationMin) || d.durationMin < EVENT_LIMITS.minDuration || d.durationMin > EVENT_LIMITS.maxDuration) return 'duration'
  const start = Date.parse(d.startsAt)
  // the server allows 5 minutes of slack for phone clocks; ask for "now" or later here
  if (Number.isNaN(start) || start < now - 60_000 || start > now + EVENT_LIMITS.maxDaysAhead * DAY) return 'startsAt'
  return undefined
}

/** The friendly line for each issue (also what the server's refusals show). */
export const EVENT_DRAFT_ISSUES: Record<EventDraftIssue, Txt> = {
  title: L(`ตั้งชื่ออีเวนต์ก่อนนะ (ไม่เกิน ${EVENT_LIMITS.titleMax} ตัวอักษร)`, `Give the event a name (up to ${EVENT_LIMITS.titleMax} characters)`),
  description: L(
    `คำอธิบายยาวไปนิด ไม่เกิน ${EVENT_LIMITS.descriptionMax} ตัวอักษรนะ`,
    `The description is a little long. Keep it to ${EVENT_LIMITS.descriptionMax} characters`,
  ),
  duration: L('อีเวนต์ยาวได้ 15 นาทีถึง 4 ชั่วโมงนะ', 'Events can run from 15 minutes to 4 hours'),
  startsAt: L('เลือกเวลาตั้งแต่ตอนนี้ไปจนถึงอีก 60 วันนะ', 'Pick a time between now and 60 days from now'),
}

/** The friendly line for an issue (the wizard shows it under the question). */
export const eventDraftIssueText = (issue: EventDraftIssue): string => tx(EVENT_DRAFT_ISSUES[issue])
