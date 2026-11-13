import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { CalendarClock, CalendarX, ChevronLeft, DoorOpen, Hourglass, PartyPopper, Repeat, RotateCw, Settings2, Users } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { MochiStage, View3D } from '@/components/three'
import { Avatar, Button, ButtonLink, IconButton, RoomIcon, ShowMore, Zone } from '@/components/ui'
import {
  retrySessionLoad,
  useCanManageEvents,
  useEventAttendees,
  useEvents,
  usePerson,
  useRoom,
  useServerFeatures,
  useSession,
  useSessionStatus,
} from '@/data/hooks'
import { MOCHI } from '@/lib/colors'
import { eventPhase, eventWhenLabel, findNextInSeries, formatCountdown, nextRound } from '@/lib/events'
import { useNow } from '@/lib/hooks'
import { displayName, t } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import { useMoshi } from '@/lib/store'
import type { EventPhase, MochiColor, Room, Session, User } from '@/lib/types'
import { PageSkeleton } from '@/pages/people/Skeleton'
import { AvatarStack } from '@/pages/rooms/bits'
import { EventCard, OpenDot, PhaseBadge } from './EventCard'
import { EventChat, Note } from './EventChat'
import { durationLabel, useEventsNow } from './lib'
import { ManageEventSheet, manageOptions } from './ManageEvent'
import { RsvpButton, useRsvp } from './Rsvp'

const MIN = 60_000
const HOUR = 60 * MIN

/**
 * /app/events/:sessionId: one event through its whole life. Before: a big countdown with Little
 * Mochi, "ไปด้วย" and who's going. While open: the event's chat. After: the thread (read-only,
 * then hidden 24 hours on), a thank-you and next week's round. Cancelled: a gentle note.
 * The page switches by itself right at the start and end times.
 */
export default function EventPage() {
  const { sessionId } = useParams()
  const session = useSession(sessionId)
  const status = useSessionStatus(sessionId)
  if (session) return <EventView key={session.id} session={session} />
  if (status === 'failed' && sessionId) return <EventLoadFailed sessionId={sessionId} />
  return status === 'loading' ? <PageSkeleton label={t('กำลังเปิดอีเวนต์…', 'Opening the event…')} /> : <EventNotFound />
}

