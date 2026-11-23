// The rooms page's "อีเวนต์" tab: open now, coming up, and (folded away) what ended today.
import { AnimatePresence, motion } from 'motion/react'
import { CalendarCheck2, CalendarClock, ChevronDown, Radio } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { ShowMore, Zone } from '@/components/ui'
import { t } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import type { MochiColor, Room, Session } from '@/lib/types'
import { roomMatches } from '@/pages/rooms/roomData'
import { EventCard } from './EventCard'
import type { EventGroups } from './lib'

/** events a section shows before "ดูเพิ่ม" */
const FIRST = 4

/** The events a search keeps: by the event's title, or its room by name, tagline or tag. */
export function eventsMatching(events: readonly Session[], rooms: readonly Room[], query: string): readonly Session[] {
  const q = query.trim().toLowerCase()
  if (!q) return events
  const byId = new Map(rooms.map((r) => [r.id, r]))
  return events.filter((s) => {
    const room = byId.get(s.roomId)
    return s.title.toLowerCase().includes(q) || (!!room && roomMatches(room, q))
  })
}

/**
 * Event results split by phase. `empty` shows when nothing is open or coming up.
 */
export function EventsBoard({ groups, query, mine, empty }: { groups: EventGroups; query: string; mine: boolean; empty: ReactNode }) {
  const [showEnded, setShowEnded] = useState(false)
  const endedId = useId()

  const { open, upcoming, endedToday } = groups
  const nothing = !open.length && !upcoming.length

  return (
    <div className="space-y-5">
      {nothing && empty}
      {open.length > 0 && (
        <Section
          tone="mint"
          icon={<Radio size={18} strokeWidth={2.4} />}
          title={t('เปิดอยู่ตอนนี้', 'Open now')}
          note={t(`${open.length} อีเวนต์ เข้าไปคุยได้เลย`, `${open.length} ${open.length === 1 ? 'event' : 'events'} you can join right now`)}
          list={open}
          listKey={`open:${query}`}
        />
      )}
      {upcoming.length > 0 && (
        <Section
          tone="lavender"
          icon={<CalendarClock size={18} strokeWidth={2.4} />}
          title={t('กำลังจะเปิด', 'Coming up')}
          note={mine ? undefined : t('กดไปด้วยไว้ ถึงเวลาแล้วห้องจะเปิดเอง', "Say you're going. The room opens by itself on time")}
          list={upcoming}
          listKey={`soon:${query}`}
        />
      )}
      {endedToday.length > 0 && (
        <div>
          <button
            type="button"
            aria-expanded={showEnded}
            aria-controls={endedId}
            onClick={() => setShowEnded((v) => !v)}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-cream-3/70 px-5 font-display text-[15px] font-semibold text-ink transition-colors hover:bg-cream-3"
          >
            <CalendarCheck2 size={18} strokeWidth={2.4} aria-hidden />
            <span className="min-w-0 truncate">
              {showEnded ? t('ซ่อนอีเวนต์ที่จบแล้ววันนี้', 'Hide events that ended today') : t(`จบแล้ววันนี้ (${endedToday.length})`, `Ended today (${endedToday.length})`)}
            </span>
            <motion.span animate={{ rotate: showEnded ? 180 : 0 }} transition={spring.soft} className="inline-flex" aria-hidden>
              <ChevronDown size={18} strokeWidth={2.4} />
            </motion.span>
          </button>
          <div id={endedId}>
            <AnimatePresence initial={false}>
              {showEnded && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.14 } }} transition={spring.soft} className="mt-3">
                  <Section
                    tone="cream"
                    icon={<CalendarCheck2 size={18} strokeWidth={2.4} />}
                    title={t('จบแล้ววันนี้', 'Ended today')}
                    note={t('แชทอ่านย้อนหลังได้ 24 ชั่วโมงหลังจบ', 'Chats stay readable for 24 hours after the end')}
                    list={endedToday}
                    listKey={`ended:${query}`}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  )
}

function Section({ tone, icon, title, note, list, listKey }: { tone: MochiColor; icon: ReactNode; title: string; note?: string; list: Session[]; listKey: string }) {
  return (
    <Zone tone={tone} icon={icon} title={title} note={note}>
      {/* a new search starts short again */}
      <ShowMore
        key={listKey}
        items={list}
        initial={FIRST}
        getKey={(s) => s.id}
        listClassName="grid gap-3 md:grid-cols-2 md:gap-4 md:[&>li:last-child:nth-child(odd)]:col-span-2"
        itemClassName="min-w-0"
        moreLabel={(n) => t(`ดูอีเวนต์เพิ่ม (อีก ${n})`, `Show more events (${n} more)`)}
        render={(s, i) => <EventCard session={s} index={i} />}
      />
    </Zone>
  )
}
