import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Check, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { RoomIcon, ShowMore } from '@/components/ui'
import { useRooms } from '@/data/hooks'
import { tagOf } from '@/data/tags'
import { MOCHI } from '@/lib/colors'
import { t } from '@/lib/i18n'
import { fadeUp, spring } from '@/lib/motion'
import type { Room } from '@/lib/types'
import { lobbyOf, rankRooms, type StepProps } from '../model'
import { keyWiggle } from '../parts/hooks'

interface RoomRowItem {
  room: Room
  shared: string[]
  note?: string
  recommended?: boolean
}

/**
 * 10 · rooms, already picked for them (the lounge + the two that fit best). They only confirm;
 * the picks lead the list and every other room waits behind "ดูห้องอื่น".
 */
export function StepRooms({ draft, update }: StepProps) {
  const rooms = useRooms()
  // the order is settled once, so rows don't jump around while they tick and untick
  const [firstPicks] = useState(() => draft.rooms)
  const items = useMemo<RoomRowItem[]>(() => {
    const ranked = rankRooms(draft, rooms)
    const recommended = new Set(ranked.filter((r) => r.score > 0).slice(0, 2).map((r) => r.room.id))
    const lobby = lobbyOf(rooms)
    const all: RoomRowItem[] = [
      ...(lobby ? [{ room: lobby, shared: [], note: t('ห้องรวมของทุกคน แวะมาทักทายได้เสมอ', "Everyone's room. Drop by and say hi anytime") }] : []),
      ...ranked.map((r) => ({ room: r.room, shared: r.shared, recommended: recommended.has(r.room.id) })),
    ]
    const picked = all.filter((x) => firstPicks.includes(x.room.id))
    return [...picked, ...all.filter((x) => !firstPicks.includes(x.room.id))]
  }, [draft, rooms, firstPicks])

  const toggle = (id: string) =>
    update((d) => ({ roomsTouched: true, rooms: d.rooms.includes(id) ? d.rooms.filter((r) => r !== id) : [...d.rooms, id] }))

  if (!rooms.length) {
    return (
      <motion.p variants={fadeUp} className="rounded-3xl bg-white/70 p-4 text-[15px] text-ink">
        {t('ยังไม่มีห้องเปิดเลย เดี๋ยวพี่โมชิเปิดห้องแล้วจะชวนนะ ไปต่อได้เลย', 'No rooms are open yet. Our Mochi hosts will invite you once one opens. Go ahead and continue')}
      </motion.p>
    )
  }

  return (
    <motion.div variants={fadeUp}>
      <ShowMore
        items={items}
        initial={Math.max(3, firstPicks.length)}
        getKey={(x) => x.room.id}
        listClassName="space-y-2"
        moreLabel={(n) => t(`ดูห้องอื่น (อีก ${n})`, `More rooms (${n} more)`)}
        render={(x) => <RoomRow item={x} selected={draft.rooms.includes(x.room.id)} onToggle={() => toggle(x.room.id)} />}
      />
    </motion.div>
  )
}

function RoomRow({ item, selected, onToggle }: { item: RoomRowItem; selected: boolean; onToggle: () => void }) {
  const { room, shared, note, recommended } = item
  const p = MOCHI[room.color]
  const reduce = useReducedMotion()
  const sharedNames = shared.slice(0, 2).flatMap((id) => tagOf(id)?.label ?? [])
  return (
    <motion.button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      whileTap={reduce ? undefined : { scale: 0.98 }}
      transition={spring.bouncy}
      className={`flex w-full items-center gap-3 rounded-[1.6rem] border-2 p-3 text-left transition-colors ${
        selected ? 'shadow-[var(--shadow-soft)]' : 'border-line bg-white/80 hover:bg-white'
      }`}
      style={selected ? { background: `linear-gradient(160deg, white 0%, ${p.light} 100%)`, borderColor: p.shade } : undefined}
    >
      <motion.span className="shrink-0" animate={reduce ? undefined : { rotate: selected ? [0, -8, 6, 0] : 0, transition: keyWiggle }}>
        <RoomIcon room={room} size={44} />
      </motion.span>
      <span className="block min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="min-w-0 font-display text-base leading-snug font-semibold wrap-break-word text-ink">{room.name}</span>
          {recommended && (
            <span className="inline-flex h-6 items-center gap-1 rounded-full bg-butter/70 px-2 text-[11px] font-semibold text-ink">
              <Sparkles size={11} aria-hidden /> {t('น่าจะถูกใจ', 'For you')}
            </span>
          )}
        </span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-sm text-ink-soft">
          <span className="size-2 shrink-0 rounded-full bg-success" aria-hidden />
          <span className="min-w-0 truncate">
            {t(`ออนไลน์ ${room.onlineCount} คน`, `${room.onlineCount} online`)} ·{' '}
            {sharedNames.length ? t(`มีเรื่องที่ชอบ: ${sharedNames.join(', ')}`, `Your interests: ${sharedNames.join(', ')}`) : (note ?? room.tagline)}
          </span>
        </span>
      </span>
      <span
        className={`grid size-8 shrink-0 place-items-center rounded-full border-2 transition-colors ${selected ? 'border-ink bg-ink text-cream' : 'border-ink/20 bg-white'}`}
        aria-hidden
      >
        <AnimatePresence>
          {selected && (
            <motion.span initial={reduce ? false : { scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={spring.bouncy} className="inline-flex">
              <Check size={16} strokeWidth={3} />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </motion.button>
  )
}
