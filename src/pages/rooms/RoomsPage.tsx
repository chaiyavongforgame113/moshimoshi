import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { CalendarCheck2, CalendarHeart, DoorOpen, LayoutGrid, Search, X } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { KineticText } from '@/components/motion'
import { Avatar, Button, PageHeader, ShowMore, tabId, tabPanelId, Tabs, Zone, type TabItem } from '@/components/ui'
import { useDataReady, useEvents, useRooms, useWatchingRooms } from '@/data/hooks'
import { eventPhase } from '@/lib/events'
import { L, loc, t } from '@/lib/i18n'
import { fadeUp, spring, stagger } from '@/lib/motion'
import { useMoshi } from '@/lib/store'
import type { MochiColor, Room } from '@/lib/types'
import { EventsBoard, eventsMatching } from '@/pages/events/EventsBoard'
import { groupEvents, openByRoom, useEventsNow } from '@/pages/events/lib'
import { ListSkeleton } from '@/pages/people/Skeleton'
import { LiveDot } from './bits'
import { useRoomToggle } from './LeaveRoom'
import { RoomCard } from './list/RoomCard'
import { liveFirst, roomMatches } from './roomData'

type RoomFilter = 'all' | 'mine'
type Filter = RoomFilter | 'my-events' | 'events'

const filterOf = (value: string | null): Filter => (value === 'mine' || value === 'my-events' || value === 'events' ? value : 'all')
const isEventFilter = (filter: Filter) => filter === 'events' || filter === 'my-events'

const FILTERS: TabItem<Filter>[] = [
  loc<TabItem<Filter>>({ key: 'mine', label: L('ห้องของเรา', 'My rooms'), icon: <DoorOpen size={16} strokeWidth={2.4} /> }),
  loc<TabItem<Filter>>({ key: 'all', label: L('ทั้งหมด', 'All rooms'), icon: <LayoutGrid size={16} strokeWidth={2.4} /> }),
  loc<TabItem<Filter>>({ key: 'my-events', label: L('อีเวนต์ของเรา', 'My events'), icon: <CalendarCheck2 size={16} strokeWidth={2.4} /> }),
  loc<TabItem<Filter>>({ key: 'events', label: L('อีเวนต์ทั้งหมด', 'All events'), icon: <CalendarHeart size={16} strokeWidth={2.4} /> }),
]

/** each room tab's rooms sit in a zone of their own colour (events have zones of their own) */
const LIST_TONE: Record<RoomFilter, MochiColor> = { all: 'butter', mine: 'sky' }

/** rooms a list shows before "ดูเพิ่ม" */
const FIRST_ROOMS = 6

function listTitle(filter: Filter) {
  if (filter === 'mine') return t('ห้องที่เข้าแล้ว', 'Rooms you joined')
  return t('ห้องทั้งหมด', 'All rooms')
}

export default function RoomsPage() {
  const ready = useDataReady()
  const allRooms = useRooms()
  const totalOnline = allRooms.reduce((n, r) => n + r.onlineCount, 0)
  return (
    <>
      <PageHeader
        title={<KineticText text={t('ห้อง', 'Rooms')} />}
        subtitle={
          !ready ? (
            t('กำลังเปิดประตูห้องต่างๆ…', 'Opening the room doors…')
          ) : totalOnline > 0 ? (
            <>
              <LiveDot className="mr-1.5 align-middle" />
              {t(`ตอนนี้มีเพื่อนออนไลน์ ${totalOnline} คน รอคุยอยู่`, `${totalOnline} ${totalOnline === 1 ? 'person is' : 'people are'} online and up for a chat`)}
            </>
          ) : (
            t('แวะเข้าห้องที่ชอบ แล้วทักทายเพื่อนๆ ได้เลย', 'Pop into a room you like and say hi')
          )
        }
      />
      {ready ? <RoomsBrowser allRooms={allRooms} /> : <ListSkeleton count={4} grid label={t('กำลังโหลดห้อง…', 'Loading rooms…')} />}
    </>
  )
}

