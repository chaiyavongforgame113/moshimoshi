import { CalendarClock, ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { ButtonLink } from '@/components/ui'
import { useDataReady, useEvents } from '@/data/hooks'
import { eventPhase } from '@/lib/events'
import { t } from '@/lib/i18n'
import { EventCard } from '@/pages/events/EventCard'
import { liveOrSoon, useEventsNow } from '@/pages/events/lib'
import { Block, seeAllClass } from './Block'
import { EmptyNote } from './Soft'

/** events the home shows before "ดูทั้งหมด" */
const FIRST_EVENTS = 2

/** how far ahead home looks (what the home has always shown) */
const AHEAD_MS = 8 * 86_400_000

/** Where "ดูทั้งหมด" goes: the rooms page, opened on its อีเวนต์ tab. */
const ALL_EVENTS = '/app/rooms?tab=events'

/**
 * Home zone 4, "อีเวนต์": what's open now first, then the next ones, each with its live countdown
 * and one button (ไปด้วย / เข้าห้องเลย). Two show; the rest are a tap away. `skip` is the event
 * zone 2 already shows (left out unless it's the only one).
 */
export function Events({ skip }: { skip?: string }) {
  const events = useEvents()
  const ready = useDataReady()
  // flips right when an event opens or closes, so the list and badges change on time
  const now = useEventsNow(events)
  const sorted = useMemo(() => liveOrSoon(events, now, AHEAD_MS), [events, now])
  const shown = useMemo(() => {
    const rest = skip ? sorted.filter((s) => s.id !== skip) : sorted
    return (rest.length ? rest : sorted).slice(0, FIRST_EVENTS)
  }, [sorted, skip])
  const openCount = sorted.filter((s) => eventPhase(s, now) === 'open').length

  return (
    <Block
      id="home-events"
      tone="lavender"
      title={t('อีเวนต์', 'Events')}
      icon={<CalendarClock size={18} strokeWidth={2.4} />}
      note={
        openCount > 0
          ? t(`เปิดอยู่ตอนนี้ ${openCount} อีเวนต์`, `${openCount} open right now`)
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
        <EventsSkeleton />
      ) : !shown.length ? (
        <EmptyNote
          face="sleepy"
          color="lavender"
          title={t('ตอนนี้ยังไม่มีอีเวนต์เลย', 'No events right now')}
          sub={t('แวะไปนั่งเล่นในห้องก่อนได้นะ พอมีอีเวนต์ใหม่จะขึ้นตรงนี้เลย', 'Hang out in a room for now. New events show up right here')}
        >
          <ButtonLink to="/app/rooms" variant="secondary" className="w-full sm:w-auto">
            {t('ไปดูห้องต่างๆ', 'Browse rooms')}
          </ButtonLink>
        </EmptyNote>
      ) : (
        <ul className="grid gap-3 pt-1 sm:grid-cols-2">
          {shown.map((s, i) => (
            <li key={s.id} className="min-w-0">
              <EventCard session={s} index={i} />
            </li>
          ))}
        </ul>
      )}
    </Block>
  )
}

/** Two soft card outlines while events load. */
function EventsSkeleton() {
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
