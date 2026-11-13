import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { CalendarClock, CalendarX, Check, ChevronRight, DoorOpen, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { TiltCard, TiltGlare } from '@/components/motion'
import { Avatar, Button, ButtonLink, RoomIcon, Sheet } from '@/components/ui'
import { useDataReady, usePerson, useRoom, useSessions } from '@/data/hooks'
import { MOCHI } from '@/lib/colors'
import { t } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import { useMoshi } from '@/lib/store'
import type { Session } from '@/lib/types'
import { AnimatedNumber, Block, seeAllClass } from './Block'
import { dayLabel, roomLabel } from './greeting'
import { EmptyNote } from './Soft'

/** events the home shows before "ดูทั้งหมด" */
const FIRST_EVENTS = 2

/** Where "ดูทั้งหมด" goes: the rooms page, opened on its อีเวนต์ tab. */
const ALL_EVENTS = '/app/rooms?tab=events'

/** live first, then by day and time */
const bySoonest = (a: Session, b: Session) => Number(!!b.live) - Number(!!a.live) || a.dayOffset - b.dayOffset || a.time.localeCompare(b.time)

/**
 * Home zone 4, "อีเวนต์": what's live now first, then the next ones. Two show; the rest are a tap
 * away. `skip` is the event zone 2 already shows (left out unless it's the only one).
 */
export function Events({ skip }: { skip?: string }) {
  const sessions = useSessions()
  const ready = useDataReady()
  const sorted = useMemo(() => [...sessions].sort(bySoonest), [sessions])
  const shown = useMemo(() => {
    const rest = skip ? sorted.filter((s) => s.id !== skip) : sorted
    return (rest.length ? rest : sorted).slice(0, FIRST_EVENTS)
  }, [sorted, skip])
  const liveCount = sessions.filter((s) => s.live).length
  const toggleGoing = useMoshi((s) => s.toggleGoing)
  // cancelling an RSVP asks first; saying "ไปด้วย" is one tap
  const [cancelling, setCancelling] = useState<Session | null>(null)

  return (
    <Block
      id="home-events"
      tone="lavender"
      title={t('อีเวนต์', 'Events')}
      icon={<CalendarClock size={18} strokeWidth={2.4} />}
      note={
        liveCount > 0
          ? t(`เปิดอยู่ตอนนี้ ${liveCount} อีเวนต์`, `${liveCount} live right now`)
          : t('ห้องคุยที่มีเวลาเปิดปิด มาตามเวลาแล้วคุยกัน', 'Chats with a start and end time. Drop in and talk')
      }
      action={
        sorted.length > 0 && (
          <Link to={ALL_EVENTS} className={seeAllClass}>
            <span className="max-[400px]:sr-only">{t('ดูทั้งหมด', 'See all')}</span> <ChevronRight size={16} aria-hidden />
          </Link>
        )
      }
    >
      {!ready ? (
        <SessionsSkeleton />
      ) : !shown.length ? (
        <EmptyNote
          face="sleepy"
          color="lavender"
          title={t('ตอนนี้ยังไม่มีอีเวนต์เลย', 'No events right now')}
          sub={t('แวะไปนั่งเล่นในห้องก่อนได้นะ พอมีอีเวนต์ใหม่จะขึ้นตรงนี้เลย', "Hang out in a room for now. New events show up right here")}
        >
          <ButtonLink to="/app/rooms" variant="secondary" className="w-full sm:w-auto">
            {t('ไปดูห้องต่างๆ', 'Browse rooms')}
          </ButtonLink>
        </EmptyNote>
      ) : (
        <ul className="grid gap-3 pt-1 sm:grid-cols-2">
          {shown.map((s, i) => (
            <li key={s.id} className="min-w-0">
              <SessionCard session={s} index={i} onCancel={() => setCancelling(s)} />
            </li>
          ))}
        </ul>
      )}

      <CancelSheet
        session={cancelling}
        onClose={() => setCancelling(null)}
        onConfirm={(s) => {
          // the sheet's buttons stay live while it slides away: a second tap must not sign back up
          if (useMoshi.getState().going.includes(s.id)) toggleGoing(s.id)
          setCancelling(null)
        }}
      />
    </Block>
  )
}

/** "ไม่ไปแล้วเหรอ?": a stray tap on "ไปแน่!" shouldn't drop an RSVP. */
function CancelSheet({ session, onClose, onConfirm }: { session: Session | null; onClose: () => void; onConfirm: (s: Session) => void }) {
  // keep the last event on screen while the sheet slides away
  const [last, setLast] = useState(session)
  if (session && session !== last) setLast(session)
  const shown = session ?? last
  return (
    <Sheet open={!!session} onClose={onClose} title={t('ไม่ไปอีเวนต์นี้แล้วเหรอ?', 'Not going anymore?')} width={460}>
      {shown && (
        <div className="space-y-4 pb-3">
          <p className="rounded-3xl border border-line bg-white p-3 text-ink">
            {t('จะยกเลิกไป ', 'Cancel your RSVP for ')}
            <b className="font-display font-semibold">{shown.title}</b>
            {t(` (${dayLabel(shown.dayOffset)} ${shown.time}) ใช่ไหม? อยากกลับมากดไปด้วยเมื่อไหร่ก็ได้นะ`, ` (${dayLabel(shown.dayOffset)} ${shown.time})? You can say you're going again anytime`)}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button variant="dark" block icon={<CalendarX size={18} aria-hidden />} onClick={() => onConfirm(shown)}>
              {t('ไม่ไปแล้ว', 'Cancel RSVP')}
            </Button>
            <Button variant="ghost" block onClick={onClose}>
              {t('ยังไปเหมือนเดิม', 'Still going')}
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  )
}

function SessionCard({ session: s, index, onCancel }: { session: Session; index: number; onCancel: () => void }) {
  const going = useMoshi((st) => st.going.includes(s.id))
  const toggleGoing = useMoshi((st) => st.toggleGoing)
  const room = useRoom(s.roomId)
  const me = useMoshi((st) => st.me)
  const person = usePerson(s.hostId)
  const host = s.hostId === me.id ? me : person
  const p = MOCHI[room?.color ?? 'cream']
  const count = s.going + (going ? 1 : 0)
  const reduce = useReducedMotion()

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ ...spring.soft, delay: Math.min(index, 4) * 0.05 }}
      className="h-full"
    >
      <TiltCard className="h-full" max={5} glare={false}>
        <article className="card relative flex h-full flex-col overflow-hidden p-4">
          <TiltGlare />
          {/* soft room-coloured glow in the corner */}
          <span aria-hidden className="pointer-events-none absolute -top-12 -right-12 size-36 rounded-full opacity-70 blur-2xl" style={{ background: p.base }} />

          <div className="relative flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-ink-soft">{dayLabel(s.dayOffset)}</p>
              <p className="font-display text-3xl leading-none font-bold tracking-tight">{s.time}</p>
            </div>
            {s.live ? <LiveBadge /> : room && <RoomIcon room={room} size={42} />}
          </div>

          <h3 className="relative mt-3 line-clamp-2 font-display text-[17px] leading-normal font-semibold">
            <Link to={`/app/rooms/${s.roomId}`} className="rounded-md hover:underline hover:decoration-2 hover:underline-offset-4">
              {s.title}
            </Link>
          </h3>
          {room && (
            <p className="relative mt-1 flex items-center gap-1.5 text-sm text-ink-soft">
              {s.live && <RoomIcon room={room} size={20} />}
              <span className="truncate">
                {roomLabel(room.name)} · {t(`${s.durationMin} นาที`, `${s.durationMin} min`)}
              </span>
            </p>
          )}

          <div className="relative mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-3 pt-4">
            <div className="flex min-w-0 flex-[1_1_8rem] items-center gap-2">
              {host && <Avatar color={host.color} size={34} ring />}
              <div className="min-w-0 text-xs leading-normal">
                <p className="truncate text-ink-soft">
                  {host
                    ? t(`ชวนคุยโดย ${host.name}`, `Hosted by ${host.name}`)
                    : s.hostName
                      ? t(`ชวนคุยโดย ${s.hostName}`, `Hosted by ${s.hostName}`)
                      : t('มาคุยด้วยกันนะ', 'Come chat with us')}
                </p>
                <p className="font-semibold text-ink">
                  <AnimatedNumber value={count} /> {t('คนจะไป', 'going')}
                </p>
              </div>
            </div>
            {s.live ? (
              <ButtonLink to={`/app/rooms/${s.roomId}`} variant="secondary" size="sm" icon={<DoorOpen size={16} aria-hidden />} className="ml-auto h-11 shrink-0">
                {t('เข้าไปคุย', 'Join the chat')}
              </ButtonLink>
            ) : (
              <RsvpButton going={going} onToggle={() => (going ? onCancel() : toggleGoing(s.id))} title={s.title} />
            )}
          </div>
        </article>
      </TiltCard>
    </motion.div>
  )
}