function RoomsBrowser({ allRooms }: { allRooms: Room[] }) {
  const me = useMoshi((s) => s.me)
  // rooms watching a clip together right now (their cards say so)
  const watching = useWatchingRooms()
  const { toggle, sheet } = useRoomToggle()
  const events = useEvents()
  // the clock flips right when an event opens or closes (room badges, the tab's count)
  const now = useEventsNow(events)
  const openEvents = useMemo(() => openByRoom(events, now), [events, now])
  const [params, setParams] = useSearchParams()
  const filter = filterOf(params.get('tab'))
  const onEvents = isEventFilter(filter)
  const myEvents = filter === 'my-events'
  const setFilter = (next: Filter) =>
    setParams(
      (p) => {
        if (next === 'all') p.delete('tab')
        else p.set('tab', next)
        return p
      },
      { replace: true },
    )
  const [query, setQuery] = useState('')
  const q = useDeferredValue(query.trim())

  // rooms with other people chatting right now lead every list (their card carries the live badge)
  const ordered = useMemo(() => liveFirst(allRooms, me.rooms), [allRooms, me.rooms])

  const matching = useMemo(() => {
    const list = filter === 'mine' ? ordered.filter((r) => me.rooms.includes(r.id)) : ordered
    return list.filter((r) => roomMatches(r, q))
  }, [filter, ordered, me.rooms, q])
  const openCount = useMemo(() => events.filter((e) => eventPhase(e, now) === 'open').length, [events, now])
  const going = useMoshi((s) => s.going)
  const eventGroups = useMemo(() => {
    const scoped = myEvents ? events.filter((event) => going.includes(event.id)) : events
    return groupEvents(eventsMatching(scoped, allRooms, q), now, going)
  }, [myEvents, q, events, allRooms, now, going])
  const eventHits = eventGroups.open.length + eventGroups.upcoming.length + eventGroups.endedToday.length
  // the อีเวนต์ tab counts what's open right now
  const tabs = FILTERS.map((f) => (f.key === 'events' ? { key: f.key, label: f.label, icon: f.icon, badge: openCount } : f))
  // live counts only change the badges: joining or leaving never moves the card you just tapped
  const rooms = useSteadyOrder(matching, `${filter}:${q}`)

  return (
    <>
      {sheet}
      <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="space-y-3">
        <motion.div variants={fadeUp}>
          <Tabs items={tabs} value={filter} onChange={setFilter} idBase="rooms" className="w-full sm:w-fit" />
        </motion.div>

        <motion.form variants={fadeUp} role="search" onSubmit={(e) => e.preventDefault()} className="relative">
          <label htmlFor="room-search" className="sr-only">
            {onEvents ? t('ค้นหาอีเวนต์หรือห้อง', 'Search events or rooms') : t('ค้นหาห้อง', 'Search rooms')}
          </label>
          <Search size={20} strokeWidth={2.4} className="pointer-events-none absolute top-1/2 left-4 z-10 -translate-y-1/2 text-ink-soft" aria-hidden />
          <input
            id="room-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              onEvents ? t('ค้นหาอีเวนต์หรือห้อง เช่น ดูหนัง, วาโล', 'Search events or rooms, e.g. movie, Valo') : t('ค้นหาห้อง เช่น วาโล, อนิเมะ, คาเฟ่', 'Search rooms, e.g. Valo, anime, café')
            }
            autoComplete="off"
            enterKeyHint="search"
            className="glass h-13 w-full rounded-full pr-14 pl-12 text-base text-ink outline-none placeholder:text-ink-faint focus-visible:ring-3 focus-visible:ring-lavender [&::-webkit-search-cancel-button]:hidden"
          />
          <AnimatePresence>
            {query && (
              <motion.button
                type="button"
                aria-label={t('ล้างคำค้นหา', 'Clear search')}
                onClick={() => setQuery('')}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                whileTap={{ scale: 0.85 }}
                transition={spring.bouncy}
                className="absolute top-1/2 right-1 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-ink hover:bg-ink/5"
              >
                <X size={18} strokeWidth={2.6} />
              </motion.button>
            )}
          </AnimatePresence>
        </motion.form>
      </motion.div>

      <p className="sr-only" aria-live="polite">
        {!q
          ? ''
          : onEvents
            ? t(`พบ ${eventHits} อีเวนต์ที่ตรงกับ ${q}`, `${eventHits} ${eventHits === 1 ? 'event matches' : 'events match'} ${q}`)
            : t(`พบ ${rooms.length} ห้องที่ตรงกับ ${q}`, `${rooms.length} ${rooms.length === 1 ? 'room matches' : 'rooms match'} ${q}`)}
      </p>

      <div className="mt-5" role="tabpanel" id={tabPanelId('rooms', filter)} aria-labelledby={tabId('rooms', filter)}>
        {onEvents ? (
          <motion.div key={filter} variants={fadeUp} initial="hidden" animate="show">
            <EventsBoard
              groups={eventGroups}
              mine={myEvents}
              query={q}
              empty={
                <EmptyState
                  filter={filter}
                  query={q}
                  onClear={() => setQuery('')}
                  onBrowse={() => {
                    setQuery('')
                    setFilter(myEvents ? 'events' : 'all')
                  }}
                />
              }
            />
          </motion.div>
        ) : rooms.length > 0 ? (
          <motion.div key={filter} variants={fadeUp} initial="hidden" animate="show">
            <Zone
              tone={LIST_TONE[filter]}
              icon={FILTERS.find((f) => f.key === filter)?.icon}
              title={q ? t(`ห้องที่ตรงกับ “${q}”`, `Rooms matching “${q}”`) : listTitle(filter)}
              note={t(`${rooms.length} ห้อง`, `${rooms.length} ${rooms.length === 1 ? 'room' : 'rooms'}`)}
            >
              {/* a new tab or search starts short again */}
              <ShowMore
                key={`${filter}:${q}`}
                items={rooms}
                initial={FIRST_ROOMS}
                getKey={(r) => r.id}
                listClassName="grid gap-3 md:grid-cols-2 md:gap-4 md:[&>li:last-child:nth-child(odd)]:col-span-2"
                itemClassName="min-w-0"
                moreLabel={(n) => t(`ดูห้องเพิ่ม (อีก ${n})`, `Show more rooms (${n} more)`)}
                render={(r) => <RoomCard room={r} me={me} joined={me.rooms.includes(r.id)} onToggle={() => toggle(r)} openEvent={openEvents.get(r.id)} watching={watching[r.id]} />}
              />
            </Zone>
          </motion.div>
        ) : (
          <EmptyState
            filter={filter}
            query={q}
            onClear={() => setQuery('')}
            onBrowse={() => {
              setQuery('')
              setFilter('all')
            }}
          />
        )}
      </div>
    </>
  )
}

