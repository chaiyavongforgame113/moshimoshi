import { CalendarClock, DoorOpen, Radio } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Avatar, ButtonLink, ReasonIcon, RoomIcon, SignalMeter } from '@/components/ui'
import { useChats, usePerson, useRoom, useSessions, useWavelengthMatches } from '@/data/hooks'
import { MOCHI } from '@/lib/colors'
import { eventPhase, eventWhenLabel, formatCountdown } from '@/lib/events'
import { t } from '@/lib/i18n'
import { markFirstEventDone, markWavelengthExplored, useProgress } from '@/lib/progress'
import { useMoshi } from '@/lib/store'
import type { MatchResult, MochiColor, Session } from '@/lib/types'
import { liveOrSoon, useEventHref, useEventsNow } from '@/pages/events/lib'
import { RsvpButton } from '@/pages/events/Rsvp'
import { roomLabel } from './greeting'

export type Next =
  | { kind: 'wavelength'; match?: MatchResult }
  | { kind: 'event'; session?: Session }

/** After the tutorial, suggest one Wavelength visit and one event. */
export function useNextStep(userId: string): Next | null {
  const progress = useProgress(userId)
  const matches = useWavelengthMatches()
  const chats = useChats()
  const sessions = useSessions()
  const now = useEventsNow(sessions)
  const going = useMoshi((s) => s.going)
  const rooms = useMoshi((s) => s.me.rooms)

  if (!progress.wavelengthExplored) {
    const chattedWith = new Set(chats.map((chat) => chat.withUserId))
    return { kind: 'wavelength', match: matches.find((match) => !chattedWith.has(match.userId)) }
  }
  if (progress.firstEventDone || going.length > 0) return null

  const available = liveOrSoon(sessions, now)
  const session = available.find((event) => eventPhase(event, now) === 'open' && rooms.includes(event.roomId))
    ?? available.find((event) => eventPhase(event, now) === 'upcoming')
    ?? available[0]
  return { kind: 'event', session }
}

export function NextStep({ next, userId }: { next: Next; userId: string }) {
  if (next.kind === 'wavelength') return <WavelengthCard match={next.match} onExplore={() => markWavelengthExplored(userId)} />
  if (next.session) return <EventCard session={next.session} onDone={() => markFirstEventDone(userId)} />
  return (
    <Card
      color="lavender"
      eyebrow={t('ขั้นที่ 2 จาก 2 · อีเวนต์', '2 of 2 · Event')}
      visual={<Avatar color="lavender" size={48} face="happy" />}
      title={t('ยังไม่มีอีเวนต์เร็วๆ นี้', 'No events coming up yet')}
      actions={<ButtonLink to="/app/rooms?tab=events">{t('ดูอีเวนต์', 'Browse events')}</ButtonLink>}
    />
  )
}

function Card({
  eyebrow,
  color,
  visual,
  title,
  line,
  children,
  actions,
}: {
  eyebrow: ReactNode
  color: MochiColor
  visual: ReactNode
  title: ReactNode
  line?: ReactNode
  children?: ReactNode
  actions: ReactNode
}) {
  const p = MOCHI[color]
  return (
    <article className="card relative overflow-hidden p-4 sm:p-5">
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-24" style={{ background: `linear-gradient(180deg, ${p.light}, transparent)` }} />
      <p className="relative flex flex-wrap items-center gap-2 text-xs font-semibold text-ink-soft">{eyebrow}</p>
      <div className="relative mt-2 flex items-center gap-3">
        <span className="shrink-0">{visual}</span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xl leading-snug font-semibold break-words text-ink">{title}</h3>
          {line && <p className="text-sm text-ink-soft">{line}</p>}
        </div>
      </div>
      {children && <div className="relative mt-3">{children}</div>}
      <div className="relative mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">{actions}</div>
    </article>
  )
}


function WavelengthCard({ match, onExplore }: { match?: MatchResult; onExplore: () => void }) {
  const person = usePerson(match?.userId)
  const reason = match?.reasons[0]
  return (
    <Card
      color={person?.color ?? 'pink'}
      eyebrow={t('ขั้นที่ 1 จาก 2 · คลื่นเดียวกัน', '1 of 2 · Wavelength')}
      visual={<Avatar color={person?.color ?? 'pink'} size={48} face="happy" online={person?.isOnline} />}
      title={person ? t(`รู้จัก ${person.name} กันไหม`, `Meet ${person.name}`) : t('ไปหาคนคลื่นเดียวกัน', 'Find people on your wavelength')}
      line={person ? t('คนที่คลื่นตรงกับเรา', 'Someone on your wavelength') : undefined}
      actions={
        <ButtonLink to={person ? `/app/people/${person.id}` : '/app/people'} onClick={onExplore} icon={<Radio size={18} aria-hidden />}>
          {person ? t('ดูโปรไฟล์', 'View profile') : t('ดูคนคลื่นเดียวกัน', 'Explore Wavelength')}
        </ButtonLink>
      }
    >
      {person && match && <SignalMeter level={match.level} size="sm" />}
      {person && reason && (
        <p className="mt-2 flex items-start gap-2 text-sm text-ink">
          <ReasonIcon kind={reason.kind} />
          <span className="min-w-0 break-words">{reason.text}</span>
        </p>
      )}
    </Card>
  )
}

function EventCard({ session, onDone }: { session: Session; onDone: () => void }) {
  const room = useRoom(session.roomId)
  const now = useEventsNow([session])
  const open = eventPhase(session, now) === 'open'
  const href = useEventHref()(session, now)
  return (
    <Card
      color={room?.color ?? 'lavender'}
      eyebrow={<><CalendarClock size={14} aria-hidden />{t('ขั้นที่ 2 จาก 2 · อีเวนต์', '2 of 2 · Event')}</>}
      visual={room ? <RoomIcon room={room} size={48} /> : <Avatar color="lavender" size={48} face="happy" />}
      title={<Link to={href} onClick={open ? onDone : undefined} className="rounded-md hover:underline">{session.title}</Link>}
      line={
        <>
          {open ? formatCountdown(session, now) : eventWhenLabel(session.startsAt, now)}
          {room && ` · ${roomLabel(room.name)}`}
        </>
      }
      actions={
        open ? (
          <ButtonLink to={href} onClick={onDone} icon={<DoorOpen size={18} aria-hidden />}>
            {t('เข้าห้องเลย', 'Go in now')}
          </ButtonLink>
        ) : (
          <>
            <RsvpButton
              session={session}
              going={false}
              onToggle={async () => {
                const state = useMoshi.getState()
                if (!state.going.includes(session.id) && await state.toggleGoing(session.id)) onDone()
              }}
            />
            <ButtonLink to={href} variant="ghost">{t('ดูอีเวนต์', 'See the event')}</ButtonLink>
          </>
        )
      }
    />
  )
}