function RsvpButton({ going, onToggle, title }: { going: boolean; onToggle: () => void; title: string }) {
  return (
    <motion.button
      type="button"
      aria-pressed={going}
      onClick={onToggle}
      whileTap={{ scale: 0.9 }}
      transition={spring.bouncy}
      className={`relative ml-auto inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 font-display text-sm font-semibold text-ink transition-colors ${
        going ? 'bg-mint shadow-[inset_0_-3px_0_rgb(59_38_34/0.12)]' : 'border border-line bg-white shadow-[var(--shadow-soft)] hover:bg-cream'
      }`}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={going ? 'on' : 'off'}
          initial={{ scale: 0, rotate: -40 }}
          animate={{ scale: 1, rotate: 0 }}
          exit={{ scale: 0 }}
          transition={spring.bouncy}
          className="inline-flex"
        >
          {going ? <Check size={16} strokeWidth={3} /> : <Plus size={16} strokeWidth={3} />}
        </motion.span>
      </AnimatePresence>
      {going ? t('ไปแน่!', "I'm in!") : t('ไปด้วย', "I'm going")}
      {/* the event's name for screen readers, after the visible words so voice control still finds them */}
      <span className="sr-only">{t(` ${title}`, `: ${title}`)}</span>
      {/* +1 that floats up when you RSVP */}
      <AnimatePresence>
        {going && (
          <motion.span
            key="plus"
            aria-hidden
            initial={{ opacity: 1, y: 0 }}
            animate={{ opacity: 0, y: -26 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="pointer-events-none absolute -top-1 right-2 font-display text-sm font-bold text-ink"
          >
            +1
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  )
}

/** Two soft card outlines while sessions load. */
function SessionsSkeleton() {
  return (
    <div role="status" aria-label={t('กำลังโหลด', 'Loading')} className="grid gap-3 pt-1 sm:grid-cols-2">
      {[0, 1].map((i) => (
        <div key={i} aria-hidden className="card h-52 min-w-0 p-4">
          <span className="block h-3 w-16 rounded-full bg-cream-3 motion-safe:animate-pulse" />
          <span className="mt-2 block h-7 w-24 rounded-full bg-cream-3 motion-safe:animate-pulse" />
          <span className="mt-4 block h-4 w-3/4 rounded-full bg-cream-3/70 motion-safe:animate-pulse" />
        </div>
      ))}
    </div>
  )
}

function LiveBadge() {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-coral px-2.5 font-display text-xs font-bold tracking-wide text-ink shadow-[var(--shadow-puffy)]">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full rounded-full bg-white opacity-90 motion-safe:animate-ping" />
        <span className="relative inline-flex size-2 rounded-full bg-white" />
      </span>
      {t('เปิดอยู่', 'LIVE')}
      <span className="sr-only">{t(' กำลังคุยกันอยู่ตอนนี้', ' Chatting right now')}</span>
    </span>
  )
}