/**
 * Keeps a list in the order it first showed while `key` (the tab and search) stays the same,
 * so a card never jumps away from under the finger. Rooms new to the list join at the end;
 * a room that drops out and comes back returns to its old spot. A new key starts fresh.
 */
function useSteadyOrder(list: Room[], key: string): Room[] {
  const [snap, setSnap] = useState(() => ({ key, ids: list.map((r) => r.id) }))
  let ids = snap.ids
  if (snap.key !== key) ids = list.map((r) => r.id)
  else {
    const known = new Set(ids)
    const added = list.filter((r) => !known.has(r.id)).map((r) => r.id)
    if (added.length) ids = [...ids, ...added]
  }
  // remember what this render used (React re-renders straight away, before anything shows)
  if (ids !== snap.ids) setSnap({ key, ids })

  return useMemo(() => {
    const byId = new Map(list.map((r) => [r.id, r]))
    return ids.flatMap((id) => byId.get(id) ?? [])
  }, [list, ids])
}

/** Nothing to show: says why, with exactly one next step. */
function EmptyState({ filter, query, onClear, onBrowse }: { filter: Filter; query: string; onClear: () => void; onBrowse: () => void }) {
  const searching = !!query
  const title = searching
    ? isEventFilter(filter)
      ? t(`ยังไม่เจออีเวนต์ที่ตรงกับ “${query}”`, `No events match “${query}” yet`)
      : t(`ยังไม่เจอห้องที่ตรงกับ “${query}”`, `No rooms match “${query}” yet`)
    : filter === 'mine'
      ? t('ยังไม่ได้เข้าห้องไหนเลย', "You haven't joined any rooms yet")
      : filter === 'my-events'
        ? t('ยังไม่มีอีเวนต์ในแผน', 'No upcoming events on your list')
      : filter === 'events'
        ? t('ยังไม่มีอีเวนต์ที่เปิดหรือกำลังจะเปิด', 'No events open or coming up')
        : t('ตอนนี้ยังเงียบๆ อยู่', "It's quiet right now")
  const body = searching
    ? filter === 'all'
      ? t('ลองคำอื่นดูไหม หรือล้างคำค้นหาแล้วดูห้องทั้งหมด', 'Try another word, or clear the search to see every room')
      : t('ลองคำอื่นดูไหม หรือล้างคำค้นหา', 'Try another word, or clear the search')
    : filter === 'mine'
      ? t('เข้าห้องที่ชอบไว้ แล้วห้องจะมารออยู่ตรงนี้ กลับมาคุยต่อได้ทุกเมื่อ', "Join rooms you like and they'll wait for you here, ready whenever you are")
      : filter === 'my-events'
        ? t('กดไปด้วยในอีเวนต์ที่สนใจ แล้วจะเจออีเวนต์นั้นที่นี่', 'RSVP to an event to find it here.')
      : filter === 'events'
        ? t('เดี๋ยวจะมีอีเวนต์ใหม่ๆ มาอีกนะ ระหว่างนี้แวะไปทักเพื่อนในห้องก่อนก็ได้', 'New events are on the way. Meanwhile, pop into a room and say hi')
        : t('ยังไม่มีห้องให้ดูตอนนี้ แวะกลับมาใหม่นะ', 'No rooms to show yet. Check back soon')
  const reduce = useReducedMotion()
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.soft}
      className="card flex flex-col items-center px-6 py-10 text-center"
    >
      <motion.span animate={reduce ? undefined : { rotate: [0, -6, 6, 0] }} transition={{ duration: 1.6, repeat: 1 }}>
        <Avatar color={searching ? 'sky' : 'cream'} size={84} face={searching ? 'wow' : 'sleepy'} />
      </motion.span>
      <h2 className="mt-3 font-display text-xl font-semibold [overflow-wrap:anywhere]">{title}</h2>
      <p className="mt-1 max-w-sm text-ink-soft">{body}</p>
      {searching ? (
        <Button variant="soft" className="mt-5" icon={<X size={18} strokeWidth={2.6} />} onClick={onClear}>
          {t('ล้างคำค้นหา', 'Clear search')}
        </Button>
      ) : (
        filter !== 'all' && (
          <Button className="mt-5" icon={<LayoutGrid size={18} strokeWidth={2.4} />} onClick={onBrowse}>
            {filter === 'my-events' ? t('ดูอีเวนต์ทั้งหมด', 'See all events') : t('ดูห้องทั้งหมด', 'See all rooms')}
          </Button>
        )
      )}
    </motion.div>
  )
}
