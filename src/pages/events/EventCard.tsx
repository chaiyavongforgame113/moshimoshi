// The event card every screen shares: room, title, where it is now (a live countdown), who's
// going, and one button for that moment (ไปด้วย → เข้าห้องเลย → ดูแชท).
import { motion, useReducedMotion } from 'motion/react'
import { CalendarClock, CalendarX, DoorOpen, Hourglass, MessagesSquare, Radio, Repeat } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { TiltCard, TiltGlare } from '@/components/motion'
import { ButtonLink, RoomIcon } from '@/components/ui'
import { useEventAttendees, useRoom } from '@/data/hooks'
import { MOCHI } from '@/lib/colors'
import { eventChatVisible, eventPhase, eventPhaseLabel, eventWhenLabel, formatCountdown } from '@/lib/events'
import { t } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import { useMoshi } from '@/lib/store'
import type { EventPhase, Session, User } from '@/lib/types'
import { AvatarStack, type StackPerson } from '@/pages/rooms/bits'
import { durationLabel, eventPath, useEventHref, useEventsNow } from './lib'
import { RsvpButton, useRsvp } from './Rsvp'

// the whole card opens the event through its stretched title link; buttons sit above it (z-10)
const stretched = "outline-none after:absolute after:inset-0 after:z-[5] after:rounded-[inherit] after:content-['']"
const focusRing = 'has-[a:focus-visible]:outline-3 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-lavender'

/** Pulsing "on air" dot for an open event (still under reduced motion). */
export function OpenDot({ className = '' }: { className?: string }) {
  return (
    <span className={`relative inline-flex size-2.5 shrink-0 ${className}`} aria-hidden>
      <span className="absolute inset-0 rounded-full bg-success/50 motion-safe:animate-ping" />
      <span className="relative inline-flex size-2.5 rounded-full bg-success" />
    </span>
  )
}

/**
 * Where the event is now, with its countdown: "เปิดในอีก 1 ชม. 20 นาที", "เปิดอยู่ · เหลืออีก 35 นาที",
 * "จบแล้ว", "ยกเลิกแล้ว". Re-render it with useEventsNow (the minute ticks and the phase flips).
 * `countdown={false}` before it opens: just "ยังไม่เริ่ม" (a screen with its own big countdown).
 */
export function PhaseBadge({
  session,
  now,
  size = 'sm',
  countdown = true,
  className = '',
}: {
  session: Session
  now: number
  size?: 'sm' | 'md'
  countdown?: boolean
  className?: string
}) {
  const phase = eventPhase(session, now)
  const line = !countdown && phase === 'upcoming' ? eventPhaseLabel(phase) : formatCountdown(session, now)
  const box = size === 'md' ? 'min-h-9 px-3.5 text-sm gap-2' : 'min-h-7 px-2.5 text-xs gap-1.5'
  const look: Record<EventPhase, string> = {
    open: 'bg-mint text-ink shadow-[inset_0_-2px_0_rgb(59_38_34/0.12)]',
    upcoming: 'bg-lavender/35 text-ink',
    closed: 'bg-cream-3 text-ink-soft',
    cancelled: 'bg-cream-3 text-ink-soft',
  }
  const icon =
    phase === 'open' ? (
      <OpenDot />
    ) : phase === 'upcoming' ? (
      <Hourglass size={size === 'md' ? 15 : 13} strokeWidth={2.4} aria-hidden className="shrink-0" />
    ) : phase === 'cancelled' ? (
      <CalendarX size={size === 'md' ? 15 : 13} strokeWidth={2.4} aria-hidden className="shrink-0" />
    ) : null
  return (
    <span className={`inline-flex max-w-full items-center rounded-full py-1 font-display leading-tight font-semibold ${box} ${look[phase]} ${className}`}>
      {icon}
      <span className="min-w-0 [overflow-wrap:anywhere]">{phase === 'open' ? t(`เปิดอยู่ · ${line}`, `Open · ${line}`) : line}</span>
    </span>
  )
}

/** People going (me first when I am), for an AvatarStack. */
function crowdOf(attendees: User[], myId: string): StackPerson[] {
  return attendees.map((u) => ({ id: u.id, color: u.color, face: u.id === myId ? ('happy' as const) : undefined }))
}

/** "12 คนจะไป", or "มาด้วยกัน 12 คน" once it's over. */
function countLine(count: number, phase: EventPhase): string {
  if (phase === 'closed') return t(`มาด้วยกัน ${count} คน`, `${count} came`)
  if (phase === 'open') return t(`${count} คนมาแล้ว`, `${count} here`)
  return t(`${count} คนจะไป`, `${count} going`)
}

/**
 * The one button for this moment, or nothing (a cancelled event, a chat that's hidden now). Quiet
 * looks on purpose: cards sit in lists and on home, next to the screen's own main button.
 */
function ActionFor({
  session,
  phase,
  now,
  going,
  onRsvp,
  href,
}: {
  session: Session
  phase: EventPhase
  now: number
  going: boolean
  onRsvp: () => void
  href: string
}) {
  if (phase === 'upcoming') return <RsvpButton session={session} going={going} onToggle={onRsvp} quiet />
  if (phase === 'open')
    return (
      <ButtonLink to={href} variant="secondary" size="sm" icon={<DoorOpen size={17} strokeWidth={2.4} aria-hidden />} className="relative z-10 h-11 shrink-0">
        {t('เข้าห้องเลย', 'Go in now')}
        <span className="sr-only">{t(` ${session.title}`, `: ${session.title}`)}</span>
      </ButtonLink>
    )
  if (phase === 'closed' && eventChatVisible(session, now))
    return (
      <ButtonLink to={eventPath(session.id)} variant="secondary" size="sm" icon={<MessagesSquare size={16} strokeWidth={2.4} aria-hidden />} className="relative z-10 h-11 shrink-0">
        {t('ดูแชท', 'See the chat')}
        <span className="sr-only">{t(` ${session.title}`, `: ${session.title}`)}</span>
      </ButtonLink>
    )
  return null
}