function EventView({ session }: { session: Session }) {
  const now = useEventsNow([session])
  const phase = eventPhase(session, now)
  const room = useRoom(session.roomId)
  const tone: MochiColor = room?.color ?? 'lavender'

  return (
    <div className="pb-6">
      <TopBar session={session} room={room} phase={phase} now={now} />
      <PhaseAnnouncer phase={phase} />
      <Hero session={session} room={room} now={now} />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={phase}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8, transition: { duration: 0.14 } }}
          transition={spring.soft}
        >
          {phase === 'upcoming' && <Upcoming session={session} tone={tone} />}
          {phase === 'open' && <EventChat session={session} room={room} phase={phase} now={now} />}
          {phase === 'closed' && <Closed session={session} room={room} now={now} />}
          {phase === 'cancelled' && <Cancelled session={session} room={room} now={now} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// ------------------------------------------------------------------ header

function goBack(navigate: ReturnType<typeof useNavigate>, fallback: string) {
  const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
  if (idx > 0) navigate(-1)
  else navigate(fallback)
}

/** Back, the room it's in, and (while open) the time left, always in view. */
function TopBar({ session, room, phase, now }: { session: Session; room?: Room; phase: EventPhase; now: number }) {
  const navigate = useNavigate()
  return (
    <div className="safe-top sticky top-0 z-30 -mx-4 mb-3 flex items-center gap-3 bg-cream/80 px-4 pb-2 backdrop-blur-xl lg:mx-0 lg:rounded-b-3xl lg:px-2 lg:pt-6">
      <IconButton label={t('ย้อนกลับ', 'Back')} onClick={() => goBack(navigate, room ? `/app/rooms/${room.id}` : '/app/rooms?tab=events')}>
        <ChevronLeft size={22} />
      </IconButton>
      {room && (
        <Link to={`/app/rooms/${room.id}`} className="flex min-w-0 items-center gap-2 rounded-full pr-2" aria-label={t(`ไปที่ห้อง${room.name}`, `Go to ${room.name}`)}>
          <RoomIcon room={room} size={34} />
          <span className="truncate font-display font-semibold text-ink">{room.name}</span>
        </Link>
      )}
      {phase === 'open' && (
        <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full bg-mint px-3 py-1.5 font-display text-xs font-semibold text-ink shadow-[inset_0_-2px_0_rgb(59_38_34/0.12)]">
          <OpenDot />
          {formatCountdown(session, now)}
        </span>
      )}
    </div>
  )
}

/** Says out loud when the event opens, ends or is called off while the page is open (not every minute). */
function PhaseAnnouncer({ phase }: { phase: EventPhase }) {
  const first = useRef(phase)
  const [said, setSaid] = useState('')
  useEffect(() => {
    if (phase === first.current) return
    first.current = phase
    setSaid(
      phase === 'open'
        ? t('อีเวนต์เปิดแล้ว คุยกันได้เลย', 'The event is open. Start chatting')
        : phase === 'closed'
          ? t('อีเวนต์จบแล้ว แชทอ่านได้อย่างเดียว', 'The event has ended. The chat is read-only now')
          : phase === 'cancelled'
            ? t('อีเวนต์นี้ยกเลิกแล้ว', 'This event was canceled')
            : '',
    )
  }, [phase])
  return (
    <p className="sr-only" aria-live="polite">
      {said}
    </p>
  )
}

function Hero({ session, room, now }: { session: Session; room?: Room; now: number }) {
  // before it opens the big countdown below has the time left (to the second); the badge just says "ยังไม่เริ่ม"
  const upcoming = eventPhase(session, now) === 'upcoming'
  const features = useServerFeatures()
  const canManage = useCanManageEvents(session.roomId)
  const host = usePerson(session.hostId)
  const [managing, setManaging] = useState(false)
  const p = MOCHI[room?.color ?? 'lavender']
  const can = manageOptions(session, now)
  const hostName = host?.name ?? session.hostName
  return (
    <section aria-labelledby="event-title" className="relative overflow-hidden rounded-[2rem] border border-white bg-white/85 p-5 shadow-[var(--shadow-lift)] sm:p-6">
      <span aria-hidden className="pointer-events-none absolute -top-20 -right-16 size-56 rounded-full opacity-70 blur-3xl" style={{ background: p.base }} />
      <span aria-hidden className="pointer-events-none absolute -bottom-24 -left-16 size-48 rounded-full opacity-40 blur-3xl" style={{ background: MOCHI.butter.base }} />
      <div className="relative flex flex-wrap items-center justify-between gap-2">
        <PhaseBadge session={session} now={now} size="md" countdown={!upcoming} />
        {canManage && features.events && (can.cancel || can.stop) && (
          <button
            type="button"
            onClick={() => setManaging(true)}
            aria-haspopup="dialog"
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <Settings2 size={16} strokeWidth={2.4} aria-hidden />
            {t('จัดการ', 'Manage')}
          </button>
        )}
      </div>
      <h1 id="event-title" className="relative mt-3 font-display text-2xl leading-snug font-semibold text-balance [overflow-wrap:anywhere] text-ink sm:text-3xl">
        {session.title}
      </h1>
      {session.description && <p className="relative mt-2 text-[15px] leading-relaxed whitespace-pre-line [overflow-wrap:anywhere] text-ink-soft">{session.description}</p>}
      <ul className="relative mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-ink">
        <li className="inline-flex items-center gap-1.5">
          <CalendarClock size={16} strokeWidth={2.4} aria-hidden className="shrink-0" />
          {eventWhenLabel(session.startsAt, now)} · {durationLabel(session.durationMin)}
        </li>
        {session.repeatsWeekly && (
          <li className="inline-flex items-center gap-1.5">
            <Repeat size={16} strokeWidth={2.4} aria-hidden className="shrink-0" />
            {t('ทุกสัปดาห์', 'Every week')}
          </li>
        )}
        {hostName && (
          <li className="inline-flex min-w-0 items-center gap-1.5">
            {host ? <Avatar color={host.color} size={22} ring face="happy" /> : <Users size={16} strokeWidth={2.4} aria-hidden />}
            <span className="min-w-0 truncate">{t(`ชวนคุยโดย ${hostName}`, `Hosted by ${hostName}`)}</span>
          </li>
        )}
      </ul>
      <ManageEventSheet session={managing ? session : null} onClose={() => setManaging(false)} />
    </section>
  )
}

// ------------------------------------------------------------------ before it opens

function Upcoming({ session, tone }: { session: Session; tone: MochiColor }) {
  const rsvp = useRsvp()
  const going = rsvp.isGoing(session.id)
  return (
    <>
      {/* see-through tray: the mascot's 3D is drawn behind the page, so nothing opaque may sit over it */}
      <Zone tone={tone} className="mt-5 bg-transparent" icon={<Hourglass size={18} strokeWidth={2.4} />} title={t('อีกนิดเดียวก็เปิดแล้ว', 'Opening soon')}>
        <div className="grid items-center gap-4 sm:grid-cols-[11rem_minmax(0,1fr)]">
          <View3D
            className="mx-auto h-36 w-40 sm:h-44 sm:w-44"
            label={t('น้องโมชิ รอเปิดอีเวนต์อย่างตื่นเต้น', 'Little Mochi, excited for the event to start')}
          >
            <MochiStage color={tone} expression={going ? 'happy' : 'wow'} zoom={0.92} deco />
          </View3D>
          <div className="min-w-0 text-center sm:text-left">
            <Countdown session={session} />
            <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-ink-soft">
              <DoorOpen size={16} strokeWidth={2.4} aria-hidden className="shrink-0" />
              {t('ห้องจะเปิดเองตอนถึงเวลา', 'The room opens by itself when it’s time')}
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <RsvpButton session={session} going={going} onToggle={() => rsvp.toggle(session)} size="lg" className="w-full sm:w-auto" />
          <p className="text-center text-sm text-ink-soft sm:text-left" aria-live="polite">
            {going
              ? t('ไว้เจอกันนะ! ถึงเวลาแล้วกลับมาที่หน้านี้ได้เลย', 'See you there! Come back to this page when it starts')
              : t('กดไปด้วยไว้ จะได้รู้ว่ามีใครรออยู่บ้าง', "Tap I'm going so others know you'll be there")}
          </p>
        </div>
        {rsvp.sheet}
      </Zone>
      <WhoIsGoing session={session} />
    </>
  )
}

/** Big friendly tiles: days / hours / minutes, and seconds in the last hour. */
function Countdown({ session }: { session: Session }) {
  const reduce = useReducedMotion()
  const start = Date.parse(session.startsAt)
  const [fast, setFast] = useState(() => start - Date.now() <= HOUR)
  const now = useNow(fast ? 1000 : 30_000, fast ? start : start - HOUR)
  const left = Math.max(0, start - now)
  if (!fast && left <= HOUR) setFast(true)

  let tiles: { value: number; unit: string }[]
  if (fast) {
    tiles = [
      { value: Math.floor(left / MIN), unit: t('นาที', 'min') },
      { value: Math.floor((left % MIN) / 1000), unit: t('วินาที', 'sec') },
    ]
  } else {
    // whole minutes rounded up, like the countdown line
    const mins = Math.ceil(left / MIN)
    const d = Math.floor(mins / 1440)
    const h = Math.floor((mins % 1440) / 60)
    tiles = [
      ...(d ? [{ value: d, unit: t('วัน', d === 1 ? 'day' : 'days') }] : []),
      { value: h, unit: t('ชม.', 'hr') },
      { value: mins % 60, unit: t('นาที', 'min') },
    ]
  }

  return (
    <div>
      <p className="font-display text-sm font-semibold text-ink-soft">{t('เปิดในอีก', 'Opens in')}</p>
      {/* the tiles are for the eyes; the line below them is what a screen reader reads */}
      <div aria-hidden className="mt-1.5 flex flex-wrap justify-center gap-2 sm:justify-start">
        {tiles.map((tile) => (
          <span key={tile.unit} className="flex min-w-[4.25rem] flex-col items-center rounded-3xl bg-white px-3 py-2 shadow-[var(--shadow-puffy)]">
            <span className="relative flex h-10 items-center overflow-hidden font-display text-4xl leading-none font-bold text-ink tabular-nums">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={tile.value}
                  initial={reduce ? false : { y: '-60%', opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { y: '60%', opacity: 0 }}
                  transition={spring.bouncy}
                  className="inline-block"
                >
                  {String(tile.value).padStart(2, '0')}
                </motion.span>
              </AnimatePresence>
            </span>
            <span className="mt-0.5 text-xs font-semibold text-ink-soft">{tile.unit}</span>
          </span>
        ))}
      </div>
      <p className="sr-only">{formatCountdown(session, now)}</p>
    </div>
  )
}

/** Who said "ไปด้วย" (me first), a few at a time. */
function WhoIsGoing({ session }: { session: Session }) {
  const attendees = useEventAttendees(session.id)
  const myId = useMoshi((s) => s.me.id)
  const going = useMoshi((s) => s.going.includes(session.id))
  const count = session.going + (going ? 1 : 0)
  // people I can't see (blocked, or outside what this app knows) still count
  const unseen = Math.max(0, count - attendees.length)
  return (
    <Zone
      tone="mint"
      className="mt-5"
      icon={<Users size={18} strokeWidth={2.4} />}
      title={t('ใครจะไปบ้าง', "Who's going")}
      note={count > 0 ? t(`${count} คนจะไป`, `${count} going`) : undefined}
    >
      {attendees.length === 0 ? (
        <p className="py-2 text-center text-sm text-ink-soft">
          {unseen > 0
            ? t(`มี ${unseen} คนจะไป`, `${unseen} going`)
            : t('ยังไม่มีใครกดไปด้วยเลย กด “ไปด้วย” ด้านบนเป็นคนแรกนะ', "Nobody's said they're going yet. Tap “I'm going” above to be the first")}
        </p>
      ) : (
        <>
          <ShowMore
            items={attendees}
            initial={6}
            getKey={(u) => u.id}
            listClassName="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2 md:grid-cols-3"
            itemClassName="min-w-0"
            moreLabel={(n) => t(`ดูคนที่จะไปเพิ่ม (อีก ${n})`, `Show more (${n} more)`)}
            render={(u) => <PersonChip user={u} me={u.id === myId} />}
          />
          {unseen > 0 && <p className="mt-2 text-sm text-ink-soft">{t(`และอีก ${unseen} คน`, `and ${unseen} more`)}</p>}
        </>
      )}
    </Zone>
  )
}

function PersonChip({ user: u, me }: { user: User; me: boolean }) {
  const body = (
    <>
      <Avatar color={u.color} size={36} face={me ? 'happy' : undefined} online={me ? undefined : u.isOnline} />
      <span className="min-w-0 truncate font-display text-sm font-semibold text-ink">{me ? t('เรา', 'You') : displayName(u.name)}</span>
    </>
  )
  const box = 'flex min-h-12 min-w-0 items-center gap-2.5 rounded-2xl bg-white px-2.5 py-1.5 shadow-[var(--shadow-soft)]'
  return me ? (
    <span className={box}>{body}</span>
  ) : (
    <Link to={`/app/people/${u.id}`} className={`${box} transition-colors hover:bg-cream-2`}>
      {body}
    </Link>
  )
}

// ------------------------------------------------------------------ after it ends

function Closed({ session, room, now }: { session: Session; room?: Room; now: number }) {
  const features = useServerFeatures()
  const attendees = useEventAttendees(session.id)
  const going = useMoshi((s) => s.going.includes(session.id))
  const myId = useMoshi((s) => s.me.id)
  const count = session.going + (going ? 1 : 0)
  return (
    <>
      <Zone tone="mint" className="mt-5" icon={<PartyPopper size={18} strokeWidth={2.4} />} title={t('จบแล้ว ขอบคุณที่มาร่วม', 'That’s a wrap. Thanks for coming')}>
        <div className="flex flex-wrap items-center gap-3">
          <Avatar color="mint" size={60} face="happy" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg leading-snug font-semibold text-ink">
              {count > 0 ? t(`มาด้วยกัน ${count} คน`, `${count} ${count === 1 ? 'person' : 'people'} came`) : t('ขอบคุณที่แวะมานะ', 'Thanks for stopping by')}
            </p>
            {attendees.length > 0 && (
              <AvatarStack people={attendees.map((u) => ({ id: u.id, color: u.color, face: u.id === myId ? ('happy' as const) : undefined }))} size={28} max={6} className="mt-1" />
            )}
          </div>
        </div>
        <NextRound session={session} room={room} now={now} />
      </Zone>
      {/* no event chats on this database yet: nothing to read back, and NextRound already leads to the room */}
      {features.events && <EventChat session={session} room={room} phase="closed" now={now} />}
    </>
  )
}

/**
 * "รอบหน้า ศุกร์ 21:00 [ไปด้วย]" for a weekly event (past any week that was called off); otherwise
 * back to the room.
 */
function NextRound({ session, room, now }: { session: Session; room?: Room; now: number }) {
  const events = useEvents({ roomId: session.roomId })
  const { next, later, skipped } = nextRound(session, events, now)
  if (next)
    return (
      <div className="mt-4">
        <EventCard session={next} variant="compact" showRoom={false} eyebrow={t(`รอบหน้า · ${eventWhenLabel(next.startsAt, now)}`, `Next round · ${eventWhenLabel(next.startsAt, now)}`)} />
      </div>
    )
  if (later)
    return (
      <p className="mt-4 flex items-center gap-2 rounded-2xl bg-cream-2 px-4 py-3 text-sm text-ink">
        <Repeat size={16} strokeWidth={2.4} aria-hidden className="shrink-0" />
        <span className="min-w-0">
          {skipped.length > 0 &&
            t(`รอบ ${eventWhenLabel(skipped[0].startsAt, now)} งดนะ · `, `No round on ${eventWhenLabel(skipped[0].startsAt, now)} · `)}
          {skipped.length > 0
            ? t(`รอบถัดไป ${eventWhenLabel(later.startsAt, now)} · กดไปด้วยได้เร็วๆ นี้`, `Next one ${eventWhenLabel(later.startsAt, now)} · RSVPs open soon`)
            : t(`รอบหน้า ${eventWhenLabel(later.startsAt, now)} · กดไปด้วยได้เร็วๆ นี้`, `Next round ${eventWhenLabel(later.startsAt, now)} · RSVPs open soon`)}
        </span>
      </p>
    )
  if (!room) return null
  return (
    <ButtonLink to={`/app/rooms/${room.id}`} icon={<DoorOpen size={18} strokeWidth={2.4} aria-hidden />} className="mt-4 w-full sm:w-auto">
      {t('กลับไปคุยในห้อง', 'Back to the room chat')}
    </ButtonLink>
  )
}

function Cancelled({ session, room, now }: { session: Session; room?: Room; now: number }) {
  const events = useEvents({ roomId: session.roomId })
  const next = findNextInSeries(session, events)
  return (
    <>
      <Zone tone="cream" className="mt-5" icon={<CalendarX size={18} strokeWidth={2.4} />} title={t('อีเวนต์นี้ยกเลิกแล้ว', 'This event was canceled')}>
        <Note
          face="sleepy"
          color="cream"
          title={t('รอบนี้ไม่ได้จัดแล้วนะ', "This one isn't happening")}
          body={t('ไม่เป็นไรนะ ยังมีเพื่อนๆ คุยกันในห้องอยู่ แวะไปทักกันได้เลย', 'No worries, friends are still chatting in the room. Pop in and say hi')}
        >
          {room && (
            <ButtonLink to={`/app/rooms/${room.id}`} icon={<DoorOpen size={18} strokeWidth={2.4} aria-hidden />} className="mt-4">
              {t('กลับไปที่ห้อง', 'Back to the room')}
            </ButtonLink>
          )}
        </Note>
        {next && (
          <div className="mt-2">
            <EventCard session={next} variant="compact" showRoom={false} eyebrow={t(`รอบหน้า · ${eventWhenLabel(next.startsAt, now)}`, `Next round · ${eventWhenLabel(next.startsAt, now)}`)} />
          </div>
        )}
      </Zone>
    </>
  )
}

// ------------------------------------------------------------------ couldn't load / not found

/** Fetching the event didn't get through (offline): one way on, try again. A reconnect retries by itself. */
function EventLoadFailed({ sessionId }: { sessionId: string }) {
  const [trying, setTrying] = useState(false)
  // a new try is on its way: the page goes back to its skeleton by itself, so this only guards double taps
  useEffect(() => {
    if (!trying) return
    const id = window.setTimeout(() => setTrying(false), 1500)
    return () => window.clearTimeout(id)
  }, [trying])
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center px-4 py-12 text-center">
      <motion.span className="inline-flex" initial={{ rotate: -8, y: 10, opacity: 0 }} animate={{ rotate: 0, y: 0, opacity: 1 }} transition={spring.bouncy}>
        <Avatar color="peach" size={120} face="sleepy" />
      </motion.span>
      <h1 className="mt-5 font-display text-2xl font-semibold">{t('ยังเปิดอีเวนต์นี้ไม่ได้', "We couldn't open this event")}</h1>
      <p className="mt-2 max-w-sm text-ink-soft" role="status">
        {t('เน็ตอาจหลุดไปแป๊บนึง ลองใหม่อีกทีนะ พอต่อเน็ตได้จะลองให้เองด้วย', 'The connection may have dropped for a moment. Try again, or it will retry once you’re back online')}
      </p>
      <Button
        className="mt-6"
        icon={<RotateCw size={18} strokeWidth={2.6} aria-hidden />}
        disabled={trying}
        onClick={() => {
          setTrying(true)
          retrySessionLoad(sessionId)
        }}
      >
        {t('ลองอีกครั้ง', 'Try again')}
      </Button>
    </div>
  )
}

function EventNotFound() {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center px-4 py-12 text-center">
      <motion.span className="inline-flex" initial={{ rotate: -8, y: 10, opacity: 0 }} animate={{ rotate: 0, y: 0, opacity: 1 }} transition={spring.bouncy}>
        <Avatar color="lavender" size={120} face="sleepy" />
      </motion.span>
      <h1 className="mt-5 font-display text-2xl font-semibold">{t('ไม่เจออีเวนต์นี้เลย', "We can't find this event")}</h1>
      <p className="mt-2 max-w-sm text-ink-soft">
        {t('อีเวนต์นี้อาจถูกลบไปพร้อมห้อง หรือลิงก์พิมพ์ผิดไปนิดนึง ยังมีอีเวนต์อื่นรออยู่นะ', 'It may have gone with its room, or the link has a tiny typo. Other events are waiting')}
      </p>
      <ButtonLink to="/app/rooms?tab=events" className="mt-6" icon={<ChevronLeft size={18} strokeWidth={2.6} />}>
        {t('ไปดูอีเวนต์อื่น', 'See other events')}
      </ButtonLink>
    </div>
  )
}
