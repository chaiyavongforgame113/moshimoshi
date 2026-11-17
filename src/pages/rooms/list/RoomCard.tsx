import { motion } from 'motion/react'
import { ChevronRight, Sparkles } from 'lucide-react'
import { Link } from 'react-router'
import { TiltCard, TiltGlare } from '@/components/motion'
import { RoomIcon, TagChip } from '@/components/ui'
import { usePeople } from '@/data/hooks'
import { TAG_BY_ID } from '@/data/tags'
import { MOCHI } from '@/lib/colors'
import { t } from '@/lib/i18n'
import { spring } from '@/lib/motion'
import type { Room, RoomWatch, Session, User } from '@/lib/types'
import { OpenDot } from '@/pages/events/EventCard'
import { useEventHref } from '@/pages/events/lib'
import { AvatarStack, HostBadge, JoinButton, PresenceLine } from '../bits'
import { kindredMembers, roomMembers, sharedRoomTags } from '../roomData'
import { WatchingBadge } from '../watch/WatchBits'

interface CardProps {
  room: Room
  me: User
  joined: boolean
  onToggle: () => void
  /** an event open in this room right now: a small live badge that goes straight in */
  openEvent?: Session
  /** a clip the room is watching together right now: "กำลังดูด้วยกัน" */
  watching?: RoomWatch
}

// Whole card is clickable through the stretched title link; buttons sit above it (z-10).
const stretched =
  "outline-none after:absolute after:inset-0 after:z-[5] after:rounded-[inherit] after:content-['']"

function KindredLine({ room, me }: { room: Room; me: User }) {
  const kindred = kindredMembers(room.id, me, usePeople())
  const shared = sharedRoomTags(room, me)
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-sm text-ink">
      <Sparkles size={15} strokeWidth={2.4} className="shrink-0" aria-hidden />
      <span className="line-clamp-2">
        {kindred.length > 0 ? (
          <>
            {t('มี ', '')}
            <b className="font-display">{kindred.length}</b>
            {t(' คนที่ชอบเรื่องเดียวกับเรา', kindred.length === 1 ? ' person loves what you love' : ' people love what you love')}
          </>
        ) : shared.length > 0 ? (
          t(`มี ${TAG_BY_ID[shared[0]]?.label} ที่เราชอบด้วย`, `Also on your profile: ${TAG_BY_ID[shared[0]]?.label}`)
        ) : (
          t('ห้องใหม่ เพื่อนใหม่ ลองแวะไปทักดูนะ', 'New room, new friends. Pop in and say hi')
        )}
      </span>
    </span>
  )
}

export function RoomCard({ room, me, joined, onToggle, openEvent, watching }: CardProps) {
  const p = MOCHI[room.color]
  const members = roomMembers(room.id, usePeople())
  const shared = sharedRoomTags(room, me)
  const tags = [...shared, ...room.tags.filter((t) => !shared.includes(t))].slice(0, 3)
  const eventHref = useEventHref()
  return (
    <TiltCard className="h-full" glare={false}>
      <motion.article
        whileHover={{ y: -4 }}
        whileTap={{ scale: 0.985 }}
        transition={spring.soft}
        className="group relative isolate flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-line bg-white p-4 shadow-[var(--shadow-soft)] transition-shadow hover:shadow-[var(--shadow-lift)] has-[a:focus-visible]:outline-3 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-lavender md:p-5"
      >
        <TiltGlare />
        {/* soft colour glow in the corner, grows on hover */}
        <span
          aria-hidden
          className="pointer-events-none absolute -top-20 -right-16 -z-10 size-48 rounded-full opacity-60 blur-2xl transition-transform duration-500 group-hover:scale-125"
          style={{ background: p.base }}
        />
        <div className="flex items-start gap-3.5">
          <RoomIcon room={room} size={54} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="pt-0.5 font-display text-lg leading-snug font-semibold">
                <Link to={`/app/rooms/${room.id}`} className={stretched} data-cursor={t('แวะดูห้อง', 'Peek in')}>
                  {room.name}
                </Link>
              </h3>
              <span className="shrink-0 md:hidden">
                <JoinButton room={room} joined={joined} onToggle={onToggle} compact />
              </span>
              <span className="hidden md:inline-flex">
                <HostBadge userId={room.hostIds[0]} withName={false} />
              </span>
            </div>
            <p className="line-clamp-2 text-sm text-ink-soft">{room.tagline}</p>
          </div>
        </div>

        {tags.length > 0 && (
          <div className="mt-3 hidden flex-wrap gap-1.5 md:flex">
            {tags.map((t) => TAG_BY_ID[t] && <TagChip key={t} tag={TAG_BY_ID[t]} selected={shared.includes(t)} size="sm" />)}
          </div>
        )}

        {openEvent && (
          // above the card's own link (z-10): this one goes straight into the event
          <Link
            to={eventHref(openEvent)}
            className="relative z-10 mt-3 flex min-h-11 items-center gap-2 rounded-2xl px-3 py-2 text-sm text-ink transition-[filter] hover:brightness-[0.97]"
            style={{ background: MOCHI.mint.light, boxShadow: `inset 0 0 0 1.5px ${MOCHI.mint.base}` }}
          >
            <OpenDot className="mx-0.5" />
            <span className="min-w-0 flex-1 truncate">
              <b className="font-display">{t('อีเวนต์เปิดอยู่', 'Event open')}</b> · {openEvent.title}
            </span>
            <ChevronRight size={16} strokeWidth={2.4} aria-hidden className="shrink-0" />
          </Link>
        )}

        {watching && <WatchingBadge watch={watching} />}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <PresenceLine room={room} />
          <AvatarStack people={members} size={26} max={4} />
        </div>

        <div className="mt-auto pt-3">
          <div className="flex min-h-11 items-center justify-between gap-3 border-t border-dashed border-line pt-3">
            <KindredLine room={room} me={me} />
            <span className="shrink-0 md:hidden">
              <HostBadge userId={room.hostIds[0]} withName={false} />
            </span>
            <span className="hidden shrink-0 md:inline-flex">
              <JoinButton room={room} joined={joined} onToggle={onToggle} />
            </span>
          </div>
        </div>
      </motion.article>
    </TiltCard>
  )
}