/**
 * One event. `card` (lists, home): room, title, time, countdown, who's going and the button.
 * `compact` (pinned in a room, "รอบหน้า"): one row. `eyebrow` replaces the small line above the title.
 */
export function EventCard({
  session,
  variant = 'card',
  showRoom = true,
  eyebrow,
  index = 0,
}: {
  session: Session
  variant?: 'card' | 'compact'
  showRoom?: boolean
  eyebrow?: ReactNode
  /** place in a list (a small stagger as cards appear) */
  index?: number
}) {
  const now = useEventsNow([session])
  const phase = eventPhase(session, now)
  const room = useRoom(session.roomId)
  const attendees = useEventAttendees(session.id)
  const myId = useMoshi((s) => s.me.id)
  const rsvp = useRsvp()
  const going = rsvp.isGoing(session.id)
  const count = session.going + (going ? 1 : 0)
  const reduce = useReducedMotion()
  const p = MOCHI[room?.color ?? 'lavender']
  const muted = phase === 'cancelled' || phase === 'closed'
  const when = `${eventWhenLabel(session.startsAt, now)} · ${durationLabel(session.durationMin)}`
  const href = useEventHref()(session, now)
  const action = <ActionFor session={session} phase={phase} now={now} going={going} onRsvp={() => rsvp.toggle(session)} href={href} />
  const title = (
    <Link to={href} className={stretched}>
      {session.title}
    </Link>
  )

  if (variant === 'compact') {
    return (
      <article
        className={`relative isolate flex flex-wrap items-center gap-x-3 gap-y-2 overflow-hidden rounded-[1.75rem] border bg-white p-3 pl-3.5 shadow-[var(--shadow-soft)] ${focusRing}`}
        style={{ borderColor: p.base }}
      >
        <span aria-hidden className="pointer-events-none absolute -top-12 -left-10 -z-10 size-32 rounded-full opacity-60 blur-2xl" style={{ background: p.base }} />
        <span
          aria-hidden
          className="relative flex size-11 shrink-0 items-center justify-center rounded-2xl"
          style={{ background: phase === 'open' ? MOCHI.mint.base : p.light, color: phase === 'open' ? MOCHI.mint.ink : p.ink }}
        >
          {phase === 'open' ? <Radio size={21} strokeWidth={2.4} /> : <CalendarClock size={21} strokeWidth={2.4} />}
          {phase === 'open' && <OpenDot className="absolute -top-0.5 -right-0.5" />}
        </span>
        <div className="min-w-0 flex-[1_1_10rem]">
          {eyebrow && <p className="text-xs font-semibold text-ink-soft">{eyebrow}</p>}
          <h3 className="line-clamp-2 font-display text-[15px] leading-snug font-semibold [overflow-wrap:anywhere] text-ink">{title}</h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-soft">
            <PhaseBadge session={session} now={now} />
            {phase === 'upcoming' && <span>{eventWhenLabel(session.startsAt, now)}</span>}
            {count > 0 && <span>{countLine(count, phase)}</span>}
          </p>
        </div>
        {action && <span className="ml-auto flex shrink-0">{action}</span>}
        {rsvp.sheet}
      </article>
    )
  }

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring.soft, delay: Math.min(index, 4) * 0.05 }}
      className="h-full"
    >
      <TiltCard className="h-full" max={5} glare={false}>
        <article className={`card group relative isolate flex h-full flex-col overflow-hidden p-4 ${focusRing} ${muted ? 'bg-cream-2/60' : ''}`}>
          <TiltGlare />
          {/* soft room-coloured glow in the corner */}
          <span aria-hidden className="pointer-events-none absolute -top-14 -right-12 -z-10 size-40 rounded-full opacity-60 blur-2xl transition-transform duration-500 group-hover:scale-110" style={{ background: p.base }} />

          <div className="flex items-start gap-3">
            {showRoom && room && <RoomIcon room={room} size={46} />}
            <div className="min-w-0 flex-1">
              {eyebrow ? (
                <p className="text-xs font-semibold text-ink-soft">{eyebrow}</p>
              ) : (
                showRoom && room && <p className="truncate text-xs font-semibold text-ink-soft">{room.name}</p>
              )}
              <h3 className={`line-clamp-2 font-display text-[17px] leading-snug font-semibold [overflow-wrap:anywhere] ${muted ? 'text-ink-soft' : 'text-ink'}`}>{title}</h3>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm text-ink-soft">
                <span>{when}</span>
                {session.repeatsWeekly && (
                  <span className="inline-flex items-center gap-1">
                    · <Repeat size={13} strokeWidth={2.4} aria-hidden /> {t('ทุกสัปดาห์', 'Weekly')}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="mt-3">
            <PhaseBadge session={session} now={now} />
          </div>

          <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-3 pt-4">
            <span className="flex min-w-0 flex-[1_1_7rem] items-center gap-2">
              {attendees.length > 0 && <AvatarStack people={crowdOf(attendees, myId)} size={28} max={4} className="shrink-0" />}
              <span className="min-w-0 text-sm font-semibold text-ink">{count > 0 ? countLine(count, phase) : phase === 'upcoming' ? t('เป็นคนแรกที่ไปไหม', 'Be the first to go') : ''}</span>
            </span>
            {action && <span className="ml-auto flex shrink-0">{action}</span>}
          </div>
        </article>
      </TiltCard>
      {rsvp.sheet}
    </motion.div>
  )
}
