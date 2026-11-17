import { motion, useReducedMotion } from 'motion/react'
import { Check, MessageCircle, Plus, Sparkles } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { Avatar, RoomIcon, ShowMore } from '@/components/ui'
import { usePeople, useRooms } from '@/data/hooks'
import { tagOf } from '@/data/tags'
import { MOCHI } from '@/lib/colors'
import { t } from '@/lib/i18n'
import { fadeUp, spring } from '@/lib/motion'
import type { MochiColor, Room } from '@/lib/types'
import { fittingRooms, lobbyOf, rankRooms, type StepProps } from '../model'

/** seats in a card's little group-chat preview */
const SEATS = 3
/** cards that show before "ดูห้องอื่น": a 390x760 phone fits three and the button above the bar */
const FIRST_VIEW = 3

interface RoomCardItem {
  room: Room
  /** their interests the room talks about (names, loved ones first) */
  topics: string[]
  /** one of the rooms that fit them ("น่าจะถูกใจ") */
  forYou: boolean
  /** a few people already in it, online first */
  faces: MochiColor[]
}

/**
 * 11 · the group chats to join. The ones that fit (and the lounge) are joined for them already and
 * lead the list, another follows, the rest wait behind "ดูห้องอื่น". Each card reads as a
 * chat: the room, its one-liner, who's in it, and a clear "+ เข้าร่วม" / "✓ เข้าร่วมแล้ว".
 */
export function StepRooms({ draft, update, desktop }: StepProps) {
  const rooms = useRooms()
  const people = usePeople()
  // the picks lead the list; from their first tap the order holds still, so nothing jumps under a finger
  const [held, setHeld] = useState<string[] | null>(null)
  const lead = held ?? draft.rooms

  const faces = useMemo(() => {
    const byRoom = new Map<string, MochiColor[]>()
    const onlineFirst = [...people].sort((a, b) => Number(b.isOnline) - Number(a.isOnline))
    for (const u of onlineFirst) {
      for (const id of u.rooms) {
        const seated = byRoom.get(id) ?? []
        if (seated.length < SEATS) byRoom.set(id, [...seated, u.color])
      }
    }
    return byRoom
  }, [people])

  const { items, picked } = useMemo(() => {
    const fits = new Set(fittingRooms(draft, rooms))
    const card = (room: Room, shared: string[] = []): RoomCardItem => ({
      room,
      topics: shared.flatMap((id) => tagOf(id)?.label ?? []).slice(0, 2),
      forYou: fits.has(room.id),
      // (people shown only where the room's own count has someone, so a seat never contradicts "ห้องใหม่")
      faces: room.memberCount > 0 ? (faces.get(room.id) ?? []) : [],
    })
    const lobby = lobbyOf(rooms)
    const all = [...(lobby ? [card(lobby)] : []), ...rankRooms(draft, rooms).map((r) => card(r.room, r.shared))]
    const first = lead.flatMap((id) => all.find((x) => x.room.id === id) ?? [])
    return { items: [...first, ...all.filter((x) => !lead.includes(x.room.id))], picked: first.length }
  }, [draft, rooms, faces, lead])

  const toggle = (id: string) => {
    setHeld((h) => h ?? lead)
    update((d) => ({ roomsTouched: true, rooms: d.rooms.includes(id) ? d.rooms.filter((r) => r !== id) : [...d.rooms, id] }))
  }

  if (!rooms.length) {
    return (
      <motion.div variants={fadeUp} className="flex items-center gap-3 rounded-[1.5rem] bg-white/85 p-4 shadow-[var(--shadow-soft)]">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-cream-2 text-ink-soft" aria-hidden>
          <MessageCircle size={20} strokeWidth={2.2} />
        </span>
        <p className="text-[15px] text-ink">
          {t('ยังไม่มีห้องเปิดเลย เดี๋ยวพี่โมชิเปิดห้องแล้วจะชวนนะ ไปต่อได้เลย', 'No rooms are open yet. Our Mochi hosts will invite you once one opens. Go ahead and continue')}
        </p>
      </motion.div>
    )
  }

  // phones: the picks, topped up to three, so the cards and "ดูห้องอื่น" sit above the bar; a desktop
  // column has the height for one more than the picks. One hidden room isn't worth a button, so it just shows
  const first = desktop ? Math.max(FIRST_VIEW + 1, picked + 1) : Math.max(FIRST_VIEW, picked)
  const initial = items.length - first <= 1 ? items.length : first

  return (
    <motion.div variants={fadeUp} className="pt-1">
      <ShowMore
        // a late pick (the room list loading after the screen) re-settles the first view; taps never do
        key={initial}
        items={items}
        initial={initial}
        step={items.length}
        showLess={false}
        getKey={(x) => x.room.id}
        listClassName="space-y-3"
        moreLabel={(n) => t(`ดูห้องอื่นอีก ${n} ห้อง`, `See ${n} more ${n === 1 ? 'room' : 'rooms'}`)}
        render={(x) => <RoomCard item={x} me={draft.color} selected={draft.rooms.includes(x.room.id)} onToggle={() => toggle(x.room.id)} />}
      />
    </motion.div>
  )
}

