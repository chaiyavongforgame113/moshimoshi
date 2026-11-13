import { motion } from 'motion/react'
import { ChevronRight, DoorOpen, Plus } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { TiltCard, TiltGlare } from '@/components/motion'
import { RoomIcon, ShowMore } from '@/components/ui'
import { useDataReady, useRooms, useRoomStats } from '@/data/hooks'
import { MOCHI } from '@/lib/colors'
import { t } from '@/lib/i18n'
import { pop } from '@/lib/motion'
import { useMoshi } from '@/lib/store'
import type { Room } from '@/lib/types'
import { Block, seeAllClass } from './Block'
import { SoftSkeleton } from './Soft'

/** the "new room" tile that ends the list */
type Slot = Room | 'new'

/** a list this long (rooms + the new-room tile) shows whole; a longer one starts with FIRST rooms */
const WHOLE = 6
const FIRST = 4

/**
 * "ห้องของเรา" — joined rooms with live online counts.
 * `wide`: the block spans the whole content width (nothing beside it), so the rooms
 * stay in a grid there instead of one long row per room.
 */
export function MyRooms({ className = '', wide = false }: { className?: string; wide?: boolean }) {
  const roomIds = useMoshi((s) => s.me.rooms)
  const all = useRooms()
  const ready = useDataReady()
  const rooms = useMemo(() => roomIds.map((id) => all.find((r) => r.id === id)).filter((r): r is Room => !!r), [roomIds, all])
  const slots = useMemo<Slot[]>(() => [...rooms, 'new'], [rooms])
  const first = slots.length <= WHOLE ? slots.length : FIRST

  return (
    <Block
      id="home-rooms"
      tone="sky"
      title={t('ห้องของเรา', 'Your rooms')}
      icon={<DoorOpen size={18} strokeWidth={2.4} />}
      className={className}
      action={
        <Link to="/app/rooms" className={seeAllClass}>
          <span className="max-[400px]:sr-only">{t('ทั้งหมด', 'All')}</span> <ChevronRight size={16} aria-hidden />
        </Link>
      }
    >
      {!ready ? (
        <SoftSkeleton rows={2} />
      ) : (
        <motion.div variants={pop} initial="hidden" whileInView="show" viewport={{ once: true }}>
          {/* the tile always ends the list, so one press shows every room; a list that grows or shrinks starts over */}
          <ShowMore
            key={first}
            items={slots}
            initial={first}
            step={slots.length}
            getKey={(s) => (s === 'new' ? 'new' : s.id)}
            listClassName={`grid grid-cols-2 gap-3 ${wide ? 'lg:grid-cols-3' : 'md:grid-cols-1'}`}
            moreLabel={(n) => t(`ดูห้องของเราเพิ่ม (อีก ${n - 1})`, `Show more of your rooms (${n - 1} more)`)}
            render={(s) =>
              s === 'new' ? (
                <Link
                  to="/app/rooms"
                  className="flex h-full min-h-[6.5rem] flex-col items-center justify-center gap-1.5 rounded-[1.75rem] border-2 border-dashed border-line bg-white/40 p-3 text-center font-display text-sm font-semibold text-ink-soft transition-colors hover:border-peach hover:bg-white/70 hover:text-ink md:min-h-16 md:flex-row"
                >
                  <Plus size={18} aria-hidden />
                  {rooms.length ? t('หาห้องใหม่', 'Find a new room') : t('หาห้องแรกของเรา', 'Find your first room')}
                </Link>
              ) : (
                <MyRoomCard room={s} />
              )
            }
          />
        </motion.div>
      )}
    </Block>
  )
}

function MyRoomCard({ room: r }: { room: Room }) {
  const online = useRoomStats(r.id)?.online ?? r.onlineCount
  return (
    <TiltCard className="h-full" max={7} glare={false}>
      <Link
        to={`/app/rooms/${r.id}`}
        data-cursor={t('เข้าห้อง', 'Hop in')}
        className="card group relative flex h-full flex-col gap-2 overflow-hidden p-3 transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)] md:flex-row md:items-center md:gap-3"
      >
        <TiltGlare />
        <span
          aria-hidden
          className="pointer-events-none absolute -right-8 -bottom-10 size-24 rounded-full opacity-60 blur-xl"
          style={{ background: MOCHI[r.color].base }}
        />
        <RoomIcon room={r} size={44} />
        <span className="relative min-w-0 flex-1">
          <span className="block font-display leading-snug font-semibold md:truncate">{r.name}</span>
          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-soft">
            <span className="relative flex size-2" aria-hidden>
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-success" />
            </span>
            {t(`${online} คนออนไลน์`, `${online} online`)}
          </span>
        </span>
        <ChevronRight size={18} className="relative hidden shrink-0 text-ink-soft transition-transform group-hover:translate-x-0.5 md:block" aria-hidden />
      </Link>
    </TiltCard>
  )
}