interface RoomCardProps {
  item: RoomCardItem
  /** their mochi's color: it takes a seat in the rooms they join */
  me: MochiColor
  selected: boolean
  onToggle: () => void
}

function RoomCard({ item, me, selected, onToggle }: RoomCardProps) {
  const { room, topics, forYou, faces } = item
  const p = MOCHI[room.color]
  const reduce = useReducedMotion()
  const id = useId()
  // pops (their mochi taking a seat, the check) play on a tap, not when the list first shows
  const [tapped, setTapped] = useState(false)

  // never "ออนไลน์ 0 คน": who's around, else how many are in it, else a warm first-hello invite
  const live = room.onlineCount > 0
  const status = live
    ? t(`${room.onlineCount} คนออนไลน์`, `${room.onlineCount} online`)
    : room.memberCount > 0
      ? t(`${room.memberCount} คนในห้อง`, `${room.memberCount} ${room.memberCount === 1 ? 'member' : 'members'}`)
      : t('ห้องใหม่ มาเป็นคนแรกที่ทักกัน', 'New room. Say hi first!')
  const topic = topics.length
    ? t(`คุยเรื่อง ${topics.join(', ')}`, `Chatting about ${topics.join(', ')}`)
    : room.memberCount > 0 && room.primeTime
      ? t(`คึกคักช่วง ${room.primeTime}`, `Most active ${room.primeTime}`)
      : ''
  const seated: (MochiColor | 'me')[] = [...(selected ? (['me'] as const) : []), ...faces].slice(0, SEATS)

  return (
    <motion.button
      type="button"
      aria-pressed={selected}
      aria-label={t(`เข้าร่วมห้อง ${room.name}`, `Join ${room.name}`)}
      aria-describedby={`${forYou ? `${id}-for ` : ''}${id}-line ${id}-chat`}
      onClick={() => {
        setTapped(true)
        onToggle()
      }}
      whileTap={reduce ? undefined : { scale: 0.98 }}
      transition={spring.bouncy}
      className={`group relative block w-full rounded-[1.5rem] border-2 px-3 py-2.5 text-left shadow-[var(--shadow-soft)] transition-[background-color,border-color] duration-200 ${
        selected ? '' : 'border-transparent bg-white/85 hover:bg-white'
      }`}
      style={selected ? { background: `linear-gradient(150deg, #fff 10%, ${p.light} 100%)`, borderColor: p.shade } : undefined}
    >
      {forYou && (
        <span
          id={`${id}-for`}
          className="absolute -top-2.5 left-[4.25rem] inline-flex h-5 items-center gap-1 rounded-full bg-butter px-2 text-[11px] leading-none font-semibold text-ink shadow-[0_4px_10px_-4px_rgb(201_92_64/0.45)]"
        >
          <Sparkles size={10} strokeWidth={2.6} aria-hidden />
          {t('น่าจะถูกใจ', 'For you')}
        </span>
      )}

      <span className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3">
        <RoomIcon room={room} size={44} className="row-span-2" />

        {/* name and one-liner wrap to two lines rather than cut off (long English names, 320 px phones) */}
        <span className="line-clamp-2 min-w-0 font-display text-[15px] leading-5 font-semibold wrap-break-word text-ink">{room.name}</span>
        <JoinPill selected={selected} tapped={tapped} />

        <span id={`${id}-line`} className="col-span-2 line-clamp-2 min-w-0 text-[13px] leading-[18px] text-ink-soft">
          {room.tagline}
        </span>

        {/* the group chat at a glance: who's in (their mochi takes a seat when they join), then the chatter */}
        <span className="col-span-3 mt-2 flex min-w-0 items-center gap-2">
          <span className="flex shrink-0 items-center pl-0.5" aria-hidden>
            {Array.from({ length: SEATS }, (_, i) => {
              const who = seated[i]
              return (
                <span
                  key={who === 'me' ? 'me' : `${i}-${who ?? 'free'}`}
                  className={`relative grid size-[22px] place-items-center ${i ? '-ml-2' : ''}`}
                  style={{ zIndex: SEATS - i }}
                >
                  {who ? (
                    <motion.span
                      initial={tapped && who === 'me' ? { scale: 0.3, y: 4 } : false}
                      animate={{ scale: 1, y: 0 }}
                      transition={spring.bouncy}
                      className="grid size-[22px] place-items-center rounded-full bg-white shadow-[0_0_0_1.5px_#fff,0_2px_5px_-1px_rgb(59_38_34/0.2)]"
                    >
                      <Avatar color={who === 'me' ? me : who} size={18} face={who === 'me' ? 'happy' : i % 2 ? 'smile' : 'wink'} />
                    </motion.span>
                  ) : (
                    <span className="size-[22px] rounded-full border-[1.5px] border-dashed border-ink/20 bg-white/85" />
                  )}
                </span>
              )
            })}
          </span>
          <span
            id={`${id}-chat`}
            className="inline-flex h-[22px] min-w-0 items-center gap-1.5 overflow-hidden rounded-full rounded-bl-[6px] px-2.5 text-xs leading-none text-ink-soft"
            style={{ background: selected ? 'rgb(255 255 255 / 0.85)' : p.light }}
          >
            <MessageCircle size={12} strokeWidth={2.4} className="shrink-0" style={{ color: p.ink }} aria-hidden />
            {live && <span className="size-1.5 shrink-0 rounded-full bg-success" aria-hidden />}
            {/* the status always reads in full; only the topic after it gives way */}
            <span className="shrink-0 font-semibold whitespace-nowrap text-ink">{status}</span>
            {topic && <span className="-ml-0.5 min-w-0 truncate">· {topic}</span>}
          </span>
        </span>
      </span>
    </motion.button>
  )
}

/** "+ เข้าร่วม" ↔ "✓ เข้าร่วมแล้ว". The whole card is the button; this only shows its state. */
function JoinPill({ selected, tapped }: { selected: boolean; tapped: boolean }) {
  return (
    <span
      aria-hidden
      className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-full border-[1.5px] px-2.5 font-display text-xs font-semibold whitespace-nowrap transition-colors duration-200 max-[359px]:px-1.5 ${
        selected ? 'border-ink bg-ink text-cream' : 'border-ink/15 bg-white text-ink group-hover:border-ink/35'
      }`}
    >
      <motion.span
        key={String(selected)}
        initial={tapped ? { scale: 0.4, rotate: -30 } : false}
        animate={{ scale: 1, rotate: 0 }}
        transition={spring.bouncy}
        className="inline-flex"
      >
        {selected ? <Check size={14} strokeWidth={3} /> : <Plus size={14} strokeWidth={3} />}
      </motion.span>
      <span className="max-[359px]:hidden">{selected ? t('เข้าร่วมแล้ว', 'Joined') : t('เข้าร่วม', 'Join')}</span>
    </span>
  )
}
